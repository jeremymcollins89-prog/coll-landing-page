// Advanced practical exam: accrual month-end close for Aspen Trail Outfitters.
// Same structure, documents, checks and points as build()/grade() in
// ledger-app/src/renderer/views-advanced.js, graded on month-end balances so
// any correct method earns credit — but the source-document numbers are seeded
// per student. `params(null)` gives the app's original numbers.
import C from '../engine.js';
import { dollars, fmtMoney, pad2 } from '../util.js';

const ORIGINAL = {
  checking: 4200000, salesTaxOpen: 64000,
  sales: [624050, 588025, 641500, 610275], deposit: 200000, summit: 480000, rent: 320000, xcel: 41036, payroll: 310000,
  cost: 3600000, salvage: 720000, years: 10,                     // fixed assets → $240 a month
  book: 1920000, count: [720000, 535000, 390000, 200000],         // inventory: books vs. the count ($18,450)
  loan: 2880000, rateBp: 750, payment: 110000,                    // $180 interest, $920 principal
  premium: 360000, policyMonths: 12,                              // $300 a month
  hours: 50, hourly: 2500,                                        // $1,250 accrued wages
  days: { sales: [4, 11, 18, 25], deposit: 9, summit: 6, rent: 1, xcel: 14, payroll: [15, 30], loan: 20, tax: 20 }
};

const sum = a => a.reduce((s, x) => s + x, 0);

// All money in whole cents. R is the seeded generator from util.seededRandom.
export function params(R) {
  if (!R) return JSON.parse(JSON.stringify(ORIGINAL));
  const j = (n, lo = 1, hi = 28) => Math.max(lo, Math.min(hi, n + R.int(-2, 2)));
  // Fixed assets: pick a whole-dollar monthly depreciation, then the cost that produces it exactly
  const years = R.pick([5, 7, 10]), monthly = R.step(150, 400, 5) * 100, salvage = R.step(240000, 960000, 60000);
  const cost = salvage + monthly * years * 12;
  // Inventory: the count is below the books by a shrinkage amount; split the count into four lines
  const book = R.step(1500000, 2600000, 5000), count = book - R.step(30000, 120000, 500);
  const part = (lo, hi) => Math.round(count * R.int(lo, hi) / 100 / 5000) * 5000;
  const jackets = part(35, 40), boots = part(25, 30), packs = part(18, 22);
  // Loan: balance × rate ÷ 12 must come out to whole cents
  let loan = ORIGINAL.loan / 100, rateBp = ORIGINAL.rateBp;
  for (let i = 0; i < 400; i++) {
    const L = R.step(18000, 40000, 100), bp = R.pick([600, 650, 700, 750, 800, 850, 900]);
    if ((L * bp) % 1200 === 0) { loan = L; rateBp = bp; break; }
  }
  const policyMonths = R.pick([6, 12]);
  return {
    checking: R.step(3000000, 5500000, 100000), salesTaxOpen: R.int(40000, 95000),
    sales: Array.from({ length: 4 }, () => R.int(520000, 700000)), deposit: R.step(100000, 300000, 5000),
    summit: R.step(350000, 600000, 5000), rent: R.step(280000, 380000, 10000), xcel: R.int(30000, 52000), payroll: R.step(280000, 380000, 2500),
    cost, salvage, years, book, count: [jackets, boots, packs, count - jackets - boots - packs],
    loan: loan * 100, rateBp, payment: R.step(90000, 160000, 5000),
    premium: R.step(15000, 45000, 500) * policyMonths, policyMonths,
    hours: R.int(24, 60), hourly: R.step(1800, 3200, 50),
    days: { sales: [j(4), j(11), j(18), j(25)], deposit: j(9), summit: j(6), rent: 1, xcel: j(14), payroll: [15, 28], loan: j(20), tax: j(20) }
  };
}

// The worked answers, in cents, from the source documents.
function answers(P) {
  const depr = (P.cost - P.salvage) / (P.years * 12);
  const interest = P.loan * P.rateBp / 120000;     // balance × rate ÷ 12
  const count = sum(P.count), shrink = P.book - count;
  const insurance = P.premium / P.policyMonths, wages = P.hours * P.hourly;
  return { depr, interest, principal: P.payment - interest, count, shrink, insurance, wages };
}

export function build(month, P) {
  const M = { from: month.from, to: month.to };
  const day = n => `${M.from.slice(0, 8)}${pad2(Math.min(n, +M.to.slice(8)))}`;
  const W = answers(P), D = P.days;
  const c = C.newClient({ name: 'Aspen Trail Outfitters', legalName: 'Aspen Trail Outfitters LLC', industry: 'Outdoor gear store · advanced practical', color: '#2D5A88', startDate: M.from, invoicePrefix: 'AT-', email: 'hello@aspentrail.example', phone: '(970) 555-0172', address: '401 Main St\nFrisco, CO 80443' });
  c.practice = true; c.advExam = true; c.checklistDismissed = true; c.entity = 'llc1';
  const A = n => (C.acctByName(c, n) || {}).id;
  const ens = (name, type, sub) => C.acctByName(c, name) || C.ensureAccount(c, { name, type, sub });
  ens('Inventory', 'asset', 'current'); ens('Unearned Revenue', 'liability', 'current');
  const open = { 'Business Checking': P.checking, 'Inventory': P.book, 'Equipment & Vehicles': P.cost, 'Prepaid Expenses': P.premium, 'Loans Payable': P.loan, 'Sales Tax Payable': P.salesTaxOpen };
  for (const [n, v] of Object.entries(open)) C.acctByName(c, n).opening = dollars(v);
  const K = {};
  const add = (key, d, desc, cents, cat, payee) => { const t = { id: C.uid(), date: day(d), description: desc, payee: payee || C.cleanPayee(desc), amount: dollars(cents), accountId: A('Business Checking'), categoryId: A(cat), memo: '', status: 'posted', cleared: false, reconciled: false }; c.transactions.push(t); if (key) K[key] = t.id; };
  P.sales.forEach((v, i) => add(null, D.sales[i], 'DEPOSIT - STORE SALES', v, 'Sales', 'Store sales'));
  add('deposit', D.deposit, 'SPECIAL ORDER DEPOSIT - K MARTIN', P.deposit, 'Sales', 'K. Martin (special order)');
  add(null, D.summit, 'SUMMIT GEAR DISTRIBUTORS', -P.summit, 'Cost of Goods Sold', 'Summit Gear Distributors');
  add(null, D.rent, 'MAIN ST PROPERTIES RENT', -P.rent, 'Rent & Lease', 'Main St Properties');
  add(null, D.xcel, 'XCEL ENERGY ONLINE PMT', -P.xcel, 'Utilities', 'Xcel Energy');
  add(null, D.payroll[0], 'GUSTO PAYROLL PPD', -P.payroll, 'Payroll & Wages', 'Gusto Payroll');
  add(null, D.payroll[1], 'GUSTO PAYROLL PPD', -P.payroll, 'Payroll & Wages', 'Gusto Payroll');
  add('loan', D.loan, 'FIRSTBANK LOAN PAYMENT', -P.payment, 'Loans Payable', 'FirstBank');
  add('tax', D.tax, 'COLORADO DEPT OF REVENUE', -P.salesTaxOpen, 'Taxes & Licenses', 'Colorado Dept of Revenue');
  c.transactions.sort((a, b) => a.date.localeCompare(b.date));
  // The app's UI reads advKey.month; the expected balances stay on the server.
  c.advKey = { ...K, month: M };
  const expect = {
    'Depreciation Expense': W.depr, 'Accumulated Depreciation': -W.depr, 'Inventory': W.count, 'Cost of Goods Sold': P.summit + W.shrink,
    'Interest Expense': W.interest, 'Loans Payable': P.loan - W.principal, 'Insurance': W.insurance, 'Prepaid Expenses': P.premium - W.insurance,
    'Accrued Liabilities': W.wages, 'Payroll & Wages': 2 * P.payroll + W.wages, 'Unearned Revenue': P.deposit, 'Sales': sum(P.sales),
    'Sales Tax Payable': 0, 'Taxes & Licenses': 0
  };
  for (const k of Object.keys(expect)) expect[k] = dollars(expect[k]);
  const key = {
    exam: 'adv', ids: K, month: { ...M, label: month.label }, expect,
    docs: { cost: dollars(P.cost), salvage: dollars(P.salvage), years: P.years, book: dollars(P.book), count: P.count.map(dollars), loan: dollars(P.loan), rateBp: P.rateBp, payment: dollars(P.payment),
      premium: dollars(P.premium), policyMonths: P.policyMonths, hours: P.hours, hourly: dollars(P.hourly), deposit: dollars(P.deposit), salesTax: dollars(P.salesTaxOpen) },
    work: Object.fromEntries(Object.entries(W).map(([k, v]) => [k, dollars(v)]))
  };
  return { client: c, key };
}

// Money as the app writes it in these documents: no cents when it's whole dollars.
const m = v => fmtMoney(v).replace(/\.00$/, '');
const pct = bp => `${bp / 100}%`;

export function brief(key) {
  const d = key.docs, M = key.month, cnt = d.count, total = cnt.reduce((s, x) => s + x, 0);
  const months = d.policyMonths === 12 ? '12-month' : `${d.policyMonths}-month`;
  return {
    client: 'Aspen Trail Outfitters', month: { from: M.from, to: M.to, label: M.label },
    intro: 'A retail client on monthly accrual reporting. Use the source documents below to post the adjusting entries, fix two miscoded transactions and split the loan payment, then close the month. Grading looks at the month-end balances, so any correct method earns full credit — journal entries, splits or recategorizing.',
    documents: [
      { title: '1 · Fixed-asset schedule', text: `Store fixtures and equipment placed in service on the first day of this month: cost ${m(d.cost)}, salvage value ${m(d.salvage)}, ${d.years}-year straight-line. Book this month's depreciation.` },
      { title: '2 · Inventory count, last day of the month', text: `Jackets ${m(cnt[0])} · Boots ${m(cnt[1])} · Packs ${m(cnt[2])} · Accessories ${m(cnt[3])} · Total ${m(total)}. Purchases go to Cost of Goods Sold; the books still show the opening inventory of ${m(d.book)}.` },
      { title: '3 · FirstBank loan statement', text: `Payment ${m(d.payment)}. Balance before the payment ${m(d.loan)}, at ${pct(d.rateBp)} annual interest. Work out how much of the payment is interest and how much is principal.` },
      { title: '4 · Insurance policy', text: `${months} policy, ${m(d.premium)}, paid before this month and recorded in Prepaid Expenses. Coverage started the first day of this month.` },
      { title: '5 · Timesheets', text: `Wages earned in the last days of the month, paid next payday: ${d.hours} hours at ${m(d.hourly)} an hour.` },
      { title: '6 · Special order', text: `K. Martin paid a ${m(d.deposit)} deposit on a custom tent that ships next month. It was recorded as Sales.` },
      { title: '7 · Colorado sales tax return', text: `The ${m(d.salesTax)} payment to the Colorado Department of Revenue paid last month's collected sales tax. It was recorded as Taxes & Licenses.` }
    ],
    tasks: [
      'Post the adjusting entries the documents call for, dated the last day of the month.',
      'Fix the two miscoded transactions and split the loan payment into principal and interest.',
      `Close ${M.label}.`
    ],
    grading: 'Graded on 8 checks worth 100 points; closing the month is one of them and is required to pass. Pass with 80 points or more. A perfect 100, plus 92% or better on the written exam, earns distinction.'
  };
}

// Same checks and points as grade() in views-advanced.js, against the stored key.
export function grade(c, key) {
  const M = key.month, E = key.expect, d = key.docs, w = key.work;
  const bal = C.balances(c, { to: M.to });
  const v = n => { const a = C.acctByName(c, n); return a ? C.round2(bal.get(a.id) || 0) : null; };
  const is = n => { const got = v(n); return got != null && Math.abs(got - E[n]) < 0.005; };
  const show = n => `${n} ${fmtMoney(v(n) || 0)} (expected ${fmtMoney(E[n])})`;
  const items = [
    [`Depreciation for the month (${m(w.depr)})`, 12, is('Depreciation Expense') && is('Accumulated Depreciation'), `Straight-line depreciation is (cost − salvage) ÷ months of life: (${m(d.cost)} − ${m(d.salvage)}) ÷ ${d.years * 12} = ${m(w.depr)}. Post a journal entry dated the last day of the month: debit Depreciation Expense ${m(w.depr)}, credit Accumulated Depreciation ${m(w.depr)}. Now: ${show('Depreciation Expense')}.`],
    [`Inventory adjusted to the count (${m(w.count)})`, 14, is('Inventory') && is('Cost of Goods Sold'), `The physical count wins. The books show ${m(d.book)} and the count is ${m(w.count)}: ${m(d.book)} − ${m(w.count)} = ${m(w.shrink)}. Post a journal entry dated the last day of the month: debit Cost of Goods Sold ${m(w.shrink)}, credit Inventory ${m(w.shrink)}. Now: ${show('Inventory')}.`],
    [`Loan payment split (${m(w.principal)} principal, ${m(w.interest)} interest)`, 12, is('Interest Expense') && is('Loans Payable'), `Only principal reduces the loan. Interest = ${m(d.loan)} × ${pct(d.rateBp)} ÷ 12 = ${m(w.interest)}; principal = ${m(d.payment)} − ${m(w.interest)} = ${m(w.principal)}. Split the ${m(d.payment)} FirstBank payment: ${m(w.principal)} to Loans Payable and ${m(w.interest)} to Interest Expense. Now: ${show('Loans Payable')}.`],
    [`Prepaid insurance used (${m(w.insurance)})`, 12, is('Insurance') && is('Prepaid Expenses'), `A prepaid cost is expensed over the months it covers: ${m(d.premium)} ÷ ${d.policyMonths} = ${m(w.insurance)}. Post a journal entry dated the last day of the month: debit Insurance ${m(w.insurance)}, credit Prepaid Expenses ${m(w.insurance)}. Now: ${show('Prepaid Expenses')}.`],
    [`Wages accrued at month end (${m(w.wages)})`, 12, is('Accrued Liabilities') && is('Payroll & Wages'), `Wages belong to the month the work was done: ${d.hours} × ${m(d.hourly)} = ${m(w.wages)}. Post a journal entry dated the last day of the month: debit Payroll & Wages ${m(w.wages)}, credit Accrued Liabilities ${m(w.wages)}, set to reverse on the first day of next month. Now: ${show('Accrued Liabilities')}.`],
    [`Special-order deposit deferred (${m(d.deposit)})`, 14, is('Unearned Revenue') && is('Sales'), `Money received before the goods ship is owed, not earned. Post a journal entry dated the last day of the month: debit Sales ${m(d.deposit)}, credit Unearned Revenue ${m(d.deposit)}. Now: ${show('Unearned Revenue')}.`],
    ['Sales tax payment cleared the liability', 12, is('Sales Tax Payable') && is('Taxes & Licenses'), `Paying collected sales tax clears a liability; it isn't an expense. Recategorize the ${m(d.salesTax)} Colorado Dept of Revenue payment from Taxes & Licenses to Sales Tax Payable. Now: ${show('Sales Tax Payable')}.`]
  ].map(([label, pts, ok, why]) => ({ label, pts, ok, why, got: ok ? pts : 0 }));
  const closed = !!c.lockDate && c.lockDate >= M.to;
  items.push({ label: `${M.label} closed`, pts: 12, ok: closed, got: closed ? 12 : 0, why: 'Close the month once the entries are in. Closing is required to pass.' });
  const score = items.reduce((s, x) => s + x.got, 0);
  return { items, closed, score, passed: score >= 80 && closed, required: [{ label: `${M.label} closed`, ok: closed }] };
}
