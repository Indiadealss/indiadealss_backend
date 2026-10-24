// Sample company for the HR app. Produces marked example records (sample: true)
// so a fresh install opens in a working state. Employees are referenced by `code`;
// the controller swaps codes for real employee ids when it saves them.

function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n) => String(n).padStart(2, "0");
// dates are handled in UTC so the server's own timezone can't shift them
const iso = (d) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
const hm = (mins) => pad(Math.floor(mins / 60)) + ":" + pad(mins % 60);
const addDays = (ds, n) => { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export default function makeHrSample(todayISO) {
  const r = rng(20261022);
  const year = todayISO.slice(0, 4);
  const settings = {
    company: "IndiaDeals Realty (sample)",
    sites: ["Head office, Gurugram", "Sector 89 project site", "Dwarka Expressway site", "Sohna Road site"],
    weeklyOff: [0, 6],
    holidays: [
      { date: year + "-08-15", name: "Independence Day" },
      { date: year + "-10-02", name: "Gandhi Jayanti" },
      { date: year + "-12-25", name: "Christmas" }
    ],
    graceMins: 10,
    lateLimit: 3,
    halfDayHours: 4.5,
    pt: 0,
    quota: { CL: 12, SL: 12, EL: 15 },
    sample: true
  };
  const people = [
    ["ID101", "Vikram Malhotra", "Sales", "Sales Manager", 95000, "10:00", "2021-06-14", 5200, "Head office, Gurugram"],
    ["ID102", "Neha Kapoor", "Sales", "Senior Relationship Manager", 62000, "10:00", "2022-08-01", 1800, "Sector 89 project site"],
    ["ID103", "Arjun Rathi", "Sales", "Site Executive", 32000, "09:30", "2024-02-12", 0, "Dwarka Expressway site"],
    ["ID104", "Pooja Bhatia", "Pre-sales", "Telecaller", 18500, "09:30", "2025-01-20", 0, "Head office, Gurugram"],
    ["ID105", "Rahul Chauhan", "Channel Partners", "CP Manager", 58000, "10:00", "2022-11-07", 1200, "Sohna Road site"],
    ["ID106", "Simran Kaur", "CRM", "Customer Relations Executive", 34000, "09:30", "2023-09-04", 0, "Head office, Gurugram"],
    ["ID107", "Deepak Saini", "Sales", "Site Executive", 28000, "09:30", "2024-07-15", 0, "Sector 89 project site"],
    ["ID108", "Anjali Mehra", "Accounts", "Accounts Executive", 40000, "09:30", "2023-03-27", 0, "Head office, Gurugram"]
  ];
  const employees = people.map((p) => ({
    code: p[0], name: p[1], dept: p[2], designation: p[3],
    gross: p[4], shift: p[5], joined: p[6], tds: p[7], base: p[8], active: true, sample: true
  }));

  const today = new Date(todayISO + "T00:00:00Z");
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const hol = new Set(settings.holidays.map((h) => h.date));
  const attendance = [];
  const leaves = [];
  for (const e of employees) {
    const [sh, sm] = e.shift.split(":").map(Number);
    const shiftMin = sh * 60 + sm;
    let leaveRun = null;
    for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = iso(d);
      if (settings.weeklyOff.includes(d.getUTCDay()) || hol.has(ds)) { leaveRun = null; continue; }
      const isToday = ds === todayISO;
      const x = r();
      if (!isToday && x < 0.035) { leaveRun = null; continue; } // absent, no record
      if (!isToday && x < 0.075) {
        const type = r() < 0.55 ? "CL" : "SL";
        if (leaveRun && leaveRun.type === type) { leaveRun.to = ds; leaveRun.days += 1; }
        else {
          leaveRun = { emp: e.code, type, from: ds, to: ds, days: 1,
            reason: type === "SL" ? "Fever" : "Personal work", status: "approved", applied: ds, sample: true };
          leaves.push(leaveRun);
        }
        continue;
      }
      leaveRun = null;
      if (isToday && r() < 0.2) continue; // not punched yet
      const late = r() < 0.13;
      const inMin = shiftMin + (late ? 12 + Math.floor(r() * 45) : -25 + Math.floor(r() * 33));
      const half = !isToday && r() < 0.03;
      const outMin = half ? inMin + 240 + Math.floor(r() * 20) : shiftMin + 540 + Math.floor(r() * 70);
      const loc = r() < 0.18 ? settings.sites[Math.floor(r() * settings.sites.length)] : e.base;
      const rec = { emp: e.code, date: ds, in: hm(inMin), loc, sample: true };
      if (!isToday || r() < 0.4) rec.out = hm(outMin);
      attendance.push(rec);
    }
  }
  // two requests waiting for approval, a few days out
  let next = addDays(todayISO, 3);
  while (settings.weeklyOff.includes(new Date(next + "T00:00:00Z").getUTCDay())) next = addDays(next, 1);
  leaves.push({ emp: "ID103", type: "EL", from: next, to: next, days: 1,
    reason: "Sister's wedding in Jaipur", status: "pending", applied: todayISO, sample: true });
  leaves.push({ emp: "ID106", type: "CL", from: next, to: next, days: 1,
    reason: "Bank work", status: "pending", applied: todayISO, sample: true });
  return { settings, employees, attendance, leaves };
}
