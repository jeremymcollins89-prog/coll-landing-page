'use strict';
/* =====================================================================
   Coll Ledger — Planning: cash-flow forecast, budget vs. actual,
   owner pay and quarterly tax set-asides
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save } = App;
  const { $, $$, esc, money, moneyShort, fmtDate, fmtDateShort, ICON, plural } = U;
  const today = App.today;
  S.ui.plan = S.ui.plan || { tab: 'cash', days: 90, typical: true, period: 'ytd', taxYear: null };

  const TABS = [['cash', 'Cash flow'], ['budget', 'Budget'], ['owner', 'Owner pay & taxes']];

  view('planning', {
    render(c) {
      const P = S.ui.plan;
      const body = P.tab === 'budget' ? budgetTab(c) : P.tab === 'owner' ? ownerTab(c) : cashTab(c);
      return `
        <div class="page-head">
          <div><h1>Planning</h1><div class="sub">Look ahead for ${esc(c.name)} — what cash will do, how spending compares to plan, and what to set aside for taxes.</div></div>
        </div>
        <div class="seg tabs-seg" role="tablist">${TABS.map(([k, l]) => `<button role="tab" class="${P.tab === k ? 'on' : ''}" data-action="plan-tab" data-v="${k}">${l}</button>`).join('')}</div>
        ${body}`;
    }
  });

  // ------------------------------------------------------------------
  // Cash flow
  // ------------------------------------------------------------------
  function lineChart(series, events) {
    const W = 900, H = 260, padL = 64, padR = 12, padT = 16, padB = 30;
    const vals = series.map(p => p.bal);
    const mn = Math.min(...vals);
    let lo = Math.min(0, mn), hi = Math.max(1, ...vals);
    const span = hi - lo || 1; if (mn < 0) lo -= span * 0.06; hi += span * 0.06;
    const x = i => padL + (W - padL - padR) * i / Math.max(1, series.length - 1);
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    let grid = '';
    for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, yy = y(v); grid += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${padL - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${moneyShort(v)}</text>`; }
    const zero = lo < 0 ? `<line x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}" stroke="var(--neg)" stroke-width="1.2"/><text x="${W - padR}" y="${y(0) - 5}" text-anchor="end" font-size="11" fill="var(--neg)">$0</text>` : '';
    const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.bal).toFixed(1)}`).join(' ');
    const area = `${x(0)},${H - padB} ${pts} ${x(series.length - 1)},${H - padB}`;
    const ticks = series.map((p, i) => ({ p, i })).filter(({ p, i }) => i === 0 || (p.date.slice(8) === '01' && i > 7)).map(({ p, i }) => `<text x="${x(i)}" y="${H - 9}" text-anchor="${i === 0 ? 'start' : 'middle'}" font-size="11" fill="var(--ink-3)">${i === 0 ? 'Today' : C.parseISO(p.date).toLocaleDateString('en-US', { month: 'short' })}</text><line x1="${x(i)}" x2="${x(i)}" y1="${H - padB}" y2="${H - padB + 4}" stroke="var(--line-strong)"/>`).join('');
    const idx = new Map(series.map((p, i) => [p.date, i]));
    const dots = events.filter(e => idx.has(e.date)).map(e => { const i = idx.get(e.date); return `<circle cx="${x(i)}" cy="${y(series[i].bal)}" r="4" fill="${e.amount > 0 ? 'var(--accent)' : 'var(--gold)'}" stroke="var(--surface)" stroke-width="2"><title>${esc(fmtDate(e.date))}: ${esc(e.label)} ${e.amount > 0 ? '+' : '−'}${money(Math.abs(e.amount))}</title></circle>`; }).join('');
    // invisible hover columns for weekly values
    const hov = series.map((p, i) => i % 7 === 0 || i === series.length - 1 ? `<rect x="${x(i) - 6}" y="${padT}" width="12" height="${H - padT - padB}" fill="transparent"><title>${fmtDate(p.date)}: ${money(p.bal)}</title></rect>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="line-chart" role="img" aria-label="Projected cash balance">
      <defs><linearGradient id="cfg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${grid}${zero}<polygon points="${area}" fill="url(#cfg)"/><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${ticks}${dots}${hov}</svg>`;
  }

  function cashTab(c) {
    const P = S.ui.plan;
    const f = C.forecast(c, { days: P.days, typical: P.typical });
    const short = f.low.bal < 0;
    let run = f.start;
    const daily = f.daily;
    const rows = f.events.map(e => {
      run = C.round2(f.start + C.daysBetween(today(), e.date) * daily + f.events.filter(x => x.date < e.date || (x.date === e.date && f.events.indexOf(x) <= f.events.indexOf(e))).reduce((s, x) => s + x.amount, 0));
      const kind = { invoice: 'Invoice', bill: 'Bill', 'recur-in': 'Repeating invoice', 'recur-out': 'Repeating bill' }[e.kind];
      const act = e.kind === 'invoice' ? `data-action="edit-invoice" data-id="${e.id}"` : e.kind === 'bill' ? `data-action="edit-bill" data-id="${e.id}"` : '';
      return `<tr class="${act ? 'clickable' : ''}" ${act}><td class="muted">${fmtDate(e.date)}</td><td><b style="font-weight:600">${esc(e.label)}</b><div class="muted" style="font-size:12px">${kind}${e.late ? ' · overdue — expected soon' : ''}</div></td>
        <td class="num pos">${e.amount > 0 ? money(e.amount) : ''}</td><td class="num">${e.amount < 0 ? money(-e.amount) : ''}</td><td class="num ${run < 0 ? 'neg' : ''}" style="font-weight:600">${money(run)}</td></tr>`;
    }).join('');
    return `
      ${short ? `<div class="practice-banner warn-banner">${ICON.alert}<span><b>Cash could run short around ${fmtDate(f.low.date)}</b> — the balance dips to ${money(f.low.bal)}. Chasing overdue invoices or moving a bill date would help.</span></div>` : ''}
      <div class="kpis">
        <div class="card kpi hero"><div class="label">${ICON.bank}Cash today</div><div class="value">${money(f.start)}</div><div class="delta">Bank and payment accounts</div></div>
        <div class="card kpi"><div class="label">In ${P.days} days</div><div class="value ${f.end < 0 ? 'neg' : ''}">${money(f.end)}</div><div class="delta">${f.end >= f.start ? `<span class="up">▲ ${money(f.end - f.start)}</span>` : `<span class="down">▼ ${money(f.start - f.end)}</span>`}</div></div>
        <div class="card kpi"><div class="label">Lowest point</div><div class="value ${f.low.bal < 0 ? 'neg' : ''}">${money(f.low.bal)}</div><div class="delta">${f.low.date === today() ? 'Today' : fmtDate(f.low.date)}</div></div>
        <div class="card kpi"><div class="label">Coming in / going out</div><div class="value" style="font-size:22px"><span class="pos">+${moneyShort(f.in)}</span> <span class="muted">/</span> −${moneyShort(f.out)}</div><div class="delta">Invoices, bills and repeating items</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Projected cash balance</h3>
          <div class="toolbar-inline" style="margin-left:auto">
            <label class="check" title="Adds the everyday money in and out that isn't an invoice or bill — the average of the last 90 days"><input type="checkbox" data-change="plan-typical" ${P.typical ? 'checked' : ''}> Include everyday activity <span class="muted">(${daily >= 0 ? '+' : '−'}${money(Math.abs(daily))}/day)</span></label>
            <div class="seg sm">${[30, 60, 90].map(d => `<button class="${P.days === d ? 'on' : ''}" data-action="plan-days" data-v="${d}">${d} days</button>`).join('')}</div>
          </div></div>
        <div class="card-body"><div class="chart">${lineChart(f.series, f.events)}</div>
          <div class="legend" style="margin-top:6px"><span><i style="background:var(--accent)"></i>Money coming in</span><span><i style="background:var(--gold)"></i>Money going out</span><span class="muted">Hover a dot for details</span></div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>What's coming up</h3><span class="muted">${plural(f.events.length, 'item')}</span></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>What</th><th class="num">In</th><th class="num">Out</th><th class="num">Balance after</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5"><div class="empty"><div class="big">Nothing scheduled</div>Unpaid invoices, bills and repeating items show up here with the day they're expected.</div></td></tr>`}</tbody></table></div>
      </div>
      <p class="muted plan-note">Overdue invoices are counted a week from today. This is a projection from what's in the books — not a promise.</p>`;
  }

  // ------------------------------------------------------------------
  // Budget vs. actual
  // ------------------------------------------------------------------
  const PERIODS = [['this-month', 'This month'], ['last-month', 'Last month'], ['this-quarter', 'This quarter'], ['ytd', 'This year so far'], ['last-year', 'Last year']];
  function budgetTab(c) {
    const P = S.ui.plan;
    const r = C.periodRange(P.period, c);
    const to = r.to > today() && P.period !== 'this-month' ? today() : r.to;
    const b = C.budgetVsActual(c, r.from, to);
    const bar = row => {
      if (!row.budget) return `<span class="muted" style="font-size:12px">No budget</span>`;
      const pct = Math.max(0, row.actual / row.budget * 100);
      const good = row.a.type === 'income' ? pct >= 100 : pct <= 100;
      const tone = good ? 'ok' : (row.a.type === 'expense' && pct <= 110 ? 'near' : 'over');
      return `<div class="bud-bar ${tone}"><div style="width:${Math.min(100, pct).toFixed(1)}%"></div></div><span class="bud-pct">${pct.toFixed(0)}%</span>`;
    };
    const rowsFor = list => list.map(row => `<tr>
      <td><b style="font-weight:550">${esc(row.a.name)}</b></td>
      <td class="num"><div class="money-in sm"><span>$</span><input class="input sm num" type="number" min="0" step="10" value="${row.monthly || ''}" placeholder="0" data-change="budget-set" data-id="${row.a.id}" aria-label="Monthly budget for ${esc(row.a.name)}"></div></td>
      <td class="num muted">${row.budget ? money(row.budget) : '—'}</td>
      <td class="num" data-action="drill" data-id="${row.a.id}" data-period="${P.period}" style="cursor:pointer">${money(row.actual)}</td>
      <td class="num ${row.budget ? (row.diff >= 0 ? 'pos' : 'neg') : 'muted'}">${row.budget ? (row.diff >= 0 ? '' : '−') + money(Math.abs(row.diff)) : '—'}</td>
      <td class="bud-cell">${bar(row)}</td></tr>`).join('');
    const tot = (label, t, inc) => { const d = inc ? t.actual - t.budget : t.budget - t.actual; return `<tr class="total-row"><td>${label}</td><td></td><td class="num">${t.budget ? money(t.budget) : '—'}</td><td class="num">${money(t.actual)}</td><td class="num ${t.budget ? (d >= 0 ? 'pos' : 'neg') : 'muted'}">${t.budget ? (d >= 0 ? '' : '−') + money(Math.abs(d)) : '—'}</td><td></td></tr>`; };
    const over = b.expense.filter(x => x.budget && x.actual > x.budget).sort((x, y) => (y.actual - y.budget) - (x.actual - x.budget));
    return `
      <div class="kpis">
        <div class="card kpi"><div class="label">Income vs. plan</div><div class="value">${money(b.totals.income.actual)}</div><div class="delta">${b.totals.income.budget ? `Plan ${money(b.totals.income.budget)}` : 'Set a monthly plan below'}</div></div>
        <div class="card kpi"><div class="label">Spending vs. plan</div><div class="value">${money(b.totals.expense.actual)}</div><div class="delta">${b.totals.expense.budget ? `Plan ${money(b.totals.expense.budget)}` : 'Set a monthly plan below'}</div></div>
        <div class="card kpi"><div class="label">Profit vs. plan</div><div class="value ${b.totals.net.actual < 0 ? 'neg' : ''}">${money(b.totals.net.actual)}</div><div class="delta">${b.hasBudget ? `Plan ${money(b.totals.net.budget)}` : '&nbsp;'}</div></div>
        <div class="card kpi"><div class="label">Over budget</div><div class="value ${over.length ? 'neg' : ''}">${over.length}</div><div class="delta">${over.length ? esc(over.slice(0, 2).map(x => x.a.name).join(', ')) : b.hasBudget ? 'Everything is on plan' : 'No budget yet'}</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Budget vs. actual</h3>
          <div class="toolbar-inline" style="margin-left:auto">
            <select class="input sm" style="width:170px" data-change="plan-period" aria-label="Period">${PERIODS.map(([k, l]) => `<option value="${k}" ${P.period === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <button class="btn sm" data-action="budget-fill" title="Uses the average of the last three full months">${ICON.spark}Fill from last 3 months</button>
            ${b.hasBudget ? `<button class="btn sm ghost" data-action="budget-clear">Clear</button>` : ''}
          </div></div>
        ${b.hasBudget ? '' : `<div class="hint-bar" style="margin:0 18px 12px">${ICON.help}<span>Type a <b>monthly</b> amount next to each category, or click <b>Fill from last 3 months</b> to start from what the business usually earns and spends.</span></div>`}
        <div class="table-wrap"><table class="tbl bud-tbl">
          <thead><tr><th>Category</th><th class="num" style="width:150px">Monthly budget</th><th class="num">Budget · ${plural(b.months, 'month')}</th><th class="num">Actual</th><th class="num">Difference</th><th style="width:190px">Progress</th></tr></thead>
          <tbody>
            <tr class="group-row"><td colspan="6">Income</td></tr>${rowsFor(b.income) || '<tr><td colspan="6" class="muted">No income in this period.</td></tr>'}${tot('Total income', b.totals.income, true)}
            <tr class="group-row"><td colspan="6">Expenses</td></tr>${rowsFor(b.expense) || '<tr><td colspan="6" class="muted">No expenses in this period.</td></tr>'}${tot('Total expenses', b.totals.expense, false)}
            ${tot('Profit', b.totals.net, true)}
          </tbody></table></div>
      </div>
      <p class="muted plan-note">Green means better than plan — more income, or less spending. Click an actual amount to see the transactions behind it.</p>`;
  }

  // ------------------------------------------------------------------
  // Owner pay and quarterly taxes
  // ------------------------------------------------------------------
  function ownerTab(c) {
    const P = S.ui.plan;
    const y = P.taxYear || +today().slice(0, 4);
    const est = c.estTax || { pct: 25, paid: {} };
    const qs = C.taxQuarters(c, y);
    const fy = C.periodRange('ytd', c);
    const op = C.ownerPay(c, fy.from, today());
    const pl = C.profitLoss(c, fy.from, today());
    const safe = C.safeToPay(c);
    const maxM = Math.max(1, ...op.monthly.map(m => m.draws));
    const next = qs.find(q => q.due >= today() && q.started) || qs.find(q => q.due >= today());
    const totals = { setAside: qs.reduce((s, q) => s + q.setAside, 0), paid: qs.reduce((s, q) => s + q.paid, 0), left: qs.reduce((s, q) => s + q.left, 0) };
    return `
      <div class="kpis">
        <div class="card kpi hero"><div class="label">About safe to pay the owner</div><div class="value">${money(safe.amount)}</div><div class="delta">Cash minus bills, taxes and a one-month cushion</div></div>
        <div class="card kpi"><div class="label">Owner took this year</div><div class="value">${money(op.taken)}</div><div class="delta">${op.put ? `Put in ${money(op.put)}` : 'From Owner\'s Draw'}</div></div>
        <div class="card kpi"><div class="label">Profit this year</div><div class="value ${pl.net < 0 ? 'neg' : ''}">${money(pl.net)}</div><div class="delta">${pl.net > 0 && op.taken ? `Owner took ${Math.round(op.taken / pl.net * 100)}% of it` : '&nbsp;'}</div></div>
        <div class="card kpi"><div class="label">Next tax payment</div><div class="value">${next ? money(next.left) : '—'}</div><div class="delta">${next ? `${next.q} · due ${fmtDate(next.due)}` : '&nbsp;'}</div></div>
      </div>
      <div class="dash-grid">
        <div class="card">
          <div class="card-head"><h3>Quarterly estimated taxes</h3>
            <div class="toolbar-inline" style="margin-left:auto">
              <label class="muted" for="tax-pct">Set aside</label><div class="money-in sm pct"><input id="tax-pct" class="input sm num" type="number" min="0" max="60" step="1" value="${est.pct == null ? 25 : est.pct}" data-change="tax-pct"><span>%</span></div><span class="muted">of profit</span>
              <select class="input sm" style="width:92px" data-change="tax-year" aria-label="Year">${[y + 1, y, y - 1].filter(v => v <= +today().slice(0, 4) + (today().slice(5) >= '12' ? 1 : 0)).map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>
            </div></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Payment</th><th>Covers</th><th>Due</th><th class="num">Profit</th><th class="num">Set aside</th><th class="num" style="width:140px">Paid</th><th class="num">Still to pay</th></tr></thead>
            <tbody>${qs.map(q => `<tr class="${!q.started ? 'dim-row' : ''}"><td><b>${q.q}</b></td><td class="muted">${C.parseISO(q.from).toLocaleDateString('en-US', { month: 'short' })} – ${C.parseISO(q.to).toLocaleDateString('en-US', { month: 'short' })}</td>
              <td>${fmtDate(q.due)}${q.due < today() && q.left > 0 && q.started ? ' <span class="tag red">past due</span>' : ''}</td>
              <td class="num ${q.profit < 0 ? 'neg' : ''}">${q.started ? money(q.profit) : '—'}${q.started && !q.done ? '<div class="muted" style="font-size:11px">so far</div>' : ''}</td>
              <td class="num">${q.started ? money(q.setAside) : '—'}</td>
              <td class="num"><div class="money-in sm"><span>$</span><input class="input sm num" type="number" min="0" step="50" value="${q.paid || ''}" placeholder="0" data-change="tax-paid" data-k="${y}-${q.q}" aria-label="Paid for ${q.q}"></div></td>
              <td class="num" style="font-weight:600">${q.started ? money(q.left) : '—'}</td></tr>`).join('')}
              <tr class="total-row"><td colspan="4">${y} total</td><td class="num">${money(totals.setAside)}</td><td class="num">${money(totals.paid)}</td><td class="num">${money(totals.left)}</td></tr></tbody></table></div>
          <div class="card-body">${App.entityNote ? App.entityNote(c) : ''}<div class="hint-bar" style="margin-top:10px">${ICON.help}<span>Owners of small businesses usually pay tax four times a year. Self-employment tax alone is 15.3%, so setting aside <b>25–30% of profit</b> is a common rule of thumb. This is a planning estimate — the client's tax preparer has the final number.</span></div></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Owner pay by month</h3><span class="muted">This year</span></div>
          <div class="card-body bars-list">${op.monthly.some(m => m.draws || m.contribs) ? op.monthly.map(m => `<div class="bar-row"><div class="top"><span>${U.fmtMonth(m.month + '-01')}</span><span class="num">${money(m.draws)}${m.contribs ? ` <span class="muted">· put in ${money(m.contribs)}</span>` : ''}</span></div><div class="track"><div class="fill" style="width:${(m.draws / maxM * 100).toFixed(1)}%"></div></div></div>`).join('') : `<div class="muted">No owner pay recorded this year. When the owner moves money to themselves, categorize it as <b>Owner's Draw</b>.</div>`}
          </div>
          <div class="card-body" style="border-top:1px solid var(--line)">
            <div class="safe-break"><div><span>Cash today</span><b>${money(safe.cash)}</b></div><div><span>Bills due in 30 days</span><b>−${money(safe.billsSoon)}</b></div><div><span>Taxes still to set aside</span><b>−${money(safe.taxLeft)}</b></div><div><span>One-month cushion</span><b>−${money(safe.cushion)}</b></div><div class="tot"><span>About safe to pay</span><b>${money(safe.amount)}</b></div></div>
          </div>
        </div>
      </div>`;
  }

  act({
    'plan-tab': el => { S.ui.plan.tab = el.dataset.v; render(); },
    'plan-days': el => { S.ui.plan.days = +el.dataset.v; render(); },
    'change:plan-typical': el => { S.ui.plan.typical = el.checked; render(); },
    'change:plan-period': el => { S.ui.plan.period = el.value; render(); },
    'change:budget-set': el => {
      const c = client(); c.budgets = c.budgets || {};
      const v = Math.max(0, Math.round(+el.value || 0));
      if (v) c.budgets[el.dataset.id] = v; else delete c.budgets[el.dataset.id];
      commit();
    },
    'budget-fill': async () => {
      const c = client(); c.budgets = c.budgets || {};
      const has = Object.keys(c.budgets).length;
      if (has && !await U.confirmBox({ title: 'Replace the budget?', body: 'Every monthly amount will be replaced with the average of the last three full months.', ok: 'Replace' })) return;
      const undo = App.snapshot(c);
      let n = 0;
      for (const a of c.accounts) if ((a.type === 'income' || a.type === 'expense') && !a.archived && a.key !== 'unc_inc' && a.key !== 'unc_exp') { const v = C.suggestBudget(c, a.id); if (v > 0) { c.budgets[a.id] = v; n++; } else delete c.budgets[a.id]; }
      commit(); U.toast(n ? `Filled in ${plural(n, 'category', 'categories')} — adjust any you like` : 'No activity in the last three months to start from', n ? undo : null);
    },
    'budget-clear': async () => {
      if (!await U.confirmBox({ title: 'Clear the budget?', body: 'All monthly amounts for this client will be removed.', ok: 'Clear', danger: true })) return;
      const c = client(); const undo = App.snapshot(c); c.budgets = {}; commit(); U.toast('Budget cleared', undo);
    },
    'change:tax-pct': el => { const c = client(); c.estTax = c.estTax || { paid: {} }; c.estTax.pct = Math.min(60, Math.max(0, +el.value || 0)); commit(); },
    'change:tax-paid': el => { const c = client(); c.estTax = c.estTax || { pct: 25, paid: {} }; c.estTax.paid = c.estTax.paid || {}; const v = Math.max(0, +el.value || 0); if (v) c.estTax.paid[el.dataset.k] = v; else delete c.estTax.paid[el.dataset.k]; commit(); },
    'change:tax-year': el => { S.ui.plan.taxYear = +el.value; render(); }
  });
})();
