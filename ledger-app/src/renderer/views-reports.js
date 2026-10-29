'use strict';
/* =====================================================================
   Coll Ledger — reports and the client package
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;

  // Period keys: the named ones from Core, "month:YYYY-MM-DD" (a month end) and "custom"
  function range(key, c) {
    if (String(key).startsWith('month:')) { const end = key.slice(6); return { from: end.slice(0, 8) + '01', to: end, label: U.fmtMonth(end) }; }
    if (key === 'custom') { const R = S.ui.report; return { from: R.from || C.periodRange('ytd', c).from, to: R.to || today(), label: 'Custom dates' }; }
    return C.periodRange(key, c);
  }
  App.range = range;

  function docShell(title, body) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: Letter; margin: 0; }
      * { box-sizing: border-box; } body { margin: 0; font-family: -apple-system, 'Segoe UI', Inter, Helvetica, Arial, sans-serif; color: #16201C; font-size: 12.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 56px 60px; position: relative; } .page + .page { page-break-before: always; } .serif { font-family: Georgia, 'Iowan Old Style', serif; }
      table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: #6B756F; padding: 10px 8px; border-bottom: 1.5px solid #16201C; }
      td { padding: 8px 8px; border-bottom: 1px solid #E6E2D9; } .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; } .muted { color: #6B756F; } .cap { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
      .rpt td { border-bottom: 0; padding: 6px 8px; } .rpt .sec td { font-weight: 700; text-transform: uppercase; font-size: 10.5px; letter-spacing: .08em; padding-top: 18px; color: #4A5550; }
      .rpt .line td:first-child { padding-left: 24px; } .rpt .total td { font-weight: 700; border-top: 1px solid #9AA39E; } .rpt .grand td { font-weight: 700; font-size: 15px; border-top: 2px solid #16201C; border-bottom: 3px double #16201C; }
      .report-title { text-align: center; margin-bottom: 26px; } .report-title .co { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #6B756F; font-weight: 600; } .report-title h2 { font-family: Georgia, serif; font-weight: 500; font-size: 26px; margin: 8px 0 4px; } .report-title .period { color: #4A5550; }
      .bars-list { display: flex; flex-direction: column; gap: 10px; } .bar-row .top { display: flex; justify-content: space-between; margin-bottom: 4px; } .track { height: 7px; background: #EFEDE7; border-radius: 9px; overflow: hidden; } .fill { height: 100%; background: #1E6B53; border-radius: 9px; }
      .neg { color: #B4442F; } .pos { color: #1E7A55; }
      .footer { position: absolute; bottom: 26px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #9AA39E; font-size: 10px; }
    </style></head><body>${body.includes('class="page"') ? body : `<div class="page">${body}</div>`}</body></html>`;
  }
  App.docShell = docShell;

  const REPORTS = [
    ['pl', 'Profit & Loss', 'Did the business make money? Income minus expenses.'],
    ['bs', 'Balance Sheet', 'What the business owns, owes, and is worth on a date.'],
    ['exp', 'Spending by Category', 'Where the money went, biggest first.'],
    ['cmp', 'Month by Month', 'Income, expenses and profit for each month.'],
    ['ar', 'Who Owes Money', 'Unpaid invoices by customer and how late they are.'],
    ['gl', 'General Ledger', 'Every entry, account by account — the full audit trail.']
  ];

  function reportData(c, opts = {}) {
    const R = Object.assign({}, S.ui.report, opts);
    const rg = opts.from ? { from: opts.from, to: opts.to } : range(R.period, c);
    const head = (title, period) => `<div class="report-title"><div class="co">${esc(c.legalName || c.name)}</div><h2>${title}</h2><div class="period">${period}</div></div>`;
    const drill = !opts.print;
    const lineRows = (arr, canDrill) => arr.map(x => `<tr class="line" ${canDrill && drill ? `data-action="drill" data-id="${x.a.id}" data-period="${esc(R.period)}" style="cursor:pointer"` : ''}><td>${esc(x.a.name)}</td><td class="num">${money(x.v)}</td></tr>`).join('');
    const csv = [];
    let html = '';
    if (R.type === 'pl') {
      const p = C.profitLoss(c, rg.from, rg.to);
      const sec = (label, arr, total, totalLabel) => { if (!arr.length) return ''; csv.push([label]); arr.forEach(x => csv.push(['  ' + x.a.name, x.v.toFixed(2)])); csv.push([totalLabel, total.toFixed(2)]); return `<tr class="sec"><td colspan="2">${label}</td></tr>${lineRows(arr, true)}<tr class="total"><td>${totalLabel}</td><td class="num">${money(total)}</td></tr>`; };
      html = head('Profit & Loss', `${fmtDate(rg.from)} – ${fmtDate(rg.to)}`) + `<table class="rpt">
        ${sec('Income', p.income, p.totalIncome, 'Total income')}
        ${sec('Cost of goods sold', p.cogs, p.totalCogs, 'Total cost of goods sold')}
        ${p.cogs.length ? `<tr class="total"><td>Gross profit</td><td class="num">${money(p.gross)}</td></tr>` : ''}
        ${sec('Expenses', p.expense, p.totalExpense, 'Total expenses')}
        ${p.otherIncome.length || p.otherExpense.length ? `<tr class="total"><td>Operating profit</td><td class="num">${money(p.operating)}</td></tr>` : ''}
        ${sec('Other income', p.otherIncome, p.totalOtherIncome, 'Total other income')}
        ${sec('Other expenses', p.otherExpense, p.totalOtherExpense, 'Total other expenses')}
        <tr class="grand"><td>Net profit</td><td class="num ${p.net < 0 ? 'neg' : ''}">${money(p.net)}</td></tr></table>
        ${!p.income.length && !p.expense.length ? '<div class="muted" style="text-align:center;margin-top:20px">No income or expenses in these dates.</div>' : ''}`;
      csv.push(['Net profit', p.net.toFixed(2)]);
    } else if (R.type === 'bs') {
      const asOf = opts.asOf || R.asOf;
      const b = C.balanceSheet(c, asOf);
      const sec = (label, arr, extra = []) => { csv.push([label]); arr.forEach(x => csv.push(['  ' + x.a.name, x.v.toFixed(2)])); extra.forEach(([n, v]) => csv.push(['  ' + n, v.toFixed(2)])); return `<tr class="sec"><td colspan="2">${label}</td></tr>${lineRows(arr)}${extra.map(([n, v]) => `<tr class="line"><td>${n}</td><td class="num">${money(v)}</td></tr>`).join('')}`; };
      html = head('Balance Sheet', `As of ${fmtDate(asOf)}`) + `<table class="rpt">
        ${sec('Assets — what it owns', b.assets)}<tr class="grand"><td>Total assets</td><td class="num">${money(b.totalAssets)}</td></tr>
        ${sec('Liabilities — what it owes', b.liabilities)}<tr class="total"><td>Total liabilities</td><td class="num">${money(b.totalLiab)}</td></tr>
        ${sec("Equity — the owner's stake", b.equity, [['Profit from earlier years', b.retained], ['Profit this year', b.netYTD]])}<tr class="total"><td>Total equity</td><td class="num">${money(b.totalEquity)}</td></tr>
        <tr class="grand"><td>Total liabilities &amp; equity</td><td class="num">${money(b.totalLiab + b.totalEquity)}</td></tr></table>
        ${Math.abs(b.check) > 0.01 ? `<div style="text-align:center;margin-top:14px" class="neg">Out of balance by ${money(b.check)}</div>` : `<div class="muted" style="text-align:center;margin-top:16px">Balanced — assets equal liabilities plus equity.</div>`}`;
      csv.push(['Total assets', b.totalAssets.toFixed(2)], ['Total liabilities', b.totalLiab.toFixed(2)], ['Total equity', b.totalEquity.toFixed(2)]);
    } else if (R.type === 'exp') {
      const p = C.profitLoss(c, rg.from, rg.to);
      const all = [...p.cogs, ...p.expense, ...p.otherExpense].filter(x => x.v > 0).sort((a, b) => b.v - a.v);
      const tot = all.reduce((s, x) => s + x.v, 0) || 1;
      csv.push(['Category', 'Amount', 'Share']);
      html = head('Spending by Category', `${fmtDate(rg.from)} – ${fmtDate(rg.to)}`) + `<div class="bars-list">${all.map(x => { csv.push([x.a.name, x.v.toFixed(2), (x.v / tot * 100).toFixed(1) + '%']); return `<div class="bar-row" ${drill ? `data-action="drill" data-id="${x.a.id}" data-period="${esc(R.period)}" style="cursor:pointer"` : ''}><div class="top"><span>${esc(x.a.name)}</span><span class="num">${money(x.v)} <span class="muted">· ${(x.v / tot * 100).toFixed(1)}%</span></span></div><div class="track"><div class="fill" style="width:${(x.v / all[0].v * 100).toFixed(1)}%"></div></div></div>`; }).join('') || '<div class="muted">No spending in these dates.</div>'}</div>
        <table class="rpt" style="margin-top:20px"><tr class="grand"><td>Total spending</td><td class="num">${money(all.reduce((s, x) => s + x.v, 0))}</td></tr></table>`;
    } else if (R.type === 'cmp') {
      const months = [];
      let d = C.parseISO(rg.from.slice(0, 8) + '01');
      const endD = C.parseISO(rg.to);
      while (d <= endD && months.length < 24) { const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); months.push({ from: C.isoOf(d), to: C.isoOf(e > endD ? endD : e) }); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
      const rows = months.map(mo => ({ mo, p: C.profitLoss(c, mo.from, mo.to) }));
      csv.push(['Month', 'Income', 'Expenses', 'Profit']);
      rows.forEach(r => csv.push([r.mo.from.slice(0, 7), (r.p.totalIncome + r.p.totalOtherIncome).toFixed(2), (r.p.totalExpense + r.p.totalCogs + r.p.totalOtherExpense).toFixed(2), r.p.net.toFixed(2)]));
      const sum = k => rows.reduce((s, r) => s + k(r.p), 0);
      html = head('Month by Month', `${fmtDate(rg.from)} – ${fmtDate(rg.to)}`) + `<table class="rpt"><tr class="sec"><td>Month</td><td class="num">Income</td><td class="num">Expenses</td><td class="num">Profit</td></tr>
        ${rows.map(r => `<tr><td>${U.fmtMonth(r.mo.from)}</td><td class="num">${money(r.p.totalIncome + r.p.totalOtherIncome)}</td><td class="num">${money(r.p.totalExpense + r.p.totalCogs + r.p.totalOtherExpense)}</td><td class="num ${r.p.net < 0 ? 'neg' : ''}"><b>${money(r.p.net)}</b></td></tr>`).join('')}
        <tr class="grand"><td>Total</td><td class="num">${money(sum(p => p.totalIncome + p.totalOtherIncome))}</td><td class="num">${money(sum(p => p.totalExpense + p.totalCogs + p.totalOtherExpense))}</td><td class="num">${money(sum(p => p.net))}</td></tr></table>`;
    } else if (R.type === 'ar') {
      const buckets = ['Not due yet', '1–30 days late', '31–60', '61–90', '90+'];
      const rows = {};
      for (const i of c.invoices) {
        const s = C.invoiceState(c, i);
        if (!['open', 'partial', 'overdue'].includes(s.status)) continue;
        const late = C.daysBetween(i.dueDate, today());
        const b = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
        const cu = C.contact(c, i.contactId); const k = cu ? cu.name : 'Unknown customer';
        rows[k] = rows[k] || [0, 0, 0, 0, 0]; rows[k][b] += s.due;
      }
      const names = Object.keys(rows).sort();
      const totals = buckets.map((_, j) => names.reduce((s, n) => s + rows[n][j], 0));
      csv.push(['Customer', ...buckets, 'Total']);
      names.forEach(n => csv.push([n, ...rows[n].map(v => v.toFixed(2)), rows[n].reduce((s, v) => s + v, 0).toFixed(2)]));
      html = head('Who Owes Money', `Unpaid invoices as of ${fmtDate(today())}`) + `<div class="table-wrap"><table class="rpt"><tr class="sec"><td>Customer</td>${buckets.map(b => `<td class="num">${b}</td>`).join('')}<td class="num">Total</td></tr>
        ${names.map(n => `<tr><td>${esc(n)}</td>${rows[n].map((v, j) => `<td class="num ${v ? (j >= 2 ? 'neg' : '') : 'muted'}">${v ? money(v) : '—'}</td>`).join('')}<td class="num"><b>${money(rows[n].reduce((s, v) => s + v, 0))}</b></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nothing outstanding — every invoice is paid.</td></tr>'}
        <tr class="grand"><td>Total</td>${totals.map(v => `<td class="num">${money(v)}</td>`).join('')}<td class="num">${money(totals.reduce((s, v) => s + v, 0))}</td></tr></table></div>`;
    } else if (R.type === 'gl') {
      const ps = C.postings(c).filter(p => p.date >= rg.from && p.date <= rg.to);
      const byAcc = new Map();
      ps.forEach(p => { if (!byAcc.has(p.acc)) byAcc.set(p.acc, []); byAcc.get(p.acc).push(p); });
      const accs = c.accounts.filter(a => byAcc.has(a.id)).sort((a, b) => a.code.localeCompare(b.code));
      csv.push(['Account', 'Date', 'Description', 'Debit', 'Credit']);
      const limit = opts.print ? Infinity : 60;
      html = head('General Ledger', `${fmtDate(rg.from)} – ${fmtDate(rg.to)}`) + `<div class="muted" style="text-align:center;margin:-12px 0 18px">Debits increase what it owns and its expenses; credits increase what it owes, the owner's stake and income.</div>` + accs.map(a => {
        const list = byAcc.get(a.id).sort((x, y) => x.date.localeCompare(y.date));
        let dr = 0, cr = 0;
        const rowsH = list.map((p, i) => { dr += p.dr; cr += p.cr; const d = p.t ? (p.t.payee || p.t.description) : p.inv ? 'Invoice ' + p.inv.number : 'Opening balance'; csv.push([a.name, p.date, d, p.dr ? p.dr.toFixed(2) : '', p.cr ? p.cr.toFixed(2) : '']); return i < limit ? `<tr><td class="muted" style="width:110px">${fmtDate(p.date)}</td><td>${esc(d)}</td><td class="num">${p.dr ? money(p.dr) : ''}</td><td class="num">${p.cr ? money(p.cr) : ''}</td></tr>` : ''; }).join('');
        return `<table class="rpt" style="margin-bottom:12px"><tr class="sec"><td colspan="2">${esc(a.code)} · ${esc(a.name)}</td><td class="num">Debit</td><td class="num">Credit</td></tr>${rowsH}${list.length > limit ? `<tr><td colspan="4" class="muted">…and ${list.length - limit} more (all included in the PDF and spreadsheet)</td></tr>` : ''}<tr class="total"><td colspan="2">Total ${esc(a.name)}</td><td class="num">${money(dr)}</td><td class="num">${money(cr)}</td></tr></table>`;
      }).join('');
    }
    return { html, csv, range: rg };
  }
  App.reportData = reportData;

  view('reports', {
    render(c) {
      const R = S.ui.report;
      const { html } = reportData(c);
      const usesAsOf = R.type === 'bs', noPeriod = R.type === 'ar';
      const periods = App.PERIODS.filter(p => p[0] !== 'all');
      const isMonth = String(R.period).startsWith('month:');
      return `
        <div class="page-head"><div><h1>Reports</h1><div class="sub">Ready for ${esc(c.name)} — save as a PDF or a spreadsheet. Click any line to see what's in it.</div></div>
          <div class="actions">
            <button class="btn" data-action="report-csv">${ICON.download}Spreadsheet</button>
            <button class="btn" data-action="report-pdf">${ICON.pdf}PDF</button>
            <button class="btn primary" data-action="client-package">${ICON.pdf}Client package</button>
          </div></div>
        <div class="report-tabs six">${REPORTS.map(([k, t, d]) => `<button class="card report-tab ${R.type === k ? 'on' : ''}" data-action="report-type" data-v="${k}"><h4>${t}</h4><div class="muted">${d}</div></button>`).join('')}</div>
        <div class="card">
          <div class="toolbar">${noPeriod ? `<span class="muted">Shows every unpaid invoice as of today.</span>` : usesAsOf ? `<label class="muted" for="rep-asof">As of</label><input id="rep-asof" type="date" class="input sm" style="width:170px" value="${R.asOf}" data-change="report-asof">` : `<select class="input sm" style="width:190px" data-change="report-period" aria-label="Dates">${isMonth ? `<option value="${esc(R.period)}" selected>${U.fmtMonth(R.period.slice(6))}</option>` : ''}${periods.map(([k, l]) => `<option value="${k}" ${R.period === k ? 'selected' : ''}>${l}</option>`).join('')}<option value="custom" ${R.period === 'custom' ? 'selected' : ''}>Pick dates…</option></select>${R.period === 'custom' ? `<input type="date" class="input sm" style="width:160px" value="${range('custom', c).from}" data-change="report-from" aria-label="From"><span class="muted">to</span><input type="date" class="input sm" style="width:160px" value="${range('custom', c).to}" data-change="report-to" aria-label="To">` : ''}`}</div>
          <div class="report">${html}</div>
        </div>`;
    }
  });

  // ---------- client package: cover + summary + P&L + balance sheet + A/R ----------
  function packageHTML(c, from, to) {
    const p = C.profitLoss(c, from, to);
    const prevTo = C.isoOf(new Date(C.parseISO(from).getFullYear(), C.parseISO(from).getMonth(), 0));
    const span = C.daysBetween(from, to);
    const prevFrom = span <= 31 ? prevTo.slice(0, 8) + '01' : C.addDays(prevTo, -span);
    const pp = C.profitLoss(c, prevFrom, prevTo);
    const b = C.balanceSheet(c, to);
    const bal = C.balances(c, { to });
    const cash = c.accounts.filter(a => a.sub === 'bank' || a.sub === 'clearing').reduce((s, a) => s + bal.get(a.id), 0);
    const owed = c.invoices.map(i => C.invoiceState(c, i)).filter(s => ['open', 'partial', 'overdue'].includes(s.status)).reduce((s, x) => s + x.due, 0);
    const top = [...p.cogs, ...p.expense, ...p.otherExpense].filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
    const firm = S.data.firm;
    const label = span <= 31 ? U.fmtMonth(to) : `${fmtDate(from)} – ${fmtDate(to)}`;
    const chg = (a, b2) => b2 ? `${a >= b2 ? '▲' : '▼'} ${Math.abs((a - b2) / Math.abs(b2) * 100).toFixed(0)}% vs. ${span <= 31 ? 'the month before' : 'the period before'}` : '';
    const footer = n => `<div class="footer"><span>${esc(c.legalName || c.name)} · ${esc(label)}</span><span>Prepared by ${esc(firm.name || 'your bookkeeper')}${firm.owner ? ' · ' + esc(firm.owner) : ''} · page ${n}</span></div>`;
    const tile = (l, v, s) => `<div style="flex:1;padding:18px 20px;border:1px solid #E6E2D9;border-radius:12px"><div class="muted cap">${l}</div><div class="serif" style="font-size:26px;margin-top:6px">${v}</div><div class="muted" style="margin-top:4px;font-size:11px">${s || '&nbsp;'}</div></div>`;
    const plH = reportData(c, { type: 'pl', from, to, print: true }).html;
    const bsH = reportData(c, { type: 'bs', asOf: to, print: true }).html;
    const arH = owed ? reportData(c, { type: 'ar', print: true }).html : '';
    return docShell(`${c.name} — ${label}`, `
      <div class="page" style="height:11in;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:14px"><div style="width:52px;height:52px;border-radius:14px;background:${c.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px">${esc(U.initials(c.name))}</div><div><div class="serif" style="font-size:24px">${esc(c.legalName || c.name)}</div><div class="muted">${esc(c.industry || '')}</div></div></div>
        <div style="margin-top:120px"><div class="muted cap" style="font-size:12px">Financial report</div><div class="serif" style="font-size:54px;letter-spacing:-.02em;line-height:1.05;margin-top:8px">${esc(label)}</div></div>
        <div style="display:flex;gap:14px;margin-top:60px">${tile('Profit', `<span class="${p.net < 0 ? 'neg' : ''}">${money(p.net)}</span>`, chg(p.net, pp.net))}${tile('Income', money(p.totalIncome + p.totalOtherIncome), chg(p.totalIncome, pp.totalIncome))}${tile('Cash in the bank', money(cash), 'On ' + fmtDate(to))}</div>
        <div style="display:flex;gap:30px;margin-top:40px">
          <div style="flex:1"><div class="muted cap">Biggest expenses</div>${top.map(x => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #EFEDE7"><span>${esc(x.a.name)}</span><span class="num">${money(x.v)}</span></div>`).join('') || '<div class="muted">None</div>'}</div>
          <div style="flex:1"><div class="muted cap">At a glance</div>
            <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #EFEDE7"><span>Customers owe</span><span class="num">${money(owed)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #EFEDE7"><span>Owed on cards & loans</span><span class="num">${money(b.totalLiab)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #EFEDE7"><span>Profit margin</span><span class="num">${p.totalIncome ? (p.net / p.totalIncome * 100).toFixed(1) + '%' : '—'}</span></div>
            <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #EFEDE7"><span>Books reconciled through</span><span class="num">${(() => { const r = c.reconciliations.map(x => x.date).sort().pop(); return r ? fmtDate(r) : '—'; })()}</span></div></div>
        </div>
        <div style="margin-top:auto;padding-top:30px;border-top:1px solid #E6E2D9;display:flex;justify-content:space-between" class="muted"><span>Prepared by <b style="color:#16201C">${esc(firm.name || 'your bookkeeper')}</b>${firm.owner ? ' · ' + esc(firm.owner) : ''}${firm.email ? ' · ' + esc(firm.email) : ''}</span><span>${fmtDate(today())}</span></div>
      </div>
      <div class="page">${plH}${footer(2)}</div>
      <div class="page">${bsH}${footer(3)}</div>
      ${arH ? `<div class="page">${arH}${footer(4)}</div>` : ''}`);
  }

  act({
    'report-type': el => { S.ui.report.type = el.dataset.v; render(); },
    'change:report-period': el => { S.ui.report.period = el.value; if (el.value === 'custom') { const r = C.periodRange('ytd', client()); S.ui.report.from = S.ui.report.from || r.from; S.ui.report.to = S.ui.report.to || today(); } render(); },
    'change:report-asof': el => { S.ui.report.asOf = el.value || today(); render(); },
    'change:report-from': el => { S.ui.report.from = el.value; render(); },
    'change:report-to': el => { S.ui.report.to = el.value; render(); },
    'report-pdf': () => { const c = client(); const title = REPORTS.find(r => r[0] === S.ui.report.type)[1]; const { html } = reportData(c, { print: true }); U.printDoc(docShell(title, html), `${c.name} - ${title}.pdf`); },
    'report-csv': () => { const c = client(); const { csv } = reportData(c, { print: true }); const title = REPORTS.find(r => r[0] === S.ui.report.type)[1]; U.downloadText(`${c.name} - ${title}.csv`, C.toCSV(csv)); },
    'client-package': el => {
      const c = client(); if (!c) return;
      const t = C.parseISO(today());
      const defEnd = el && el.dataset && el.dataset.end || c.lockDate || C.isoOf(new Date(t.getFullYear(), t.getMonth(), 0));
      const defStart = el && el.dataset && el.dataset.start || defEnd.slice(0, 8) + '01';
      const m = U.openModal(`${U.modalHead('Client package', 'One polished PDF: a summary page, Profit & Loss, Balance Sheet and unpaid invoices')}
        <div class="modal-body">
          <div class="seg" style="align-self:flex-start" id="pk-seg"><button class="on" data-k="month">A month</button><button data-k="quarter">A quarter</button><button data-k="year">Year to date</button><button data-k="custom">Pick dates</button></div>
          <div class="grid2"><div class="field"><label for="pk-from">From</label><input type="date" class="input" id="pk-from" value="${defStart}"></div><div class="field"><label for="pk-to">To</label><input type="date" class="input" id="pk-to" value="${defEnd}"></div></div>
          <div class="note">${ICON.spark} Your studio name ${S.data.firm.name ? `(<b>${esc(S.data.firm.name)}</b>)` : ''} appears as the preparer. Change it in Settings.</div>
        </div>
        <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="pk-go">${ICON.pdf}Make the PDF</button></div>`);
      $$('#pk-seg button', m).forEach(b => b.onclick = () => {
        $$('#pk-seg button', m).forEach(x => x.classList.toggle('on', x === b));
        const end = $('#pk-to', m).value || defEnd; const e = C.parseISO(end);
        if (b.dataset.k === 'month') $('#pk-from', m).value = end.slice(0, 8) + '01';
        if (b.dataset.k === 'quarter') { const q = Math.floor(e.getMonth() / 3) * 3; $('#pk-from', m).value = C.isoOf(new Date(e.getFullYear(), q, 1)); $('#pk-to', m).value = C.isoOf(new Date(e.getFullYear(), q + 3, 0)) > today() ? today() : C.isoOf(new Date(e.getFullYear(), q + 3, 0)); }
        if (b.dataset.k === 'year') { $('#pk-from', m).value = C.fyStart(c, today()); $('#pk-to', m).value = today(); }
      });
      $('#pk-go', m).onclick = () => {
        const from = $('#pk-from', m).value, to = $('#pk-to', m).value;
        if (!from || !to || from > to) return U.toast('Pick a start date before the end date', null, 'warn');
        const label = C.daysBetween(from, to) <= 31 ? U.fmtMonth(to) : `${from} to ${to}`;
        U.closeModal();
        U.printDoc(packageHTML(c, from, to), `${c.name} - ${label}.pdf`);
      };
    }
  });
})();
