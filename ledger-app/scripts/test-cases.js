// Checks the Study center case studies and client emails. Run with: node scripts/test-cases.js
//  1. Every written calculation like "$24,000.00 × 6% ÷ 12 = $120.00" in views-cases.js is recomputed.
//  2. Each case is built, balances, grades 0 before any work, and grades 100 after the
//     answer key is applied the way a student would (splits, recategorizing, journal
//     entries, deleting a duplicate, marking 1099 vendors, entering a bill).
//  3. Email practice: model emails pass every automatic check; an empty-ish draft doesn't.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '../src/renderer');
const C = require('../src/renderer/plus.js');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
console.log('Study center checks');

const SRC = fs.readFileSync(path.join(R, 'views-cases.js'), 'utf8');

t('every written calculation adds up', () => {
  const src = SRC.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\\'/g, "'");
  const num = String.raw`\$?\d[\d,]*(?:\.\d+)?%?`;
  const expr = new RegExp(String.raw`((?:\(\s*)?${num}(?:\s*\)?\s*[×x÷+−\-*/]\s*\(?\s*${num}\s*\)?)+)\s*[=≈]\s*(\$?\d[\d,]*(?:\.\d+)?%?)`, 'g');
  const val = s => { s = s.replace(/[$,]/g, ''); return s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s); };
  let checked = 0; const bad = [];
  for (const m of src.matchAll(expr)) {
    let lhs = m[1]; const rhs = m[2];
    if (!/[×÷+−*/]/.test(lhs)) continue;
    // prose like "(3 × $118 = $354 for…)" opens a bracket the match doesn't close
    if ((lhs.match(/\(/g) || []).length > (lhs.match(/\)/g) || []).length) lhs = lhs.replace(/^\(\s*/, '');
    const js = lhs.replace(/\$?\d[\d,]*(?:\.\d+)?%?/g, x => String(val(x))).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\bx\b/g, '*');
    let got; try { got = Function('return (' + js + ')')(); } catch (e) { continue; }
    const want = val(rhs);
    const tol = /\./.test(rhs) ? 0.006 : rhs.endsWith('%') ? 0.006 : 0.51;
    checked++;
    if (!(Math.abs(got - want) <= tol)) bad.push(`"${m[0]}" → ${got}`);
  }
  assert(checked >= 30, 'only found ' + checked + ' calculations');
  assert.deepStrictEqual(bad, []);
  console.log(`    (${checked} calculations recomputed)`);
});

// Load the module with a stubbed App, the same way test-academy.js loads views-advanced.js
const noop = () => {};
const acts = {};
global.App = { S: { data: { clients: [], training: {}, firm: { owner: 'Avery Lane', name: 'Lane Bookkeeping' } }, ui: {}, route: { page: 'lab' } }, C, U: { $: () => null, $$: () => [], esc: s => String(s), money: v => '$' + (+v).toFixed(2), fmtDate: s => s, fmtMonth: s => s.slice(0, 7), ICON: {}, plural: noop, toast: noop, copyText: noop }, client: noop, act: o => Object.assign(acts, o), go: noop, render: noop, commit: noop, save: noop, switchClient: noop, today: () => '2026-10-28' };
Function(SRC)();
const LC = global.App.labCases;

t('API is complete', () => {
  for (const k of ['CASES', 'EMAILS', 'renderCases', 'renderEmails', 'coachText', 'grade', 'build']) assert(LC[k], 'missing ' + k);
  assert.strictEqual(LC.CASES.length, 4); assert.strictEqual(LC.EMAILS.length, 5);
  for (const k of ['lc-start', 'lc-open', 'lc-reset', 'lc-grade', 'lc-back', 'lc-email-open', 'lc-email-check', 'lc-email-tick', 'lc-email-back', 'lc-email-copy']) assert(acts[k], 'missing action ' + k);
});

// helpers to apply fixes like a student
const kit = c => {
  const A = nm => { const a = C.acctByName(c, nm); assert(a, 'no account ' + nm); return a.id; };
  const tx = id => { const x = c.transactions.find(t => t.id === id); assert(x, 'no transaction ' + id); return x; };
  const cat = (id, nm) => { const x = tx(id); x.status = 'posted'; x.categoryId = A(nm); };
  const split = (id, parts) => { const x = tx(id); x.status = 'posted'; x.splits = parts.map(([nm, amt]) => ({ categoryId: A(nm), amount: amt })); const s = C.round2(parts.reduce((a, p) => a + p[1], 0)); assert(Math.abs(s - x.amount) < 0.005, 'split does not add up for ' + x.description); };
  const je = (date, lines) => c.journals.push({ id: C.uid(), date, number: 'T', memo: '', lines: lines.map(([nm, dr, cr]) => ({ accountId: A(nm), debit: dr || 0, credit: cr || 0 })) });
  return { A, tx, cat, split, je };
};
const balanced = c => Math.abs(C.balanceSheet(c, c.caseKey.period.to).check) < 0.01;

const FIX = {
  catchup(c) {
    const k = c.caseKey, { cat, split, A } = kit(c);
    cat(k.ins, 'Insurance'); cat(k.vz1, 'Phone & Internet'); cat(k.vz2, 'Phone & Internet');
    cat(k.nurs, 'Cost of Goods Sold'); cat(k.gas, 'Car & Truck'); cat(k.contrib, "Owner's Contributions");
    c.transactions = c.transactions.filter(t => t.id !== k.dup);
    cat(k.tv, "Owner's Draw");
    assert.deepStrictEqual(k.interest, [120, 115.6, 111.18]);
    k.interest.forEach((it, i) => split(k['loan' + i], [['Loans Payable', -(1000 - it)], ['Interest Expense', -it]]));
    const hoa = c.transactions.find(t => t.id === k.hoa); hoa.categoryId = A('Accounts Receivable'); hoa.invoiceId = k.inv;
    assert.strictEqual(C.invoiceState(c, c.invoices[0]).status, 'paid');
  },
  cafe(c) {
    const k = c.caseKey, { cat, split, je } = kit(c);
    const W = [[5000, 400, 620], [4500, 360, 540], [5250, 420, 655], [4750, 380, 585]];
    W.forEach(([s, tx, tip], i) => split(k['dep' + (i + 1)], [['Sales', s], ['Sales Tax Payable', tx], ['Tips Payable', tip]]));
    cat(k.stax, 'Sales Tax Payable');
    split(k.pay1, [['Payroll & Wages', -3000], ['Tips Payable', -1160], ['Payroll Taxes', -318.24]]);
    split(k.pay2, [['Payroll & Wages', -3000], ['Tips Payable', -1240], ['Payroll Taxes', -324.36]]);
    cat(k.fee1, 'Bank & Merchant Fees'); cat(k.fee2, 'Bank & Merchant Fees');
  },
  contractor(c) {
    const k = c.caseKey, { cat, je } = kit(c);
    for (const nm of k.vendors.yes) c.contacts.find(v => v.name === nm).is1099 = true;
    cat(k.diego, 'Contract Labor');
    cat(k.truck, 'Equipment & Vehicles');
    je(k.period.to, [['Depreciation Expense', 400], ['Accumulated Depreciation', 0, 400]]);
    // the app's own 1099 report agrees with the answer key
    const rep = C.contractorPayments(c, k.year);
    assert.deepStrictEqual(rep.filter(r => r.needs).map(r => r.v.name).sort(), [...k.vendors.yes].sort());
  },
  scorp(c) {
    const k = c.caseKey, { cat, split, A } = kit(c);
    cat(k.net, 'Payroll & Wages');
    split(k.tax, [['Payroll & Wages', -1192.5], ['Payroll Taxes', -382.5]]);
    cat(k.ski, 'Shareholder Distributions');
    const v = c.contacts.find(x => x.name === 'Wren & Ash CPAs');
    c.bills.push({ id: C.uid(), vendorId: v.id, ref: '2291', date: k.period.to, dueDate: C.addDays(k.period.to, 30), status: 'open', memo: '', lines: [{ id: C.uid(), desc: 'Payroll setup', accountId: A('Legal & Professional Fees'), amount: 1200 }] });
  }
};

for (const d of LC.CASES) {
  t(`Case ${d.n} "${d.title}" grades 0 before work and 100 after the answer key`, () => {
    const c = LC.build(d.id);
    assert.strictEqual(c.caseStudy, d.id); assert(c.practice);
    assert(balanced(c), 'opening books do not balance');
    let r = LC.grade(c);
    assert.strictEqual(r.total, 100, 'points must total 100');
    assert.strictEqual(r.items.length, d.count, 'check count');
    assert(r.items.length >= 4 && r.items.length <= 7);
    assert.strictEqual(r.score, 0, 'should be 0 before work: ' + r.items.filter(x => x.ok).map(x => x.label).join('; '));
    for (const x of r.items) assert(x.why && x.why.length > 60, 'missing explanation: ' + x.label);
    FIX[d.id](c);
    r = LC.grade(c);
    assert.strictEqual(r.score, 100, 'missed: ' + r.items.filter(x => !x.ok).map(x => x.label + ' — ' + x.why).join('\n'));
    assert(r.passed);
    assert(balanced(c), 'books stopped balancing');
    assert(typeof LC.coachText(c) === 'string' && LC.coachText(c).length > 20);
  });
}

t('an alternative method (one journal entry) also earns full credit', () => {
  const c = LC.build('cafe'), k = c.caseKey, { cat, split, je } = kit(c);
  je(k.period.to, [['Sales', 3960], ['Sales Tax Payable', 0, 1560], ['Tips Payable', 0, 2400]]);
  cat(k.stax, 'Sales Tax Payable');
  split(k.pay1, [['Payroll & Wages', -3000], ['Tips Payable', -1160], ['Payroll Taxes', -318.24]]);
  split(k.pay2, [['Payroll & Wages', -3000], ['Tips Payable', -1240], ['Payroll Taxes', -324.36]]);
  cat(k.fee1, 'Bank & Merchant Fees'); cat(k.fee2, 'Bank & Merchant Fees');
  assert.strictEqual(LC.grade(c).score, 100);
  // and an accrual entry in place of a bill for the S-corp case
  const s = LC.build('scorp'), q = s.caseKey, K2 = kit(s);
  K2.cat(q.net, 'Payroll & Wages'); K2.split(q.tax, [['Payroll & Wages', -1192.5], ['Payroll Taxes', -382.5]]); K2.cat(q.ski, "Owner's Draw");
  K2.je(q.period.to, [['Legal & Professional Fees', 1200], ['Accrued Liabilities', 0, 1200]]);
  assert.strictEqual(LC.grade(s).score, 100);
});

t('a partly finished case earns partial credit only', () => {
  const c = LC.build('contractor'), k = c.caseKey, { cat } = kit(c);
  cat(k.truck, 'Equipment & Vehicles');
  assert.strictEqual(LC.grade(c).score, 25);
  c.contacts.find(v => v.name === 'Sam Whitaker').is1099 = true;
  for (const nm of k.vendors.yes) c.contacts.find(v => v.name === nm).is1099 = true;
  assert.strictEqual(LC.grade(c).score, 25, 'marking an under-threshold vendor must not pass');
});

t('grading through the action stores the best score', () => {
  const S = global.App.S;
  S.data.clients = [LC.build('catchup')];
  acts['lc-grade']({ dataset: { id: 'catchup' } });
  assert.deepStrictEqual(S.data.training.lab.cases.catchup, { score: 0, passed: false, date: '2026-10-28' });
  FIX.catchup(S.data.clients[0]);
  acts['lc-grade']({ dataset: { id: 'catchup' } });
  assert.strictEqual(S.data.training.lab.cases.catchup.score, 100);
  assert.strictEqual(S.ui.lab.open, 'catchup');
  assert(LC.renderCases().includes('Case solved'));
  S.ui.lab.open = null;
  assert(LC.renderCases().includes('Passed'));
});

t('emails: model emails pass every automatic check; a weak draft does not', () => {
  const S = global.App.S;
  for (const e of LC.EMAILS) {
    assert(e.items.length >= 5 && e.items.length <= 7, e.id + ' needs 5–7 checklist points');
    const model = e.model('Avery Lane\nLane Bookkeeping');
    for (const [label, auto] of e.items) if (auto) assert(LC.AUTO[auto](model), `${e.id}: model fails "${label}" (${auto})`);
    const weak = LC.checkEmail(e.id, 'send me the stuff, you forgot it again??');
    assert(!weak.done);
    const r = LC.checkEmail(e.id, model);
    const manual = e.items.map((x, i) => (x[1] ? null : i)).filter(i => i != null);
    assert(!r.done || !manual.length);
    for (const i of manual) acts['lc-email-tick']({ dataset: { id: e.id, i: String(i) } });
    assert(S.data.training.lab.emails[e.id].done, e.id + ' should be done once every point is ticked');
    S.ui.lab.email = e.id; assert(LC.renderEmails().includes('Copy model email'));
  }
  S.ui.lab.email = null; assert(LC.renderEmails().includes('5 of 5 done'));
  assert(LC.AUTO.noblame('Hi Dana, could you send these receipts by Friday? Thank you!') && !LC.AUTO.noblame('Hi Dana, you forgot the receipts again, which is your fault.'));
});

console.log(`All ${n} Study center checks passed.`);
