'use strict';
/* =====================================================================
   Coll Ledger — Mileage, Clean up, receipt reading, payment reminders,
   month-end email, client notes & to-dos, text size and dark mode
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save, snapshot, guardLock } = App;
  const { $, $$, esc, money, fmtDate, fmtDateShort, ICON, plural } = U;
  const today = App.today;
  const firstName = s => String(s || '').trim().split(/\s+/)[0] || '';
  const openMail = (to, subject, body) => {
    const url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (window.desktop) window.desktop.openExternal(url); else window.location.href = url;
  };

  // ==================================================================
  // Mileage log
  // ==================================================================
  S.ui.miles = S.ui.miles || { period: 'ytd' };
  view('mileage', {
    render(c) {
      const r = C.periodRange(S.ui.miles.period, c);
      const sm = C.mileageSummary(c, r.from, r.to);
      const ytd = C.mileageSummary(c, C.periodRange('ytd', c).from, today());
      const rate = C.mileageRate(today());
      const places = [...new Set((c.trips || []).flatMap(t => [t.from, t.to]).filter(Boolean))].slice(0, 30);
      const last = (c.trips || []).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
      return `
        <div class="page-head">
          <div><h1>Mileage</h1><div class="sub">Log business driving for ${esc(c.name)}. Each trip is worth the IRS standard rate — ${(rate * 100).toFixed(1)}¢ a mile right now.</div></div>
          <div class="actions"><button class="btn" data-action="miles-log-pdf">${ICON.pdf}Mileage log PDF</button>${sm.unposted.length ? `<button class="btn primary" data-action="miles-post">${ICON.check}Record ${plural(sm.unposted.length, 'trip')} in the books</button>` : ''}</div>
        </div>
        <div class="kpis">
          <div class="card kpi hero"><div class="label">Deduction this year</div><div class="value">${money(ytd.value)}</div><div class="delta">${ytd.miles.toLocaleString('en-US')} business miles</div></div>
          <div class="card kpi"><div class="label">Trips this year</div><div class="value">${ytd.trips.length}</div><div class="delta">${ytd.unposted.length ? `${ytd.unposted.length} not in the books yet` : 'All recorded'}</div></div>
          <div class="card kpi"><div class="label">Rate today</div><div class="value">${(rate * 100).toFixed(1)}¢</div><div class="delta">Per business mile (IRS)</div></div>
          <div class="card kpi"><div class="label">Not recorded yet</div><div class="value">${money(C.round2(sm.unposted.reduce((s, t) => s + C.tripValue(t), 0)))}</div><div class="delta">Shown period</div></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Log a trip</h3><span class="muted">Takes ten seconds</span></div>
          <div class="card-body"><form class="trip-form" data-trip-form>
            <div class="field"><label for="tr-date">Date</label><input id="tr-date" type="date" class="input" value="${today()}" required></div>
            <div class="field"><label for="tr-from">From</label><input id="tr-from" class="input" list="tr-places" placeholder="Office" value="${esc(last ? last.from : '')}"></div>
            <div class="field"><label for="tr-to">To</label><input id="tr-to" class="input" list="tr-places" placeholder="Client site, bank, supplier…"></div>
            <div class="field grow2"><label for="tr-why">Business reason</label><input id="tr-why" class="input" placeholder="e.g. Pick up supplies at Costco" required></div>
            <div class="field"><label for="tr-mi">Miles (one way)</label><input id="tr-mi" type="number" min="0.1" step="0.1" class="input num" placeholder="0.0" required></div>
            <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="tr-rt" checked> Round trip</label>
            <button class="btn primary" style="align-self:end" type="submit">${ICON.plus}Add trip</button>
            <datalist id="tr-places">${places.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
          </form></div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="toolbar"><select class="input sm" style="width:180px" data-change="miles-period" aria-label="Period">${[['this-month', 'This month'], ['last-month', 'Last month'], ['ytd', 'This year'], ['last-year', 'Last year']].map(([k, l]) => `<option value="${k}" ${S.ui.miles.period === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="muted">${sm.miles.toLocaleString('en-US')} miles · ${money(sm.value)}</span></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Trip</th><th>Reason</th><th class="num">Miles</th><th class="num">Rate</th><th class="num">Value</th><th></th><th></th></tr></thead>
          <tbody>${sm.trips.length ? sm.trips.map(t => `<tr><td class="muted">${fmtDate(t.date)}</td><td>${esc(t.from || '—')} → ${esc(t.to || '—')}${t.roundTrip ? ' <span class="tag">round trip</span>' : ''}</td><td>${esc(t.purpose)}</td>
            <td class="num">${C.tripMiles(t)}</td><td class="num muted">${((t.rate || C.mileageRate(t.date)) * 100).toFixed(1)}¢</td><td class="num" style="font-weight:600">${money(C.tripValue(t))}</td>
            <td>${t.postedId ? `<span class="tag green">${ICON.check}In books</span>` : '<span class="tag gold">Not yet</span>'}</td>
            <td><button class="icon-btn" data-action="trip-del" data-id="${t.id}" aria-label="Delete trip" title="Delete">${ICON.trash}</button></td></tr>`).join('')
            : `<tr><td colspan="8"><div class="empty"><div class="big">No trips logged</div>Every business mile is a deduction. Log trips above as they happen, or catch up from a calendar.</div></td></tr>`}</tbody></table></div>
        </div>
        <p class="muted plan-note">Recording puts each month's mileage on <b>Car &amp; Truck</b>, paid by the owner (<b>Owner's Contributions</b>) — the usual way when the owner drives their own car. Keep this log: the IRS asks for date, miles and business reason for each trip.</p>`;
    },
    after(c) {
      const f = $('[data-trip-form]'); if (!f) return;
      f.onsubmit = e => {
        e.preventDefault();
        const miles = +$('#tr-mi').value, purpose = $('#tr-why').value.trim(), date = $('#tr-date').value;
        if (!date || !(miles > 0) || !purpose) return U.toast('Add the date, miles and a business reason', null, 'warn');
        c.trips = c.trips || [];
        c.trips.push({ id: C.uid(), date, from: $('#tr-from').value.trim(), to: $('#tr-to').value.trim(), purpose, miles: C.round2(miles), roundTrip: $('#tr-rt').checked });
        commit(); U.toast(`Trip added — ${money(C.tripValue(c.trips[c.trips.length - 1]))}`);
        setTimeout(() => { const t = $('#tr-to'); if (t) t.focus(); }, 30);
      };
    }
  });
  act({
    'change:miles-period': el => { S.ui.miles.period = el.value; render(); },
    'trip-del': async el => {
      const c = client(); const t = (c.trips || []).find(x => x.id === el.dataset.id); if (!t) return;
      if (t.postedId) {
        const tx = c.transactions.find(x => x.id === t.postedId);
        if (tx && !await guardLock(c, tx.date)) return;
        if (!await U.confirmBox({ title: 'Delete this trip?', body: 'It is already in the books — its amount will be taken back out of that month\'s mileage entry.', ok: 'Delete', danger: true })) return;
        const undo = snapshot(c);
        if (tx) { tx.amount = C.round2(tx.amount + C.tripValue(t)); if (Math.abs(tx.amount) < 0.005) c.transactions = c.transactions.filter(x => x !== tx); }
        c.trips = c.trips.filter(x => x !== t); commit(); return U.toast('Trip deleted', undo);
      }
      const undo = snapshot(c); c.trips = c.trips.filter(x => x !== t); commit(); U.toast('Trip deleted', undo);
    },
    'miles-post': async () => {
      const c = client();
      const r = C.periodRange(S.ui.miles.period, c);
      const list = C.mileageSummary(c, r.from, r.to).unposted;
      if (!list.length) return;
      const byMonth = new Map();
      for (const t of list) { const k = t.date.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(t); }
      const dates = [...byMonth.keys()].map(k => C.monthEnd(k + '-01') > today() ? today() : C.monthEnd(k + '-01'));
      if (!await guardLock(c, ...dates)) return;
      const undo = snapshot(c);
      const car = C.acctByName(c, 'Car & Truck') || C.ensureAccount(c, { name: 'Car & Truck', type: 'expense', sub: 'expense' });
      const owner = C.acctByKey(c, 'contrib') || C.ensureAccount(c, { name: "Owner's Contributions", type: 'equity', sub: 'equity' });
      for (const [k, trips] of byMonth) {
        const date = C.monthEnd(k + '-01') > today() ? today() : C.monthEnd(k + '-01');
        const value = C.round2(trips.reduce((s, t) => s + C.tripValue(t), 0)), miles = C.round2(trips.reduce((s, t) => s + C.tripMiles(t), 0));
        let tx = c.transactions.find(x => x.mileage && x.date.slice(0, 7) === k);
        if (tx) { tx.amount = C.round2(tx.amount - value); tx.description = `Business mileage — ${U.fmtMonth(k + '-01')}`; }
        else { tx = { id: C.uid(), date, amount: -value, accountId: owner.id, categoryId: car.id, payee: 'Business mileage', description: `Business mileage — ${U.fmtMonth(k + '-01')}`, memo: `${miles} miles at the IRS standard rate`, status: 'posted', mileage: true }; c.transactions.push(tx); }
        for (const t of trips) { t.postedId = tx.id; t.rate = C.mileageRate(t.date); }
      }
      commit(); U.toast(`${money(C.round2(list.reduce((s, t) => s + C.tripValue(t), 0)))} of mileage recorded`, undo);
    },
    'miles-log-pdf': () => {
      const c = client(); const r = C.periodRange(S.ui.miles.period, c);
      const sm = C.mileageSummary(c, r.from, r.to);
      const rows = sm.trips.slice().reverse().map(t => `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.from || '')} → ${esc(t.to || '')}${t.roundTrip ? ' (round trip)' : ''}</td><td>${esc(t.purpose)}</td><td class="num">${C.tripMiles(t)}</td><td class="num">${money(C.tripValue(t))}</td></tr>`).join('');
      U.printDoc(App.docShell(`Mileage log — ${c.name}`, `<div class="page"><div class="cap muted">${esc(c.legalName || c.name)}</div><h1 class="serif" style="font-weight:400;font-size:28px;margin:0 0 4px">Mileage log</h1><div class="muted" style="margin-bottom:22px">${fmtDate(r.from)} – ${fmtDate(r.to > today() ? today() : r.to)}</div>
        <table><thead><tr><th>Date</th><th>Trip</th><th>Business reason</th><th class="num">Miles</th><th class="num">Value</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No trips.</td></tr>'}
        <tr><td colspan="3"><b>Total</b></td><td class="num"><b>${sm.miles}</b></td><td class="num"><b>${money(sm.value)}</b></td></tr></tbody></table>
        <p class="muted" style="margin-top:18px">Valued at the IRS business standard mileage rate in effect on each trip's date.</p></div>`), `Mileage log - ${c.name}.pdf`);
    }
  });

  // ==================================================================
  // Clean up — find and fix problems
  // ==================================================================
  S.ui.clean = S.ui.clean || { scope: 'year' };
  const CLEAN = {
    dup: ['Possible duplicates', 'Same amount, same account, a few days apart — often a file imported twice.', 'red'],
    unc: ['Not categorized', 'Sitting in Uncategorized. Reports are more useful when every dollar has a home.', 'gold'],
    stale: ['Waiting in To Review over 30 days', 'Older items still need a category.', 'gold'],
    odd: ['Unusually large', 'Much bigger than this payee usually is — worth a second look.', 'blue'],
    receipt: ['Receipt needed', 'The IRS asks for receipts on travel, meals, lodging and gifts of $75 or more.', 'blue'],
    aged: ['Unpaid for over 90 days', 'Old invoices — follow up, or void them if they won\'t be paid.', 'red']
  };
  view('cleanup', {
    render(c) {
      const from = S.ui.clean.scope === 'all' ? '1900-01-01' : C.fyStart(c, today());
      const issues = C.cleanupScan(c, { from });
      const groups = Object.keys(CLEAN).map(k => [k, issues.filter(i => i.type === k)]).filter(([, l]) => l.length);
      const accName = id => (C.acct(c, id) || {}).name || '—';
      const tline = t => `<div class="grow" style="min-width:0"><b class="ellip" style="display:block">${esc(t.payee || t.description)}</b><div class="muted">${fmtDate(t.date)} · ${esc(accName(t.accountId))}${t.categoryId ? ' · ' + esc(accName(t.categoryId)) : ''}</div></div><div class="num" style="font-weight:600">${U.signed(t.amount)}</div>`;
      const row = i => {
        const ok = `<button class="btn sm ghost" data-action="clean-ok" data-k="${esc(i.key)}" title="Hide this from the list">Looks fine</button>`;
        switch (i.type) {
          case 'dup': return `<div class="clean-row dup"><div class="dup-pair"><div class="row">${tline(i.a)}<button class="btn sm" data-action="edit-txn" data-id="${i.a.id}">Open</button></div><div class="row">${tline(i.b)}<button class="btn sm" data-action="edit-txn" data-id="${i.b.id}">Open</button></div></div>
            <div class="clean-acts"><button class="btn sm danger-fill" data-action="clean-remove" data-id="${i.b.id}" data-k="${esc(i.key)}">${ICON.trash}Remove the second one</button><button class="btn sm ghost" data-action="clean-ok" data-k="${esc(i.key)}">Not a duplicate</button></div></div>`;
          case 'unc': return `<div class="clean-row"><div class="row">${tline(i.t)}</div><div class="clean-acts"><button class="btn sm primary" data-action="clean-cat" data-id="${i.t.id}">Pick a category</button>${ok}</div></div>`;
          case 'stale': return `<div class="clean-row"><div class="row">${tline(i.t)}</div><div class="clean-acts"><button class="btn sm primary" data-nav="review">Review</button>${ok}</div></div>`;
          case 'odd': return `<div class="clean-row"><div class="row">${tline(i.t)}</div><div class="muted" style="font-size:12px;margin:-4px 0 6px">Usually about ${money(i.typical)}</div><div class="clean-acts"><button class="btn sm" data-action="edit-txn" data-id="${i.t.id}">Open</button>${ok}</div></div>`;
          case 'receipt': return `<div class="clean-row"><div class="row">${tline(i.t)}</div><div class="clean-acts">${window.desktop ? `<button class="btn sm primary" data-action="clean-attach" data-id="${i.t.id}">${ICON.clip}Attach receipt</button>` : ''}${ok}</div></div>`;
          case 'aged': { const cu = C.contact(c, i.inv.contactId); return `<div class="clean-row"><div class="row"><div class="grow"><b>${esc(i.inv.number)} · ${esc(cu ? cu.name : 'Customer')}</b><div class="muted">Due ${fmtDate(i.inv.dueDate)} · ${C.daysBetween(i.inv.dueDate, today())} days late</div></div><div class="num" style="font-weight:600">${money(i.s.due)}</div></div><div class="clean-acts"><button class="btn sm primary" data-action="remind" data-id="${i.inv.id}">${ICON.mail}Send a reminder</button><button class="btn sm" data-action="edit-invoice" data-id="${i.inv.id}">Open</button>${ok}</div></div>`; }
        }
        return '';
      };
      const hidden = (c.cleanupOk || []).length;
      return `
        <div class="page-head">
          <div><h1>Clean up</h1><div class="sub">A quick scan of ${esc(c.name)}'s books for duplicates, loose ends and missing receipts — with one-click fixes.</div></div>
          <div class="actions"><select class="input sm" style="width:150px" data-change="clean-scope" aria-label="What to check"><option value="year" ${S.ui.clean.scope === 'year' ? 'selected' : ''}>This year</option><option value="all" ${S.ui.clean.scope === 'all' ? 'selected' : ''}>All time</option></select>${hidden ? `<button class="btn ghost" data-action="clean-reset">Show ${hidden} hidden</button>` : ''}</div>
        </div>
        ${issues.length ? `<div class="clean-summary">${groups.map(([k, l]) => `<a href="#clean-${k}" class="clean-chip ${CLEAN[k][2]}"><b>${l.length}</b> ${l.length === 1 ? CLEAN[k][0].toLowerCase().replace(/^possible duplicates$/, 'possible duplicate').replace(/^receipt needed$/, 'receipt needed') : CLEAN[k][0].toLowerCase().replace(/^receipt needed$/, 'receipts needed')}</a>`).join('')}</div>` : ''}
        ${issues.length ? groups.map(([k, l]) => `<div class="card clean-group" id="clean-${k}"><div class="card-head"><div><h3>${CLEAN[k][0]} <span class="tag ${CLEAN[k][2]}">${l.length}</span></h3><div class="muted" style="margin-top:3px">${CLEAN[k][1]}</div></div></div>
          <div class="card-body list-rows">${l.slice(0, 40).map(row).join('')}${l.length > 40 ? `<div class="muted">…and ${l.length - 40} more. Fix these first, then come back.</div>` : ''}</div></div>`).join('')
          : `<div class="card"><div class="empty" style="padding:56px 10px"><div class="clean-ok-ic">${ICON.spark}</div><div class="big">Sparkling clean</div>No duplicates, uncategorized items or missing receipts${S.ui.clean.scope === 'year' ? ' this year' : ''}.</div></div>`}`;
    }
  });
  act({
    'change:clean-scope': el => { S.ui.clean.scope = el.value; render(); },
    'clean-ok': el => { const c = client(); c.cleanupOk = c.cleanupOk || []; c.cleanupOk.push(el.dataset.k); commit(); U.toast('Hidden from the list', () => { c.cleanupOk = c.cleanupOk.filter(k => k !== el.dataset.k); commit(); }); },
    'clean-reset': () => { const c = client(); c.cleanupOk = []; commit(); },
    'clean-remove': async el => {
      const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (!t) return;
      if (!await guardLock(c, t.date)) return;
      const undo = snapshot(c); c.transactions = c.transactions.filter(x => x !== t); commit(); U.toast('Duplicate removed', undo);
    },
    'clean-cat': el => {
      const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (!t) return;
      U.categoryPicker(el, c, { selected: t.categoryId, excludeId: t.accountId, amount: t.amount, onPick: async id => { if (!await guardLock(c, t.date)) return; const undo = snapshot(c); t.categoryId = id; if (t.splits) delete t.splits; commit(); U.toast(`Moved to ${(C.acct(c, id) || {}).name}`, undo); } });
    },
    'clean-attach': async el => { const c = client(); const t = c.transactions.find(x => x.id === el.dataset.id); if (!t) return; if (await App.attach.addAttachments(t)) { commit(); U.toast('Receipt attached'); } }
  });

  // ==================================================================
  // Read a receipt (photo or PDF) — fills everything in to check
  // ==================================================================
  async function readReceiptFlow(opts = {}) {
    const c = client(); if (!c) return;
    if (!window.desktop || !window.desktop.readReceipt) return U.toast('Receipt reading works in the desktop app', null, 'warn');
    const [f] = opts.file ? [opts.file] : await U.pickFiles('.png,.jpg,.jpeg,.webp,.gif,.bmp,.pdf'); if (!f) return;
    const isPdf = /\.pdf$/i.test(f.name);
    const url = URL.createObjectURL(new Blob([f.buffer], { type: isPdf ? 'application/pdf' : 'image/' + (f.name.split('.').pop().toLowerCase().replace('jpg', 'jpeg')) }));
    const wait = U.openModal(`${U.modalHead('Reading the receipt…', esc(f.name))}<div class="modal-body"><div class="reading"><div class="spinner"></div><div><b>Reading it on this computer</b><div class="muted">Usually a second or two. Nothing is sent anywhere.</div></div></div></div>`);
    const b64 = (() => { let s = ''; const b = new Uint8Array(f.buffer); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); })();
    const res = await window.desktop.readReceipt(b64, f.name);
    if (!U.modalOpen()) return; // closed while reading
    U.closeModal();
    if (res.error) U.toast("Couldn't read that file — you can still fill it in", null, 'warn');
    const text = res.text || '';
    const r = C.readReceipt(c, text);
    const matches = C.matchReceipt(c, r);
    const vendors = c.contacts.filter(x => x.kind !== 'customer');
    const money_ = App.moneyAccounts(c);
    const sug = r.vendor ? C.suggest(c, { description: r.vendor, payee: r.vendor, amount: -(r.amount || 1) }) : null;
    const d = { vendor: r.vendor, date: r.date || today(), amount: r.amount || '', categoryId: sug ? sug.categoryId : '', accountId: (money_.find(a => a.sub === 'credit') || money_[0] || {}).id, match: matches[0] ? matches[0].id : '' };
    const found = [r.vendor && 'vendor', r.date && 'date', r.amount && 'total'].filter(Boolean);
    const m = U.openModal(`${U.modalHead('Check the receipt', found.length ? `Filled in the ${found.join(', ')} — check and fix anything that's off` : 'Couldn\'t make it out clearly — fill in what you see')}
      <div class="modal-body receipt-grid">
        <div class="receipt-view">${isPdf ? `<iframe src="${url}" title="Receipt"></iframe>` : `<img src="${url}" alt="Receipt">`}${res.scanned ? '<div class="muted" style="margin-top:6px">This PDF is a scan — save it as a photo to have it read.</div>' : ''}</div>
        <div class="receipt-form">
          <div class="field"><label for="rc-vendor">Vendor ${r.vendor ? '<span class="auto-tag">read</span>' : ''}</label><input id="rc-vendor" class="input" list="rc-vendors" value="${esc(d.vendor)}"><datalist id="rc-vendors">${vendors.map(v => `<option value="${esc(v.name)}">`).join('')}</datalist></div>
          <div class="two"><div class="field"><label for="rc-date">Date ${r.date ? '<span class="auto-tag">read</span>' : ''}</label><input id="rc-date" type="date" class="input" value="${d.date}"></div>
          <div class="field"><label for="rc-amt">Total ${r.amount ? '<span class="auto-tag">read</span>' : ''}</label><div class="money-in"><span>$</span><input id="rc-amt" class="input num" type="number" step="0.01" min="0" value="${d.amount}"></div></div></div>
          <div class="field"><label>Category ${sug ? `<span class="auto-tag">${sug.source === 'rule' ? 'smart rule' : sug.source === 'history' ? 'same as last time' : 'best guess'}</span>` : ''}</label><button class="input picker-btn" id="rc-cat" type="button"></button></div>
          <div class="field" id="rc-match-wrap"></div>
          <details class="raw"><summary>What Coll Ledger read</summary><pre>${esc(text.trim() || '(no text found)')}</pre></details>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><span style="flex:1"></span><button class="btn" id="rc-bill">${ICON.file}Save as a bill to pay</button><button class="btn primary" id="rc-go"></button></div>`, { wide: true });
    const drawCat = () => { const a = C.acct(c, d.categoryId); $('#rc-cat', m).innerHTML = a ? esc(a.name) : '<span class="muted">Choose a category…</span>'; };
    const drawMatch = () => {
      const list = C.matchReceipt(c, { amount: +$('#rc-amt', m).value, date: $('#rc-date', m).value });
      if (!list.some(t => t.id === d.match)) d.match = list[0] ? list[0].id : '';
      $('#rc-match-wrap', m).innerHTML = list.length ? `<label>Already in the books?</label><div class="match-list">${list.map(t => `<label class="match-opt"><input type="radio" name="rc-m" value="${t.id}" ${d.match === t.id ? 'checked' : ''}><span class="grow"><b>${esc(t.payee || t.description)}</b><span class="muted"> · ${fmtDateShort(t.date)} · ${esc((C.acct(c, t.accountId) || {}).name || '')}</span></span><span class="num">${money(t.amount)}</span></label>`).join('')}<label class="match-opt"><input type="radio" name="rc-m" value="" ${!d.match ? 'checked' : ''}><span class="grow">No — it's a new expense</span></label></div>`
        : `<label for="rc-acc">Paid from</label><select id="rc-acc" class="input">${money_.map(a => `<option value="${a.id}" ${a.id === d.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`;
      $$('[name=rc-m]', m).forEach(x => x.onchange = () => { d.match = x.value; drawMatch(); });
      const acc = $('#rc-acc', m); if (acc) acc.onchange = () => { d.accountId = acc.value; };
      if (d.match === '' && list.length) $('#rc-match-wrap', m).insertAdjacentHTML('beforeend', `<div class="field" style="margin-top:8px"><label for="rc-acc2">Paid from</label><select id="rc-acc2" class="input">${money_.map(a => `<option value="${a.id}" ${a.id === d.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>`);
      const acc2 = $('#rc-acc2', m); if (acc2) acc2.onchange = () => { d.accountId = acc2.value; };
      $('#rc-go', m).innerHTML = d.match ? `${ICON.clip}Attach to that transaction` : `${ICON.check}Add the expense`;
    };
    drawCat(); drawMatch();
    $('#rc-amt', m).oninput = drawMatch; $('#rc-date', m).onchange = drawMatch;
    $('#rc-cat', m).onclick = e => U.categoryPicker(e.currentTarget, c, { selected: d.categoryId, amount: -1, onPick: id => { d.categoryId = id; drawCat(); } });
    const read = () => ({ vendor: $('#rc-vendor', m).value.trim(), date: $('#rc-date', m).value, amount: C.round2(+$('#rc-amt', m).value || 0) });
    $('#rc-go', m).onclick = async () => {
      const v = read();
      if (d.match) {
        const t = c.transactions.find(x => x.id === d.match); if (!t) return;
        await App.attach.storeFile(t, f.name, f.buffer, true);
        if (d.categoryId && (!t.categoryId || ['unc_inc', 'unc_exp'].includes((C.acct(c, t.categoryId) || {}).key)) && t.status !== 'review') t.categoryId = d.categoryId;
        if (t.status === 'review' && d.categoryId) t.suggestedId = d.categoryId;
        U.closeModal(); commit(); return U.toast(`Receipt attached to ${t.payee || t.description}`);
      }
      if (!v.amount || !v.date) return U.toast('Add the date and total', null, 'warn');
      if (!d.categoryId) return U.toast('Choose a category', null, 'warn');
      if (!await guardLock(c, v.date)) return;
      const undo = snapshot(c);
      const t = { id: C.uid(), date: v.date, amount: -v.amount, accountId: d.accountId, categoryId: d.categoryId, payee: v.vendor, description: v.vendor || 'Receipt', status: 'posted', fromReceipt: true };
      await App.attach.storeFile(t, f.name, f.buffer, true);
      c.transactions.push(t); U.closeModal(); commit(); U.toast(`Added ${money(v.amount)} ${v.vendor ? 'at ' + v.vendor : 'expense'} with the receipt`, undo);
    };
    $('#rc-bill', m).onclick = async () => {
      const v = read();
      if (!v.amount) return U.toast('Add the total', null, 'warn');
      if (!await guardLock(c, v.date)) return;
      const undo = snapshot(c);
      let vend = c.contacts.find(x => x.kind !== 'customer' && v.vendor && C.normName(x.name) === C.normName(v.vendor));
      if (!vend && v.vendor) { vend = { id: C.uid(), kind: 'vendor', name: v.vendor }; c.contacts.push(vend); }
      C.ensureAP(c);
      const b = { id: C.uid(), vendorId: vend ? vend.id : '', ref: '', date: v.date, dueDate: C.addDays(v.date, 30), terms: 30, status: 'open', lines: [{ id: C.uid(), desc: v.vendor ? `${v.vendor} receipt` : 'Receipt', accountId: d.categoryId || (C.acctByKey(c, 'unc_exp') || {}).id, amount: v.amount }] };
      await App.attach.storeFile(b, f.name, f.buffer, true);
      c.bills.push(b); U.closeModal(); commit(); U.toast(`Bill saved — due ${fmtDate(b.dueDate)}`, undo);
      if (opts.thenOpen !== false) go('bills');
    };
  }
  App.readReceipt = readReceiptFlow;
  act({ 'read-receipt': () => readReceiptFlow() });

  // ==================================================================
  // Payment reminders
  // ==================================================================
  const TONES = [['friendly', 'Friendly'], ['firm', 'Firm'], ['final', 'Final notice']];
  function reminderText(c, cu, list, tone) {
    const full = String((cu && (cu.person || cu.name)) || '').trim();
    const business = /\b(inc|llc|ltd|co|corp|company|group|services?|dental|clinic|medical|apartments?|park|church|school|studio|shop|store|restaurant|cafe|café|bakery|landscap\w*|construction|partners|associates|properties|hoa|association|office|center|centre|salon|market|farms?|club|foundation|hotel|motel|bar|grill|auto|repair)\b|&|\d/i.test(full) || full.split(/\s+/).length > 3;
    const hello = full && !business ? `Hi ${firstName(full)},` : 'Hello,';
    const total = list.reduce((s, x) => s + x.s.due, 0);
    const one = list.length === 1 ? list[0] : null;
    const late = Math.max(...list.map(x => C.daysBetween(x.inv.dueDate, today())));
    const lines = list.map(x => `  • ${x.inv.number} — ${money(x.s.due)}, due ${fmtDate(x.inv.dueDate)}`).join('\n');
    const what = one ? `invoice ${one.inv.number} for ${money(one.s.due)}, which was due on ${fmtDate(one.inv.dueDate)}` : `${list.length} invoices totaling ${money(total)}:\n\n${lines}\n`;
    const pay = c.payHow || (S.data.studio && S.data.studio.payHow) || '';
    const sign = `${c.legalName || c.name}${c.email ? '\n' + c.email : ''}${c.phone ? '\n' + c.phone : ''}`;
    const by = fmtDate(C.addDays(today(), tone === 'final' ? 10 : 7));
    const subj = { friendly: `Friendly reminder: ${one ? 'invoice ' + one.inv.number : 'open invoices'} from ${c.name}`, firm: `Past due: ${one ? 'invoice ' + one.inv.number : list.length + ' invoices'} — ${money(total)}`, final: `Final notice: ${money(total)} past due — ${c.name}` }[tone];
    const body = {
      friendly: `${hello}\n\nI hope you're doing well! Just a friendly reminder about ${what}${one ? '.' : ''}\n\nIf you've already sent payment, thank you — please disregard this note. Otherwise, I'd appreciate it when you get a chance.${pay ? '\n\nHow to pay: ' + pay : ''}\n\nThank you,\n${sign}`,
      firm: `${hello}\n\nOur records show ${what}${one ? '' : '\n'}${one ? ` That's now ${late} days past due.` : `The oldest is ${late} days past due.`}\n\nPlease arrange payment by ${by}. If there's a problem with the invoice or you'd like to set up a payment plan, just reply and let me know.${pay ? '\n\nHow to pay: ' + pay : ''}\n\nThank you,\n${sign}`,
      final: `${hello}\n\nThis is a final notice about ${what}${one ? '' : '\n'}${one ? ` It is now ${late} days past due.` : ''}\n\nWe've sent earlier reminders and haven't received payment. Please pay the balance of ${money(total)} by ${by}. If we don't hear from you by then, we'll need to discuss next steps, which may include pausing further work.${pay ? '\n\nHow to pay: ' + pay : ''}\n\nIf you've already paid, please reply so we can update our records.\n\n${sign}`
    }[tone];
    return { subject: subj, body };
  }
  function reminderModal(invId) {
    const c = client();
    const states = c.invoices.map(inv => ({ inv, s: C.invoiceState(c, inv) })).filter(x => x.s.status === 'overdue');
    const start = invId ? c.invoices.find(i => i.id === invId) : null;
    const byCust = new Map();
    for (const x of states) { const k = x.inv.contactId || 'none'; if (!byCust.has(k)) byCust.set(k, []); byCust.get(k).push(x); }
    if (start && !states.some(x => x.inv.id === start.id)) { const s = C.invoiceState(c, start); byCust.set(start.contactId || 'none', [{ inv: start, s }]); }
    const groups = [...byCust.entries()];
    if (!groups.length) return U.toast('No overdue invoices — nothing to chase');
    let gi = start ? Math.max(0, groups.findIndex(([k]) => k === (start.contactId || 'none'))) : 0;
    const sent = new Set();
    const m = U.openModal(`<div id="rm-root"></div>`, { wide: true });
    const draw = () => {
      const [cid, list] = groups[gi];
      const cu = C.contact(c, cid);
      const prev = list.flatMap(x => x.inv.reminders || []).sort((a, b) => b.date.localeCompare(a.date));
      const tone = draw.tone || (prev.length >= 2 ? 'final' : prev.length ? 'firm' : 'friendly');
      draw.tone = tone;
      const t = reminderText(c, cu, list, tone);
      $('#rm-root', m).innerHTML = `${U.modalHead(`Payment reminder${groups.length > 1 ? ` · ${gi + 1} of ${groups.length}` : ''}`, `${esc(cu ? cu.name : 'Customer')} owes ${money(list.reduce((s, x) => s + x.s.due, 0))}${prev.length ? ` · last reminded ${fmtDate(prev[0].date)}` : ''}`)}
        <div class="modal-body">
          <div class="seg">${TONES.map(([k, l]) => `<button class="${tone === k ? 'on' : ''}" data-tone="${k}">${l}</button>`).join('')}</div>
          <div class="two" style="margin-top:12px"><div class="field"><label for="rm-to">To</label><input id="rm-to" class="input" value="${esc(cu && cu.email || '')}" placeholder="customer@email.com"></div><div class="field"><label for="rm-sub">Subject</label><input id="rm-sub" class="input" value="${esc(t.subject)}"></div></div>
          <div class="field"><label for="rm-body">Message <span class="muted">— edit anything you like</span></label><textarea id="rm-body" class="input" rows="13">${esc(t.body)}</textarea></div>
          ${sent.has(gi) ? `<div class="hint-bar">${ICON.check}<span>Marked as sent.</span></div>` : ''}
        </div>
        <div class="modal-foot">${groups.length > 1 ? `<button class="btn ghost" data-nav-g="-1" ${gi === 0 ? 'disabled' : ''}>${ICON.back}</button><button class="btn ghost" data-nav-g="1" ${gi === groups.length - 1 ? 'disabled' : ''}>Next ${ICON.right}</button>` : ''}<span style="flex:1"></span>
          <button class="btn" data-x="copy">${ICON.copy}Copy</button><button class="btn" data-x="mail">${ICON.mail}Open in email</button><button class="btn primary" data-x="sent">${ICON.check}Mark as sent</button></div>`;
      $$('[data-tone]', m).forEach(b => b.onclick = () => { draw.tone = b.dataset.tone; draw(); });
      $$('[data-nav-g]', m).forEach(b => b.onclick = () => { gi = Math.min(groups.length - 1, Math.max(0, gi + +b.dataset.navG)); draw.tone = null; draw(); });
      const val = () => ({ to: $('#rm-to', m).value.trim(), subject: $('#rm-sub', m).value, body: $('#rm-body', m).value });
      $('[data-x=copy]', m).onclick = () => { const v = val(); U.copyText(`Subject: ${v.subject}\n\n${v.body}`); U.toast('Copied — paste it into an email'); };
      $('[data-x=mail]', m).onclick = () => { const v = val(); openMail(v.to, v.subject, v.body); };
      $('[data-x=sent]', m).onclick = () => {
        const v = val();
        if (cu && v.to && !cu.email) cu.email = v.to;
        for (const x of list) { x.inv.reminders = x.inv.reminders || []; x.inv.reminders.push({ date: today(), tone: draw.tone }); }
        sent.add(gi); save();
        if (gi < groups.length - 1) { gi++; draw.tone = null; draw(); U.toast('Logged — here\'s the next one'); }
        else { U.closeModal(); render(); U.toast(groups.length > 1 ? 'All reminders logged' : 'Reminder logged'); }
      };
    };
    draw();
  }
  App.reminderModal = reminderModal;
  act({ 'remind': el => reminderModal(el && el.dataset ? el.dataset.id : null), 'remind-all': () => reminderModal(null) });

  // ==================================================================
  // Month-end email to the client
  // ==================================================================
  function monthEmailModal() {
    const c = client();
    const t = C.parseISO(today());
    const def = C.isoOf(new Date(t.getFullYear(), t.getMonth() - 1, 1)).slice(0, 7);
    const months = Array.from({ length: 12 }, (_, i) => C.isoOf(new Date(t.getFullYear(), t.getMonth() - i, 1)).slice(0, 7));
    let month = def;
    const m = U.openModal(`<div id="me-root"></div>`, { wide: true });
    const draw = () => {
      const s = C.monthSummary(c, month);
      const mon = U.fmtMonth(month + '-01'), prevMon = U.fmtMonth(C.addMonths(month + '-01', -1));
      const up = s.net >= s.prevNet;
      const firm = S.data.firm || {};
      const hello = c.contactName ? firstName(c.contactName) : 'there';
      const body = `Hi ${hello},\n\nYour books for ${mon} are done. Here's the quick summary:\n\n` +
        `  • Money in: ${money(s.income)}\n  • Money out: ${money(s.expenses)}\n  • Profit: ${money(s.net)} (${up ? 'up' : 'down'} from ${money(s.prevNet)} in ${prevMon})\n` +
        `  • Cash in the bank at month end: ${money(s.cash)}\n` +
        (s.cards ? `  • Owed on credit cards: ${money(s.cards)}\n` : '') +
        (s.owedToThem ? `  • Customers owe you: ${money(s.owedToThem)}\n` : '') +
        (s.theyOwe ? `  • Bills still to pay: ${money(s.theyOwe)}\n` : '') +
        (s.top.length ? `\nYour biggest costs were ${s.top.map(x => `${x.a.name} (${money(x.v)})`).join(', ')}.\n` : '') +
        (s.review ? `\nA few transactions (${s.review}) still need your input — I'll send those over separately.\n` : '') +
        `\nThe full reports are attached. Let me know if you have any questions!\n\n${firm.owner || ''}${firm.owner && firm.name ? '\n' : ''}${firm.name || ''}${firm.email ? '\n' + firm.email : ''}`;
      $('#me-root', m).innerHTML = `${U.modalHead('Month-end email', `A short summary for ${esc(c.name)} — send it with the client package`)}
        <div class="modal-body">
          <div class="two"><div class="field"><label for="me-month">Month</label><select id="me-month" class="input">${months.map(k => `<option value="${k}" ${k === month ? 'selected' : ''}>${U.fmtMonth(k + '-01')}</option>`).join('')}</select></div>
          <div class="field"><label for="me-to">To</label><input id="me-to" class="input" value="${esc(c.email || '')}" placeholder="client@email.com"></div></div>
          <div class="me-stats"><div><span>Money in</span><b>${money(s.income)}</b></div><div><span>Money out</span><b>${money(s.expenses)}</b></div><div><span>Profit</span><b class="${s.net < 0 ? 'neg' : 'pos'}">${money(s.net)}</b></div><div><span>Cash at month end</span><b>${money(s.cash)}</b></div></div>
          ${s.review ? `<div class="practice-banner warn-banner" style="margin:10px 0 0">${ICON.alert}<span>${plural(s.review, 'transaction')} from ${mon} or earlier still ${s.review === 1 ? 'needs' : 'need'} review — the numbers may change.</span></div>` : ''}
          <div class="field" style="margin-top:12px"><label for="me-sub">Subject</label><input id="me-sub" class="input" value="${esc(`${c.name} — ${mon} books are ready`)}"></div>
          <div class="field"><label for="me-body">Message <span class="muted">— edit anything you like</span></label><textarea id="me-body" class="input" rows="14">${esc(body)}</textarea></div>
        </div>
        <div class="modal-foot"><button class="btn" data-x="pkg">${ICON.pdf}Make the client package</button><span style="flex:1"></span><button class="btn" data-x="copy">${ICON.copy}Copy</button><button class="btn primary" data-x="mail">${ICON.mail}Open in email</button></div>`;
      $('#me-month', m).onchange = e => { month = e.target.value; draw(); };
      const val = () => ({ to: $('#me-to', m).value.trim(), subject: $('#me-sub', m).value, body: $('#me-body', m).value });
      $('[data-x=copy]', m).onclick = () => { const v = val(); U.copyText(`Subject: ${v.subject}\n\n${v.body}`); U.toast('Copied — paste it into an email'); };
      $('[data-x=mail]', m).onclick = () => { const v = val(); if (v.to && !c.email) { c.email = v.to; save(); } openMail(v.to, v.subject, v.body); };
      $('[data-x=pkg]', m).onclick = () => { U.closeModal(); S.ui.report.period = 'month:' + month; if (actions['client-package']) actions['client-package']({ dataset: {} }); };
    };
    draw();
  }
  App.monthEmailModal = monthEmailModal;
  act({ 'month-email': () => monthEmailModal() });

  // ==================================================================
  // Client notes & to-dos (on the Dashboard)
  // ==================================================================
  const dueTodos = c => (c.todos || []).filter(t => !t.done && t.due && t.due <= today());
  App.openTodos = c => (c.todos || []).filter(t => !t.done);
  App.todoAttention = c => dueTodos(c).map(t => `<div class="row"><span class="tag ${t.due < today() ? 'red' : 'gold'}">${ICON.check}</span><div class="grow"><b>${esc(t.text)}</b><div class="muted">To-do · ${t.due < today() ? 'was due ' + fmtDateShort(t.due) : 'due today'}</div></div><button class="btn sm" data-action="todo-done" data-id="${t.id}">Done</button></div>`);
  App.notesCard = c => {
    const open = (c.todos || []).filter(t => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const done = (c.todos || []).filter(t => t.done).sort((a, b) => (b.doneOn || '').localeCompare(a.doneOn || '')).slice(0, 3);
    return `<div class="dash-grid notes-grid">
      <div class="card"><div class="card-head"><h3>To-dos</h3><span class="muted">${open.length ? plural(open.length, 'open item') : 'Nothing open'}</span></div>
        <div class="card-body">
          <form class="todo-add" data-todo-form><input class="input" id="td-text" placeholder="Add a to-do — e.g. Ask about the March deposit" aria-label="New to-do"><input type="date" class="input" id="td-due" aria-label="Due date" title="Due date (optional)"><button class="btn primary" type="submit">${ICON.plus}Add</button></form>
          <div class="todo-list">${open.map(t => `<label class="todo ${t.due && t.due < today() ? 'late' : ''}"><input type="checkbox" data-change="todo-toggle" data-id="${t.id}"><span class="grow">${esc(t.text)}</span>${t.due ? `<span class="todo-due">${t.due < today() ? 'Late · ' : ''}${fmtDateShort(t.due)}</span>` : ''}<button class="icon-btn sm" data-action="todo-del" data-id="${t.id}" aria-label="Delete">${ICON.close}</button></label>`).join('')}
            ${done.map(t => `<label class="todo done"><input type="checkbox" checked data-change="todo-toggle" data-id="${t.id}"><span class="grow">${esc(t.text)}</span><button class="icon-btn sm" data-action="todo-del" data-id="${t.id}" aria-label="Delete">${ICON.close}</button></label>`).join('')}
            ${!open.length && !done.length ? '<div class="muted">Questions for the client, things to check next month — keep them here so nothing slips.</div>' : ''}</div>
        </div></div>
      <div class="card"><div class="card-head"><h3>Notes</h3><span class="muted" id="notes-saved">${c.notesUpdated ? 'Saved ' + fmtDateShort(c.notesUpdated) : 'Saves as you type'}</span></div>
        <div class="card-body"><textarea class="input notes-area" data-input="client-notes" placeholder="Anything worth remembering about ${esc(c.name)} — how they like to be contacted, which card is personal, login hints for their bank (never full passwords)…">${esc(c.notes || '')}</textarea></div></div>
    </div>`;
  };
  App.hooks.push((c, page) => {
    if (page !== 'dashboard' || !c) return;
    const f = $('[data-todo-form]'); if (!f) return;
    f.onsubmit = e => {
      e.preventDefault();
      const text = $('#td-text').value.trim(); if (!text) return;
      c.todos = c.todos || []; c.todos.push({ id: C.uid(), text, due: $('#td-due').value || '', done: false, created: today() });
      commit(); setTimeout(() => { const i = $('#td-text'); if (i) i.focus(); }, 20);
    };
  });
  let notesTimer;
  act({
    'change:todo-toggle': el => { const c = client(); const t = (c.todos || []).find(x => x.id === el.dataset.id); if (!t) return; t.done = el.checked; t.doneOn = el.checked ? today() : ''; commit(); },
    'todo-done': el => { const c = client(); const t = (c.todos || []).find(x => x.id === el.dataset.id); if (!t) return; t.done = true; t.doneOn = today(); commit(); U.toast('Done', () => { t.done = false; commit(); }); },
    'todo-del': (el, e) => { if (e) e.preventDefault(); const c = client(); const t = (c.todos || []).find(x => x.id === el.dataset.id); if (!t) return; c.todos = c.todos.filter(x => x !== t); commit(); U.toast('To-do deleted', () => { c.todos.push(t); commit(); }); },
    'input:client-notes': el => { const c = client(); c.notes = el.value; c.notesUpdated = today(); clearTimeout(notesTimer); notesTimer = setTimeout(() => { save(); const s = $('#notes-saved'); if (s) s.textContent = 'Saved'; }, 400); }
  });

  // ==================================================================
  // Buttons on existing screens
  // ==================================================================
  const addBtn = (html, where = '.page-head .actions') => { const box = $(where); if (box && !box.querySelector(`[data-action="${/data-action="([^"]+)"/.exec(html)[1]}"]`)) box.insertAdjacentHTML('afterbegin', html); };
  App.hooks.push((c, page) => {
    if (!c) return;
    if (page === 'transactions' || page === 'bills') addBtn(`<button class="btn" data-action="read-receipt" title="Reads a photo or PDF and fills everything in">${ICON.spark}Read a receipt</button>`);
    if (page === 'reports' || page === 'close') addBtn(`<button class="btn" data-action="month-email">${ICON.mail}Month-end email</button>`);
    if (page === 'invoices') {
      const n = c.invoices.filter(i => C.invoiceState(c, i).status === 'overdue').length;
      if (n) addBtn(`<button class="btn" data-action="remind-all">${ICON.mail}Send reminders (${n})</button>`);
    }
  });

  // ==================================================================
  // Text size and dark mode
  // ==================================================================
  const SIZES = [['1', 'Normal'], ['1.1', 'Larger'], ['1.22', 'Largest']];
  function applySize() {
    const f = +(S.data && S.data.textSize) || 1;
    if (window.desktop && window.desktop.setZoom) window.desktop.setZoom(f);
    else document.documentElement.style.zoom = f === 1 ? '' : String(f);
  }
  App.onLoad.push(applySize);
  App.sizeControl = () => `<div class="field" style="margin-top:14px"><label>Text size</label><div class="seg">${SIZES.map(([k, l]) => `<button class="${String(S.data.textSize || 1) === k ? 'on' : ''}" data-action="text-size" data-v="${k}">${l}</button>`).join('')}</div><div class="muted" style="margin-top:6px">Shortcut: <span class="kbd">Ctrl</span> <span class="kbd">+</span> / <span class="kbd">−</span> / <span class="kbd">0</span></div></div>`;
  const setSize = v => { S.data.textSize = Math.min(1.4, Math.max(0.9, Math.round(v * 100) / 100)); applySize(); save(); if (S.route.page === 'settings') render(); };
  act({
    'text-size': el => setSize(+el.dataset.v),
    'toggle-dark': () => {
      const cur = S.data.theme === 'dark' || (S.data.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      S.data.theme = cur ? 'light' : 'dark'; commit();
      U.toast(cur ? 'Light mode' : 'Dark mode — easy on the eyes at night');
    }
  });
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const cur = +(S.data && S.data.textSize) || 1;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); setSize(cur + 0.06); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); setSize(cur - 0.06); }
    else if (e.key === '0') { e.preventDefault(); setSize(1); }
  });
})();
