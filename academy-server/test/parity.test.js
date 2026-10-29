// Proves the server's practical exams are the app's practical exams:
// with the app's original numbers (seed = null), the server builds the same
// client as views-exam.js / views-advanced.js and grades every state of the
// books exactly as the app's own grade() functions do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import C from '../src/engine.js';
import { generate } from '../src/practical/index.js';
import * as juniper from '../src/practical/juniper.js';
import * as aspen from '../src/practical/aspen.js';
import { previousMonth } from '../src/util.js';
import { REPO } from './helpers/harness.js';
import { solvePro, solveAdv } from './helpers/solve.js';
import PRO_BANK from '../src/banks/pro.js';
import ADV_BANK from '../src/banks/adv.js';

const R = path.join(REPO, 'ledger-app/src/renderer');
const TODAY = '2026-10-28', NOW = Date.UTC(2026, 9, 28, 12);

// Loads the app's exam screens with just enough of App to run build() and grade().
function loadApp() {
  const noop = () => {};
  globalThis.App = { S: { data: { clients: [], training: {}, firm: {} }, ui: {} }, C, U: { $: noop, $$: () => [], esc: s => s, money: v => '$' + v, fmtDate: s => s, fmtMonth: s => s, ICON: {}, plural: noop }, client: noop, act: noop, go: noop, render: noop, commit: noop, save: noop, today: () => TODAY };
  for (const f of ['views-exam.js', 'views-advanced.js']) Function(fs.readFileSync(path.join(R, f), 'utf8'))();
  return { pro: globalThis.App.academy, adv: globalThis.App.advanced };
}
const APP = loadApp();

const nameOf = (c, id) => (C.acct(c, id) || {}).name || '';
const shape = c => ({
  name: c.name, start: c.startDate,
  opening: c.accounts.filter(a => a.opening).map(a => [a.name, a.opening]).sort(),
  accounts: c.accounts.map(a => [a.code, a.name, a.type, a.sub]).sort(),
  tx: c.transactions.map(t => [t.date, t.description, t.payee, t.amount, nameOf(c, t.accountId), nameOf(c, t.categoryId), t.status]).sort(),
  inv: c.invoices.map(i => [i.number, i.date, i.dueDate, i.lines.map(l => [l.desc, l.qty, l.rate, nameOf(c, l.accountId)])]),
  contacts: c.contacts.map(x => x.name).sort()
});
const items = r => r.items.map(x => [x.label, x.pts, x.ok, x.got]);

// Once the banks are removed from the app (they live only here now), this has nothing to compare.
const clientBank = f => { const m = fs.readFileSync(path.join(R, f), 'utf8').match(/const BANK = \[([\s\S]*?)\n  \];/); return m ? Function('return [' + m[1] + ']')() : null; };
test('the written banks are the app\'s banks, word for word', { skip: !clientBank('views-exam.js') && 'the app no longer carries the banks' }, () => {
  assert.deepEqual(PRO_BANK, clientBank('views-exam.js'));
  if (clientBank('views-advanced.js')) assert.deepEqual(ADV_BANK, clientBank('views-advanced.js'));
});

test('Juniper Flower Co.: same client and same grading as the app', () => {
  const app = APP.pro.buildExam();
  const srv = generate('pro', previousMonth(NOW), null);
  assert.deepEqual(shape(srv.client), shape(app));
  assert.equal(srv.client.examKey.statement, app.examKey.statement);
  assert.deepEqual(srv.client.examKey.month, app.examKey.month);

  const { grade } = APP.pro;
  const serverGrade = c => juniper.grade(c, srv.key);
  const check = (label, c) => {
    const a = grade(c), s = serverGrade(c);
    assert.deepEqual(items(s), items(a), label);
    assert.deepEqual([s.score, s.closed, s.reconciled, s.passed], [a.score, a.closed, a.reconciled, a.passed], label);
    return s;
  };
  check('untouched', structuredClone(srv.client));
  const solved = solvePro(srv.client, srv.brief).client;
  assert.equal(check('solved', solved).score, 100);
  const variants = {
    'month open': c => { c.lockDate = null; },
    'no reconciliation': c => { c.reconciliations = []; },
    'payroll not split': c => { c.transactions.find(t => /GUSTO/.test(t.description)).splits = null; },
    'AJE on the wrong date': c => { c.journals[0].date = '2026-10-01'; },
    'AJE wrong amount': c => { c.journals[0].lines[0].debit = 150; c.journals[0].lines[1].credit = 150; },
    'savings as an expense': c => { c.transactions.find(t => /TRANSFER TO SAV/.test(t.description)).categoryId = C.acctByName(c, 'Miscellaneous Expense').id; },
    'Teatro counted twice': c => { const t = c.transactions.find(t => /TEATRO/.test(t.description)); t.invoiceId = null; t.categoryId = C.acctByName(c, 'Sales').id; },
    'one everyday item left uncategorized': c => { c.transactions.find(t => /SHELL/.test(t.description)).categoryId = C.acctByKey(c, 'unc_exp').id; },
    'two everyday items wrong type': c => { for (const re of [/GOOGLE/, /FARMERS/]) c.transactions.find(t => re.test(t.description)).categoryId = C.acctByName(c, 'Owner\'s Draw').id; },
    'check not corrected': c => { c.transactions.find(t => /CHECK #/.test(t.description)).amount = -128.5; },
    'both duplicates deleted': c => { c.transactions = c.transactions.filter(t => !/XCEL/.test(t.description)); },
    'one line back in review': c => { c.transactions.find(t => /STATE FARM/.test(t.description)).status = 'review'; }
  };
  for (const [label, fn] of Object.entries(variants)) { const c = structuredClone(solved); fn(c); check(label, c); }
});

test('Aspen Trail Outfitters: same client, same expected balances and same grading as the app', () => {
  const app = APP.adv.build();
  const srv = generate('adv', previousMonth(NOW), null);
  assert.deepEqual(shape(srv.client), shape(app));
  assert.deepEqual(srv.key.expect, app.advKey.expect);
  const check = (label, c) => {
    const withExpect = structuredClone(c); withExpect.advKey = { ...withExpect.advKey, expect: app.advKey.expect }; // the app's grade() reads its key from the client
    const a = APP.adv.grade(withExpect), s = aspen.grade(c, srv.key);
    assert.deepEqual(items(s).slice(0, 7), items(a), label);
    assert.deepEqual([s.score, s.closed, s.passed], [a.score, a.closed, a.passed], label);
    return s;
  };
  check('untouched', srv.client);
  const solved = solveAdv(srv.client, srv.brief).client;
  assert.equal(check('solved', solved).score, 100);
  const variants = {
    'month open': c => { c.lockDate = null; },
    'depreciation $300': c => { c.journals[0].lines[0].debit = 300; c.journals[0].lines[1].credit = 300; },
    'loan not split': c => { c.transactions.find(t => /FIRSTBANK/.test(t.description)).splits = null; },
    'sales tax still an expense': c => { c.transactions.find(t => /DEPT OF REVENUE/.test(t.description)).categoryId = C.acctByName(c, 'Taxes & Licenses').id; },
    'no adjusting entries': c => { c.journals = []; },
    'entries dated next month': c => { for (const j of c.journals) j.date = '2026-10-01'; }
  };
  for (const [label, fn] of Object.entries(variants)) { const c = structuredClone(solved); fn(c); check(label, c); }
});

