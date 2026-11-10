// Payroll rules for the HR app. Pure functions (no database), so they can be checked on their own.
// Money is in rupees, months are "YYYY-MM", dates "YYYY-MM-DD" and times "HH:MM" in India time.

import { STRUCTURE_KEYS } from "../models/hr/HrEmployee.js";
import { ADJUSTMENT_TYPES } from "../models/hr/HrPayroll.js";

const r = (n) => Math.round(Number(n) || 0);
const pad = (n) => String(n).padStart(2, "0");

export const STRUCTURE_LABELS = {
  basic: "Basic", hra: "HRA", da: "Dearness allowance", conveyance: "Conveyance allowance",
  medical: "Medical allowance", special: "Special allowance"
};

// ---------- months and financial years ----------

export const daysIn = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
export const monthDates = (ym) => Array.from({ length: daysIn(ym) }, (_, i) => `${ym}-${pad(i + 1)}`);
export const addMonths = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
// April to March: "2026-05" -> "2026-27"
export const fyOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${pad((start + 1) % 100)}`;
};
export const fyMonths = (fy) => {
  const start = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => addMonths(`${start}-04`, i));
};
// months left in the financial year, counting this one (April = 12, March = 1)
export const monthsLeftInFy = (ym) => 12 - fyMonths(fyOf(ym)).indexOf(ym);
// "Q1".."Q4" of the financial year
export const fyQuarter = (ym) => `Q${Math.floor(fyMonths(fyOf(ym)).indexOf(ym) / 3) + 1}`;

const toMins = (hm) => {
  const [h, m] = String(hm || "0:0").split(":").map(Number);
  return h * 60 + m;
};

// ---------- salary structure ----------

export const structureTotal = (s) => STRUCTURE_KEYS.reduce((a, k) => a + (Number(s?.[k]) || 0), 0);

export const cleanStructure = (s) =>
  Object.fromEntries(STRUCTURE_KEYS.map((k) => [k, Math.max(0, r(s?.[k]))]));

// Splits a monthly gross into components using the company split rules.
// Basic is a % of gross, HRA and DA are % of basic, conveyance and medical are fixed, special takes the rest.
export const splitGross = (gross, split) => {
  gross = Math.max(0, r(gross));
  const basic = r((gross * split.basicPct) / 100);
  const s = { basic, hra: r((basic * split.hraPct) / 100), da: r((basic * split.daPct) / 100), conveyance: split.conveyance, medical: split.medical, special: 0 };
  // fixed allowances shrink when the gross can't carry them
  let left = gross - s.basic - s.hra - s.da;
  for (const k of ["conveyance", "medical"]) {
    s[k] = Math.max(0, Math.min(s[k], left));
    left -= s[k];
  }
  if (left < 0) {
    s.hra = Math.max(0, s.hra + left);
    left = 0;
  }
  s.special = left;
  return s;
};

// The structure to use: the employee's own, or a split of their gross for records made before structures existed
export const effectiveStructure = (structure, gross, split) =>
  structureTotal(structure) > 0 ? cleanStructure(structure) : gross > 0 ? splitGross(gross, split) : cleanStructure({});

// ---------- attendance for a month ----------
// Mirrors the muster roll in the app: an HR override wins, then the punches, then the calendar.
// Days still to come in the month are counted as paid ("projected").

export function monthAttendance({ month, employee, records, leaves, settings, today }) {
  const pay = settings.payroll;
  const hol = new Map(settings.holidays.map((h) => [h.date, h.name]));
  const fullDay = pay.shiftHours * 60;
  const shiftStart = toMins(employee.shift || "09:30");
  const a = { P: 0, HD: 0, A: 0, L: 0, LWP: 0, WO: 0, H: 0, NA: 0, projected: 0, late: 0, early: 0, noPunchOut: 0, otMins: 0 };

  for (const date of monthDates(month)) {
    if ((employee.joined && date < employee.joined) || (employee.lastWorkingDay && date > employee.lastWorkingDay)) { a.NA++; continue; }
    const day = new Date(date + "T00:00:00Z").getUTCDay();
    const leave = leaves.find((l) => l.from <= date && l.to >= date);
    const calendar = hol.has(date) ? "H" : settings.weeklyOff.includes(day) ? "WO" : leave ? (leave.type === "LWP" ? "LWP" : "L") : null;
    const rec = records.get(date);

    if (date >= today && !rec?.ov && !rec?.in) {
      if (calendar) a[calendar]++;
      else a.projected++;
      continue;
    }
    if (rec?.ov) { a[rec.ov]++; continue; }
    if (rec?.in) {
      if (toMins(rec.in) > shiftStart + settings.graceMins) a.late++;
      if (!rec.out) {
        a.P++;
        if (date !== today) a.noPunchOut++;
        continue;
      }
      const mins = toMins(rec.out) - toMins(rec.in);
      if (mins < settings.halfDayHours * 60) { a.HD++; continue; }
      a.P++;
      if (toMins(rec.out) < shiftStart + fullDay - settings.graceMins) a.early++;
      if (mins > fullDay) a.otMins += mins - fullDay;
      continue;
    }
    if (calendar) a[calendar]++;
    else a.A++;
  }
  a.payDays = a.P + a.HD / 2 + a.L + a.WO + a.H + a.projected;
  a.otHours = Math.round((a.otMins / 60) * 2) / 2;
  return a;
}

// ---------- income tax ----------

const NEW_SLABS = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]];
const OLD_SLABS = [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]];

const slabTax = (income, slabs) => {
  let tax = 0, lower = 0;
  for (const [upper, rate] of slabs) {
    if (income > lower) tax += (Math.min(income, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
};

// Yearly tax on salary. `pay` holds the yearly salary figures, `decl` the employee's declaration.
export function computeTax(regime, pay, decl = {}) {
  const old = regime === "old";
  const gross = r(pay.salary);
  const hraExempt = old && decl.rentPaid > 0
    ? r(Math.max(0, Math.min(pay.hra, decl.rentPaid - 0.1 * pay.basicDa, (decl.metro ? 0.5 : 0.4) * pay.basicDa)))
    : 0;
  const std = Math.min(old ? 50000 : 75000, Math.max(0, gross - hraExempt));
  const pt = old ? Math.min(2500, r(pay.pt)) : 0;
  const fromSalary = Math.max(0, gross - hraExempt - std - pt);
  const homeLoan = old ? Math.min(200000, r(decl.homeLoanInterest)) : 0;
  const otherIncome = r(decl.otherIncome);
  const grossTotal = Math.max(0, fromSalary + otherIncome - homeLoan);

  const via = old ? {
    sec80C: Math.min(150000, r(decl.sec80C) + r(pay.pf)),
    sec80D: Math.min(100000, r(decl.sec80D)),
    sec80CCD1B: Math.min(50000, r(decl.sec80CCD1B)),
    other: r(decl.otherDeductions)
  } : { sec80C: 0, sec80D: 0, sec80CCD1B: 0, other: 0 };
  const viaTotal = Object.values(via).reduce((a, b) => a + b, 0);
  // taxable income is rounded to the nearest ten rupees
  const taxable = Math.max(0, Math.round((grossTotal - viaTotal) / 10) * 10);

  let tax = slabTax(taxable, old ? OLD_SLABS : NEW_SLABS);
  let rebate = 0;
  if (old && taxable <= 500000) rebate = Math.min(tax, 12500);
  if (!old) {
    if (taxable <= 1200000) rebate = tax;
    // marginal relief: tax can't be more than the income above 12 lakh
    else if (tax > taxable - 1200000) rebate = tax - (taxable - 1200000);
  }
  tax -= rebate;
  const rate = taxable > 50000000 ? (old ? 0.37 : 0.25) : taxable > 20000000 ? 0.25 : taxable > 10000000 ? 0.15 : taxable > 5000000 ? 0.1 : 0;
  const surcharge = tax * rate;
  const cess = (tax + surcharge) * 0.04;
  return {
    regime, gross, hraExempt, std, pt, fromSalary, homeLoan, otherIncome, grossTotal, via, viaTotal, taxable,
    taxBeforeRebate: r(tax + rebate), rebate: r(rebate), surcharge: r(surcharge), cess: r(cess), total: r(tax + surcharge + cess)
  };
}

// Empty running totals for the financial year so far
export const emptyYtd = () => ({ taxable: 0, basicDa: 0, hra: 0, pf: 0, pt: 0, tds: 0 });

// Adds a payslip to the running totals of the year
export const addToYtd = (ytd, slip) => {
  const ded = (k) => (slip.deductions || []).filter((d) => d.key === k).reduce((a, d) => a + d.amount, 0);
  const factor = slip.days ? (slip.days - slip.lopDays) / slip.days : 1;
  ytd.taxable += slip.taxable || 0;
  ytd.basicDa += r(((slip.structure?.basic || 0) + (slip.structure?.da || 0)) * factor);
  ytd.hra += r((slip.structure?.hra || 0) * factor);
  ytd.pf += ded("pf");
  ytd.pt += ded("pt");
  ytd.tds += ded("tds");
  return ytd;
};

// Monthly TDS: tax for the projected year, less TDS already cut, spread over the months left.
// Months still to come are assumed at the full structure.
export function monthlyTds({ month, regime, decl, ytd, current, structure, pfMonthly, ptMonthly }) {
  const left = monthsLeftInFy(month);
  const future = left - 1;
  const year = {
    salary: ytd.taxable + current.taxable + structureTotal(structure) * future + r(decl?.prevIncome),
    basicDa: ytd.basicDa + current.basicDa + (structure.basic + structure.da) * future,
    hra: ytd.hra + current.hra + structure.hra * future,
    pf: ytd.pf + current.pf + pfMonthly * future,
    pt: ytd.pt + current.pt + ptMonthly * future
  };
  const tax = computeTax(regime, year, decl || {});
  const due = Math.max(0, tax.total - ytd.tds - r(decl?.prevTds));
  return { tds: r(due / left), tax, year };
}

// ---------- payslip ----------

// PF, EPS and EDLI on a month's PF wage
export function pfFor(basicDaEarned, pf) {
  const wage = pf.capWages ? Math.min(basicDaEarned, pf.wageCap) : basicDaEarned;
  const epsWage = Math.min(basicDaEarned, pf.wageCap || 15000);
  const ee = r((wage * pf.employee) / 100);
  const er = r((wage * pf.employer) / 100);
  const eps = Math.min(er, r((epsWage * pf.eps) / 100));
  return { wage: r(wage), epsWage: r(epsWage), edliWage: r(epsWage), ee, er, eps, epf: er - eps };
}

/**
 * One employee's payslip for a month.
 * input: employee, structure, month, settings (with payroll), att (monthAttendance),
 *        adjustments [{id,type,amount,note}], loans [{id,kind,emi,outstanding}],
 *        decl (tax declaration or null), ytd (emptyYtd + earlier payslips this year), otOverride
 */
export function calcPayslip({ employee, structure, month, settings, att, adjustments = [], loans = [], decl = null, ytd = emptyYtd(), otOverride = null }) {
  const pay = settings.payroll;
  const days = daysIn(month);
  const grossRate = structureTotal(structure);

  // late marks and early leavings beyond the free limit cost half a day per block
  const marks = att.late + att.early;
  const lateDays = pay.latePerHalfDay > 0 ? Math.floor(Math.max(0, marks - settings.lateLimit) / pay.latePerHalfDay) * 0.5 : 0;
  const unpaidDays = Math.max(0, days - att.payDays);
  const lopDays = Math.min(days, unpaidDays + lateDays);
  const factor = (days - lopDays) / days;
  const lopTotal = r((grossRate * lopDays) / days);
  const lateAmount = Math.min(lopTotal, r((grossRate * lateDays) / days));

  const earnings = STRUCTURE_KEYS.filter((k) => structure[k] > 0).map((k) => ({ key: k, label: STRUCTURE_LABELS[k], amount: structure[k] }));
  const otHours = otOverride ?? (pay.otAuto ? att.otHours : 0);
  const otPay = r((structure.basic / pay.otDivisorDays / pay.shiftHours) * pay.otMultiplier * otHours);
  if (otPay > 0) earnings.push({ key: "ot", label: `Overtime (${otHours} hrs)`, amount: otPay });

  let esiExtra = 0, taxableExtra = 0;
  const otherDeductions = [];
  for (const adj of adjustments) {
    const t = ADJUSTMENT_TYPES[adj.type];
    const label = adj.note ? `${t.label} - ${adj.note}` : t.label;
    if (t.kind === "deduction") { otherDeductions.push({ key: adj.type, label, amount: r(adj.amount), ref: String(adj.id) }); continue; }
    earnings.push({ key: adj.type, label, amount: r(adj.amount), ref: String(adj.id) });
    if (t.esi) esiExtra += r(adj.amount);
    if (t.taxable) taxableExtra += r(adj.amount);
  }
  const grossEarnings = earnings.reduce((a, e) => a + e.amount, 0);
  const baseEarned = grossRate - lopTotal;
  const earnedGross = grossEarnings - lopTotal;

  // statutory
  const pfOn = pay.pf.on && employee.pfOn !== false;
  const pf = pfOn ? pfFor((structure.basic + structure.da) * factor, pay.pf) : { wage: 0, epsWage: 0, edliWage: 0, ee: 0, er: 0, eps: 0, epf: 0 };
  const esiOn = pay.esi.on && employee.esiOn !== false && grossRate > 0 && grossRate <= pay.esi.ceiling;
  const esiWage = esiOn ? baseEarned + otPay + esiExtra : 0;
  const esiEE = esiOn ? Math.ceil((esiWage * pay.esi.employee) / 100) : 0;
  const esiER = esiOn ? Math.ceil((esiWage * pay.esi.employer) / 100) : 0;
  const pt = employee.ptOn !== false && baseEarned > 0 ? r(settings.pt) : 0;

  const taxable = baseEarned + otPay + taxableExtra;
  const current = {
    taxable,
    basicDa: r((structure.basic + structure.da) * factor),
    hra: r(structure.hra * factor),
    pf: pf.ee,
    pt
  };
  const regime = decl?.regime || employee.taxRegime || "new";
  const fullPf = pfOn ? pfFor(structure.basic + structure.da, pay.pf).ee : 0;
  const auto = monthlyTds({ month, regime, decl, ytd, current, structure, pfMonthly: fullPf, ptMonthly: employee.ptOn !== false ? r(settings.pt) : 0 });
  const tds = employee.tds > 0 ? r(employee.tds) : auto.tds;

  const deductions = [];
  const add = (key, label, amount, ref) => amount > 0 && deductions.push({ key, label, amount, ...(ref && { ref }) });
  add("lwp", `Leave without pay / absent (${lopDays - lateDays} days)`, lopTotal - lateAmount);
  add("late", `Late coming / early leaving (${lateDays} days)`, lateAmount);
  add("pf", "Provident fund (PF)", pf.ee);
  add("esi", "ESI", esiEE);
  add("pt", "Professional tax", pt);
  add("tds", "Income tax (TDS)", tds);
  for (const loan of loans) {
    add(loan.kind === "advance" ? "advance" : "loan", loan.kind === "advance" ? "Salary advance recovery" : "Loan EMI", r(Math.min(loan.emi, loan.outstanding)), String(loan.id));
  }
  deductions.push(...otherDeductions);
  const totalDeductions = deductions.reduce((a, d) => a + d.amount, 0);

  return {
    days, payDays: att.payDays, lopDays, lateDays,
    att: { ...att, otHours },
    structure, grossRate,
    earnings, deductions,
    employer: { pf: pf.er, eps: pf.eps, epf: pf.epf, esi: esiER },
    pfWage: pf.wage, epsWage: pf.epsWage, edliWage: pf.edliWage, esiWage,
    taxable, taxableOneTime: taxable - baseEarned,
    grossEarnings, earnedGross, totalDeductions,
    net: grossEarnings - totalDeductions,
    regime,
    otOverride,
    tax: auto.tax
  };
}

// Yearly cost to company for a structure: gross + employer PF + employer ESI, times 12
export function ctcOf(structure, employee, settings) {
  const pay = settings.payroll;
  const gross = structureTotal(structure);
  const pf = pay.pf.on && employee.pfOn !== false ? pfFor(structure.basic + structure.da, pay.pf).er : 0;
  const esi = pay.esi.on && employee.esiOn !== false && gross > 0 && gross <= pay.esi.ceiling ? Math.ceil((gross * pay.esi.employer) / 100) : 0;
  return { monthly: gross + pf + esi, yearly: (gross + pf + esi) * 12, employerPf: pf, employerEsi: esi };
}

// ---------- full & final ----------

// Completed years of service: a part year of six months or more counts as a full year
export function serviceYears(joined, lastDay) {
  if (!joined || !lastDay || lastDay < joined) return { years: 0, months: 0, counted: 0 };
  const [y1, m1, d1] = joined.split("-").map(Number);
  const [y2, m2, d2] = lastDay.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const years = Math.floor(months / 12);
  months -= years * 12;
  return { years, months, counted: years + (months >= 6 ? 1 : 0) };
}

// Payment of Gratuity Act: 15 days' basic + DA per year of service, after 5 years, up to Rs 20 lakh
export function gratuityFor(structure, joined, lastDay) {
  const svc = serviceYears(joined, lastDay);
  const eligible = svc.years >= 5;
  const amount = eligible ? Math.min(2000000, r(((structure.basic + structure.da) * 15 * svc.counted) / 26)) : 0;
  return { ...svc, eligible, amount };
}

export const daysBetween = (from, to) => Math.round((new Date(to + "T00:00:00Z") - new Date(from + "T00:00:00Z")) / 86400000);
