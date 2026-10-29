// Coll Ledger Academy — calculation questions generated per attempt.
// The question banks are public, so about 40% of every official written exam is
// made of these: each template draws fresh inputs from a seeded generator, works
// the math exactly in whole cents, and offers two wrong answers that come from
// mistakes people really make (forgetting salvage value, using an annual figure
// instead of a monthly one, 6.2% instead of 7.65%, adding instead of subtracting…).
//
// generateSet(level, count, seed) → [{ tpl, topic, question, options[3], correct, why, inputs }]
// The same level, count and seed always give the same questions.
// Rates used: 2026 IRS mileage 72.5¢ (Jan–Jun) and 76¢ (Jul–Dec); FICA 6.2% + 1.45%;
// 2026 Social Security wage base $184,500; FUTA 0.6% of the first $7,000; 1099-NEC
// threshold $2,000 for 2026 payments; backup withholding 24%; SE tax 92.35% × 15.3%.
import { seededRandom, fmtMoney } from '../util.js';

// ---------------------------------------------------------------- helpers
const m = cents => fmtMoney(cents / 100);                  // 12345 → "$123.45"
// Exact rounding of num ÷ den to a whole cent, half up (num, den are non-negative integers),
// so no answer can be a cent off from floating-point error.
const div = (num, den) => Math.floor((2 * num + den) / (2 * den));
const pctOf = (cents, bp) => div(cents * bp, 10000);           // cents × basis points
const pct1 = (num, den) => `${(div(num * 1000, den) / 10).toFixed(1)}%`; // a percentage to one decimal
const fica = g => ({ ss: pctOf(g, 620), med: pctOf(g, 145) });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = d => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
const day2026 = (month, dayOfMonth) => new Date(Date.UTC(2026, month, dayOfMonth));
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const sum = a => a.reduce((s, x) => s + x, 0);
const VENDORS = ['Garden Gate Supply', 'Front Range Print Co.', 'Peak Office Supply', 'Mile High Electric', 'Cherry Creek Catering', 'Summit Hardware'];
const PEOPLE = ['Dana Ruiz', 'Sam Okafor', 'Lee Park', 'Jordan Blake', 'Riley Chen', 'Morgan Diaz'];

// ---------------------------------------------------------------- Professional
export const PRO = [
  { id: 'transposition', topic: 'Reconciling', make(R) {
    const h = R.int(1, 4), a = R.int(1, 9), b = R.int(0, a - 1), cc = R.step(0, 95, 5);
    const truth = (100 * h + 10 * a + b) * 100 + cc, booked = (100 * h + 10 * b + a) * 100 + cc, diff = truth - booked;
    const no = R.int(1100, 2400), vendor = R.pick(VENDORS);
    return { inputs: { truth, booked }, question: `Check #${no} to ${vendor} cleared the bank for ${m(truth)}, but it was entered in the books as ${m(booked)}. What's the fix, and what kind of error is it?`,
      answer: `Increase the payment in the books by ${m(diff)} — a transposition (${diff / 100} ÷ 9 = ${a - b})`,
      wrong: [`Increase the payment in the books by ${m(diff / 2)} — an amount posted on the wrong side`, `Decrease the payment in the books by ${m(diff)} — a transposition`],
      why: `The bank shows what really cleared: ${m(truth)} − ${m(booked)} = ${m(diff)} more was paid than the books show, so the payment goes up by ${m(diff)}. ${diff / 100} ÷ 9 = ${a - b} exactly — a difference that divides evenly by 9 is the classic sign of swapped digits.` };
  } },
  { id: 'reconciliation', topic: 'Reconciling', make(R) {
    const S = R.int(400000, 2500000), checks = Array.from({ length: R.int(2, 3) }, () => R.int(5000, 150000)), dit = R.int(20000, 400000);
    const out = sum(checks), adj = S - out + dit, first = R.int(1200, 1900);
    return { inputs: { S, checks, dit }, question: `The bank statement ends at ${m(S)}. Checks still outstanding: ${checks.map((c, i) => `#${first + i} ${m(c)}`).join(', ')}. A ${m(dit)} deposit made on the last day isn't on the statement yet. What is the adjusted bank balance?`,
      answer: m(adj), wrong: [m(S + out - dit), m(S - out)],
      why: `Adjusted bank balance = statement − outstanding checks + deposits in transit = ${m(S)} − ${m(out)} + ${m(dit)} = ${m(adj)}. It should equal the adjusted book balance.` };
  } },
  { id: 'net-pay', topic: 'Payroll', make(R) {
    const G = R.int(80000, 400000), fed = div(G * R.int(5, 12), 100), state = pctOf(G, 440), { ss, med } = fica(G);
    const net = G - fed - state - ss - med, who = R.pick(PEOPLE);
    return { inputs: { G, fed, state }, question: `${who}'s gross pay this period is ${m(G)}. Federal income tax withheld is ${m(fed)} and Colorado income tax withheld is ${m(state)}. Social Security is 6.2% and Medicare 1.45%. What is the net pay?`,
      answer: m(net), wrong: [m(G - fed - state), m(G - fed - state - ss)],
      why: `Employee FICA: ${m(G)} × 6.2% = ${m(ss)} Social Security and ${m(G)} × 1.45% = ${m(med)} Medicare. Net = ${m(G)} − ${m(fed)} − ${m(state)} − ${m(ss)} − ${m(med)} = ${m(net)}. Net pay plus every withholding adds back to the gross.` };
  } },
  { id: 'employer-cost', topic: 'Payroll', make(R) {
    const G = R.int(300000, 2000000), { ss, med } = fica(G), cost = G + ss + med;
    return { inputs: { G }, question: `Gross wages for this payroll total ${m(G)}. Not counting unemployment taxes, what does the payroll cost the business, including the employer's share of FICA?`,
      answer: m(cost), wrong: [m(G + ss), m(G)],
      why: `The employer matches FICA: ${m(G)} × 6.2% = ${m(ss)} Social Security plus ${m(G)} × 1.45% = ${m(med)} Medicare = ${m(ss + med)} (7.65%). Cost = ${m(G)} + ${m(ss + med)} = ${m(cost)}.` };
  } },
  { id: 'sales-tax-included', topic: 'Taxes', make(R) {
    const X = R.int(50000, 900000), bp = R.pick([290, 400, 775, 831, 881]), tax = div(X * bp, 10000 + bp), sales = X - tax;
    return { inputs: { X, bp }, question: `A market booth took in ${m(X)} this month, sales tax included, at a combined rate of ${bp / 100}%. How much sales tax does it owe?`,
      answer: m(tax), wrong: [m(pctOf(X, bp)), m(div(X * bp, 10000 - bp))],
      why: `The total includes the tax, so back it out: ${m(X)} ÷ ${1 + bp / 10000} = ${m(sales)} of sales, and ${m(X)} − ${m(sales)} = ${m(tax)} of tax (${m(X)} × ${bp / 100}% ÷ ${100 + bp / 100}%). Multiplying the tax-included total by the rate taxes the tax.` };
  } },
  { id: 'invoice-total', topic: 'Invoices & bills', make(R) {
    const qty = R.int(2, 12), rate = R.step(2500, 25000, 500), sub = qty * rate, disc = R.step(1000, Math.min(20000, sub - 500), 500), bp = R.pick([290, 400, 775, 831]);
    const taxable = sub - disc, tax = pctOf(taxable, bp), total = taxable + tax;
    return { inputs: { qty, rate, disc, bp }, question: `An invoice has ${qty} hours at ${m(rate)} an hour, a ${m(disc)} discount, and ${bp / 100}% sales tax charged on the discounted amount. What is the invoice total?`,
      answer: m(total), wrong: [m(taxable + pctOf(sub, bp)), m(sub + pctOf(sub, bp))],
      why: `Subtotal ${qty} × ${m(rate)} = ${m(sub)}; less the discount = ${m(taxable)}; tax ${m(taxable)} × ${bp / 100}% = ${m(tax)}; total ${m(taxable)} + ${m(tax)} = ${m(total)}. Tax goes on the amount after the discount.` };
  } },
  { id: 'gross-margin', topic: 'Advising', make(R) {
    const rev = R.int(2000000, 9000000), cogs = div(rev * R.int(350, 700), 1000), gp = rev - cogs;
    return { inputs: { rev, cogs }, question: `A shop's revenue for the quarter was ${m(rev)} and its cost of goods sold was ${m(cogs)}. What is its gross margin?`,
      answer: pct1(gp, rev), wrong: [pct1(gp, cogs), pct1(cogs, rev)],
      why: `Gross profit = ${m(rev)} − ${m(cogs)} = ${m(gp)}. Gross margin = gross profit ÷ revenue = ${m(gp)} ÷ ${m(rev)} = ${pct1(gp, rev)}. Dividing by cost instead gives the markup, not the margin.` };
  } },
  { id: 'net-margin', topic: 'Advising', make(R) {
    const rev = R.int(3000000, 9000000), cogs = div(rev * R.int(300, 500), 1000), opex = div(rev * R.int(200, 380), 1000), net = rev - cogs - opex;
    return { inputs: { rev, cogs, opex }, question: `Revenue ${m(rev)}, cost of goods sold ${m(cogs)}, operating expenses ${m(opex)}. What is the net profit margin?`,
      answer: pct1(net, rev), wrong: [pct1(rev - cogs, rev), pct1(net, rev - cogs)],
      why: `Net profit = ${m(rev)} − ${m(cogs)} − ${m(opex)} = ${m(net)}. Net margin = ${m(net)} ÷ ${m(rev)} = ${pct1(net, rev)}.` };
  } },
  { id: 'prepaid-remaining', topic: 'Month end', make(R) {
    const N = R.pick([6, 12]), monthly = R.step(4000, 60000, 500), P = N * monthly, M = R.int(2, N - 1), start = R.int(0, 12 - N);
    const left = P - M * monthly;
    return { inputs: { N, P, M }, question: `On ${MONTHS[start]} 1 a client paid ${m(P)} for a ${N}-month insurance policy starting that day and recorded it as Prepaid Expenses. After ${M} monthly adjusting entries, what should Prepaid Expenses show?`,
      answer: m(left), wrong: [m(M * monthly), m(P - monthly)],
      why: `Each month uses ${m(P)} ÷ ${N} = ${m(monthly)}. After ${M} months, ${M} × ${m(monthly)} = ${m(M * monthly)} has been expensed, leaving ${m(P)} − ${m(M * monthly)} = ${m(left)} prepaid.` };
  } },
  { id: 'depreciation-month', topic: 'Journal entries', make(R) {
    const years = R.pick([3, 5, 7, 10]), monthly = R.step(5000, 60000, 500), salvage = R.step(0, 1500000, 50000), cost = salvage + monthly * years * 12;
    return { inputs: { cost, salvage, years }, question: `Equipment cost ${m(cost)}, has a salvage value of ${m(salvage)} and a ${years}-year life, straight-line. What is the depreciation entry for one month?`,
      answer: m(monthly), wrong: [m(div(cost, years * 12)), m((cost - salvage) / years)],
      why: `(Cost − salvage) ÷ months of life = (${m(cost)} − ${m(salvage)}) ÷ ${years * 12} = ${m(monthly)} a month. Debit Depreciation Expense, credit Accumulated Depreciation.` };
  } },
  { id: 'owner-equity', topic: 'Business types', make(R) {
    const E = R.int(1000000, 8000000), NI = R.int(500000, 6000000), C = R.int(0, 1) ? R.step(50000, 1000000, 5000) : 0, D = R.step(200000, 4000000, 5000);
    const end = E + NI + C - D;
    return { inputs: { E, NI, C, D }, question: `A sole proprietor's equity was ${m(E)} at the start of the year. Net income was ${m(NI)}, the owner put in ${m(C)} and took ${m(D)} in draws. What is the owner's equity at year end?`,
      answer: m(end), wrong: [m(E + NI + C + D), m(E + C - D), m(E + NI - D)],
      why: `Ending equity = beginning + net income + contributions − draws = ${m(E)} + ${m(NI)} + ${m(C)} − ${m(D)} = ${m(end)}. Draws lower equity but aren't expenses.` };
  } },
  { id: 'days-to-pay', topic: 'Advising', make(R) {
    let d; do { d = [R.int(12, 60), R.int(12, 60), R.int(12, 60)]; } while (sum(d) % 3);
    const avg = sum(d) / 3, sent = d.map(() => day2026(R.int(0, 8), R.int(1, 28)));
    const lines = sent.map((s, i) => `sent ${longDate(s)}, paid ${longDate(new Date(+s + d[i] * 86400000))}`);
    const median = [...d].sort((a, b) => a - b)[1];
    return { inputs: { sent: sent.map(s => s.toISOString().slice(0, 10)), d }, question: `A client's last three invoices were ${lines.join('; ')}. On average, how many days does this client take to pay?`,
      answer: `${avg} days`, wrong: [`${avg + 1} days`, `${median} days`],
      why: `Days to pay: ${d.join(', ')}. Average = (${d.join(' + ')}) ÷ 3 = ${sum(d)} ÷ 3 = ${avg} days. Count from the invoice date to the payment date — not both days.` };
  } },
  { id: 'tax-set-aside', topic: 'Taxes', make(R) {
    const rev = R.int(2000000, 9000000), exp = div(rev * R.int(400, 750), 1000), profit = rev - exp, pct = R.pick([20, 25, 28, 30]), set = div(profit * pct, 100);
    return { inputs: { rev, exp, pct }, question: `For the quarter a sole proprietor had ${m(rev)} of income and ${m(exp)} of deductible expenses. They set aside ${pct}% of profit for estimated taxes. How much should they set aside?`,
      answer: m(set), wrong: [m(div(rev * pct, 100)), m(div(set, 4))],
      why: `Profit = ${m(rev)} − ${m(exp)} = ${m(profit)}. Set aside ${m(profit)} × ${pct}% = ${m(set)}. The percentage applies to profit, not to income, and this is already one quarter.` };
  } },
  { id: 'mileage', topic: 'Taxes', make(R) {
    const second = R.int(0, 1), when = second ? day2026(R.int(6, 11), R.int(1, 28)) : day2026(R.int(0, 5), R.int(1, 28));
    const each = R.int(8, 120), trips = R.int(1, 6), miles = 2 * each * trips, rate = second ? 76 : 72.5, other = second ? 72.5 : 76;
    const ded = div(miles * rate * 10, 10), one = div(each * trips * rate * 10, 10);
    return { inputs: { date: when.toISOString().slice(0, 10), each, trips }, question: `On ${longDate(when)} a bookkeeper drove to a client ${each} miles each way, ${trips === 1 ? 'one round trip' : `${trips} round trips`}. Using the 2026 IRS standard mileage rate for that date, what is the deduction?`,
      answer: m(ded), wrong: [m(div(miles * other * 10, 10)), m(one)],
      why: `Miles = ${each} × 2 × ${trips} = ${miles}. The 2026 rate is 72.5¢ through June 30 and 76¢ from July 1, so ${longDate(when)} uses ${rate}¢: ${miles} × $${(rate / 100).toFixed(3).replace(/0$/, '')} = ${m(ded)}.` };
  } },
  { id: 'form-1099', topic: 'Taxes', make(R) {
    const yes = R.int(0, 1) === 1;
    let checks, C, K;
    do {
      checks = Array.from({ length: R.int(2, 4) }, () => R.int(30000, 190000)); C = sum(checks);
    } while (yes ? C < 200000 : C >= 200000 || C < 60000);
    K = yes ? R.int(20000, 150000) : R.int(200000 - C, 200000 - C + 150000);
    const who = R.pick(['a sole-proprietor painter', 'a freelance web designer', 'a self-employed handyman', 'a sole-proprietor photographer']);
    const question = `In 2026 a client paid ${who} ${checks.map(m).join(', ')} by check and ACH, plus ${m(K)} by credit card. Does the client need to file a 1099-NEC?`;
    const answer = yes ? `Yes — the ${m(C)} paid by check or ACH is $2,000 or more` : `No — only the ${m(C)} paid by check or ACH counts, and it's under $2,000; the card company reports card payments on a 1099-K`;
    const wrong = yes ? ['No — no single payment reached $2,000', `No — only the ${m(K)} paid by card counts toward the threshold`] : [`Yes — the ${m(C + K)} total is $2,000 or more`, 'Yes — any contractor paid more than $600 needs one'];
    return { inputs: { checks, K, yes }, question, answer, wrong,
      why: `For payments made in 2026 the 1099-NEC threshold is $2,000, and card payments are left out (the card company reports them). Check and ACH total: ${checks.map(m).join(' + ')} = ${m(C)}, which is ${yes ? 'at least' : 'under'} $2,000 — so ${yes ? 'yes' : 'no'}.` };
  } }
];

// ---------------------------------------------------------------- Advanced
export const ADV = [
  { id: 'deferred-revenue', topic: 'Accrual accounting', make(R) {
    const N = R.pick([6, 12, 24]), monthly = R.step(5000, 80000, 500), P = N * monthly, M = R.int(2, N - 1), left = P - M * monthly;
    return { inputs: { N, P, M }, question: `A client received ${m(P)} up front for ${N} months of service starting the day it was paid. After ${M} months, how much should still be in Unearned Revenue?`,
      answer: m(left), wrong: [m(M * monthly), m(P)],
      why: `Revenue is earned evenly: ${m(P)} ÷ ${N} = ${m(monthly)} a month. After ${M} months ${m(M * monthly)} is earned, so ${m(P)} − ${m(M * monthly)} = ${m(left)} is still owed in service.` };
  } },
  { id: 'accrued-wages', topic: 'Prepaids & accruals', make(R) {
    const daily = R.int(20000, 250000), W = daily * 5, d = R.int(1, 4);
    return { inputs: { W, d }, question: `Payroll for a five-day work week is ${m(W)}. The month ends ${d} workday${d > 1 ? 's' : ''} after the last pay period closed, and those wages will be paid next month. How much should be accrued?`,
      answer: m(daily * d), wrong: [m(div(W * d, 7)), m(W)],
      why: `A workday costs ${m(W)} ÷ 5 = ${m(daily)}. ${d} × ${m(daily)} = ${m(daily * d)}: debit Payroll & Wages, credit Accrued Liabilities, reversing next month.` };
  } },
  { id: 'loan-split', topic: 'Loans', make(R) {
    let B, bp; do { B = R.step(10000, 90000, 100); bp = R.pick([600, 650, 700, 750, 800, 850, 900]); } while ((B * bp) % 1200);
    const interest = B * bp / 1200, P = R.step(Math.ceil(interest / 5000) * 5000 + 20000, Math.ceil(interest / 5000) * 5000 + 200000, 5000), principal = P - interest;
    return { inputs: { B, bp, P }, question: `A loan balance is ${m(B * 100)} at ${bp / 100}% annual interest, paid monthly. This month's payment is ${m(P)}. How much of it reduces the loan balance?`,
      answer: m(principal), wrong: [m(interest), m(P)],
      why: `Interest for the month = ${m(B * 100)} × ${bp / 100}% ÷ 12 = ${m(interest)}. Only the rest is principal: ${m(P)} − ${m(interest)} = ${m(principal)} reduces the loan; ${m(interest)} goes to Interest Expense.` };
  } },
  { id: 'cogs', topic: 'Inventory', make(R) {
    const b = R.int(1000000, 4000000), p = R.int(1500000, 6000000), e = R.int(800000, b + p - 500000);
    return { inputs: { b, p, e }, question: `Beginning inventory was ${m(b)}, purchases were ${m(p)}, and the ending count is ${m(e)}. What is the cost of goods sold?`,
      answer: m(b + p - e), wrong: [m(p + e - b), m(b + p)],
      why: `Cost of goods sold = beginning inventory + purchases − ending inventory = ${m(b)} + ${m(p)} − ${m(e)} = ${m(b + p - e)}.` };
  } },
  { id: 'shrinkage', topic: 'Inventory', make(R) {
    const B = R.step(1000000, 3000000, 500), d = R.step(20000, 150000, 500), C = B - d;
    return { inputs: { B, C }, question: `The books show inventory of ${m(B)}. The month-end physical count is ${m(C)}. What adjusting entry is needed?`,
      answer: `Debit Cost of Goods Sold ${m(d)}, credit Inventory ${m(d)}`, wrong: [`Debit Inventory ${m(d)}, credit Cost of Goods Sold ${m(d)}`, `Debit Cost of Goods Sold ${m(C)}, credit Inventory ${m(C)}`],
      why: `The count wins. ${m(B)} − ${m(C)} = ${m(d)} of inventory is gone (shrinkage), so lower Inventory by ${m(d)} and add it to Cost of Goods Sold.` };
  } },
  { id: 'book-value', topic: 'Fixed assets', make(R) {
    const years = R.pick([5, 7, 10]), monthly = R.step(10000, 80000, 500), salvage = R.step(100000, 1200000, 50000), cost = salvage + monthly * years * 12, months = R.int(6, years * 12 - 6);
    const acc = monthly * months;
    return { inputs: { cost, salvage, years, months }, question: `A truck cost ${m(cost)}, salvage value ${m(salvage)}, ${years}-year straight-line life. It has been in service ${months} months. What is its book value?`,
      answer: m(cost - acc), wrong: [m(cost - salvage - acc), m(acc)],
      why: `Monthly depreciation = (${m(cost)} − ${m(salvage)}) ÷ ${years * 12} = ${m(monthly)}. Accumulated: ${months} × ${m(monthly)} = ${m(acc)}. Book value = cost − accumulated depreciation = ${m(cost)} − ${m(acc)} = ${m(cost - acc)}.` };
  } },
  { id: 'gain-loss', topic: 'Fixed assets', make(R) {
    const years = R.pick([5, 7]), monthly = R.step(10000, 60000, 500), salvage = R.step(100000, 800000, 50000), cost = salvage + monthly * years * 12, months = R.int(12, years * 12 - 6);
    const bv = cost - monthly * months, S = Math.max(10000, bv + R.step(-300000, 300000, 2500)), gl = S - bv;
    if (gl === 0) return null;
    const label = v => (v >= 0 ? `Gain of ${m(v)}` : `Loss of ${m(-v)}`);
    return { inputs: { cost, salvage, years, months, S }, question: `Equipment that cost ${m(cost)} (salvage ${m(salvage)}, ${years}-year straight-line) is sold after ${months} months for ${m(S)}. What is the gain or loss on the sale?`,
      answer: label(gl), wrong: [label(S - cost), label(-gl)],
      why: `Accumulated depreciation = (${m(cost)} − ${m(salvage)}) ÷ ${years * 12} × ${months} = ${m(monthly * months)}, so book value = ${m(bv)}. Sale price − book value = ${m(S)} − ${m(bv)} = ${gl >= 0 ? 'a gain of ' + m(gl) : 'a loss of ' + m(-gl)}.` };
  } },
  { id: 'employer-fica', topic: 'Payroll compliance', make(R) {
    const G = R.int(500000, 3000000), { ss, med } = fica(G);
    return { inputs: { G }, question: `Gross wages for the month are ${m(G)}, all under the Social Security wage base. What is the employer's share of FICA?`,
      answer: m(ss + med), wrong: [m(ss), m(2 * (ss + med))],
      why: `Employer FICA = 6.2% Social Security + 1.45% Medicare: ${m(G)} × 6.2% = ${m(ss)}, ${m(G)} × 1.45% = ${m(med)}, total ${m(ss + med)} (7.65%). The employee pays a matching 7.65% out of their wages.` };
  } },
  { id: 'futa', topic: 'Payroll compliance', make(R) {
    const w = [R.int(250000, 650000), R.int(900000, 6000000), R.int(900000, 6000000)], capped = w.map(x => Math.min(x, 700000)), base = sum(capped);
    return { inputs: { w }, question: `For the year, three employees earned ${w.map(m).join(', ')}. The employer gets the full state credit, so the FUTA rate is 0.6% of each employee's first $7,000. What is the FUTA tax?`,
      answer: m(pctOf(base, 60)), wrong: [m(pctOf(sum(w), 60)), m(pctOf(base, 600))],
      why: `Taxable wages: ${capped.map(m).join(' + ')} = ${m(base)} (no more than $7,000 each). FUTA = ${m(base)} × 0.6% = ${m(pctOf(base, 60))}.` };
  } },
  { id: 'ss-wage-base', topic: 'Payroll compliance', make(R) {
    const P = R.int(400000, 1200000), Y = 18450000 - R.int(1000, P - 1000), taxable = 18450000 - Y;
    return { inputs: { P, Y }, question: `Before this paycheck an employee has earned ${m(Y)} in 2026. This paycheck is ${m(P)}. The 2026 Social Security wage base is $184,500. How much Social Security tax is withheld from this paycheck?`,
      answer: m(pctOf(taxable, 620)), wrong: [m(pctOf(P, 620)), m(pctOf(taxable, 765))],
      why: `Only ${m(18450000)} − ${m(Y)} = ${m(taxable)} of this paycheck is under the wage base. ${m(taxable)} × 6.2% = ${m(pctOf(taxable, 620))}. (Medicare has no wage base and still applies to the whole ${m(P)}.)` };
  } },
  { id: 'se-tax', topic: 'Owner taxes', make(R) {
    const N = R.int(2000000, 15000000), se = div(N * 9235 * 153, 10000000);
    return { inputs: { N }, question: `A sole proprietor's net profit is ${m(N)}. What is the self-employment tax?`,
      answer: m(se), wrong: [m(pctOf(N, 1530)), m(div(N * 9235 * 765, 100000000))],
      why: `SE tax is figured on 92.35% of net profit: ${m(N)} × 92.35% × 15.3% = ${m(se)} (rounded once at the end). 15.3% is both halves of FICA, because the owner is employer and employee.` };
  } },
  { id: 'safe-harbor', topic: 'Owner taxes', make(R) {
    const high = R.int(0, 1) === 1, A = high ? R.int(15100000, 40000000) : R.int(6000000, 14900000), T = div(A * R.int(80, 200), 1000); // tax 8–20% of AGI
    const need = high ? div(T * 11, 10) : T;
    return { inputs: { T, A }, question: `Last year a married couple filing jointly had AGI of ${m(A)} and total tax of ${m(T)}. Using the prior-year safe harbor, what is the least they can pay in estimated taxes this year (in four equal payments) to avoid the underpayment penalty?`,
      answer: m(need), wrong: [m(high ? T : div(T * 11, 10)), m(div(T * 9, 10))],
      why: `The prior-year safe harbor is 100% of last year's tax, or 110% when last year's AGI was over $150,000. AGI of ${m(A)} is ${high ? 'over' : 'not over'} $150,000, so ${high ? `${m(T)} × 110% = ${m(need)}` : `100% of ${m(T)} = ${m(need)}`}. (90% applies to this year's tax, not last year's.)` };
  } },
  { id: 'meals', topic: 'Business returns', make(R) {
    const M = R.int(40000, 600000), E = R.int(20000, 300000), ded = div(M, 2);
    return { inputs: { M, E }, question: `A business spent ${m(M)} on meals with clients and ${m(E)} on ball-game tickets to entertain clients. How much of this is deductible?`,
      answer: m(ded), wrong: [m(div(M + E, 2)), m(M)],
      why: `Business meals are 50% deductible: ${m(M)} × 50% = ${m(ded)}. Entertainment isn't deductible at all, so the ${m(E)} of tickets adds nothing.` };
  } },
  { id: 'backup-withholding', topic: '1099s & W-9s', make(R) {
    const P = R.step(50000, 800000, 500), w24 = pctOf(P, 2400), w28 = pctOf(P, 2800);
    return { inputs: { P }, question: `A contractor who won't provide a taxpayer ID number sends a ${m(P)} invoice. What should the client do?`,
      answer: `Withhold ${m(w24)} (24%), send it to the IRS, and pay the contractor ${m(P - w24)}`, wrong: [`Withhold ${m(w28)} (28%), send it to the IRS, and pay the contractor ${m(P - w28)}`, `Pay the full ${m(P)} and note the missing ID on the 1099`],
      why: `Without a valid TIN, backup withholding applies at 24%: ${m(P)} × 24% = ${m(w24)} goes to the IRS and ${m(P)} − ${m(w24)} = ${m(P - w24)} to the contractor. (28% was the old rate.)` };
  } },
  { id: 'cash-from-ops', topic: 'Closing & cash flow', make(R) {
    const NI = R.int(2000000, 9000000), dep = R.int(200000, 1500000), ar = R.int(100000, 1200000), inv = R.int(-600000, 900000), ap = R.int(50000, 800000);
    const cfo = NI + dep - ar - inv + ap;
    const sgn = (v, up, down) => (v >= 0 ? `${up} ${m(v)}` : `${down} ${m(-v)}`);
    return { inputs: { NI, dep, ar, inv, ap }, question: `Net income ${m(NI)}; depreciation ${m(dep)}; accounts receivable ${sgn(ar, 'rose', 'fell')}; inventory ${sgn(inv, 'rose', 'fell')}; accounts payable ${sgn(ap, 'rose', 'fell')}. What is cash from operating activities (indirect method)?`,
      answer: m(cfo), wrong: [m(NI - dep - ar - inv + ap), m(NI + dep + ar + inv - ap)],
      why: `Start with net income ${m(NI)}, add back depreciation (no cash left) ${m(dep)}, subtract increases in receivables and inventory (a decrease adds), add increases in payables: ${m(NI)} + ${m(dep)} − ${m(ar)} ${inv >= 0 ? '− ' + m(inv) : '+ ' + m(-inv)} + ${m(ap)} = ${m(cfo)}.` };
  } },
  { id: 'retained-earnings', topic: 'Closing & cash flow', make(R) {
    const b = R.int(2000000, 20000000), NI = R.int(-1500000, 9000000), d = R.step(100000, 4000000, 5000), end = b + NI - d;
    return { inputs: { b, NI, d }, question: `An S corporation's retained earnings were ${m(b)} at the start of the year. Net ${NI >= 0 ? 'income' : 'loss'} for the year was ${m(Math.abs(NI))} and it paid ${m(d)} in distributions. What are retained earnings at year end?`,
      answer: m(end), wrong: [m(b + NI + d), m(b + NI)],
      why: `Ending retained earnings = beginning + net income − distributions = ${m(b)} ${NI >= 0 ? '+' : '−'} ${m(Math.abs(NI))} − ${m(d)} = ${m(end)}.` };
  } },
  { id: 'sales-tax-payable', topic: 'Sales tax', make(R) {
    const B = R.int(30000, 400000), C = R.int(30000, 400000);
    return { inputs: { B, C }, question: `Sales Tax Payable started the month at ${m(B)} (last month's tax). During the month the business filed and paid that ${m(B)} and collected ${m(C)} of new sales tax. What should Sales Tax Payable show at month end?`,
      answer: m(C), wrong: [m(B + C), m(0)],
      why: `Sales Tax Payable = beginning + collected − paid = ${m(B)} + ${m(C)} − ${m(B)} = ${m(C)}. Paying the return clears last month's tax; this month's collections are still owed.` };
  } }
];

export const TEMPLATES = { pro: PRO, adv: ADV };

// ---------------------------------------------------------------- assembly
// One question from a template: keeps drawing until the right answer and two
// wrong ones are all different once formatted, then shuffles the options.
export function makeQuestion(template, R) {
  for (let i = 0; i < 100; i++) {
    const q = template.make(R);
    if (!q) continue;
    const wrong = [];
    for (const w of q.wrong) if (w !== q.answer && !wrong.includes(w)) wrong.push(w);
    if (wrong.length < 2) continue;
    const options = [q.answer, wrong[0], wrong[1]];
    for (let k = 2; k > 0; k--) { const j = R.int(0, k); [options[k], options[j]] = [options[j], options[k]]; }
    return { tpl: template.id, topic: template.topic, question: q.question, options, correct: options.indexOf(q.answer), why: q.why, inputs: q.inputs };
  }
  throw new Error(`template ${template.id} couldn't make distinct options`);
}

// `count` questions from different templates of a level, all from one seed.
export function generateSet(level, count, seed) {
  const list = TEMPLATES[level];
  if (!list || count > list.length) throw new Error(`can't generate ${count} ${level} questions`);
  const R = seededRandom(seed);
  const order = list.map((_, i) => i);
  for (let k = order.length - 1; k > 0; k--) { const j = R.int(0, k); [order[k], order[j]] = [order[j], order[k]]; }
  return order.slice(0, count).map(i => makeQuestion(list[i], R));
}
