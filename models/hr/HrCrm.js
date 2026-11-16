import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";

// IndiaDeals CRM data (leads, properties, visits, deals ...), shared by everyone with CRM access.
// The CRM app owns the shape of each record, so the schemas are flexible; every record has a string `id`
// the app generates (website leads get one from the server) and the fields the server filters on are indexed.

export const CRM_COLLECTIONS = ["leads", "properties", "clients", "deals", "visits", "tasks", "activities"];

const flexible = (indexes) => {
    const schema = new mongoose.Schema({
        id:{ type:String, required:true, unique:true },
    }, { strict:false, minimize:false, versionKey:false });
    for (const f of indexes) schema.index({ [f]:1 });
    schema.set("toJSON", { transform:(_doc, ret) => { delete ret._id; return ret; } });
    return schema;
};

const INDEXES = {
    leads:["assignedTo", "status", "phone10", "createdAt"],
    properties:["status"],
    clients:["leadId"],
    deals:["agentId", "leadId"],
    visits:["agentId", "leadId", "date"],
    tasks:["assignedTo", "leadId"],
    activities:["leadId", "at"],
};

const NAMES = {
    leads:"CrmLead", properties:"CrmProperty", clients:"CrmClient", deals:"CrmDeal",
    visits:"CrmVisit", tasks:"CrmTask", activities:"CrmActivity",
};

export const CrmModels = Object.fromEntries(CRM_COLLECTIONS.map((c) => [c, hrDB.model(NAMES[c], flexible(INDEXES[c]))]));

// Company profile shown in the CRM (one document)
const crmCompanySchema = new mongoose.Schema({
    key:{ type:String, default:"company", unique:true },
    data:{ type:mongoose.Schema.Types.Mixed, default:{} },
}, { minimize:false, timestamps:true });

export const CrmCompany = hrDB.model("CrmCompany", crmCompanySchema);
