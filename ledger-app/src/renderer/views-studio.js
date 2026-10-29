'use strict';
/* =====================================================================
   Coll Ledger — My studio: the bookkeeper's own business
   Who she works for, what she charges, a time tracker, and her own
   invoices to her clients.
   ===================================================================== */
(() => {
  const { S, C, U, view, act, go, render, commit, save } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;
  const ST = () => S.data.studio;
  const cust = id => ST().customers.find(x => x.id === id);
  const invTotal = i => C.round2((i.lines || []).reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0));
  const invState = i => {
    const total = invTotal(i), paid = C.round2(+i.paidAmount || 0), due = C.round2(total - paid);
    if (i.status === 'void') return { k: 'void', label: 'Void', tone: '', due: 0, total };
    if (i.status === 'draft') return { k: 'draft', label: 'Draft', tone: '', due, total };
    if (due <= 0.004) return { k: 'paid', label: 'Paid', tone: 'green', due: 0, total };
    if (i.dueDate < today()) return { k: 'overdue', label: `Overdue ${C.daysBetween(i.dueDate, today())}d`, tone: 'red', due, total };
    return { k: 'open', label: paid ? 'Partly paid' : 'Sent', tone: 'blue', due, total };
  };
  const fmtHours = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return mm === 60 ? `${hh + 1}h` : `${hh ? hh + 'h ' : ''}${mm ? mm + 'm' : hh ? '' : '0m'}`.trim(); };
  const unbilled = id => ST().time.filter(t => t.customerId === id && !t.invoiceId);
  const elapsed = () => { const tm = ST().timer; return tm ? (Date.now() - tm.start) / 3600000 : 0; };
  const clock = h => { const s = Math.floor(h * 3600); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  view('studio', {
    render() {
      const st = ST(), f = S.data.firm;
      const mStart = today().slice(0, 8) + '01';
      const billedM = st.invoices.filter(i => i.status !== 'draft' && i.status !== 'void' && i.date >= mStart).reduce((s, i) => s + invTotal(i), 0);
      const unpaid = st.invoices.map(invState).filter(x => x.k === 'open' || x.k === 'overdue');
      const hoursM = st.time.filter(t => t.date >= mStart).reduce((s, t) => s + t.hours, 0);
      const unbilledAmt = st.customers.reduce((s, cu) => s + unbilled(cu.id).reduce((a, t) => a + t.hours * (cu.rate || st.rate || 0), 0), 0);
      const active = st.customers.filter(x => x.active !== false);
      const recentTime = [...st.time].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0)).slice(0, 25);
      const invs = [...st.invoices].sort((a, b) => b.date.localeCompare(a.date) || String(b.number).localeCompare(String(a.number)));
      const tm = st.timer;
      return `
        <div class="page-head">
          <div><h1>My studio</h1><div class="sub">${esc(f.name || 'Your bookkeeping business')} — who you work for, your time, and getting paid.</div></div>
          <div class="actions"><button class="btn" data-action="st-new-cust">${ICON.plus}Add a client</button><button class="btn primary" data-action="st-bill-month" ${active.length ? '' : 'disabled'}>${ICON.file}Bill this month</button></div>
        </div>
        <div class="kpis">
          <div class="card kpi hero"><div class="label">${ICON.spark}Billed this month</div><div class="value">${money(billedM)}</div><div class="delta">${plural(active.length, 'active client')}</div></div>
          <div class="card kpi"><div class="label">Waiting to be paid</div><div class="value ${unpaid.some(x => x.k === 'overdue') ? 'neg' : ''}">${money(unpaid.reduce((s, x) => s + x.due, 0))}</div><div class="delta">${plural(unpaid.length, 'invoice')}${unpaid.some(x => x.k === 'overdue') ? ` · <span class="down">${unpaid.filter(x => x.k === 'overdue').length} overdue</span>` : ''}</div></div>
          <div class="card kpi"><div class="label">Hours this month</div><div class="value">${fmtHours(hoursM)}</div><div class="delta">${plural(st.time.filter(t => t.date >= mStart).length, 'entry', 'entries')}</div></div>
          <div class="card kpi"><div class="label">Time not billed yet</div><div class="value">${money(unbilledAmt)}</div><div class="delta">Goes on the next invoices</div></div>
        </div>
        <div class="dash-grid">
          <div class="card"><div class="card-head"><h3>Track time</h3><span class="muted">Start the timer when you sit down with a client's books</span></div>
            <div class="card-body">
              ${active.length ? `<div class="timer ${tm ? 'running' : ''}">
                <select class="input" id="tm-cust" ${tm ? 'disabled' : ''} aria-label="Client">${active.map(cu => `<option value="${cu.id}" ${tm && tm.customerId === cu.id ? 'selected' : ''}>${esc(cu.name)}</option>`).join('')}</select>
                <input class="input" id="tm-note" placeholder="What are you working on?" value="${esc(tm ? tm.note || '' : '')}">
                <div class="tm-clock" id="tm-clock">${clock(elapsed())}</div>
                ${tm ? `<button class="btn danger-fill" data-action="st-stop">Stop</button>` : `<button class="btn primary" data-action="st-start">${ICON.right}Start</button>`}
              </div>
              <details class="more" style="margin-top:12px"><summary>Add time by hand</summary><div class="grid3" style="margin-top:10px">
                <div class="field"><label for="tt-date">Date</label><input type="date" class="input" id="tt-date" value="${today()}"></div>
                <div class="field"><label for="tt-hours">Hours</label><input class="input" id="tt-hours" placeholder="1.5" inputmode="decimal"></div>
                <div class="field"><label for="tt-cust">Client</label><select class="input" id="tt-cust">${active.map(cu => `<option value="${cu.id}">${esc(cu.name)}</option>`).join('')}</select></div>
                <div class="field span2"><label for="tt-note">Note</label><input class="input" id="tt-note" placeholder="e.g. October reconciliation"></div>
                <div class="field" style="justify-content:flex-end"><button class="btn" data-action="st-add-time">${ICON.plus}Add</button></div></div></details>` : `<div class="empty" style="padding:24px"><div class="big" style="font-size:18px">Add the businesses you work for</div>Then track time and send them your invoices from here.<div style="margin-top:12px"><button class="btn primary" data-action="st-new-cust">${ICON.plus}Add a client</button></div></div>`}
            </div></div>
          <div class="card"><div class="card-head"><h3>Who you work for</h3></div><div class="card-body list-rows">
            ${st.customers.length ? st.customers.map(cu => { const ub = unbilled(cu.id).reduce((s, t) => s + t.hours, 0); const owed = st.invoices.filter(i => i.customerId === cu.id).map(invState).filter(x => x.k === 'open' || x.k === 'overdue').reduce((s, x) => s + x.due, 0); return `<div class="row clickable-row ${cu.active === false ? 'dim' : ''}" data-action="st-edit-cust" data-id="${cu.id}"><div class="avatar sm" style="background:${(S.data.clients.find(x => x.id === cu.clientId) || {}).color || 'var(--accent)'}">${esc(U.initials(cu.name))}</div><div class="grow"><b>${esc(cu.name)}</b><div class="muted">${cu.billing === 'hourly' ? `${money(cu.rate || st.rate)}/hour` : `${money(cu.fee || 0)}/month${cu.rate ? ` + ${money(cu.rate)}/hr extra` : ''}`}${ub ? ` · ${fmtHours(ub)} unbilled` : ''}</div></div>${owed ? `<span class="num" style="font-weight:600">${money(owed)}</span>` : ''}</div>`; }).join('') : '<div class="muted">Nobody yet.</div>'}
          </div></div>
        </div>
        <div class="dash-grid two">
          <div class="card"><div class="card-head"><h3>Your invoices</h3><button class="btn sm" style="margin-left:auto" data-action="st-new-inv">${ICON.plus}New</button></div>
            <div class="table-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>#</th><th>Client</th><th>Date</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
            ${invs.length ? invs.slice(0, 30).map(i => { const s = invState(i); return `<tr class="clickable" data-action="st-edit-inv" data-id="${i.id}"><td style="font-weight:600">${esc(i.number)}</td><td>${esc((cust(i.customerId) || {}).name || '—')}</td><td class="muted">${fmtDate(i.date)}</td><td><span class="tag ${s.tone}"><span class="dot"></span>${s.label}</span></td><td class="num">${money(s.total)}</td></tr>`; }).join('') : '<tr><td colspan="5" class="muted" style="padding:18px">None yet — "Bill this month" makes them for every client at once.</td></tr>'}
            </tbody></table></div></div>
          <div class="card"><div class="card-head"><h3>Time log</h3></div>
            <div class="table-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Date</th><th>Client</th><th>Note</th><th class="num">Time</th><th></th></tr></thead><tbody>
            ${recentTime.length ? recentTime.map(t => `<tr><td class="muted">${U.fmtDateShort(t.date)}</td><td>${esc((cust(t.customerId) || {}).name || '—')}</td><td class="ellip" style="max-width:220px">${esc(t.note || '')}</td><td class="num">${fmtHours(t.hours)}</td><td style="text-align:right">${t.invoiceId ? '<span class="tag green">Billed</span>' : `<button class="icon-btn" data-action="st-del-time" data-id="${t.id}" title="Delete">${ICON.trash}</button>`}</td></tr>`).join('') : '<tr><td colspan="5" class="muted" style="padding:18px">No time logged yet.</td></tr>'}
            </tbody></table></div></div>
        </div>
        <div class="card" style="margin-top:16px"><div class="card-head"><h3>Invoice settings</h3></div><div class="card-body"><div class="grid3">
          <div class="field"><label for="ss-prefix">Numbers start with</label><input class="input" id="ss-prefix" data-sset="prefix" value="${esc(st.prefix)}"></div>
          <div class="field"><label for="ss-next">Next number</label><input class="input" id="ss-next" data-sset="nextInvoice" value="${st.nextInvoice}" inputmode="numeric"></div>
          <div class="field"><label for="ss-rate">Default hourly rate</label><div class="amt-wrap"><span>$</span><input class="input" id="ss-rate" data-sset="rate" value="${st.rate || ''}" inputmode="decimal"></div></div>
          <div class="field"><label for="ss-terms">Due in (days)</label><input class="input" id="ss-terms" data-sset="terms" value="${st.terms || 15}" inputmode="numeric"></div>
          <div class="field" style="grid-column:span 2"><label for="ss-pay">How clients pay you (printed on invoices)</label><input class="input" id="ss-pay" data-sset="payHow" value="${esc(st.payHow || '')}" placeholder="e.g. Zelle to you@example.com, or check to 123 Main St"></div>
        </div></div></div>`;
    },
    after() {
      clearInterval(tick);
      if (ST().timer) tick = setInterval(() => { const el = $('#tm-clock'); if (!el) return clearInterval(tick); el.textContent = clock(elapsed()); }, 1000);
    }
  });
  let tick;

  function custModal(cu) {
    const isNew = !cu;
    const st = ST();
    cu = cu || { id: C.uid(), name: '', clientId: '', billing: 'monthly', fee: 0, rate: st.rate || 0, email: '', address: '', active: true };
    const books = S.data.clients.filter(x => !x.practice);
    const m = U.openModal(`${U.modalHead(isNew ? 'Add a studio client' : cu.name, 'A business that pays you for bookkeeping')}
      <div class="modal-body"><div class="grid2">
        <div class="field span2"><label for="sc-link">Books in Coll Ledger</label><select class="input" id="sc-link"><option value="">Not linked</option>${books.map(b => `<option value="${b.id}" ${b.id === cu.clientId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select><div class="hint">Linking fills in the name and email from that client.</div></div>
        <div class="field span2"><label for="sc-name">Name on your invoices</label><input class="input" id="sc-name" value="${esc(cu.name)}"></div>
        <div class="field"><label for="sc-email">Email</label><input class="input" id="sc-email" value="${esc(cu.email)}"></div>
        <div class="field"><label for="sc-bill">You charge</label><select class="input" id="sc-bill"><option value="monthly" ${cu.billing === 'monthly' ? 'selected' : ''}>A monthly fee</option><option value="hourly" ${cu.billing === 'hourly' ? 'selected' : ''}>By the hour</option></select></div>
        <div class="field" id="sc-fee-w"><label for="sc-fee">Monthly fee</label><div class="amt-wrap"><span>$</span><input class="input" id="sc-fee" value="${cu.fee || ''}" inputmode="decimal"></div></div>
        <div class="field"><label for="sc-rate">Hourly rate <span class="muted" id="sc-rate-note">(for extra work)</span></label><div class="amt-wrap"><span>$</span><input class="input" id="sc-rate" value="${cu.rate || ''}" inputmode="decimal"></div></div>
        <div class="field span2"><label for="sc-addr">Address</label><textarea class="input" id="sc-addr" rows="2">${esc(cu.address)}</textarea></div>
      </div>${!isNew ? `<label class="check"><input type="checkbox" id="sc-active" ${cu.active !== false ? 'checked' : ''}>Active (included in "Bill this month")</label>` : ''}</div>
      <div class="modal-foot">${!isNew ? `<button class="btn danger left" data-x="del">${ICON.trash}Delete</button>` : '<span class="left"></span>'}<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-x="save">${ICON.check}Save</button></div>`);
    const sync = () => { const h = $('#sc-bill', m).value === 'hourly'; $('#sc-fee-w', m).hidden = h; $('#sc-rate-note', m).textContent = h ? '' : '(for extra work, optional)'; };
    $('#sc-bill', m).onchange = sync; sync();
    $('#sc-link', m).onchange = e => { const b = S.data.clients.find(x => x.id === e.target.value); if (b) { if (!$('#sc-name', m).value) $('#sc-name', m).value = b.legalName || b.name; if (!$('#sc-email', m).value) $('#sc-email', m).value = b.email || ''; if (!$('#sc-addr', m).value) $('#sc-addr', m).value = b.address || ''; } };
    m.querySelector('[data-x=save]').onclick = () => {
      const name = $('#sc-name', m).value.trim(); if (!name) return U.toast('Add a name', null, 'warn');
      Object.assign(cu, { name, clientId: $('#sc-link', m).value, email: $('#sc-email', m).value.trim(), billing: $('#sc-bill', m).value, fee: Math.abs(C.parseAmount($('#sc-fee', m).value) || 0), rate: Math.abs(C.parseAmount($('#sc-rate', m).value) || 0), address: $('#sc-addr', m).value.trim() });
      const a = $('#sc-active', m); if (a) cu.active = a.checked;
      if (isNew) st.customers.push(cu);
      U.closeModal(); commit(); U.toast('Saved');
    };
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { if (st.invoices.some(i => i.customerId === cu.id)) return U.toast('This client has invoices — mark them inactive instead', null, 'warn'); st.customers = st.customers.filter(x => x.id !== cu.id); st.time = st.time.filter(t => t.customerId !== cu.id); U.closeModal(); commit(); };
  }

  function makeInvoice(cu, extraLines) {
    const st = ST();
    const lines = [...(extraLines || [])];
    const time = unbilled(cu.id);
    if (cu.billing === 'monthly' && cu.fee) lines.push({ desc: `Monthly bookkeeping — ${U.fmtMonth(today())}`, qty: 1, rate: cu.fee });
    if (time.length) {
      const rate = cu.rate || st.rate || 0;
      if (rate) lines.push(...time.map(t => ({ desc: `${U.fmtDateShort(t.date)} — ${t.note || 'Bookkeeping'}`, qty: C.round2(t.hours), rate, timeId: t.id })));
    }
    const inv = { id: C.uid(), number: st.prefix + st.nextInvoice++, customerId: cu.id, date: today(), dueDate: C.addDays(today(), +st.terms || 15), status: 'draft', notes: 'Thank you!', lines: lines.length ? lines : [{ desc: 'Bookkeeping services', qty: 1, rate: cu.fee || 0 }] };
    for (const l of inv.lines) if (l.timeId) { const t = st.time.find(x => x.id === l.timeId); if (t) t.invoiceId = inv.id; }
    st.invoices.push(inv);
    return inv;
  }

  function invHTML(i) {
    const st = ST(), f = S.data.firm, cu = cust(i.customerId) || {}, s = invState(i);
    return App.docShell(i.number, `
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div class="serif" style="font-size:24px">${esc(f.name || 'Bookkeeping services')}</div><div class="muted" style="margin-top:8px;line-height:1.6">${esc(f.owner || '')}${f.email ? '<br>' + esc(f.email) : ''}${f.phone ? '<br>' + esc(f.phone) : ''}</div></div>
        <div style="text-align:right"><div class="serif" style="font-size:38px;color:#1E6B53">Invoice</div><div style="margin-top:8px;line-height:1.7"><span class="muted">Number</span>&nbsp; <b>${esc(i.number)}</b><br><span class="muted">Date</span>&nbsp; ${fmtDate(i.date)}<br><span class="muted">Due</span>&nbsp; <b>${fmtDate(i.dueDate)}</b></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin:38px 0 24px;padding:18px 20px;background:#F5F3EE;border-radius:12px">
        <div><div class="muted cap">Bill to</div><b style="font-size:14px">${esc(cu.name || '')}</b><div class="muted" style="white-space:pre-line;margin-top:4px">${esc(cu.address || '')}${cu.email ? '\n' + esc(cu.email) : ''}</div></div>
        <div style="text-align:right"><div class="muted cap">${s.k === 'paid' ? 'Paid in full' : 'Amount due'}</div><div class="serif" style="font-size:28px">${money(s.k === 'paid' ? s.total : s.due)}</div></div>
      </div>
      <table><thead><tr><th>Description</th><th class="num" style="width:80px">Qty / hrs</th><th class="num" style="width:110px">Rate</th><th class="num" style="width:120px">Amount</th></tr></thead>
      <tbody>${i.lines.map(l => `<tr><td>${esc(l.desc)}</td><td class="num">${l.qty}</td><td class="num">${money(l.rate)}</td><td class="num">${money((+l.qty || 0) * (+l.rate || 0))}</td></tr>`).join('')}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><table style="width:280px"><tr><td style="font-weight:700;font-size:15px;border-top:2px solid #16201C;border-bottom:0">Total</td><td class="num" style="font-weight:700;font-size:15px;border-top:2px solid #16201C;border-bottom:0">${money(s.total)}</td></tr></table></div>
      ${st.payHow ? `<div style="margin-top:36px;padding:14px 18px;border:1px solid #E6E2D9;border-radius:10px"><div class="muted cap">How to pay</div>${esc(st.payHow)}</div>` : ''}
      ${i.notes ? `<div style="margin-top:28px;line-height:1.6;white-space:pre-line">${esc(i.notes)}</div>` : ''}`);
  }

  function invModal(i) {
    const st = ST();
    const isNew = !i;
    const active = st.customers.filter(x => x.active !== false);
    if (!st.customers.length) return custModal();
    const draft = i ? JSON.parse(JSON.stringify(i)) : { id: C.uid(), number: st.prefix + st.nextInvoice, customerId: active[0] ? active[0].id : st.customers[0].id, date: today(), dueDate: C.addDays(today(), +st.terms || 15), status: 'draft', notes: 'Thank you!', lines: [{ desc: 'Bookkeeping services', qty: 1, rate: 0 }] };
    const s = i ? invState(i) : null;
    const m = U.openModal(`${U.modalHead(isNew ? 'New studio invoice' : 'Invoice ' + draft.number, s ? `<span class="tag ${s.tone}"><span class="dot"></span>${s.label}</span>` : 'From you to one of your clients')}
      <div class="modal-body">
        <div class="grid3"><div class="field"><label for="si-cust">Client</label><select class="input" id="si-cust">${st.customers.map(cu => `<option value="${cu.id}" ${cu.id === draft.customerId ? 'selected' : ''}>${esc(cu.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="si-date">Date</label><input type="date" class="input" id="si-date" value="${draft.date}"></div><div class="field"><label for="si-due">Due</label><input type="date" class="input" id="si-due" value="${draft.dueDate}"></div></div>
        <div class="table-wrap"><table class="lines"><thead><tr><th>Description</th><th style="width:90px" class="num">Qty / hrs</th><th style="width:110px" class="num">Rate</th><th style="width:110px" class="num">Amount</th><th style="width:34px"></th></tr></thead><tbody id="si-lines"></tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><button class="btn sm" id="si-add">${ICON.plus}Add a line</button><div class="bill-total">Total <b id="si-total"></b></div></div>
        <div class="field"><label for="si-notes">Message</label><input class="input" id="si-notes" value="${esc(draft.notes || '')}"></div>
        ${s && s.k !== 'draft' && s.k !== 'void' ? `<div class="grid3"><div class="field"><label for="si-paid">Amount received</label><div class="amt-wrap"><span>$</span><input class="input" id="si-paid" value="${draft.paidAmount || ''}" placeholder="0.00"></div></div><div class="field"><label for="si-pdate">Date received</label><input type="date" class="input" id="si-pdate" value="${draft.paidDate || today()}"></div><div class="field" style="justify-content:flex-end"><button class="btn" id="si-full">Paid in full</button></div></div>` : ''}
      </div>
      <div class="modal-foot">${!isNew ? `<button class="btn danger left" data-x="del">${ICON.trash}</button>` : '<span class="left"></span>'}<button class="btn" data-x="pdf">${ICON.pdf}PDF</button>${draft.status === 'draft' ? `<button class="btn" data-x="save">Save draft</button><button class="btn primary" data-x="send">${ICON.send}Mark sent</button>` : `<button class="btn primary" data-x="save">${ICON.check}Save</button>`}</div>`, { wide: true });
    const el = $('#si-lines', m);
    const tot = () => { $('#si-total', m).textContent = money(invTotal(draft)); };
    const draw = () => { el.innerHTML = draft.lines.map((l, k) => `<tr data-k="${k}"><td><input class="input sm" data-l="desc" value="${esc(l.desc)}"></td><td><input class="input sm num" data-l="qty" value="${l.qty}"></td><td><input class="input sm num" data-l="rate" value="${l.rate || ''}" placeholder="0.00"></td><td class="num" data-amt>${money((+l.qty || 0) * (+l.rate || 0))}</td><td><button class="icon-btn" data-rm="${k}" aria-label="Remove">${ICON.close}</button></td></tr>`).join(''); tot(); };
    draw();
    el.addEventListener('input', e => { const tr = e.target.closest('tr'); const l = draft.lines[+tr.dataset.k]; const k = e.target.dataset.l; l[k] = k === 'desc' ? e.target.value : (C.parseAmount(e.target.value) || 0); tr.querySelector('[data-amt]').textContent = money((+l.qty || 0) * (+l.rate || 0)); tot(); });
    el.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; const [gone] = draft.lines.splice(+b.dataset.rm, 1); if (gone && gone.timeId) { const t = st.time.find(x => x.id === gone.timeId); if (t) t.invoiceId = null; } if (!draft.lines.length) draft.lines.push({ desc: '', qty: 1, rate: 0 }); draw(); });
    $('#si-add', m).onclick = () => { draft.lines.push({ desc: '', qty: 1, rate: 0 }); draw(); };
    const full = $('#si-full', m); if (full) full.onclick = () => { $('#si-paid', m).value = invTotal(draft).toFixed(2); };
    const collect = () => { draft.customerId = $('#si-cust', m).value; draft.date = $('#si-date', m).value || today(); draft.dueDate = $('#si-due', m).value || draft.date; draft.notes = $('#si-notes', m).value; const p = $('#si-paid', m); if (p) { draft.paidAmount = Math.abs(C.parseAmount(p.value) || 0); draft.paidDate = $('#si-pdate', m).value; } draft.lines = draft.lines.filter(l => l.desc || +l.rate); };
    const persist = () => { const k = st.invoices.findIndex(x => x.id === draft.id); if (k >= 0) st.invoices[k] = draft; else { st.invoices.push(draft); st.nextInvoice++; } };
    const on = (x, fn) => { const b = m.querySelector(`[data-x=${x}]`); if (b) b.onclick = fn; };
    on('save', () => { collect(); persist(); U.closeModal(); commit(); U.toast('Saved'); });
    on('send', () => { collect(); if (!invTotal(draft)) return U.toast('Add an amount', null, 'warn'); draft.status = 'sent'; persist(); U.closeModal(); commit(); U.toast(`${draft.number} marked sent`); });
    on('pdf', () => { collect(); U.printDoc(invHTML(draft), `${draft.number} ${(cust(draft.customerId) || {}).name || ''}.pdf`.trim()); });
    on('del', async () => { if (!await U.confirmBox({ title: 'Delete this invoice?', body: 'Time on it goes back to unbilled.', ok: 'Delete', danger: true })) return; st.time.forEach(t => { if (t.invoiceId === draft.id) t.invoiceId = null; }); st.invoices = st.invoices.filter(x => x.id !== draft.id); U.closeModal(); commit(); });
  }

  act({
    'st-new-cust': () => custModal(),
    'st-edit-cust': el => custModal(cust(el.dataset.id)),
    'st-new-inv': () => invModal(),
    'st-edit-inv': el => invModal(ST().invoices.find(x => x.id === el.dataset.id)),
    'st-start': () => { ST().timer = { customerId: $('#tm-cust').value, note: $('#tm-note').value.trim(), start: Date.now() }; commit(); },
    'st-stop': () => {
      const tm = ST().timer; if (!tm) return;
      const hours = Math.max(0.05, Math.round(elapsed() * 20) / 20); // nearest 3 minutes
      ST().time.push({ id: C.uid(), date: today(), customerId: tm.customerId, hours, note: $('#tm-note') ? $('#tm-note').value.trim() : tm.note, created: Date.now() });
      ST().timer = null; commit(); U.toast(`Logged ${fmtHours(hours)} for ${(cust(tm.customerId) || {}).name || 'client'}`);
    },
    'st-add-time': () => {
      const h = C.parseAmount($('#tt-hours').value);
      if (!(h > 0)) return U.toast('Enter the hours, like 1.5', null, 'warn');
      ST().time.push({ id: C.uid(), date: $('#tt-date').value || today(), customerId: $('#tt-cust').value, hours: C.round2(h), note: $('#tt-note').value.trim(), created: Date.now() });
      commit(); U.toast('Time added');
    },
    'st-del-time': el => { ST().time = ST().time.filter(t => t.id !== el.dataset.id); commit(); },
    'st-bill-month': async () => {
      const st = ST(); const mk = today().slice(0, 7);
      const list = st.customers.filter(x => x.active !== false);
      const already = list.filter(cu => st.invoices.some(i => i.customerId === cu.id && i.date.slice(0, 7) === mk && i.lines.some(l => /^Monthly bookkeeping/.test(l.desc))));
      if (already.length && !await U.confirmBox({ title: 'Some clients are already billed this month', body: `${already.map(x => esc(x.name)).join(', ')} already ${already.length === 1 ? 'has' : 'have'} a monthly invoice for ${U.fmtMonth(today())}. Bill only the others (plus anyone's unbilled time)?`, ok: 'Bill the rest' })) return;
      let n = 0;
      for (const cu of list) {
        const billedFee = already.includes(cu);
        if (billedFee && !unbilled(cu.id).length) continue;
        if (!billedFee || unbilled(cu.id).length) { const fee = cu.fee; if (billedFee) cu.fee = 0; makeInvoice(cu); if (billedFee) cu.fee = fee; n++; }
      }
      commit(); U.toast(n ? `${plural(n, 'draft invoice')} ready — check them, then mark sent` : 'Nothing new to bill');
    },
    'input:sset': () => { }
  });
  document.addEventListener('change', e => {
    const k = e.target.dataset.sset; if (!k) return;
    let v = e.target.value;
    if (k === 'nextInvoice' || k === 'terms') { v = parseInt(v, 10); if (!(v >= 0)) return; }
    if (k === 'rate') v = Math.abs(C.parseAmount(v) || 0);
    ST()[k] = v; save(); U.toast('Saved');
  });
})();
