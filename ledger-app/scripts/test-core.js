// Checks the accounting engine and file readers. Run with: npm test
const assert = require('assert');
const C = require('../src/renderer/core.js');
const I = require('../src/renderer/imports.js');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const balanced = c => { let dr = 0, cr = 0; for (const p of C.postings(c)) { dr += p.dr; cr += p.cr; } return Math.abs(dr - cr) < 0.005; };

console.log('Coll Ledger checks');

t('sample clients balance', () => {
  for (const c of C.demoClients()) {
    assert(balanced(c), c.name + ' postings do not balance');
    assert(Math.abs(C.balanceSheet(c, C.todayISO()).check) < 0.01, c.name + ' balance sheet is off');
  }
});

t('split transactions post every line', () => {
  const c = C.newClient({ startDate: '2026-01-01' });
  const chk = C.acctByName(c, 'Business Checking'), rent = C.acctByName(c, 'Rent & Lease'), ut = C.acctByName(c, 'Utilities');
  c.transactions.push({ id: 'a', date: '2026-02-01', amount: -500, accountId: chk.id, categoryId: rent.id, status: 'posted', splits: [{ categoryId: rent.id, amount: -300 }, { categoryId: ut.id, amount: -200 }] });
  const b = C.balances(c);
  assert.strictEqual(b.get(chk.id), -500); assert.strictEqual(b.get(rent.id), 300); assert.strictEqual(b.get(ut.id), 200);
  assert(balanced(c));
});

t('a zero-total split still posts', () => {
  const c = C.newClient({ startDate: '2026-01-01' });
  const sq = C.ensureAccount(c, { name: 'Square', type: 'asset', sub: 'clearing' });
  const sales = C.acctByKey(c, 'sales'), cash = C.ensureAccount(c, { name: 'Cash on Hand', type: 'asset', sub: 'bank' });
  c.transactions.push({ id: 'z', date: '2026-03-01', amount: 0, accountId: sq.id, categoryId: sales.id, status: 'posted', splits: [{ categoryId: sales.id, amount: 40 }, { categoryId: cash.id, amount: -40 }] });
  const b = C.balances(c);
  assert.strictEqual(b.get(sales.id), 40); assert.strictEqual(b.get(cash.id), 40); assert(balanced(c));
});

t('invoices with discount and tax balance, payments clear A/R', () => {
  const c = C.newClient({ startDate: '2026-01-01' });
  const cu = { id: 'cu', kind: 'customer', name: 'A' }; c.contacts.push(cu);
  const inv = { id: 'i', number: 'INV-1', contactId: 'cu', date: '2026-02-01', dueDate: '2026-03-01', status: 'sent', taxRate: 8, discount: 50, lines: [{ id: 'l', desc: 'Work', qty: 2, rate: 250, accountId: C.acctByKey(c, 'service').id }] };
  c.invoices.push(inv);
  assert.deepStrictEqual(C.invoiceTotals(inv), { subtotal: 500, discount: 50, tax: 36, total: 486 });
  assert(balanced(c));
  c.transactions.push({ id: 'p', date: '2026-02-10', amount: 486, accountId: C.acctByName(c, 'Business Checking').id, categoryId: C.acctByKey(c, 'ar').id, invoiceId: 'i', status: 'posted' });
  assert.strictEqual(C.invoiceState(c, inv).status, 'paid');
  assert.strictEqual(C.balances(c).get(C.acctByKey(c, 'ar').id), 0);
  inv.status = 'void'; c.transactions = [];
  assert.strictEqual(C.balances(c).get(C.acctByKey(c, 'ar').id), 0);
});

t('credit card charges increase what is owed', () => {
  const c = C.newClient({ startDate: '2026-01-01' });
  const cc = C.acctByName(c, 'Business Credit Card'), chk = C.acctByName(c, 'Business Checking');
  c.transactions.push({ id: 'x', date: '2026-01-05', amount: -100, accountId: cc.id, categoryId: C.acctByName(c, 'Meals').id, status: 'posted' });
  c.transactions.push({ id: 'y', date: '2026-01-20', amount: -60, accountId: chk.id, categoryId: cc.id, status: 'posted' });
  assert.strictEqual(C.balances(c).get(cc.id), 40);
  assert(balanced(c));
});

t('non-January business year', () => {
  const c = C.newClient({ startDate: '2025-01-01' }); c.fyStartMonth = 7;
  assert.strictEqual(C.fyStart(c, '2026-03-15'), '2025-07-01');
  assert.strictEqual(C.fyStart(c, '2026-08-15'), '2026-07-01');
  const chk = C.acctByName(c, 'Business Checking');
  c.transactions.push({ id: 'a', date: '2025-05-01', amount: 1000, accountId: chk.id, categoryId: C.acctByKey(c, 'sales').id, status: 'posted' });
  c.transactions.push({ id: 'b', date: '2025-09-01', amount: 300, accountId: chk.id, categoryId: C.acctByKey(c, 'sales').id, status: 'posted' });
  const bs = C.balanceSheet(c, '2026-03-31');
  assert.strictEqual(bs.retained, 1000); assert.strictEqual(bs.netYTD, 300); assert.strictEqual(bs.check, 0);
});

t('dates, amounts and CSV', () => {
  assert.strictEqual(C.parseDate('02/13/2026'), '2026-02-13');
  assert.strictEqual(C.parseDate('13/02/2026'), '2026-02-13');
  assert.strictEqual(C.parseDate('03/04/2026', 'dmy'), '2026-04-03');
  assert.strictEqual(C.parseDate('2026-02-30'), null);
  assert.strictEqual(C.parseDate('1/5/26'), '2026-01-05');
  assert.strictEqual(C.parseAmount('(1,234.50)'), -1234.5);
  assert.strictEqual(C.parseAmount('12.00-'), -12);
  assert.strictEqual(C.parseAmount('-$0.68'), -0.68);
  assert.strictEqual(C.parseAmount('$1,000.00 DR'), -1000);
  const rows = C.parseCSV('﻿Date,Description,Amount\r\n01/02/2026,"Coffee, ""large""",-4.50\r\n01/03/2026,"Two\nlines",10\r\n');
  assert.strictEqual(rows.length, 3); assert.strictEqual(rows[1][1], 'Coffee, "large"'); assert.strictEqual(rows[2][1], 'Two\nlines');
  assert.strictEqual(C.guessDateOrder(['01/02/2026', '25/02/2026']), 'dmy');
});

t('recognizes Square and QuickBooks files', () => {
  const sq = C.parseCSV('Date,Time,Gross Sales,Discounts,Net Sales,Tax,Tip,Partial Refunds,Total Collected,Cash,Fees,Net Total,Transaction Status\n10/01/26,08:00,$10.00,$0.00,$10.00,$0.88,$1.00,$0.00,$11.88,$0.00,-$0.46,$11.42,Complete\n10/01/26,09:00,$5.00,$0.00,$5.00,$0.44,$0.00,$0.00,$5.44,$5.44,$0.00,$5.44,Complete');
  assert.strictEqual(I.detect(sq).kind, 'square-sales');
  const { days } = I.squareSales(sq, 0);
  assert.strictEqual(days.length, 1); assert.strictEqual(days[0].sales, 15); assert.strictEqual(days[0].cashOut, 5.44); assert.strictEqual(days[0].nettotal, 16.86);
  const qb = [['Company'], ['Transaction Detail by Account'], [], ['', 'Date', 'Transaction Type', 'Num', 'Name', 'Memo/Description', 'Split', 'Amount'], ['Checking'], ['', '01/05/2026', 'Expense', '1', 'Xcel', 'Power', 'Utilities', '-50.00'], ['Total for Checking']];
  const d = I.detect(qb); assert.strictEqual(d.kind, 'qb-transactions');
  const lines = I.qbTransactions(qb, d.at); assert.strictEqual(lines.length, 1); assert.strictEqual(lines[0].account, 'Checking');
  const acc = [['Account List'], ['Full name', 'Type', 'Detail type'], ['Checking', 'Bank', 'Checking'], ['Utilities:Gas', 'Expenses', 'Utilities']];
  assert.strictEqual(I.detect(acc).kind, 'qb-accounts');
  assert.strictEqual(I.qbAccounts(acc, 1)[1].name, 'Gas');
  assert.strictEqual(I.detect([['Posting Date', 'Description', 'Amount'], ['1/1/26', 'X', '1']]).kind, 'bank');
});

t('matches QuickBooks account names', () => {
  const c = C.newClient({});
  assert.strictEqual(C.findAccount(c, '6600 Rent or Lease').name, 'Rent & Lease');
  assert.strictEqual(C.findAccount(c, 'Utilities:Gas and Electric').name, 'Utilities');
  assert.strictEqual(C.findAccount(c, 'Checking').name, 'Business Checking');
});

t('bills post to Accounts Payable and payments clear it', () => {
  const c = C.newClient({ startDate: '2026-01-01' });
  const v = { id: 'v', kind: 'vendor', name: 'Flour Co', is1099: true }; c.contacts.push(v);
  c.bills.push({ id: 'b', vendorId: 'v', date: '2026-02-01', dueDate: '2026-03-01', status: 'open', lines: [{ id: 'l', desc: 'Flour', accountId: C.acctByKey(c, 'cogs').id, amount: 400 }] });
  const ap = C.acctByKey(c, 'ap');
  assert.strictEqual(C.balances(c).get(ap.id), 400); assert(balanced(c));
  c.transactions.push({ id: 'p', date: '2026-02-20', amount: -400, accountId: C.acctByName(c, 'Business Checking').id, categoryId: ap.id, billId: 'b', vendorId: 'v', payee: 'Flour Co', status: 'posted' });
  assert.strictEqual(C.balances(c).get(ap.id), 0); assert.strictEqual(C.billState(c, c.bills[0]).status, 'paid'); assert(balanced(c));
  assert.strictEqual(C.contractorPayments(c, 2026)[0].total, 400);
});

t('trial balance debits equal credits', () => {
  for (const c of C.demoClients()) { const tb = C.trialBalance(c, C.todayISO()); assert(Math.abs(tb.debit - tb.credit) < 0.01, c.name); }
});

t('1099 thresholds and repeating dates', () => {
  assert.strictEqual(C.threshold1099(2025), 600); assert.strictEqual(C.threshold1099(2026), 2000);
  assert.strictEqual(C.nextDate('2026-01-31', 'month'), '2026-02-28'); assert.strictEqual(C.nextDate('2026-11-15', 'quarter'), '2027-02-15'); assert.strictEqual(C.nextDate('2026-01-01', 'twoweeks'), '2026-01-15');
});

(async () => {
  const Sec = require('../src/renderer/secure.js');
  const lock = await Sec.create('correct horse', 'hint');
  const blob = JSON.parse(await Sec.encryptBooks(lock.header, lock.dek, { ok: 1 }));
  assert(Sec.isEncrypted(blob));
  assert.strictEqual((await Sec.decryptBooks((await Sec.unlock(blob.header, 'correct horse')).dek, blob)).ok, 1);
  assert.strictEqual(await Sec.unlock(blob.header, 'wrong'), null);
  assert((await Sec.unlock(blob.header, lock.code)).byRecovery);
  n++; console.log('  ✓ password lock and recovery code');
  console.log(`All ${n} checks passed.`);
})().catch(e => { console.error(e); process.exit(1); });
