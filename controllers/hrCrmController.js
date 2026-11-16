import { CRM_COLLECTIONS, CrmModels, CrmCompany } from "../models/hr/HrCrm.js";
import HrEmployee from "../models/hr/HrEmployee.js";
import { crmId, phone10 } from "../utils/crmLeads.js";

// Shared IndiaDeals CRM data. Who sees and changes what:
//   Admin          everything; the only role that assigns leads and deletes leads / properties / clients / deals
//   Sales Manager  sees and edits everything, cannot assign or delete those
//   Sales Agent,
//   Telecaller     only the leads assigned to them (and those leads' visits, tasks, deals and timeline);
//                  all properties and clients

const MAX_BULK = 5000;
const ADMIN_DELETE = new Set(["leads", "properties", "clients", "deals"]);
const PREFIX = { leads: "l", properties: "p", clients: "c", deals: "d", visits: "v", tasks: "t", activities: "a" };
const LEAD_LINKED = { visits: "agentId", tasks: "assignedTo", deals: "agentId" };

const serverError = (res, err) => {
    console.error(err);
    res.status(500).json({ message: "Server error" });
};

// req.crm = { me, role, admin, seeAll }
export const requireCrm = (req, res, next) => {
    if (req.hrUser?.role === "admin") {
        req.crm = { me: "", role: "Admin", admin: true, seeAll: true };
        return next();
    }
    const e = req.hrEmployee;
    if (!e?.crmAccess) return res.status(403).json({ message: "CRM access isn't turned on for you. Ask HR to enable it." });
    const role = e.crmRole || "Sales Agent";
    req.crm = { me: String(e._id), role, admin: role === "Admin", seeAll: role === "Admin" || role === "Sales Manager" };
    next();
};

// Drop Mongo operators and dotted keys from anything the app sends
const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object" && !(v instanceof Date)) {
        const out = {};
        for (const [k, x] of Object.entries(v)) if (!k.startsWith("$") && !k.includes(".") && k !== "_id") out[k] = clean(x);
        return out;
    }
    return v;
};

const colOf = (req, res) => {
    const col = req.params.col;
    if (!CRM_COLLECTIONS.includes(col)) {
        res.status(404).json({ message: "Unknown CRM collection" });
        return null;
    }
    return col;
};

const myLeadIds = async (me) => (await CrmModels.leads.find({ assignedTo: me }, { id: 1 }).lean()).map((l) => l.id);

// Mongo filter for the records this user may see in a collection
const scope = async (req, col) => {
    const { me, seeAll } = req.crm;
    if (seeAll || col === "properties" || col === "clients") return {};
    if (col === "leads") return { assignedTo: me };
    const ids = await myLeadIds(me);
    if (col === "activities") return { leadId: { $in: ids } };
    return { $or: [{ [LEAD_LINKED[col]]: me }, { leadId: { $in: ids } }] };
};

// Shape a record before it is written: who may assign, phone index, who wrote the timeline entry
const prepare = (req, col, rec, isNew) => {
    const { me, admin } = req.crm;
    const out = clean(rec);
    delete out.id;
    if (col === "leads") {
        if (!admin) {
            if (isNew) out.assignedTo = me;
            else delete out.assignedTo;
        }
        if (out.phone !== undefined) out.phone10 = phone10(out.phone);
    }
    if (col === "activities" && isNew) out.by = me || out.by || "";
    out.updatedAt = new Date().toISOString();
    return out;
};

// Non-managers may only attach visits / tasks / deals / notes to their own leads
const leadAllowed = async (req, leadIds) => {
    if (req.crm.seeAll) return true;
    const wanted = [...new Set(leadIds.filter(Boolean))];
    if (!wanted.length) return true;
    const n = await CrmModels.leads.countDocuments({ id: { $in: wanted }, assignedTo: req.crm.me });
    return n === wanted.length;
};

const DEFAULT_COMPANY = { name: "IndiaDeals", tagline: "Real Estate Advisory", phone: "", email: "", address: "", rera: "", gst: "" };

export const getCrmData = async (req, res) => {
    try {
        const out = {};
        for (const col of CRM_COLLECTIONS) {
            const q = CrmModels[col].find(await scope(req, col), { _id: 0 }).lean();
            if (col === "activities") q.sort({ at: -1 }).limit(20000);
            out[col] = await q;
        }
        const company = await CrmCompany.findOne({ key: "company" }).lean();
        res.json({ ...out, company: { ...DEFAULT_COMPANY, ...(company?.data || {}) }, access: req.crm });
    } catch (err) { serverError(res, err); }
};

// POST /crm/data/:col  { item } or { items: [...] }
export const createCrmRecords = async (req, res) => {
    try {
        const col = colOf(req, res);
        if (!col) return;
        const raw = Array.isArray(req.body?.items) ? req.body.items : req.body?.item ? [req.body.item] : [];
        if (!raw.length) return res.status(400).json({ message: "Nothing to add" });
        if (raw.length > MAX_BULK) return res.status(400).json({ message: `Add at most ${MAX_BULK} records at a time` });
        if (col !== "leads" && !(await leadAllowed(req, raw.map((r) => r?.leadId)))) {
            return res.status(403).json({ message: "You can only add these to leads assigned to you" });
        }
        const now = new Date().toISOString();
        const docs = raw.map((r) => ({
            createdAt: now,
            ...prepare(req, col, r || {}, true),
            id: typeof r?.id === "string" && /^[\w-]{1,64}$/.test(r.id) ? r.id : crmId(PREFIX[col]),
        }));
        await CrmModels[col].insertMany(docs, { ordered: false });
        res.status(201).json({ items: docs.map(({ _id, ...d }) => d) });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: "Some records already exist. Reload and try again." });
        serverError(res, err);
    }
};

// PATCH /crm/data/:col/:id  { patch }   or   PATCH /crm/data/:col  { ids, patch }
export const updateCrmRecords = async (req, res) => {
    try {
        const col = colOf(req, res);
        if (!col) return;
        const ids = req.params.id ? [req.params.id] : Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
        if (!ids.length) return res.status(400).json({ message: "No records selected" });
        // non-admins can't assign: prepare() drops assignedTo from their lead edits
        const patch = prepare(req, col, req.body?.patch || {}, false);
        if (patch.leadId !== undefined && !(await leadAllowed(req, [patch.leadId]))) {
            return res.status(403).json({ message: "You can only link this to leads assigned to you" });
        }
        const filter = { ...(await scope(req, col)), id: { $in: ids } };
        const r = await CrmModels[col].updateMany(filter, { $set: patch });
        if (r.matchedCount < ids.length) return res.status(403).json({ message: "Some of these records aren't yours or no longer exist" });
        res.json({ updated: r.modifiedCount });
    } catch (err) { serverError(res, err); }
};

// DELETE /crm/data/:col/:id   or   DELETE /crm/data/:col  { ids }
export const deleteCrmRecords = async (req, res) => {
    try {
        const col = colOf(req, res);
        if (!col) return;
        if (ADMIN_DELETE.has(col) && !req.crm.admin) return res.status(403).json({ message: "Only the CRM admin can delete these" });
        const ids = req.params.id ? [req.params.id] : Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
        if (!ids.length) return res.status(400).json({ message: "No records selected" });
        const r = await CrmModels[col].deleteMany({ ...(await scope(req, col)), id: { $in: ids } });
        if (col === "leads") await CrmModels.activities.deleteMany({ leadId: { $in: ids } });
        res.json({ deleted: r.deletedCount });
    } catch (err) { serverError(res, err); }
};

export const updateCrmCompany = async (req, res) => {
    try {
        if (!req.crm.admin) return res.status(403).json({ message: "Only the CRM admin can change the company profile" });
        const data = clean(req.body || {});
        const doc = await CrmCompany.findOneAndUpdate({ key: "company" }, { $set: { data } }, { upsert: true, new: true }).lean();
        res.json({ company: { ...DEFAULT_COMPANY, ...doc.data } });
    } catch (err) { serverError(res, err); }
};

// Admin only: load a CRM backup (e.g. the data that used to live in a browser). replace=true wipes first.
export const importCrmData = async (req, res) => {
    try {
        if (!req.crm.admin) return res.status(403).json({ message: "Only the CRM admin can import data" });
        const data = req.body?.data || {};
        if (!Array.isArray(data.leads)) return res.status(400).json({ message: "This isn't a CRM backup file" });
        const team = new Set((await HrEmployee.find({ crmAccess: true }, { _id: 1 }).lean()).map((e) => String(e._id)));
        const counts = {};
        for (const col of CRM_COLLECTIONS) {
            const list = Array.isArray(data[col]) ? data[col] : [];
            if (req.body.replace) await CrmModels[col].deleteMany({});
            if (!list.length) { counts[col] = 0; continue; }
            const now = new Date().toISOString();
            const docs = list.filter((r) => r && typeof r === "object").map((r) => {
                const d = clean(r);
                d.id = typeof r.id === "string" && r.id ? r.id : crmId(PREFIX[col]);
                d.createdAt = d.createdAt || now;
                // people from the old demo team don't exist in HR: leave their work unassigned
                for (const k of ["assignedTo", "agentId"]) if (k in d && !team.has(String(d[k]))) d[k] = "";
                if (col === "leads") d.phone10 = phone10(d.phone);
                return d;
            });
            const ops = docs.map((d) => ({ replaceOne: { filter: { id: d.id }, replacement: d, upsert: true } }));
            for (let i = 0; i < ops.length; i += 1000) await CrmModels[col].bulkWrite(ops.slice(i, i + 1000), { ordered: false });
            counts[col] = docs.length;
        }
        if (data.company && typeof data.company === "object") {
            await CrmCompany.findOneAndUpdate({ key: "company" }, { $set: { data: clean(data.company) } }, { upsert: true });
        }
        res.json({ imported: counts });
    } catch (err) { serverError(res, err); }
};
