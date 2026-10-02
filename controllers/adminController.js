import mongoose from "mongoose";
import Property from "../models/Property.js";
import Lead from "../models/Lead.js";
import User from "../models/User.js";

// ── Admin panel: platform-wide view of users, properties and leads ─────────────
// Every handler here is mounted behind authMiddleware + adminMiddleware.

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const paging = (query, defaultLimit = 20) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const pageMeta = (page, limit, total) => ({
  page,
  limit,
  totalItems: total,
  totalPages: Math.max(Math.ceil(total / limit), 1),
});

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getAdminStats = async (req, res) => {
  try {
    const today = startOfToday();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, admins, newUsersWeek,
      totalProperties, pending, approved, rejected, active,
      totalLeads, leadsToday, leadsWeek,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Property.countDocuments(),
      Property.countDocuments({ approvalStatus: "pending" }),
      Property.countDocuments({ approvalStatus: "approved" }),
      Property.countDocuments({ approvalStatus: "rejected" }),
      Property.countDocuments({ status: "active" }),
      Lead.countDocuments(),
      Lead.countDocuments({ createdAt: { $gte: today } }),
      Lead.countDocuments({ createdAt: { $gte: weekAgo } }),
    ]);

    const recentLeads = await Lead.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("property_id", "projectname npxid")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, admins, newThisWeek: newUsersWeek },
        properties: { total: totalProperties, pending, approved, rejected, active },
        leads: { total: totalLeads, today: leadsToday, thisWeek: leadsWeek },
        recentLeads,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminProperties = async (req, res) => {
  try {
    const { page, limit, skip } = paging(req.query);
    const { search = "", approvalStatus = "", status = "", owner = "" } = req.query;

    const filter = {};
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (status) filter.status = status;
    if (owner && mongoose.isValidObjectId(owner)) filter.owner = owner;
    if (search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [
        { projectname: rx },
        { npxid: rx },
        { spid: rx },
        { rera: rx },
        { "location.City": rx },
        { "location.Address": rx },
      ];
    }

    const [items, total] = await Promise.all([
      Property.find(filter)
        .select("projectname npxid spid purpose property price status approvalStatus rejectionReason location images owner createdAt updatedAt")
        .populate("owner", "name mobile email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(filter),
    ]);

    // lead count per property on this page
    const ids = items.map((p) => p._id);
    const counts = await Lead.aggregate([
      { $match: { property_id: { $in: ids } } },
      { $group: { _id: "$property_id", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

    const data = items.map((p) => {
      const cover = (p.images || []).find((i) => i.type === "cover") || (p.images || []).find((i) => i.type !== "brouser");
      const { images, ...rest } = p;
      return { ...rest, coverImage: cover?.src || "", leadCount: countMap[String(p._id)] || 0 };
    });

    res.status(200).json({ success: true, data, ...pageMeta(page, limit, total) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminPropertyStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'active' or 'inactive'" });
    }

    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).select("projectname status");

    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, property });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, message: `${property.projectname || "Property"} deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminLeads = async (req, res) => {
  try {
    const { page, limit, skip } = paging(req.query);
    const { search = "", property = "" } = req.query;

    const filter = {};
    if (property && mongoose.isValidObjectId(property)) filter.property_id = property;
    if (search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ Name: rx }, { PhoneNumber: rx }, { email: rx }, { projectname: rx }, { message: rx }];
    }

    const [items, total] = await Promise.all([
      Lead.find(filter)
        .populate("property_id", "projectname npxid spid")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Lead.countDocuments(filter),
    ]);

    // projectOwner is stored as a plain string id
    const ownerIds = [...new Set(items.map((l) => l.projectOwner).filter((id) => mongoose.isValidObjectId(id)))];
    const owners = await User.find({ _id: { $in: ownerIds } }).select("name mobile email").lean();
    const ownerMap = Object.fromEntries(owners.map((o) => [String(o._id), o]));

    const data = items.map((l) => ({ ...l, owner: ownerMap[l.projectOwner] || null }));

    res.status(200).json({ success: true, data, ...pageMeta(page, limit, total) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const { page, limit, skip } = paging(req.query);
    const { search = "", role = "" } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ name: rx }, { email: rx }, { mobile: rx }, { company_name: rx }];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name email mobile role you_are company_name createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const ids = items.map((u) => u._id);
    const [propCounts, leadCounts] = await Promise.all([
      Property.aggregate([
        { $match: { owner: { $in: ids } } },
        { $group: { _id: "$owner", count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { projectOwner: { $in: ids.map(String) } } },
        { $group: { _id: "$projectOwner", count: { $sum: 1 } } },
      ]),
    ]);
    const propMap = Object.fromEntries(propCounts.map((c) => [String(c._id), c.count]));
    const leadMap = Object.fromEntries(leadCounts.map((c) => [String(c._id), c.count]));

    const data = items.map((u) => ({
      ...u,
      propertyCount: propMap[String(u._id)] || 0,
      leadCount: leadMap[String(u._id)] || 0,
    }));

    res.status(200).json({ success: true, data, ...pageMeta(page, limit, total) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ success: false, message: "role must be 'admin' or 'user'" });
    }

    const selfId = String(req.user?.user_id || req.user?.id || "");
    if (req.params.id === selfId && role !== "admin") {
      return res.status(400).json({ success: false, message: "You cannot remove your own admin access" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true }
    ).select("name mobile email role");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
