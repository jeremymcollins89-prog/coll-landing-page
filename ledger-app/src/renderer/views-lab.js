'use strict';
/* =====================================================================
   Coll Ledger Academy — Study center
   - Study plan: a day-by-day schedule from hours per day, plus a streak
   - Daily review: spaced-repetition flashcards from finished lessons
   - Case studies and client emails (views-cases.js)
   - Cheat sheets: printable one-page references
   - Portfolio: a work-sample PDF built from the practical exams
   - Exam integrity: honor statement; three tries in a row, then a 24-hour wait
   ===================================================================== */
(() => {
  const { S, C, U, act, go, render, save } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;
  const T = () => { S.data.training = S.data.training || {}; const t = S.data.training; t.done = t.done || {}; t.quiz = t.quiz || {}; t.flags = t.flags || {}; t.lab = t.lab || {}; const L = t.lab; L.cards = L.cards || {}; L.reviewDays = L.reviewDays || {}; L.plan = L.plan || { hours: 3, days: 5 }; L.cases = L.cases || {}; L.emails = L.emails || {}; return t; };
  const P = () => App.practice;
  const UI = () => { S.ui.lab = S.ui.lab || { tab: 'plan' }; return S.ui.lab; };

  // ------------------------------------------------------------------
  // Exam integrity
  // ------------------------------------------------------------------
  const WAIT = 24 * 60 * 60 * 1000, TRIES = 3;
  const fmtWait = ms => { const all = Math.ceil(ms / 60000), h = Math.floor(all / 60), m = all % 60; return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`; };
  // Three tries in a row at any quiz or exam; after the third miss, a 24-hour wait. A pass resets the count.
  const tries = {
    st(key) { const t = T(); t.tries = t.tries || {}; let x = t.tries[key] || { fails: 0, lockUntil: 0 }; if (x.lockUntil && x.lockUntil <= Date.now()) x = { fails: 0, lockUntil: 0 }; t.tries[key] = x; return x; },
    lockMs(key) { const x = this.st(key); return x.lockUntil ? Math.max(0, x.lockUntil - Date.now()) : 0; },
    left(key) { return this.lockMs(key) ? 0 : TRIES - this.st(key).fails; },
    record(key, passed) { const x = this.st(key); if (passed) { x.fails = 0; x.lockUntil = 0; } else { x.fails++; if (x.fails >= TRIES) { x.fails = 0; x.lockUntil = Date.now() + WAIT; } } save(); return x; },
    blocked(key, what) { const w = this.lockMs(key); if (w) { U.toast(`${what} opens again in ${fmtWait(w)} — a good time to review`, null, 'warn'); return true; } return false; },
    line(key) { const w = this.lockMs(key), l = this.left(key); return w ? `<b>Locked for ${fmtWait(w)}</b> after three tries in a row — review, then come back.` : `${l} of ${TRIES} tries left before a 24-hour break.`; },
    afterMiss(key) { const w = this.lockMs(key); return w ? `That was your third try in a row — the next one opens in ${fmtWait(w)}.` : `${plural(this.left(key), 'try', 'tries')} left before a 24-hour break.`; }
  };
  App.tries = tries;
  App.examRulesNote = key => `<div class="honor-note">${ICON.lock}<div><b>Exam rules</b><div class="muted">Work on your own. A calculator and scratch paper are fine; notes, the Handbook, other people and AI tools are not. You get three tries in a row; after the third, there's a 24-hour break before the next one — use it to review. ${tries.line(key)}</div></div></div>`;
  App.examGate = (key, list, title, start) => {
    if (tries.blocked(key, title)) return;
    const m = U.openModal(`${U.modalHead(title, 'Before you begin')}
      <div class="modal-body"><div class="honor">
        <p>This exam is how your certificate earns trust, so it only counts if it's your own work.</p>
        <ul><li>I'll answer on my own, without help from another person or an AI tool.</li><li>I'll use only a calculator and scratch paper — no notes, Handbook or lessons while the exam is open.</li><li>I won't share the questions or answers.</li></ul>
        <label class="check"><input type="checkbox" id="hn-ok"> I agree to these rules</label>
        <div class="field" style="margin-top:12px"><label for="hn-name">Type your full name to sign</label><input id="hn-name" class="input" autocomplete="off" value=""></div>
      </div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Not now</button><button class="btn primary" id="hn-go" disabled>Start the exam</button></div>`);
    const ok = $('#hn-ok', m), nm = $('#hn-name', m), go2 = $('#hn-go', m);
    const upd = () => { go2.disabled = !(ok.checked && nm.value.trim().length >= 3); };
    ok.onchange = upd; nm.oninput = upd;
    go2.onclick = () => { const t = T(); t.honor = t.honor || []; t.honor.push({ exam: key, name: nm.value.trim(), at: Date.now() }); save(); U.closeModal(); start(); };
  };

  // ------------------------------------------------------------------
  // Study days, streak
  // ------------------------------------------------------------------
  function studyDays() {
    const t = T(), d = new Set();
    Object.values(t.done).forEach(v => typeof v === 'string' && d.add(v.slice(0, 10)));
    (t.written || []).concat(t.advWritten || []).forEach(w => w.date && d.add(w.date));
    Object.keys(t.lab.reviewDays).forEach(k => d.add(k));
    Object.values(t.lab.cases).forEach(x => x && x.date && d.add(x.date));
    Object.values(t.lab.emails).forEach(x => x && x.date && d.add(x.date));
    return d;
  }
  function streak() {
    const d = studyDays(); let n = 0, cur = today();
    if (!d.has(cur)) cur = C.addDays(cur, -1);
    while (d.has(cur)) { n++; cur = C.addDays(cur, -1); }
    return n;
  }

  // ------------------------------------------------------------------
  // Study plan
  // ------------------------------------------------------------------
  const DAYSETS = { 3: [1, 3, 5], 4: [1, 2, 3, 4], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  function planItems() {
    const t = T(), p = P(), done = l => !!t.done[l.id];
    const A = App.academy, AV = App.advanced, items = [];
    const proW = A && A.writtenPassed && A.writtenPassed(), proP = A && A.practicalPassed && A.practicalPassed();
    p.CORE.filter(l => !done(l)).forEach(l => items.push({ label: l.title, mins: p.workMins(l), kind: 'pro' }));
    if (!proW) { items.push({ label: 'Review the Handbook and missed questions', mins: 60, kind: 'pro' }); items.push({ label: 'Professional written exam', mins: 60, kind: 'exam', fresh: true }); }
    if (!proP) items.push({ label: 'Professional practical: Juniper Flower Co.', mins: 120, kind: 'exam', fresh: true, milestone: 'Professional certificate' });
    p.ADV.filter(l => !done(l)).forEach(l => items.push({ label: l.title, mins: p.workMins(l), kind: 'adv' }));
    const advW = AV && AV.writtenPassed(), advP = AV && AV.practicalPassed();
    if (!advW) { items.push({ label: 'Review for the advanced exam', mins: 60, kind: 'adv' }); items.push({ label: 'Advanced written exam', mins: 75, kind: 'exam', fresh: true }); }
    if (!advP) items.push({ label: 'Advanced practical: Aspen Trail Outfitters', mins: 120, kind: 'exam', fresh: true, milestone: 'Advanced certificate' });
    const LC = App.labCases;
    if (LC) {
      LC.CASES.filter(cs => !(t.lab.cases[cs.id] && t.lab.cases[cs.id].passed)).forEach(cs => items.push({ label: 'Case study: ' + cs.title, mins: cs.mins || 60, kind: 'lab' }));
      LC.EMAILS.filter(e => !(t.lab.emails[e.id] && t.lab.emails[e.id].done)).forEach(e => items.push({ label: 'Client email: ' + e.title, mins: 15, kind: 'lab' }));
    }
    return items;
  }
  function buildPlan() {
    const L = T().lab, cap = Math.max(30, (+L.plan.hours || 3) * 60), set = DAYSETS[+L.plan.days || 5] || DAYSETS[5];
    const review = 10; // minutes of daily review at the start of each day
    const items = planItems(), days = [];
    let d = today(), day = null;
    const open = () => { while (!set.includes(C.parseISO(d).getDay())) d = C.addDays(d, 1); day = { date: d, items: [{ label: 'Daily review (flashcards)', mins: review, kind: 'review' }], used: review }; days.push(day); d = C.addDays(d, 1); };
    open();
    for (const it of items) {
      const fits = day.used + it.mins <= cap + 5;
      const needFresh = it.fresh && day.items.length > 1;
      if (!fits || needFresh) open();
      day.items.push(it); day.used += it.mins;
    }
    return days;
  }
  function renderPlan() {
    const L = T().lab, days = buildPlan(), total = days.reduce((s, x) => s + x.used, 0), st = streak();
    const ms = days.flatMap(x => x.items.filter(i => i.milestone).map(i => ({ date: x.date, m: i.milestone })));
    const fmtM = m => P().fmtMins(m);
    const wd = iso => C.parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `<div class="lab-grid">
      <div class="card lab-side"><div class="card-body">
        <div class="streak"><div class="streak-n">${st}</div><div><b>day${st === 1 ? '' : 's'} in a row</b><div class="muted">${st ? 'Keep it going — even 10 minutes of review counts.' : 'Study today to start a streak.'}</div></div></div>
        <div class="cap-label" style="margin-top:16px">Your schedule</div>
        <div class="field"><label for="lp-h">Hours per study day</label><select id="lp-h" class="input" data-change="lab-plan" data-k="hours">${[1, 1.5, 2, 3, 4, 5, 6].map(h => `<option value="${h}" ${+L.plan.hours === h ? 'selected' : ''}>${String(h).replace('.5', '½')} hour${h === 1 ? '' : 's'}</option>`).join('')}</select></div>
        <div class="field"><label for="lp-d">Study days per week</label><select id="lp-d" class="input" data-change="lab-plan" data-k="days">${[[3, 'Mon, Wed, Fri'], [4, 'Mon–Thu'], [5, 'Mon–Fri'], [6, 'Mon–Sat'], [7, 'Every day']].map(([v, l]) => `<option value="${v}" ${+L.plan.days === v ? 'selected' : ''}>${v} days (${l})</option>`).join('')}</select></div>
        <div class="plan-sum"><div><span>Study time left</span><b>${fmtM(total)}</b></div><div><span>Study days</span><b>${days.length}</b></div>${ms.map(x => `<div><span>${esc(x.m)}</span><b>${wd(x.date)}</b></div>`).join('')}${days.length ? `<div><span>Everything done</span><b>${wd(days[days.length - 1].date)}</b></div>` : ''}</div>
        <p class="muted" style="font-size:12px;margin:12px 0 0">Exams are scheduled at the start of a fresh day — you'll make fewer careless mistakes. Each day starts with 10 minutes of review so what you learned yesterday sticks.</p>
      </div></div>
      <div class="plan-days">${days.slice(0, 40).map((x, i) => `<div class="plan-day ${x.date === today() ? 'today' : ''}"><div class="pd-head"><b>${x.date === today() ? 'Today' : wd(x.date)}</b><span class="muted">Day ${i + 1} · ${fmtM(x.used)}</span></div>${x.items.map(it => `<div class="pd-item ${it.kind}"><span class="dot"></span><span class="grow">${esc(it.label)}${it.milestone ? ` <span class="tag gold">${esc(it.milestone)}</span>` : ''}</span><span class="muted">${fmtM(it.mins)}</span></div>`).join('')}</div>`).join('')}${days.length > 40 ? `<p class="muted">…and ${days.length - 40} more days.</p>` : ''}</div>
    </div>`;
  }

  // ------------------------------------------------------------------
  // Daily review — Leitner boxes: 1, 2, 4, 7, 14, 30 days
  // ------------------------------------------------------------------
  const GAPS = [1, 2, 4, 7, 14, 30], NEW_PER_DAY = 10, SESSION = 15;
  function allCards() {
    const t = T(), out = [];
    for (const l of P().LESSONS) {
      if (!t.done[l.id]) continue;
      (l.words || []).forEach(([w, d], i) => out.push({ id: `w:${l.id}:${i}`, lesson: l.title, front: w, back: d, kind: 'Term' }));
      (l.quiz || []).forEach((q, i) => out.push({ id: `q:${l.id}:${i}`, lesson: l.title, front: q.q, back: q.a[q.c], why: q.why, kind: 'Question' }));
    }
    return out;
  }
  function dueCards() {
    const cards = allCards(), st = T().lab.cards, td = today();
    const due = cards.filter(c => st[c.id] && st[c.id].due <= td);
    const fresh = cards.filter(c => !st[c.id]).slice(0, Math.max(0, NEW_PER_DAY - Object.values(st).filter(x => x.added === td).length));
    return { cards, due, fresh, queue: due.concat(fresh).slice(0, SESSION) };
  }
  function renderReview() {
    const U2 = UI(), t = T(), info = dueCards();
    if (!info.cards.length) return `<div class="card"><div class="empty"><div class="big">Your review deck fills as you finish lessons</div>Every lesson adds its key terms and quiz questions. Finish a lesson in the Academy, then come back for a 5-minute review.<div style="margin-top:14px"><button class="btn primary" data-nav="training">Go to the Academy</button></div></div></div>`;
    const R = U2.review;
    const mastered = Object.values(t.lab.cards).filter(x => x.box >= 4).length;
    const stats = `<div class="rv-stats"><div><b>${info.cards.length}</b><span>cards in your deck</span></div><div><b>${info.due.length}</b><span>due today</span></div><div><b>${mastered}</b><span>mastered (2+ weeks)</span></div><div><b>${streak()}</b><span>day streak</span></div></div>`;
    if (!R) return `<div class="card"><div class="card-body">${stats}
      <p class="tm-learn" style="margin-top:14px">Five minutes a day beats an hour of cramming. Cards you know come back less and less often (1, 2, 4, 7, 14, then 30 days); cards you miss come back tomorrow.</p>
      <div class="tm-nav"><span></span>${info.queue.length ? `<button class="btn primary" data-action="lab-rv-start">Start today's review · ${plural(info.queue.length, 'card')} ${ICON.right}</button>` : `<span class="tag green">${ICON.check}All caught up for today</span>`}</div></div></div>`;
    if (R.at >= R.ids.length) {
      return `<div class="card"><div class="card-body"><div class="exam-result pass"><div class="er-score">${R.right}<span>/ ${R.ids.length}</span></div><div><h2 class="tm-title" style="margin:0">Review done</h2><div class="muted">${R.right === R.ids.length ? 'Perfect — those cards move further out.' : 'The ones you missed come back tomorrow.'}</div></div></div>${stats}<div class="tm-nav"><span></span><button class="btn primary" data-action="lab-rv-close">Done</button></div></div></div>`;
    }
    const card = info.cards.find(c => c.id === R.ids[R.at]);
    if (!card) { R.at++; return renderReview(); }
    return `<div class="card"><div class="card-body">
      <div class="tm-head"><span class="tag ${card.kind === 'Term' ? 'blue' : 'navy'}">${card.kind}</span><span class="muted">Card ${R.at + 1} of ${R.ids.length} · ${esc(card.lesson)}</span></div>
      <div class="progress" style="margin:6px 0 18px"><div style="width:${(R.at / R.ids.length * 100).toFixed(1)}%"></div></div>
      <div class="flash ${R.show ? 'show' : ''}"><div class="fl-front">${esc(card.front)}</div>${R.show ? `<div class="fl-back"><b>${esc(card.back)}</b>${card.why ? `<div class="muted">${esc(card.why)}</div>` : ''}</div>` : `<div class="muted fl-hint">${card.kind === 'Term' ? 'Say the meaning out loud, then check.' : 'Answer in your head, then check.'}</div>`}</div>
      <div class="tm-nav">${R.show ? `<button class="btn" data-action="lab-rv-grade" data-ok="0">${ICON.close}Not yet</button><button class="btn primary" data-action="lab-rv-grade" data-ok="1">${ICON.check}Got it</button>` : `<span></span><button class="btn primary" data-action="lab-rv-show">Show answer</button>`}</div>
    </div></div>`;
  }

  // ------------------------------------------------------------------
  // Cheat sheets (printable)
  // ------------------------------------------------------------------
  const tbl = (head, rows) => `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td${i && /^[\d$(]/.test(String(c)) ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const sheetHead = (title, sub) => `<div class="cap muted">Coll Ledger Academy · Cheat sheet</div><h1 class="serif" style="font-weight:400;font-size:26px;margin:2px 0 4px">${title}</h1><div class="muted" style="margin-bottom:18px">${sub}</div>`;
  const sheetFoot = '<p class="muted" style="font-size:10px;margin-top:18px">Coll Business Solutions LLC · Figures checked October 2026 — confirm current rules each year at irs.gov and tax.colorado.gov.</p>';
  const SHEETS = [
    { id: 'debits', title: 'Debits and credits', sub: 'Every entry has equal debits and credits. Here is which side makes each account go up.', html: () =>
      tbl(['Account type', 'Increase with', 'Decrease with', 'Normal balance', 'Examples'], [
        ['Assets', 'Debit', 'Credit', 'Debit', 'Business Checking, Accounts Receivable, Prepaid Expenses, Equipment & Vehicles'],
        ['Expenses', 'Debit', 'Credit', 'Debit', 'Rent & Lease, Payroll & Wages, Cost of Goods Sold, Depreciation Expense'],
        ['Owner\'s Draw', 'Debit', 'Credit', 'Debit', 'Money the owner takes out'],
        ['Liabilities', 'Credit', 'Debit', 'Credit', 'Accounts Payable, Business Credit Card, Sales Tax Payable, Loans Payable'],
        ['Equity', 'Credit', 'Debit', 'Credit', 'Owner\'s Contributions, Retained earnings'],
        ['Income', 'Credit', 'Debit', 'Credit', 'Sales, Service Revenue']]) +
      '<div class="cap muted" style="margin-top:20px">Memory trick: DEALER</div><p><b>D</b>ividends/draws, <b>E</b>xpenses and <b>A</b>ssets go up with debits. <b>L</b>iabilities, <b>E</b>quity and <b>R</b>evenue go up with credits.</p>' +
      '<div class="cap muted" style="margin-top:16px">Everyday entries</div>' + tbl(['What happened', 'Debit', 'Credit'], [
        ['Customer pays cash for a sale', 'Business Checking', 'Sales'], ['Send an invoice', 'Accounts Receivable', 'Sales'], ['Customer pays the invoice', 'Business Checking', 'Accounts Receivable'],
        ['Pay rent from checking', 'Rent & Lease', 'Business Checking'], ['Buy supplies on the card', 'Office Supplies', 'Business Credit Card'], ['Pay the card bill', 'Business Credit Card', 'Business Checking'],
        ['Enter a vendor bill', 'Expense account', 'Accounts Payable'], ['Pay the bill', 'Accounts Payable', 'Business Checking'], ['Owner puts money in', 'Business Checking', 'Owner\'s Contributions'],
        ['Owner takes money out', 'Owner\'s Draw', 'Business Checking'], ['Collect sales tax', 'Business Checking', 'Sales Tax Payable'], ['Pay the sales tax', 'Sales Tax Payable', 'Business Checking'],
        ['Loan payment', 'Loans Payable (principal) + Interest Expense', 'Business Checking'], ['Monthly depreciation', 'Depreciation Expense', 'Accumulated Depreciation']]) },
    { id: 'close', title: 'Month-end close checklist', sub: 'The same steps, in the same order, every month. Print one per client.', html: () =>
      '<ol class="cl">' + [
        ['Import everything', 'Bank, card and payment-app (Square, Stripe, PayPal) activity through the last day of the month.'],
        ['Clear To Review', 'Categorize every item. Payroll, loans and mixed purchases get split. Card payments and transfers are never expenses.'],
        ['Match money to documents', 'Apply customer payments to invoices and vendor payments to bills. Attach receipts for anything $75 or more (lodging at any amount).'],
        ['Run Clean up', 'Duplicates, uncategorized items, odd amounts, missing receipts.'],
        ['Post adjustments', 'Depreciation, prepaid expenses used, accruals (set to reverse), inventory to the count.'],
        ['Reconcile every account', 'Checking, savings, every card and loan — to the statement, difference $0.00.'],
        ['Review the reports', 'Profit & Loss against last month and last year; Balance Sheet for anything negative or strange; Sales Tax Payable matches the return.'],
        ['Close the month', 'Locks the period so nothing changes by accident.'],
        ['Send the package', 'Profit & Loss, Balance Sheet, three plain-English highlights and any questions — by the same day every month.']
      ].map(([a, b]) => `<li><b>${a}.</b> ${b} <span class="box"></span></li>`).join('') + '</ol>' +
      '<div class="cap muted" style="margin-top:18px">Red flags to look for</div><p>Negative cash or a negative liability · Uncategorized anything · Owner\'s Draw larger than profit · A reconciliation difference you "forced" · Sales tax collected but not paid · A loan balance that doesn\'t match the lender.</p>' },
    { id: 'deadlines', title: 'Deadline calendar', sub: 'Federal and Colorado due dates for calendar-year businesses. A date on a weekend or legal holiday moves to the next business day.', html: () =>
      tbl(['When', 'What', 'Who'], [
        ['January 15', 'Q4 estimated tax (for the prior year)', 'Owners of pass-through businesses'],
        ['January 31', 'W-2s to employees and the SSA (with W-3); Form 940; Q4 Form 941; 1099-NEC to contractors and the IRS; 1099-MISC to recipients', 'Employers and businesses that paid contractors'],
        ['February 28 / March 31', '1099-MISC to the IRS (paper / e-file)', 'Businesses that paid rent, prizes, etc.'],
        ['March 15', 'Form 1065 (partnerships) and Form 1120-S (S corporations), with K-1s', 'Partnerships and S corps'],
        ['April 15', 'Form 1040 with Schedule C; Form 1120 (C corporations); Q1 estimated tax', 'Sole proprietors, single-member LLCs, C corps, owners'],
        ['April 30', 'Q1 Form 941', 'Employers'],
        ['June 15', 'Q2 estimated tax', 'Owners'],
        ['July 31', 'Q2 Form 941', 'Employers'],
        ['September 15', 'Q3 estimated tax; extended 1065 and 1120-S', 'Owners, partnerships, S corps'],
        ['October 15', 'Extended Form 1040 and Form 1120', 'Individuals and C corps on extension'],
        ['October 31', 'Q3 Form 941', 'Employers'],
        ['20th of each month', 'Colorado sales tax return for the prior month (monthly filers)', 'Businesses collecting Colorado sales tax'],
        ['Every payday', 'Federal payroll tax deposits on the monthly or semiweekly schedule', 'Employers']]) +
      '<p class="muted" style="margin-top:12px">An extension gives more time to file, not to pay. Home-rule cities such as Denver, Aurora and Boulder may have their own sales tax returns and schedules.</p>' },
    { id: 'tax', title: 'Tax rules quick reference', sub: 'The numbers bookkeepers look up most. 2026 figures.', html: () =>
      tbl(['Rule', 'Amount', 'Notes'], [
        ['FICA (each of employer and employee)', '7.65%', 'Social Security 6.2% up to $184,500 of wages (2026) + Medicare 1.45%, no cap'],
        ['Additional Medicare (employee only)', '0.9%', 'On wages over $200,000'],
        ['FUTA after state credit', '0.6%', 'On the first $7,000 per employee — at most $42'],
        ['Self-employment tax', '15.3%', 'Of 92.35% of net earnings; half is deductible'],
        ['1099-NEC threshold', '$2,000', 'For payments made in 2026 ($600 before)'],
        ['Backup withholding', '24%', 'When a payee won\'t give a valid tax ID'],
        ['E-file information returns', '10+', 'Returns in total, all types combined'],
        ['De minimis safe harbor', '$2,500', 'Per item or invoice, without audited statements'],
        ['Section 179 limit (2026)', '$2,560,000', 'Phases out above $4,090,000 of purchases'],
        ['Bonus depreciation', '100%', 'Qualifying property acquired after January 19, 2025'],
        ['Business meals', '50%', 'Generally deductible; entertainment is not'],
        ['Receipts', '$75', 'Travel, meals, gifts; lodging at any amount'],
        ['Mileage rate (2026)', '72.5¢ / 76¢', 'January–June / from July 1, 2026'],
        ['Estimated tax safe harbor', '90% / 100% / 110%', 'Of this year\'s tax / last year\'s / last year\'s if AGI over $150,000'],
        ['QBI deduction', 'Up to 20%', 'Of qualified business income; limits apply'],
        ['Colorado state sales tax', '2.9%', 'Plus county, city and special-district rates'],
        ['Economic nexus (Colorado and many states)', '$100,000', 'Of annual sales into the state']]) +
      '<div class="cap muted" style="margin-top:16px">Worked examples</div><p>FICA on $2,000 of wages: $2,000 × 7.65% = $153 from the employer, and $153 withheld from the employee. Self-employment tax on $40,000 of profit: $40,000 × 92.35% × 15.3% = $5,651.82.</p>' },
    { id: 'entries', title: 'Adjusting entries', sub: 'The month-end entries, with the formula and a worked example for each.', html: () =>
      tbl(['Entry', 'Debit', 'Credit', 'How to figure it'], [
        ['Depreciation', 'Depreciation Expense', 'Accumulated Depreciation', '(Cost − salvage) ÷ months of life. ($14,400 − $2,400) ÷ 120 = $100 a month'],
        ['Prepaid used up', 'Insurance (or other expense)', 'Prepaid Expenses', 'Amount paid ÷ months covered. $3,600 ÷ 12 = $300 a month'],
        ['Accrued expense', 'Expense (e.g. Payroll & Wages)', 'Accrued Liabilities', 'What was used but not billed. Reverse it on the 1st of next month'],
        ['Deferred revenue', 'Sales', 'Unearned Revenue', 'Deposits for work not yet delivered; move back to Sales when delivered'],
        ['Inventory to the count', 'Cost of Goods Sold', 'Inventory', 'Books − physical count. $19,200 − $18,450 = $750'],
        ['Loan interest split', 'Interest Expense + Loans Payable', 'Business Checking', 'Balance × rate ÷ 12. $28,800 × 7.5% ÷ 12 = $180 interest'],
        ['Owner\'s personal expense', 'Owner\'s Draw', 'The expense it was coded to', 'Recategorize — personal spending is never a business expense']]) +
      '<p class="muted" style="margin-top:12px">Every entry: date it the last day of the month, write a memo a stranger would understand, and attach the support (schedule, statement or count sheet).</p>' }
  ];
  function printSheet(id) {
    const s = SHEETS.find(x => x.id === id); if (!s) return;
    T().flags.cheat = true; save();
    U.printDoc(App.docShell(s.title, `<div class="page"><style>.cl{padding-left:18px}.cl li{margin:0 0 10px;line-height:1.5;position:relative;padding-right:28px}.cl .box{position:absolute;right:0;top:2px;width:14px;height:14px;border:1.5px solid #16201C;border-radius:3px}</style>${sheetHead(s.title, s.sub)}${s.html()}${sheetFoot}</div>`), `Coll Ledger cheat sheet - ${s.title}.pdf`);
  }
  function renderSheets() {
    return `<div class="sheet-grid">${SHEETS.map(s => `<div class="card sheet"><div class="card-body"><div class="sheet-ic">${ICON.pdf}</div><b>${esc(s.title)}</b><div class="muted">${esc(s.sub)}</div><div class="sheet-foot"><button class="btn sm" data-action="lab-sheet-view" data-id="${s.id}">View</button><button class="btn sm primary" data-action="lab-sheet" data-id="${s.id}">${ICON.pdf}Save PDF</button></div></div></div>`).join('')}</div>
      <div class="card" style="margin-top:14px"><div class="card-body"><div class="cap-label">All five</div><p class="muted" style="margin:4px 0 10px">One PDF with every sheet — print it and keep it at your desk.</p><button class="btn primary" data-action="lab-sheet-all">${ICON.pdf}Save all cheat sheets</button></div></div>`;
  }

  // ------------------------------------------------------------------
  // Portfolio — a work sample built from the practical exams
  // ------------------------------------------------------------------
  function portfolioParts() {
    const out = [];
    const juniper = S.data.clients.find(c => c.exam), aspen = S.data.clients.find(c => c.advExam);
    const t = T();
    if (juniper && t.practical && t.practical.passed) out.push({ c: juniper, month: juniper.examKey.month, title: 'Month-end close — Juniper Flower Co.', score: t.practical.score, what: ['Categorized a month of bank and card activity, including a payroll split into wages and employer taxes', 'Applied a customer payment to its invoice and recorded transfers, card payments and a sales tax payment correctly', 'Found and removed a duplicate import and corrected a transposed check amount', 'Reconciled the checking account to the bank statement to $0.00 and closed the month'] });
    if (aspen && t.advPractical && t.advPractical.passed) out.push({ c: aspen, month: aspen.advKey.month, title: 'Accrual month-end close — Aspen Trail Outfitters', score: t.advPractical.score, what: ['Posted depreciation, used-up prepaid insurance and accrued wages with an automatic reversal', 'Adjusted inventory to the physical count and deferred a customer deposit to Unearned Revenue', 'Split a loan payment into principal and interest from the lender\'s statement', 'Recategorized a sales tax payment to clear the liability and closed the month'] });
    Object.entries(t.lab.cases).forEach(([id, r]) => { if (r && r.passed && App.labCases) { const cs = App.labCases.CASES.find(x => x.id === id); if (cs) out.push({ caseOnly: true, title: 'Case study — ' + cs.title, score: r.score, what: [cs.summary || cs.title] }); } });
    return out;
  }
  function portfolio() {
    const parts = portfolioParts(), t = T();
    if (!parts.length) return U.toast('Pass a practical exam first — your portfolio is built from it', null, 'warn');
    const name = (t.certAdv && t.certAdv.name) || (t.cert && t.cert.name) || S.data.firm.owner || '';
    const creds = [t.cert && `Professional Bookkeeping Certificate · ${t.cert.id}`, t.certAdv && `Advanced Accounting &amp; Tax Certificate · ${t.certAdv.id}`].filter(Boolean);
    const pages = [`<div class="page"><div class="cap muted">Work portfolio</div><h1 class="serif" style="font-weight:400;font-size:34px;margin:6px 0 4px">${esc(name || 'Bookkeeping work samples')}</h1><div class="muted" style="margin-bottom:24px">${esc(S.data.firm.name || '')}${S.data.firm.email ? ' · ' + esc(S.data.firm.email) : ''}${S.data.firm.phone ? ' · ' + esc(S.data.firm.phone) : ''}</div>
      <p style="font-size:14px;line-height:1.7;max-width:6in">These are real work samples completed in Coll Ledger on graded practice clients — the same work done for a paying client each month. Each sample includes the finished reports and the adjusting entries, so you can see the quality of the books, not just a score.</p>
      ${creds.length ? `<div class="cap muted" style="margin-top:22px">Credentials</div>${creds.map(c => `<div style="padding:6px 0;border-bottom:1px solid #E6E2D9">${c}</div>`).join('')}<div class="muted" style="margin-top:6px;font-size:11px">Verify at collbusinesssolutions.com/verify</div>` : ''}
      <div class="cap muted" style="margin-top:22px">Contents</div>${parts.map((p, i) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E6E2D9"><span>${i + 1}. ${esc(p.title)}</span><b>${p.score}/100</b></div>`).join('')}
      <div class="footer"><span>Prepared with Coll Ledger · Coll Business Solutions LLC</span><span>${fmtDate(today())}</span></div></div>`];
    parts.forEach((p, i) => {
      if (p.caseOnly) { pages.push(`<div class="page"><div class="cap muted">Sample ${i + 1}</div><h2 class="serif" style="font-weight:400;font-size:24px;margin:4px 0 10px">${esc(p.title)}</h2><div class="muted" style="margin-bottom:14px">Graded ${p.score}/100</div><ul>${p.what.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`); return; }
      const c = p.c, M = p.month;
      const pl = App.reportData(c, { type: 'pl', from: M.from, to: M.to, print: true }).html;
      const bs = App.reportData(c, { type: 'bs', from: M.from, to: M.to, asOf: M.to, print: true }).html;
      const acct = id => (c.accounts.find(a => a.id === id) || {}).name || '';
      const jes = (c.journals || []).filter(j => !j.void && j.date >= M.from && j.date <= M.to);
      const rec = (c.reconciliations || []).filter(r => r.date >= M.from && r.date <= M.to);
      pages.push(`<div class="page"><div class="cap muted">Sample ${i + 1} · ${esc(c.legalName || c.name)} · ${U.fmtMonth(M.from)}</div><h2 class="serif" style="font-weight:400;font-size:24px;margin:4px 0 10px">${esc(p.title)}</h2>
        <div class="muted" style="margin-bottom:14px">Graded ${p.score}/100 on the account balances</div>
        <div class="cap muted">What was done</div><ul style="line-height:1.6">${p.what.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        ${rec.length ? `<div class="cap muted" style="margin-top:16px">Reconciliation</div>${rec.map(r => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #E6E2D9"><span>${esc(acct(r.accountId))} · statement ending ${fmtDate(r.date)}</span><b>${money(r.ending)} · difference $0.00</b></div>`).join('')}` : ''}
        ${jes.length ? `<div class="cap muted" style="margin-top:16px">Adjusting entries</div><table><tr><th>Date</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr>${jes.map(j => j.lines.map((l, k) => `<tr><td>${k ? '' : fmtDate(j.date) + (j.reversalOf ? ' (reversal)' : '')}</td><td>${esc(acct(l.accountId))}</td><td class="num">${+l.debit ? money(+l.debit) : ''}</td><td class="num">${+l.credit ? money(+l.credit) : ''}</td></tr>`).join('')).join('')}</table>` : ''}</div>`);
      pages.push(`<div class="page">${pl}</div><div class="page">${bs}</div>`);
    });
    t.flags.portfolio = true; save();
    U.printDoc(App.docShell('Work portfolio', pages.join('')), `Bookkeeping work portfolio${name ? ' - ' + name : ''}.pdf`);
  }
  function renderPortfolio() {
    const parts = portfolioParts();
    return `<div class="card"><div class="card-body">
      <h2 class="tm-title" style="margin-top:0">Your work portfolio</h2>
      <p class="tm-learn">Employers and clients trust what they can see. Your portfolio turns your graded practical exams into a polished PDF: what you did, the reconciliation, every adjusting entry, and the finished Profit &amp; Loss and Balance Sheet — plus the case studies you've passed and your credential IDs.</p>
      ${parts.length ? `<div class="grade-list">${parts.map(p => `<div class="gl ok"><span class="tick on">${ICON.check}</span><div class="grow"><b>${esc(p.title)}</b></div><span class="num">${p.score}/100</span></div>`).join('')}</div>` : '<div class="muted">Nothing yet — pass the Professional practical exam and it appears here.</div>'}
      <p class="muted" style="font-size:12px">Tip: send the PDF with your proposal or résumé, and say "these are graded work samples" — it answers "can you actually do the work?" before anyone asks. Keep the practice clients in Coll Ledger; the portfolio is built from them.</p>
      <div class="tm-nav"><span></span><button class="btn primary" data-action="lab-portfolio" ${parts.length ? '' : 'disabled'}>${ICON.pdf}Save portfolio PDF</button></div>
    </div></div>`;
  }

  // ------------------------------------------------------------------
  // The Study center page
  // ------------------------------------------------------------------
  const TABS = [['plan', 'Study plan'], ['review', 'Daily review'], ['cases', 'Case studies'], ['emails', 'Client emails'], ['sheets', 'Cheat sheets'], ['portfolio', 'Portfolio']];
  App.view('lab', {
    render() {
      const u = UI(), t = T(), LC = App.labCases;
      const due = (() => { try { return dueCards().queue.length; } catch (e) { return 0; } })();
      const casesDone = LC ? LC.CASES.filter(x => t.lab.cases[x.id] && t.lab.cases[x.id].passed).length : 0;
      const emailsDone = LC ? LC.EMAILS.filter(x => t.lab.emails[x.id] && t.lab.emails[x.id].done).length : 0;
      const badge = { review: due || '', cases: LC ? `${casesDone}/${LC.CASES.length}` : '', emails: LC ? `${emailsDone}/${LC.EMAILS.length}` : '' };
      let body = '';
      if (u.tab === 'plan') body = renderPlan();
      else if (u.tab === 'review') body = renderReview();
      else if (u.tab === 'cases') body = LC ? LC.renderCases() : '';
      else if (u.tab === 'emails') body = LC ? LC.renderEmails() : '';
      else if (u.tab === 'sheets') body = renderSheets();
      else body = renderPortfolio();
      return `<div class="page-head"><div><h1>Study center</h1><div class="sub">Plan your study, review a little every day, practice on real-world cases and client emails, and build a portfolio that shows your work.</div></div><div class="actions"><button class="btn" data-nav="training">${ICON.back}Back to the Academy</button></div></div>
        <div class="lab-tabs" role="tablist">${TABS.map(([k, l]) => `<button class="${u.tab === k ? 'on' : ''}" data-action="lab-tab" data-v="${k}">${l}${badge[k] ? `<span class="lt-badge">${badge[k]}</span>` : ''}</button>`).join('')}</div>
        <div class="lab-body">${body}</div>`;
    }
  });

  act({
    'lab-open': el => { UI().tab = (el && el.dataset && el.dataset.v) || UI().tab || 'plan'; go('lab'); },
    'lab-tab': el => { const u = UI(); u.tab = el.dataset.v; u.review = null; u.open = null; u.email = null; render(); $('#view').scrollTop = 0; },
    'lab-case-open': el => { const u = UI(); u.tab = 'cases'; u.open = el.dataset.id; go('lab'); },
    'lab-plan': el => { T().lab.plan[el.dataset.k] = +el.value; save(); render(); },
    'lab-rv-start': () => { const q = dueCards().queue; const td = today(); const st = T().lab.cards; q.forEach(c => { if (!st[c.id]) st[c.id] = { box: 0, due: td, added: td }; }); save(); UI().review = { ids: q.map(c => c.id), at: 0, show: false, right: 0 }; render(); },
    'lab-rv-show': () => { UI().review.show = true; render(); },
    'lab-rv-grade': el => {
      const R = UI().review, t = T(), id = R.ids[R.at], st = t.lab.cards[id] || { box: 0 };
      if (el.dataset.ok === '1') { st.box = Math.min(GAPS.length - 1, (st.box || 0) + 1); st.due = C.addDays(today(), GAPS[st.box]); R.right++; }
      else { st.box = 0; st.due = C.addDays(today(), 1); }
      t.lab.cards[id] = st; t.lab.reviewDays[today()] = (t.lab.reviewDays[today()] || 0) + 1;
      R.at++; R.show = false; save(); render();
    },
    'lab-rv-close': () => { UI().review = null; render(); },
    'lab-sheet': el => printSheet(el.dataset.id),
    'lab-sheet-view': el => { const s = SHEETS.find(x => x.id === el.dataset.id); if (!s) return; U.openModal(`${U.modalHead(s.title, s.sub)}<div class="modal-body"><div class="sheet-view">${s.html()}</div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Close</button><button class="btn primary" data-action="lab-sheet" data-id="${s.id}">${ICON.pdf}Save PDF</button></div>`, { wide: true }); },
    'lab-sheet-all': () => { T().flags.cheat = true; save(); U.printDoc(App.docShell('Cheat sheets', SHEETS.map(s => `<div class="page"><style>.cl{padding-left:18px}.cl li{margin:0 0 10px;line-height:1.5;position:relative;padding-right:28px}.cl .box{position:absolute;right:0;top:2px;width:14px;height:14px;border:1.5px solid #16201C;border-radius:3px}</style>${sheetHead(s.title, s.sub)}${s.html()}${sheetFoot}</div>`).join('')), 'Coll Ledger cheat sheets.pdf'); },
    'lab-portfolio': () => portfolio()
  });

  App.lab = { SHEETS, buildPlan, planItems, dueCards, allCards, streak, studyDays, tries, portfolio, portfolioParts };
})();
