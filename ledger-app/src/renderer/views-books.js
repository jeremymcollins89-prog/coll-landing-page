'use strict';
/* =====================================================================
   Coll Ledger — invoices, people, reconcile, close the month,
   chart of accounts and smart rules
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save, snapshot, guardLock } = App;
  const { $, $$, esc, money, signed, fmtDate, ICON, plural } = U;
  const today = App.today;
  const catName = (c, id) => { const a = id && C.acct(c, id); return a ? a.name : ''; };

  // ------------------------------------------------------------------
  // Invoices
  // ------------------------------------------------------------------
  view('invoices', {
    render(c) {
      const f = S.ui.inv.filter;
      const all = c.invoices.map(i => ({ i, s: C.invoiceState(c, i) })).sort((a, b) => b.i.date.localeCompare(a.i.date) || String(b.i.number).localeCompare(String(a.i.number)));
      const pick = st => all.filter(x => st.includes(x.s.status));
      const open = pick(['open', 'partial', 'overdue']), overdue = pick(['overdue']), drafts = pick(['draft']);
      const since = C.addDays(today(), -30);
      const paid30 = c.transactions.filter(t => t.invoiceId && t.date >= since).reduce((s, t) => s + t.amount, 0);
      const list = f === 'all' ? all : f === 'open' ? open : pick([f]);
      const stat = (label, value, sub, key, tone = '') => `<div class="card kpi ${f === key ? 'on' : ''}" data-action="inv-filter" data-v="${key}"><div class="label">${label}</div><div class="value ${tone}">${value}</div><div class="delta">${sub}</div></div>`;
      return `
        <div class="page-head">
          <div><h1>Invoices</h1><div class="sub">Bill customers, see who owes what, and record payments as they arrive.</div></div>
          <div class="actions"><button class="btn primary" data-action="new-invoice">${ICON.plus}New invoice</button></div>
        </div>
        <div class="kpis">
          ${stat('Unpaid', money(open.reduce((s, x) => s + x.s.due, 0)), plural(open.length, 'invoice'), 'open')}
          ${stat('Overdue', money(overdue.reduce((s, x) => s + x.s.due, 0)), overdue.length ? `${plural(overdue.length, 'invoice')} past due` : 'Nothing late', 'overdue', overdue.length ? 'neg' : '')}
          ${stat('Paid in the last 30 days', money(paid30), 'Deposited', 'paid')}
          ${stat('Drafts', drafts.length, 'Not sent yet', 'draft')}
        </div>
        <div class="card">
          <div class="toolbar"><div class="seg">${[['all', 'All'], ['open', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['draft', 'Drafts'], ['void', 'Void']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-action="inv-filter" data-v="${k}">${l}</button>`).join('')}</div></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Due</th><th>Status</th><th class="num">Total</th><th class="num">Still owed</th></tr></thead>
            <tbody>${list.length ? list.map(({ i, s }) => {
              const cu = C.contact(c, i.contactId);
              return `<tr class="clickable" data-action="edit-invoice" data-id="${i.id}">
                <td style="font-weight:600">${esc(i.number)}</td><td>${esc(cu ? cu.name : '—')}</td>
                <td class="muted">${fmtDate(i.date)}</td><td class="muted">${fmtDate(i.dueDate)}</td>
                <td><span class="tag ${s.tone}"><span class="dot"></span>${s.label}</span></td>
                <td class="num">${money(s.total)}</td>
                <td class="num" style="font-weight:600">${['paid', 'void'].includes(s.status) ? '<span class="muted">—</span>' : money(s.due)}</td></tr>`;
            }).join('') : `<tr><td colspan="7"><div class="empty"><div class="big">${f === 'all' ? 'No invoices yet' : 'Nothing here'}</div>${f === 'all' ? 'Make one in under a minute.' : 'Try another tab.'}<div style="margin-top:14px"><button class="btn primary" data-action="new-invoice">${ICON.plus}New invoice</button></div></div></td></tr>`}</tbody>
          </table></div>
        </div>`;
    }
  });

  function invoiceModal(c, inv) {
    const isNew = !inv;
    const incomeAccs = c.accounts.filter(a => a.type === 'income' && !a.archived && !(a.key || '').startsWith('unc'));
    const defAcc = (C.acctByKey(c, 'service') || C.acctByKey(c, 'sales') || incomeAccs[0]).id;
    const draft = inv ? JSON.parse(JSON.stringify(inv)) : {
      id: C.uid(), number: c.invoicePrefix + c.nextInvoice, contactId: '', date: today(), dueDate: C.addDays(today(), c.defaultTerms || 30),
      status: 'draft', taxRate: c.defaultTaxRate || 0, discount: 0, notes: c.invoiceNote || 'Thank you for your business!', lines: [{ id: C.uid(), desc: '', qty: 1, rate: 0, accountId: defAcc }]
    };
    const state = inv ? C.invoiceState(c, inv) : null;
    const customers = c.contacts.filter(x => x.kind === 'customer').sort((a, b) => a.name.localeCompare(b.name));
    const payments = inv ? c.transactions.filter(t => t.invoiceId === inv.id) : [];
    const terms = C.daysBetween(draft.date, draft.dueDate);
    const pastDescs = [...new Set(c.invoices.flatMap(i => i.lines.map(l => l.desc)).filter(Boolean))].slice(0, 200);
    const m = U.openModal(`${U.modalHead(isNew ? 'New invoice' : 'Invoice ' + draft.number, state ? `<span class="tag ${state.tone}"><span class="dot"></span>${state.label}</span>${state.paid ? ` &nbsp;${money(state.paid)} received · ${money(state.due)} still owed` : ''}` : '')}
      <div class="modal-body">
        <div class="grid3">
          <div class="field" style="grid-column:span 2"><label for="i-cust">Customer</label><select class="input" id="i-cust"><option value="">Choose a customer…</option>${customers.map(x => `<option value="${x.id}" ${x.id === draft.contactId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ New customer…</option></select>
            <div id="i-newcust" class="inline-new" hidden><input class="input sm" id="i-newname" placeholder="Customer name"><input class="input sm" id="i-newemail" placeholder="Email (optional)"><button class="btn sm primary" id="i-newadd">Add</button></div></div>
          <div class="field"><label for="i-num">Invoice #</label><input class="input" id="i-num" value="${esc(draft.number)}"></div>
          <div class="field"><label for="i-date">Invoice date</label><input type="date" class="input" id="i-date" value="${draft.date}"></div>
          <div class="field"><label for="i-terms">Payment due</label><select class="input" id="i-terms">${[[0, 'On receipt'], [15, 'In 15 days'], [30, 'In 30 days'], [45, 'In 45 days'], [60, 'In 60 days']].map(([d, l]) => `<option value="${d}" ${d === terms ? 'selected' : ''}>${l}</option>`).join('')}${[0, 15, 30, 45, 60].includes(terms) ? '' : `<option value="${terms}" selected>In ${terms} days</option>`}</select></div>
          <div class="field"><label for="i-due">Due date</label><input type="date" class="input" id="i-due" value="${draft.dueDate}"></div>
        </div>
        <div class="table-wrap"><table class="lines"><thead><tr><th>What you're billing for</th><th style="width:180px">Income type</th><th style="width:76px" class="num">Qty</th><th style="width:110px" class="num">Price</th><th style="width:110px" class="num">Amount</th><th style="width:34px"></th></tr></thead><tbody id="i-lines"></tbody></table></div>
        <datalist id="desc-list">${pastDescs.map(d => `<option value="${esc(d)}">`).join('')}</datalist>
        <div><button class="btn sm" id="i-add">${ICON.plus}Add a line</button></div>
        <div class="inv-bottom">
          <div class="field" style="flex:1;min-width:240px"><label for="i-notes">Message on the invoice</label><textarea class="input" id="i-notes">${esc(draft.notes)}</textarea></div>
          <div class="inv-totals">
            <div class="r"><span class="muted">Subtotal</span><span class="num" id="i-sub"></span></div>
            <div class="r"><label class="muted" for="i-disc">Discount ($)</label><input class="input sm num" id="i-disc" value="${draft.discount || ''}" placeholder="0.00"></div>
            <div class="r"><label class="muted" for="i-tax">Sales tax (%)</label><input class="input sm num" id="i-tax" value="${draft.taxRate || ''}" placeholder="0"></div>
            <div class="r big"><span>Total</span><span class="num" id="i-total"></span></div>
          </div>
        </div>
        ${payments.length ? `<div class="card flat"><div class="card-head"><h3>Payments received</h3></div><div class="card-body list-rows">${payments.map(p => `<div class="row"><div class="grow">${fmtDate(p.date)} · ${esc(catName(c, p.accountId))}${p.memo ? ' · ' + esc(p.memo) : ''}</div><div class="num pos" style="font-weight:600">${money(p.amount)}</div><button class="icon-btn" title="Remove this payment" data-pay="${p.id}">${ICON.trash}</button></div>`).join('')}</div></div>` : ''}
      </div>
      <div class="modal-foot">
        ${!isNew ? `<button class="btn ghost left" data-x="more" data-menu>${ICON.dots}More</button>` : '<span class="left"></span>'}
        <button class="btn" data-x="pdf">${ICON.pdf}PDF</button>
        ${draft.status !== 'draft' && draft.status !== 'void' ? `<button class="btn" data-x="email">${ICON.mail}Email</button>` : ''}
        ${draft.status === 'draft' ? `<button class="btn" data-x="save-draft">Save draft</button><button class="btn primary" data-x="send">${ICON.send}Save & mark sent</button>` : `<button class="btn ${state && state.due > 0 && draft.status !== 'void' ? '' : 'primary'}" data-x="save">Save</button>${state && state.due > 0 && draft.status !== 'void' ? `<button class="btn primary" data-x="pay">${ICON.check}Record payment</button>` : ''}`}
      </div>`, { wide: true });

    const linesEl = $('#i-lines', m);
    const drawLines = () => {
      linesEl.innerHTML = draft.lines.map(l => `<tr data-lid="${l.id}">
        <td><input class="input sm" data-l="desc" value="${esc(l.desc)}" placeholder="Service or product" list="desc-list"></td>
        <td><select class="input sm" data-l="accountId">${App.accountOptions(incomeAccs, l.accountId || defAcc)}</select></td>
        <td><input class="input sm num" data-l="qty" value="${l.qty}" inputmode="decimal"></td>
        <td><input class="input sm num" data-l="rate" value="${l.rate || ''}" placeholder="0.00" inputmode="decimal"></td>
        <td class="num" style="font-weight:600" data-amt>${money((+l.qty || 0) * (+l.rate || 0))}</td>
        <td><button class="icon-btn" data-rm="${l.id}" title="Remove line" aria-label="Remove line">${ICON.close}</button></td></tr>`).join('');
    };
    const totals = () => {
      draft.discount = Math.abs(C.parseAmount($('#i-disc', m).value) || 0);
      draft.taxRate = Math.abs(parseFloat($('#i-tax', m).value) || 0);
      const t = C.invoiceTotals(draft);
      $('#i-sub', m).textContent = money(t.subtotal);
      $('#i-total', m).textContent = money(t.total);
    };
    drawLines(); totals();
    linesEl.addEventListener('input', e => {
      const tr = e.target.closest('tr'); const l = draft.lines.find(x => x.id === tr.dataset.lid); const k = e.target.dataset.l;
      if (!l || !k) return;
      l[k] = k === 'qty' || k === 'rate' ? (C.parseAmount(e.target.value) || 0) : e.target.value;
      if (k === 'desc') { const prev = c.invoices.flatMap(i => i.lines).reverse().find(x => x.desc === e.target.value); if (prev && !+l.rate) { l.rate = prev.rate; l.accountId = prev.accountId || l.accountId; tr.querySelector('[data-l=rate]').value = prev.rate; } }
      tr.querySelector('[data-amt]').textContent = money((+l.qty || 0) * (+l.rate || 0));
      totals();
    });
    linesEl.addEventListener('change', e => { if (e.target.dataset.l === 'accountId') { const l = draft.lines.find(x => x.id === e.target.closest('tr').dataset.lid); l.accountId = e.target.value; } });
    linesEl.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; draft.lines = draft.lines.filter(x => x.id !== b.dataset.rm); if (!draft.lines.length) draft.lines.push({ id: C.uid(), desc: '', qty: 1, rate: 0, accountId: defAcc }); drawLines(); totals(); });
    $('#i-add', m).onclick = () => { draft.lines.push({ id: C.uid(), desc: '', qty: 1, rate: 0, accountId: draft.lines[draft.lines.length - 1]?.accountId || defAcc }); drawLines(); linesEl.querySelector('tr:last-child input').focus(); };
    $('#i-disc', m).oninput = totals; $('#i-tax', m).oninput = totals;
    const syncDue = () => { $('#i-due', m).value = C.addDays($('#i-date', m).value || today(), +$('#i-terms', m).value); };
    $('#i-terms', m).onchange = syncDue; $('#i-date', m).onchange = syncDue;
    $('#i-cust', m).onchange = e => { const box = $('#i-newcust', m); box.hidden = e.target.value !== '__new'; if (!box.hidden) $('#i-newname', m).focus(); };
    $('#i-newadd', m).onclick = () => {
      const name = $('#i-newname', m).value.trim(); if (!name) return $('#i-newname', m).focus();
      const nc = { id: C.uid(), kind: 'customer', name, email: $('#i-newemail', m).value.trim(), phone: '', address: '', notes: '' };
      c.contacts.push(nc);
      const sel = $('#i-cust', m); const opt = document.createElement('option'); opt.value = nc.id; opt.textContent = nc.name;
      sel.insertBefore(opt, sel.lastElementChild); sel.value = nc.id; $('#i-newcust', m).hidden = true;
      save(); U.toast(`${name} added`);
    };
    const collect = () => {
      draft.contactId = $('#i-cust', m).value === '__new' ? '' : $('#i-cust', m).value;
      draft.number = $('#i-num', m).value.trim() || draft.number;
      draft.date = $('#i-date', m).value || today();
      draft.dueDate = $('#i-due', m).value || draft.date;
      draft.notes = $('#i-notes', m).value;
      totals();
      draft.lines = draft.lines.filter(l => l.desc || +l.rate);
      if (!draft.lines.length) draft.lines.push({ id: C.uid(), desc: '', qty: 1, rate: 0, accountId: defAcc });
    };
    const persist = () => {
      const idx = c.invoices.findIndex(x => x.id === draft.id);
      if (idx >= 0) c.invoices[idx] = draft;
      else c.invoices.push(draft);
      const n = parseInt(String(draft.number).replace(/\D/g, ''), 10);
      if (String(draft.number).startsWith(c.invoicePrefix) && n >= c.nextInvoice) c.nextInvoice = n + 1;
    };
    const valid = () => {
      if (!draft.contactId) { $('#i-cust', m).focus(); U.toast('Choose who the invoice is for', null, 'warn'); return false; }
      if (!C.invoiceTotals(draft).total) { U.toast('Add at least one line with a price', null, 'warn'); return false; }
      if (c.invoices.some(x => x.id !== draft.id && String(x.number).trim() === String(draft.number).trim())) { $('#i-num', m).focus(); U.toast(`Invoice ${draft.number} already exists — use another number`, null, 'warn'); return false; }
      return true;
    };
    const on = (x, fn) => { const b = m.querySelector(`[data-x=${x}]`); if (b) b.onclick = fn; };
    on('save-draft', () => { collect(); persist(); U.closeModal(); commit(); U.toast('Draft saved'); });
    on('send', async () => { collect(); if (!valid()) return; if (!await guardLock(c, draft.date)) return; draft.status = 'sent'; persist(); U.closeModal(); commit(); U.toast(`Invoice ${draft.number} is ready to send`); });
    on('save', async () => { collect(); if (draft.status !== 'void' && !valid()) return; if (!await guardLock(c, draft.date, inv && inv.date)) return; persist(); U.closeModal(); commit(); U.toast('Invoice saved'); });
    on('pdf', () => { collect(); U.printDoc(invoiceHTML(c, draft), `${draft.number} ${(C.contact(c, draft.contactId) || {}).name || ''}.pdf`.trim()); });
    on('email', () => { collect(); emailInvoice(c, draft); });
    on('pay', () => { collect(); if (!valid()) return; persist(); save(); U.closeModal(); paymentModal(c, draft); });
    on('more', e => {
      const menu = U.openMenu(e.currentTarget, `<div class="mi" data-m="dup">${ICON.copy}Duplicate as a new draft</div>${draft.status !== 'void' && draft.status !== 'draft' ? `<div class="mi" data-m="void">${ICON.close}Void (keep a record, owe nothing)</div>` : ''}${draft.status === 'void' ? `<div class="mi" data-m="unvoid">${ICON.refresh}Restore this invoice</div>` : ''}<div class="sep"></div><div class="mi danger-mi" data-m="del">${ICON.trash}Delete</div>`);
      menu.onclick = async ev => {
        const it = ev.target.closest('[data-m]'); if (!it) return; U.closeMenus();
        const k = it.dataset.m;
        if (k === 'dup') { U.closeModal(); const copy = JSON.parse(JSON.stringify(draft)); Object.assign(copy, { id: C.uid(), number: c.invoicePrefix + c.nextInvoice, date: today(), dueDate: C.addDays(today(), C.daysBetween(draft.date, draft.dueDate)), status: 'draft' }); copy.lines.forEach(l => l.id = C.uid()); c.invoices.push(copy); c.nextInvoice++; commit(); invoiceModal(c, copy); }
        if (k === 'void') { if (payments.length) return U.toast('Remove the payments first, then void it', null, 'warn'); if (!await guardLock(c, draft.date)) return; const undo = snapshot(c); draft.status = 'void'; persist(); U.closeModal(); commit(); U.toast(`Invoice ${draft.number} voided`, undo); }
        if (k === 'unvoid') { draft.status = 'sent'; persist(); U.closeModal(); commit(); U.toast('Invoice restored'); }
        if (k === 'del') {
          if (payments.length) return U.toast('Remove its payments first', null, 'warn');
          if (!await U.confirmBox({ title: 'Delete this invoice?', body: `Invoice <b>${esc(draft.number)}</b> will be removed. If it was already sent, voiding keeps a cleaner record.`, ok: 'Delete', danger: true })) return;
          if (!await guardLock(c, draft.date)) return;
          const undo = snapshot(c); c.invoices = c.invoices.filter(x => x.id !== draft.id); U.closeModal(); commit(); U.toast('Invoice deleted', undo);
        }
      };
    });
    $$('[data-pay]', m).forEach(b => b.onclick = async () => {
      const p = c.transactions.find(t => t.id === b.dataset.pay); if (!p) return;
      if (!await guardLock(c, p.date)) return;
      c.transactions = c.transactions.filter(t => t.id !== b.dataset.pay); save(); U.closeModal(); render(); invoiceModal(c, c.invoices.find(x => x.id === draft.id)); U.toast('Payment removed');
    });
  }
  App.invoiceModal = invoiceModal;

  function emailInvoice(c, inv) {
    const cu = C.contact(c, inv.contactId) || {};
    const st = c.invoices.some(x => x.id === inv.id) ? C.invoiceState(c, inv) : { due: C.invoiceTotals(inv).total };
    const subject = `Invoice ${inv.number} from ${c.legalName || c.name}`;
    const body = `Hi ${(cu.name || '').split(' ')[0] || 'there'},\n\nAttached is invoice ${inv.number} for ${money(st.due)}, due ${fmtDate(inv.dueDate)}.\n\n${inv.notes || 'Thank you!'}\n\n${c.legalName || c.name}${c.phone ? '\n' + c.phone : ''}`;
    const m = U.openModal(`${U.modalHead('Email this invoice', 'Two quick steps — your email app does the sending')}
      <div class="modal-body">
        <div class="steps-v">
          <div class="sv"><span class="step-n">1</span><div><b>Save the PDF</b><div class="muted">You'll attach it to the email.</div></div><button class="btn sm" id="e-pdf">${ICON.pdf}Save PDF</button></div>
          <div class="sv"><span class="step-n">2</span><div><b>Open a ready-made email</b><div class="muted">To ${esc(cu.email || 'the customer')} — attach the PDF and send.</div></div><button class="btn sm primary" id="e-open">${ICON.mail}Open email</button></div>
        </div>
        <div class="field"><label>Or copy the message</label><textarea class="input" rows="7" id="e-body">${esc(body)}</textarea></div>
        <div class="muted">Subject: ${esc(subject)}</div>
      </div>
      <div class="modal-foot"><button class="btn" id="e-copy">${ICON.copy}Copy message</button><button class="btn" data-action="close-modal">Done</button></div>`);
    $('#e-pdf', m).onclick = () => U.printDoc(invoiceHTML(c, inv), `${inv.number} ${cu.name || ''}.pdf`.trim());
    $('#e-open', m).onclick = () => {
      const url = `mailto:${encodeURIComponent(cu.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent($('#e-body', m).value)}`;
      if (window.desktop) window.open(url); else location.href = url;
    };
    $('#e-copy', m).onclick = () => U.copyText($('#e-body', m).value);
  }

  function paymentModal(c, inv) {
    const st = C.invoiceState(c, inv);
    const banks = c.accounts.filter(a => (a.sub === 'bank' || a.sub === 'clearing') && !a.archived);
    const cu = C.contact(c, inv.contactId);
    const m = U.openModal(`${U.modalHead('Record a payment', `${esc(cu ? cu.name : '')} · Invoice ${esc(inv.number)} · ${money(st.due)} owed`)}
      <div class="modal-body">
        <div class="grid2">
          <div class="field"><label for="p-amt">Amount received</label><div class="amt-wrap"><span>$</span><input class="input" id="p-amt" value="${st.due.toFixed(2)}" inputmode="decimal" autofocus></div></div>
          <div class="field"><label for="p-date">Date received</label><input type="date" class="input" id="p-date" value="${today()}"></div>
          <div class="field span2"><label for="p-acc">Deposited to</label><select class="input" id="p-acc">${App.accountOptions(banks, banks[0] && banks[0].id)}</select></div>
          <div class="field span2"><label for="p-ref">Reference</label><input class="input" id="p-ref" placeholder="Check #, ACH, card… (optional)"></div>
        </div>
        <div class="note">${ICON.spark} If this deposit is already in To Review from a bank import, exclude that one so it isn't counted twice.</div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="p-go">${ICON.check}Record ${money(st.due)}</button></div>`);
    $('#p-amt', m).oninput = () => { $('#p-go', m).innerHTML = `${ICON.check}Record ${money(C.parseAmount($('#p-amt', m).value) || 0)}`; };
    $('#p-go', m).onclick = async () => {
      const amt = C.parseAmount($('#p-amt', m).value);
      if (!(amt > 0)) return U.toast('Enter the amount received', null, 'warn');
      if (amt - st.due > 0.004 && !await U.confirmBox({ title: 'More than what is owed', body: `The customer owes ${money(st.due)} but you entered ${money(amt)}. Record it anyway?`, ok: 'Record it' })) return;
      const date = $('#p-date', m).value || today();
      if (!await guardLock(c, date)) return;
      const ref = $('#p-ref', m).value.trim();
      c.transactions.push({ id: C.uid(), date, description: `Payment for ${inv.number}${ref ? ' · ' + ref : ''}`, payee: cu ? cu.name : 'Customer', amount: C.round2(amt), accountId: $('#p-acc', m).value, categoryId: C.acctByKey(c, 'ar').id, invoiceId: inv.id, memo: ref, status: 'posted', cleared: false, reconciled: false });
      c.transactions.sort((a, b) => a.date.localeCompare(b.date));
      U.closeModal(); commit(); U.toast(`${money(amt)} recorded — ${C.invoiceState(c, inv).status === 'paid' ? 'invoice paid in full' : 'partly paid'}`);
    };
  }

  function invoiceHTML(c, inv) {
    const cu = C.contact(c, inv.contactId) || { name: '' };
    const t = C.invoiceTotals(inv);
    const st = c.invoices.some(x => x.id === inv.id) && inv.status !== 'draft' ? C.invoiceState(c, inv) : null;
    const due = st ? st.due : t.total;
    return App.docShell(inv.number, `
      ${inv.status === 'void' ? '<div style="position:absolute;top:300px;left:0;right:0;text-align:center;font-size:120px;font-weight:800;color:rgba(180,68,47,.12);transform:rotate(-18deg)">VOID</div>' : ''}
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="display:flex;align-items:center;gap:12px"><div style="width:42px;height:42px;border-radius:11px;background:${c.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">${esc(U.initials(c.name))}</div>
          <div class="serif" style="font-size:22px">${esc(c.legalName || c.name)}</div></div>
          <div class="muted" style="margin-top:12px;line-height:1.55;white-space:pre-line">${esc(c.address)}${c.email ? '\n' + esc(c.email) : ''}${c.phone ? '\n' + esc(c.phone) : ''}</div></div>
        <div style="text-align:right"><div class="serif" style="font-size:38px;letter-spacing:-.02em;color:${c.color}">Invoice</div>
          <div style="margin-top:8px;line-height:1.7"><span class="muted">Number</span>&nbsp; <b>${esc(inv.number)}</b><br><span class="muted">Date</span>&nbsp; ${fmtDate(inv.date)}<br><span class="muted">Due</span>&nbsp; <b>${fmtDate(inv.dueDate)}</b></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin:40px 0 26px;padding:18px 20px;background:#F5F3EE;border-radius:12px">
        <div><div class="muted cap">Bill to</div><b style="font-size:14px">${esc(cu.name)}</b><div class="muted" style="white-space:pre-line;margin-top:4px">${esc(cu.address || '')}${cu.email ? '\n' + esc(cu.email) : ''}</div></div>
        <div style="text-align:right"><div class="muted cap">${st && st.status === 'paid' ? 'Paid in full' : 'Amount due'}</div><div class="serif" style="font-size:28px">${money(due)}</div></div>
      </div>
      <table><thead><tr><th>Description</th><th class="num" style="width:70px">Qty</th><th class="num" style="width:110px">Price</th><th class="num" style="width:120px">Amount</th></tr></thead>
      <tbody>${inv.lines.filter(l => l.desc || +l.rate).map(l => `<tr><td>${esc(l.desc)}</td><td class="num">${l.qty}</td><td class="num">${money(l.rate)}</td><td class="num">${money((+l.qty || 0) * (+l.rate || 0))}</td></tr>`).join('')}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:18px"><table style="width:300px">
        <tr><td class="muted" style="border:0">Subtotal</td><td class="num" style="border:0">${money(t.subtotal)}</td></tr>
        ${t.discount ? `<tr><td class="muted" style="border:0">Discount</td><td class="num" style="border:0">−${money(t.discount)}</td></tr>` : ''}
        ${t.tax ? `<tr><td class="muted" style="border:0">Sales tax (${inv.taxRate}%)</td><td class="num" style="border:0">${money(t.tax)}</td></tr>` : ''}
        <tr><td style="font-weight:700;font-size:15px;border-top:2px solid #16201C;border-bottom:0">Total</td><td class="num" style="font-weight:700;font-size:15px;border-top:2px solid #16201C;border-bottom:0">${money(t.total)}</td></tr>
        ${st && st.paid ? `<tr><td class="muted" style="border:0">Paid</td><td class="num" style="border:0">−${money(st.paid)}</td></tr><tr><td style="font-weight:700;border:0">Balance due</td><td class="num" style="font-weight:700;border:0">${money(st.due)}</td></tr>` : ''}
      </table></div>
      ${inv.notes ? `<div style="margin-top:44px;padding-top:18px;border-top:1px solid #E6E2D9;line-height:1.6;white-space:pre-line">${esc(inv.notes)}</div>` : ''}`);
  }
  App.invoiceHTML = invoiceHTML;

  act({
    'new-invoice': () => { const c = client(); if (!c) return actions['new-client'](); invoiceModal(c); },
    'edit-invoice': el => { const c = client(); const i = c.invoices.find(x => x.id === el.dataset.id); if (i) invoiceModal(c, i); },
    'inv-filter': el => { S.ui.inv.filter = el.dataset.v; if (S.route.page !== 'invoices') go('invoices'); else render(); }
  });

  // ------------------------------------------------------------------
  // Customers & vendors
  // ------------------------------------------------------------------
  view('contacts', {
    render(c) {
      const kind = S.ui.contacts.kind;
      const list = c.contacts.filter(x => x.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
      const since = C.addDays(today(), -365);
      const stats = x => {
        if (kind === 'customer') {
          const invs = c.invoices.filter(i => i.contactId === x.id && !['draft', 'void'].includes(i.status));
          const billed = invs.filter(i => i.date >= since).reduce((s, i) => s + C.invoiceTotals(i).total, 0);
          const open = invs.reduce((s, i) => s + C.invoiceState(c, i).due, 0);
          return [money(billed), open > 0 ? `<b>${money(open)}</b>` : '<span class="muted">—</span>'];
        }
        const n = C.normName(x.name), k = C.keyOf(x.name);
        const spent = -c.transactions.filter(t => t.amount < 0 && t.date >= since && (C.normName(t.payee) === n || (k && C.keyOf(t.description).startsWith(k)))).reduce((s, t) => s + t.amount, 0);
        return [money(spent), ''];
      };
      return `
        <div class="page-head">
          <div><h1>Customers &amp; vendors</h1><div class="sub">Customers pay ${esc(c.name)}. Vendors get paid by ${esc(c.name)}.</div></div>
          <div class="actions"><button class="btn" data-nav="import">${ICON.upload}Import list</button><button class="btn primary" data-action="new-contact">${ICON.plus}New ${kind}</button></div>
        </div>
        <div class="card">
          <div class="toolbar"><div class="seg"><button class="${kind === 'customer' ? 'on' : ''}" data-action="contact-kind" data-v="customer">Customers · ${c.contacts.filter(x => x.kind === 'customer').length}</button><button class="${kind === 'vendor' ? 'on' : ''}" data-action="contact-kind" data-v="vendor">Vendors · ${c.contacts.filter(x => x.kind === 'vendor').length}</button></div></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th class="num">${kind === 'customer' ? 'Billed · 12 months' : 'Paid · 12 months'}</th>${kind === 'customer' ? '<th class="num">Still owes</th>' : ''}</tr></thead>
            <tbody>${list.length ? list.map(x => { const [a, b] = stats(x); return `<tr class="clickable" data-action="edit-contact" data-id="${x.id}">
              <td><div style="display:flex;gap:10px;align-items:center"><div class="avatar sm" style="background:${kind === 'customer' ? 'var(--accent)' : 'var(--gold)'}">${esc(U.initials(x.name))}</div><div style="min-width:0"><div class="desc-main">${esc(x.name)}</div>${x.notes ? `<div class="desc-sub ellip">${esc(x.notes)}</div>` : ''}</div></div></td>
              <td class="muted">${esc(x.email)}</td><td class="muted">${esc(x.phone)}</td><td class="num">${a}</td>${kind === 'customer' ? `<td class="num">${b}</td>` : ''}</tr>`; }).join('')
              : `<tr><td colspan="5"><div class="empty"><div class="big">No ${kind}s yet</div>Add them one at a time, or import a list from Square or QuickBooks.</div></td></tr>`}</tbody>
          </table></div>
        </div>`;
    }
  });
  function contactModal(c, x, kind) {
    const isNew = !x;
    x = x || { id: C.uid(), kind: kind || S.ui.contacts.kind, name: '', email: '', phone: '', address: '', notes: '' };
    const m = U.openModal(`${U.modalHead(isNew ? `New ${x.kind}` : x.name)}
      <div class="modal-body"><div class="grid2">
        <div class="field span2"><label for="c-name">Name</label><input class="input" id="c-name" value="${esc(x.name)}" autofocus></div>
        <div class="field"><label for="c-email">Email</label><input class="input" id="c-email" type="email" value="${esc(x.email)}"></div>
        <div class="field"><label for="c-phone">Phone</label><input class="input" id="c-phone" value="${esc(x.phone)}"></div>
        <div class="field span2"><label for="c-addr">Address</label><textarea class="input" id="c-addr" rows="2">${esc(x.address)}</textarea></div>
        <div class="field span2"><label for="c-notes">Notes</label><input class="input" id="c-notes" value="${esc(x.notes)}" placeholder="Terms, contact person, anything useful"></div>
        <div class="field"><label for="c-kind">This is a</label><select class="input" id="c-kind"><option value="customer" ${x.kind === 'customer' ? 'selected' : ''}>Customer (pays us)</option><option value="vendor" ${x.kind === 'vendor' ? 'selected' : ''}>Vendor (we pay them)</option></select></div>
      </div></div>
      <div class="modal-foot">${!isNew ? `<button class="btn danger left" data-x="del">${ICON.trash}Delete</button>` : '<span class="left"></span>'}${!isNew && x.kind === 'customer' ? `<button class="btn" data-x="inv">${ICON.file}New invoice</button>` : ''}<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-x="save">${ICON.check}Save</button></div>`);
    const doSave = () => {
      const name = $('#c-name', m).value.trim();
      if (!name) { U.toast('Add a name', null, 'warn'); return false; }
      Object.assign(x, { name, email: $('#c-email', m).value.trim(), phone: $('#c-phone', m).value.trim(), address: $('#c-addr', m).value.trim(), notes: $('#c-notes', m).value.trim(), kind: $('#c-kind', m).value });
      if (isNew) c.contacts.push(x);
      return true;
    };
    m.querySelector('[data-x=save]').onclick = () => { if (!doSave()) return; U.closeModal(); commit(); U.toast('Saved'); };
    const inv = m.querySelector('[data-x=inv]');
    if (inv) inv.onclick = () => { if (!doSave()) return; U.closeModal(); commit(); invoiceModal(c); setTimeout(() => { const s = $('#i-cust'); if (s) s.value = x.id; }, 30); };
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = () => {
      if (c.invoices.some(i => i.contactId === x.id)) return U.toast('This customer has invoices, so they stay for your records', null, 'warn');
      const undo = snapshot(c); c.contacts = c.contacts.filter(y => y.id !== x.id); U.closeModal(); commit(); U.toast('Deleted', undo);
    };
  }
  act({
    'new-contact': () => contactModal(client()),
    'edit-contact': el => { const c = client(); const x = c.contacts.find(y => y.id === el.dataset.id); if (x) contactModal(c, x); },
    'contact-kind': el => { S.ui.contacts.kind = el.dataset.v; render(); }
  });

  // ------------------------------------------------------------------
  // Reconcile
  // ------------------------------------------------------------------
  // Signed effect of a transaction on one account (from that account's point of view)
  function effectOn(t, accId) {
    if (t.accountId === accId) return t.amount;
    if (t.status === 'review') return null;
    if (t.splits && t.splits.length) { const s = t.splits.filter(x => x.categoryId === accId); return s.length ? -s.reduce((a, x) => a + x.amount, 0) : null; }
    if (t.categoryId === accId) return -t.amount;
    return null;
  }
  function reconItems(c, accId, date) {
    const items = [];
    for (const t of c.transactions) {
      if (t.date > date) continue;
      const rk = t.reconciledFor || {};
      const done = t.accountId === accId ? t.reconciled : !!rk[accId];
      if (done) continue;
      const amt = effectOn(t, accId);
      if (amt == null || !amt) continue;
      items.push({ t, amt });
    }
    return items.sort((a, b) => a.t.date.localeCompare(b.t.date));
  }
  function reconciledBalance(c, a) {
    let v = a.opening || 0;
    const debit = C.isDebitNormal(a.type);
    for (const t of c.transactions) {
      const done = t.accountId === a.id ? t.reconciled : !!(t.reconciledFor || {})[a.id];
      if (!done) continue;
      const amt = effectOn(t, a.id);
      if (amt != null) v += debit ? amt : -amt;
    }
    return C.round2(v);
  }

  view('reconcile', {
    render(c) {
      const R = S.ui.recon;
      if (R && R.clientId === c.id && C.acct(c, R.accountId)) {
        const a = C.acct(c, R.accountId);
        const debit = C.isDebitNormal(a.type);
        const items = reconItems(c, a.id, R.date);
        const begin = reconciledBalance(c, a);
        const cleared = C.round2(begin + items.filter(x => R.checked.has(x.t.id)).reduce((s, x) => s + (debit ? x.amt : -x.amt), 0));
        const diff = C.round2(R.ending - cleared);
        const ok = Math.abs(diff) < 0.005;
        const ins = items.filter(x => x.amt > 0), outs = items.filter(x => x.amt < 0);
        const tbl = (title, arr) => `<div class="card"><div class="card-head"><h3>${title}</h3><span class="muted">${arr.filter(x => R.checked.has(x.t.id)).length} of ${arr.length} ticked</span><button class="btn sm ghost" data-action="recon-all" data-side="${arr === ins ? 'in' : 'out'}">Tick all</button></div>
          <div class="table-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th style="width:40px"></th><th>Date</th><th>Payee</th><th class="num">Amount</th></tr></thead><tbody>
          ${arr.map(x => `<tr class="clickable ${R.checked.has(x.t.id) ? 'selected' : ''}" data-action="recon-toggle" data-id="${x.t.id}"><td><span class="tick ${R.checked.has(x.t.id) ? 'on' : ''}">${ICON.check}</span></td><td class="muted">${fmtDate(x.t.date)}</td><td>${esc(x.t.payee || x.t.description)}</td><td class="num">${money(Math.abs(x.amt))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="padding:20px">Nothing here.</td></tr>'}
          </tbody></table></div></div>`;
        return `
          <div class="page-head">
            <div><h1>Reconcile ${esc(a.name)}</h1><div class="sub">Statement ending ${fmtDate(R.date)}. Tick each item you see on the statement — when the difference is $0.00 you're done.</div></div>
            <div class="actions"><button class="btn" data-action="recon-cancel">Save for later</button><button class="btn primary" data-action="recon-finish" ${ok ? '' : 'disabled'}>${ICON.check}Finish</button></div>
          </div>
          <div class="card recon-bar ${ok ? 'balanced' : ''}">
            <div><div class="muted">Starting balance</div><div class="v">${money(begin)}</div></div>
            <div><div class="muted">Statement ending balance</div><div class="v"><button class="link-v" data-action="recon-edit">${money(R.ending)} ${ICON.edit}</button></div></div>
            <div><div class="muted">Ticked so far</div><div class="v">${money(cleared)}</div></div>
            <div><div class="muted">Difference</div><div class="v ${ok ? 'zero' : 'neg'}">${ok ? '✓ $0.00' : money(diff)}</div></div>
          </div>
          ${!ok && items.length ? `<div class="hint-bar">${ICON.spark}<span>Off by ${money(Math.abs(diff))}? Look for a missing transaction, a typo in an amount, or something ticked that isn't on the statement.${items.some(x => Math.abs(Math.abs(x.amt) - Math.abs(diff)) < 0.005 && !R.checked.has(x.t.id)) ? ' <b>One unticked item is exactly that amount.</b>' : ''}</span></div>` : ''}
          <div class="dash-grid two">${tbl(a.sub === 'credit' ? 'Payments & credits' : 'Deposits', debit ? ins : outs)}${tbl(a.sub === 'credit' ? 'Charges' : 'Payments & withdrawals', debit ? outs : ins)}</div>`;
      }
      const accs = App.moneyAccounts(c);
      const bal = C.balances(c, { to: today() });
      const hist = [...c.reconciliations].sort((a, b) => b.completedOn.localeCompare(a.completedOn) || b.date.localeCompare(a.date));
      return `
        <div class="page-head"><div><h1>Reconcile</h1><div class="sub">Each month, match every account to its statement. It proves nothing is missing or doubled.</div></div></div>
        <div class="report-tabs">${accs.map(a => {
          const lr = App.lastRecon(c, a);
          const pending = reconItems(c, a.id, '9999-12-31').length;
          return `<div class="card recon-card"><div style="display:flex;gap:10px;align-items:center"><span class="tag ${a.sub === 'credit' ? 'gold' : 'green'}">${a.sub === 'credit' ? ICON.card : ICON.bank}</span><h4 style="margin:0">${esc(a.name)}</h4></div>
            <div class="rc-bal">${money(bal.get(a.id))}</div>
            <div class="muted">${lr ? 'Done through ' + fmtDate(lr.date) : 'Not reconciled yet'} · ${plural(pending, 'item')} to match</div>
            <button class="btn primary sm" style="margin-top:14px" data-action="start-recon" data-id="${a.id}">Reconcile</button></div>`;
        }).join('') || '<div class="muted">Add a bank or card account in Chart of Accounts first.</div>'}</div>
        <div class="card"><div class="card-head"><h3>Finished reconciliations</h3></div><div class="table-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Account</th><th>Statement date</th><th class="num">Ending balance</th><th>Finished on</th><th></th></tr></thead><tbody>
          ${hist.length ? hist.map((r, i) => `<tr><td>${esc(catName(c, r.accountId))}</td><td>${fmtDate(r.date)}</td><td class="num">${money(r.ending)}</td><td class="muted">${fmtDate(r.completedOn)}</td><td style="text-align:right">${i === hist.findIndex(x => x.accountId === r.accountId) && r.ids ? `<button class="btn sm ghost" data-action="recon-undo" data-id="${r.id}">Undo</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="5" class="muted" style="padding:20px">None yet.</td></tr>'}
        </tbody></table></div></div>`;
    }
  });

  function startRecon(c, accId) {
    const a = C.acct(c, accId); if (!a) return;
    if (S.ui.recon && S.ui.recon.clientId === c.id && S.ui.recon.accountId === accId) return go('reconcile');
    const lr = App.lastRecon(c, a);
    const t = C.parseISO(today());
    const lastMonthEnd = C.isoOf(new Date(t.getFullYear(), t.getMonth(), 0));
    const suggested = lr && lr.date >= lastMonthEnd ? today() : (lr ? C.isoOf(new Date(C.parseISO(lr.date).getFullYear(), C.parseISO(lr.date).getMonth() + 2, 0)) : lastMonthEnd);
    const m = U.openModal(`${U.modalHead('Reconcile ' + a.name, lr ? `Last done through ${fmtDate(lr.date)} at ${money(lr.ending)}` : 'First time for this account')}
      <div class="modal-body">
        <div class="muted">Have the ${a.sub === 'credit' ? 'card' : 'bank'} statement handy. Enter two numbers from it:</div>
        <div class="grid2">
          <div class="field"><label for="r-date">Statement ending date</label><input type="date" class="input" id="r-date" value="${suggested > today() ? today() : suggested}"></div>
          <div class="field"><label for="r-bal">${a.sub === 'credit' ? 'New balance (what you owe)' : 'Ending balance'}</label><div class="amt-wrap"><span>$</span><input class="input" id="r-bal" placeholder="0.00" inputmode="decimal" autofocus></div></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="r-go">Start</button></div>`);
    $('#r-go', m).onclick = () => {
      const ending = C.parseAmount($('#r-bal', m).value);
      if (isNaN(ending)) return U.toast('Enter the ending balance from the statement', null, 'warn');
      const date = $('#r-date', m).value || today();
      const checked = new Set(reconItems(c, a.id, date).filter(x => x.t.cleared && x.t.accountId === a.id).map(x => x.t.id));
      S.ui.recon = { clientId: c.id, accountId: a.id, date, ending: C.round2(ending), checked };
      U.closeModal(); go('reconcile');
    };
  }
  act({
    'start-recon': el => startRecon(client(), el.dataset.id),
    'recon-toggle': el => { const s = S.ui.recon.checked; s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); render(); },
    'recon-all': el => { const R = S.ui.recon; reconItems(client(), R.accountId, R.date).filter(x => el.dataset.side === 'in' ? x.amt > 0 : x.amt < 0).forEach(x => R.checked.add(x.t.id)); render(); },
    'recon-cancel': () => { S.ui.recon.parked = true; const R = S.ui.recon; S.ui.recon = null; S.ui.parkedRecon = R; render(); U.toast('Saved — pick it up from Reconcile any time'); },
    'recon-edit': async () => {
      const R = S.ui.recon;
      const m = U.openModal(`${U.modalHead('Statement ending balance')}<div class="modal-body"><div class="amt-wrap"><span>$</span><input class="input" id="re-bal" value="${R.ending.toFixed(2)}" autofocus></div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="re-go">Update</button></div>`);
      $('#re-go', m).onclick = () => { const v = C.parseAmount($('#re-bal', m).value); if (isNaN(v)) return; R.ending = C.round2(v); U.closeModal(); render(); };
    },
    'recon-finish': () => {
      const c = client(); const R = S.ui.recon;
      const ids = [];
      for (const id of R.checked) {
        const t = c.transactions.find(x => x.id === id); if (!t) continue;
        if (t.accountId === R.accountId) { t.cleared = true; t.reconciled = true; }
        else { t.reconciledFor = Object.assign(t.reconciledFor || {}, { [R.accountId]: true }); }
        ids.push(id);
      }
      c.reconciliations.push({ id: C.uid(), accountId: R.accountId, date: R.date, ending: R.ending, completedOn: today(), ids });
      S.ui.recon = null; commit(); U.toast('Reconciled — the books match the statement');
    },
    'recon-undo': async el => {
      const c = client(); const r = c.reconciliations.find(x => x.id === el.dataset.id); if (!r) return;
      if (!await U.confirmBox({ title: 'Undo this reconciliation?', body: `Items ticked for ${esc(catName(c, r.accountId))} through ${fmtDate(r.date)} go back to unreconciled.`, ok: 'Undo it' })) return;
      for (const id of r.ids || []) { const t = c.transactions.find(x => x.id === id); if (!t) continue; if (t.accountId === r.accountId) t.reconciled = false; else if (t.reconciledFor) delete t.reconciledFor[r.accountId]; }
      c.reconciliations = c.reconciliations.filter(x => x.id !== r.id); commit(); U.toast('Reconciliation undone');
    }
  });
  // resume a parked reconciliation when its account is opened again
  const origStart = actions['start-recon'];
  actions['start-recon'] = el => { const P = S.ui.parkedRecon; if (P && P.clientId === client().id && P.accountId === el.dataset.id) { S.ui.recon = P; S.ui.parkedRecon = null; return go('reconcile'); } origStart(el); };
  App.reconItems = reconItems;

  // ------------------------------------------------------------------
  // Close the month
  // ------------------------------------------------------------------
  view('close', {
    render(c) {
      const t = C.parseISO(today());
      const suggestedEnd = c.lockDate ? C.isoOf(new Date(C.parseISO(c.lockDate).getFullYear(), C.parseISO(c.lockDate).getMonth() + 2, 0)) : C.isoOf(new Date(t.getFullYear(), t.getMonth(), 0));
      const end = S.ui.close.month || (suggestedEnd > today() ? C.isoOf(new Date(t.getFullYear(), t.getMonth(), 0)) : suggestedEnd);
      const start = end.slice(0, 8) + '01';
      const inMonth = x => x.date >= start && x.date <= end;
      const review = c.transactions.filter(x => x.status === 'review' && x.date <= end);
      const accs = App.moneyAccounts(c).filter(a => c.transactions.some(x => (x.accountId === a.id || x.categoryId === a.id) && x.date <= end));
      const unrec = accs.filter(a => { const lr = App.lastRecon(c, a); return !lr || lr.date < end; });
      const drafts = c.invoices.filter(i => i.status === 'draft' && i.date <= end);
      const unc = c.transactions.filter(x => inMonth(x) && x.status !== 'review' && x.categoryId && ['unc_inc', 'unc_exp'].includes((C.acct(c, x.categoryId) || {}).key));
      const pl = C.profitLoss(c, start, end);
      const prevEnd = C.isoOf(new Date(C.parseISO(start).getFullYear(), C.parseISO(start).getMonth(), 0));
      const plPrev = C.profitLoss(c, prevEnd.slice(0, 8) + '01', prevEnd);
      const big = [...pl.expense, ...pl.cogs].map(x => { const p = [...plPrev.expense, ...plPrev.cogs].find(y => y.a.id === x.a.id); return { x, prev: p ? p.v : 0 }; }).filter(o => o.prev > 50 && Math.abs(o.x.v - o.prev) / o.prev > 0.5).slice(0, 4);
      const closed = c.lockDate && c.lockDate >= end;
      const checks = [
        [!review.length, review.length ? `${plural(review.length, 'transaction')} still need a category` : 'Every transaction has a category', 'review', 'Review'],
        [!unrec.length, unrec.length ? `Reconcile ${unrec.map(a => esc(a.name)).join(', ')} through ${U.fmtDateShort(end)}` : 'Every account is reconciled through the month end', 'reconcile', 'Reconcile'],
        [!drafts.length, drafts.length ? `${plural(drafts.length, 'draft invoice')} dated this month or earlier` : 'No draft invoices left behind', 'invoices', 'Invoices'],
        [!unc.length, unc.length ? `${plural(unc.length, 'transaction')} filed as "Uncategorized"` : 'Nothing parked in Uncategorized', 'transactions', 'Fix']
      ];
      const ready = checks.every(x => x[0]);
      const months = [];
      for (let i = 0; i < 14; i++) { const d = new Date(t.getFullYear(), t.getMonth() - i, 0); months.push(C.isoOf(d)); }
      return `
        <div class="page-head">
          <div><h1>Close the month</h1><div class="sub">Finish the month, then lock it so the numbers you send ${esc(c.name)} never change by accident.</div></div>
          <div class="actions"><select class="input" style="width:210px" data-change="close-month" aria-label="Month">${months.map(mo => `<option value="${mo}" ${mo === end ? 'selected' : ''}>${U.fmtMonth(mo)}${c.lockDate && c.lockDate >= mo ? ' · closed' : ''}</option>`).join('')}</select></div>
        </div>
        ${closed ? `<div class="card closed-banner"><div>${ICON.lock}</div><div class="grow"><b>${U.fmtMonth(end)} is closed</b><div class="muted">The books are locked through ${fmtDate(c.lockDate)}. Changes on or before that date ask first.</div></div><button class="btn" data-action="reopen-month">Reopen</button><button class="btn primary" data-action="client-package" data-start="${start}" data-end="${end}">${ICON.pdf}Client package</button></div>` : ''}
        <div class="dash-grid">
          <div class="card"><div class="card-head"><h3>Checklist for ${U.fmtMonth(end)}</h3><span class="muted">${checks.filter(x => x[0]).length} of ${checks.length} done</span></div>
            <div class="card-body close-list">${checks.map(([ok, text, page, btn]) => `<div class="row"><span class="tick ${ok ? 'on' : 'warn'}">${ok ? ICON.check : '!'}</span><div class="grow">${text}</div>${ok ? '' : `<button class="btn sm" data-nav="${page}">${btn}</button>`}</div>`).join('')}
              <div class="row"><span class="tick on">${ICON.report}</span><div class="grow">Look over the Profit & Loss — anything surprising?${big.length ? `<div class="muted" style="margin-top:4px">Worth a look: ${big.map(o => `${esc(o.x.a.name)} ${o.x.v > o.prev ? 'up' : 'down'} ${Math.round(Math.abs(o.x.v - o.prev) / o.prev * 100)}% from last month`).join(' · ')}</div>` : ''}</div><button class="btn sm" data-action="open-report" data-v="pl" data-period="month:${end}">Open</button></div>
            </div>
            <div class="card-foot">${closed ? '' : `<button class="btn primary big-btn" data-action="close-month" data-end="${end}" ${ready ? '' : 'data-warn="1"'}>${ICON.lock}Close ${U.fmtMonth(end)}</button>${ready ? '' : '<span class="muted">You can still close it — Coll Ledger will ask first.</span>'}`}</div>
          </div>
          <div class="card"><div class="card-head"><h3>${U.fmtMonth(end)} at a glance</h3></div><div class="card-body">
            <div class="glance"><div><span class="muted">Income</span><b>${money(pl.totalIncome + pl.totalOtherIncome)}</b></div><div><span class="muted">Expenses</span><b>${money(pl.totalExpense + pl.totalCogs + pl.totalOtherExpense)}</b></div><div class="net"><span class="muted">Profit</span><b class="${pl.net < 0 ? 'neg' : 'pos'}">${money(pl.net)}</b></div></div>
            <div class="muted" style="margin-top:14px">Last month: ${money(plPrev.net)} profit</div>
            <button class="btn" style="margin-top:16px;width:100%" data-action="client-package" data-start="${start}" data-end="${end}">${ICON.pdf}Make the client package</button>
          </div></div>
        </div>
        ${c.closes.length ? `<div class="card"><div class="card-head"><h3>Closed months</h3></div><div class="card-body list-rows">${[...c.closes].sort((a, b) => b.end.localeCompare(a.end)).map(x => `<div class="row"><span class="tag green">${ICON.lock}</span><div class="grow"><b>${U.fmtMonth(x.end)}</b><div class="muted">Closed ${fmtDate(x.closedOn)}${x.net != null ? ` · profit ${money(x.net)}` : ''}</div></div></div>`).join('')}</div></div>` : ''}`;
    }
  });
  act({
    'change:close-month': el => { S.ui.close.month = el.value; render(); },
    'close-month': async el => {
      const c = client(); const end = el.dataset.end;
      if (el.dataset.warn && !await U.confirmBox({ title: 'Close with items still open?', body: 'Some checklist items are not done yet. You can close now and fix them later — changes in a closed month just ask first.', ok: 'Close anyway' })) return;
      const start = end.slice(0, 8) + '01';
      c.lockDate = !c.lockDate || end > c.lockDate ? end : c.lockDate;
      c.closes = c.closes.filter(x => x.end !== end);
      c.closes.push({ end, closedOn: today(), net: C.profitLoss(c, start, end).net });
      commit();
      U.toast(`${U.fmtMonth(end)} closed and locked`);
    },
    'reopen-month': async () => {
      const c = client();
      if (!await U.confirmBox({ title: 'Reopen the books?', body: `This unlocks everything back to the previous closed month, so changes stop asking first.`, ok: 'Reopen' })) return;
      const end = S.ui.close.month || c.lockDate;
      c.closes = c.closes.filter(x => x.end < end);
      const prev = c.closes.map(x => x.end).sort().pop();
      c.lockDate = prev || null;
      commit(); U.toast('Reopened');
    }
  });

  // ------------------------------------------------------------------
  // Chart of accounts
  // ------------------------------------------------------------------
  const TYPE_HELP = {
    asset: 'What the business owns — bank accounts, money customers owe, equipment.',
    liability: 'What the business owes — credit cards, loans, sales tax collected.',
    equity: "The owner's stake — money put in, money taken out.",
    income: 'Money earned from sales and services.',
    expense: 'The costs of running the business.'
  };
  view('accounts', {
    render(c) {
      const bal = C.balances(c, { to: today() });
      const used = new Set(); c.transactions.forEach(t => { used.add(t.accountId); used.add(t.categoryId); (t.splits || []).forEach(s => used.add(s.categoryId)); }); c.invoices.forEach(i => i.lines.forEach(l => used.add(l.accountId)));
      return `
        <div class="page-head"><div><h1>Chart of accounts</h1><div class="sub">Every category and account behind the reports. Rename, add or retire them any time — history stays put.</div></div>
          <div class="actions"><button class="btn" data-nav="import">${ICON.upload}Import from QuickBooks</button><button class="btn primary" data-action="new-account">${ICON.plus}New account</button></div></div>
        ${Object.entries(C.TYPES).map(([type, info]) => {
          const list = c.accounts.filter(a => a.type === type).sort((x, y) => x.code.localeCompare(y.code));
          return `<div class="card" style="margin-bottom:16px"><div class="card-head"><div><h3>${info.label}</h3><div class="muted">${TYPE_HELP[type]}</div></div><span class="muted" style="margin-left:auto">${list.length}</span></div>
            <div class="table-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th style="width:84px">Code</th><th>Name</th><th>Kind</th><th class="num">Balance today</th></tr></thead><tbody>
            ${list.map(a => `<tr class="clickable ${a.archived ? 'dim' : ''}" data-action="edit-account" data-id="${a.id}"><td class="muted">${esc(a.code)}</td><td class="desc-main">${esc(a.name)}${a.archived ? ' <span class="tag">Retired</span>' : ''}${a.opening ? ` <span class="tag" title="Has an opening balance">Opening ${money(a.opening)}</span>` : ''}</td><td class="muted">${C.SUB_LABEL[a.sub] || ''}</td><td class="num">${used.has(a.id) || a.opening ? money(bal.get(a.id)) : '<span class="muted">—</span>'}</td></tr>`).join('')}
            </tbody></table></div></div>`;
        }).join('')}`;
    }
  });
  function accountModal(c, a) {
    const isNew = !a;
    a = a || { id: C.uid(), code: '', name: '', type: 'expense', sub: 'expense', key: null, opening: 0, archived: false };
    const subOpts = (type, sel) => C.SUBTYPES[type].map(s => `<option value="${s}" ${s === sel ? 'selected' : ''}>${C.SUB_LABEL[s]}</option>`).join('');
    const inUse = c.transactions.some(t => t.accountId === a.id || t.categoryId === a.id || (t.splits || []).some(s => s.categoryId === a.id)) || c.invoices.some(i => i.lines.some(l => l.accountId === a.id));
    const typeNames = { asset: 'Asset — something it owns', liability: 'Liability — something it owes', equity: "Equity — owner's money", income: 'Income — money earned', expense: 'Expense — a cost' };
    const m = U.openModal(`${U.modalHead(isNew ? 'New account' : a.name, a.key ? 'Built-in account — the name can change, the type cannot' : '')}
      <div class="modal-body"><div class="grid2">
        <div class="field span2"><label for="a-name">Name</label><input class="input" id="a-name" value="${esc(a.name)}" placeholder="e.g. Fuel" autofocus></div>
        <div class="field"><label for="a-type">Type</label><select class="input" id="a-type" ${a.key || inUse ? 'disabled' : ''}>${Object.keys(C.TYPES).map(k => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${typeNames[k]}</option>`).join('')}</select>${inUse && !a.key ? '<div class="hint">In use, so the type is fixed.</div>' : ''}</div>
        <div class="field"><label for="a-sub">Kind</label><select class="input" id="a-sub" ${a.key ? 'disabled' : ''}>${subOpts(a.type, a.sub)}</select></div>
        <div class="field"><label for="a-code">Code</label><input class="input" id="a-code" value="${esc(a.code)}" placeholder="Optional, e.g. 6420"></div>
        <div class="field" id="a-open-wrap"><label for="a-open">Opening balance</label><div class="amt-wrap"><span>$</span><input class="input" id="a-open" value="${a.opening || ''}" placeholder="0.00"></div><div class="hint">On ${fmtDate(c.startDate)}, from the first statement${a.type === 'liability' ? ' (amount owed)' : ''}.</div></div>
      </div>
      ${!isNew && !a.key ? `<label class="check"><input type="checkbox" id="a-arch" ${a.archived ? 'checked' : ''}>Retire this account (hidden from lists, history kept)</label>` : ''}</div>
      <div class="modal-foot">${!isNew && !a.key && !inUse ? `<button class="btn danger left" data-x="del">${ICON.trash}Delete</button>` : '<span class="left"></span>'}<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-x="save">${ICON.check}Save</button></div>`);
    const syncOpen = () => { const ty = $('#a-type', m).value; $('#a-open-wrap', m).style.display = ty === 'asset' || ty === 'liability' ? '' : 'none'; };
    $('#a-type', m).onchange = () => { $('#a-sub', m).innerHTML = subOpts($('#a-type', m).value, C.SUBTYPES[$('#a-type', m).value][0]); syncOpen(); };
    syncOpen();
    m.querySelector('[data-x=save]').onclick = async () => {
      const name = $('#a-name', m).value.trim(); if (!name) return U.toast('Give it a name', null, 'warn');
      if (c.accounts.some(x => x.id !== a.id && C.normName(x.name) === C.normName(name))) return U.toast(`There is already an account called ${name}`, null, 'warn');
      const newOpening = ['asset', 'liability'].includes($('#a-type', m).value) ? (C.parseAmount($('#a-open', m).value) || 0) : 0;
      if (newOpening !== (a.opening || 0) && !await guardLock(c, c.startDate)) return;
      const undo = snapshot(c);
      a.name = name;
      const code = $('#a-code', m).value.trim();
      if (code && c.accounts.some(x => x.id !== a.id && x.code === code)) return U.toast(`Code ${code} is already used`, null, 'warn');
      a.code = code || a.code || String(9000 + c.accounts.length);
      if (!a.key && !inUse) a.type = $('#a-type', m).value;
      if (!a.key) a.sub = $('#a-sub', m).value;
      if (!C.SUBTYPES[a.type].includes(a.sub)) a.sub = C.SUBTYPES[a.type][0];
      a.opening = newOpening;
      const ar = $('#a-arch', m); if (ar) a.archived = ar.checked;
      if (isNew) c.accounts.push(a);
      U.closeModal(); commit(); U.toast('Account saved', undo);
    };
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = () => { const undo = snapshot(c); c.accounts = c.accounts.filter(x => x.id !== a.id); c.rules = c.rules.filter(r => r.categoryId !== a.id); U.closeModal(); commit(); U.toast('Account deleted', undo); };
  }
  act({ 'new-account': () => accountModal(client()), 'edit-account': el => accountModal(client(), C.acct(client(), el.dataset.id)) });

  // ------------------------------------------------------------------
  // Smart rules
  // ------------------------------------------------------------------
  view('rules', {
    render(c) {
      const review = c.transactions.filter(t => t.status === 'review');
      const matches = review.filter(t => C.ruleFor(c, t)).length;
      return `
        <div class="page-head"><div><h1>Smart rules</h1><div class="sub">Teach Coll Ledger once — matching bank activity gets its category automatically from then on. Rules are checked top to bottom.</div></div>
          <div class="actions">${matches ? `<button class="btn gold" data-action="run-rules">${ICON.bolt}Apply to ${matches} waiting</button>` : ''}<button class="btn primary" data-action="new-rule">${ICON.plus}New rule</button></div></div>
        <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>When the bank description contains</th><th>For</th><th>Category</th><th>Rename payee to</th><th>Mode</th><th style="width:70px"></th></tr></thead><tbody>
          ${c.rules.length ? c.rules.map((r, i) => `<tr class="clickable" data-action="edit-rule" data-id="${r.id}"><td><span class="tag blue">“${esc(r.text)}”</span></td><td class="muted">${r.direction === 'in' ? 'Money in' : r.direction === 'out' ? 'Money out' : 'Either'}</td><td><b>${esc(catName(c, r.categoryId) || '—')}</b></td><td class="muted">${esc(r.payee || '')}</td><td>${r.autoAccept ? `<span class="tag green">${ICON.bolt}Automatic</span>` : '<span class="tag">Suggests</span>'}</td>
            <td data-stop style="white-space:nowrap">${i ? `<button class="icon-btn" title="Move up" data-action="rule-up" data-id="${r.id}">▲</button>` : ''}</td></tr>`).join('')
            : `<tr><td colspan="6"><div class="empty"><div class="big">No rules yet</div>Tick “Always use” while reviewing, or make one here.</div></td></tr>`}
        </tbody></table></div></div>`;
    }
  });
  function ruleModal(c, r) {
    const isNew = !r;
    r = r ? { ...r } : { id: C.uid(), text: '', categoryId: '', payee: '', direction: 'any', autoAccept: false };
    const m = U.openModal(`${U.modalHead(isNew ? 'New smart rule' : 'Edit rule')}
      <div class="modal-body"><div class="grid2">
        <div class="field span2"><label for="r-text">When the bank description contains</label><input class="input" id="r-text" value="${esc(r.text)}" placeholder="e.g. shell oil" autofocus></div>
        <div class="field"><label for="r-dir">For</label><select class="input" id="r-dir"><option value="any" ${r.direction === 'any' ? 'selected' : ''}>Money in or out</option><option value="out" ${r.direction === 'out' ? 'selected' : ''}>Money out only</option><option value="in" ${r.direction === 'in' ? 'selected' : ''}>Money in only</option></select></div>
        <div class="field"><label>Category</label><button class="cat-btn big ${r.categoryId ? '' : 'empty'}" id="r-cat" data-menu>${r.categoryId ? esc(catName(c, r.categoryId)) : 'Choose a category'}${ICON.chev}</button></div>
        <div class="field span2"><label for="r-payee">Rename payee to (optional)</label><input class="input" id="r-payee" value="${esc(r.payee)}"></div>
      </div>
      <label class="check"><input type="checkbox" id="r-auto" ${r.autoAccept ? 'checked' : ''}>Automatic — skip To Review for matches when importing</label>
      <div class="note" id="r-hint"></div></div>
      <div class="modal-foot">${!isNew ? `<button class="btn danger left" data-x="del">${ICON.trash}Delete</button>` : '<span class="left"></span>'}<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-x="save">${ICON.check}Save rule</button></div>`);
    $('#r-cat', m).onclick = e => { e.preventDefault(); U.categoryPicker(e.currentTarget, c, { selected: r.categoryId, onPick: id => { r.categoryId = id; e.currentTarget.innerHTML = esc(catName(c, id)) + ICON.chev; e.currentTarget.classList.remove('empty'); } }); };
    const hint = () => { const t = C.normName($('#r-text', m).value); const list = t ? c.transactions.filter(x => C.normName(x.description + ' ' + (x.payee || '')).includes(t)) : []; $('#r-hint', m).innerHTML = t ? `${ICON.search} Matches ${plural(list.length, 'existing transaction')}${list.length ? ` — e.g. “${esc(list[list.length - 1].description)}”` : ''}` : 'Tip: use a short, distinctive part of the description, like the store name.'; };
    $('#r-text', m).oninput = hint; hint();
    m.querySelector('[data-x=save]').onclick = () => {
      const text = $('#r-text', m).value.trim();
      if (!text || !r.categoryId) return U.toast('Add the matching words and a category', null, 'warn');
      Object.assign(r, { text, payee: $('#r-payee', m).value.trim(), direction: $('#r-dir', m).value, autoAccept: $('#r-auto', m).checked });
      const i = c.rules.findIndex(x => x.id === r.id);
      if (i >= 0) c.rules[i] = r; else c.rules.unshift(r);
      U.closeModal(); commit(); U.toast('Rule saved');
    };
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = () => { const undo = snapshot(c); c.rules = c.rules.filter(x => x.id !== r.id); U.closeModal(); commit(); U.toast('Rule deleted', undo); };
  }
  act({
    'new-rule': () => ruleModal(client()),
    'edit-rule': (el, e) => { if (e.target.closest('[data-stop]')) return; const c = client(); ruleModal(c, c.rules.find(r => r.id === el.dataset.id)); },
    'rule-up': (el, e) => { e.stopPropagation(); const c = client(); const i = c.rules.findIndex(r => r.id === el.dataset.id); if (i > 0) { [c.rules[i - 1], c.rules[i]] = [c.rules[i], c.rules[i - 1]]; commit(); } },
    'run-rules': async () => {
      const c = client();
      const list = c.transactions.filter(t => t.status === 'review' && C.ruleFor(c, t));
      if (!await guardLock(c, ...list.map(t => t.date))) return;
      const undo = snapshot(c); let n = 0;
      for (const t of list) { const r = C.ruleFor(c, t); if (r && C.acct(c, r.categoryId) && r.categoryId !== t.accountId) { t.categoryId = r.categoryId; if (r.payee) t.payee = r.payee; t.status = 'posted'; n++; } }
      commit(); U.toast(`${plural(n, 'transaction')} sorted by rules`, undo);
    }
  });
})();
