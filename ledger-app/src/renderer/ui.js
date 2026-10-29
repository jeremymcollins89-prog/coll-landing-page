'use strict';
/* =====================================================================
   Coll Ledger — shared interface helpers
   Formatting, icons, toasts, dialogs, menus, files, the searchable
   category picker and the command palette.
   ===================================================================== */
const UI = (() => {
  const C = Core;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const money = n => fmt.format(C.round2(n || 0) || 0);
  const moneyShort = n => { const a = Math.abs(n); const s = a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k' : Math.round(a); return (n < 0 ? '-$' : '$') + s; };
  const signed = n => `<span class="${n > 0 ? 'pos' : ''}">${n > 0 ? '+' : ''}${money(n)}</span>`;
  const fmtDate = iso => iso ? C.parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const fmtDateShort = iso => iso ? C.parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const fmtMonth = iso => iso ? C.parseISO(iso.slice(0, 7) + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const friendlyDate = iso => {
    const d = C.daysBetween(iso, C.todayISO());
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d > 1 && d < 7) return C.parseISO(iso).toLocaleDateString('en-US', { weekday: 'long' });
    return fmtDate(iso);
  };
  const initials = s => String(s || '?').replace(/[^A-Za-z0-9 &]/g, '').split(/\s+/).filter(w => w && w !== '&').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

  const P = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON = {
    check: P('M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'),
    close: P('M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z'),
    plus: P('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z'),
    upload: P('M5 20h14v-2H5zm7-16-5 5h3v5h4V9h3z'),
    download: P('M5 20h14v-2H5zm14-11h-4V3H9v6H5l7 7z'),
    spark: P('M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z'),
    bolt: P('M7 2v11h3v9l7-12h-4l4-8z'),
    pdf: P('M6 2h9l5 5v15H4V2zm8 1.5V8h4.5zM8 13v5h1.5v-1.6h.8a1.7 1.7 0 0 0 0-3.4zm1.5 1.2h.8a.5.5 0 0 1 0 1h-.8zM12.6 13v5h1.6a2.5 2.5 0 0 0 0-5zm1.5 1.2h.1a1.3 1.3 0 0 1 0 2.6h-.1zm3-1.2v5h1.5v-1.9h1.6v-1.1h-1.6v-.9h1.8V13z'),
    chev: P('M7 10l5 5 5-5z'),
    right: P('M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z'),
    back: P('M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z'),
    trash: P('M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z'),
    lock: P('M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2M9 6a3 3 0 0 1 6 0v2H9z'),
    unlock: P('M18 8h-1V6A5 5 0 0 0 7.1 5l1.9.6A3 3 0 0 1 15 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2'),
    bank: P('M4 10v7h3v-7zm6 0v7h3v-7zM2 22h19v-3H2zm14-12v7h3v-7zM11.5 1 2 6v2h19V6z'),
    card: P('M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 14H4v-6h16zm0-10H4V6h16z'),
    alert: P('M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z'),
    send: P('M2 21l21-9L2 3v7l15 2-15 2z'),
    edit: P('M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z'),
    split: P('M14 4l2.3 2.3-2.9 2.9 1.4 1.4 2.9-2.9L20 10V4zm-4 0H4v6l2.3-2.3 4.7 4.7V20h2v-8.4l-5.3-5.3z'),
    search: P('M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14'),
    help: P('M11 18h2v-2h-2zm1-16a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8m0-14a4 4 0 0 0-4 4h2a2 2 0 0 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4'),
    people: P('M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4m-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3m0 2c-2.3 0-7 1.2-7 3.5V19h7v-2.5c0-.9.4-2.4 2.6-3.5A13 13 0 0 0 8 13m8 0c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4'),
    calendar: P('M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 16H5V9h14z'),
    report: P('M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z'),
    file: P('M6 2h9l5 5v15H4V2zm8 1.5V8h4.5z'),
    square: P('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m3 5v8h8V8z'),
    qb: P('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2M9 16H8a4 4 0 0 1 0-8h1v2H8a2 2 0 0 0 0 4h1v-6h2v10H9zm7 0h-1v2h-2V8h2v8h1a2 2 0 0 0 0-4h-1v-2h1a4 4 0 0 1 0 8'),
    mail: P('M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4-8 5-8-5V6l8 5 8-5z'),
    copy: P('M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H8V7h11z'),
    keyboard: P('M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-9 3h2v2h-2zm0 3h2v2h-2zM8 8h2v2H8zm0 3h2v2H8zm-1 2H5v-2h2zm0-3H5V8h2zm9 7H8v-2h8zm0-4h-2v-2h2zm0-3h-2V8h2zm3 3h-2v-2h2zm0-3h-2V8h2z'),
    home: P('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'),
    dots: P('M6 10a2 2 0 1 0 2 2 2 2 0 0 0-2-2m12 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2m-6 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2'),
    refresh: P('M17.65 6.35A8 8 0 1 0 19.73 14h-2.08A6 6 0 1 1 12 6a5.9 5.9 0 0 1 4.22 1.78L13 11h7V4z')
  };

  // ---------- toasts ----------
  function toast(msg, undo, tone) {
    const el = document.createElement('div');
    el.className = 'toast' + (tone ? ' ' + tone : '');
    el.setAttribute('role', 'status');
    el.innerHTML = `${tone === 'warn' ? ICON.alert : ICON.check}<span>${esc(msg)}</span>${undo ? '<button>Undo</button>' : ''}`;
    $('#toasts').appendChild(el);
    if (undo) el.querySelector('button').onclick = () => { undo(); el.remove(); };
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, undo ? 7000 : 3400);
  }

  // ---------- modals (stackable) ----------
  const stack = [];
  function openModal(html, { wide = false, size = '', onClose } = {}) {
    const ov = document.createElement('div');
    ov.className = 'overlay open';
    ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${size}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    const m = ov.querySelector('.modal');
    stack.push({ ov, onClose });
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
    const first = m.querySelector('[autofocus]') || m.querySelector('input:not([type=checkbox]):not([readonly]):not([type=date]), select, textarea');
    if (first) setTimeout(() => first.focus(), 40);
    return m;
  }
  function closeModal() {
    const top = stack.pop();
    if (!top) return;
    top.ov.remove();
    if (top.onClose) top.onClose();
  }
  const modalOpen = () => stack.length > 0;
  const modalHead = (title, sub) => `<div class="modal-head"><div><h2>${esc(title)}</h2>${sub ? `<div class="muted" style="margin-top:4px">${sub}</div>` : ''}</div><button class="icon-btn" data-action="close-modal" aria-label="Close">${ICON.close}</button></div>`;

  function confirmBox({ title, body, ok = 'Confirm', danger = false, cancel = 'Cancel' }) {
    return new Promise(resolve => {
      let done = false;
      const m = openModal(`${modalHead(title)}<div class="modal-body"><p style="margin:0;color:var(--ink-2);line-height:1.6">${body}</p></div>
        <div class="modal-foot"><button class="btn" data-x="no">${esc(cancel)}</button><button class="btn ${danger ? 'danger-fill' : 'primary'}" data-x="yes" autofocus>${esc(ok)}</button></div>`,
        { onClose: () => { if (!done) resolve(false); } });
      m.querySelector('[data-x=no]').onclick = () => { done = true; closeModal(); resolve(false); };
      m.querySelector('[data-x=yes]').onclick = () => { done = true; closeModal(); resolve(true); };
    });
  }

  // ---------- menus / popovers ----------
  function closeMenus() { $$('.menu').forEach(m => m.remove()); }
  function openMenu(anchor, html, { align = 'left', width } = {}) {
    closeMenus();
    const r = anchor.getBoundingClientRect();
    const m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = html;
    if (width) m.style.width = width + 'px';
    document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 6);
    let left = align === 'right' ? r.right - w : r.left;
    left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
    m.style.top = top + 'px';
    m.style.left = left + 'px';
    return m;
  }

  // Searchable category picker. Calls onPick(accountId).
  function categoryPicker(anchor, c, { selected, excludeId, amount, onPick, allowClear } = {}) {
    const groups = [
      ['Income', a => a.type === 'income', 'Money coming in from sales and services'],
      ['Expenses', a => a.type === 'expense', 'Costs of running the business'],
      ['Transfers & owner', a => a.type === 'asset' || a.type === 'liability' || a.type === 'equity', 'Moving money between accounts, loans, owner money']
    ];
    if (amount < 0) groups.unshift(groups.splice(1, 1)[0]);
    const all = c.accounts.filter(a => !a.archived && a.id !== excludeId && a.key !== 'obe');
    const m = openMenu(anchor, `<div class="picker"><div class="picker-search">${ICON.search}<input placeholder="Type to find a category…" aria-label="Find a category"></div><div class="picker-list"></div>
      <div class="picker-foot"><span class="kbd">↑↓</span> move <span class="kbd">Enter</span> choose <span class="kbd">Esc</span> close</div></div>`, { width: Math.max(300, anchor.offsetWidth) });
    const inp = m.querySelector('input'), list = m.querySelector('.picker-list');
    let items = [], hi = 0;
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      items = [];
      let html = '';
      if (allowClear && !q) { items.push({ id: '' }); html += `<div class="pi muted-pi" data-i="0">Leave uncategorized</div>`; }
      for (const [label, fn, hint] of groups) {
        const list2 = all.filter(fn).filter(a => !q || a.name.toLowerCase().includes(q) || a.code.includes(q)).sort((x, y) => x.code.localeCompare(y.code));
        if (!list2.length) continue;
        html += `<div class="pg" title="${esc(hint)}">${label}</div>`;
        for (const a of list2) { html += `<div class="pi ${a.id === selected ? 'sel' : ''}" data-i="${items.length}">${esc(a.name)}${a.id === selected ? ICON.check : ''}</div>`; items.push(a); }
      }
      if (!items.length) html = `<div class="muted" style="padding:14px">No category called “${esc(inp.value)}”. Add one in Chart of Accounts.</div>`;
      list.innerHTML = html;
      hi = Math.max(0, items.findIndex(a => a.id === selected));
      if (q) hi = items.findIndex(a => a.id !== '') ; if (hi < 0) hi = 0;
      mark();
    };
    const mark = () => { $$('.pi', list).forEach(el => el.classList.toggle('hi', +el.dataset.i === hi)); const el = list.querySelector('.pi.hi'); if (el) el.scrollIntoView({ block: 'nearest' }); };
    const pick = i => { const a = items[i]; if (!a) return; closeMenus(); onPick(a.id); };
    inp.oninput = draw;
    inp.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(items.length - 1, hi + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(hi); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenus(); anchor.focus(); }
    };
    list.onmousemove = e => { const el = e.target.closest('.pi'); if (el) { hi = +el.dataset.i; mark(); } };
    list.onclick = e => { const el = e.target.closest('.pi'); if (el) pick(+el.dataset.i); };
    draw();
    setTimeout(() => inp.focus(), 10);
    return m;
  }

  // ---------- files ----------
  const b64ToBuf = b64 => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  async function downloadText(name, content, mime = 'text/csv', ext = 'csv') {
    if (window.desktop) {
      const p = await window.desktop.saveFile({ defaultName: name, content, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (p) toast('Saved to ' + p.split(/[\\/]/).slice(-2).join('/'));
      return;
    }
    if (window.COLL_PREVIEW) return toast('Saving files works in the desktop app', null, 'warn');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // Returns [{ name, text, buffer }]
  async function pickFiles(accept, multiple = false) {
    if (window.desktop) {
      const ext = accept.replace(/\./g, '').split(',').map(s => s.trim());
      const res = await window.desktop.openFile({ filters: [{ name: 'Supported files', extensions: ext }], multiple });
      if (!res) return [];
      return (Array.isArray(res) ? res : [res]).map(f => { const buffer = b64ToBuf(f.base64); return { name: f.name, buffer, text: new TextDecoder().decode(buffer) }; });
    }
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
      inp.onchange = async () => resolve(await Promise.all([...inp.files].map(readBrowserFile)));
      inp.click();
    });
  }
  async function readBrowserFile(f) { const buffer = await f.arrayBuffer(); return { name: f.name, buffer, text: new TextDecoder().decode(buffer) }; }
  async function printDoc(html, name) {
    if (window.desktop) { const p = await window.desktop.savePdf({ html, defaultName: name }); if (p) toast('PDF saved and opened'); return p; }
    if (window.COLL_PREVIEW) return toast('PDF export works in the desktop app', null, 'warn');
    const fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { } setTimeout(() => fr.remove(), 1500); }, 300);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied'); return true; }
    catch (e) { toast('Copy did not work here — select the text and copy it', null, 'warn'); return false; }
  }

  return { $, $$, esc, money, moneyShort, signed, fmtDate, fmtDateShort, fmtMonth, friendlyDate, initials, plural, ICON, toast, openModal, closeModal, modalOpen, modalHead, confirmBox, openMenu, closeMenus, categoryPicker, downloadText, pickFiles, readBrowserFile, printDoc, copyText };
})();
