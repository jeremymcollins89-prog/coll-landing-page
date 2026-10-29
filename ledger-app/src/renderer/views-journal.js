'use strict';
/* =====================================================================
   Coll Ledger — Journal entries
   For adjustments that don't come from the bank: the CPA's adjusting
   entries, depreciation, accruals, prepaid expenses, reclassifications
   and corrections. Every entry must balance (debits = credits).
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save, snapshot, guardLock } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;

  const SOURCES = [['cpa', 'Adjustment from the CPA'], ['depr', 'Depreciation'], ['accrual', 'Accrual'], ['prepaid', 'Prepaid expense'], ['reclass', 'Reclassification'], ['correct', 'Correction'], ['other', 'Other']];
  const acc = (c, name, type, sub) => C.acctByName(c, name) || C.ensureAccount(c, { name, type, sub });
  // Ready-made entries; each returns lines for the client
  const TEMPLATES = {
    depr: c => ({ memo: 'Monthly depreciation', source: 'depr', lines: [{ accountId: acc(c, 'Depreciation Expense', 'expense', 'otherexpense').id, debit: '', credit: '', desc: 'Depreciation expense' }, { accountId: acc(c, 'Accumulated Depreciation', 'asset', 'fixed').id, debit: '', credit: '', desc: 'Accumulated depreciation' }] }),
    accrual: c => ({ memo: 'Accrued expense — owed at month end, not yet billed', source: 'accrual', reverse: true, lines: [{ accountId: (C.acctByName(c, 'Utilities') || {}).id || '', debit: '', credit: '', desc: 'Expense for this month' }, { accountId: acc(c, 'Accrued Liabilities', 'liability', 'current').id, debit: '', credit: '', desc: 'Owed but not yet billed' }] }),
    prepaid: c => ({ memo: 'Use up one month of a prepaid expense', source: 'prepaid', lines: [{ accountId: (C.acctByName(c, 'Insurance') || {}).id || '', debit: '', credit: '', desc: 'This month\'s share' }, { accountId: acc(c, 'Prepaid Expenses', 'asset', 'current').id, debit: '', credit: '', desc: 'Prepaid balance goes down' }] }),
    reclass: c => ({ memo: 'Move an amount to the right category', source: 'reclass', lines: [{ accountId: '', debit: '', credit: '', desc: 'Correct category' }, { accountId: '', debit: '', credit: '', desc: 'Wrong category' }] }),
    interest: c => ({ memo: 'Loan interest (from the lender\'s statement)', source: 'cpa', lines: [{ accountId: acc(c, 'Interest Expense', 'expense', 'otherexpense').id, debit: '', credit: '', desc: 'Interest' }, { accountId: (C.acctByName(c, 'Loans Payable') || {}).id || '', debit: '', credit: '', desc: 'Loan balance' }] })
  };

  view('journal', {
    render(c) {
      const list = (c.journals || []).slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.number).localeCompare(String(a.number)));
      const an = id => (C.acct(c, id) || {}).name || '—';
      return `
        <div class="page-head">
          <div><h1>Journal entries</h1><div class="sub">Adjustments that don't come from the bank — the CPA's adjusting entries, depreciation, accruals and corrections. Every entry must balance: debits equal credits.</div></div>
          <div class="actions"><button class="btn" data-action="je-template" data-menu>${ICON.spark}From a template</button><button class="btn primary" data-action="je-new">${ICON.plus}New journal entry</button></div>
        </div>
        <div class="card je-help"><div class="card-body"><div class="je-rule"><b>Debits</b> increase assets and expenses · <b>Credits</b> increase liabilities, the owner's stake and income</div></div></div>
        <div class="card">
          <div class="table-wrap"><table class="tbl"><thead><tr><th style="width:110px">Date</th><th style="width:70px">No.</th><th>Memo</th><th>Accounts</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(je => { const ck = C.journalCheck(je); return `<tr class="clickable ${je.void ? 'dim' : ''}" data-action="je-edit" data-id="${je.id}"><td class="muted">${fmtDate(je.date)}</td><td>${esc(je.number || '')}</td>
            <td><b style="font-weight:600">${esc(je.memo || 'Journal entry')}</b><div class="muted" style="font-size:12px">${esc((SOURCES.find(s => s[0] === je.source) || [, 'Other'])[1])}${je.reversalOf ? ' · reversing entry' : ''}${je.void ? ' · void' : ''}</div></td>
            <td class="muted" style="font-size:12.5px">${(je.lines || []).filter(l => l.accountId).slice(0, 3).map(l => `${+l.debit ? 'Dr' : 'Cr'} ${esc(an(l.accountId))}`).join('<br>')}${je.lines.length > 3 ? '<br>…' : ''}</td>
            <td class="num" style="font-weight:600">${money(ck.dr)}</td><td>${(je.attachments || []).length ? `<span class="clip-ic">${ICON.clip}</span>` : ''}</td></tr>`; }).join('')
            : `<tr><td colspan="6"><div class="empty"><div class="big">No journal entries yet</div>Most months don't need any. When the CPA sends adjusting entries, or you record depreciation or an accrual, they go here.<div style="margin-top:14px"><button class="btn primary" data-action="je-new">${ICON.plus}New journal entry</button></div></div></td></tr>`}</tbody></table></div>
        </div>`;
    }
  });

  function nextNumber(c) { const n = Math.max(0, ...(c.journals || []).map(j => parseInt(String(j.number || '').replace(/\D/g, '')) || 0)); return 'JE-' + (n + 1); }

  function jeModal(c, je, preset) {
    const isNew = !je;
    const d = JSON.parse(JSON.stringify(je || Object.assign({ id: C.uid(), date: today(), number: nextNumber(c), memo: '', source: 'cpa', reverse: false, lines: [{ accountId: '', debit: '', credit: '', desc: '' }, { accountId: '', debit: '', credit: '', desc: '' }] }, preset || {})));
    const accs = c.accounts.filter(a => !a.archived).sort((a, b) => a.code.localeCompare(b.code));
    const opts = sel => `<option value="">Choose an account…</option>${['asset', 'liability', 'equity', 'income', 'expense'].map(ty => `<optgroup label="${C.TYPES[ty].label}">${accs.filter(a => a.type === ty).map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.code)} · ${esc(a.name)}</option>`).join('')}</optgroup>`).join('')}`;
    const m = U.openModal(`${U.modalHead(isNew ? 'New journal entry' : `Journal entry ${esc(d.number || '')}`, 'Debits must equal credits. Use one side per line.')}
      <div class="modal-body">
        <div class="je-grid"><div class="field"><label for="je-date">Date</label><input type="date" class="input" id="je-date" value="${d.date}"></div>
          <div class="field"><label for="je-num">Entry no.</label><input class="input" id="je-num" value="${esc(d.number || '')}"></div>
          <div class="field"><label for="je-src">Type</label><select class="input" id="je-src">${SOURCES.map(([k, l]) => `<option value="${k}" ${d.source === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <div class="field"><label for="je-memo">Memo — what this entry is for</label><input class="input" id="je-memo" value="${esc(d.memo || '')}" placeholder="e.g. Year-end adjusting entry #3 from Smith CPA"></div>
        <div class="table-wrap"><table class="lines je-lines"><thead><tr><th>Account</th><th>Description</th><th class="num" style="width:120px">Debit</th><th class="num" style="width:120px">Credit</th><th style="width:36px"></th></tr></thead><tbody id="je-rows"></tbody></table></div>
        <div class="je-foot"><button class="btn sm" id="je-add">${ICON.plus}Add a line</button><div class="je-tot" id="je-tot"></div></div>
        ${isNew ? `<label class="check" style="margin-top:4px"><input type="checkbox" id="je-rev" ${d.reverse ? 'checked' : ''}> Reverse it automatically on the first day of next month <span class="muted">(for accruals)</span></label>` : ''}
        ${App.attach ? `<div id="je-att"></div>` : ''}
      </div>
      <div class="modal-foot">${!isNew ? `<button class="btn ghost" id="je-more">${ICON.dots}</button>` : ''}<span style="flex:1"></span><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="je-save">${ICON.check}${isNew ? 'Post entry' : 'Save'}</button></div>`, { wide: true });
    const rowsEl = $('#je-rows', m);
    const draw = () => {
      rowsEl.innerHTML = d.lines.map((l, i) => `<tr><td><select class="input sm" data-i="${i}" data-k="accountId">${opts(l.accountId)}</select></td><td><input class="input sm" data-i="${i}" data-k="desc" value="${esc(l.desc || '')}" placeholder="Optional"></td>
        <td><input class="input sm num" data-i="${i}" data-k="debit" value="${l.debit === '' || l.debit == null ? '' : l.debit}" placeholder="Debit" inputmode="decimal"></td><td><input class="input sm num" data-i="${i}" data-k="credit" value="${l.credit === '' || l.credit == null ? '' : l.credit}" placeholder="Credit" inputmode="decimal"></td>
        <td>${d.lines.length > 2 ? `<button class="icon-btn" data-rm="${i}" aria-label="Remove line">${ICON.close}</button>` : ''}</td></tr>`).join('');
      $$('[data-k]', rowsEl).forEach(el => el.oninput = el.onchange = () => {
        const l = d.lines[+el.dataset.i], k = el.dataset.k;
        l[k] = k === 'debit' || k === 'credit' ? el.value.replace(/[^0-9.]/g, '') : el.value;
        if (k === 'debit' && l.debit) { l.credit = ''; const o = $(`[data-i="${el.dataset.i}"][data-k=credit]`, rowsEl); if (o) o.value = ''; }
        if (k === 'credit' && l.credit) { l.debit = ''; const o = $(`[data-i="${el.dataset.i}"][data-k=debit]`, rowsEl); if (o) o.value = ''; }
        tot();
      });
      $$('[data-rm]', rowsEl).forEach(b => b.onclick = () => { d.lines.splice(+b.dataset.rm, 1); draw(); });
      tot();
    };
    const tot = () => {
      const ck = C.journalCheck(d);
      $('#je-tot', m).innerHTML = `<span>Debits <b>${money(ck.dr)}</b></span><span>Credits <b>${money(ck.cr)}</b></span>${ck.ok ? `<span class="tag green">${ICON.check}Balanced</span>` : ck.dr || ck.cr ? `<span class="tag red">Off by ${money(Math.abs(ck.diff))}</span>` : ''}`;
    };
    $('#je-add', m).onclick = () => { const ck = C.journalCheck(d); d.lines.push({ accountId: '', debit: ck.diff < 0 ? String(-ck.diff) : '', credit: ck.diff > 0 ? String(ck.diff) : '', desc: '' }); draw(); };
    const attWrap = $('#je-att', m);
    const drawAtt = () => { if (!attWrap) return; attWrap.innerHTML = App.attach.attachStrip(d); App.attach.wireStrip(attWrap, d, drawAtt); };
    drawAtt();
    draw();
    $('#je-save', m).onclick = async () => {
      d.date = $('#je-date', m).value; d.number = $('#je-num', m).value.trim(); d.memo = $('#je-memo', m).value.trim(); d.source = $('#je-src', m).value;
      d.lines = d.lines.filter(l => l.accountId && (+l.debit || +l.credit)).map(l => ({ accountId: l.accountId, desc: l.desc || '', debit: +l.debit ? C.round2(+l.debit) : 0, credit: +l.credit ? C.round2(+l.credit) : 0 }));
      const ck = C.journalCheck(d);
      if (!d.date) return U.toast('Add a date', null, 'warn');
      if (!ck.ok) { draw(); return U.toast(ck.lines < 2 ? 'Add at least two lines with an account and an amount' : `Debits and credits are off by ${money(Math.abs(ck.diff))}`, null, 'warn'); }
      const rev = isNew && $('#je-rev', m) && $('#je-rev', m).checked;
      const revDate = C.addMonths(d.date, 1);
      if (!await guardLock(c, d.date, ...(je ? [je.date] : []), ...(rev ? [revDate] : []))) return;
      const undo = snapshot(c);
      c.journals = c.journals || [];
      if (isNew) {
        delete d.reverse; c.journals.push(d);
        if (rev) c.journals.push({ id: C.uid(), date: revDate, number: d.number + 'R', memo: `Reverse ${d.number}: ${d.memo}`, source: d.source, reversalOf: d.id, lines: d.lines.map(l => ({ accountId: l.accountId, desc: l.desc, debit: l.credit, credit: l.debit })) });
      } else Object.assign(je, d);
      U.closeModal(); commit(); U.toast(isNew ? `Posted ${d.number}${rev ? ' and its reversal' : ''}` : 'Entry saved', undo);
    };
    const more = $('#je-more', m);
    if (more) more.onclick = e => {
      const menu = U.openMenu(e.currentTarget, `<div class="mi" data-m="dup">${ICON.copy}Duplicate</div><div class="mi" data-m="void">${ICON.close}${je.void ? 'Restore' : 'Void (keep a record)'}</div><div class="sep"></div><div class="mi danger" data-m="del">${ICON.trash}Delete</div>`);
      menu.onclick = async ev => {
        const it = ev.target.closest('[data-m]'); if (!it) return; U.closeMenus();
        if (!await guardLock(c, je.date)) return;
        const undo = snapshot(c);
        if (it.dataset.m === 'dup') { U.closeModal(); return jeModal(c, null, { memo: je.memo, source: je.source, lines: je.lines.map(l => ({ ...l })) }); }
        if (it.dataset.m === 'void') { je.void = !je.void; U.closeModal(); commit(); return U.toast(je.void ? 'Entry voided' : 'Entry restored', undo); }
        if (!await U.confirmBox({ title: 'Delete this journal entry?', body: 'It will be removed from the books.', ok: 'Delete', danger: true })) return;
        c.journals = c.journals.filter(x => x !== je); U.closeModal(); commit(); U.toast('Entry deleted', undo);
      };
    };
  }
  App.jeModal = jeModal;

  act({
    'je-new': () => { const c = client(); if (c) jeModal(c); },
    'je-edit': el => { const c = client(); const je = (c.journals || []).find(x => x.id === el.dataset.id); if (je) jeModal(c, je); },
    'je-template': el => {
      const c = client();
      const m = U.openMenu(el, `<div class="mi" data-t="depr">${ICON.calendar}<span>Depreciation</span></div><div class="mi" data-t="accrual">${ICON.refresh}<span>Accrued expense (reverses next month)</span></div><div class="mi" data-t="prepaid">${ICON.calendar}<span>Use up a prepaid expense</span></div><div class="mi" data-t="interest">${ICON.bank}<span>Loan interest</span></div><div class="mi" data-t="reclass">${ICON.swap || ICON.refresh}<span>Move to the right category</span></div>`, { align: 'right', width: 290 });
      m.onclick = e => { const it = e.target.closest('[data-t]'); if (!it) return; U.closeMenus(); const preset = TEMPLATES[it.dataset.t](c); save(); jeModal(c, null, preset); };
    }
  });
})();
