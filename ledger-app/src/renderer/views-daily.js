'use strict';
/* =====================================================================
   Coll Ledger — everyday screens
   All clients, Dashboard, To Review, Transactions and the transaction
   window (with splits).
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save, snapshot, guardLock } = App;
  const { $, $$, esc, money, signed, fmtDate, fmtDateShort, ICON, plural } = U;
  const today = App.today;

  const moneyAccounts = c => c.accounts.filter(a => C.isMoneyAccount(a) && !a.archived);
  const accountOptions = (list, selected) => list.map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
  const catName = (c, id) => { const a = id && C.acct(c, id); return a ? a.name : ''; };
  const lastRecon = (c, a) => c.reconciliations.filter(r => r.accountId === a.id).sort((x, y) => y.date.localeCompare(x.date))[0];
  App.moneyAccounts = moneyAccounts; App.accountOptions = accountOptions; App.lastRecon = lastRecon;

  // ------------------------------------------------------------------
  // Health of one client's books (used on All clients and the dashboard)
  // ------------------------------------------------------------------
  function health(c) {
    const review = App.reviewCount(c);
    const lastMonthEnd = C.isoOf(new Date(C.parseISO(today()).getFullYear(), C.parseISO(today()).getMonth(), 0));
    const accs = moneyAccounts(c).filter(a => c.transactions.some(t => t.accountId === a.id || t.categoryId === a.id));
    const unrec = accs.filter(a => { const lr = lastRecon(c, a); return !lr || lr.date < lastMonthEnd; });
    const inv = c.invoices.map(i => C.invoiceState(c, i));
    const overdue = inv.filter(s => s.status === 'overdue');
    const lastTxn = c.transactions.reduce((m, t) => t.date > m ? t.date : m, '');
    const closedThrough = c.lockDate;
    const score = (review ? 1 : 0) + (unrec.length ? 1 : 0) + (overdue.length ? 1 : 0);
    return { review, unrec, overdue, overdueTotal: overdue.reduce((s, x) => s + x.due, 0), lastTxn, closedThrough, lastMonthEnd, score };
  }
  App.health = health;

  // ------------------------------------------------------------------
  // All clients — the bookkeeper's home
  // ------------------------------------------------------------------
  view('clients', {
    render() {
      const list = S.data.clients;
      const firstName = (S.data.firm.owner || '').split(' ')[0];
      const h = new Date().getHours();
      const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      const all = list.map(c => ({ c, h: health(c) }));
      const real = all.filter(x => !x.c.practice);
      const totals = real.reduce((t, x) => ({ review: t.review + x.h.review, unrec: t.unrec + x.h.unrec.length, overdue: t.overdue + x.h.overdue.length }), { review: 0, unrec: 0, overdue: 0 });
      const sorted = [...all].sort((a, b) => (a.c.practice ? 1 : 0) - (b.c.practice ? 1 : 0) || b.h.score - a.h.score || a.c.name.localeCompare(b.c.name));
      return `
        <div class="page-head">
          <div><h1>${greet}${firstName ? ', ' + esc(firstName) : ''}</h1>
          <div class="sub">${real.length ? (totals.review + totals.unrec + totals.overdue ? `Across ${plural(real.length, 'client')}: <b>${plural(totals.review, 'transaction')}</b> to review, <b>${plural(totals.unrec, 'account')}</b> to reconcile${totals.overdue ? `, <b>${plural(totals.overdue, 'overdue invoice')}</b>` : ''}.` : `All ${plural(real.length, 'client')} are up to date. Nicely done.`) : 'Add the first business you keep books for — or practice first in Practice / Training.'}</div></div>
          <div class="actions"><button class="btn primary" data-action="new-client">${ICON.plus}Add client</button></div>
        </div>
        <div class="client-grid">
          ${sorted.map(({ c, h }) => `
            <div class="card client-card" data-action="open-client" data-id="${c.id}" tabindex="0">
              <div class="cc-top"><div class="avatar lg" style="background:${c.color}">${esc(U.initials(c.name))}</div>
                <div style="min-width:0"><div class="cc-name">${esc(c.name)}</div><div class="muted">${esc(c.industry || 'Client')}</div></div>
                ${c.practice ? `<span class="tag gold cc-ok">Practice</span>` : h.score ? '' : `<span class="tag green cc-ok">${ICON.check}Up to date</span>`}
                <button class="icon-btn cc-more" data-action="client-card-menu" data-id="${c.id}" aria-label="More for ${esc(c.name)}" title="More">${ICON.dots}</button></div>
              <div class="cc-stats">
                <div class="${h.review ? 'warn' : ''}"><span>${h.review}</span>to review</div>
                <div class="${h.unrec.length ? 'warn' : ''}"><span>${h.unrec.length}</span>to reconcile</div>
                <div class="${h.overdue.length ? 'bad' : ''}"><span>${h.overdue.length}</span>overdue</div>
              </div>
              <div class="cc-foot muted">${App.openTodos && App.openTodos(c).length ? `<span class="cc-todo">${ICON.check}${App.openTodos(c).length} to-do${App.openTodos(c).length > 1 ? 's' : ''}</span> · ` : ''}${h.closedThrough ? `${ICON.lock} Closed through ${U.fmtMonth(h.closedThrough)}` : 'No months closed yet'}${h.lastTxn ? ` · activity through ${fmtDateShort(h.lastTxn)}` : ''}</div>
            </div>`).join('')}
          <div class="card client-card add" data-action="new-client" tabindex="0"><div class="add-ic">${ICON.plus}</div><b>Add a client</b><div class="muted">About a minute to set up</div></div>
        </div>`;
    }
  });
  act({
    'open-client': el => App.switchClient(el.dataset.id, 'dashboard'),
    'client-card-menu': el => {
      const id = el.dataset.id;
      const m = U.openMenu(el, `<div class="mi" data-do="open">${ICON.home}<span>Open</span></div>
        <div class="mi" data-do="settings">${ICON.edit}<span>Client settings</span></div>
        <div class="sep"></div>
        <div class="mi danger" data-do="delete">${ICON.trash}<span>Delete client…</span></div>`, { align: 'right', width: 210 });
      m.onclick = e => {
        const it = e.target.closest('[data-do]'); if (!it) return;
        U.closeMenus();
        if (it.dataset.do === 'open') return App.switchClient(id, 'dashboard');
        if (it.dataset.do === 'settings') return App.switchClient(id, 'settings');
        App.actions['delete-client']({ dataset: { id } });
      };
    }
  });

  // ------------------------------------------------------------------
  // Dashboard
  // ------------------------------------------------------------------
  function monthlyIE(c, months = 12) {
    const t = C.parseISO(today());
    const keys = [];
    for (let i = months - 1; i >= 0; i--) keys.push(C.isoOf(new Date(t.getFullYear(), t.getMonth() - i, 1)).slice(0, 7));
    const map = Object.fromEntries(keys.map(k => [k, { inc: 0, exp: 0 }]));
    const acc = new Map(c.accounts.map(a => [a.id, a]));
    for (const p of C.postings(c)) {
      const k = p.date.slice(0, 7);
      if (!map[k]) continue;
      const a = acc.get(p.acc);
      if (!a || a.key === 'unc_inc' || a.key === 'unc_exp') continue;
      if (a.type === 'income') map[k].inc += p.cr - p.dr;
      else if (a.type === 'expense') map[k].exp += p.dr - p.cr;
    }
    return keys.map(k => ({ k, ...map[k] }));
  }
  function barChart(data) {
    const W = 760, H = 250, padL = 56, padB = 28, padT = 14;
    const raw = Math.max(1, ...data.map(d => Math.max(d.inc, d.exp)));
    const rough = raw / 4, mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const stepV = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10].map(x => x * mag).find(s => s >= rough);
    const max = stepV * 4;
    const step = (W - padL - 10) / data.length;
    const bw = Math.min(16, step / 3.2);
    const y = v => padT + (H - padT - padB) * (1 - v / max);
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = stepV * i, yy = y(v);
      grid += `<line x1="${padL}" x2="${W - 6}" y1="${yy}" y2="${yy}" stroke="var(--line)" ${i ? 'stroke-dasharray="3 4"' : ''}/><text x="${padL - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${U.moneyShort(v)}</text>`;
    }
    const bars = data.map((d, i) => {
      const cx = padL + step * i + step / 2;
      const lab = C.parseISO(d.k + '-01').toLocaleDateString('en-US', { month: 'short' });
      const cur = i === data.length - 1;
      return `<g class="bar-g"><title>${lab}: income ${money(d.inc)} · expenses ${money(d.exp)} · profit ${money(d.inc - d.exp)}</title>
        <rect x="${cx - step / 2}" y="${padT}" width="${step}" height="${H - padT - padB}" fill="transparent"/>
        <rect x="${cx - bw - 1.5}" y="${y(Math.max(0, d.inc))}" width="${bw}" height="${Math.max(0, H - padB - y(Math.max(0, d.inc)))}" rx="4" fill="var(--accent)" ${cur ? 'opacity=".55"' : ''}/>
        <rect x="${cx + 1.5}" y="${y(Math.max(0, d.exp))}" width="${bw}" height="${Math.max(0, H - padB - y(Math.max(0, d.exp)))}" rx="4" fill="var(--gold)" opacity="${cur ? '.5' : '.9'}"/>
        <text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${lab}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and expenses for the last 12 months">${grid}${bars}</svg>`;
  }

  // Getting-started steps for a new client, ticked off automatically
  function checklist(c) {
    const steps = [
      ['Add opening balances', 'Starting balances from the first statements', c.accounts.some(a => a.opening), 'accounts'],
      ['Bring in bank activity', 'Drop a bank, Square or QuickBooks file', c.transactions.length > 0, 'import'],
      ['Sort the transactions', 'Give each one a category in To Review', c.transactions.length > 0 && App.reviewCount(c) === 0, 'review'],
      ['Reconcile a statement', 'Prove the books match the bank', c.reconciliations.length > 0, 'reconcile'],
      ['Close your first month', 'Lock it and send the client package', !!c.lockDate, 'close']
    ];
    const done = steps.filter(s => s[2]).length;
    if (c.checklistDismissed || done === steps.length) return '';
    return `<div class="card checklist"><div class="card-head"><div><h3>Get ${esc(c.name)} set up</h3><div class="muted">${done} of ${steps.length} done · each step ticks itself off</div></div>
      <button class="btn sm ghost" style="margin-left:auto" data-action="dismiss-checklist">Hide</button></div>
      <div class="progress"><div style="width:${done / steps.length * 100}%"></div></div>
      <div class="steps">${steps.map(([t, d, ok, page], i) => `<button class="step ${ok ? 'done' : ''}" data-nav="${page}"><span class="step-n">${ok ? ICON.check : i + 1}</span><span><b>${t}</b><span class="muted">${d}</span></span></button>`).join('')}</div></div>`;
  }

  view('dashboard', {
    render(c) {
      const bal = C.balances(c, { to: today() });
      const banks = c.accounts.filter(a => (a.sub === 'bank' || a.sub === 'clearing') && !a.archived);
      const cards = c.accounts.filter(a => a.sub === 'credit' && !a.archived);
      const cash = banks.reduce((s, a) => s + bal.get(a.id), 0);
      const thisM = C.periodRange('this-month', c), lastM = C.periodRange('last-month', c), ytd = C.periodRange('ytd', c);
      const t0 = C.parseISO(today());
      const samePointLast = (() => { const e = C.isoOf(new Date(t0.getFullYear(), t0.getMonth() - 1, Math.min(t0.getDate(), new Date(t0.getFullYear(), t0.getMonth(), 0).getDate()))); return e; })();
      const plM = C.profitLoss(c, thisM.from, today()), plLM = C.profitLoss(c, lastM.from, samePointLast), plY = C.profitLoss(c, ytd.from, today());
      const invStates = c.invoices.map(i => ({ i, s: C.invoiceState(c, i) }));
      const open = invStates.filter(x => ['open', 'partial', 'overdue'].includes(x.s.status));
      const overdue = invStates.filter(x => x.s.status === 'overdue');
      const arTotal = open.reduce((s, x) => s + x.s.due, 0);
      const h = health(c);
      const delta = (a, b) => { if (!b) return ''; const p = (a - b) / Math.abs(b) * 100; return `<span class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span> vs. same days last month`; };
      const months = monthlyIE(c);
      const topExp = [...plY.cogs, ...plY.expense, ...plY.otherExpense].filter(x => x.a.key !== 'unc_exp' && x.v > 0).sort((a, b) => b.v - a.v).slice(0, 6);
      const maxExp = Math.max(1, ...topExp.map(x => x.v));
      const recent = [...c.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

      const attention = [];
      if (h.review) attention.push(`<div class="row"><span class="tag gold"><span class="dot"></span>${h.review}</span><div class="grow"><b>Transactions to review</b><div class="muted">New activity waiting for a category</div></div><button class="btn sm" data-nav="review">Review</button></div>`);
      if (overdue.length) attention.push(`<div class="row"><span class="tag red"><span class="dot"></span>${overdue.length}</span><div class="grow"><b>Overdue invoice${overdue.length > 1 ? 's' : ''}</b><div class="muted">${money(h.overdueTotal)} past due</div></div><div class="btn-pair"><button class="btn sm" data-action="remind-all">Remind</button><button class="btn sm ghost" data-action="inv-filter" data-v="overdue">View</button></div></div>`);
      for (const a of h.unrec) {
        const lr = lastRecon(c, a);
        attention.push(`<div class="row"><span class="tag blue">${a.sub === 'credit' ? ICON.card : ICON.bank}</span><div class="grow"><b>Reconcile ${esc(a.name)}</b><div class="muted">${lr ? 'Done through ' + fmtDate(lr.date) : 'Not reconciled yet'}</div></div><button class="btn sm" data-action="start-recon" data-id="${a.id}">Start</button></div>`);
      }
      const billSt = (c.bills || []).map(b => C.billState(c, b));
      const billsDue = billSt.filter(s => s.status === 'soon' || s.status === 'overdue');
      if (billsDue.length) attention.push(`<div class="row"><span class="tag ${billsDue.some(s => s.status === 'overdue') ? 'red' : 'gold'}"><span class="dot"></span>${billsDue.length}</span><div class="grow"><b>Bill${billsDue.length > 1 ? 's' : ''} to pay</b><div class="muted">${money(billsDue.reduce((s, x) => s + x.due, 0))} due within a week${billsDue.some(s => s.status === 'overdue') ? ' or late' : ''}</div></div><button class="btn sm" data-action="bill-filter" data-v="${billsDue.some(s => s.status === 'overdue') ? 'overdue' : 'soon'}">Pay</button></div>`);
      const drafts = invStates.filter(x => x.s.status === 'draft');
      if (drafts.length) attention.push(`<div class="row"><span class="tag">${drafts.length}</span><div class="grow"><b>Draft invoice${drafts.length > 1 ? 's' : ''}</b><div class="muted">Ready to finish and send</div></div><button class="btn sm" data-action="inv-filter" data-v="draft">Open</button></div>`);
      if (App.todoAttention) attention.push(...App.todoAttention(c));
      const lastClose = c.lockDate;
      if (!h.review && !h.unrec.length && (!lastClose || lastClose < h.lastMonthEnd) && c.transactions.length) attention.push(`<div class="row"><span class="tag green">${ICON.lock}</span><div class="grow"><b>Ready to close ${U.fmtMonth(h.lastMonthEnd)}</b><div class="muted">Everything is reviewed and reconciled</div></div><button class="btn sm primary" data-nav="close">Close</button></div>`);

      return `
        <div class="page-head">
          <div><h1>${esc(c.name)}</h1><div class="sub">${esc(c.industry ? c.industry + ' · ' : '')}${fmtDate(today())}${c.lockDate ? ` · <span class="tag" style="vertical-align:1px">${ICON.lock}Closed through ${U.fmtMonth(c.lockDate)}</span>` : ''}</div></div>
          <div class="actions">
            <button class="btn" data-nav="import">${ICON.upload}Import</button>
            <button class="btn" data-action="new-invoice">${ICON.plus}Invoice</button>
            <button class="btn primary" data-action="new-txn">${ICON.plus}Transaction</button>
          </div>
        </div>
        ${checklist(c)}
        <div class="kpis">
          <div class="card kpi hero" data-action="register" data-id="${banks[0] ? banks[0].id : ''}"><div class="label">${ICON.bank}Cash in the bank</div><div class="value">${money(cash)}</div><div class="delta">Across ${plural(banks.length, 'account')}${cards.length ? ` · ${money(cards.reduce((s, a) => s + bal.get(a.id), 0))} owed on cards` : ''}</div></div>
          <div class="card kpi" data-action="open-report" data-v="pl" data-period="ytd"><div class="label">Profit this year</div><div class="value ${plY.net < 0 ? 'neg' : ''}">${money(plY.net)}</div><div class="delta">${plY.totalIncome ? `Keeps ${((plY.net / plY.totalIncome) * 100).toFixed(1)}¢ of every dollar` : '&nbsp;'}</div></div>
          <div class="card kpi" data-action="open-report" data-v="pl" data-period="this-month"><div class="label">Income this month</div><div class="value">${money(plM.totalIncome)}</div><div class="delta">${delta(plM.totalIncome, plLM.totalIncome) || '&nbsp;'}</div></div>
          <div class="card kpi" data-action="inv-filter" data-v="open"><div class="label">Customers owe</div><div class="value">${money(arTotal)}</div><div class="delta">${plural(open.length, 'unpaid invoice')}${overdue.length ? ` · <span class="down">${overdue.length} overdue</span>` : ''}</div></div>
        </div>
        <div class="dash-grid">
          <div class="card"><div class="card-head"><h3>Income vs. expenses</h3><div class="legend" style="margin-left:auto"><span><i style="background:var(--accent)"></i>Income</span><span><i style="background:var(--gold)"></i>Expenses</span></div></div>
            <div class="card-body"><div class="chart">${barChart(months)}</div><div class="muted" style="margin-top:6px">Last 12 months · this month so far shown lighter · hover a month for details</div></div></div>
          <div class="card"><div class="card-head"><h3>Needs your attention</h3></div>
            <div class="card-body list-rows">${attention.length ? attention.join('') : `<div class="empty" style="padding:36px 10px"><div class="big">All caught up</div>Nothing needs you right now.</div>`}</div></div>
        </div>
        <div class="dash-grid three">
          <div class="card"><div class="card-head"><h3>Where the money went</h3><span class="muted">This year</span></div>
            <div class="card-body bars-list">${topExp.length ? topExp.map(x => `<div class="bar-row" data-action="drill" data-id="${x.a.id}" data-period="ytd"><div class="top"><span>${esc(x.a.name)}</span><span class="num">${money(x.v)}</span></div><div class="track"><div class="fill" style="width:${(x.v / maxExp * 100).toFixed(1)}%"></div></div></div>`).join('') : '<div class="muted">No expenses yet.</div>'}</div></div>
          <div class="card"><div class="card-head"><h3>Accounts</h3><button class="btn sm ghost" data-nav="accounts" style="margin-left:auto">All</button></div>
            <div class="card-body list-rows">${[...banks, ...cards].map(a => `<div class="row clickable-row" data-action="register" data-id="${a.id}"><span class="tag ${a.sub === 'credit' ? 'gold' : 'green'}">${a.sub === 'credit' ? ICON.card : ICON.bank}</span><div class="grow"><b>${esc(a.name)}</b><div class="muted">${a.sub === 'credit' ? 'Owed' : a.sub === 'clearing' ? 'Waiting to deposit' : 'Balance'}</div></div><div class="num" style="font-weight:600">${money(bal.get(a.id))}</div></div>`).join('') || '<div class="muted">No bank accounts yet.</div>'}</div></div>
          <div class="card"><div class="card-head"><h3>Latest activity</h3><button class="btn sm ghost" data-nav="transactions" style="margin-left:auto">All</button></div>
            <div class="card-body list-rows">${recent.length ? recent.map(t => `<div class="row clickable-row" data-action="edit-txn" data-id="${t.id}"><div class="grow" style="min-width:0"><div class="ellip" style="font-weight:550">${esc(t.payee || t.description)}</div><div class="muted">${fmtDateShort(t.date)}${t.status === 'review' ? ' · <span style="color:var(--warn)">needs review</span>' : ''}</div></div><div class="num">${signed(t.amount)}</div></div>`).join('') : '<div class="muted">Nothing yet — import a bank file to begin.</div>'}</div></div>
        </div>
        ${App.notesCard ? App.notesCard(c) : ''}`;
    }
  });
  act({
    'dismiss-checklist': () => { client().checklistDismissed = true; commit(); },
    'open-report': el => { S.ui.report.type = el.dataset.v; if (el.dataset.period) S.ui.report.period = el.dataset.period; go('reports'); }
  });

  // ------------------------------------------------------------------
  // To Review — keyboard friendly
  // ------------------------------------------------------------------
  // Pending choices on the review screen, so re-rendering never loses them
  const pending = new Map(); // txnId -> { categoryId, payee, rule }

  view('review', {
    render(c) {
      const list = c.transactions.filter(t => t.status === 'review').sort((a, b) => b.date.localeCompare(a.date));
      const rows = list.map(t => {
        const s = C.suggest(c, t);
        const p = pending.get(t.id) || {};
        return { t, s, cat: p.categoryId !== undefined ? p.categoryId : (s ? s.categoryId : ''), payee: p.payee !== undefined ? p.payee : (s && s.payee ? s.payee : (t.payee || C.cleanPayee(t.description))), rule: !!p.rule };
      });
      const ready = rows.filter(r => r.cat).length;
      if (S.ui.reviewFocus >= rows.length) S.ui.reviewFocus = Math.max(0, rows.length - 1);
      return `
        <div class="page-head">
          <div><h1>To review</h1><div class="sub">${list.length ? `${plural(list.length, 'transaction')} waiting. ${ready ? `<b class="gold-ink">${ready} already ${ready === 1 ? 'has' : 'have'} a category</b> — check and accept.` : 'Pick a category for each one.'}` : 'Everything is sorted.'}</div></div>
          <div class="actions">
            <button class="btn" data-nav="import">${ICON.upload}Import</button>
            ${ready ? `<button class="btn gold" data-action="accept-all">${ICON.check}Accept ${ready} ready</button>` : ''}
          </div>
        </div>
        ${list.length ? `<div class="hint-bar">${ICON.keyboard}<span><span class="kbd">↑</span><span class="kbd">↓</span> move · <span class="kbd">Enter</span> accept · <span class="kbd">C</span> change category · <span class="kbd">S</span> split · <span class="kbd">Del</span> exclude</span></div>
        <div class="review-list">${rows.map(({ t, s, cat, payee, rule }, i) => {
          const acc = C.acct(c, t.accountId);
          return `<div class="card review-item ${i === S.ui.reviewFocus ? 'focus' : ''}" data-rid="${t.id}" data-i="${i}">
            <div class="ri-date"><b>${U.friendlyDate(t.date)}</b><div class="muted">${esc(acc ? acc.name : '')}</div></div>
            <div style="min-width:0">
              <input class="input sm payee-input" data-input="review-payee" data-id="${t.id}" value="${esc(payee)}" aria-label="Payee" title="Who was it? Edit to tidy the name">
              <div class="desc-sub ellip" style="margin-top:5px" title="${esc(t.description)}">${esc(t.description)}</div>
            </div>
            <div>
              <button class="cat-btn ${cat ? '' : 'empty'}" data-action="review-pick" data-id="${t.id}" data-menu>${cat ? esc(catName(c, cat)) : 'Choose a category'}${ICON.chev}</button>
              ${s && cat === s.categoryId ? `<div class="suggest ${s.source === 'guess' ? 'soft' : ''}">${{ rule: ICON.bolt + 'From a smart rule', history: ICON.spark + 'Same as last time', guess: ICON.spark + 'Best guess — please check', you: ICON.check + 'You chose this when importing', invoice: ICON.file + `Pays invoice ${esc(s.docNumber || '')}${s.payee ? ' from ' + esc(s.payee) : ''}`, bill: ICON.file + `Pays the ${esc(s.payee || '')} bill${s.docNumber ? ' ' + esc(s.docNumber) : ''}` }[s.source]}</div>` : cat ? `<label class="check small"><input type="checkbox" data-action="review-rule" data-id="${t.id}" ${rule ? 'checked' : ''}>Always use for “${esc(C.keyOf(t.description) || 'this')}”</label>` : '<div class="muted small-note">Press C or click to choose</div>'}
            </div>
            <div class="amt ${t.amount > 0 ? 'pos' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</div>
            <div class="ri-actions">
              <button class="icon-btn" title="Split across categories" data-action="review-split" data-id="${t.id}">${ICON.split}</button>
              <button class="icon-btn" title="Exclude (duplicate or personal)" data-action="exclude-txn" data-id="${t.id}">${ICON.trash}</button>
              <button class="btn primary sm" data-action="accept-txn" data-id="${t.id}" ${cat ? '' : 'disabled'}>${ICON.check}Accept</button>
            </div>
          </div>`;
        }).join('')}</div>` : `<div class="card"><div class="empty"><div class="big">You're all caught up</div>New bank activity lands here after you import a file.<div style="margin-top:16px"><button class="btn primary" data-nav="import">${ICON.upload}Import a file</button></div></div></div>`}`;
    },
    key(e, c) {
      const items = $$('.review-item');
      if (!items.length) return;
      const cur = items[S.ui.reviewFocus] || items[0];
      const move = d => { S.ui.reviewFocus = Math.min(items.length - 1, Math.max(0, S.ui.reviewFocus + d)); items.forEach((el, i) => el.classList.toggle('focus', i === S.ui.reviewFocus)); items[S.ui.reviewFocus].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); actions['accept-txn']({ dataset: { id: cur.dataset.rid } }); }
      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); cur.querySelector('.cat-btn').click(); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); actions['review-split']({ dataset: { id: cur.dataset.rid } }); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); actions['exclude-txn']({ dataset: { id: cur.dataset.rid } }); }
    }
  });

  function reviewChoice(c, t) {
    const p = pending.get(t.id) || {};
    const s = C.suggest(c, t);
    return {
      doc: s && (s.invoiceId || s.billId) && (p.categoryId === undefined || p.categoryId === s.categoryId) ? s : null,
      categoryId: p.categoryId !== undefined ? p.categoryId : (s ? s.categoryId : ''),
      payee: (p.payee !== undefined ? p.payee : (s && s.payee ? s.payee : (t.payee || C.cleanPayee(t.description)))).trim(),
      rule: !!p.rule
    };
  }
  function acceptOne(c, t) {
    const ch = reviewChoice(c, t);
    if (!ch.categoryId || !C.acct(c, ch.categoryId) || ch.categoryId === t.accountId) return false;
    t.categoryId = ch.categoryId;
    t.payee = ch.payee || t.payee;
    t.status = 'posted';
    if (ch.doc && ch.doc.invoiceId) { t.invoiceId = ch.doc.invoiceId; t.memo = t.memo || `Payment for ${ch.doc.docNumber}`; }
    if (ch.doc && ch.doc.billId) { t.billId = ch.doc.billId; t.vendorId = ch.doc.vendorId; }
    delete t.splits;
    if (ch.rule) {
      const text = C.keyOf(t.description);
      if (text && !c.rules.some(r => C.normName(r.text) === C.normName(text))) c.rules.push({ id: C.uid(), text, categoryId: ch.categoryId, payee: t.payee, direction: 'any', autoAccept: false });
    }
    pending.delete(t.id);
    return true;
  }

  act({
    'review-pick': el => {
      const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (!t) return;
      const idx = $$('.review-item').findIndex(x => x.dataset.rid === t.id); if (idx >= 0) S.ui.reviewFocus = idx;
      U.categoryPicker(el, c, { selected: reviewChoice(c, t).categoryId, excludeId: t.accountId, amount: t.amount, onPick: id => { pending.set(t.id, Object.assign(pending.get(t.id) || {}, { categoryId: id })); render(); } });
    },
    'input:review-payee': el => { pending.set(el.dataset.id, Object.assign(pending.get(el.dataset.id) || {}, { payee: el.value })); },
    'review-rule': el => { pending.set(el.dataset.id, Object.assign(pending.get(el.dataset.id) || {}, { rule: el.checked })); },
    'review-split': el => { const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (t) txnModal(c, t, { startSplit: true }); },
    'accept-txn': async el => {
      const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (!t) return;
      if (!reviewChoice(c, t).categoryId) { U.toast('Pick a category first — press C or click the category box', null, 'warn'); return; }
      if (!await guardLock(c, t.date)) return;
      const row = $(`[data-rid="${t.id}"]`);
      const undo = snapshot(c);
      acceptOne(c, t);
      save();
      const after = () => { render(); };
      if (row) { row.classList.add('leaving'); setTimeout(after, 170); } else after();
      U.toast(`${t.payee || 'Transaction'} → ${catName(c, t.categoryId)}`, undo);
    },
    'accept-all': async () => {
      const c = client();
      const list = c.transactions.filter(t => t.status === 'review' && reviewChoice(c, t).categoryId);
      if (!list.length) return;
      if (!await guardLock(c, ...list.map(t => t.date))) return;
      const undo = snapshot(c);
      let n = 0; for (const t of list) if (acceptOne(c, t)) n++;
      commit();
      U.toast(`${plural(n, 'transaction')} categorized`, undo);
    },
    'exclude-txn': async el => {
      const c = client(); const idx = c.transactions.findIndex(t => t.id === el.dataset.id); if (idx < 0) return;
      if (!await guardLock(c, c.transactions[idx].date)) return;
      const undo = snapshot(c);
      c.transactions.splice(idx, 1); commit();
      U.toast('Removed from the books', undo);
    }
  });

  // ------------------------------------------------------------------
  // Transactions — with bulk changes and quick re-categorizing
  // ------------------------------------------------------------------
  function registerRows(c, f) {
    const range = f.period === 'all' ? {} : App.range(f.period, c);
    const q = f.q.trim().toLowerCase().replace(/[$,]/g, '');
    const acc = f.account !== 'all' ? C.acct(c, f.account) : null;
    if (f.account !== 'all' && !acc) f.account = 'all';
    let rows = [];
    for (const t of c.transactions) {
      let amt = t.amount, isTransferSide = false;
      if (acc) {
        if (t.accountId === acc.id) amt = t.amount;
        else if (t.status !== 'review' && (t.splits && t.splits.length ? t.splits.some(sp => sp.categoryId === acc.id) : t.categoryId === acc.id)) {
          amt = -(t.splits && t.splits.length ? t.splits.filter(sp => sp.categoryId === acc.id).reduce((s2, sp) => s2 + sp.amount, 0) : t.amount); isTransferSide = true;
        } else continue;
      }
      rows.push({ t, amt: C.round2(amt), isTransferSide });
    }
    rows.sort((a, b) => a.t.date.localeCompare(b.t.date) || (a.t.id < b.t.id ? -1 : 1));
    if (acc) {
      // running balance over every row of the account (cash for banks, amount owed for cards), before any filter
      let run = (acc.opening || 0);
      const debit = C.isDebitNormal(acc.type);
      for (const r of rows) { run = C.round2(run + (debit ? r.amt : -r.amt)); r.run = run; }
    }
    rows = rows.filter(({ t, amt }) => {
      if (range.from && (t.date < range.from || t.date > range.to)) return false;
      if (f.category && t.categoryId !== f.category && !(t.splits || []).some(sp => sp.categoryId === f.category)) return false;
      if (f.type === 'in' && amt <= 0) return false;
      if (f.type === 'out' && amt >= 0) return false;
      if (f.type === 'review' && t.status !== 'review') return false;
      if (q) { const hay = `${t.description} ${t.payee} ${t.memo} ${catName(c, t.categoryId)} ${Math.abs(t.amount).toFixed(2)}`.toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    return rows.reverse();
  }
  App.registerRows = registerRows;

  const PERIODS = [['this-month', 'This month'], ['last-month', 'Last month'], ['this-quarter', 'This quarter'], ['last-quarter', 'Last quarter'], ['ytd', 'This year'], ['last-year', 'Last year'], ['last-12', 'Last 12 months'], ['all', 'All dates']];
  App.PERIODS = PERIODS;

  view('transactions', {
    render(c) {
      const f = S.ui.txn;
      const rows = registerRows(c, f);
      const accSel = f.account !== 'all' ? C.acct(c, f.account) : null;
      const catSel = f.category ? C.acct(c, f.category) : null;
      const totIn = rows.filter(r => r.amt > 0).reduce((s, r) => s + r.amt, 0);
      const totOut = rows.filter(r => r.amt < 0).reduce((s, r) => s + r.amt, 0);
      const shown = rows.slice(0, 400);
      const ids = new Set(c.transactions.map(t => t.id));
      for (const id of [...f.selected]) if (!ids.has(id)) f.selected.delete(id);
      const sel = f.selected.size;
      const allChecked = shown.length && shown.every(r => f.selected.has(r.t.id));
      return `
        <div class="page-head">
          <div><h1>${accSel ? esc(accSel.name) : 'Transactions'}</h1>
          <div class="sub">${plural(rows.length, 'transaction')} · <span class="pos">${money(totIn)} in</span> · ${money(Math.abs(totOut))} out${catSel ? ` · showing <b>${esc(catSel.name)}</b> <a href="#" data-action="clear-cat" class="link">show all</a>` : ''}</div></div>
          <div class="actions">
            <button class="btn" data-action="export-txns">${ICON.download}Export</button>
            <button class="btn" data-nav="import">${ICON.upload}Import</button>
            <button class="btn primary" data-action="new-txn">${ICON.plus}Add transaction</button>
          </div>
        </div>
        <div class="card">
          <div class="toolbar">
            <select class="input sm" style="width:210px" data-change="txn-account" aria-label="Account"><option value="all">All accounts</option>${accountOptions(moneyAccounts(c), f.account)}</select>
            <select class="input sm" style="width:160px" data-change="txn-period" aria-label="Dates">${PERIODS.some(p => p[0] === f.period) ? '' : `<option value="${esc(f.period)}" selected>${esc(App.range(f.period, c).label)}</option>`}${PERIODS.map(([k, l]) => `<option value="${k}" ${f.period === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <div class="seg">${[['all', 'All'], ['in', 'Money in'], ['out', 'Money out'], ['review', 'Needs review']].map(([k, l]) => `<button class="${f.type === k ? 'on' : ''}" data-action="txn-type" data-v="${k}">${l}</button>`).join('')}</div>
            <div class="grow"></div>
            <div class="search-inline">${ICON.search}<input class="input sm" placeholder="Find a payee, amount, memo…" value="${esc(f.q)}" data-input="txn-q" id="txn-q"></div>
          </div>
          ${sel ? `<div class="bulk-bar"><b>${plural(sel, 'transaction')} selected</b><button class="btn sm" data-action="bulk-cat" data-menu>Change category</button><button class="btn sm" data-action="bulk-clear">Mark cleared</button><button class="btn sm danger" data-action="bulk-del">${ICON.trash}Delete</button><button class="btn sm ghost" data-action="bulk-none">Clear selection</button></div>` : ''}
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th style="width:38px"><input type="checkbox" class="cb" data-action="bulk-all" ${allChecked ? 'checked' : ''} aria-label="Select all shown"></th><th style="width:108px">Date</th><th>Payee</th><th>Category</th>${accSel ? '' : '<th>Account</th>'}<th class="num">Amount</th>${accSel ? `<th class="num">${accSel.sub === 'credit' ? 'Owed' : 'Balance'}</th>` : ''}<th style="width:30px"></th></tr></thead>
            <tbody>${shown.length ? shown.map(({ t, amt, run, isTransferSide }) => {
              const cat = isTransferSide ? C.acct(c, t.accountId) : C.acct(c, t.categoryId);
              const acc = C.acct(c, t.accountId);
              let catTag;
              if (t.status === 'review') catTag = `<span class="tag gold"><span class="dot"></span>Needs review</span>`;
              else if (!isTransferSide && t.splits && t.splits.length > 1) catTag = `<span class="tag blue">${ICON.split}Split · ${t.splits.length} categories</span>`;
              else if (cat) catTag = `<button class="tag-btn tag ${cat.type === 'income' ? 'green' : cat.type === 'expense' ? '' : 'blue'}" ${isTransferSide || t.invoiceId ? '' : `data-action="quick-cat" data-id="${t.id}" data-menu title="Change category"`}>${isTransferSide ? 'From ' : ''}${esc(cat.name)}</button>`;
              else catTag = '';
              return `<tr class="clickable ${f.selected.has(t.id) ? 'selected' : ''}" data-action="edit-txn" data-id="${t.id}">
                <td data-stop><input type="checkbox" class="cb" data-action="bulk-one" data-id="${t.id}" ${f.selected.has(t.id) ? 'checked' : ''} aria-label="Select"></td>
                <td class="muted">${fmtDate(t.date)}</td>
                <td><div class="desc-main">${esc(t.payee || C.cleanPayee(t.description))}</div><div class="desc-sub ellip">${esc(t.description)}${t.invoiceId ? ' · invoice payment' : ''}${t.memo ? ' · ' + esc(t.memo) : ''}</div></td>
                <td data-stop>${catTag}</td>
                ${accSel ? '' : `<td class="muted">${esc(acc ? acc.name : '')}</td>`}
                <td class="num" style="font-weight:600">${signed(amt)}</td>
                ${accSel ? `<td class="num muted">${run != null ? money(run) : ''}</td>` : ''}
                <td>${t.attachments && t.attachments.length ? `<span title="${t.attachments.length} attached" class="clip-ic">${ICON.clip}</span>` : ''}${C.isLocked(c, t.date) || t.reconciled ? `<span title="${t.reconciled ? 'Reconciled' : 'In a closed month'}" class="lock-ic">${ICON.lock}</span>` : t.cleared ? '<span title="Cleared" class="muted" style="font-weight:700">C</span>' : ''}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="8"><div class="empty"><div class="big">No transactions here</div>Try another account or date range${f.q ? ', or clear the search' : ''}.</div></td></tr>`}</tbody>
          </table></div>
          ${rows.length > 400 ? `<div class="muted" style="padding:12px 16px">Showing the 400 newest of ${rows.length}. Pick a shorter date range to see the rest.</div>` : ''}
        </div>`;
    }
  });

  act({
    'change:txn-account': el => { S.ui.txn.account = el.value; render(); },
    'change:txn-period': el => { S.ui.txn.period = el.value; render(); },
    'txn-type': el => { S.ui.txn.type = el.dataset.v; render(); },
    'clear-cat': () => { S.ui.txn.category = ''; render(); },
    'register': el => { if (!el.dataset.id) return go('transactions'); Object.assign(S.ui.txn, { account: el.dataset.id, category: '', type: 'all', q: '', period: 'last-12' }); go('transactions'); },
    'drill': el => { Object.assign(S.ui.txn, { account: 'all', category: el.dataset.id, type: 'all', q: '', period: el.dataset.period || S.ui.report.period || 'ytd' }); go('transactions'); },
    'bulk-one': (el, e) => { e.stopPropagation(); const s = S.ui.txn.selected; el.checked ? s.add(el.dataset.id) : s.delete(el.dataset.id); render(); },
    'bulk-all': el => { const rows = registerRows(client(), S.ui.txn).slice(0, 400); const s = S.ui.txn.selected; rows.forEach(r => el.checked ? s.add(r.t.id) : s.delete(r.t.id)); render(); },
    'bulk-none': () => { S.ui.txn.selected.clear(); render(); },
    'bulk-cat': el => {
      const c = client();
      U.categoryPicker(el, c, { onPick: async id => {
        const list = c.transactions.filter(t => S.ui.txn.selected.has(t.id) && !t.invoiceId);
        if (!await guardLock(c, ...list.map(t => t.date))) return;
        const undo = snapshot(c);
        list.forEach(t => { if (t.accountId === id) return; t.categoryId = id; t.status = 'posted'; delete t.splits; });
        S.ui.txn.selected.clear(); commit(); U.toast(`${plural(list.length, 'transaction')} moved to ${catName(c, id)}`, undo);
      } });
    },
    'bulk-clear': () => { const c = client(); const undo = snapshot(c); let n = 0; c.transactions.forEach(t => { if (S.ui.txn.selected.has(t.id)) { t.cleared = true; n++; } }); S.ui.txn.selected.clear(); commit(); U.toast(`${plural(n, 'transaction')} marked cleared`, undo); },
    'bulk-del': async () => {
      const c = client(); const ids = S.ui.txn.selected;
      const list = c.transactions.filter(t => ids.has(t.id));
      if (!await U.confirmBox({ title: `Delete ${plural(list.length, 'transaction')}?`, body: 'They will be removed from the books. You can undo right after.', ok: 'Delete', danger: true })) return;
      if (!await guardLock(c, ...list.map(t => t.date))) return;
      const undo = snapshot(c);
      c.transactions = c.transactions.filter(t => !ids.has(t.id)); ids.clear(); commit(); U.toast(`${plural(list.length, 'transaction')} deleted`, undo);
    },
    'quick-cat': (el, e) => {
      e.stopPropagation();
      const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (!t) return;
      U.categoryPicker(el, c, { selected: t.categoryId, excludeId: t.accountId, amount: t.amount, onPick: async id => {
        if (!await guardLock(c, t.date)) return;
        const undo = snapshot(c); t.categoryId = id; t.status = 'posted'; delete t.splits; commit(); U.toast(`Moved to ${catName(c, id)}`, undo);
      } });
    },
    'input:txn-q': (() => { let tm; return el => { clearTimeout(tm); tm = setTimeout(() => { const pos = el.selectionStart; S.ui.txn.q = el.value; render(); const inp = $('#txn-q'); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); } }, 220); }; })(),
    'export-txns': () => {
      const c = client(); const rows = registerRows(c, S.ui.txn).reverse();
      const csv = C.toCSV([['Date', 'Payee', 'Bank description', 'Category', 'Account', 'Amount', 'Memo', 'Status'], ...rows.map(({ t, amt }) => [t.date, t.payee, t.description, t.status === 'review' ? 'Needs review' : (t.splits && t.splits.length > 1 ? 'Split: ' + t.splits.map(s => `${catName(c, s.categoryId)} ${s.amount.toFixed(2)}`).join('; ') : catName(c, t.categoryId)), catName(c, t.accountId), amt.toFixed(2), t.memo, t.reconciled ? 'Reconciled' : t.cleared ? 'Cleared' : ''])]);
      U.downloadText(`${c.name} transactions.csv`, csv);
    },
    'new-txn': () => { const c = client(); if (!c) return actions['new-client'](); txnModal(c); },
    'edit-txn': (el, e) => {
      if (e && e.target && e.target.closest('[data-stop]')) return;
      const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (t) txnModal(c, t);
    }
  });

  // ------------------------------------------------------------------
  // Transaction window — add, edit, split
  // ------------------------------------------------------------------
  function txnModal(c, t, opts = {}) {
    const isNew = !t;
    const banks = moneyAccounts(c);
    if (!banks.length) { U.toast('Add a bank or card account first (Chart of Accounts)', null, 'warn'); return; }
    const d = t ? JSON.parse(JSON.stringify(t)) : { id: C.uid(), date: today(), description: '', payee: '', amount: 0, accountId: banks[0].id, categoryId: '', memo: '', status: 'posted', cleared: false, reconciled: false };
    if (d.status === 'review' && !d.categoryId) { const s = C.suggest(c, d); if (s) d.categoryId = s.categoryId; }
    let dir = d.amount > 0 ? 1 : -1;
    // split amounts are shown in the transaction's own direction, so a fee inside a day of sales shows as a minus
    let splits = d.splits && d.splits.length ? d.splits.map(s => ({ ...s, amount: C.round2(s.amount * dir) })) : null;
    if (opts.startSplit && !splits) splits = [{ id: C.uid(), categoryId: d.categoryId || '', amount: Math.abs(d.amount) }, { id: C.uid(), categoryId: '', amount: 0 }];
    const inv = d.invoiceId && c.invoices.find(i => i.id === d.invoiceId);
    const locked = !isNew && C.isLocked(c, d.date);

    const m = U.openModal(`${U.modalHead(isNew ? 'New transaction' : (d.status === 'review' ? 'Review transaction' : 'Transaction'), locked ? `${ICON.lock} In a closed month (through ${fmtDate(c.lockDate)})` : '')}
      <div class="modal-body">
        <div class="seg big-seg" style="align-self:flex-start"><button class="${dir < 0 ? 'on' : ''}" data-dir="out">Money out</button><button class="${dir > 0 ? 'on' : ''}" data-dir="in">Money in</button></div>
        <div class="grid2">
          <div class="field"><label for="t-amt">Amount</label><div class="amt-wrap"><span>$</span><input class="input" id="t-amt" inputmode="decimal" value="${d.amount ? Math.abs(d.amount).toFixed(2) : ''}" placeholder="0.00" autofocus></div></div>
          <div class="field"><label for="t-date">Date</label><input type="date" class="input" id="t-date" value="${d.date}"></div>
          <div class="field"><label for="t-payee">Payee</label><input class="input" id="t-payee" value="${esc(d.payee)}" placeholder="Who was it paid to or from?" list="payee-list"><datalist id="payee-list">${[...new Set(c.transactions.map(x => x.payee).filter(Boolean))].slice(0, 300).map(p => `<option value="${esc(p)}">`).join('')}${c.contacts.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist></div>
          <div class="field"><label for="t-acc">${dir < 0 ? 'Paid from' : 'Deposited to'}</label><select class="input" id="t-acc">${accountOptions(banks, d.accountId)}</select></div>
        </div>
        <div class="field" id="cat-wrap"></div>
        <div class="field"><label for="t-memo">Note</label><input class="input" id="t-memo" value="${esc(d.memo || '')}" placeholder="Optional — for you or the client"></div>
        <div id="att-wrap"></div>
        <details ${isNew ? '' : 'open'} class="more"><summary>Bank description${d.description ? '' : ' (optional)'}</summary><input class="input" id="t-desc" value="${esc(d.description)}" placeholder="As it appears on the statement" style="margin-top:8px"></details>
        ${!isNew && !inv ? `<label class="check" id="rule-wrap"><input type="checkbox" id="t-rule">Use this category for similar transactions from now on (smart rule)</label>` : ''}
      </div>
      <div class="modal-foot">
        ${!isNew ? `<button class="btn danger left" data-x="del">${ICON.trash}Delete</button>` : '<span class="left"></span>'}
        <button class="btn" data-action="close-modal">Cancel</button>
        ${!isNew && d.status === 'review' ? `<button class="btn primary" data-x="save">${ICON.check}Accept</button>` : `<button class="btn primary" data-x="save">${ICON.check}${isNew ? 'Add transaction' : 'Save'}</button>`}
      </div>`);

    const amtNow = () => Math.abs(C.parseAmount($('#t-amt', m).value) || 0);
    const drawCat = () => {
      const w = $('#cat-wrap', m);
      if (inv) { w.innerHTML = `<label>Category</label><div class="note">${ICON.file} Payment for invoice <b>${esc(inv.number)}</b> — it reduces what the customer owes.</div>`; return; }
      if (!splits) {
        w.innerHTML = `<div class="label-row"><label>Category</label><a href="#" class="link" id="go-split">${ICON.split} Split</a></div><button class="cat-btn big ${d.categoryId ? '' : 'empty'}" id="t-cat" data-menu>${d.categoryId ? esc(catName(c, d.categoryId)) : 'Choose a category'}${ICON.chev}</button>`;
        $('#t-cat', m).onclick = e => { e.preventDefault(); U.categoryPicker(e.currentTarget, c, { selected: d.categoryId, excludeId: $('#t-acc', m).value, amount: dir, allowClear: true, onPick: id => { d.categoryId = id; drawCat(); } }); };
        $('#go-split', m).onclick = e => { e.preventDefault(); splits = [{ id: C.uid(), categoryId: d.categoryId || '', amount: amtNow() }, { id: C.uid(), categoryId: '', amount: 0 }]; drawCat(); };
        return;
      }
      const total = amtNow();
      const used = C.round2(splits.reduce((s, x) => s + (+x.amount || 0), 0));
      const left = C.round2(total - used);
      w.innerHTML = `<div class="label-row"><label>Split across categories</label><a href="#" class="link" id="no-split">Use one category</a></div>
        <div class="split-list">${splits.map((sp, i) => `<div class="split-row" data-i="${i}"><button class="cat-btn ${sp.categoryId ? '' : 'empty'}" data-sp="${i}" data-menu>${sp.categoryId ? esc(catName(c, sp.categoryId)) : 'Choose a category'}${ICON.chev}</button><div class="amt-wrap sm"><span>$</span><input class="input sm" data-sa="${i}" value="${sp.amount ? (+sp.amount).toFixed(2) : ''}" placeholder="0.00" inputmode="decimal"></div><button class="icon-btn" data-sr="${i}" title="Remove line">${ICON.close}</button></div>`).join('')}</div>
        <div class="split-foot"><a href="#" class="link" id="add-split">${ICON.plus} Add a line</a><span class="${Math.abs(left) < 0.005 ? 'pos' : 'neg'}" id="split-left">${Math.abs(left) < 0.005 ? `${ICON.check} Adds up to ${money(total)}` : left > 0 ? `${money(left)} left to assign` : `${money(-left)} too much`}</span></div>`;
      $('#no-split', m).onclick = e => { e.preventDefault(); d.categoryId = splits[0] && splits[0].categoryId || d.categoryId; splits = null; drawCat(); };
      $('#add-split', m).onclick = e => { e.preventDefault(); splits.push({ id: C.uid(), categoryId: '', amount: Math.max(0, left) }); drawCat(); };
      $$('[data-sp]', w).forEach(b => b.onclick = e => { e.preventDefault(); const i = +b.dataset.sp; U.categoryPicker(b, c, { selected: splits[i].categoryId, excludeId: $('#t-acc', m).value, amount: dir, onPick: id => { splits[i].categoryId = id; drawCat(); } }); });
      $$('[data-sa]', w).forEach(inp => { inp.oninput = () => { splits[+inp.dataset.sa].amount = C.parseAmount(inp.value) || 0; const used2 = C.round2(splits.reduce((s, x) => s + (+x.amount || 0), 0)); const l2 = C.round2(amtNow() - used2); const el = $('#split-left', m); el.className = Math.abs(l2) < 0.005 ? 'pos' : 'neg'; el.innerHTML = Math.abs(l2) < 0.005 ? `${ICON.check} Adds up to ${money(amtNow())}` : l2 > 0 ? `${money(l2)} left to assign` : `${money(-l2)} too much`; }; });
      $$('[data-sr]', w).forEach(b => b.onclick = e => { e.preventDefault(); splits.splice(+b.dataset.sr, 1); if (splits.length < 2) { d.categoryId = splits[0] ? splits[0].categoryId : d.categoryId; splits = null; } drawCat(); });
    };
    drawCat();
    const attTarget = isNew ? d : (c.transactions.find(x => x.id === t.id) || d);
    const drawAtt = () => { const w = $('#att-wrap', m); w.innerHTML = App.attach.attachStrip(attTarget); App.attach.wireStrip(w, attTarget, drawAtt); };
    drawAtt();
    $('#t-amt', m).addEventListener('change', () => { if (splits) drawCat(); });
    $$('[data-dir]', m).forEach(b => b.onclick = () => { dir = b.dataset.dir === 'out' ? -1 : 1; $$('[data-dir]', m).forEach(x => x.classList.toggle('on', x === b)); m.querySelector('label[for=t-acc]').textContent = dir < 0 ? 'Paid from' : 'Deposited to'; });

    m.querySelector('[data-x=save]').onclick = async () => {
      const amt = amtNow();
      if (!amt && !splits) { $('#t-amt', m).focus(); return U.toast('Enter the amount', null, 'warn'); }
      const date = $('#t-date', m).value;
      if (!date) return U.toast('Pick a date', null, 'warn');
      if (splits) {
        const used = C.round2(splits.reduce((s, x) => s + (+x.amount || 0), 0));
        if (Math.abs(used - amt) > 0.004) return U.toast('The split lines need to add up to the amount', null, 'warn');
        if (splits.some(s => !s.categoryId && +s.amount)) return U.toast('Choose a category for every split line', null, 'warn');
      }
      if (!await guardLock(c, date, isNew ? null : t.date)) return;
      const undo = snapshot(c);
      const rec = isNew ? d : c.transactions.find(x => x.id === t.id);
      if (!rec) return U.closeModal();
      rec.date = date;
      rec.amount = C.round2(amt * dir);
      rec.payee = $('#t-payee', m).value.trim();
      rec.description = $('#t-desc', m).value.trim() || rec.description || rec.payee || 'Manual entry';
      rec.accountId = $('#t-acc', m).value;
      rec.memo = $('#t-memo', m).value.trim();
      if (!inv) {
        if (splits) {
          const lines = splits.filter(s => +s.amount && s.categoryId);
          rec.splits = lines.map(s => ({ id: s.id || C.uid(), categoryId: s.categoryId, amount: C.round2(s.amount * dir) }));
          rec.categoryId = lines[0].categoryId;
          rec.status = 'posted';
        } else {
          delete rec.splits;
          rec.categoryId = d.categoryId && d.categoryId !== rec.accountId ? d.categoryId : null;
          rec.status = rec.categoryId ? 'posted' : 'review';
        }
      }
      if (isNew) { c.transactions.push(rec); c.transactions.sort((a, b) => a.date.localeCompare(b.date)); }
      const rule = $('#t-rule', m);
      if (rule && rule.checked && rec.categoryId && !rec.splits) {
        const text = C.keyOf(rec.description);
        if (text && !c.rules.some(r => C.normName(r.text) === C.normName(text))) c.rules.push({ id: C.uid(), text, categoryId: rec.categoryId, payee: rec.payee, direction: 'any', autoAccept: false });
      }
      pending.delete(rec.id);
      U.closeModal(); commit();
      U.toast(isNew ? 'Transaction added' : rec.status === 'posted' && t.status === 'review' ? 'Accepted' : 'Saved', undo);
    };
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => {
      if (!await guardLock(c, t.date)) return;
      const undo = snapshot(c);
      c.transactions = c.transactions.filter(x => x.id !== t.id);
      U.closeModal(); commit();
      U.toast('Transaction deleted', undo);
    };
  }
  App.txnModal = txnModal;
})();
