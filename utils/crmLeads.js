import crypto from "crypto";
import { CrmModels } from "../models/hr/HrCrm.js";

export const phone10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
export const crmId = (prefix) => prefix + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");

const text = (v) => (v == null ? "" : String(v).trim());

// A website enquiry becomes a New, unassigned CRM lead; the CRM admin then assigns it.
// If the same phone already has an open lead, the enquiry is added to that lead's timeline instead.
// Never throws: a CRM problem must not break the website's enquiry form.
export const addWebsiteLeadToCrm = async ({ name, phone, email, project, message, purpose, city, address, websiteLeadId, page }) => {
    try {
        const p10 = phone10(phone);
        if (p10.length !== 10) return null;
        const now = new Date().toISOString();
        const label = text(project) || "a property";
        const { leads, activities } = CrmModels;

        const open = await leads.findOne({ phone10: p10, status: { $nin: ["Won", "Lost"] } }).sort({ createdAt: -1 });
        if (open) {
            await leads.updateOne({ id: open.id }, { $set: { updatedAt: now, lastEnquiryAt: now } });
            await activities.create({
                id: crmId("a"), leadId: open.id, type: "note", by: "",
                text: `Enquired again on the website for ${label}${message ? `: “${text(message)}”` : ""}`, at: now,
            });
            return open.id;
        }

        const id = crmId("l");
        await leads.create({
            id, name: text(name) || "Website visitor", phone: text(phone), phone10: p10, email: text(email),
            source: "Website", status: "New", priority: "Warm",
            listing: /rent/i.test(purpose || "") ? "Rent" : "Buy", propertyType: "", bhk: null, budget: 0,
            city: text(city), locality: text(address), project: text(project),
            requirement: [text(message), text(purpose) && `Purpose: ${text(purpose)}`, page && `Page: ${page}`].filter(Boolean).join(" · "),
            assignedTo: "", nextFollowUp: now.slice(0, 10), tags: ["Website"], lostReason: "",
            websiteLeadId: websiteLeadId ? String(websiteLeadId) : "", createdAt: now,
        });
        await activities.create({ id: crmId("a"), leadId: id, type: "created", by: "", text: `Website enquiry for ${label}`, at: now });
        return id;
    } catch (err) {
        console.error("CRM website lead failed:", err.message);
        return null;
    }
};
