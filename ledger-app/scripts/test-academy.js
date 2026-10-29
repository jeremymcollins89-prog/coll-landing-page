// Checks the Academy's math and exams. Run with: npm test
//  1. Every written calculation like "$24,000 × 7.5% ÷ 12 = $150" in the lessons,
//     exams, tips and handbook is recomputed.
//  2. Exam banks are well formed (three answers, one valid correct index).
//  3. The Aspen Trail practical is built, solved the right way, and graded 100.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '../src/renderer');
const C = require('../src/renderer/plus.js');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
console.log('Academy checks');

const FILES = ['views-training.js', 'views-exam.js', 'views-advanced.js', 'views-tips.js', 'views-handbook.js', 'views-practice.js', 'views-plan.js', 'views-extra.js'];
const text = f => fs.readFileSync(path.join(R, f), 'utf8').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\\'/g, "'");

t('every written calculation adds up', () => {
  // an expression of numbers and operators, then "= result"
  const num = String.raw`\$?\d[\d,]*(?:\.\d+)?%?`;
  const expr = new RegExp(String.raw`((?:\(\s*)?${num}(?:\s*\)?\s*[×x÷+−\-*/]\s*\(?\s*${num}\s*\)?)+)\s*[=≈]\s*(\$?\d[\d,]*(?:\.\d+)?%?)`, 'g');
  const val = s => { s = s.replace(/[$,]/g, ''); return s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s); };
  let checked = 0; const bad = [];
  for (const f of FILES) {
    const src = text(f);
    for (const m of src.matchAll(expr)) {
      const lhs = m[1], rhs = m[2];
      if (!/[×÷+−*/]/.test(lhs)) continue;
      const js = lhs.replace(/\$?\d[\d,]*(?:\.\d+)?%?/g, x => String(val(x))).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\bx\b/g, '*');
      let got; try { got = Function('return (' + js + ')')(); } catch (e) { continue; }
      const want = val(rhs);
      // allow display rounding to the cent, or to whole dollars when the result is written without cents
      const tol = /\./.test(rhs) ? 0.006 : rhs.endsWith('%') ? 0.006 : 0.51;
      checked++;
      if (!(Math.abs(got - want) <= tol)) bad.push(`${f}: "${m[0]}" → ${got}`);
    }
  }
  assert(checked >= 25, 'only found ' + checked + ' calculations');
  assert.deepStrictEqual(bad, []);
  console.log(`    (${checked} calculations recomputed)`);
});

const bank = (f, name) => { const src = fs.readFileSync(path.join(R, f), 'utf8'); const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n  \\];')); return Function('return [' + m[1] + ']')(); };
t('exam banks are well formed', () => {
  for (const [f, min] of [['views-exam.js', 60], ['views-advanced.js', 60]]) {
    const B = bank(f, 'BANK');
    assert(B.length >= min, f + ' bank is small');
    const seen = new Set();
    B.forEach(([tp, q, a, c, why], i) => {
      assert(tp && q && why, f + ' #' + i + ' missing text');
      assert.strictEqual(a.length, 3, f + ' #' + i + ' needs three answers');
      assert.strictEqual(new Set(a).size, 3, f + ' #' + i + ' has duplicate answers');
      assert(Number.isInteger(c) && c >= 0 && c < 3, f + ' #' + i + ' bad answer index');
      assert(!seen.has(q), f + ' duplicate question: ' + q); seen.add(q);
    });
  }
});

t('Aspen Trail practical grades a correct close at 100', () => {
  const noop = () => {};
  global.App = { S: { data: { clients: [], training: {} }, ui: {} }, C, U: { $: noop, $$: () => [], esc: s => s, money: v => '$' + v, fmtDate: s => s, ICON: {}, plural: noop }, client: noop, act: noop, go: noop, render: noop, commit: noop, save: noop, today: () => '2026-10-28' };
  Function(fs.readFileSync(path.join(R, 'views-advanced.js'), 'utf8'))();
  const AV = global.App.advanced, c = AV.build(), k = c.advKey, A = nm => C.acctByName(c, nm).id;
  assert(Math.abs(C.balanceSheet(c, k.month.to).check) < 0.01, 'opening books do not balance');
  assert.strictEqual(AV.grade(c).score, 0, 'nothing should pass before any work');
  const je = (lines, date = k.month.to) => c.journals.push({ id: C.uid(), date, number: 'T', memo: '', lines: lines.map(([nm, dr, cr]) => ({ accountId: A(nm), debit: dr || 0, credit: cr || 0 })) });
  // the answer key, worked from the source documents
  const depr = (36000 - 7200) / 120, interest = 28800 * 0.075 / 12, ins = 3600 / 12, wages = 50 * 25, shrink = 19200 - 18450;
  assert.deepStrictEqual([depr, interest, ins, wages, shrink], [240, 180, 300, 1250, 750]);
  je([['Depreciation Expense', depr], ['Accumulated Depreciation', 0, depr]]);
  je([['Cost of Goods Sold', shrink], ['Inventory', 0, shrink]]);
  je([['Insurance', ins], ['Prepaid Expenses', 0, ins]]);
  je([['Payroll & Wages', wages], ['Accrued Liabilities', 0, wages]]);
  je([['Sales', 2000], ['Unearned Revenue', 0, 2000]]);
  const loan = c.transactions.find(x => x.id === k.loan); loan.splits = [{ categoryId: A('Loans Payable'), amount: -(1100 - interest) }, { categoryId: A('Interest Expense'), amount: -interest }];
  c.transactions.find(x => x.id === k.tax).categoryId = A('Sales Tax Payable');
  let r = AV.grade(c);
  assert.strictEqual(r.score, 88, 'all seven fixes earn 88 before closing: ' + r.items.filter(x => !x.ok).map(x => x.label).join('; '));
  assert(!r.passed, 'must close the month to pass');
  c.lockDate = k.month.to; r = AV.grade(c);
  assert.strictEqual(r.score, 100); assert(r.passed);
  assert(Math.abs(C.balanceSheet(c, k.month.to).check) < 0.01, 'books stopped balancing');
  // A wrong amount loses only that item
  c.journals[0].lines[0].debit = 300; c.journals[0].lines[1].credit = 300;
  assert.strictEqual(AV.grade(c).score, 88);
  assert.strictEqual(AV.BANK.length >= AV.DRAW, true);
});

console.log(`All ${n} Academy checks passed.`);
