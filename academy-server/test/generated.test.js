// The generated calculation questions: every template, many seeds.
// Each correct answer is recomputed here independently from the template's
// inputs (or from the question text itself), the three options must be
// distinct, the right answer must sit at every position over many draws, and
// the same seed must always give the same questions. Then, through the API:
// the correct option always grades right and a distractor always grades wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, generateSet, makeQuestion } from '../src/banks/generated.js';
import { seededRandom } from '../src/util.js';
import { EXAMS } from '../src/written.js';
import PRO_BANK from '../src/banks/pro.js';
import ADV_BANK from '../src/banks/adv.js';
import { makeApp, storedQuestions } from './helpers/harness.js';

const SEEDS = 400;

// ---- independent helpers (deliberately not the generator's)
const half = (num, den) => Math.floor((2 * num + den) / (2 * den)); // num/den to the cent, half up
const $ = c => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (num, den) => (half(num * 1000, den) / 10).toFixed(1) + '%';
const total = a => a.reduce((s, x) => s + x, 0);
const ss = g => half(g * 62, 1000), med = g => half(g * 145, 10000);

// Expected correct option text (or a check) per template id.
const EXPECT = {
  // Professional
  transposition: ({ truth, booked }, q) => {
    const d = truth - booked, t = String(Math.floor(truth / 100)), b = String(Math.floor(booked / 100));
    assert.equal(t.slice(0, -2) + t.slice(-1) + t.slice(-2, -1), b, 'tens and ones digits are swapped');
    assert.equal(d % 900, 0, 'the difference divides by 9');
    return `Increase the payment in the books by ${$(d)} — a transposition (${d / 100} ÷ 9 = ${d / 900})`;
  },
  reconciliation: ({ S, checks, dit }) => $(S - total(checks) + dit),
  'net-pay': ({ G, fed, state }) => { assert.equal(state, half(G * 44, 1000), 'Colorado 4.4%'); return $(G - fed - state - ss(G) - med(G)); },
  'employer-cost': ({ G }) => $(G + ss(G) + med(G)),
  'sales-tax-included': ({ X, bp }) => $(half(X * bp, 10000 + bp)),
  'invoice-total': ({ qty, rate, disc, bp }) => { const t = qty * rate - disc; return $(t + half(t * bp, 10000)); },
  'gross-margin': ({ rev, cogs }) => pct(rev - cogs, rev),
  'net-margin': ({ rev, cogs, opex }) => pct(rev - cogs - opex, rev),
  'prepaid-remaining': ({ N, P, M }) => $(P - (P / N) * M),
  'depreciation-month': ({ cost, salvage, years }) => { assert.equal((cost - salvage) % (years * 12), 0); return $((cost - salvage) / (years * 12)); },
  'owner-equity': ({ E, NI, C, D }) => $(E + NI + C - D),
  'days-to-pay': (inputs, q) => {
    const pairs = [...q.question.matchAll(/sent (\w+ \d+, \d{4}), paid (\w+ \d+, \d{4})/g)];
    assert.equal(pairs.length, 3);
    const days = pairs.map(([, a, b]) => Math.round((Date.parse(b + ' UTC') - Date.parse(a + ' UTC')) / 86400000));
    assert.equal(total(days) % 3, 0);
    return `${total(days) / 3} days`;
  },
  'tax-set-aside': ({ rev, exp, pct: p }) => $(half((rev - exp) * p, 100)),
  mileage: ({ date, each, trips }, q) => {
    const tenthsOfCents = date < '2026-07-01' ? 725 : 760; // 72.5¢ through June 30, 76¢ from July 1, 2026
    assert(date.startsWith('2026-'));
    return $(half(2 * each * trips * tenthsOfCents, 10));
  },
  'form-1099': ({ checks, K, yes }, q) => {
    const C = total(checks);
    assert.equal(yes, C >= 200000, 'threshold is $2,000 of non-card payments');
    assert(C + K >= 200000 || yes, 'the "no" case always tempts with a card-inclusive total over $2,000');
    return yes ? `Yes — the ${$(C)} paid by check or ACH is $2,000 or more` : `No — only the ${$(C)} paid by check or ACH counts, and it's under $2,000; the card company reports card payments on a 1099-K`;
  },
  // Advanced
  'deferred-revenue': ({ N, P, M }) => $(P - (P / N) * M),
  'accrued-wages': ({ W, d }) => $((W / 5) * d),
  'loan-split': ({ B, bp, P }) => { const interest = (B * 100 * bp) / 120000; assert(Number.isInteger(interest)); return $(P - interest); },
  cogs: ({ b, p, e }) => $(b + p - e),
  shrinkage: ({ B, C }) => `Debit Cost of Goods Sold ${$(B - C)}, credit Inventory ${$(B - C)}`,
  'book-value': ({ cost, salvage, years, months }) => $(cost - ((cost - salvage) / (years * 12)) * months),
  'gain-loss': ({ cost, salvage, years, months, S }) => { const gl = S - (cost - ((cost - salvage) / (years * 12)) * months); return gl >= 0 ? `Gain of ${$(gl)}` : `Loss of ${$(-gl)}`; },
  'employer-fica': ({ G }) => $(ss(G) + med(G)),
  futa: ({ w }) => $(half(total(w.map(x => Math.min(x, 700000))) * 6, 1000)),
  'ss-wage-base': ({ P, Y }) => { assert(Y < 18450000 && Y + P > 18450000, 'this paycheck crosses the $184,500 base'); return $(half((18450000 - Y) * 62, 1000)); },
  'se-tax': ({ N }) => $(half(N * 9235 * 153, 10000000)),
  'safe-harbor': ({ T, A }) => $(A > 15000000 ? half(T * 11, 10) : T),
  meals: ({ M }) => $(half(M, 2)),
  'backup-withholding': ({ P }) => { const w = half(P * 24, 100); return `Withhold ${$(w)} (24%), send it to the IRS, and pay the contractor ${$(P - w)}`; },
  'cash-from-ops': ({ NI, dep, ar, inv, ap }) => $(NI + dep - ar - inv + ap),
  'retained-earnings': ({ b, NI, d }) => $(b + NI - d),
  'sales-tax-payable': ({ C }) => $(C)
};

test('template sets: ~15 per level, unique ids, topics from that level\'s bank', () => {
  assert.equal(TEMPLATES.pro.length, 15); assert.equal(TEMPLATES.adv.length, 17);
  for (const [level, bank] of [['pro', PRO_BANK], ['adv', ADV_BANK]]) {
    const ids = TEMPLATES[level].map(t => t.id);
    assert.equal(new Set(ids).size, ids.length);
    const topics = new Set(bank.map(q => q[0]));
    for (const t of TEMPLATES[level]) assert(topics.has(t.topic), `${t.id}: topic ${t.topic}`);
    assert(TEMPLATES[level].length >= EXAMS[level].generated);
  }
  assert.deepEqual(Object.keys(EXPECT).sort(), [...TEMPLATES.pro, ...TEMPLATES.adv].map(t => t.id).sort(), 'every template has an independent check');
});

test('every template: correct math, three distinct options, a worked explanation', () => {
  for (const level of ['pro', 'adv']) for (const t of TEMPLATES[level]) {
    const positions = [0, 0, 0];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const q = makeQuestion(t, seededRandom(seed * 7919 + t.id.length));
      const where = `${t.id} seed ${seed}`;
      assert.equal(q.options.length, 3, where);
      assert.equal(new Set(q.options).size, 3, where + ': options must differ');
      assert(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 2, where);
      assert.equal(q.options[q.correct], EXPECT[t.id](q.inputs, q), where + '\n' + q.question);
      assert(q.question.length > 30 && q.why.length > 40, where);
      assert(!/NaN|undefined|Infinity|\$-|null/.test(q.question + q.options.join() + q.why), where + ': bad text ' + q.question + q.options + q.why);
      // the explanation shows the worked math and lands on the right number
      const key = (q.options[q.correct].match(/[−]?\$[\d,]+\.\d{2}|\d+(\.\d)?%|\d+ days/) || [q.options[q.correct]])[0];
      if (!/^(Yes|No|Debit|Withhold)/.test(q.options[q.correct])) assert(q.why.includes(key.replace('−', '')), `${where}: why should show ${key}\n${q.why}`);
      assert(/[=×÷−+]/.test(q.why), where + ': why should show the math');
      // money amounts are whole cents
      const THRESHOLDS = ['$600', '$2,000', '$7,000', '$184,500', '$150,000']; // rules quoted in the text, not computed amounts
      for (const amt of (q.question + q.options.join(' ')).match(/\$[\d,]+(\.\d+)?/g) || []) if (!THRESHOLDS.includes(amt)) assert(/\.\d{2}$/.test(amt), `${where}: ${amt}`);
      positions[q.correct]++;
    }
    assert(positions.every(n => n > SEEDS / 6), `${t.id}: the right answer should land in every position (${positions})`);
  }
});

test('the same seed gives the same questions; different seeds differ', () => {
  for (const level of ['pro', 'adv']) {
    const n = EXAMS[level].generated;
    const a = generateSet(level, n, 12345), b = generateSet(level, n, 12345), c = generateSet(level, n, 12346);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    assert.equal(a.length, n);
    assert.equal(new Set(a.map(q => q.tpl)).size, n, 'no template twice in one exam');
  }
});

test('through the API: 40% generated, the right option always grades right, a distractor wrong', async () => {
  const app = makeApp();
  for (const exam of ['pro', 'adv']) {
    for (let i = 0; i < 8; i++) {
      const s = (await app.call('POST', '/api/enroll', { body: { name: 'Gen Tester', email: `gen${exam}${i}@example.com` } })).body;
      if (exam === 'adv') { // skip ahead: give this student a Professional certificate row
        app.env.DB.db.prepare("INSERT INTO credentials (id, student_id, program, name, awarded, written, practical, distinction, revoked, credential, created_at) VALUES (?, ?, 'professional', 'Gen Tester', '2026-10-28', 90, 90, 0, 0, '{}', 0)").run(`CL-2026-GEN${i}-0000`, s.studentId);
      }
      const st = (await app.call('POST', '/api/exam/start', { token: s.token, body: { exam } })).body;
      const stored = storedQuestions(app, st.attemptId);
      const E = EXAMS[exam];
      assert.equal(st.questions.length, E.draw);
      assert.equal(stored.filter(q => q.g).length, E.generated); assert.equal(stored.filter(q => !q.g).length, E.fromBank);
      // what the student received never includes the answer, the explanation or the inputs
      const sent = JSON.stringify(st);
      for (const q of stored.filter(x => x.g)) { assert(!sent.includes(q.g.why)); assert(!/"(correct|inputs|why|tpl)"/.test(sent)); }
      // right on every generated question, wrong on every bank question
      const answers = {};
      stored.forEach((q, k) => { answers[`q${k + 1}`] = q.g ? q.g.correct : (q.o.indexOf(E.bank[q.b][3]) + 1) % 3; });
      const r = (await app.call('POST', '/api/exam/submit', { token: s.token, body: { attemptId: st.attemptId, answers } })).body;
      assert.equal(r.score, E.generated, `${exam}: exactly the generated ones are right`);
      assert.equal(r.review.length, E.fromBank);
      // and the reverse: a distractor on every generated question is marked wrong, with the worked answer in the review
      const st2 = (await app.call('POST', '/api/exam/start', { token: s.token, body: { exam } })).body;
      const stored2 = storedQuestions(app, st2.attemptId), answers2 = {};
      stored2.forEach((q, k) => { answers2[`q${k + 1}`] = q.g ? (q.g.correct + 1 + (k % 2)) % 3 : q.o.indexOf(E.bank[q.b][3]); });
      const r2 = (await app.call('POST', '/api/exam/submit', { token: s.token, body: { attemptId: st2.attemptId, answers: answers2 } })).body;
      assert.equal(r2.score, E.fromBank);
      for (const m of r2.review) {
        const q = stored2[+m.id.slice(1) - 1];
        assert(q.g, 'only generated questions were missed');
        assert.equal(m.correctAnswer, q.g.options[q.g.correct]); assert.equal(m.why, q.g.why);
        assert.equal(m.yourAnswer, q.g.options[answers2[m.id]]); assert.notEqual(m.yourAnswer, m.correctAnswer);
      }
    }
  }
});
