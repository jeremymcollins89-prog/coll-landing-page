// Professional practical exam: month-end for Juniper Flower Co.
// Same structure, planted problems, checks and points as buildExam()/grade()
// in ledger-app/src/renderer/views-exam.js — but every amount (and most dates)
// comes from a seeded generator, so each student gets their own numbers.
// `params(null)` gives the app's original numbers, which the tests use to
// prove the server grades exactly like the app.
import C from '../engine.js';
import { dollars, fmtMoney, fmtDateLong, pad2 } from '../util.js';

const ORIGINAL = {
  checking: 800000, savings: 500000, salesTaxOpen: 31840, cardOpen: 35021,
  sales: [148025, 132240, 161075, 139510, 154460], salesStart: 2,
  rent: 210000, florPosted: 68840, wages: 295000, ptax: 23240, xcel: 16422,
  checkTrue: 18250, checkRecorded: 12850, checkNo: 1187, canva: 1499, fb: 12000,
  sav: 200000, draw: 120000, card: 48520, teatroRate: 16000, flor: 74218, goog: 1440, ins: 21200, dep: 85000, gas: 4812,
  depr: 17500,
  days: { rent: 1, florPosted: 5, payroll: 15, xcel: 11, check: 13, canva: 8, fb: 19, sav: 26, draw: 25, card: 27, tax: 20, teatro: 24, flor: 19, goog: 7, ins: 10, dep: 21, gas: 17, invoice: 3 }
};

// All money in whole cents. R is the seeded generator from util.seededRandom.
export function params(R) {
  if (!R) return JSON.parse(JSON.stringify(ORIGINAL));
  const j = (n, lo = 1, hi = 28) => Math.max(lo, Math.min(hi, n + R.int(-2, 2))); // nudge a day by up to 2
  const wages = R.step(260000, 340000, 2500);
  // A transposition: the true check amount with its tens and ones digits swapped
  const h = R.int(1, 2), a = R.int(2, 9), b = R.int(0, a - 1), cc = R.step(0, 95, 5);
  const salesTaxOpen = R.int(24000, 46000);
  const teatroRate = R.step(14000, 21000, 500);
  let dep = R.int(60000, 110000);
  if (dep === 4 * teatroRate) dep += 137; // grading spots a double-counted Teatro payment by its amount, so keep it unique
  return {
    checking: R.step(600000, 1000000, 50000), savings: R.step(300000, 800000, 50000), salesTaxOpen, cardOpen: R.int(25000, 52000),
    sales: Array.from({ length: 5 }, () => R.int(120000, 185000)), salesStart: R.int(1, 3),
    rent: R.step(180000, 260000, 5000), florPosted: R.int(55000, 82000),
    wages, ptax: Math.round(wages * R.int(765, 850) / 10000), xcel: R.int(12000, 22000),
    checkTrue: (100 * h + 10 * a + b) * 100 + cc, checkRecorded: (100 * h + 10 * b + a) * 100 + cc, checkNo: R.int(1100, 1299),
    canva: R.pick([1199, 1499, 1999]), fb: R.step(8000, 20000, 500),
    sav: R.step(150000, 300000, 25000), draw: R.step(80000, 180000, 5000), card: R.int(30000, 65000),
    teatroRate, flor: R.int(60000, 85000), goog: R.pick([720, 1440, 2160]), ins: R.int(18000, 26000), dep, gas: R.int(3500, 7500),
    depr: R.step(12500, 25000, 500),
    days: { rent: 1, florPosted: j(5), payroll: j(15), xcel: j(11), check: j(13), canva: j(8), fb: j(19), sav: j(26, 22), draw: j(25, 22), card: j(27, 22), tax: j(20), teatro: j(24, 20), flor: j(19), goog: j(7), ins: j(10), dep: j(21), gas: j(17), invoice: R.int(2, 5) }
  };
}

// Builds the client (as the app would) plus the server-only answer key.
export function build(month, P) {
  const M = { from: month.from, to: month.to };
  const day = n => `${M.from.slice(0, 8)}${pad2(Math.min(n, +M.to.slice(8)))}`;
  const D = P.days;
  const c = C.newClient({ name: 'Juniper Flower Co.', legalName: 'Juniper Flower Co. LLC', industry: 'Florist · practical exam', color: '#8A4F7D', startDate: M.from, invoicePrefix: 'J-', nextInvoice: 202, email: 'hello@juniperflowers.example', phone: '(720) 555-0144', address: '17 Bloom St\nDenver, CO 80206' });
  c.practice = true; c.exam = true; c.checklistDismissed = true;
  const A = n => C.acctByName(c, n).id;
  C.acctByName(c, 'Business Checking').opening = dollars(P.checking);
  C.acctByName(c, 'Business Savings').opening = dollars(P.savings);
  // last month's sales tax and card statement, paid off this month
  C.acctByName(c, 'Sales Tax Payable').opening = dollars(P.salesTaxOpen);
  C.acctByName(c, 'Business Credit Card').opening = dollars(P.cardOpen);
  const K = {};
  const add = (key, date, description, cents, cat, opt = {}) => {
    const t = { id: C.uid(), date, description, payee: opt.payee || C.cleanPayee(description), amount: dollars(cents), accountId: A(opt.account || 'Business Checking'), categoryId: cat ? A(cat) : '', memo: '', status: opt.review ? 'review' : 'posted', cleared: false, reconciled: false };
    if (opt.review) { t.categoryId = ''; t.importId = 'exam'; }
    c.transactions.push(t); if (key) K[key] = t.id; return t;
  };
  // Already categorized activity
  P.sales.forEach((v, i) => add(null, day(P.salesStart + 7 * i), 'DEPOSIT - COUNTER SALES', v, 'Sales', { payee: 'Counter sales' }));
  add(null, day(D.rent), 'BLOOM ST PROPERTIES RENT', -P.rent, 'Rent & Lease', { payee: 'Bloom St Properties' });
  add(null, day(D.florPosted), 'DENVER WHOLESALE FLORIST', -P.florPosted, 'Cost of Goods Sold', { payee: 'Denver Wholesale Florist' });
  add('payroll', day(D.payroll), 'GUSTO PAYROLL PPD', -(P.wages + P.ptax), 'Payroll & Wages', { payee: 'Gusto Payroll' }); // to split: wages + employer taxes
  add('xcel1', day(D.xcel), 'XCEL ENERGY ONLINE PMT', -P.xcel, 'Utilities', { payee: 'Xcel Energy' });
  add('xcel2', day(D.xcel), 'XCEL ENERGY ONLINE PMT', -P.xcel, 'Utilities', { payee: 'Xcel Energy' }); // planted duplicate
  add('check', day(D.check), `CHECK #${P.checkNo} GARDEN GATE SUPPLY`, -P.checkRecorded, 'Cost of Goods Sold', { payee: 'Garden Gate Supply' }); // planted transposition
  add(null, day(D.canva), 'CANVA PRO', -P.canva, 'Software & Subscriptions', { account: 'Business Credit Card', payee: 'Canva' });
  add(null, day(D.fb), 'FACEBK *ADS', -P.fb, 'Advertising & Marketing', { account: 'Business Credit Card', payee: 'Facebook Ads' });
  // Waiting in To Review
  add('sav', day(D.sav), 'ONLINE TRANSFER TO SAV ...7731', -P.sav, null, { review: true, payee: 'Transfer to savings' });
  add('draw', day(D.draw), 'ONLINE TRANSFER TO OWNER PERSONAL', -P.draw, null, { review: true, payee: 'Transfer to owner' });
  add('card', day(D.card), 'CHASE CARD AUTOPAY', -P.card, null, { review: true, payee: 'Chase card autopay' });
  add('tax', day(D.tax), 'COLORADO DEPT REVENUE SALES TAX', -P.salesTaxOpen, null, { review: true, payee: 'Colorado Dept of Revenue' });
  add('teatro', day(D.teatro), 'MOBILE DEPOSIT HOTEL TEATRO', 4 * P.teatroRate, null, { review: true, payee: 'Hotel Teatro' });
  add('flor', day(D.flor), 'DENVER WHOLESALE FLORIST', -P.flor, null, { review: true, payee: 'Denver Wholesale Florist' });
  add('goog', day(D.goog), 'GOOGLE *WORKSPACE', -P.goog, null, { review: true, payee: 'Google Workspace' });
  add('ins', day(D.ins), 'STATE FARM INSURANCE', -P.ins, null, { review: true, payee: 'State Farm' });
  add('dep', day(D.dep), 'DEPOSIT - FARMERS MARKET SALES', P.dep, null, { review: true, payee: 'Farmers market sales' });
  add('gas', day(D.gas), 'SHELL OIL 57432', -P.gas, null, { review: true, payee: 'Shell' });
  // Customer and invoice
  const teatro = { id: C.uid(), kind: 'customer', name: 'Hotel Teatro', email: 'events@teatro.example', phone: '', address: '1100 14th St\nDenver, CO 80202', notes: 'Weekly lobby arrangements' };
  c.contacts.push(teatro, { id: C.uid(), kind: 'vendor', name: 'Denver Wholesale Florist', email: '', phone: '', address: '', notes: '' }, { id: C.uid(), kind: 'vendor', name: 'Garden Gate Supply', email: '', phone: '', address: '', notes: '' });
  const inv = { id: C.uid(), number: 'J-201', contactId: teatro.id, date: day(D.invoice), dueDate: day(D.invoice + 15), status: 'sent', taxRate: 0, discount: 0, notes: 'Thank you!', lines: [{ id: C.uid(), desc: 'Lobby arrangements — 4 weeks', qty: 4, rate: dollars(P.teatroRate), accountId: A('Sales') }] };
  c.invoices.push(inv); K.inv = inv.id;
  c.transactions.sort((a, b) => a.date.localeCompare(b.date));
  // The statement shows the truth: no duplicate, and the check at its true amount (cents math, so it's exact)
  const chk = A('Business Checking');
  const truthCents = P.checking + c.transactions.filter(t => t.accountId === chk && t.id !== K.xcel2).reduce((s, t) => s + (t.id === K.check ? -P.checkTrue : Math.round(t.amount * 100)), 0);
  const statement = dollars(truthCents);
  // What the app's UI needs (the coach and the portfolio read examKey.month); nothing here is an answer.
  c.examKey = { ...K, month: M, statement, begin: dollars(P.checking), checkNo: P.checkNo };
  // Server-side only
  const key = {
    exam: 'pro', ids: K, month: { ...M, label: month.label }, statement, begin: dollars(P.checking),
    amounts: {
      wages: dollars(P.wages), ptax: dollars(P.ptax), payroll: dollars(P.wages + P.ptax), xcel: dollars(P.xcel),
      checkTrue: dollars(P.checkTrue), checkRecorded: dollars(P.checkRecorded), checkNo: P.checkNo,
      sav: dollars(P.sav), draw: dollars(P.draw), card: dollars(P.card), tax: dollars(P.salesTaxOpen),
      teatro: dollars(4 * P.teatroRate), teatroRate: dollars(P.teatroRate), flor: dollars(P.flor), goog: dollars(P.goog), ins: dollars(P.ins), dep: dollars(P.dep), gas: dollars(P.gas),
      depr: dollars(P.depr)
    },
    dates: { payroll: day(D.payroll), invoice: inv.date, due: inv.dueDate }
  };
  return { client: c, key };
}

const whole = v => (Math.round(v * 100) % 100 === 0 ? '$' + Math.round(v).toLocaleString('en-US') : fmtMoney(v));

// The brief: source documents and tasks, all with this student's numbers.
export function brief(key) {
  const a = key.amounts, M = key.month, ml = M.label;
  return {
    client: 'Juniper Flower Co.', month: { from: M.from, to: M.to, label: ml },
    intro: `Juniper Flower Co. is a new client. Do ${ml}'s month-end the way you would for a real client — and catch the problems a careless bookkeeper would miss.`,
    documents: [
      { title: 'Bank statement — Front Range Community Bank', text: `Juniper Flower Co. LLC · Business Checking ····2290\nStatement period: ${fmtDateLong(M.from)} – ${fmtDateLong(M.to)}\nBeginning balance: ${fmtMoney(key.begin)}\nChecks paid: #${a.checkNo} · ${fmtMoney(a.checkTrue)}\nEnding balance: ${fmtMoney(key.statement)}` },
      { title: 'Gusto payroll report', text: `Pay date ${fmtDateLong(key.dates.payroll)}\nGross wages: ${fmtMoney(a.wages)}\nEmployer payroll taxes: ${fmtMoney(a.ptax)}\nTotal withdrawn: ${fmtMoney(a.payroll)}` },
      { title: 'Invoice J-201 — Hotel Teatro', text: `Sent ${fmtDateLong(key.dates.invoice)}, due ${fmtDateLong(key.dates.due)}\nLobby arrangements — 4 weeks: 4 × ${fmtMoney(a.teatroRate)} = ${fmtMoney(a.teatro)}` },
      { title: 'CPA\'s adjusting entry — AJE #1', text: `Depreciation for ${ml}: ${fmtMoney(a.depr)}\nDebit Depreciation Expense, credit Accumulated Depreciation, dated ${fmtDateLong(M.to)}.` }
    ],
    tasks: [
      'Categorize everything in To Review. Watch for transfers, the owner, the credit card and sales tax.',
      'Hotel Teatro paid invoice J-201. Make sure that money isn\'t counted twice.',
      `Split the Gusto payroll from the payroll report: gross wages ${fmtMoney(a.wages)}, employer taxes ${fmtMoney(a.ptax)} (total ${fmtMoney(a.payroll)}).`,
      `Post the CPA's AJE #1: depreciation of ${fmtMoney(a.depr)} for the month (debit Depreciation Expense, credit Accumulated Depreciation), dated the last day of the month.`,
      'Run Clean up to catch anything entered twice.',
      'Reconcile Business Checking to the bank statement — it won\'t balance until the books are right.',
      `Close ${ml}.`
    ],
    grading: 'Graded on 12 checks worth 100 points. To pass: 80 points, a balanced reconciliation and the month closed. A perfect 100, plus 92% or better on the written exam, earns the certificate\'s distinction.'
  };
}

// Same 12 checks and points as grade() in views-exam.js, against the stored key.
export function grade(c, key) {
  const k = key.ids, a = key.amounts, M = key.month;
  const tx = id => c.transactions.find(t => t.id === id);
  const catOf = id => { const t = tx(id); return t && t.status !== 'review' ? C.acct(c, t.categoryId) : null; };
  const is = (id, name) => { const x = catOf(id); return !!x && x.name === name; };
  const typeOk = (id, type) => { const x = catOf(id); return !!x && x.type === type && !['unc_inc', 'unc_exp'].includes(x.key); };
  const inv = c.invoices.find(i => i.id === k.inv);
  const doubleCounted = c.transactions.some(t => t.status !== 'review' && Math.abs(t.amount - a.teatro) < 0.005 && !t.invoiceId && (C.acct(c, t.categoryId) || {}).type === 'income');
  const chk = C.acctByName(c, 'Business Checking');
  const bookEnd = chk ? C.round2(C.balances(c, { to: M.to }).get(chk.id)) : NaN;
  const rec = chk && c.reconciliations.find(r => r.accountId === chk.id && r.date >= M.to && Math.abs(r.ending - key.statement) < 0.005);
  const dupGone = c.transactions.filter(t => Math.abs(t.amount + a.xcel) < 0.005 && /xcel/i.test(t.description)).length === 1;
  const checkT = tx(k.check) || c.transactions.find(t => String(t.description || '').includes(String(a.checkNo)));
  const everyday = [['flor', 'expense'], ['goog', 'expense'], ['ins', 'expense'], ['gas', 'expense'], ['dep', 'income']];
  const evOk = everyday.filter(([id, ty]) => typeOk(k[id], ty)).length;
  const pay = tx(k.payroll), ptax = C.acctByName(c, 'Payroll Taxes'), pwag = C.acctByName(c, 'Payroll & Wages');
  const payOk = !!pay && Array.isArray(pay.splits) && pay.splits.some(sp => ptax && sp.categoryId === ptax.id && Math.abs(Math.abs(sp.amount) - a.ptax) < 0.005) && pay.splits.some(sp => pwag && sp.categoryId === pwag.id && Math.abs(Math.abs(sp.amount) - a.wages) < 0.005);
  const dep = C.acctByName(c, 'Depreciation Expense'), adep = C.acctByName(c, 'Accumulated Depreciation');
  const ajeOk = !!dep && !!adep && (c.journals || []).some(j => !j.void && j.date <= M.to && j.date >= M.from && (j.lines || []).some(l => l.accountId === dep.id && Math.abs(+l.debit - a.depr) < 0.005) && (j.lines || []).some(l => l.accountId === adep.id && Math.abs(+l.credit - a.depr) < 0.005));
  const diff = C.round2(a.checkTrue - a.checkRecorded);
  const items = [
    ['To Review is cleared', 4, c.transactions.filter(t => t.status === 'review').length === 0, 'Every imported line needs a category before the month can close. Open To Review and categorize each line still waiting there.'],
    ['Transfer to savings → Business Savings', 8, is(k.sav, 'Business Savings'), `Categorize the ${fmtMoney(a.sav)} "ONLINE TRANSFER TO SAV ...7731" to Business Savings. Money moving between the business's own accounts is a transfer, not an expense.`],
    ['Transfer to the owner → Owner\'s Draw', 8, is(k.draw, "Owner's Draw"), `Categorize the ${fmtMoney(a.draw)} "ONLINE TRANSFER TO OWNER PERSONAL" to Owner's Draw. Money the owner takes out is a draw from equity — it doesn't lower profit.`],
    ['Card autopay → Business Credit Card', 8, is(k.card, 'Business Credit Card'), `Categorize the ${fmtMoney(a.card)} "CHASE CARD AUTOPAY" to Business Credit Card. The card purchases were already recorded as expenses; the payment just pays down the card.`],
    ['Sales tax payment → Sales Tax Payable', 8, is(k.tax, 'Sales Tax Payable'), `Categorize the ${fmtMoney(a.tax)} Colorado Dept of Revenue payment to Sales Tax Payable. It pays over last month's collected tax, clearing the ${fmtMoney(a.tax)} liability — it isn't a new expense.`],
    ['Hotel Teatro payment applied to invoice J-201', 12, !!inv && C.invoiceState(c, inv).status === 'paid' && !doubleCounted, `Invoice J-201 already counted the ${fmtMoney(a.teatro)} as income (4 × ${fmtMoney(a.teatroRate)} = ${fmtMoney(a.teatro)}). Apply the Hotel Teatro deposit to J-201 — or record the payment on the invoice and exclude the deposit — so the income isn't counted twice.`],
    [`Everyday items sensibly categorized (${evOk} of 5)`, 10, evOk === 5, `Denver Wholesale Florist ${fmtMoney(a.flor)} → Cost of Goods Sold; Google Workspace ${fmtMoney(a.goog)} → Software & Subscriptions; State Farm ${fmtMoney(a.ins)} → Insurance; Shell ${fmtMoney(a.gas)} → Car & Truck; farmers market deposit ${fmtMoney(a.dep)} → Sales.`, evOk * 2],
    ['Duplicate Xcel Energy payment removed', 8, dupGone, `The same ${fmtMoney(a.xcel)} Xcel Energy payment was in the books twice on the same day, but the statement shows it once. Delete one of the two.`],
    [`Check #${a.checkNo} corrected to ${fmtMoney(a.checkTrue)}`, 8, !!checkT && Math.abs(checkT.amount + a.checkTrue) < 0.005, `Edit check #${a.checkNo} from ${fmtMoney(a.checkRecorded)} to ${fmtMoney(a.checkTrue)} to match the statement. The digits were swapped: ${fmtMoney(a.checkTrue)} − ${fmtMoney(a.checkRecorded)} = ${whole(diff)}, and ${Math.round(diff)} ÷ 9 = ${Math.round(diff) / 9} — a difference that divides evenly by 9 is the classic sign of a transposition.`],
    [`Payroll split: ${fmtMoney(a.wages)} wages and ${fmtMoney(a.ptax)} payroll taxes`, 8, payOk, `Split the ${fmtMoney(a.payroll)} Gusto withdrawal the way the payroll report reads: ${fmtMoney(a.wages)} gross wages to Payroll & Wages and ${fmtMoney(a.ptax)} employer taxes to Payroll Taxes (${fmtMoney(a.wages)} + ${fmtMoney(a.ptax)} = ${fmtMoney(a.payroll)}).`],
    [`CPA's adjusting entry posted (depreciation ${whole(a.depr)})`, 8, ajeOk, `Post AJE #1 as a journal entry dated the last day of the month: debit Depreciation Expense ${fmtMoney(a.depr)}, credit Accumulated Depreciation ${fmtMoney(a.depr)}.`],
    ['Checking reconciled to the statement', 10, !!rec && Math.abs(bookEnd - key.statement) < 0.005, `Reconcile Business Checking to the statement ending balance of ${fmtMoney(key.statement)} on ${fmtDateLong(M.to)}. The books must match to the cent — fix the items above first, then tick every cleared line.`]
  ].map(([label, pts, ok, why, partial]) => ({ label, pts, ok, why, got: ok ? pts : (partial || 0) }));
  const score = items.reduce((s, x) => s + x.got, 0);
  const closed = !!c.lockDate && c.lockDate >= M.to;
  const reconciled = items[items.length - 1].ok;
  return { items, score, closed, reconciled, passed: score >= 80 && reconciled && closed,
    required: [{ label: 'Checking reconciled to the statement', ok: reconciled }, { label: `${M.label} closed`, ok: closed }] };
}
