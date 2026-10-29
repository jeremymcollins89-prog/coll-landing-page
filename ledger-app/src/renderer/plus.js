'use strict';
/* =====================================================================
   Coll Ledger — planning and cleanup math (no screen code here)
   Budget vs. actual, cash-flow forecast, mileage, owner pay and
   quarterly taxes, month-end summaries, receipt reading, cleanup scan.
   Adds to Core so the rest of the app (and the tests) can use it.
   ===================================================================== */
(function (root) {
  const C = typeof Core !== 'undefined' ? Core : require('./core.js');
  const { round2, todayISO, addDays, daysBetween, parseISO, isoOf, acct, acctByKey } = C;
  const sum = (arr, f = x => x) => round2(arr.reduce((s, x) => s + (f(x) || 0), 0));
  const monthStart = iso => iso.slice(0, 7) + '-01';
  const monthEnd = iso => { const d = parseISO(monthStart(iso)); return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  const addMonths = (iso, n) => { const d = parseISO(monthStart(iso)); return isoOf(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
  const monthsBetween = (from, to) => { const a = parseISO(from), b = parseISO(to); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1; };

  // ------------------------------------------------------------------
  // Mileage — IRS business standard mileage rates (dollars per mile)
  // 2026: 72.5¢ through June 30, 76¢ from July 1, 2026 (mid-year increase).
  // ------------------------------------------------------------------
  const MILEAGE_RATES = [
    ['2026-07-01', 0.76], ['2026-01-01', 0.725], ['2025-01-01', 0.70], ['2024-01-01', 0.67],
    ['2023-01-01', 0.655], ['2022-07-01', 0.625], ['2022-01-01', 0.585], ['2021-01-01', 0.56],
    ['2020-01-01', 0.575], ['2019-01-01', 0.58], ['2018-01-01', 0.545], ['1900-01-01', 0.535]
  ];
  const mileageRate = iso => (MILEAGE_RATES.find(([from]) => iso >= from) || MILEAGE_RATES[MILEAGE_RATES.length - 1])[1];
  const tripMiles = t => round2((+t.miles || 0) * (t.roundTrip ? 2 : 1));
  const tripValue = t => round2(tripMiles(t) * (t.rate || mileageRate(t.date)));
  function mileageSummary(c, from, to) {
    const trips = (c.trips || []).filter(t => (!from || t.date >= from) && (!to || t.date <= to)).sort((a, b) => b.date.localeCompare(a.date));
    return { trips, miles: sum(trips, tripMiles), value: sum(trips, tripValue), unposted: trips.filter(t => !t.postedId) };
  }

  // ------------------------------------------------------------------
  // Budget vs. actual. c.budgets = { accountId: monthlyAmount }
  // ------------------------------------------------------------------
  function budgetVsActual(c, from, to) {
    const months = Math.max(1, monthsBetween(from, to));
    const bal = C.balances(c, { from, to });
    const budgets = c.budgets || {};
    const rows = c.accounts.filter(a => (a.type === 'income' || a.type === 'expense') && !a.archived && a.key !== 'unc_inc' && a.key !== 'unc_exp')
      .map(a => {
        const actual = round2(bal.get(a.id) || 0), monthly = +budgets[a.id] || 0, budget = round2(monthly * months);
        // "good" is earning more than planned, or spending less
        const diff = round2(a.type === 'income' ? actual - budget : budget - actual);
        return { a, actual, monthly, budget, diff, pct: budget ? actual / budget : null };
      })
      .filter(r => r.monthly || Math.abs(r.actual) > 0.004)
      .sort((x, y) => x.a.code.localeCompare(y.a.code));
    const inc = rows.filter(r => r.a.type === 'income'), exp = rows.filter(r => r.a.type === 'expense');
    const t = list => ({ actual: sum(list, r => r.actual), budget: sum(list, r => r.budget) });
    const ti = t(inc), te = t(exp);
    return { months, income: inc, expense: exp, totals: { income: ti, expense: te, net: { actual: round2(ti.actual - te.actual), budget: round2(ti.budget - te.budget) } }, hasBudget: rows.some(r => r.monthly) };
  }
  // Suggested monthly budget: average of the last 3 full months
  function suggestBudget(c, accountId) {
    const end = addDays(monthStart(todayISO()), -1), start = addMonths(end, -2);
    const v = C.balances(c, { from: start, to: end }).get(accountId) || 0;
    return Math.round(v / 3);
  }

  // ------------------------------------------------------------------
  // Cash-flow forecast
  // ------------------------------------------------------------------
  const isBank = a => a && (a.sub === 'bank' || a.sub === 'clearing') && !a.archived;
  function typicalDaily(c, days = 90) {
    // Everyday money in/out that isn't invoices, bills or transfers — spread per day
    const since = addDays(todayISO(), -days);
    const banks = new Set(c.accounts.filter(isBank).map(a => a.id));
    const money = new Set(c.accounts.filter(C.isMoneyAccount).map(a => a.id));
    const first = c.transactions.filter(t => banks.has(t.accountId)).reduce((m, t) => (t.date < m ? t.date : m), todayISO());
    const span = Math.max(14, Math.min(days, daysBetween(first < since ? since : first, todayISO())));
    const list = c.transactions.filter(t => banks.has(t.accountId) && t.date > since && t.date <= todayISO() && t.status !== 'review' && !t.invoiceId && !t.billId && !money.has(t.categoryId));
    return round2(sum(list, t => t.amount) / span);
  }
  function forecast(c, { days = 90, typical = true } = {}) {
    const today = todayISO(), end = addDays(today, days);
    const bal = C.balances(c, { to: today });
    const start = sum(c.accounts.filter(isBank), a => bal.get(a.id));
    const events = [];
    for (const inv of c.invoices) {
      const s = C.invoiceState(c, inv);
      if (!['open', 'partial', 'overdue'].includes(s.status) || s.due <= 0) continue;
      const late = inv.dueDate < today;
      const who = (C.contact(c, inv.contactId) || {}).name || 'Customer';
      events.push({ date: late ? addDays(today, 7) : inv.dueDate, amount: s.due, label: `${who} · ${inv.number}`, kind: 'invoice', late, id: inv.id });
    }
    for (const b of c.bills || []) {
      const s = C.billState(c, b);
      if (!['open', 'soon', 'overdue'].includes(s.status) || s.due <= 0) continue;
      const who = (C.contact(c, b.vendorId) || {}).name || 'Vendor';
      events.push({ date: b.dueDate < today ? today : b.dueDate, amount: -s.due, label: `${who}${b.ref ? ' · ' + b.ref : ''}`, kind: 'bill', late: b.dueDate < today, id: b.id });
    }
    for (const r of c.recurring || []) {
      if (!r.active) continue;
      const amt = r.kind === 'invoice' ? C.invoiceTotals(r.template).total : C.billTotal(r.template);
      const who = (C.contact(c, r.kind === 'invoice' ? r.template.contactId : r.template.vendorId) || {}).name || (r.kind === 'invoice' ? 'Repeating invoice' : 'Repeating bill');
      let d = r.next, g = 0;
      while (d <= end && g++ < 60) {
        const paid = addDays(d, r.template.terms || 0);
        if (paid <= end && paid >= today) events.push({ date: paid, amount: r.kind === 'invoice' ? amt : -amt, label: `${who} (repeats)`, kind: r.kind === 'invoice' ? 'recur-in' : 'recur-out' });
        d = C.nextDate(d, r.every);
      }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    const daily = typical ? typicalDaily(c) : 0;
    const series = [];
    let run = start, low = { date: today, bal: start };
    for (let i = 0; i <= days; i++) {
      const d = addDays(today, i);
      if (i > 0) run += daily;
      for (const e of events) if (e.date === d) run += e.amount;
      run = round2(run);
      series.push({ date: d, bal: run });
      if (run < low.bal) low = { date: d, bal: run };
    }
    return { start: round2(start), end: run, low, daily, events, series, in: sum(events.filter(e => e.amount > 0), e => e.amount), out: sum(events.filter(e => e.amount < 0), e => -e.amount) };
  }

  // ------------------------------------------------------------------
  // Owner pay and quarterly estimated taxes
  // IRS periods: Jan–Mar (due Apr 15), Apr–May (Jun 15), Jun–Aug (Sep 15),
  // Sep–Dec (Jan 15 next year). Due dates on a weekend or federal holiday move to the next business day.
  // ------------------------------------------------------------------
  // Holidays that can land on an estimated-tax due date: Martin Luther King Jr. Day (third Monday of
  // January) and DC Emancipation Day (April 16, observed Friday/Monday), which the IRS treats as a legal holiday.
  const isHoliday = d => {
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), wd = d.getDay();
    if (m === 0 && wd === 1 && day >= 15 && day <= 21) return true;
    if (m === 3) { const e = new Date(y, 3, 16).getDay(); const obs = e === 6 ? 15 : e === 0 ? 17 : 16; if (day === obs) return true; }
    return false;
  };
  const nextBusinessDay = iso => { let d = parseISO(iso); while (d.getDay() === 0 || d.getDay() === 6 || isHoliday(d)) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); return isoOf(d); };
  function taxQuarters(c, year) {
    const est = c.estTax || {};
    const pct = est.pct == null ? 25 : +est.pct;
    const Q = [['Q1', `${year}-01-01`, `${year}-03-31`, `${year}-04-15`], ['Q2', `${year}-04-01`, `${year}-05-31`, `${year}-06-15`],
      ['Q3', `${year}-06-01`, `${year}-08-31`, `${year}-09-15`], ['Q4', `${year}-09-01`, `${year}-12-31`, `${year + 1}-01-15`]];
    const today = todayISO();
    return Q.map(([q, from, to, due]) => {
      const profit = C.profitLoss(c, from, to < today ? to : today).net;
      const started = from <= today, done = to < today;
      const setAside = started ? round2(Math.max(0, profit) * pct / 100) : 0;
      const paid = +((est.paid || {})[`${year}-${q}`]) || 0;
      return { q, from, to, due: nextBusinessDay(due), profit: started ? profit : 0, setAside, paid, left: round2(Math.max(0, setAside - paid)), started, done };
    });
  }
  function ownerPay(c, from, to) {
    const draw = acctByKey(c, 'draw'), contrib = acctByKey(c, 'contrib');
    const bal = C.balances(c, { from, to });
    const draws = draw ? round2(bal.get(draw.id) || 0) : 0; // equity is credit-normal: draws show negative
    const contribs = contrib ? round2(bal.get(contrib.id) || 0) : 0;
    const monthly = [];
    for (let m = monthStart(from); m <= to; m = addMonths(m, 1)) {
      const e = monthEnd(m) < to ? monthEnd(m) : to;
      const b = C.balances(c, { from: m, to: e });
      monthly.push({ month: m.slice(0, 7), draws: draw ? -round2(b.get(draw.id) || 0) : 0, contribs: contrib ? round2(b.get(contrib.id) || 0) : 0 });
    }
    return { taken: round2(-draws), put: contribs, monthly };
  }
  // A cautious "you could pay yourself about this much" number
  function safeToPay(c) {
    const today = todayISO();
    const f = forecast(c, { days: 30, typical: false });
    const billsSoon = sum(f.events.filter(e => e.amount < 0), e => -e.amount);
    const y = +today.slice(0, 4);
    const taxLeft = sum(taxQuarters(c, y).filter(q => q.started), q => q.left);
    const pl = C.profitLoss(c, addMonths(monthStart(today), -3), addDays(monthStart(today), -1));
    const cushion = round2(Math.max(0, (pl.totalCogs + pl.totalExpense + pl.totalOtherExpense) / 3));
    return { cash: f.start, billsSoon, taxLeft, cushion, amount: round2(Math.max(0, f.start - billsSoon - taxLeft - cushion)) };
  }

  // ------------------------------------------------------------------
  // Month-end summary for the client
  // ------------------------------------------------------------------
  function monthSummary(c, month /* 'YYYY-MM' */) {
    const from = month + '-01', to = monthEnd(from);
    const prevFrom = addMonths(from, -1), prevTo = monthEnd(prevFrom);
    const pl = C.profitLoss(c, from, to), prev = C.profitLoss(c, prevFrom, prevTo);
    const bal = C.balances(c, { to });
    const cash = sum(c.accounts.filter(isBank), a => bal.get(a.id));
    const cards = sum(c.accounts.filter(a => a.sub === 'credit' && !a.archived), a => bal.get(a.id));
    const ar = acctByKey(c, 'ar'), ap = acctByKey(c, 'ap');
    const top = [...pl.cogs, ...pl.expense, ...pl.otherExpense].filter(x => x.a.key !== 'unc_exp' && x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
    return { month, from, to, income: pl.totalIncome + pl.totalOtherIncome, expenses: round2(pl.totalCogs + pl.totalExpense + pl.totalOtherExpense), net: pl.net, prevNet: prev.net,
      cash, cards, owedToThem: ar ? round2(bal.get(ar.id) || 0) : 0, theyOwe: ap ? round2(bal.get(ap.id) || 0) : 0, top,
      review: c.transactions.filter(t => t.status === 'review' && t.date <= to).length };
  }

  // ------------------------------------------------------------------
  // Reading a receipt's text (from the photo reader or a PDF)
  // ------------------------------------------------------------------
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function receiptDate(text) {
    const today = todayISO(), found = [];
    const ok = (y, m, d) => { if (y < 100) y += 2000; const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const dt = parseISO(iso); if (dt.getMonth() + 1 === m && dt.getDate() === d && iso <= addDays(today, 3) && y >= 2000) found.push(iso); };
    let m;
    const r1 = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g; while ((m = r1.exec(text))) ok(+m[3], +m[1], +m[2]);
    const r2 = /\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g; while ((m = r2.exec(text))) ok(+m[1], +m[2], +m[3]);
    const r3 = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi; while ((m = r3.exec(text))) ok(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    const r4 = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi; while ((m = r4.exec(text))) ok(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    return found[0] || null;
  }
  function receiptTotal(text) {
    const lines = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const amt = s => { const all = [...String(s).matchAll(/(?:^|[^\d.])\$?\s?(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?![\d%])/g)].map(x => parseFloat(x[1].replace(/,/g, ''))); return all.length ? all[all.length - 1] : null; };
    const score = l => {
      const s = l.toLowerCase();
      if (/sub\s*-?\s*total|tax\b|tip\b|change|savings|you saved|discount|points|balance forward/.test(s) && !/grand\s*total|total\s*(due|paid|charged)/.test(s)) return 0;
      if (/grand\s*total|amount\s*(due|paid|charged)|total\s*(due|paid|charged|amount)|balance\s*due/.test(s)) return 3;
      if (/\btotal\b/.test(s)) return 2;
      if (/\b(visa|mastercard|amex|discover|debit|credit|charged|paid)\b/.test(s)) return 1;
      return 0;
    };
    let best = null;
    lines.forEach((l, i) => {
      const sc = score(l); if (!sc) return;
      let v = amt(l); if (v == null && lines[i + 1]) v = amt(lines[i + 1]);
      if (v == null || v <= 0) return;
      if (!best || sc > best.sc || (sc === best.sc && v > best.v)) best = { sc, v };
    });
    if (best) return round2(best.v);
    const all = lines.map(amt).filter(v => v != null && v > 0);
    return all.length ? round2(Math.max(...all)) : null;
  }
  function receiptVendor(c, text) {
    const lines = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const body = String(text).toLowerCase();
    // A vendor she already has wins
    const known = (c.contacts || []).filter(x => x.kind !== 'customer' && x.name && x.name.length > 2).sort((a, b) => b.name.length - a.name.length);
    for (const v of known) if (body.includes(v.name.toLowerCase())) return { name: v.name, id: v.id };
    for (const l of lines.slice(0, 6)) {
      if (/^(receipt|invoice|order|thank|welcome|store|tel|phone|www\.|http)/i.test(l)) continue;
      if (/\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(l) || /\b\d{5}(-\d{4})?\b/.test(l) && /\b[A-Z]{2}\b/.test(l)) continue;
      const letters = l.replace(/[^a-z]/gi, '');
      if (letters.length < 3) continue;
      const name = l.replace(/[#*]+\s*\d+.*/, '').replace(/\s{2,}/g, ' ').trim();
      if (name.length >= 3) return { name: C.cleanPayee(name) || name, id: null };
    }
    return { name: '', id: null };
  }
  function readReceipt(c, text) {
    const v = receiptVendor(c, text);
    return { date: receiptDate(text), amount: receiptTotal(text), vendor: v.name, vendorId: v.id };
  }
  // Find a bank or card transaction that is probably this receipt
  function matchReceipt(c, r) {
    if (!r.amount) return [];
    return c.transactions.filter(t => C.isMoneyAccount(acct(c, t.accountId)) && Math.round(Math.abs(t.amount) * 100) === Math.round(r.amount * 100) && t.amount < 0)
      .map(t => ({ t, gap: r.date ? Math.abs(daysBetween(r.date, t.date)) : 99 }))
      .filter(x => x.gap <= 7 || !r.date)
      .sort((a, b) => a.gap - b.gap).slice(0, 4).map(x => x.t);
  }

  // ------------------------------------------------------------------
  // Clean-up scan
  // ------------------------------------------------------------------
  function cleanupScan(c, { from } = {}) {
    const ok = new Set(c.cleanupOk || []);
    const today = todayISO();
    const since = from || C.fyStart(c, today);
    const out = [];
    const push = (type, key, data) => { if (!ok.has(key)) out.push({ type, key, ...data }); };
    const txns = c.transactions.filter(t => t.date >= addDays(since, -10));
    const uncInc = acctByKey(c, 'unc_inc'), uncExp = acctByKey(c, 'unc_exp');
    const money = new Set(c.accounts.filter(C.isMoneyAccount).map(a => a.id));
    // 1. Possible duplicates
    const byAmt = new Map();
    for (const t of txns) { if (!t.amount) continue; const k = t.accountId + '|' + round2(t.amount); if (!byAmt.has(k)) byAmt.set(k, []); byAmt.get(k).push(t); }
    for (const list of byAmt.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (daysBetween(a.date, b.date) > 3) break;
        const ka = C.keyOf(a.payee || a.description), kb = C.keyOf(b.payee || b.description);
        const same = ka && kb && (ka === kb || ka.split(' ')[0] === kb.split(' ')[0]);
        if (!same) continue;
        if (a.importId && b.importId && a.importId === b.importId && a.fitid && b.fitid && a.fitid !== b.fitid) continue;
        if (a.date < since && b.date < since) continue;
        push('dup', `dup:${[a.id, b.id].sort().join(':')}`, { a, b });
      }
    }
    // 2. Uncategorized
    for (const t of c.transactions) {
      if (t.status === 'review' || t.date < since) continue;
      const split = Array.isArray(t.splits) && t.splits.length;
      const unc = split ? t.splits.some(s => !s.categoryId || s.categoryId === (uncInc || {}).id || s.categoryId === (uncExp || {}).id)
        : (!t.categoryId || t.categoryId === (uncInc || {}).id || t.categoryId === (uncExp || {}).id);
      if (unc) push('unc', `unc:${t.id}`, { t });
    }
    // 3. Waiting in To Review for over 30 days
    for (const t of c.transactions) if (t.status === 'review' && daysBetween(t.date, today) > 30) push('stale', `stale:${t.id}`, { t });
    // 4. Unusually large for that payee
    const byPayee = new Map();
    for (const t of c.transactions) { if (t.status === 'review' || t.amount >= 0 || money.has(t.categoryId)) continue; const k = C.keyOf(t.payee || t.description); if (!k) continue; if (!byPayee.has(k)) byPayee.set(k, []); byPayee.get(k).push(t); }
    for (const list of byPayee.values()) {
      if (list.length < 4) continue;
      const vals = list.map(t => -t.amount).sort((a, b) => a - b);
      const med = vals[Math.floor(vals.length / 2)];
      for (const t of list) if (t.date >= since && -t.amount > Math.max(med * 3, med + 100)) push('odd', `odd:${t.id}`, { t, typical: med });
    }
    // 5. Travel, meals, lodging and gifts of $75 or more without a receipt
    //    (the IRS asks for receipts on these at $75 and up)
    const needsReceipt = a => a && a.type === 'expense' && /meal|travel|lodg|hotel|gift|entertain/i.test(a.name);
    for (const t of c.transactions) {
      if (t.status === 'review' || t.date < since || t.amount > -75 || money.has(t.categoryId) || t.billId) continue;
      if (!needsReceipt(acct(c, t.categoryId))) continue;
      if (!(t.attachments || []).length) push('receipt', `receipt:${t.id}`, { t });
    }
    // 6. Invoices unpaid for over 90 days
    for (const inv of c.invoices) {
      const s = C.invoiceState(c, inv);
      if (s.status === 'overdue' && daysBetween(inv.dueDate, today) > 90) push('aged', `aged:${inv.id}`, { inv, s });
    }
    return out;
  }

  Object.assign(C, { MILEAGE_RATES, mileageRate, tripMiles, tripValue, mileageSummary, budgetVsActual, suggestBudget, typicalDaily, forecast,
    taxQuarters, ownerPay, safeToPay, monthSummary, receiptDate, receiptTotal, receiptVendor, readReceipt, matchReceipt, cleanupScan,
    monthStart, monthEnd, addMonths, nextBusinessDay });
  if (typeof module !== 'undefined') module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
