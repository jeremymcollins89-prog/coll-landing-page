// Solves exams the way a careful student would, so the tests can check grading.
// The practicals are solved ONLY from what the student is given (the brief's
// documents and the client's transactions) using the app's engine — which also
// proves each student's documents agree with the server's hidden answer key.
import C from '../../src/engine.js';
import PRO_BANK from '../../src/banks/pro.js';
import ADV_BANK from '../../src/banks/adv.js';

const MONEY = String.raw`\$[\d,]+(?:\.\d{2})?`;
const money = s => Number(String(s).replace(/[$,]/g, ''));
const grab = (text, re) => { const m = re.exec(text); if (!m) throw new Error(`Not found in document: ${re} in\n${text}`); return m; };
const doc = (brief, start) => { const d = brief.documents.find(x => x.title.startsWith(start)); if (!d) throw new Error('No document ' + start); return d.text; };

// ---------------------------------------------------------------- written
// Picks options by looking the question up in the bank. `wrong` = how many to miss on purpose.
export function answerSheet(exam, questions, wrong = 0) {
  const bank = exam === 'pro' ? PRO_BANK : ADV_BANK;
  const answers = {};
  questions.forEach((q, k) => {
    const entry = bank.find(b => b[1] === q.question && b[0] === q.topic);
    if (!entry) throw new Error('Question not in bank: ' + q.question);
    const right = q.options.indexOf(entry[2][entry[3]]);
    answers[q.id] = k < wrong ? (right + 1) % 3 : right;
  });
  return answers;
}

// ---------------------------------------------------------------- Juniper Flower Co.
export function solvePro(client, brief) {
  const c = structuredClone(client);
  const A = n => C.acctByName(c, n).id;
  const M = brief.month;
  const st = doc(brief, 'Bank statement');
  const ending = money(grab(st, new RegExp(`Ending balance: (${MONEY})`))[1]);
  const [, checkNo, checkAmt] = grab(st, new RegExp(`Checks paid: #(\\d+) · (${MONEY})`));
  const pay = doc(brief, 'Gusto payroll');
  const wages = money(grab(pay, new RegExp(`Gross wages: (${MONEY})`))[1]);
  const ptax = money(grab(pay, new RegExp(`Employer payroll taxes: (${MONEY})`))[1]);
  const depr = money(grab(doc(brief, 'CPA'), new RegExp(`: (${MONEY})`))[1]);
  const inv = c.invoices.find(i => i.number === 'J-201');

  const post = (re, name, extra = {}) => {
    const list = c.transactions.filter(t => t.status === 'review' && re.test(t.description));
    if (list.length !== 1) throw new Error(`expected one review line for ${re}, got ${list.length}`);
    Object.assign(list[0], { status: 'posted', categoryId: A(name) }, extra);
  };
  post(/TRANSFER TO SAV/, 'Business Savings');
  post(/TRANSFER TO OWNER/, "Owner's Draw");
  post(/CARD AUTOPAY/, 'Business Credit Card');
  post(/DEPT REVENUE/, 'Sales Tax Payable');
  post(/HOTEL TEATRO/, 'Accounts Receivable', { invoiceId: inv.id });
  post(/DENVER WHOLESALE/, 'Cost of Goods Sold');
  post(/GOOGLE/, 'Software & Subscriptions');
  post(/STATE FARM/, 'Insurance');
  post(/SHELL/, 'Car & Truck');
  post(/FARMERS MARKET/, 'Sales');
  // the duplicate utility payment
  const xcel = c.transactions.filter(t => /XCEL/.test(t.description));
  c.transactions = c.transactions.filter(t => t !== xcel[1]);
  // the transposed check
  c.transactions.find(t => t.description.includes('#' + checkNo)).amount = -money(checkAmt);
  // payroll split from the report
  const gusto = c.transactions.find(t => /GUSTO/.test(t.description));
  gusto.splits = [{ categoryId: A('Payroll & Wages'), amount: -wages }, { categoryId: A('Payroll Taxes'), amount: -ptax }];
  // AJE #1
  c.journals.push({ id: C.uid(), date: M.to, number: 'AJE 1', memo: 'Depreciation', lines: [{ accountId: A('Depreciation Expense'), debit: depr, credit: 0 }, { accountId: A('Accumulated Depreciation'), debit: 0, credit: depr }] });
  // reconcile: the books must now equal the statement
  const book = C.round2(C.balances(c, { to: M.to }).get(A('Business Checking')));
  c.reconciliations.push({ id: C.uid(), accountId: A('Business Checking'), date: M.to, ending, completedOn: M.to });
  c.lockDate = M.to;
  return { client: c, book, ending };
}

// ---------------------------------------------------------------- Aspen Trail Outfitters
export function solveAdv(client, brief) {
  const c = structuredClone(client);
  const A = n => C.acctByName(c, n).id;
  const M = brief.month;
  const d1 = doc(brief, '1 ·'), d2 = doc(brief, '2 ·'), d3 = doc(brief, '3 ·'), d4 = doc(brief, '4 ·'), d5 = doc(brief, '5 ·'), d6 = doc(brief, '6 ·');
  const cost = money(grab(d1, new RegExp(`cost (${MONEY})`))[1]);
  const salvage = money(grab(d1, new RegExp(`salvage value (${MONEY})`))[1]);
  const years = +grab(d1, /(\d+)-year straight-line/)[1];
  const count = money(grab(d2, new RegExp(`Total (${MONEY})`))[1]);
  const book = money(grab(d2, new RegExp(`opening inventory of (${MONEY})`))[1]);
  const payment = money(grab(d3, new RegExp(`Payment (${MONEY})`))[1]);
  const balance = money(grab(d3, new RegExp(`before the payment (${MONEY})`))[1]);
  const rate = Number(grab(d3, /at ([\d.]+)% annual/)[1]);
  const policyMonths = +grab(d4, /(\d+)-month policy/)[1];
  const premium = money(grab(d4, new RegExp(`policy, (${MONEY})`))[1]);
  const hours = +grab(d5, /(\d+) hours at/)[1];
  const hourly = money(grab(d5, new RegExp(`hours at (${MONEY})`))[1]);
  const deposit = money(grab(d6, new RegExp(`paid a (${MONEY}) deposit`))[1]);

  const depr = C.round2((cost - salvage) / (years * 12));
  const shrink = C.round2(book - count);
  const interest = C.round2(balance * rate / 100 / 12);
  const ins = C.round2(premium / policyMonths), wages = C.round2(hours * hourly);
  const je = (lines) => c.journals.push({ id: C.uid(), date: M.to, number: 'ADJ', memo: '', lines: lines.map(([n, dr, cr]) => ({ accountId: A(n), debit: dr || 0, credit: cr || 0 })) });
  je([['Depreciation Expense', depr], ['Accumulated Depreciation', 0, depr]]);
  je([['Cost of Goods Sold', shrink], ['Inventory', 0, shrink]]);
  je([['Insurance', ins], ['Prepaid Expenses', 0, ins]]);
  je([['Payroll & Wages', wages], ['Accrued Liabilities', 0, wages]]);
  je([['Sales', deposit], ['Unearned Revenue', 0, deposit]]);
  const loan = c.transactions.find(t => /FIRSTBANK/.test(t.description));
  loan.splits = [{ categoryId: A('Loans Payable'), amount: -C.round2(payment - interest) }, { categoryId: A('Interest Expense'), amount: -interest }];
  c.transactions.find(t => /DEPT OF REVENUE/.test(t.description)).categoryId = A('Sales Tax Payable');
  c.lockDate = M.to;
  return { client: c, work: { depr, shrink, interest, ins, wages, deposit } };
}
