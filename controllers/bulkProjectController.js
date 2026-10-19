import mongoose from "mongoose";
import Property from "../models/Property.js";
import Amenities from "../models/Amenities.js";
import otheroom from "../models/otheroom.js";
import Feature from "../models/Feature.js";
import Propertyfeatures from "../models/propertyfeatures.js";
import additionalfeatures from "../models/additionalfeatures.js";
import Locationadvantages from "../models/Locationadvantages.js";

// Bulk project upload: everything the post-project form collects except photos,
// videos, layouts, brochure, FAQ and description — those are added later through
// the normal edit flow (/edit-property/:id). Projects stay approvalStatus "pending"
// until an admin approves them, so incomplete projects never show on the public site.

const MAX_ROWS = 500;
const MAX_UNITS = 50;

// Same values the post-project form stores, so the edit form recognises them.
const PROJECT_TYPES = {
  residential: ["1 Bhk", "2 Bhk", "3 Bhk", "4 Bhk", "5 Bhk", "1 Rk", "Studio Appartment", "Land", "Independent House/Villa", "Farmhouse"],
  commercial: ["Office", "Ploat/Land", "Retail", "Storage", "Industry"],
};
const TYPE_ALIASES = { "plot/land": "Ploat/Land", plot: "Ploat/Land", studio: "Studio Appartment", "studio apartment": "Studio Appartment", villa: "Independent House/Villa" };
const STATUSES = ["Ready to move", "Under construction"];
const OWNERSHIP = ["Freehold", "Leasehold", "Co-operative society", "Power of Attorney"];
const FURNISHING = ["Furnished", "Semi-furnished", "Un-furnished"];
const FACING = ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"];
const POWER_BACKUP = ["None", "Partial", "Full"];
const PRICING = ["All inclusive Price", "Tax and Govt. Charges excluded", "Price Negotiable"];
const COMMERCIAL_UNIT_TYPES = ["Offices", "Studio", "Shop"];
const PROPERTY_AGE = ["0-1 years", "1-5 years", "5-10 years", "10+ years"];
const WATER_SOURCE = ["Municipal corporation", "Borewell/Tank", "24*7 water"];
const LOCATION_ADVANTAGES = [
  { name: "Close to Metro Station", type: "metro" },
  { name: "Close to School", type: "school" },
  { name: "Close to Hospital", type: "hospital" },
  { name: "Close to Market", type: "market" },
  { name: "Close to Railway Station", type: "railway station" },
  { name: "Close to Airport", type: "airport" },
  { name: "Close to Mall", type: "mall" },
  { name: "Close to Highway", type: "highway" },
];

// Fields only the residential form has (parking is hidden for commercial);
// ignored with a warning on commercial rows
const RESIDENTIAL_ONLY = {
  coveredparking: "Covered Parking",
  uncoveredparking: "Uncovered Parking",
};

// "2BHK", "2 bhk", "2-Bhk" all compare equal (same rule as the frontend)
const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9/]/g, "");
const clean = (s) => String(s ?? "").trim();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const list = (s) => clean(s).split(",").map(clean).filter(Boolean);
const pick = (options, raw) => options.find((o) => squash(o) === squash(raw));

const matchType = (raw, category) => {
  const alias = TYPE_ALIASES[clean(raw).toLowerCase()];
  if (alias && PROJECT_TYPES[category].includes(alias)) return alias;
  return PROJECT_TYPES[category].find((t) => squash(t) === squash(raw));
};

// Optional value from a fixed list: "" when blank, undefined when not allowed
const optionalChoice = (raw, options, label, errors) => {
  if (!clean(raw)) return "";
  const value = pick(options, raw);
  if (!value) errors.push(`${label} must be one of: ${options.join(", ")}`);
  return value || "";
};

// "1.8 Cr", "85 L", "85 Lakh", "9500000", "95,00,000" → rupees, or NaN
const parseRupees = (raw) => {
  const s = clean(raw).toLowerCase().replace(/[₹,\s]/g, "");
  if (!s) return NaN;
  const m = s.match(/^(\d+(?:\.\d+)?)(cr|crore|crores|l|lac|lakh|lakhs|k)?$/);
  if (!m) return NaN;
  const mult = { cr: 1e7, crore: 1e7, crores: 1e7, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, k: 1e3 }[m[2]] || 1;
  return Math.round(Number(m[1]) * mult);
};

// "1350", "1350 sq.ft", "1,350 sqft" → 1350, or NaN
const parseArea = (raw) => {
  const s = clean(raw).toLowerCase().replace(/,/g, "").replace(/sq\.?\s*ft\.?|sqft/g, "").trim();
  return s && /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
};

const parseCount = (raw, label, errors) => {
  if (!clean(raw)) return 0;
  const n = Number(clean(raw));
  if (!Number.isInteger(n) || n < 0) {
    errors.push(`${label} must be a whole number`);
    return 0;
  }
  return n;
};

// 18000000 → "1.8 Cr", 8500000 → "85 L" (same style the form shows)
const formatPrice = (n) => {
  const trim = (v) => String(+v.toFixed(2));
  if (n >= 1e7) return `${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `${trim(n / 1e5)} L`;
  return n.toLocaleString("en-IN");
};

// "Add Apartment Unit" rows → unitData in the shape the form saves
const buildResidentialUnits = (units, errors) => {
  const out = [];
  units.slice(0, MAX_UNITS).forEach((u, i) => {
    const n = u.rowNumber ? `Residential unit (row ${u.rowNumber})` : `Unit ${i + 1}`;
    const bhk = clean(u.bhk);
    if (!bhk) return errors.push(`${n}: BHK Type is required`);

    const specs = { bhk };
    for (const [key, label] of [["areaMin", "Area Min"], ["areaMax", "Area Max"]]) {
      if (!clean(u[key])) continue;
      const area = parseArea(u[key]);
      if (isNaN(area)) errors.push(`${n}: ${label} must be a number in sq.ft`);
      else specs[key] = `${area} sq.ft`;
    }
    for (const [key, label] of [["priceMin", "Price Min"], ["priceMax", "Price Max"]]) {
      if (!clean(u[key])) continue;
      const price = parseRupees(u[key]);
      if (isNaN(price)) errors.push(`${n}: ${label} must be an amount like 9500000, 95 L or 1.2 Cr`);
      else specs[key] = String(price);
    }
    out.push({ id: Date.now() + i, specs, selectedKey: "", value: "" });
  });
  if (units.length > MAX_UNITS) errors.push(`Maximum ${MAX_UNITS} residential units per project`);
  return out;
};

// "Select Unit Type" rows → officeUnits grouped by type, like the form's "Save Unit"
const buildCommercialUnits = (units, errors) => {
  const groups = new Map();
  units.slice(0, MAX_UNITS).forEach((u, i) => {
    const n = u.rowNumber ? `Commercial unit (row ${u.rowNumber})` : `Unit ${i + 1}`;
    const name = pick(COMMERCIAL_UNIT_TYPES, u.unitType);
    if (!name) return errors.push(`${n}: Unit Type must be one of: ${COMMERCIAL_UNIT_TYPES.join(", ")}`);

    const area = parseArea(u.size);
    const price = parseRupees(u.price);
    if (isNaN(area)) errors.push(`${n}: Size must be a number in sq.ft`);
    if (isNaN(price)) errors.push(`${n}: Price must be an amount like 9500000, 95 L or 1.2 Cr`);
    if (isNaN(area) || isNaN(price)) return;

    if (!groups.has(name)) {
      // icon is the frontend image URL for this unit type (sent by the bulk upload page)
      groups.set(name, { name, icon: typeof u.icon === "string" ? u.icon : "", items: [] });
    }
    groups.get(name).items.push({ area, price });
  });
  if (units.length > MAX_UNITS) errors.push(`Maximum ${MAX_UNITS} commercial units per project`);
  return [...groups.values()];
};

// Lowest and highest unit price → "85 L - 1.04 Cr" (used when the Price column is blank)
const priceRange = (prices) => {
  const valid = prices.filter((p) => p > 0);
  if (!valid.length) return "";
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`;
};

// "Close to Metro Station: Sector 148 Metro (1.2 km); Close to School: DPS"
// → locatadvance items in the shape the form saves, plus the icon from the
// Locationadvantages collection when one exists (the project page shows item.icon)
const parseLocationAdvantages = (raw, errors, icons = new Map()) => {
  const out = [];
  for (const part of clean(raw).split(";").map(clean).filter(Boolean)) {
    const [head, ...rest] = part.split(":");
    const adv = LOCATION_ADVANTAGES.find((a) => squash(a.name) === squash(head) || squash(a.type) === squash(head));
    if (!adv) {
      errors.push(`Location Advantage "${clean(head)}" must be one of: ${LOCATION_ADVANTAGES.map((a) => a.name).join(", ")}`);
      continue;
    }
    if (out.some((x) => x.name === adv.name)) continue;
    const detail = clean(rest.join(":"));
    const m = detail.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    const icon = icons.get(squash(adv.name)) || icons.get(squash(adv.type));
    out.push({
      name: adv.name,
      type: adv.type,
      ...(icon ? { icon } : {}),
      propertyName: clean(m ? m[1] : detail),
      distance: clean(m ? m[2] : ""),
    });
  }
  return out;
};

// Amenities, features and other rooms are stored as ObjectId refs, so names are
// matched against their collections. Unknown names are skipped with a warning.
// Overlooking uses the additionalfeatures collection, same as the edit form.
const loadLookups = async () => {
  const toMap = (docs) => {
    const map = new Map();
    for (const d of docs) {
      map.set(squash(d.name), d._id);
      if (d.label) map.set(squash(d.label), d._id);
    }
    return map;
  };
  const [amenities, rooms, buildingFeatures, propertyFeatures, additional, locationIcons] = await Promise.all([
    Amenities.find().select("name label").lean(),
    otheroom.find().select("name label").lean(),
    Feature.find().select("name").lean(),
    Propertyfeatures.find().select("name").lean(),
    additionalfeatures.find().select("name").lean(),
    Locationadvantages.find().select("name icon").lean(),
  ]);
  return {
    locationIcons: new Map(locationIcons.filter((d) => d.icon).map((d) => [squash(d.name), d.icon])),
    amenities: toMap(amenities),
    rooms: toMap(rooms),
    buildingFeatures: toMap(buildingFeatures),
    propertyFeatures: toMap(propertyFeatures),
    additional: toMap(additional),
  };
};

const resolveRefs = (names, map, label, warnings) => {
  const ids = [];
  for (const name of names) {
    const id = map.get(squash(name));
    if (id) ids.push(id);
    else warnings.push(`${label} "${name}" not found, skipped`);
  }
  return [...new Set(ids.map(String))].map((id) => new mongoose.Types.ObjectId(id));
};

// Returns { doc, warnings } or { errors, warnings } for one spreadsheet row.
const buildProject = (row, lookups) => {
  const errors = [];
  const warnings = [];

  const projectname = clean(row.projectname);
  const city = clean(row.city);
  const locality = clean(row.locality);
  const property = clean(row.property).toLowerCase();
  const rera = clean(row.rera);
  const Possession = clean(row.Possession);
  const residential = property === "residential";

  if (!projectname) errors.push("Project name is required");
  if (!city) errors.push("City is required");
  if (!locality) errors.push("Locality is required");
  if (!PROJECT_TYPES[property]) errors.push("Category must be Residential or Commercial");

  let propertyType = [];
  if (PROJECT_TYPES[property]) {
    const rawTypes = list(row.propertyType);
    if (!rawTypes.length) errors.push("Property type is required");
    for (const t of rawTypes) {
      const match = matchType(t, property);
      if (match) propertyType.push(match);
      else errors.push(`Unknown property type "${t}" for ${property}`);
    }
    propertyType = [...new Set(propertyType)];
  }

  // the edit form refuses to save a project without these, so require them here too
  if (!clean(row.availabestatus)) errors.push("Status is required");
  if (!clean(row.ownership)) errors.push("Ownership is required");
  if (!clean(row.projectdeveloper)) errors.push("Developer is required");

  const availabestatus = optionalChoice(row.availabestatus, STATUSES, "Status", errors);
  const ownership = optionalChoice(row.ownership, OWNERSHIP, "Ownership", errors);

  let projectTotalFloor = null;
  const floorsRaw = clean(row.projectTotalFloor);
  if (!floorsRaw) errors.push("Total Floors is required");
  else if (!/^\d+$/.test(floorsRaw) || Number(floorsRaw) < 1) errors.push("Total Floors must be a whole number");
  else projectTotalFloor = floorsRaw;

  // Age only applies to ready projects, Possession only to under-construction ones
  let propertyage = optionalChoice(row.propertyage, PROPERTY_AGE, "Age of Property", errors);
  if (propertyage && availabestatus !== "Ready to move") {
    warnings.push("Age of Property ignored (only for Ready to move)");
    propertyage = "";
  }
  if (Possession && availabestatus === "Ready to move") warnings.push("Possession is usually blank for Ready to move projects");

  const watersource = [];
  for (const w of list(row.watersource)) {
    const match = pick(WATER_SOURCE, w);
    if (match) watersource.push(match);
    else errors.push(`Water Source must be from: ${WATER_SOURCE.join(", ")}`);
  }

  const selectedPricing = [];
  for (const p of list(row.selectedPricing)) {
    const match = pick(PRICING, p);
    if (match) selectedPricing.push(match);
    else errors.push(`Price Details must be from: ${PRICING.join(", ")}`);
  }

  const doc = {
    purpose: "Project",
    property,
    propertyType,
    projectname,
    apartment_name: "",
    location: [{ City: city, Address: locality, apartment_name: "" }],
    availabestatus,
    Possession,
    propertyage,
    projectTotalFloor,
    rera,
    reraStatus: rera ? "Available" : "Not Available",
    ownership,
    otherrooms: resolveRefs(list(row.otherrooms), lookups.rooms, "Other room", warnings),
    furnishing: optionalChoice(row.furnishing, FURNISHING, "Furnishing", errors),
    propertyfacing: optionalChoice(row.propertyfacing, FACING, "Property Facing", errors),
    pobackup: optionalChoice(row.pobackup, POWER_BACKUP, "Power Backup", errors),
    amenitie: resolveRefs(list(row.amenitie), lookups.amenities, "Amenity", warnings),
    Buldingfeature: resolveRefs(list(row.Buldingfeature), lookups.buildingFeatures, "Building feature", warnings),
    propertyfeature: resolveRefs(list(row.propertyfeature), lookups.propertyFeatures, "Property feature", warnings),
    addFeature: resolveRefs(list(row.addFeature), lookups.additional, "Additional feature", warnings),
    overlo: resolveRefs(list(row.overlo), lookups.additional, "Overlooking", warnings),
    watersource: [...new Set(watersource)],
    locatadvance: parseLocationAdvantages(row.locatadvance, errors, lookups.locationIcons),
    selectedPricing: [...new Set(selectedPricing)].join(","),
    projecttitle: clean(row.projecttitle),
    titleDescription: clean(row.titleDescription),
    projectdeveloper: clean(row.projectdeveloper),
    projectKeyword: clean(row.projectKeyword),
  };

  let unitPrices = [];
  if (residential) {
    doc.coveredparking = parseCount(row.coveredparking, "Covered Parking", errors);
    doc.uncoveredparking = parseCount(row.uncoveredparking, "Uncovered Parking", errors);
    doc.unitData = buildResidentialUnits(Array.isArray(row.units) ? row.units : [], errors);
    doc.officeUnits = [];
    unitPrices = doc.unitData.flatMap((u) => [Number(u.specs.priceMin), Number(u.specs.priceMax)]);
    if (Array.isArray(row.officeUnits) && row.officeUnits.length) warnings.push("Commercial units ignored for a residential project");
  } else if (PROJECT_TYPES[property]) {
    doc.officeUnits = buildCommercialUnits(Array.isArray(row.officeUnits) ? row.officeUnits : [], errors);
    doc.unitData = [];
    unitPrices = doc.officeUnits.flatMap((g) => g.items.map((it) => it.price));
    const ignored = Object.entries(RESIDENTIAL_ONLY).filter(([k]) => clean(row[k])).map(([, label]) => label);
    if (ignored.length) warnings.push(`Residential-only columns ignored: ${ignored.join(", ")}`);
    if (Array.isArray(row.units) && row.units.length) warnings.push("Residential units ignored for a commercial project");
  }

  // Price column wins; otherwise show the unit price range like the form does
  doc.price = clean(row.price) || priceRange(unitPrices);

  if (errors.length) return { errors, warnings };
  return { doc, warnings };
};

const createWithNpxid = async (doc, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    const _id = new mongoose.Types.ObjectId();
    try {
      return await Property.create({ ...doc, _id, npxid: _id.toString().slice(-5).toLowerCase() });
    } catch (err) {
      if (err?.code !== 11000 || !err?.keyPattern?.npxid || i === attempts - 1) throw err;
    }
  }
};

export const bulkCreateProjects = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows || !rows.length) {
      return res.status(400).json({ success: false, message: "No rows to upload" });
    }
    if (rows.length > MAX_ROWS) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_ROWS} projects per upload` });
    }

    // dryRun: run every check (including duplicates in the DB) but save nothing,
    // so the upload page can preview exactly what will happen
    const dryRun = req.body?.dryRun === true;
    const owner = req.bulkUser._id;
    const batchId = new mongoose.Types.ObjectId().toString();
    const lookups = await loadLookups();
    const results = [];
    const seenRera = new Set();
    const seenName = new Set();

    for (let i = 0; i < rows.length; i++) {
      // rowNumber = Excel row number (header is row 1) so the user can find it
      const rowNumber = Number(rows[i]?.rowNumber) || i + 2;
      const { doc, errors, warnings } = buildProject(rows[i] || {}, lookups);

      if (errors) {
        results.push({ rowNumber, success: false, projectname: clean(rows[i]?.projectname), errors, warnings });
        continue;
      }

      const nameKey = `${doc.projectname.toLowerCase()}|${doc.location[0].City.toLowerCase()}`;
      const reraKey = doc.rera.toLowerCase();
      const dupErrors = [];

      if (reraKey && seenRera.has(reraKey)) dupErrors.push("Same RERA appears earlier in this file");
      if (seenName.has(nameKey)) dupErrors.push("Same project name + city appears earlier in this file");

      // same name + city, or same RERA
      const or = [{
        projectname: { $regex: `^${escapeRegex(doc.projectname)}$`, $options: "i" },
        "location.City": { $regex: `^${escapeRegex(doc.location[0].City)}$`, $options: "i" },
      }];
      if (doc.rera) or.push({ rera: { $regex: `^${escapeRegex(doc.rera)}$`, $options: "i" } });

      if (!dupErrors.length) {
        // rejected projects don't block a re-upload
        const existing = await Property.findOne({ purpose: "Project", approvalStatus: { $ne: "rejected" }, $or: or }).select("projectname rera");
        if (existing) {
          dupErrors.push(
            doc.rera && existing.rera?.toLowerCase() === reraKey
              ? "A project with this RERA already exists"
              : "A project with this name already exists in this city"
          );
        }
      }

      if (dupErrors.length) {
        results.push({ rowNumber, success: false, projectname: doc.projectname, errors: dupErrors, warnings });
        continue;
      }

      if (dryRun) {
        seenName.add(nameKey);
        if (reraKey) seenRera.add(reraKey);
        results.push({ rowNumber, success: true, projectname: doc.projectname, warnings });
        continue;
      }

      try {
        // re-upload replaces an earlier rejected bulk copy, so there's no stale duplicate
        // (projects rejected before reject-deletes-bulk was added are still in the DB)
        await Property.deleteMany({ purpose: "Project", bulkUploaded: true, approvalStatus: "rejected", $or: or });

        const property = await createWithNpxid({
          ...doc,
          owner,
          status: "active",
          approvalStatus: "pending",
          bulkUploaded: true,
          bulkBatchId: batchId,
        });
        seenName.add(nameKey);
        if (reraKey) seenRera.add(reraKey);
        results.push({ rowNumber, success: true, projectname: doc.projectname, id: property._id, npxid: property.npxid, warnings });
      } catch (err) {
        results.push({ rowNumber, success: false, projectname: doc.projectname, errors: [err.message], warnings });
      }
    }

    const created = results.filter((r) => r.success).length;
    res.status(200).json({
      success: true,
      dryRun,
      batchId: dryRun ? null : batchId,
      created: dryRun ? 0 : created,
      ready: dryRun ? created : undefined,
      failed: results.length - created,
      results,
    });
  } catch (error) {
    console.error("Bulk create error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// What is still missing on a bulk-uploaded project.
const completeness = (p) => {
  const images = p.images || [];
  const countType = (...types) => images.filter((img) => types.includes(img.type)).length;
  return {
    description: !!clean(p.description),
    faq: (p.faq || []).length,
    units: (p.unitData || []).length + (p.officeUnits || []).reduce((n, g) => n + (g.items || []).length, 0),
    cover: countType("cover", "banner"),
    photos: countType("Photos", "general", ""),
    layouts: countType("layout"),
    brochure: countType("brouser", "pdf"),
    videos: (p.video || []).length,
  };
};

export const getBulkProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { bulkUploaded: true };
    if (req.query.status && req.query.status !== "all") filter.approvalStatus = req.query.status;
    if (clean(req.query.search)) {
      const rx = { $regex: escapeRegex(clean(req.query.search)), $options: "i" };
      filter.$or = [{ projectname: rx }, { rera: rx }, { "location.City": rx }];
    }

    const [projects, total] = await Promise.all([
      Property.find(filter)
        .select("projectname rera location npxid approvalStatus availabestatus property propertyType description faq unitData officeUnits images video createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: projects.map(({ images, video, unitData, officeUnits, description, faq, ...p }) => ({
        ...p,
        completeness: completeness({ images, video, unitData, officeUnits, description, faq }),
      })),
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
