'use strict';
/* =====================================================================
   Coll Ledger — running a bookkeeping practice
   Business types (entity), new-client onboarding checklist, a pricing
   calculator, and an engagement letter generator.
   ===================================================================== */
(() => {
  const { S, C, U, client, act, actions, go, render, commit, save } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;
  const T = () => { S.data.training = S.data.training || { done: {}, quiz: {}, flags: {} }; S.data.training.flags = S.data.training.flags || {}; return S.data.training; };
  const flag = k => { T().flags[k] = true; save(); };

  // ------------------------------------------------------------------
  // Business types and how owners are paid
  // ------------------------------------------------------------------
  const ENTITIES = [
    ['', 'Not set'],
    ['sole', 'Sole proprietor'],
    ['llc1', 'Single-member LLC'],
    ['partner', 'Partnership or multi-member LLC'],
    ['scorp', 'S corporation (or LLC taxed as one)'],
    ['ccorp', 'C corporation'],
    ['nonprofit', 'Nonprofit']
  ];
  const OWNER_PAY = {
    sole: 'Owners take <b>draws</b> (Owner\'s Draw). Draws aren\'t expenses; the owner pays income and self-employment tax on the business profit — usually through quarterly estimates.',
    llc1: 'Taxed like a sole proprietor unless it elected S-corp status: owners take <b>draws</b>, and tax is on the profit — usually through quarterly estimates.',
    partner: 'Partners take <b>draws</b> or <b>guaranteed payments</b>. Each partner\'s share of profit is reported to them on a K-1; track each partner\'s draws separately.',
    scorp: 'Owners who work in the business should be paid a <b>reasonable salary through payroll</b>, and can take the rest as <b>distributions</b>. Draws in place of a salary are a red flag — talk to the CPA.',
    ccorp: 'Owners who work in the business are paid <b>wages through payroll</b>. Money taken out beyond that is usually a dividend or a loan — the CPA decides which.',
    nonprofit: 'There are no owners. Track money by program and by any donor restrictions, and leave Form 990 questions to the CPA.'
  };
  App.ENTITIES = ENTITIES;
  App.entityNote = c => c.entity && OWNER_PAY[c.entity] ? `<div class="hint-bar" style="margin-top:12px">${ICON.help}<span><b>${esc(ENTITIES.find(e => e[0] === c.entity)[1])}:</b> ${OWNER_PAY[c.entity]}</span></div>`
    : `<div class="hint-bar" style="margin-top:12px">${ICON.help}<span>Set the client's <b>business type</b> in Settings — it changes how owners should be paid.</span></div>`;

  // ------------------------------------------------------------------
  // New-client onboarding checklist (added as the client's to-dos)
  // ------------------------------------------------------------------
  const ONBOARD = [
    'Signed engagement letter and first payment method',
    'Legal name, EIN, business type and address (W-9 or IRS letter)',
    'Read-only or accountant access to every bank and credit card account',
    'Statements for the books\' start date (opening balances)',
    'Last year\'s tax return and the CPA\'s contact information',
    'Prior books: QuickBooks export or last bookkeeper\'s reports',
    'Payroll provider access (Gusto, ADP, QuickBooks Payroll…)',
    'Sales tax account and filing schedule',
    'Loan and lease documents with current balances',
    'List of equipment and vehicles with purchase dates and costs',
    'Contractors paid last year, with W-9s on file',
    'Who gets the monthly reports, and how they like to be contacted'
  ];
  function addOnboarding(c) {
    c.todos = c.todos || [];
    const have = new Set(c.todos.map(t => t.text));
    const due = C.addDays(today(), 14);
    let n = 0;
    for (const text of ONBOARD) if (!have.has(text)) { c.todos.push({ id: C.uid(), text, due, done: false, created: today(), onboarding: true }); n++; }
    commit(); U.toast(n ? `Added ${plural(n, 'onboarding item')} to ${c.name}'s to-dos` : 'The onboarding checklist is already there');
  }
  App.addOnboarding = addOnboarding;

  // ------------------------------------------------------------------
  // Pricing calculator
  // ------------------------------------------------------------------
  function quote(v) {
    const tx = Math.max(0, +v.tx || 0), accts = Math.max(1, +v.accts || 1);
    const base = tx <= 50 ? 250 : tx <= 150 ? 400 : tx <= 300 ? 600 : tx <= 600 ? 850 : 850 + Math.ceil((tx - 600) / 100) * 100;
    const extras = [];
    if (accts > 2) extras.push(['More than two bank or card accounts', (accts - 2) * 25]);
    if (v.payroll) extras.push(['Recording payroll', 75]);
    if (v.ar) extras.push(['Invoicing and collections', 100]);
    if (v.ap) extras.push(['Paying bills', 100]);
    if (v.salestax) extras.push(['Sales tax returns', 50]);
    if (v.inventory) extras.push(['Inventory or job costing', 150]);
    if (v.advisory) extras.push(['Monthly review call and forecast', 150]);
    const monthly = Math.round((base + extras.reduce((s, x) => s + x[1], 0)) / 5) * 5;
    const hours = Math.round((tx / 40 + accts * 0.35 + (v.payroll ? 0.75 : 0) + (v.ar ? 1 : 0) + (v.ap ? 1 : 0) + (v.salestax ? 0.5 : 0) + (v.inventory ? 1.5 : 0) + (v.advisory ? 1.25 : 0) + 1) * 4) / 4;
    const behind = Math.max(0, +v.behind || 0);
    const catchup = behind ? Math.round(behind * monthly * (v.messy ? 1.25 : 0.85) / 25) * 25 : 0;
    return { base, extras, monthly, hours, rate: hours ? Math.round(monthly / hours) : 0, catchup, behind, annual: monthly * 12 };
  }
  function pricingModal() {
    const st = S.ui.price = S.ui.price || { name: '', tx: 120, accts: 3, payroll: true, ar: false, ap: false, salestax: true, inventory: false, advisory: false, behind: 0, messy: false };
    const m = U.openModal(`<div id="pr-root"></div>`, { wide: true });
    const draw = () => {
      const q = quote(st);
      $('#pr-root', m).innerHTML = `${U.modalHead('Price a new client', 'A starting point for a monthly fee — adjust it to your market and the client')}
        <div class="modal-body"><div class="price-grid">
          <div class="price-form">
            <div class="field"><label for="pr-name">Client</label><input id="pr-name" class="input" value="${esc(st.name)}" placeholder="Business name"></div>
            <div class="two"><div class="field"><label for="pr-tx">Transactions a month</label><input id="pr-tx" class="input num" type="number" min="0" value="${st.tx}"></div>
            <div class="field"><label for="pr-acc">Bank and card accounts</label><input id="pr-acc" class="input num" type="number" min="1" value="${st.accts}"></div></div>
            <div class="cap-label" style="margin-top:6px">Also included</div>
            ${[['payroll', 'Record payroll from the provider'], ['ar', 'Send invoices and follow up'], ['ap', 'Enter and pay bills'], ['salestax', 'Prepare sales tax returns'], ['inventory', 'Inventory or job costing'], ['advisory', 'Monthly review call and cash forecast']].map(([k, l]) => `<label class="check"><input type="checkbox" data-pk="${k}" ${st[k] ? 'checked' : ''}> ${l}</label>`).join('')}
            <div class="two" style="margin-top:8px"><div class="field"><label for="pr-behind">Months behind (catch-up)</label><input id="pr-behind" class="input num" type="number" min="0" value="${st.behind}"></div>
            <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" data-pk="messy" ${st.messy ? 'checked' : ''}> Records are a mess</label></div>
          </div>
          <div class="price-out">
            <div class="cap-label">Suggested monthly fee</div>
            <div class="price-big">${money(q.monthly)}<span>/month</span></div>
            <div class="price-lines"><div><span>Base for about ${st.tx} transactions</span><b>${money(q.base)}</b></div>${q.extras.map(([l, v]) => `<div><span>${esc(l)}</span><b>+${money(v)}</b></div>`).join('')}</div>
            <div class="price-stats"><div><b>${q.hours} h</b><span>estimated time a month</span></div><div><b>${money(q.rate)}</b><span>effective hourly rate</span></div><div><b>${money(q.annual)}</b><span>a year</span></div></div>
            ${q.behind ? `<div class="price-catch"><span>One-time catch-up · ${plural(q.behind, 'month')}</span><b>${money(q.catchup)}</b></div>` : ''}
            <p class="muted" style="font-size:12px;line-height:1.55;margin:12px 0 0">Monthly flat fees are easier for clients to say yes to than hourly. Quote catch-up work separately and get it paid before you start. If your effective hourly rate looks low, raise the fee or trim what's included.</p>
          </div></div></div>
        <div class="modal-foot"><button class="btn" data-action="close-modal">Close</button><button class="btn" id="pr-copy">${ICON.copy}Copy quote</button><button class="btn primary" id="pr-letter">${ICON.file}Make the engagement letter</button></div>`;
      const num = (id, k) => { const el = $(id, m); el.oninput = () => { st[k] = +el.value || 0; clearTimeout(draw.t); draw.t = setTimeout(() => { draw(); const n = $(id, m); n.focus(); n.setSelectionRange && n.type !== 'number' && n.setSelectionRange(99, 99); }, 350); }; };
      num('#pr-tx', 'tx'); num('#pr-acc', 'accts'); num('#pr-behind', 'behind');
      $('#pr-name', m).oninput = e => { st.name = e.target.value; };
      $$('[data-pk]', m).forEach(b => b.onchange = () => { st[b.dataset.pk] = b.checked; draw(); });
      $('#pr-copy', m).onclick = () => { U.copyText(`Bookkeeping proposal${st.name ? ' for ' + st.name : ''}\n\nMonthly bookkeeping: ${money(q.monthly)}/month\nIncludes: categorizing about ${st.tx} transactions a month across ${plural(st.accts, 'account')}, monthly reconciliations and reports${q.extras.map(x => ', ' + x[0].toLowerCase()).join('')}.${q.behind ? `\nCatch-up (${plural(q.behind, 'month')}): ${money(q.catchup)}, due before work begins.` : ''}`); flag('priced'); };
      $('#pr-letter', m).onclick = () => { flag('priced'); U.closeModal(); engagementModal({ client: st.name, fee: q.monthly, catchup: q.catchup, behind: q.behind, services: { core: true, payroll: st.payroll, ar: st.ar, ap: st.ap, salestax: st.salestax, inventory: st.inventory, advisory: st.advisory } }); };
      flag('priced');
    };
    draw();
  }
  App.pricingModal = pricingModal;

  // ------------------------------------------------------------------
  // Engagement letter
  // ------------------------------------------------------------------
  const SERVICES = [
    ['core', 'Categorize bank and credit card activity each month'],
    ['recon', 'Reconcile every bank and credit card account to its statement each month'],
    ['reports', 'Close each month and deliver a Profit & Loss, Balance Sheet and summary'],
    ['ar', 'Prepare and send customer invoices and follow up on overdue balances'],
    ['ap', 'Enter vendor bills and schedule payments for approval'],
    ['payroll', 'Record payroll from the client\'s payroll provider'],
    ['salestax', 'Prepare sales tax returns for the client to review and file'],
    ['inventory', 'Track inventory or job costs'],
    ['advisory', 'A monthly review call with a cash-flow forecast'],
    ['yearend', 'Prepare year-end reports and 1099 information for the client\'s tax preparer']
  ];
  function engagementModal(pre = {}) {
    const firm = S.data.firm || {};
    const st = Object.assign({ client: '', contact: '', fee: '', catchup: 0, behind: 0, start: C.addMonths(today(), 1), services: { core: true, recon: true, reports: true, yearend: true } }, pre);
    st.services = Object.assign({ core: true, recon: true, reports: true, yearend: true }, st.services || {});
    const custs = (S.data.studio && S.data.studio.customers) || [];
    const m = U.openModal(`${U.modalHead('Engagement letter', 'A clear written agreement before you start — what you\'ll do, what the client provides, and the fee')}
      <div class="modal-body">
        <div class="two"><div class="field"><label for="el-client">Client business</label><input id="el-client" class="input" list="el-custs" value="${esc(st.client)}" placeholder="Business name"><datalist id="el-custs">${custs.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist></div>
        <div class="field"><label for="el-contact">Client contact</label><input id="el-contact" class="input" value="${esc(st.contact)}" placeholder="Owner's name"></div></div>
        <div class="two"><div class="field"><label for="el-fee">Monthly fee</label><div class="money-in"><span>$</span><input id="el-fee" class="input num" type="number" min="0" value="${st.fee}"></div></div>
        <div class="field"><label for="el-start">Start date</label><input id="el-start" class="input" type="date" value="${st.start}"></div></div>
        <div class="two"><div class="field"><label for="el-catch">Catch-up fee (one time)</label><div class="money-in"><span>$</span><input id="el-catch" class="input num" type="number" min="0" value="${st.catchup || ''}" placeholder="0"></div></div>
        <div class="field"><label for="el-behind">Catch-up months</label><input id="el-behind" class="input num" type="number" min="0" value="${st.behind || ''}" placeholder="0"></div></div>
        <div class="cap-label" style="margin-top:4px">Services included</div>
        <div class="el-services">${SERVICES.map(([k, l]) => `<label class="check"><input type="checkbox" data-sv="${k}" ${st.services[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
        <p class="muted" style="font-size:12px;margin:10px 0 0">The letter also covers what the client provides, what isn't included (tax returns and tax advice, audits, legal advice), confidentiality, payment terms and how either side can end the agreement. It's a template, not legal advice — have an attorney review your standard letter once.</p>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="el-go">${ICON.pdf}Make the letter</button></div>`, { wide: true });
    $('#el-go', m).onclick = () => {
      const v = { client: $('#el-client', m).value.trim(), contact: $('#el-contact', m).value.trim(), fee: +$('#el-fee', m).value || 0, start: $('#el-start', m).value, catchup: +$('#el-catch', m).value || 0, behind: +$('#el-behind', m).value || 0 };
      if (!v.client) return U.toast('Add the client\'s business name', null, 'warn');
      if (!v.fee) return U.toast('Add the monthly fee', null, 'warn');
      const sv = SERVICES.filter(([k]) => $(`[data-sv="${k}"]`, m).checked).map(x => x[1]);
      const me = firm.owner || 'Bookkeeper', studio = firm.name || me;
      const body = `<div class="page" style="font-size:12.5px;line-height:1.65">
        <div class="cap muted">${esc(studio)}${firm.email ? ' · ' + esc(firm.email) : ''}${firm.phone ? ' · ' + esc(firm.phone) : ''}</div>
        <h1 class="serif" style="font-weight:400;font-size:28px;margin:6px 0 2px">Bookkeeping engagement letter</h1>
        <div class="muted" style="margin-bottom:20px">${fmtDate(today())}</div>
        <p>${v.contact ? 'Dear ' + esc(v.contact.split(' ')[0]) + ',' : 'Hello,'}</p>
        <p>Thank you for choosing ${esc(studio)}. This letter sets out the bookkeeping services I will provide to <b>${esc(v.client)}</b>, starting <b>${fmtDate(v.start)}</b>, and what we each agree to.</p>
        <h3>1. Services</h3><ul>${sv.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${v.catchup ? `<p>Before monthly work begins, I will bring the books up to date for ${v.behind ? plural(v.behind, 'month') : 'the months behind'} (catch-up).</p>` : ''}
        <h3>2. What you will provide</h3><ul><li>Read-only access to the business's bank, credit card, payroll and payment accounts, or statements by the 5th of each month.</li><li>Receipts and documents for business expenses, and answers to my questions within five business days.</li><li>Prompt notice of new accounts, loans, large purchases, employees or contractors.</li></ul>
        <p>You are responsible for the accuracy of the information you provide, for your business decisions, and for reviewing and approving the reports. I rely on the information you give me and do not audit or independently verify it.</p>
        <h3>3. Not included</h3><p>Preparing or filing income tax returns, tax advice, audits or other assurance work, and legal advice are not part of this engagement. I will coordinate with your tax preparer and give them the year-end reports they need. Work outside this list will be quoted separately before I begin.</p>
        <h3>4. Fees and payment</h3><p>The fee is <b>${money(v.fee)} per month</b>, billed at the start of each month and due within 15 days.${v.catchup ? ` The one-time catch-up fee is <b>${money(v.catchup)}</b>, due before catch-up work begins.` : ''} Fees may be reviewed once a year, or sooner if the volume or scope of work changes significantly, with 30 days' notice.</p>
        <h3>5. Confidentiality and records</h3><p>Your financial information is confidential. I will not share it without your permission, except with your tax preparer or as required by law. The books and records belong to you; I keep them protected and backed up, and will provide copies when the engagement ends.</p>
        <h3>6. Ending the engagement</h3><p>Either of us may end this agreement with 30 days' written notice. Fees for work completed up to that date remain due.</p>
        <p>If this matches your understanding, please sign below and return a copy. I look forward to working with you.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px">
          <div><div style="border-bottom:1px solid #16201C;height:36px"></div><div>${esc(me)}, ${esc(studio)}</div><div class="muted">Date</div></div>
          <div><div style="border-bottom:1px solid #16201C;height:36px"></div><div>${esc(v.contact || 'Client')}, ${esc(v.client)}</div><div class="muted">Date</div></div>
        </div>
        <style>h3{font-size:13.5px;margin:18px 0 4px}ul{margin:4px 0 8px;padding-left:20px}p{margin:6px 0}</style></div>`;
      flag('engagement');
      U.closeModal();
      U.printDoc(App.docShell(`Engagement letter - ${v.client}`, body), `Engagement letter - ${v.client}.pdf`);
    };
  }
  App.engagementModal = engagementModal;

  act({
    'price-client': () => pricingModal(),
    'engagement-letter': () => engagementModal(),
    'onboarding-add': () => { const c = client(); if (c) addOnboarding(c); }
  });

  // Buttons on My studio and the client Dashboard
  App.hooks.push((c, page) => {
    if (page === 'studio') {
      const box = $('.page-head .actions');
      if (box && !box.querySelector('[data-action="price-client"]')) box.insertAdjacentHTML('afterbegin', `<button class="btn" data-action="price-client">${ICON.spark}Price a client</button><button class="btn" data-action="engagement-letter">${ICON.file}Engagement letter</button>`);
    }
    if (page === 'dashboard' && c) {
      const head = [...$$('.notes-grid .card-head')].find(h => /To-dos/.test(h.textContent));
      if (head && !head.querySelector('[data-action="onboarding-add"]') && !(c.todos || []).some(t => t.onboarding)) head.insertAdjacentHTML('beforeend', `<button class="btn sm ghost" data-action="onboarding-add" style="margin-left:auto">${ICON.plus}Onboarding checklist</button>`);
    }
  });
})();
