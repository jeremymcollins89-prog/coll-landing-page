'use strict';
/* =====================================================================
   Coll Ledger — Practice account / Training
   A pretend bakery to practice on, four levels of lessons plus the
   advanced track, with plain-language explanations, quizzes, a coach that checks your work as you
   go, and a certificate at the end.
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;

  // ------------------------------------------------------------------
  // Progress
  // ------------------------------------------------------------------
  const T = () => {
    S.data.training = S.data.training || {};
    const t = S.data.training;
    t.done = t.done || {}; t.quiz = t.quiz || {}; t.flags = t.flags || {};
    if (t.coachHidden == null) t.coachHidden = false;
    return t;
  };
  const practice = () => S.data.clients.find(c => c.practice && !c.exam && !c.advExam) || null;
  const pad = n => String(n).padStart(2, '0');
  const lastMonthEnd = () => { const d = C.parseISO(today()); return C.isoOf(new Date(d.getFullYear(), d.getMonth(), 0)); };

  // ------------------------------------------------------------------
  // The practice company: Bluebird Bakery
  // ------------------------------------------------------------------
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function makePractice() {
    const r = rng(20261028);
    const between = (a, b) => C.round2(a + r() * (b - a));
    const t0 = C.parseISO(today());
    const start = C.isoOf(new Date(t0.getFullYear(), t0.getMonth() - 2, 1));
    const end = lastMonthEnd();
    const c = C.newClient({ name: 'Bluebird Bakery', legalName: 'Bluebird Bakery LLC', industry: 'Bakery · practice account', color: '#5A5FA8', startDate: start, invoicePrefix: 'BB-', nextInvoice: 101, email: 'hello@bluebird.example', phone: '(303) 555-0188', address: '88 Practice Lane\nDenver, CO 80205' });
    c.practice = true;
    c.checklistDismissed = true;
    const A = n => C.acctByName(c, n).id;
    C.acctByName(c, 'Business Checking').opening = 12000;
    C.acctByName(c, 'Business Credit Card').opening = 800;
    const add = (date, description, amount, cat, account = 'Business Checking', payee) => {
      c.transactions.push({ id: C.uid(), date, description, payee: payee || C.cleanPayee(description), amount: C.round2(amount), accountId: A(account), categoryId: A(cat), memo: '', status: 'posted', cleared: true, reconciled: false });
    };
    let d = start, fri = 0;
    while (d <= end) {
      const dt = C.parseISO(d), dow = dt.getDay(), dom = dt.getDate();
      if (dow === 1 || dow === 4) add(d, 'DEPOSIT - COUNTER SALES', between(1250, 1750), 'Sales', 'Business Checking', 'Counter sales');
      if (dow === 3) add(d, 'KING SOOPERS #112', -between(60, 140), 'Cost of Goods Sold');
      if (dom === 3) add(d, 'PINE ST PROPERTIES RENT', -1850, 'Rent & Lease', 'Business Checking', 'Pine St Properties');
      if (dom === 6 || dom === 20) add(d, 'RESTAURANT DEPOT', -between(300, 500), 'Cost of Goods Sold', 'Business Checking', 'Restaurant Depot');
      if (dom === 12) add(d, 'XCEL ENERGY ONLINE PMT', -between(180, 260), 'Utilities', 'Business Checking', 'Xcel Energy');
      if (dom === 14) add(d, 'COMCAST BUSINESS', -129.99, 'Phone & Internet', 'Business Checking', 'Comcast Business');
      if (dow === 5 && (fri++ % 2 === 0)) add(d, 'GUSTO PAYROLL PPD', -between(2100, 2500), 'Payroll & Wages', 'Business Checking', 'Gusto Payroll');
      if (dom === 25) add(d, 'TRANSFER TO OWNER - SAVINGS', -1500, "Owner's Draw", 'Business Checking', 'Owner draw');
      if (dom === 9) add(d, 'AMAZON MKTPLACE PMTS', -between(40, 90), 'Office Supplies', 'Business Credit Card', 'Amazon');
      if (dom === 17) add(d, 'FACEBK *ADS', -60, 'Advertising & Marketing', 'Business Credit Card', 'Facebook Ads');
      if (dom === 22) add(d, 'CANVA PRO SUBSCRIPTION', -14.99, 'Software & Subscriptions', 'Business Credit Card', 'Canva');
      if (dom === 27) {
        const mk = d.slice(0, 7);
        const owed = -c.transactions.filter(t => t.accountId === A('Business Credit Card') && t.date.slice(0, 7) === mk).reduce((s, t) => s + t.amount, 0);
        add(d, 'PAYMENT TO CHASE CARD', -C.round2(owed + (mk === start.slice(0, 7) ? 800 : 0)), 'Business Credit Card', 'Business Checking', 'Credit card payment');
      }
      d = C.addDays(d, 1);
    }
    c.rules.push({ id: C.uid(), text: 'gusto', categoryId: A('Payroll & Wages'), payee: 'Gusto Payroll', direction: 'any', autoAccept: false });
    const river = { id: C.uid(), kind: 'customer', name: 'Riverside Coffee Co.', email: 'orders@riverside.example', phone: '', address: '410 River Rd\nDenver, CO 80216', notes: 'Wholesale — weekly bagels and muffins' };
    const maple = { id: C.uid(), kind: 'customer', name: 'Maple Elementary PTA', email: 'pta@maple.example', phone: '', address: '1200 Maple Ave\nDenver, CO 80220', notes: 'Event catering' };
    c.contacts.push(river, maple, { id: C.uid(), kind: 'vendor', name: 'Restaurant Depot', email: '', phone: '', address: '', notes: 'Flour, butter, sugar' });
    const m2 = C.isoOf(new Date(t0.getFullYear(), t0.getMonth() - 2, 15)), m1 = C.isoOf(new Date(t0.getFullYear(), t0.getMonth() - 1, 10));
    const inv1 = { id: C.uid(), number: 'BB-101', contactId: river.id, date: m2, dueDate: C.addDays(m2, 15), status: 'sent', taxRate: 0, discount: 0, notes: 'Thank you!', lines: [{ id: C.uid(), desc: 'Wholesale bagels (dozen)', qty: 30, rate: 14, accountId: A('Sales') }] };
    const inv2 = { id: C.uid(), number: 'BB-102', contactId: maple.id, date: m1, dueDate: C.addDays(m1, 30), status: 'sent', taxRate: 0, discount: 0, notes: 'Thank you for supporting a local bakery!', lines: [{ id: C.uid(), desc: 'Bake sale catering — cookies (dozen)', qty: 15, rate: 18, accountId: A('Sales') }, { id: C.uid(), desc: 'Delivery', qty: 1, rate: 30, accountId: A('Sales') }] };
    c.invoices.push(inv1, inv2);
    c.nextInvoice = 103;
    const pd = C.addDays(m2, 12);
    c.transactions.push({ id: C.uid(), date: pd, description: 'MOBILE DEPOSIT - RIVERSIDE COFFEE', payee: river.name, amount: 420, accountId: A('Business Checking'), categoryId: C.acctByKey(c, 'ar').id, invoiceId: inv1.id, memo: 'Payment for BB-101', status: 'posted', cleared: true, reconciled: false });
    c.transactions.sort((a, b) => a.date.localeCompare(b.date));
    c.practiceBase = { rules: c.rules.length, paid: 1, sent: 2 };
    return c;
  }

  // The practice files, generated so the lessons always have fresh, dated activity
  function window14() {
    const lo = C.addDays(lastMonthEnd(), 1);
    const from = C.addDays(today(), -16) > lo ? C.addDays(today(), -16) : lo;
    const days = Math.max(0, C.daysBetween(from, today()));
    return i => C.addDays(from, Math.round(days * i));
  }
  const usDate = iso => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  function bankFile(c) {
    const at = window14();
    const rows = [
      [0.00, 'DEPOSIT - COUNTER SALES', 1540.5], [0.05, 'KING SOOPERS #112', -86.4], [0.1, 'RESTAURANT DEPOT', -412.77],
      [0.15, 'GUSTO PAYROLL PPD', -2310.55], [0.22, 'COSTCO WHSE #1032', -318.64], [0.3, 'CITY OF DENVER BUSINESS LICENSE', -150],
      [0.38, 'XCEL ENERGY ONLINE PMT', -233.1], [0.45, 'TRANSFER TO OWNER - SAVINGS', -1500], [0.52, 'DEPOSIT - COUNTER SALES', 1486.25],
      [0.6, 'COMCAST BUSINESS', -129.99], [0.68, 'PAYMENT TO CHASE CARD', -642.18], [0.75, 'KING SOOPERS #112', -112.06],
      [0.82, 'SUNSHINE PACKAGING CO', -96.3], [0.9, 'DEPOSIT - COUNTER SALES', 1608.4], [0.27, 'DEPOSIT - COUNTER SALES', 1392.1], [0.7, 'DEPOSIT - COUNTER SALES', 1544.8], [1, 'BLUE MOUNTAIN COFFEE ROASTERS', -74.5]
    ];
    const lines = [['Details', 'Posting Date', 'Description', 'Amount', 'Type', 'Balance']];
    for (const [f, desc, amt] of rows) lines.push([amt > 0 ? 'CREDIT' : 'DEBIT', usDate(at(f)), desc, amt.toFixed(2), amt > 0 ? 'DEPOSIT' : 'DEBIT', '']);
    // one line that is already in the books, so you can see duplicates get skipped
    const last = c.transactions.filter(t => t.accountId === C.acctByName(c, 'Business Checking').id && !t.invoiceId).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (last) lines.push([last.amount > 0 ? 'CREDIT' : 'DEBIT', usDate(last.date), last.description, last.amount.toFixed(2), 'DEBIT', '']);
    return C.toCSV(lines);
  }
  function squareFile() {
    const hdr = ['Date', 'Time', 'Gross Sales', 'Discounts', 'Net Sales', 'Gift Card Sales', 'Tax', 'Tip', 'Partial Refunds', 'Total Collected', 'Cash', 'Fees', 'Net Total', 'Transaction ID', 'Transaction Status'];
    const r = rng(77), rows = [hdr];
    for (let back = 3; back >= 1; back--) {
      const iso = C.addDays(today(), -back);
      for (let k = 0; k < 6; k++) {
        const gross = C.round2(4 + r() * 30), disc = k === 0 ? -1 : 0, net = C.round2(gross + disc), tax = C.round2(net * 0.0915), tip = [0, 1, 2][k % 3];
        const total = C.round2(net + tax + tip), cash = k === 5 ? total : 0, fee = cash ? 0 : -C.round2((total) * 0.026 + 0.15);
        rows.push([usDate(iso), `0${7 + k}:15`, `$${gross.toFixed(2)}`, disc ? '-$1.00' : '$0.00', `$${net.toFixed(2)}`, '$0.00', `$${tax.toFixed(2)}`, `$${tip.toFixed(2)}`, '$0.00', `$${total.toFixed(2)}`, `$${cash.toFixed(2)}`, fee ? `-$${(-fee).toFixed(2)}` : '$0.00', `$${C.round2(total + fee).toFixed(2)}`, `PR${back}${k}`, 'Complete']);
      }
    }
    return C.toCSV(rows);
  }
  function qbFile() {
    return C.toCSV([['Bluebird Bakery LLC'], ['Account List'], [], ['Full name', 'Type', 'Detail type', 'Description'],
      ['Business Checking', 'Bank', 'Checking', ''], ['Wholesale Income', 'Income', 'Sales of Product Income', 'Cafés and shops'], ['Packaging', 'Cost of Goods Sold', 'Supplies & Materials - COGS', 'Boxes and bags'],
      ['Equipment Repairs', 'Expenses', 'Repair & Maintenance', 'Ovens and mixers'], ['Kitchen Equipment', 'Fixed Assets', 'Machinery & Equipment', ''], ['Owner draws', 'Equity', "Owner's Equity", '']]);
  }
  function feed(name, text) {
    const buffer = new TextEncoder().encode(text).buffer;
    App.handleFiles([{ name, text, buffer }]);
  }
  function ensurePractice(open = true, page = 'dashboard') {
    let c = practice();
    if (!c) { c = makePractice(); S.data.clients.push(c); save(); }
    T().flags.opened = true;
    if (open) App.switchClient(c.id, page);
    return c;
  }
  const statement = c => {
    const end = lastMonthEnd();
    const a = C.acctByName(c, 'Business Checking');
    return { date: end, balance: C.balances(c, { to: end }).get(a.id) };
  };

  // ------------------------------------------------------------------
  // Practice material for the Level 2 and 3 lessons
  // ------------------------------------------------------------------
  const plantDate = c => { const d = today(); return c.lockDate && d <= c.lockDate ? C.addDays(c.lockDate, 1) : d; };
  function plantMistakes() {
    const c = ensurePractice(false); const t = T(); t.planted = t.planted || {};
    if (t.planted.dup && c.transactions.some(x => x.id === t.planted.unc)) return;
    const d = plantDate(c), chk = C.acctByName(c, 'Business Checking').id;
    const mk = (desc, payee, amt, cat) => { const x = { id: C.uid(), date: d, description: desc, payee, amount: amt, accountId: chk, categoryId: cat, memo: '', status: 'posted', cleared: false, reconciled: false }; c.transactions.push(x); return x; };
    mk('XCEL ENERGY ONLINE PMT', 'Xcel Energy', -164.22, C.acctByName(c, 'Utilities').id);
    mk('XCEL ENERGY ONLINE PMT', 'Xcel Energy', -164.22, C.acctByName(c, 'Utilities').id);
    const u = mk('SQ *MILE HIGH FARMERS MKT', 'Mile High Farmers Market', -58, C.acctByKey(c, 'unc_exp').id);
    Object.assign(t.planted, { dup: true, dupDesc: 'XCEL ENERGY ONLINE PMT', dupAmt: -164.22, dupDate: d, unc: u.id });
    save();
  }
  function plantTypo() {
    const c = ensurePractice(false); const t = T(); t.planted = t.planted || {};
    if (t.planted.typo && c.transactions.some(x => x.id === t.planted.typo)) return;
    const x = { id: C.uid(), date: plantDate(c), description: 'CHECK #1042 GARDNER SUPPLY', payee: 'Gardner Supply', amount: -168, accountId: C.acctByName(c, 'Business Checking').id, categoryId: C.acctByName(c, 'Cost of Goods Sold').id, memo: 'Entered by hand from the checkbook', status: 'posted', cleared: false, reconciled: false };
    c.transactions.push(x); t.planted.typo = x.id; save();
  }
  function plantContractor() {
    const c = ensurePractice(false);
    if (c.contacts.some(x => x.name === 'Front Range Window Cleaning')) return;
    const v = { id: C.uid(), kind: 'vendor', name: 'Front Range Window Cleaning', email: 'billing@frwindows.example', phone: '', address: '2200 Federal Blvd\nDenver, CO 80211', notes: 'Monthly storefront windows · sole proprietor', tin: '' };
    c.contacts.push(v);
    const d = plantDate(c), chk = C.acctByName(c, 'Business Checking').id, lab = C.acctByName(c, 'Contract Labor').id;
    ['3301', '3342', '3388'].forEach(n => c.transactions.push({ id: C.uid(), date: d, description: `FRONT RANGE WINDOW CLEANING INV ${n}`, payee: v.name, vendorId: v.id, amount: -750, accountId: chk, categoryId: lab, memo: '', status: 'posted', cleared: false, reconciled: false }));
    save();
  }

  // Debit and credit drill
  const DRILL = [
    ['The owner puts $5,000 of personal money into the business checking account.', 'Business Checking', "Owner's Contributions"],
    ['The business pays $1,850 rent from checking.', 'Rent & Lease', 'Business Checking'],
    ['You send a customer a $600 invoice.', 'Accounts Receivable', 'Sales'],
    ['The customer pays that $600 invoice.', 'Business Checking', 'Accounts Receivable'],
    ['Office supplies, $80, on the business credit card.', 'Office Supplies', 'Business Credit Card'],
    ['The business pays $80 on the credit card from checking.', 'Business Credit Card', 'Business Checking'],
    ['A $900 bill arrives from a flour supplier, not paid yet.', 'Cost of Goods Sold', 'Accounts Payable'],
    ['Monthly depreciation of $125 on the ovens.', 'Depreciation Expense', 'Accumulated Depreciation']
  ];
  const DRILL_ACCTS = ['Business Checking', 'Accounts Receivable', 'Accumulated Depreciation', 'Business Credit Card', 'Accounts Payable', "Owner's Contributions", 'Sales', 'Cost of Goods Sold', 'Rent & Lease', 'Office Supplies', 'Depreciation Expense'];
  const drillScore = () => { const d = T().drill || {}; return DRILL.filter((x, i) => d[i] && d[i].dr === x[1] && d[i].cr === x[2]).length; };
  function drillHTML() {
    const d = T().drill || {}, shown = !!T().drillChecked;
    const opt = (sel) => `<option value="">Choose…</option>${DRILL_ACCTS.map(a => `<option ${sel === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}`;
    return `<div class="drill"><div class="cap-label">The drill — pick the debit and the credit</div>${DRILL.map((x, i) => { const a = d[i] || {}; const ok = a.dr === x[1] && a.cr === x[2]; return `<div class="drill-row ${shown ? (ok ? 'ok' : 'bad') : ''}"><div class="drill-q"><span class="n">${i + 1}</span>${esc(x[0])}</div><div class="drill-a"><label>Debit<select class="input sm" data-drill="${i}" data-side="dr">${opt(a.dr)}</select></label><label>Credit<select class="input sm" data-drill="${i}" data-side="cr">${opt(a.cr)}</select></label>${shown ? `<span class="drill-mark">${ok ? ICON.check : ICON.close}</span>` : ''}</div>${shown && !ok ? `<div class="drill-hint">Ask: what did the business get, and where did it come from?</div>` : ''}</div>`; }).join('')}
      <div class="drill-foot"><button class="btn primary" data-action="t-drill-check">Check my answers</button>${shown ? `<b class="${drillScore() === DRILL.length ? 'pos' : ''}">${drillScore()} of ${DRILL.length} right${drillScore() === DRILL.length ? ' — perfect!' : ''}</b>` : ''}</div></div>`;
  }
  function plantLoan() {
    const c = ensurePractice(false); const t = T(); t.planted = t.planted || {};
    if (t.planted.loan && c.transactions.some(x => x.id === t.planted.loan)) return;
    const lp = C.acctByName(c, 'Loans Payable'); C.acctByName(c, 'Interest Expense') || C.ensureAccount(c, { name: 'Interest Expense', type: 'expense', sub: 'otherexpense' });
    if (lp && !lp.opening) lp.opening = 24000;
    const x = { id: C.uid(), date: plantDate(c), description: 'FIRSTBANK EQUIP LOAN PMT', payee: 'FirstBank', amount: -650, accountId: C.acctByName(c, 'Business Checking').id, categoryId: lp ? lp.id : '', memo: 'Equipment loan', status: 'posted', cleared: false, reconciled: false };
    c.transactions.push(x); t.planted.loan = x.id; save();
  }
  function plantPayroll() {
    const c = ensurePractice(false); const t = T(); t.planted = t.planted || {};
    if (t.planted.payroll && c.transactions.some(x => x.id === t.planted.payroll)) return;
    C.acctByName(c, 'Payroll Taxes') || C.ensureAccount(c, { name: 'Payroll Taxes', type: 'expense', sub: 'expense' });
    const x = { id: C.uid(), date: plantDate(c), description: 'GUSTO PAYROLL PPD 2,948.62', payee: 'Gusto Payroll', amount: -2948.62, accountId: C.acctByName(c, 'Business Checking').id, categoryId: C.acctByName(c, 'Payroll & Wages').id, memo: 'Payday', status: 'posted', cleared: false, reconciled: false };
    c.transactions.push(x); t.planted.payroll = x.id; save();
  }
  // Draws a realistic receipt for the Sunshine Packaging charge and reads it
  async function practiceReceipt() {
    T().flags.receiptTried = true; save();
    const c = P(); if (!c) return;
    const tx = c.transactions.find(x => /SUNSHINE PACKAGING/i.test(x.description));
    const d = tx ? tx.date : today();
    const cv = document.createElement('canvas'); cv.width = 520; cv.height = 760;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#111';
    const lines = ['SUNSHINE PACKAGING CO', '4410 Brighton Blvd', 'Denver CO 80216', '', `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}  10:42 AM`, '', 'BAKERY BOXES 10X10  50   42.50', 'PASTRY BAGS 500CT       31.20', 'LABEL ROLLS 2           14.53', '', 'SUBTOTAL                88.23', 'SALES TAX                8.07', 'TOTAL                   96.30', '', 'DEBIT ****4821           96.30', '', 'THANK YOU'];
    g.font = '22px "Courier New", monospace';
    lines.forEach((l, i) => g.fillText(l, 36, 60 + i * 38));
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const buffer = await blob.arrayBuffer();
    App.readReceipt({ file: { name: 'sunshine-packaging-receipt.png', buffer } });
  }

  // ------------------------------------------------------------------
  // The class
  // ------------------------------------------------------------------
  const inPractice = () => { const c = client(); return c && c.practice ? c : null; };
  const P = () => practice();
  const LESSONS = [
    {
      id: 'basics', title: 'How bookkeeping works', mins: 5,
      learn: 'What bookkeepers actually do, the five kinds of accounts, and why every dollar touches two of them.',
      body: [
        `<p><b>Bookkeeping is keeping an honest record of every dollar that comes in and goes out of a business, sorted into the right buckets.</b> Owners use it to know if they're making money, banks use it to lend, and tax preparers use it to file. When the books are right, everyone trusts the numbers.</p>`,
        `<p>Every bucket is an <b>account</b>, and every account is one of five kinds:</p>
         <div class="t-kinds"><div><b>Assets</b><span>What the business owns — bank accounts, money customers owe, equipment.</span></div><div><b>Liabilities</b><span>What it owes — credit cards, loans, sales tax it collected.</span></div><div><b>Equity</b><span>The owner's stake — money they put in or took out.</span></div><div><b>Income</b><span>Money earned from selling things or services.</span></div><div><b>Expenses</b><span>What it costs to run the business.</span></div></div>`,
        `<p><b>Double-entry</b> sounds scary but it just means every transaction changes two accounts. When the bakery buys $86 of groceries with the debit card, <i>Business Checking</i> goes down $86 and <i>Cost of Goods Sold</i> goes up $86. In Coll Ledger you only pick the category — the second side is recorded for you, which is why the Balance Sheet always balances.</p>`,
        `<p>You'll practice on <b>Bluebird Bakery</b>, a pretend business with two months of history. Nothing you do there touches a real client, and you can reset it any time.</p>`
      ],
      words: [['Account', 'A bucket that tracks one kind of money, like Business Checking or Rent.'], ['Category', 'The account you assign a transaction to — usually an income or expense account.'], ['Double-entry', 'Every transaction changes two accounts by the same amount.']],
      task: 'Open the practice account.',
      action: ['Open Bluebird Bakery', () => ensurePractice(true, 'dashboard')],
      check: () => !!(P() && T().flags.opened),
      quiz: [{ q: 'The bakery pays $1,850 rent from its checking account. Which two accounts change?', a: ['Business Checking goes down and Rent & Lease goes up', 'Sales goes down and Rent & Lease goes up', "Owner's Draw goes up and Business Checking goes up"], c: 0, why: 'Money left the bank (an asset went down) and the business had a rent expense (an expense went up). Same amount on both sides.' }]
    },
    {
      id: 'tour', title: 'Find your way around', mins: 4,
      learn: 'What each dashboard number means, where the daily work lives, and the fastest way to find anything.',
      body: [
        `<p>The <b>Dashboard</b> is each client's home. Across the top: <b>Cash in the bank</b> (what's in their accounts right now), <b>Profit this year</b> (income minus expenses), <b>Income this month</b>, and <b>Customers owe</b> (unpaid invoices).</p>`,
        `<p>Cash and profit are different on purpose. A business can be profitable but short on cash (customers haven't paid yet), or have lots of cash but little profit (the owner just put money in). Clients often confuse these — explaining it is part of the job.</p>`,
        `<p><b>Needs your attention</b> is your to-do list for that client. <b>All clients</b> (top of the sidebar) shows every client's to-dos at once — that's where you'll start most days.</p>`,
        `<p>The fastest way to anything is <span class="kbd">Ctrl</span> <span class="kbd">K</span> (or the search box at the top). Type a payee, an amount like <i>129.99</i>, an invoice number, or a screen name.</p>`
      ],
      words: [['Profit', 'Income minus expenses for a period. Also called net income.'], ['Cash', 'Money actually in the bank right now.']],
      task: "Open Bluebird Bakery's dashboard, then press Ctrl K (or click the search box) once.",
      action: ['Go to the dashboard', () => ensurePractice(true, 'dashboard')],
      check: () => !!(T().flags.dashboard && T().flags.palette),
      quiz: [{ q: 'A client has $14,000 in the bank but only $3,000 of profit this year. How can that be?', a: ['It is a mistake — they should match', 'Cash includes money from before this year, loans or owner deposits; profit only counts this year\'s income minus expenses', 'Profit counts the bank balance twice'], c: 1, why: 'Cash is a balance at one moment. Profit is a result over a period. Money from last year, a loan, or the owner putting money in all raise cash without being profit.' }]
    },
    {
      id: 'import', title: 'Bring in bank activity', mins: 4,
      learn: 'How a bank statement file becomes transactions, and why duplicates never sneak in.',
      body: [
        `<p>Banks let you download account activity as a <b>CSV</b> or <b>Excel</b> file (look for <i>Download</i>, <i>Export</i> or <i>Statements</i> on the bank's website). You'll do this for each client's checking, savings and credit card every month.</p>`,
        `<p>Drop the file anywhere in Coll Ledger. It figures out the columns, asks which account the statement is for, and shows a preview. Lines that are already in the books are marked <b>Already in</b> and skipped, so importing the same file twice is safe.</p>`,
        `<p>New activity lands in <b>To Review</b> — nothing is final until you look at it.</p>`
      ],
      words: [['CSV', 'A plain spreadsheet file most banks can export.'], ['Duplicate', 'A transaction that was already imported; Coll Ledger skips it.']],
      task: 'Import the practice bank file into Business Checking. Notice the one line marked "Already in".',
      action: ['Import the practice bank file', () => { const c = ensurePractice(true, 'import'); setTimeout(() => feed('bluebird-checking.csv', bankFile(c)), 60); }],
      check: () => !!(P() && (P().imports || []).some(i => i.kind === 'bank' && !i.undone)),
      quiz: [{ q: 'You accidentally import the same bank file a second time. What happens?', a: ['Every transaction doubles', 'Coll Ledger marks them "Already in" and skips them', 'The first import is deleted'], c: 1, why: 'Each line is compared with what is already in that account — same date, amount and description — and skipped.' }]
    },
    {
      id: 'review', title: 'Sort transactions', mins: 8,
      learn: 'Picking the right category — including the tricky ones that trip up new bookkeepers.',
      body: [
        `<p>Categorizing is most of the daily work. Coll Ledger fills in a category for almost everything: from a rule (<i>From a smart rule</i>), from what you chose before (<i>Same as last time</i>), or from what it knows about common vendors (<i>Best guess — please check</i>). Your job is to make sure each one is right. Check it, then press <span class="kbd">Enter</span> or click <b>Accept</b>. Use <span class="kbd">↑</span> <span class="kbd">↓</span> to move and <span class="kbd">C</span> to change a category.</p>`,
        `<p>The tricky ones in this file — check that Coll Ledger's guesses match these:</p>
         <ul class="t-list">
           <li><b>Transfer to owner</b> → <i>Owner's Draw</i>. The owner paying themselves isn't a business expense — it's taking out their own money (equity).</li>
           <li><b>Payment to Chase card</b> → <i>Business Credit Card</i>. Paying the card bill is a <b>transfer</b>. The real expenses were recorded when each purchase hit the card; counting the payment too would double them.</li>
           <li><b>City of Denver business license</b> → <i>Taxes & Licenses</i>.</li>
           <li><b>Sunshine Packaging</b> (boxes for the bakery's goods) → <i>Cost of Goods Sold</i>. Things that go out the door with the product are cost of goods.</li>
           <li><b>Blue Mountain Coffee Roasters</b> → <i>Cost of Goods Sold</i> — the bakery sells coffee.</li>
         </ul>`,
        `<p>Leave the <b>Costco</b> purchase for the next-but-one lesson — you'll split it.</p>`
      ],
      words: [['Transfer', 'Money moving between two of the business\'s own accounts. Not income, not an expense.'], ["Owner's Draw", 'Money the owner takes out for themselves.'], ['Cost of Goods Sold', 'What it costs to make the things you sell — ingredients, packaging.']],
      task: 'Accept every transaction in To Review except the Costco one.',
      action: ['Open To Review', () => ensurePractice(true, 'review')],
      check: () => { const c = P(); return !!c && (c.imports || []).some(i => i.kind === 'bank' && !i.undone) && c.transactions.filter(t => t.status === 'review').length <= 1; },
      quiz: [
        { q: 'The owner moves $1,500 from the business to her personal savings. Which category?', a: ['Payroll & Wages', "Owner's Draw", 'Miscellaneous Expense'], c: 1, why: "An owner taking money out is a draw from equity. It doesn't reduce profit, and it isn't deductible like wages." },
        { q: 'The bakery pays its $642 credit card bill from checking. What is that?', a: ['An expense', 'Income', 'A transfer to the credit card account'], c: 2, why: 'The purchases on the card were already recorded as expenses. The payment just moves money from checking to pay down what is owed.' }
      ]
    },
    {
      id: 'rules', title: 'Teach smart rules', mins: 3,
      learn: 'How to make Coll Ledger categorize the same vendors automatically every month.',
      body: [
        `<p>A <b>smart rule</b> says: <i>when the bank description contains these words, use this category</i>. Make one for anything that repeats — software subscriptions, utilities, payroll.</p>`,
        `<p>Rules can <b>suggest</b> (you still click Accept) or be <b>Automatic</b> (matches skip To Review on import). Start with suggestions; switch to automatic once you trust a rule.</p>`,
        `<p>Two ways to make one: tick <b>Always use for…</b> under a category in To Review, or go to <b>Smart Rules → New rule</b>.</p>`
      ],
      words: [['Smart rule', 'Words to match in a bank description, plus the category to use.']],
      task: 'Create one rule — for example "canva" → Software & Subscriptions.',
      action: ['Open Smart Rules', () => ensurePractice(true, 'rules')],
      check: () => { const c = P(); return !!c && c.rules.length > (c.practiceBase ? c.practiceBase.rules : 1); },
      quiz: [{ q: 'You want Xcel Energy bills to skip To Review entirely. What do you set?', a: ['A rule set to Automatic', 'A rule set to Suggests', 'Nothing — it happens by itself'], c: 0, why: 'Automatic rules categorize matching lines during import, so they never wait in To Review.' }]
    },
    {
      id: 'split', title: 'Split a purchase', mins: 4,
      learn: 'Recording one payment that covers several categories.',
      body: [
        `<p>Some receipts mix things: a Costco run might be flour and butter (cost of goods) <i>and</i> paper towels (supplies). Splitting puts each part in the right place so reports are accurate.</p>`,
        `<p>Open the transaction, click <b>Split</b>, and add a line for each category. The lines have to add up to the total — Coll Ledger shows what's left as you type. In To Review you can also press <span class="kbd">S</span>.</p>`,
        `<p>For this one, the receipt says: <b>$248.64</b> of ingredients and <b>$70.00</b> of cleaning and office supplies.</p>`
      ],
      words: [['Split', 'One transaction divided across two or more categories.']],
      task: 'Split the Costco purchase: $248.64 Cost of Goods Sold and $70.00 Office Supplies, then save.',
      action: ['Find the Costco purchase', () => { ensurePractice(true, 'transactions'); Object.assign(S.ui.txn, { q: 'costco', account: 'all', category: '', type: 'all', period: 'last-12' }); render(); }],
      check: () => { const c = P(); return !!c && c.transactions.some(t => !t.extId && t.splits && t.splits.length > 1); },
      quiz: [{ q: 'A $318.64 receipt is $248.64 ingredients and $70 supplies. What should the split lines add up to?', a: ['$248.64', '$318.64', 'Any amount'], c: 1, why: 'Split lines always add up to the full transaction amount, so the bank side still matches the statement.' }]
    },
    {
      id: 'invoices', title: 'Invoices and getting paid', mins: 6,
      learn: 'Billing customers, recording payments, and what Accounts Receivable means.',
      body: [
        `<p>An <b>invoice</b> records income the moment the work is done, even before the customer pays. Until they pay, that money sits in <b>Accounts Receivable</b> — "money customers owe us."</p>`,
        `<p>When the payment arrives, open the invoice and click <b>Record payment</b>. That moves the money into the bank and clears what the customer owes. <b>Don't</b> also categorize that deposit as Sales — the income was already counted on the invoice, so it would count twice. If the deposit arrives in a bank import instead, To Review spots it and suggests <b>Pays invoice …</b> — accept that and the invoice is marked paid.</p>`,
        `<p>Two things to do: Maple Elementary PTA has paid invoice <b>BB-102</b>, and Riverside Coffee needs a new invoice for <b>40 dozen bagels at $14</b>.</p>`
      ],
      words: [['Invoice', 'A bill to a customer. Recording it counts the income.'], ['Accounts Receivable (A/R)', 'Money customers owe the business.']],
      task: 'Record the payment on BB-102, then create and "Save & mark sent" a new invoice for Riverside Coffee.',
      action: ['Open Invoices', () => { S.ui.inv.filter = 'all'; ensurePractice(true, 'invoices'); }],
      check: () => { const c = P(); if (!c) return false; const st = c.invoices.map(i => C.invoiceState(c, i)); return st.filter(s => s.status === 'paid').length > c.practiceBase.paid && c.invoices.filter(i => !['draft', 'void'].includes(i.status)).length > c.practiceBase.sent; },
      quiz: [{ q: 'Maple Elementary pays its $300 invoice by check. How do you record it?', a: ['Categorize the deposit as Sales', 'Open the invoice and click Record payment', 'Delete the invoice'], c: 1, why: 'The sale was counted when the invoice was sent. Recording the payment on the invoice clears Accounts Receivable without counting the income a second time.' }]
    },
    {
      id: 'reconcile', title: 'Reconcile a statement', mins: 6,
      learn: 'Proving the books match the bank — the step that makes everything trustworthy.',
      body: [
        `<p><b>Reconciling</b> means checking the books against the bank's own statement. You enter the statement's ending date and balance, then tick each transaction that appears on it. When the <b>Difference</b> reaches <b>$0.00</b>, every dollar is accounted for.</p>`,
        `<p>If it won't hit zero, look for: a transaction that's missing, an amount typed wrong, something ticked that isn't on the statement, or a duplicate. Coll Ledger points out when one unticked item matches the difference exactly.</p>`,
        `<p>Here is Bluebird's checking statement for last month:</p><div class="t-stmt" id="t-stmt"></div>`
      ],
      words: [['Reconcile', 'Match the books to a bank or card statement until the difference is $0.00.'], ['Cleared', 'A transaction the bank has processed.']],
      task: 'Reconcile Business Checking using the statement above.',
      action: ['Open Reconcile', () => ensurePractice(true, 'reconcile')],
      check: () => { const c = P(); return !!c && c.reconciliations.length > 0; },
      quiz: [{ q: 'You finish ticking and the difference is $4.50. What should you look for first?', a: ['Close the month anyway', 'A $4.50 transaction left unticked, or an amount typed $4.50 off', 'Change the statement balance until it matches'], c: 1, why: 'A difference is a clue. Look for an item of exactly that amount, a typo, or something ticked that is not on the statement. Never change the statement to fit.' }]
    },
    {
      id: 'square', title: 'Square sales the right way', mins: 5,
      learn: 'Why card sales go through a "Square" account, and what happens to tax, tips and fees.',
      body: [
        `<p>Many small businesses take cards through <b>Square</b>. Square holds the money for a day or two, takes its fee, then deposits the rest. If you counted only the bank deposits as sales, you'd miss the fees and mix up tax and tips.</p>`,
        `<p>Coll Ledger imports Square's <b>Transactions CSV</b> as one entry per day in a <b>Square</b> account, split into <i>Sales</i>, <i>Sales Tax Payable</i> (it's the state's money), <i>Tips Payable</i> (it's the staff's money), and <i>Merchant fees</i>. Cash payments move to <i>Cash on Hand</i>.</p>`,
        `<p>When Square's deposit shows up in the bank, it's categorized to the <b>Square</b> account — a transfer — so sales are never counted twice.</p>`
      ],
      words: [['Clearing account', 'A holding account (like Square) for money on its way to the bank.'], ['Sales Tax Payable', 'Tax collected from customers that the business owes the state.']],
      task: 'Import the practice Square file and look at one day\'s split.',
      action: ['Import the practice Square file', () => { ensurePractice(true, 'import'); setTimeout(() => feed('square-transactions.csv', squareFile()), 60); }],
      check: () => { const c = P(); return !!c && (c.imports || []).some(i => i.kind === 'square-sales' && !i.undone); },
      quiz: [{ q: 'Why aren\'t Square bank deposits categorized as Sales?', a: ['Because the sales were already recorded from Square\'s file — the deposit is just a transfer', 'Because deposits are never income', 'Because Square keeps all the money'], c: 0, why: 'Sales, tax, tips and fees were recorded from Square\'s file. The deposit only moves what is left from the Square account to checking.' }]
    },
    {
      id: 'close', title: 'Reports and closing the month', mins: 6,
      learn: 'Reading the two main reports, locking a finished month, and sending the client package.',
      body: [
        `<p>The <b>Profit & Loss</b> answers "did we make money?" — income minus expenses for a period. The <b>Balance Sheet</b> answers "where do we stand?" — what the business owns, owes, and the owner's stake on a date. Click any line in a report to see what's in it.</p>`,
        `<p><b>Closing the month</b> is the finish line: everything categorized, every account reconciled, no forgotten drafts. Then you lock it, so the reports you send never change by accident. (You can still change a closed month — Coll Ledger just asks first.)</p>`,
        `<p>Finally, the <b>Client package</b> makes one polished PDF with a summary page, Profit & Loss and Balance Sheet, prepared under your studio's name. That's what you send each client every month.</p>`
      ],
      words: [['Profit & Loss', 'Income minus expenses for a period.'], ['Balance Sheet', 'Assets, liabilities and equity on one date.'], ['Lock date', 'The last day of the most recent closed month.']],
      task: "Open Bluebird's Profit & Loss, then close last month.",
      action: ['Open Close the month', () => { S.ui.close.month = null; ensurePractice(true, 'close'); }],
      check: () => { const c = P(); return !!c && !!T().flags.pl && !!c.lockDate && c.lockDate >= lastMonthEnd(); },
      quiz: [{ q: 'Why lock a month after you close it?', a: ['To delete old transactions', 'So the numbers already sent to the client cannot change by accident', 'Because the bank requires it'], c: 1, why: 'Once a client has the report, it should stay the same. Locking makes any later change ask first.' }]
    },

    // ================= Level 2 · Month-end professional =================
    {
      id: 'debits', level: 2, title: 'Debits and credits, for real', mins: 8,
      learn: 'The language CPAs and other bookkeepers speak — and how to work out any entry yourself.',
      body: [
        `<p>Coll Ledger records both sides of every entry for you, but CPAs, auditors and job interviews talk in <b>debits</b> and <b>credits</b>. Knowing them lets you read a General Ledger, post a CPA's adjustments and spot mistakes.</p>`,
        `<div class="t-kinds"><div><b>Debit increases</b><span>Assets (cash, money owed to you, equipment) and Expenses. Also owner's draws.</span></div><div><b>Credit increases</b><span>Liabilities (cards, loans, bills owed), Equity (owner's stake) and Income.</span></div></div>`,
        `<p>Every entry has at least one debit and one credit, and they're always equal. A memory trick: <b>DEALER</b> — <i>D</i>ividends/draws, <i>E</i>xpenses, <i>A</i>ssets go up with debits; <i>L</i>iabilities, <i>E</i>quity, <i>R</i>evenue go up with credits.</p>`,
        `<p>To work out any entry, ask two questions: <b>what did the business get?</b> (usually the debit) and <b>where did it come from?</b> (usually the credit). Paying rent: the business got rent (debit Rent), and the money came from checking (credit Checking).</p>`
      ],
      words: [['Debit (Dr)', 'The left side of an entry. Increases assets and expenses.'], ['Credit (Cr)', 'The right side. Increases liabilities, equity and income.'], ['T-account', 'A sketch of one account with debits on the left and credits on the right.']],
      task: 'Get all eight entries in the drill below right.',
      drill: true,
      check: () => drillScore() === DRILL.length,
      quiz: [{ q: 'The business pays $300 on its loan — all principal. What\'s the entry?', a: ['Debit Loans Payable, credit Checking', 'Debit Interest Expense, credit Checking', 'Debit Checking, credit Loans Payable'], c: 0, why: 'Paying principal lowers the loan (a liability goes down with a debit) and lowers cash (an asset goes down with a credit).' }]
    },
    {
      id: 'bills', level: 2, title: 'Bills and what the business owes', mins: 5,
      learn: 'Entering vendor bills when they arrive, paying them on time, and what Accounts Payable means.',
      body: [
        `<p>Invoices are money coming <i>in</i>. <b>Bills</b> are the other direction: a vendor sends the business a bill, and the business pays it later. Until it's paid, it sits in <b>Accounts Payable</b> — "money we owe vendors."</p>`,
        `<p>Entering bills when they arrive (not when they're paid) means the owner always knows what's coming up, and the Bills page shows what's <b>due soon</b> or <b>overdue</b>. Paying is one click — Coll Ledger records the payment from the bank and clears the bill.</p>`,
        `<p>When a bill payment later shows up in a bank import, To Review recognizes it and suggests <b>Pays the … bill</b>, so it isn't counted as a second expense.</p>`
      ],
      words: [['Bill', 'A request for payment from a vendor.'], ['Accounts Payable (A/P)', 'Money the business owes vendors for bills not yet paid.']],
      task: 'Enter a bill for Bluebird Bakery (for example $380 from Restaurant Depot), then pay it.',
      action: ['Open Bills', () => ensurePractice(true, 'bills')],
      check: () => { const c = P(); return !!c && (c.bills || []).some(b => C.billState(c, b).status === 'paid'); },
      quiz: [{ q: 'A $380 bill arrives today, due in 30 days. Where does it show until it\'s paid?', a: ['Accounts Payable', 'Accounts Receivable', 'Cost of Goods Sold only'], c: 0, why: 'Accounts Payable tracks what the business owes. The expense is counted when the bill is entered; paying it just clears what is owed.' }]
    },
    {
      id: 'payroll', level: 2, title: 'Recording payroll', mins: 7,
      learn: 'Turning one big payroll withdrawal into wages and payroll taxes — the way every payroll report reads.',
      body: [
        `<p>Most clients use a payroll service like Gusto or ADP. The bank shows one big withdrawal each payday, but it covers several things: the employees' <b>net pay</b>, the taxes <b>withheld from their checks</b>, and the <b>employer's own payroll taxes</b>.</p>`,
        `<p>For the books, split it the way the payroll report reads: <b>gross wages</b> (net pay plus everything withheld) go to <i>Payroll & Wages</i>, and the <b>employer taxes</b> (the business's share of Social Security, Medicare and unemployment) go to <i>Payroll Taxes</i>. Some providers take taxes in a separate withdrawal — then each withdrawal gets its own category.</p>`,
        `<div class="t-stmt payroll-rpt"><div class="stmt-bank">GUSTO · PAYROLL SUMMARY</div><div class="stmt-row"><span>Gross wages</span><b>$2,720.00</b></div><div class="stmt-row"><span>Employee taxes withheld</span><b>$582.80</b></div><div class="stmt-row"><span>Net pay to employees</span><b>$2,137.20</b></div><div class="stmt-row"><span>Employer taxes (SS 168.64 · Medicare 39.44 · state unemployment 20.54)</span><b>$228.62</b></div><div class="stmt-row big"><span>Total debited from the bank</span><b>$2,948.62</b></div></div>`,
        `<p>Click below to add this payday to Bluebird's books, then open it and split it: <b>$2,720.00 Payroll & Wages</b> and <b>$228.62 Payroll Taxes</b>.</p>`
      ],
      words: [['Gross wages', 'Pay before any taxes are withheld — the employee\'s full wage.'], ['Net pay', 'What actually lands in the employee\'s account.'], ['Employer payroll taxes', 'Taxes the business pays on top of wages (its share of Social Security and Medicare, plus unemployment).']],
      task: 'Add the payroll, then split it: $2,720.00 Payroll & Wages and $228.62 Payroll Taxes.',
      action: ['Add the payroll and find it', () => { plantPayroll(); ensurePractice(true, 'transactions'); Object.assign(S.ui.txn, { q: '2,948.62', account: 'all', category: '', type: 'all', period: 'last-12' }); render(); }],
      check: () => { const c = P(), id = (T().planted || {}).payroll; if (!c || !id) return false; const t = c.transactions.find(x => x.id === id); if (!t || !t.splits) return false; const tax = C.acctByName(c, 'Payroll Taxes'), wages = C.acctByName(c, 'Payroll & Wages'); return t.splits.some(sp => sp.categoryId === (tax || {}).id && Math.abs(Math.abs(sp.amount) - 228.62) < 0.005) && t.splits.some(sp => sp.categoryId === (wages || {}).id && Math.abs(Math.abs(sp.amount) - 2720) < 0.005); },
      quiz: [
        { q: 'Employee taxes withheld from paychecks — whose expense are they?', a: ['The business\'s — record them as Payroll Taxes', 'The employee\'s — they\'re part of gross wages', 'Nobody\'s — leave them out'], c: 1, why: 'Withholdings come out of the employee\'s gross pay. They\'re part of Payroll & Wages; only the employer\'s matching taxes are Payroll Taxes.' },
        { q: 'A client asks you to "run payroll" on top of bookkeeping. What\'s the professional answer?', a: ['Sure — calculate the taxes by hand', 'Use a payroll service (Gusto, ADP…) so filings and deposits are handled, and record its reports', 'Pay employees as contractors instead'], c: 1, why: 'Payroll services file the quarterly and year-end forms and deposit taxes on time. Treating employees as contractors to avoid payroll is misclassification.' }
      ]
    },
    {
      id: 'journals', level: 2, title: 'Journal entries and adjustments', mins: 6,
      learn: 'Posting the entries that don\'t come from the bank — the CPA\'s adjustments, depreciation and accruals.',
      body: [
        `<p>Not everything flows through a bank account. Equipment loses value (<b>depreciation</b>). An electric bill arrives after month end for power already used (<b>accrual</b>). The CPA finds something that belongs in a different category (<b>reclassification</b>). These go in as <b>journal entries</b> — you pick the accounts and enter the debits and credits yourself.</p>`,
        `<p>At year end, most CPAs send a list of <b>adjusting journal entries</b> (AJEs). Posting them exactly as written — same date, accounts and amounts — makes your books match the tax return. Coll Ledger won't let you post an entry until it balances.</p>`,
        `<div class="t-stmt"><div class="stmt-bank">FROM: SMITH &amp; CO. CPAS</div><div class="stmt-row"><span>AJE #1 · Monthly depreciation on the ovens</span></div><div class="stmt-row"><span>Dr Depreciation Expense</span><b>$210.00</b></div><div class="stmt-row"><span>Cr Accumulated Depreciation</span><b>$210.00</b></div></div>`
      ],
      words: [['Journal entry', 'An entry you write yourself with debits and credits.'], ['Adjusting entry (AJE)', 'A correction or end-of-period entry, often from the CPA.'], ['Accrual', 'Recording an expense or income in the month it belongs to, before cash moves.'], ['Accumulated depreciation', 'The total value an asset has lost so far. It reduces the asset on the Balance Sheet.']],
      task: 'Post the CPA\'s AJE #1 for Bluebird: debit Depreciation Expense $210, credit Accumulated Depreciation $210.',
      action: ['Open Journal entries', () => ensurePractice(true, 'journal')],
      check: () => { const c = P(); if (!c) return false; const dep = C.acctByName(c, 'Depreciation Expense'), acc = C.acctByName(c, 'Accumulated Depreciation'); return !!dep && !!acc && (c.journals || []).some(j => !j.void && j.lines.some(l => l.accountId === dep.id && Math.abs(+l.debit - 210) < 0.005) && j.lines.some(l => l.accountId === acc.id && Math.abs(+l.credit - 210) < 0.005)); },
      quiz: [
        { q: 'December\'s electric bill ($180) arrives January 9. You close December on the 5th. Best practice?', a: ['Record it in January only', 'Accrue it in December with a journal entry that reverses on January 1', 'Ignore it — it\'s small'], c: 1, why: 'An accrual puts the expense in the month the power was used. The automatic reversal stops it from counting twice when the bill is paid in January.' },
        { q: 'The CPA\'s adjusting entries arrive after you\'ve closed the year. What do you do?', a: ['Post them exactly as written, dated as the CPA dated them, then lock the year again', 'Change the numbers so they fit', 'Skip them — the return is already filed'], c: 0, why: 'Your books should match the tax return. Reopen, post the AJEs as written, and lock again.' }
      ]
    },
    {
      id: 'receipts', level: 2, title: 'Receipts and the paper trail', mins: 4,
      learn: 'Which receipts the IRS expects, and how to read one into the books in seconds.',
      body: [
        `<p>Every business expense needs proof. The bank statement shows <i>that</i> money left; the <b>receipt</b> shows <i>what it was for</i>. For travel, meals and gifts of <b>$75 or more</b> — and lodging at any amount — the IRS specifically expects a receipt.</p>`,
        `<p><b>Read a receipt</b> (Transactions page, or the New button) reads a photo or PDF right on the computer and fills in the vendor, date and total. If the matching bank charge is already in the books, it attaches the receipt to it. Otherwise it adds a new expense or a bill.</p>`,
        `<p>Try it with the practice receipt — it's for the Sunshine Packaging charge you imported earlier.</p>`
      ],
      words: [['Receipt', 'Proof of what a purchase was: vendor, date, items and amount.'], ['Paper trail', 'The documents behind each number in the books.']],
      task: 'Read the practice receipt and attach it to its transaction.',
      action: ['Read the practice receipt', () => { ensurePractice(true, 'transactions'); setTimeout(practiceReceipt, 80); }],
      check: () => { const c = P(); return !!c && (c.transactions.some(t => (t.attachments || []).length) || (c.bills || []).some(b => (b.attachments || []).length) || (!window.desktop && T().flags.receiptTried)); },
      quiz: [{ q: 'A client spent $96 on a business lunch. What does the IRS expect?', a: ['Nothing — the bank statement is enough', 'A receipt, plus who attended and the business reason', 'Only a note in the memo'], c: 1, why: 'Meals of $75 or more need a receipt, and the business purpose and attendees should be noted.' }]
    },
    {
      id: 'cleanup', level: 2, title: 'Catch mistakes with Clean up', mins: 4,
      learn: 'Finding duplicates and loose ends before they reach a client report.',
      body: [
        `<p>Even careful bookkeepers end up with a doubled transaction (a file imported twice, a charge entered by hand <i>and</i> imported) or something left in <b>Uncategorized</b>. Clients notice these first — "why did I pay the electric bill twice?"</p>`,
        `<p><b>Clean up</b> (under Month end) scans the books and lists likely problems side by side with one-click fixes. Make it a habit right before you close a month.</p>`,
        `<p>Click the button below to add two practice mistakes to Bluebird's books, then fix them.</p>`
      ],
      words: [['Duplicate', 'The same transaction recorded twice.'], ['Uncategorized', 'A holding category for items nobody has sorted yet.']],
      task: 'Add the practice mistakes, then use Clean up to remove the duplicate and categorize the uncategorized item.',
      action: ['Add the mistakes and open Clean up', () => { plantMistakes(); ensurePractice(true, 'cleanup'); }],
      check: () => { const c = P(), pl = T().planted; if (!c || !pl || !pl.dup) return false; const d = c.transactions.filter(t => t.description === pl.dupDesc && Math.abs(t.amount - pl.dupAmt) < 0.005 && t.date === pl.dupDate).length; const u = c.transactions.find(t => t.id === pl.unc); const unc = u && ['unc_inc', 'unc_exp'].includes((C.acct(c, u.categoryId) || {}).key); return d === 1 && !!u && !unc; },
      quiz: [{ q: 'Two identical $164.22 Xcel payments on the same day. What should you do?', a: ['Keep both — the bank knows best', 'Compare with the bank statement, then remove the extra one', 'Change one to $0'], c: 1, why: 'Check the statement: if Xcel was paid once, the second entry is a duplicate and should be removed.' }]
    },
    {
      id: 'troubleshoot', level: 2, title: 'When the reconciliation won\'t balance', mins: 5,
      learn: 'The detective work: how to find the one entry that\'s off.',
      body: [
        `<p>A difference that won't go away is almost always one of four things: a <b>missing</b> transaction, a <b>duplicate</b>, something ticked that isn't on the statement, or an amount <b>typed wrong</b>.</p>`,
        `<p>Two tricks pros use: if the difference equals one transaction exactly, look for that amount. If the difference <b>divides evenly by 9</b> (like $54 or $18), two digits were probably swapped — $186.00 typed as $168.00.</p>`,
        `<p>Click below to add a check Bluebird wrote. The bakery's copy of the bank statement shows <b>check #1042 to Gardner Supply for $186.00</b> — find the entry in the books and correct it.</p>`
      ],
      words: [['Transposition', 'Two digits swapped while typing. The error always divides evenly by 9.']],
      task: 'Add the practice check, then fix its amount so it matches the statement ($186.00).',
      action: ['Add the check and find it', () => { plantTypo(); ensurePractice(true, 'transactions'); Object.assign(S.ui.txn, { q: '1042', account: 'all', category: '', type: 'all', period: 'last-12' }); render(); }],
      check: () => { const c = P(), pl = T().planted; if (!c || !pl || !pl.typo) return false; const t = c.transactions.find(x => x.id === pl.typo); return !!t && Math.abs(t.amount + 186) < 0.005; },
      quiz: [{ q: 'The reconcile difference is $36. What\'s a likely cause?', a: ['Swapped digits — 36 divides evenly by 9', 'The bank made a mistake', 'Sales tax'], c: 0, why: 'Transposed digits always leave a difference divisible by 9 — for example $73 typed as $37 (a $36 difference).' }]
    },
    {
      id: 'monthwrap', level: 2, title: 'Mileage, reminders and the month-end email', mins: 5,
      learn: 'The extras that make clients love you: deductions they\'d miss, getting them paid, and a clear monthly note.',
      body: [
        `<p><b>Mileage</b> is one of the most-missed deductions. Every business mile is worth the IRS standard rate. Log the date, miles and business reason for each trip — Coll Ledger records the month's total in the books.</p>`,
        `<p><b>Payment reminders</b> on the Invoices page write friendly, firm or final-notice emails for overdue customers. Getting a client paid faster is a service they'll remember.</p>`,
        `<p>The <b>Month-end email</b> (on Reports and Close the month) writes a short summary — money in, money out, profit, cash, what's owed. Send it with the client package every month.</p>`
      ],
      words: [['Standard mileage rate', 'The IRS amount per business mile, which covers gas, wear and insurance.']],
      task: 'Log one business trip for Bluebird, then open the Month-end email.',
      action: ['Open Mileage', () => ensurePractice(true, 'mileage')],
      check: () => { const c = P(); return !!c && (c.trips || []).length > 0 && !!T().flags.monthEmail; },
      quiz: [{ q: 'Which mileage log entry is complete?', a: ['"About 300 miles in March"', 'Oct 3 · Office → Restaurant Depot · 12 miles · pick up supplies', 'Just the yearly total'], c: 1, why: 'Each trip needs the date, miles and business reason.' }]
    },
    // ================= Level 3 · Client advisor =================
    {
      id: 'planning', level: 3, title: 'Cash flow and budgets', mins: 5,
      learn: 'Looking ahead: will the client have enough cash, and are they spending to plan?',
      body: [
        `<p>Bookkeeping looks back. <b>Advising</b> looks ahead — and it's what clients will pay more for. The <b>Cash flow</b> tab in Planning projects the bank balance for the next 90 days from unpaid invoices, upcoming bills, repeating items and everyday activity. If cash could run short, it says when.</p>`,
        `<p>A <b>budget</b> is a monthly plan for each category. Comparing <i>budget vs. actual</i> each month shows where the business is overspending. <b>Fill from last 3 months</b> gives you a realistic starting point.</p>`
      ],
      words: [['Cash-flow forecast', 'A projection of the bank balance over the coming weeks.'], ['Budget vs. actual', 'Planned amounts compared with what really happened.']],
      task: 'Set up a budget for Bluebird (Fill from last 3 months is fine).',
      action: ['Open Planning → Budget', () => { S.ui.plan.tab = 'budget'; ensurePractice(true, 'planning'); }],
      check: () => { const c = P(); return !!c && Object.keys(c.budgets || {}).length > 0; },
      quiz: [{ q: 'The forecast shows cash dipping below $0 in five weeks. Most useful advice?', a: ['Ignore it — it\'s only a forecast', 'Chase overdue invoices and look at moving a bill date or two', 'Close the business account'], c: 1, why: 'A forecast is an early warning. Collecting money owed and timing payments can keep cash above zero.' }]
    },
    {
      id: 'ownertax', level: 3, title: 'Owner pay and quarterly taxes', mins: 5,
      learn: 'Helping owners pay themselves safely and set aside enough for taxes.',
      body: [
        `<p>Owners of sole proprietorships, and of LLCs taxed as sole proprietorships or partnerships, don't get a paycheck — they take <b>draws</b>. Draws aren't expenses, so they don't lower profit — and the owner pays income tax on the <b>profit</b>, not on what they took.</p>`,
        `<p>With no tax withheld, owners usually pay <b>estimated taxes</b> four times a year: April 15, June 15, September 15 and January 15. Self-employment tax alone is 15.3%, so setting aside <b>25–30% of profit</b> is a common rule of thumb. The tax preparer gives the real number.</p>`,
        `<p>The <b>Owner pay & taxes</b> tab shows what's been taken, what to set aside each quarter, and a cautious "about safe to pay the owner" number.</p>`
      ],
      words: [['Estimated tax', 'Tax paid during the year by people without withholding.'], ['Self-employment tax', 'Social Security and Medicare for the self-employed — 15.3%.']],
      task: 'Open Bluebird\'s Owner pay & taxes tab.',
      action: ['Open Owner pay & taxes', () => { S.ui.plan.tab = 'owner'; ensurePractice(true, 'planning'); }],
      check: () => !!T().flags.ownerTab,
      quiz: [
        { q: 'A sole proprietor made $60,000 profit and took $40,000 in draws. Income tax is based on…', a: ['$40,000 of draws', '$60,000 of profit', '$20,000 — the difference'], c: 1, why: 'Draws aren\'t expenses. Tax is on the business profit, whatever the owner took out.' },
        { q: 'When is the third-quarter estimated tax payment due?', a: ['September 15', 'September 30', 'October 15'], c: 0, why: 'April 15, June 15, September 15 and January 15 (next business day on weekends).' }
      ]
    },
    {
      id: 'entities', level: 3, title: 'Business types and paying the owner', mins: 6,
      learn: 'Why a sole proprietor, an LLC and an S corporation pay their owners differently — and where it shows in the books.',
      body: [
        `<p>How the owner gets paid depends on the <b>business type</b>:</p>
         <ul class="t-list"><li><b>Sole proprietor</b> and <b>single-member LLC</b>: the owner takes <b>draws</b>. Tax is on the profit, not on the draws.</li><li><b>Partnership</b> or <b>multi-member LLC</b>: partners take draws or <b>guaranteed payments</b>; each gets a K-1. Track each partner's equity separately.</li><li><b>S corporation</b>: an owner who works in the business must get a <b>reasonable salary through payroll</b>; the rest can come out as <b>distributions</b>. Owners paid only by draws is a common, costly mistake.</li><li><b>C corporation</b>: owners are paid wages; other money out is usually a dividend or a loan.</li></ul>`,
        `<p>An LLC is a legal form, not a tax type — it can be taxed as a sole proprietorship, a partnership or an S corp. When you onboard a client, ask what the <b>tax return</b> looks like (Schedule C, 1065 or 1120-S). Set it in each client's Settings so Coll Ledger's owner-pay guidance matches.</p>`
      ],
      words: [['Distribution', 'Profit paid out to S-corp owners — not wages, not an expense.'], ['Reasonable salary', 'What an S-corp must pay an owner who works in the business, through payroll.'], ['K-1', 'The tax form showing each partner\'s or S-corp owner\'s share of profit.']],
      task: 'Bluebird Bakery LLC has one owner and never elected S-corp. Set its business type in Settings.',
      action: ['Open Bluebird\'s Settings', () => ensurePractice(true, 'settings')],
      check: () => { const c = P(); return !!c && c.entity === 'llc1'; },
      quiz: [
        { q: 'An S-corp owner who works full time takes $80,000 out as draws and no salary. What should you do?', a: ['Nothing — draws are fine', 'Flag it for the CPA: S-corp owners who work in the business need a reasonable salary through payroll', 'Record the draws as wages yourself'], c: 1, why: 'Paying an S-corp owner only through distributions is a well-known IRS issue. Raise it with the client and the CPA rather than reclassifying it yourself.' },
        { q: 'A new client says "we\'re an LLC." What do you ask next?', a: ['Nothing — LLC tells you everything', 'Which tax return do you file — Schedule C, 1065 or 1120-S?', 'What color is your logo?'], c: 1, why: 'An LLC can be taxed several ways. The return tells you how owners should be paid and how equity is tracked.' }
      ]
    },
    {
      id: 'health', level: 3, title: 'Reading the numbers like an advisor', mins: 6,
      learn: 'Turning reports into plain-English advice clients will pay for.',
      body: [
        `<p>Clients don't want reports — they want to know <b>how they're doing</b> and <b>what to do next</b>. A few numbers answer most of it:</p>
         <ul class="t-list"><li><b>Gross margin</b> — of each sales dollar, what's left after the direct cost of what was sold.</li><li><b>Net profit margin</b> — what's left after everything.</li><li><b>Cash cushion</b> — months of normal spending the bank balance covers.</li><li><b>Days to get paid</b> — how long customers take to pay.</li><li><b>Owner pay vs. profit</b> — whether the owner is taking out more than the business earns.</li></ul>`,
        `<p>The <b>Business Health</b> report (Reports) calculates all of these with a plain-English reading. Compare month to month and to the same month last year — trends matter more than any single number.</p>`
      ],
      words: [['Gross margin', '(Sales − cost of goods sold) ÷ sales.'], ['Net margin', 'Net profit ÷ sales.'], ['Days to get paid', 'Money customers owe ÷ average daily sales.']],
      task: 'Open Bluebird\'s Business Health report.',
      action: ['Open Business Health', () => { S.ui.report.type = 'health'; S.ui.report.period = 'ytd'; ensurePractice(true, 'reports'); }],
      check: () => !!T().flags.rHealth,
      quiz: [
        { q: 'Sales $50,000, cost of goods sold $20,000, other expenses $22,000. Gross margin?', a: ['16%', '60%', '40%'], c: 1, why: '(50,000 − 20,000) ÷ 50,000 = 60%. Net margin would be (50,000 − 42,000) ÷ 50,000 = 16%.' },
        { q: 'Profit is up but the bank balance keeps falling. What do you look at first?', a: ['Days to get paid and owner draws', 'The logo', 'Nothing — profit is up'], c: 0, why: 'Customers paying slowly and owners taking out more than profit are the two usual reasons cash falls while profit rises.' }
      ]
    },
    {
      id: 'yearend', level: 3, title: 'Year-end and 1099s', mins: 5,
      learn: 'The January rush: contractors, the CPA package, and locking the year.',
      body: [
        `<p>Businesses send a <b>1099-NEC</b> to unincorporated contractors they paid for services. Starting with payments made in <b>2026</b>, the threshold is <b>$2,000</b> (it was $600 through 2025). Payments by card or apps are reported by the payment company instead. Forms are due <b>January 31</b> — so collect a <b>W-9</b> before the first payment.</p>`,
        `<p>Mark contractors as <b>1099 contractors</b> on their vendor record and the <b>1099 Contractors</b> report adds up what each was paid by check or bank. Then Reports → <b>Year-end for the CPA</b> builds the whole package.</p>`,
        `<p>Bluebird paid a window-cleaning contractor this year. Click below to add those payments, then mark the vendor as a 1099 contractor.</p>`
      ],
      words: [['1099-NEC', 'The form reporting what a business paid a contractor.'], ['W-9', 'The contractor\'s form with their legal name, address and tax ID.']],
      task: 'Mark Front Range Window Cleaning as a 1099 contractor, then open the 1099 Contractors report.',
      action: ['Add the contractor and open the vendor list', () => { plantContractor(); ensurePractice(true, 'contacts'); }],
      check: () => { const c = P(); return !!c && c.contacts.some(x => x.name === 'Front Range Window Cleaning' && x.is1099) && !!T().flags.r1099; },
      quiz: [{ q: 'In 2026 a contractor is paid $2,250 by bank transfer. Is a 1099-NEC needed?', a: ['Yes — it\'s $2,000 or more', 'No — only over $10,000', 'No — bank transfers never count'], c: 0, why: 'For payments made in 2026, $2,000 or more to an unincorporated contractor for services generally needs a 1099-NEC.' }]
    },

    // ================= Level 4 · Running your practice =================
    {
      id: 'onboard', level: 4, title: 'Onboarding a new client', mins: 6,
      learn: 'The first two weeks with a new client — what to collect so the books start right.',
      body: [
        `<p>Most bookkeeping problems start at onboarding: missing accounts, wrong opening balances, no idea how the business is taxed. A consistent checklist prevents all of it.</p>`,
        `<p>Collect: a signed engagement letter; legal name, EIN and business type; <b>read-only</b> access to every bank and card account; statements for the start date; last year's tax return and the CPA's contact; prior books; payroll access; sales tax account and schedule; loan and lease documents; equipment list; contractors with W-9s; and who gets the reports.</p>`,
        `<p>Coll Ledger adds all of these as the client's to-dos in one click (Dashboard → To-dos → <b>Onboarding checklist</b>), each due in two weeks.</p>`
      ],
      words: [['Opening balance', 'Each account\'s balance on the day the books start in Coll Ledger.'], ['Read-only access', 'Permission to see accounts without moving money.']],
      task: 'Add the onboarding checklist to Bluebird\'s to-dos.',
      action: ['Add the checklist', () => { const c = ensurePractice(true, 'dashboard'); App.addOnboarding(c); }],
      check: () => { const c = P(); return !!c && (c.todos || []).filter(t => t.onboarding).length >= 10; },
      quiz: [
        { q: 'Where do opening balances come from?', a: ['The client\'s best guess', 'Bank and card statements for the start date (and the prior balance sheet for everything else)', 'Last month\'s deposits'], c: 1, why: 'Statements give exact balances on a specific date. Loans, equipment and other balances come from the prior books or tax return.' },
        { q: 'A new client offers to email you their online banking password. You…', a: ['Accept and save it in Notes', 'Thank them and ask for read-only or accountant access instead', 'Use it once, then forget it'], c: 1, why: 'Read-only access protects the client and you. Never store full passwords.' }
      ]
    },
    {
      id: 'pricing', level: 4, title: 'Pricing your services', mins: 6,
      learn: 'Quoting a monthly fee you can live on — and catch-up work that pays for itself.',
      body: [
        `<p>Most independent bookkeepers charge a <b>monthly flat fee</b> based on volume (transactions and accounts) and extras (payroll, invoicing, bills, sales tax, inventory, advisory calls). Clients like predictable bills; you're rewarded for working efficiently.</p>`,
        `<p>Price <b>catch-up</b> work separately — often a little under one monthly fee for each month behind, and more if the records are a mess — and collect it before you start. Check your <b>effective hourly rate</b> (fee ÷ hours): if it's too low, raise the fee or trim the scope.</p>`,
        `<p>My studio → <b>Price a client</b> gives you a starting quote and turns it straight into an engagement letter.</p>`
      ],
      words: [['Flat fee', 'A set monthly price for a defined scope.'], ['Scope creep', 'Extra work that sneaks in without extra pay.'], ['Effective hourly rate', 'Your fee divided by the hours it really takes.']],
      task: 'Use the pricing calculator to quote a client (try 120 transactions, 3 accounts, payroll).',
      action: ['Open the pricing calculator', () => { ensurePractice(false); App.pricingModal(); }],
      check: () => !!T().flags.priced,
      quiz: [
        { q: 'A client on a $400/month plan starts sending three times as many transactions. Best move?', a: ['Absorb it — they\'re a nice client', 'Point to the engagement letter and adjust the fee with notice', 'Quietly do less work'], c: 1, why: 'Scope and fees are tied in the engagement letter. Raise it early and kindly, with the notice the letter allows.' },
        { q: 'A business is eight months behind. How do you quote it?', a: ['Free — they\'ll become a monthly client', 'A separate catch-up fee, paid before starting, plus the ongoing monthly fee', 'Hourly with no estimate'], c: 1, why: 'Catch-up is a project: quote it separately, get paid up front, then start the monthly service.' }
      ]
    },
    {
      id: 'engagement', level: 4, title: 'Engagement letters and boundaries', mins: 5,
      learn: 'The one document that protects you, sets expectations and prevents most client problems.',
      body: [
        `<p>An <b>engagement letter</b> spells out: the services, what the client provides and by when, what's <i>not</i> included (tax returns, tax advice, audits, legal advice), the fee and payment terms, confidentiality, and how either side can end it.</p>`,
        `<p>It also states that the client is responsible for the accuracy of what they give you and for their business decisions, and that you don't audit their records. Have an attorney review your standard letter once; then use it with every client — no exceptions, even friends.</p>`,
        `<p>My studio → <b>Engagement letter</b> builds a ready-to-sign PDF from your services and fee.</p>`
      ],
      words: [['Engagement letter', 'A written agreement covering scope, responsibilities and fees.'], ['Out of scope', 'Work not covered by the agreement — quoted separately.']],
      task: 'Create an engagement letter for a pretend client.',
      action: ['Open the engagement letter', () => { ensurePractice(false); App.engagementModal({ client: 'Riverside Coffee Co.', contact: 'Sam Rivera', fee: 450 }); }],
      check: () => !!T().flags.engagement,
      quiz: [{ q: 'A client asks you to "just quickly file" their sales tax return, which isn\'t in your letter. You…', a: ['Do it free this once', 'Explain it\'s outside the agreement and quote it, or add it to the scope', 'Ignore the request'], c: 1, why: 'Kindly naming what\'s in and out of scope — and quoting extras — keeps the relationship healthy and you paid.' }]
    },
    {
      id: 'catchup', level: 4, title: 'Catch-up and cleanup projects', mins: 6,
      learn: 'How to bring months of messy or missing books up to date without getting lost.',
      body: [
        `<p>Many new clients come to you behind or with books someone else got wrong. Work in this order:</p>
         <ol class="t-list"><li><b>Pin down the starting point</b> — a reconciled balance from the last good month, or the prior tax return.</li><li><b>Get every statement</b> for every account, every month. Missing statements are the #1 cause of catch-up projects stalling.</li><li><b>Import and categorize month by month</b>, oldest first, with smart rules doing the repetitive work.</li><li><b>Reconcile each month before moving on.</b> Finding an error in month 3 is easy; finding it from month 9 is not.</li><li><b>Run Clean up</b> on all time, then close each month.</li><li><b>Keep a questions list</b> for the client and send it in batches, not one email at a time.</li></ol>`
      ],
      words: [['Catch-up', 'Bringing books current from behind.'], ['Cleanup', 'Fixing books that exist but are wrong.']],
      task: 'Run Clean up on all time for Bluebird (change "This year" to "All time").',
      action: ['Open Clean up', () => { S.ui.clean = S.ui.clean || {}; S.ui.clean.scope = 'all'; ensurePractice(true, 'cleanup'); }],
      check: () => !!T().flags.cleanAll,
      quiz: [
        { q: 'Halfway through a catch-up, the March reconciliation is off by $412. Best move?', a: ['Keep going and fix it at the end', 'Stop and find it before moving to April', 'Adjust it to Miscellaneous Expense'], c: 1, why: 'Each later month builds on March. Find the difference while it\'s isolated.' },
        { q: 'The client can\'t find statements for two months. What now?', a: ['Estimate the transactions', 'Ask the client to download them from the bank (or request them), and pause those months until they arrive', 'Skip those months'], c: 1, why: 'Banks keep years of statements. Reconciled books need the real statements, not estimates.' }
      ]
    },
    {
      id: 'industries', level: 4, title: 'Industries you\'ll meet', mins: 7,
      learn: 'What to watch for with the kinds of businesses that hire bookkeepers most.',
      body: [
        `<ul class="t-list"><li><b>Restaurants, cafés, bakeries</b> — daily card and cash sales (use the Square import), tips owed to staff, sales tax, food cost as cost of goods sold. Watch food cost and labor as a share of sales.</li><li><b>Contractors and trades</b> — deposits before work starts, materials, subcontractors who need 1099s, vehicles and mileage, and job profitability. Collect W-9s up front.</li><li><b>Retail and e-commerce</b> — inventory, payment-processor fees and payouts (Shopify, Stripe, PayPal work like Square: sales minus fees), sales tax in several states.</li><li><b>Salons, gyms and services</b> — booth rent or contractors vs. employees, gift cards (a liability until used), memberships.</li><li><b>Professional services</b> — invoicing and getting paid, retainers, owner pay and estimated taxes.</li><li><b>Nonprofits</b> — no owners; track grants and donor restrictions; the Form 990 belongs to the CPA.</li></ul>`,
        `<p>When you meet a new industry, ask the client's CPA what they need to see at year end — then set up the categories to match from day one.</p>`
      ],
      words: [['Payment processor', 'A service (Square, Stripe, PayPal) that collects card payments and deposits them minus fees.'], ['Gift card liability', 'Money received for gift cards not yet used — owed to customers, not income yet.']],
      task: null,
      check: () => true,
      quiz: [
        { q: 'A salon sells $1,000 of gift cards in December. How is that recorded?', a: ['$1,000 of December income', 'A liability until the gift cards are used, then income', 'Owner\'s Contributions'], c: 1, why: 'The salon owes services to whoever holds the cards. It becomes income as the cards are redeemed.' },
        { q: 'A contractor client pays a plumbing subcontractor $6,000 by check. What\'s needed by January 31?', a: ['Nothing', 'A 1099-NEC — collect the W-9 before paying', 'A W-2'], c: 1, why: '$6,000 by check to an unincorporated subcontractor is well over the 1099-NEC threshold.' },
        { q: 'A Shopify store\'s payouts arrive in the bank minus fees. How do you record sales?', a: ['Count only the payouts as sales', 'Record full sales and fees from the Shopify report, then treat payouts as transfers — like Square', 'Ignore fees'], c: 1, why: 'Payouts are net of fees. Recording only payouts understates both sales and fees.' }
      ]
    },
    {
      id: 'pro', level: 4, title: 'Ethics, security and confidentiality', mins: 5,
      learn: 'Engagement letters, access, confidentiality and knowing where your role ends.',
      body: [
        `<p>Put every client relationship in writing with an <b>engagement letter</b>: what you'll do, how often, what the client provides and by when, the fee, and what's <i>not</i> included — like tax returns.</p>`,
        `<p>Ask for <b>read-only or accountant access</b> to bank accounts — never store a client's full password. Turn on the <b>password lock</b> and <b>cloud backup</b> in Settings; the books hold private financial information.</p>`,
        `<p>Know your lane. Unless you're an EA, CPA or attorney, don't give tax advice or sign returns. Hand off clean books and let the preparer make the tax calls. The <b>Bookkeeper's Handbook</b> under Help has the rules, deadlines and checklists to keep handy.</p>`,
        `<p>Protect client data: a password on Coll Ledger, encrypted cloud backup, a password manager, two-factor login on email, and never sending statements or tax IDs by plain email if a secure link is available. If you ever see signs of fraud or theft by an employee, document it and tell the owner privately — don't confront anyone yourself. Consider <b>errors & omissions (E&O) insurance</b> before you take on clients.</p>`
      ],
      words: [['Engagement letter', 'A written agreement on scope, timing and fees.'], ['Read-only access', 'Permission to view accounts without moving money.']],
      task: 'Open the Bookkeeper\'s Handbook and skim the Tax rules and Deadline calendar.',
      action: ['Open the handbook', () => go('handbook')],
      check: () => !!T().flags.handbook,
      quiz: [{ q: 'You notice a client\'s office manager has been paying herself extra through vendor checks. What do you do?', a: ['Confront her', 'Document what you found and tell the owner privately', 'Fix the books quietly and say nothing'], c: 1, why: 'Report facts to the owner privately and let them decide next steps. Don\'t investigate or accuse anyone yourself.' }, { q: 'A client asks you, a bookkeeper, to file their tax return. You\'re not an EA or CPA. Best answer?', a: ['File it anyway', 'Refer them to a tax preparer and send clean books', 'Tell them to skip filing'], c: 1, why: 'Bookkeepers prepare the books; credentialed preparers handle returns and tax advice.' }]
    },
    {
      id: 'quickbooks', title: 'Bonus: moving a client from QuickBooks', mins: 4, bonus: true,
      learn: 'The order to bring a client over so every category lines up.',
      body: [
        `<p>New clients often come from QuickBooks. Bring them over in this order:</p>
         <ol class="t-list"><li><b>Chart of accounts</b> (Reports → Account List → Export to Excel) so their categories exist.</li><li><b>Customers and vendors</b> (export from each list).</li><li><b>Transactions</b> (Reports → Transaction Detail by Account → Export to Excel). Coll Ledger shows how each QuickBooks account lines up before importing.</li></ol>`,
        `<p>Set each bank and card's <b>opening balance</b> for the day the books start in Coll Ledger, from that day's statement.</p>`
      ],
      words: [['Chart of accounts', 'The full list of a business\'s accounts and categories.']],
      task: 'Import the practice QuickBooks chart of accounts and see which accounts match.',
      action: ['Import the practice QuickBooks file', () => { ensurePractice(true, 'import'); setTimeout(() => feed('bluebird-account-list.csv', qbFile()), 60); }],
      check: () => { const c = P(); return !!c && (c.imports || []).some(i => i.kind === 'qb-accounts' && !i.undone); },
      quiz: [{ q: 'Which QuickBooks file should you import first?', a: ['Transactions', 'Chart of accounts', 'Customers'], c: 1, why: 'With the chart of accounts in place, every transaction finds its matching category.' }]
    },
    // =====================================================================
    // ADVANCED ACCOUNTING & TAX (second certificate)
    // =====================================================================
    // ---------- Module A · Accrual accounting and the close ----------
    {
      id: 'adv-accrual', track: 'adv', level: 5, title: 'Accrual accounting and deferred revenue', mins: 8,
      learn: 'When income and expenses really belong — the idea behind every adjusting entry.',
      body: [
        `<p>On the <b>cash basis</b>, income counts when money arrives and expenses when they're paid. On the <b>accrual basis</b>, income counts when it's <b>earned</b> and expenses when they're <b>incurred</b> — whatever the bank says. Lenders, investors and larger businesses expect accrual; many small businesses file taxes on cash. A professional understands both.</p>`,
        `<p>Two principles drive everything: <b>revenue recognition</b> (record income when the work is delivered) and <b>matching</b> (record an expense in the same period as the income it helped earn).</p>`,
        `<p>A common case: a customer pays a <b>deposit</b> before the work is done. Until it's delivered, the business <i>owes</i> the work — so the deposit is a liability called <b>Unearned (deferred) Revenue</b>, not income. When the work is delivered, move it to income.</p>`,
        `<p>Bluebird took a <b>$1,200 deposit</b> for a wedding cake delivered next month, and it was recorded as Sales. Fix it with a journal entry: <b>debit Sales $1,200, credit Unearned Revenue $1,200</b>. Next month, when the cake is delivered, the reverse entry recognizes the income.</p>`
      ],
      words: [['Accrual basis', 'Income when earned, expenses when incurred.'], ['Revenue recognition', 'Recording income when the goods or services are delivered.'], ['Unearned revenue', 'Money received for work not yet done — a liability.']],
      task: 'Post the journal entry moving the $1,200 deposit from Sales to Unearned Revenue.',
      action: ['Open Journal entries', () => { const c = ensurePractice(false); C.acctByName(c, 'Unearned Revenue') || C.ensureAccount(c, { name: 'Unearned Revenue', type: 'liability', sub: 'current' }); save(); ensurePractice(true, 'journal'); }],
      check: () => jeHas(P(), 'Sales', 1200, 'Unearned Revenue', 1200),
      quiz: [
        { q: 'A customer prepays $6,000 in January for a year of monthly service. On the accrual basis, January income is…', a: ['$6,000', '$500 — the rest stays in Unearned Revenue', '$0'], c: 1, why: 'Only one month was earned. The other $5,500 is owed service until each month is delivered.' },
        { q: 'Which principle says to record a sales commission in the same month as the sale it came from?', a: ['Matching', 'Conservatism', 'Going concern'], c: 0, why: 'Matching puts expenses in the period of the income they helped produce.' }
      ]
    },
    {
      id: 'adv-prepaid', track: 'adv', level: 5, title: 'Prepaids, accruals and reversing entries', mins: 7,
      learn: 'Getting expenses into the right month when the bill and the benefit don\'t line up.',
      body: [
        `<p><b>Prepaid expenses</b> are paid before they're used — a year of insurance, a software subscription, rent paid in advance. Record the payment to <i>Prepaid Expenses</i> (an asset), then move one month's share to the expense each month.</p>`,
        `<p><b>Accrued expenses</b> are the opposite: used before they're billed — wages employees earned at month end, utilities used before the bill arrives, interest building on a loan. Record the expense and an <i>Accrued Liability</i> at month end.</p>`,
        `<p>To avoid counting an accrual twice when the real bill is paid, post a <b>reversing entry</b> on the first day of the next month. Coll Ledger does it for you when you tick <i>Reverse it automatically</i>.</p>`,
        `<p>October's electric bill isn't in yet; the meter reading says about <b>$180</b>. Accrue it: <b>debit Utilities $180, credit Accrued Liabilities $180</b>, set to reverse automatically.</p>`
      ],
      words: [['Prepaid expense', 'Paid in advance — an asset used up over time.'], ['Accrued expense', 'Incurred but not yet billed or paid — a liability.'], ['Reversing entry', 'An automatic opposite entry next period that cancels an accrual.']],
      task: 'Post the $180 utilities accrual with an automatic reversal.',
      action: ['Open Journal entries', () => ensurePractice(true, 'journal')],
      check: () => { const c = P(); if (!jeHas(c, 'Utilities', 180, 'Accrued Liabilities', 180)) return false; const u = C.acctByName(c, 'Utilities'); return (c.journals || []).some(j => j.reversalOf && !j.void && j.lines.some(l => l.accountId === u.id && Math.abs(+l.credit - 180) < 0.005)); },
      quiz: [
        { q: 'A $2,400 annual insurance policy is paid on March 1. What\'s March\'s insurance expense on the accrual basis?', a: ['$2,400', '$200', '$0'], c: 1, why: '$2,400 ÷ 12 months = $200 a month; the rest stays in Prepaid Expenses.' },
        { q: 'Employees earned $1,250 in the last days of the month, paid on the 5th. At month end you…', a: ['Do nothing', 'Debit wages and credit Accrued Liabilities $1,250, reversing next month', 'Debit Accrued Liabilities and credit cash'], c: 1, why: 'The wages were earned this month, so the expense belongs this month.' }
      ]
    },
    {
      id: 'adv-assets', track: 'adv', level: 5, title: 'Fixed assets and depreciation', mins: 9,
      learn: 'Capitalizing purchases, calculating depreciation, and why the books and the tax return can differ.',
      body: [
        `<p>A purchase that lasts more than a year and costs more than the business's <b>capitalization threshold</b> becomes a <b>fixed asset</b>. Many small businesses use the IRS <b>de minimis safe harbor</b> — items of <b>$2,500 or less</b> per item or invoice can be expensed right away (for businesses without audited financial statements). Keep a written capitalization policy.</p>`,
        `<p><b>Straight-line depreciation</b> spreads cost evenly: <b>(cost − salvage value) ÷ useful life</b>. A $14,400 oven with a $2,400 salvage value and a 10-year life: $12,000 ÷ 10 = $1,200 a year, <b>$100 a month</b>.</p>`,
        `<p>Tax depreciation follows different rules (MACRS classes, <b>Section 179</b> expensing — up to $2.56 million for 2026 — and <b>100% bonus depreciation</b> for qualifying property acquired and placed in service after January 19, 2025). So <b>book</b> and <b>tax</b> depreciation often differ; the CPA tracks the tax side. Your job: an accurate fixed-asset list (what, when, cost) and consistent book depreciation.</p>`,
        `<p>When an asset is sold or scrapped, remove both its cost and its accumulated depreciation; any difference from the sale price is a <b>gain or loss</b>.</p>`
      ],
      words: [['Capitalize', 'Record a purchase as an asset instead of an expense.'], ['Salvage value', 'What an asset is expected to be worth at the end of its life.'], ['Book vs. tax', 'The financial statements and the tax return can use different depreciation.']],
      task: 'Post Bluebird\'s monthly straight-line depreciation on the oven: $14,400 cost, $2,400 salvage, 10 years.',
      action: ['Open Journal entries', () => ensurePractice(true, 'journal')],
      check: () => jeHas(P(), 'Depreciation Expense', 100, 'Accumulated Depreciation', 100),
      quiz: [
        { q: 'A $30,000 delivery van, $6,000 salvage, 5-year life. Straight-line depreciation per year?', a: ['$6,000', '$4,800', '$4,000'], c: 1, why: '($30,000 − $6,000) ÷ 5 = $4,800 a year ($400 a month).' },
        { q: 'A $1,800 laptop at a business using the de minimis safe harbor is usually…', a: ['Capitalized and depreciated over 5 years', 'Expensed when bought', 'Recorded as Owner\'s Draw'], c: 1, why: 'Under the $2,500 de minimis safe harbor it can be expensed immediately (with the election and a consistent policy).' },
        { q: 'Why might book depreciation differ from tax depreciation?', a: ['It\'s a mistake', 'Tax law allows faster methods like Section 179 and bonus depreciation', 'Book depreciation is optional'], c: 1, why: 'The tax return uses tax rules; the books use a consistent accounting method. The CPA reconciles the two.' }
      ]
    },
    {
      id: 'adv-inventory', track: 'adv', level: 5, title: 'Inventory and cost of goods sold', mins: 8,
      learn: 'How businesses that sell products calculate what they really sold — and catch shrinkage.',
      body: [
        `<p>Businesses that hold products must track <b>inventory</b> — goods on hand are an asset until sold. Many small businesses use the <b>periodic method</b>: record purchases, count what's left, and work out cost of goods sold:</p>
         <div class="formula">Beginning inventory + Purchases − Ending inventory = <b>Cost of goods sold</b></div>`,
        `<p>The <b>physical count</b> is the truth. If the books say $19,200 of inventory but the shelves hold $18,450, the $750 difference is <b>shrinkage</b> (loss, spoilage, theft or errors) and goes to cost of goods sold. Big or growing shrinkage is a control problem worth raising with the owner.</p>`,
        `<p>Bluebird has been expensing all ingredients and packaging as they're bought. Starting this month, the owner counted <b>$3,200</b> of flour, butter, boxes and coffee on hand. Record it as an asset: <b>debit Inventory $3,200, credit Cost of Goods Sold $3,200</b>.</p>`
      ],
      words: [['Inventory', 'Goods held for sale — an asset until sold.'], ['Periodic method', 'Count inventory at period end and calculate cost of goods sold.'], ['Shrinkage', 'Inventory that disappears through loss, theft, spoilage or error.']],
      task: 'Record Bluebird\'s $3,200 of inventory on hand.',
      action: ['Open Journal entries', () => { const c = ensurePractice(false); C.acctByName(c, 'Inventory') || C.ensureAccount(c, { name: 'Inventory', type: 'asset', sub: 'current' }); save(); ensurePractice(true, 'journal'); }],
      check: () => jeHas(P(), 'Inventory', 3200, 'Cost of Goods Sold', 3200),
      quiz: [
        { q: 'Beginning inventory $10,000, purchases $25,000, ending inventory $12,000. Cost of goods sold?', a: ['$23,000', '$27,000', '$47,000'], c: 0, why: '$10,000 + $25,000 − $12,000 = $23,000.' },
        { q: 'The count shows $900 less inventory than the books. The adjustment is…', a: ['Debit Inventory, credit COGS $900', 'Debit COGS, credit Inventory $900', 'No entry'], c: 1, why: 'Lower actual inventory means more cost of goods sold: debit COGS, credit Inventory.' }
      ]
    },
    {
      id: 'adv-loans', track: 'adv', level: 5, title: 'Loans, interest and amortization', mins: 7,
      learn: 'Splitting every loan payment correctly so the loan balance always matches the lender.',
      body: [
        `<p>Each loan payment has two parts: <b>interest</b> (an expense) and <b>principal</b> (pays down the loan). For a typical monthly loan, interest = <b>balance × annual rate ÷ 12</b>; the rest of the payment is principal. As the balance falls, interest shrinks and principal grows — that table is the <b>amortization schedule</b>.</p>`,
        `<p>Always split payments from the lender's statement or schedule, and reconcile the Loans Payable balance to the lender's balance at least quarterly. A loan recorded as one expense overstates expenses and leaves the loan balance wrong forever.</p>`,
        `<p>Bluebird's equipment loan has a <b>$24,000</b> balance at <b>7.5%</b>. This month's payment of <b>$650</b> just cleared. Interest: $24,000 × 7.5% ÷ 12 = <b>$150</b>; principal: <b>$500</b>. Find the payment and split it.</p>`
      ],
      words: [['Principal', 'The part of a payment that reduces the loan.'], ['Amortization schedule', 'A table splitting each payment into interest and principal.']],
      task: 'Add the loan payment, then split it: $500 Loans Payable and $150 Interest Expense.',
      action: ['Add the payment and find it', () => { plantLoan(); ensurePractice(true, 'transactions'); Object.assign(S.ui.txn, { q: 'loan pmt', account: 'all', category: '', type: 'all', period: 'last-12' }); render(); }],
      check: () => { const c = P(), id = (T().planted || {}).loan; if (!c || !id) return false; const t = c.transactions.find(x => x.id === id); if (!t || !t.splits) return false; const lp = C.acctByName(c, 'Loans Payable'), ie = C.acctByName(c, 'Interest Expense'); return t.splits.some(sp => lp && sp.categoryId === lp.id && Math.abs(Math.abs(sp.amount) - 500) < 0.005) && t.splits.some(sp => ie && sp.categoryId === ie.id && Math.abs(Math.abs(sp.amount) - 150) < 0.005); },
      quiz: [
        { q: 'Balance $36,000 at 6% annual interest. Interest in this month\'s payment?', a: ['$2,160', '$180', '$360'], c: 1, why: '$36,000 × 6% ÷ 12 = $180.' },
        { q: 'The lender\'s statement shows a $27,100 balance; your books show $26,400. Likely cause?', a: ['Payments recorded entirely as principal — interest was never split out', 'The lender is wrong', 'Sales tax'], c: 0, why: 'If interest was recorded as principal, the books\' loan balance falls too fast. Split the payments and reconcile.' }
      ]
    },
    {
      id: 'adv-close', track: 'adv', level: 5, title: 'Closing the year and the cash flow statement', mins: 7,
      learn: 'What happens to profit at year end, and how to explain where the cash went.',
      body: [
        `<p>At year end, income and expense accounts start fresh and the year's profit moves into <b>Retained Earnings</b> (equity) — the <b>closing entries</b>. Coll Ledger does this automatically based on each client's business year, so the Balance Sheet always shows prior profits in Retained Earnings and this year's as Net Income.</p>`,
        `<p>The <b>statement of cash flows</b> explains why cash changed when profit didn't match. It has three parts: <b>operating</b> (running the business), <b>investing</b> (buying or selling equipment) and <b>financing</b> (loans, owner contributions and draws). The usual <b>indirect method</b> starts with net income, adds back non-cash expenses like depreciation, and adjusts for changes in receivables, inventory and payables.</p>`,
        `<p>The <b>Trial Balance</b> is your year-end checkpoint: every account, debits equal credits, ready for the CPA.</p>`
      ],
      words: [['Retained earnings', 'Profits kept in the business from past years.'], ['Closing entries', 'Year-end entries that zero income and expenses into retained earnings.'], ['Statement of cash flows', 'Explains the change in cash: operating, investing, financing.']],
      task: 'Open Bluebird\'s Trial Balance.',
      action: ['Open the Trial Balance', () => { S.ui.report.type = 'tb'; ensurePractice(true, 'reports'); }],
      check: () => !!T().flags.rTB,
      quiz: [
        { q: 'Net income $40,000 and depreciation $8,000. Customers owe $5,000 more than last year. Cash from operations (simplified)?', a: ['$53,000', '$43,000', '$37,000'], c: 1, why: '$40,000 + $8,000 depreciation − $5,000 increase in receivables = $43,000.' },
        { q: 'Buying a $20,000 delivery van with cash shows on the cash flow statement under…', a: ['Operating', 'Investing', 'Financing'], c: 1, why: 'Buying or selling long-term assets is investing activity.' }
      ]
    },
    // ---------- Module B · Tax compliance ----------
    {
      id: 'adv-payroll', track: 'adv', level: 6, title: 'Payroll tax compliance', mins: 9,
      learn: 'The taxes, forms and deadlines behind every paycheck — so you can check a payroll service\'s work.',
      body: [
        `<p><b>FICA</b>: employees and employers each pay <b>7.65%</b> — Social Security 6.2% (on wages up to <b>$184,500 for 2026</b>) and Medicare 1.45% (no cap; employees owe an extra 0.9% on wages over $200,000). <b>FUTA</b> (federal unemployment) is 6.0% on the first $7,000 of each employee's wages, usually <b>0.6%</b> after the credit for state unemployment taxes.</p>`,
        `<p><b>Forms and deadlines:</b> Form <b>941</b> each quarter (due the last day of the month after the quarter); Form <b>940</b> yearly (January 31); <b>W-2s</b> to employees and the SSA with W-3 by <b>January 31</b>. Tax deposits are due <b>monthly or semiweekly</b> depending on the business's lookback-period liability. New hires complete a <b>W-4</b> and <b>I-9</b>.</p>`,
        `<p><b>Colorado:</b> state income tax withholding, state unemployment insurance (through the Colorado Department of Labor and Employment), and FAMLI paid-leave premiums. Other states have their own versions.</p>`,
        `<p>Even with a payroll service, check every quarter that the 941 wages match the books and that deposits went out. Penalties for late deposits are steep — and the owner can be personally liable for unpaid withheld taxes.</p>`
      ],
      words: [['FICA', 'Social Security and Medicare taxes.'], ['Form 941', 'The employer\'s quarterly federal payroll tax return.'], ['Trust fund taxes', 'Taxes withheld from employees — held in trust for the government.']],
      task: null,
      check: () => true,
      quiz: [
        { q: 'An employee earns $2,000 this period. The employer\'s share of FICA is…', a: ['$153.00', '$306.00', '$124.00'], c: 0, why: '$2,000 × 7.65% = $153. The employee pays another $153 through withholding.' },
        { q: 'When is the third-quarter Form 941 due?', a: ['September 30', 'October 31', 'January 31'], c: 1, why: 'The last day of the month after the quarter ends: October 31.' },
        { q: 'Why are unpaid withheld payroll taxes so serious?', a: ['They aren\'t', 'They\'re trust fund taxes — responsible owners can be held personally liable', 'Only the payroll company is liable'], c: 1, why: 'Withheld taxes belong to the government. The IRS can assess responsible people personally.' }
      ]
    },
    {
      id: 'adv-salestax', track: 'adv', level: 6, title: 'Sales tax in depth', mins: 8,
      learn: 'Nexus, taxable sales, exemption certificates and Colorado\'s layered system.',
      body: [
        `<p>A business must collect sales tax where it has <b>nexus</b> — a physical presence (a store, employees, inventory) or <b>economic nexus</b> (sales into a state above its threshold; many states, including Colorado, use <b>$100,000</b> a year). Online sales through a <b>marketplace</b> like Amazon or Etsy are generally collected by the marketplace.</p>`,
        `<p>Not everything is taxable: rules differ for services, food, clothing and wholesale sales. A business selling for resale should get a <b>resale or exemption certificate</b> from the buyer and keep it on file.</p>`,
        `<p><b>Colorado</b> layers taxes: the state rate is <b>2.9%</b>, plus county, city and special-district rates. Some <b>home-rule cities</b> — Denver, Aurora and Boulder among them — run their own sales tax, with their own returns or through the state's SUTS portal. Get each client's exact locations and filing schedule at onboarding.</p>`,
        `<p>Every month, check that <i>Sales Tax Payable</i> matches what the client owes on its returns. The <b>Sales Tax</b> report shows collected, paid and still owed.</p>`
      ],
      words: [['Nexus', 'A connection with a state that requires collecting its sales tax.'], ['Exemption certificate', 'A buyer\'s form showing a sale isn\'t taxable (for resale or exempt use).'], ['Home-rule city', 'A city that sets and may collect its own sales tax.']],
      task: 'Open Bluebird\'s Sales Tax report.',
      action: ['Open the Sales Tax report', () => { S.ui.report.type = 'tax'; ensurePractice(true, 'reports'); }],
      check: () => !!T().flags.rSalesTax,
      quiz: [
        { q: 'A Colorado client starts selling online to Arizona customers — $140,000 a year. What do you flag?', a: ['Nothing — they\'re in Colorado', 'Possible economic nexus in Arizona (its threshold is $100,000) — talk to the client and their CPA', 'Only federal tax applies'], c: 1, why: 'Sales above a state\'s economic nexus threshold can require registering and collecting there.' },
        { q: 'A wholesale customer says "we\'re buying for resale." Before skipping sales tax, the business needs…', a: ['A handshake', 'A valid resale certificate on file', 'A W-9'], c: 1, why: 'Without the certificate, the seller can owe the tax in an audit.' }
      ]
    },
    {
      id: 'adv-biztax', track: 'adv', level: 6, title: 'Business tax returns and the CPA hand-off', mins: 8,
      learn: 'Which return each business files, when it\'s due, and how to hand the CPA a package they love.',
      body: [
        `<p><b>Returns and due dates</b> (calendar-year businesses): sole proprietors and single-member LLCs — <b>Schedule C</b> with the owner's Form 1040, April 15. Partnerships — <b>Form 1065</b> and a <b>K-1</b> for each partner, March 15. S corporations — <b>Form 1120-S</b> and K-1s, March 15. C corporations — <b>Form 1120</b>, April 15. An extension gives more time to <i>file</i>, not to <i>pay</i>.</p>`,
        `<p><b>Book-to-tax differences</b> the CPA will adjust: business meals are generally 50% deductible; entertainment isn't deductible; fines and penalties aren't deductible; depreciation often differs. Keep those in clear, separate accounts so they're easy to find.</p>`,
        `<p><b>The year-end package:</b> Trial Balance, Profit & Loss, Balance Sheet, General Ledger, fixed-asset additions, loan statements, 1099 summary, payroll annual reports, and notes on anything unusual. Reports → <b>Year-end for the CPA</b> builds most of it.</p>`
      ],
      words: [['Schedule C', 'The sole proprietor\'s business profit form, filed with Form 1040.'], ['K-1', 'Each owner\'s share of partnership or S-corp income.'], ['Extension', 'More time to file the return — tax is still due on the original date.']],
      task: 'Build Bluebird\'s Year-end package for the CPA.',
      action: ['Open Reports', () => { S.ui.report.type = 'tb'; ensurePractice(true, 'reports'); }],
      check: () => !!T().flags.yearEnd,
      quiz: [
        { q: 'An S corporation\'s calendar-year return (1120-S) is due…', a: ['January 31', 'March 15', 'April 15'], c: 1, why: 'Partnerships and S corporations: March 15. Schedule C and C corporations: April 15.' },
        { q: 'A client got a $250 parking fine on a business trip. For taxes it\'s…', a: ['Fully deductible', 'Not deductible — keep it in its own account', '50% deductible'], c: 1, why: 'Fines and penalties paid to a government aren\'t deductible.' }
      ]
    },
    {
      id: 'adv-owners', track: 'adv', level: 6, title: 'Owner taxes: self-employment, QBI and estimates', mins: 8,
      learn: 'What business owners actually owe on their profit — and how to help them avoid penalties.',
      body: [
        `<p><b>Self-employment tax</b> is Social Security and Medicare for the self-employed: <b>15.3%</b> of <b>92.35%</b> of net earnings (the Social Security part stops at the wage base). Half of it is deductible on the owner's return. It's why a $50,000 profit can mean about $7,065 of SE tax before any income tax.</p>`,
        `<p>The <b>qualified business income (QBI) deduction</b> lets many owners of pass-through businesses deduct up to <b>20%</b> of qualified business income; it was made permanent in 2025. Higher incomes and some service businesses face limits — the CPA calculates it.</p>`,
        `<p><b>Estimated taxes:</b> to avoid an underpayment penalty, owners generally pay at least <b>90% of this year's tax</b> or <b>100% of last year's</b> (<b>110%</b> if last year's adjusted gross income was over $150,000), in four installments. A quarterly set-aside habit — Planning → Owner pay & taxes — keeps clients out of trouble.</p>`,
        `<p><b>S-corp owners</b> pay payroll taxes only on their salary, not their distributions — which is exactly why the IRS insists the salary be reasonable.</p>`
      ],
      words: [['Self-employment tax', '15.3% Social Security and Medicare on the self-employed.'], ['QBI deduction', 'Up to 20% of qualified business income for many pass-through owners.'], ['Safe harbor', 'A payment level that avoids the underpayment penalty.']],
      task: null,
      check: () => true,
      quiz: [
        { q: 'A sole proprietor has $40,000 of net profit. Self-employment tax is about…', a: ['$6,120', '$5,652', '$3,060'], c: 1, why: '$40,000 × 92.35% × 15.3% ≈ $5,652.' },
        { q: 'Last year\'s tax was $12,000 and AGI was $90,000. To be safe from the underpayment penalty, estimates should total at least…', a: ['$10,800', '$12,000', '$13,200'], c: 1, why: '100% of last year\'s tax ($12,000), since AGI was under $150,000. Over $150,000 it would be 110%.' }
      ]
    },
    {
      id: 'adv-info', track: 'adv', level: 6, title: '1099s, W-9s and backup withholding', mins: 6,
      learn: 'Information returns done right — the January deadline that trips up every small business.',
      body: [
        `<p><b>1099-NEC</b> reports nonemployee pay — $2,000 or more for payments made in 2026 ($600 before). The same law raised most <b>1099-MISC</b> thresholds (rent, prizes and similar) too — check the current IRS instructions each year. The 1099-NEC is due to contractors <i>and</i> the IRS by <b>January 31</b>; the 1099-MISC is due to recipients by January 31 and to the IRS by February 28 on paper or March 31 if e-filed.</p>`,
        `<p>Payments to <b>corporations</b> are generally exempt — but <b>attorneys</b> get 1099s whether incorporated or not. Card and payment-app payments are reported by the processor on a 1099-K instead.</p>`,
        `<p>Collect a <b>W-9</b> before the first payment. If a payee won't provide a correct taxpayer ID, the business must <b>backup withhold 24%</b> from payments. Businesses filing <b>10 or more</b> information returns in total generally must file them electronically (the IRS's free IRIS portal works).</p>`
      ],
      words: [['W-9', 'The payee\'s certified name and taxpayer ID.'], ['Backup withholding', '24% withheld when a payee doesn\'t provide a valid tax ID.'], ['Information return', 'A form reporting payments to the IRS — like a 1099.']],
      task: null,
      check: () => true,
      quiz: [
        { q: 'A client paid an incorporated law firm $4,500 in 2026. A 1099?', a: ['No — corporations are exempt', 'Yes — attorneys get 1099s even when incorporated', 'Only if paid in cash'], c: 1, why: 'Legal fees are the main exception to the corporation exemption.' },
        { q: 'A new contractor refuses to give a tax ID. The business should…', a: ['Pay them anyway with no withholding', 'Backup withhold 24% from payments', 'Treat them as an employee'], c: 1, why: 'Without a valid TIN, backup withholding at 24% applies.' }
      ]
    },
    // ---------- Module C · Professional standards ----------
    {
      id: 'adv-controls', track: 'adv', level: 7, title: 'Internal controls and fraud prevention', mins: 7,
      learn: 'Designing simple controls small businesses can actually live with — and recognizing red flags.',
      body: [
        `<p>Most small-business fraud comes from trusted insiders with too much access. Good controls make it hard to commit and easy to catch. The core idea is <b>segregation of duties</b>: no one person should be able to <i>approve</i>, <i>pay</i> and <i>record</i> the same transaction.</p>`,
        `<p>Controls that fit a small business: the owner gets bank statements directly and looks them over monthly; two approvals for payments above a set amount; new vendors and changes to vendor bank details are verified by phone using a number already on file; payroll changes are approved by the owner; and monthly reconciliations are reviewed by someone other than the preparer.</p>`,
        `<p><b>Red flags:</b> an employee who never takes vacation, vendors with only a P.O. box or matching an employee's address, round-dollar payments, duplicate invoice numbers, rising refunds or voids, payroll for someone nobody knows. If you see these, document facts and tell the owner privately.</p>`,
        `<p>Email payment scams are common: a "vendor" emails new bank details. Always verify by phone before changing any payment information.</p>`
      ],
      words: [['Segregation of duties', 'Splitting approve, pay and record between different people.'], ['Ghost employee', 'A fake person on payroll whose pay goes to a fraudster.'], ['Business email compromise', 'A scam using a fake or hacked email to redirect payments.']],
      task: null,
      check: () => true,
      quiz: [
        { q: 'A vendor emails: "We changed banks — please send payments to this new account." You…', a: ['Update it right away', 'Call the vendor at a number already on file to confirm before changing anything', 'Reply to the email to confirm'], c: 1, why: 'Replying confirms nothing if the email is fake. Verify by phone using known contact details.' },
        { q: 'Which single setup is riskiest?', a: ['One employee enters bills, approves them and signs the checks', 'The owner approves payments the bookkeeper enters', 'Two signatures over $5,000'], c: 0, why: 'One person controlling the whole cycle can create and pay fake bills without anyone seeing.' }
      ]
    },
    {
      id: 'adv-ethics', track: 'adv', level: 7, title: 'Ethics, Circular 230 and data security', mins: 7,
      learn: 'The rules that govern tax practice and the duty to protect client data.',
      body: [
        `<p>Anyone who prepares, or helps prepare, federal tax returns <b>for pay</b> needs a <b>PTIN</b> (Preparer Tax Identification Number) from the IRS. Unenrolled preparers can join the IRS's voluntary <b>Annual Filing Season Program</b>. <b>Circular 230</b> sets the rules for those who practice before the IRS — CPAs, attorneys and enrolled agents — covering due diligence, conflicts of interest and fees.</p>`,
        `<p>Tax preparers must protect taxpayer information. Federal law restricts using or sharing tax return information without the taxpayer's consent, and the FTC's Safeguards Rule requires tax preparers to keep a <b>written information security plan</b> (IRS Publication 4557 explains how). Even as a bookkeeper, follow the same habits: strong passwords and two-factor login, encrypted storage and backups, secure document sharing, and a plan for what to do if data is exposed.</p>`,
        `<p>Ethics in daily work: never backdate or hide entries to change what a lender or the IRS sees, disclose conflicts of interest, stay within your competence, and put it in writing when a client asks you to do something you won't.</p>`
      ],
      words: [['PTIN', 'The IRS number required to prepare federal returns for pay.'], ['Circular 230', 'IRS rules for practitioners who represent taxpayers.'], ['WISP', 'A written information security plan.']],
      task: null,
      check: () => true,
      quiz: [
        { q: 'You want to prepare simple Schedule C returns for clients for a fee. First you need…', a: ['Nothing', 'A PTIN from the IRS', 'A CPA license'], c: 1, why: 'Anyone preparing federal returns for pay must have a PTIN. Enrolled agent or CPA status allows representing clients before the IRS.' },
        { q: 'A client asks you to date an invoice in last year so they get the deduction sooner. You…', a: ['Do it — it\'s their business', 'Decline, explain why, and note it in writing', 'Do it but don\'t tell anyone'], c: 1, why: 'Falsifying records isn\'t a gray area. Decline and document.' }
      ]
    },
    {
      id: 'adv-path', track: 'adv', level: 7, title: 'Your path: EA, CPA and accredited programs', mins: 6,
      learn: 'Where to go next — the credentials that let you prepare returns, represent clients and grow.',
      body: [
        `<p><b>Enrolled Agent (EA)</b> — a federal credential from the IRS that lets you prepare returns <i>and</i> represent taxpayers before the IRS. No degree is required: get a PTIN, pass the three-part <b>Special Enrollment Examination</b> (Individuals; Businesses; Representation, Practices and Procedures), and pass a background check. It's the fastest route from bookkeeping into tax work.</p>`,
        `<p><b>Certified Public Accountant (CPA)</b> — a state license. In Colorado, new pathways begin January 1, 2027: a bachelor's degree plus 30 more credit hours and one year of experience, a bachelor's plus two years of experience, or a master's plus one year — all with the CPA Exam, an ethics exam, and experience verified by a CPA. Community-college accounting credits can count toward the degree.</p>`,
        `<p><b>Accredited programs</b> add college credit and an employer-recognized credential to what you've learned here. Open the recommendations to see programs near you and online, with live links.</p>`
      ],
      words: [['Enrolled Agent', 'A tax practitioner licensed by the IRS to represent taxpayers.'], ['Accreditation', 'Review by a recognized agency confirming a school meets quality standards.']],
      task: 'Open the recommended programs.',
      action: ['See recommended programs', () => App.advanced && App.advanced.programsModal()],
      check: () => !!T().flags.programs,
      quiz: [{ q: 'Which credential lets you represent clients before the IRS without a college degree?', a: ['CPA', 'Enrolled Agent', 'QuickBooks ProAdvisor'], c: 1, why: 'EAs earn the credential by passing the IRS\'s three-part exam; no degree is required.' }]
    }

  ];
  LESSONS.forEach(l => { l.level = l.level || 1; });
  const LEVELS = [
    { n: 1, title: 'Level 1 · Foundations', blurb: 'The daily work: accounts, importing, categorizing, invoices, reconciling and closing.' },
    { n: 2, title: 'Level 2 · Month-end professional', blurb: 'Debits and credits, bills, payroll, journal entries, receipts, catching mistakes and client extras.' },
    { n: 3, title: 'Level 3 · Client advisor', blurb: 'Cash flow, budgets, owner pay, business types, reading the numbers, taxes and year-end.' },
    { n: 4, title: 'Level 4 · Running your practice', blurb: 'Onboarding, pricing, engagement letters, catch-up projects, industries, ethics and security.' }
  ];
  const CORE = LESSONS.filter(l => !l.bonus && l.track !== 'adv');
  const ADV = LESSONS.filter(l => l.track === 'adv');
  const ADV_LEVELS = [
    { n: 5, title: 'Module A · Accrual accounting and the close' },
    { n: 6, title: 'Module B · Tax compliance' },
    { n: 7, title: 'Module C · Professional standards' }
  ];
  const advLevels = () => ADV_LEVELS.map(L => ({ ...L, lessons: ADV.filter(l => l.level === L.n) }));
  const levelsWithLessons = () => LEVELS.map(L => ({ ...L, lessons: CORE.filter(l => l.level === L.n) }));
  const lessonDone = l => { const t = T(); return !!t.done[l.id]; };
  const quizDone = l => l.quiz.every((q, i) => T().quiz[l.id + ':' + i] === q.c);
  const currentLesson = (track) => { const t = T(); track = track || t.track || 'pro';
    if (track === 'adv') return ADV.find(l => l.id === t.currentAdv) || ADV.find(l => !lessonDone(l)) || ADV[0];
    return LESSONS.find(l => l.id === t.current && l.track !== 'adv') || CORE.find(l => !lessonDone(l)) || LESSONS[0]; };
  // Does a non-void journal entry debit one account and credit another for these amounts?
  const jeHas = (c, drName, dr, crName, cr) => { if (!c) return false; const a = C.acctByName(c, drName), b = C.acctByName(c, crName); return !!a && !!b && (c.journals || []).some(j => !j.void && !j.reversalOf && j.lines.some(l => l.accountId === a.id && Math.abs(+l.debit - dr) < 0.005) && j.lines.some(l => l.accountId === b.id && Math.abs(+l.credit - cr) < 0.005)); };

  // Mark lessons complete when their task check and quiz both pass
  function sweep() {
    const t = T(); let newly = null;
    for (const l of LESSONS) {
      if (t.done[l.id]) continue;
      let ok = false; try { ok = l.check(); } catch (e) { }
      if (ok && quizDone(l)) { t.done[l.id] = C.todayISO(); newly = l; }
    }
    if (newly) {
      if (newly.track === 'adv') { if (!t.currentAdv || t.currentAdv === newly.id) { const next = ADV.find(l => !t.done[l.id]); t.currentAdv = next ? next.id : 'adv-exam-written'; } }
      else if (!t.current || t.current === newly.id) { const next = CORE.find(l => !t.done[l.id]); t.current = next ? next.id : 'exam-written'; }
      save(); U.toast(`Lesson complete: ${newly.title}`);
    }
    return newly;
  }

  // ------------------------------------------------------------------
  // Training screen
  // ------------------------------------------------------------------
  const TIPS = window.ACADEMY_TIPS || {};
  // Realistic time: reading plus the hands-on task, drill and quiz (rounded to 5 minutes)
  const workMins = l => Math.max(5, Math.round((l.mins + (l.task ? 10 : 0) + (l.drill ? 10 : 0) + (l.quiz || []).length * 2) / 5) * 5);
  // Typical time for the finals plus a review of the handbook before them
  const EXAM_MINS = { pro: { written: 60, practical: 120, review: 60 }, adv: { written: 75, practical: 120, review: 60 } };
  const fmtMins = m => m < 60 ? `${m} min` : `${(Math.round(m / 30) / 2).toString().replace('.5', '½')} hr${m >= 90 ? 's' : ''}`;
  const trackMins = k => { const list = k === 'adv' ? ADV : CORE, e = EXAM_MINS[k]; return list.reduce((s, l) => s + workMins(l), 0) + e.written + e.practical + e.review; };
  const leftMins = (k, wOk, pOk) => { const list = k === 'adv' ? ADV : CORE, e = EXAM_MINS[k]; return list.filter(l => !lessonDone(l)).reduce((s, l) => s + workMins(l), 0) + (wOk ? 0 : e.written + e.review) + (pOk ? 0 : e.practical); };
  const hoursLine = (k, wOk, pOk) => { const total = trackMins(k), left = leftMins(k, wOk, pOk); return `<div class="tp-hours muted">About ${fmtMins(total)} in all${left && left < total ? ` · about ${fmtMins(left)} to go` : left ? '' : ' · complete'}</div>`; };
  // One lesson's main panel (used by both programs)
  function lessonMain(l, list, levels, finalId) {
    const t = T();
    const idx = list.indexOf(l);
    let taskOk = false; try { taskOk = l.check(); } catch (e) { }
    const L = levels.find(x => x.n === l.level) || { title: '' };
    const nextId = l.bonus ? null : (idx < list.length - 1 ? list[idx + 1].id : finalId);
    const tips = TIPS[l.id] || [];
    return `
      <div class="tm-head"><span class="tag ${l.bonus ? 'gold' : l.track === 'adv' ? 'navy' : 'blue'}">${l.bonus ? 'Bonus lesson' : `${esc(L.title)} · lesson ${idx + 1} of ${list.length}`} · ${l.mins} min read · about ${fmtMins(workMins(l))} with practice</span>${lessonDone(l) ? `<span class="tag green">${ICON.check}Complete</span>` : ''}</div>
      <h2 class="tm-title">${esc(l.title)}</h2>
      <p class="tm-learn"><b>You'll learn:</b> ${esc(l.learn)}</p>
      <div class="tm-body">${l.body.join('')}</div>
      ${tips.length ? `<div class="tm-tips"><div class="cap-label">${ICON.spark}Pro tips</div><ul>${tips.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      <div class="tm-words"><div class="cap-label">Words to know</div>${l.words.map(([w, d]) => `<div class="word"><b>${esc(w)}</b><span>${esc(d)}</span></div>`).join('')}</div>
      ${l.drill ? drillHTML() : ''}
      ${l.task ? `<div class="tm-task ${taskOk ? 'ok' : ''}">
        <div class="tt-head"><span class="tick ${taskOk ? 'on' : ''}">${ICON.check}</span><div><div class="cap-label">Try it</div><b>${esc(l.task)}</b></div></div>
        <div class="tt-foot">${taskOk ? '<span class="pos">Done — nicely handled.</span>' : l.action ? `<button class="btn primary" data-action="t-do" data-id="${l.id}">${esc(l.action[0])} ${ICON.right}</button><span class="muted">The coach in the corner keeps this task in view while you work.</span>` : '<span class="muted">Do it right here on this page.</span>'}</div>
      </div>` : ''}
      <div class="tm-quiz"><div class="cap-label">Quick check</div>${l.quiz.map((q, qi) => { const key = l.id + ':' + qi, ans = t.quiz[key]; return `<div class="qz"><div class="qz-q">${esc(q.q)}</div><div class="qz-a">${q.a.map((a, ai) => `<button class="qa ${ans === ai ? (ai === q.c ? 'right' : 'wrong') : ''} ${ans != null && ai === q.c ? 'answer' : ''}" data-action="t-quiz" data-k="${key}" data-a="${ai}">${esc(a)}</button>`).join('')}</div>${ans != null ? `<div class="qz-why ${ans === q.c ? 'right' : 'wrong'}">${ans === q.c ? ICON.check + '<b>Right.</b>' : '<b>Not quite —</b>'} ${esc(q.why)}${ans !== q.c ? ' Try again.' : ''}</div>` : ''}</div>`; }).join('')}</div>
      <div class="tm-nav">${idx > 0 ? `<button class="btn ghost" data-action="t-go" data-id="${list[idx - 1].id}">${ICON.back}Previous</button>` : '<span></span>'}${nextId ? `<button class="btn ${lessonDone(l) ? 'primary' : ''}" data-action="t-go" data-id="${nextId}">${/exam/.test(nextId) ? 'On to the final exams' : 'Next lesson'} ${ICON.right}</button>` : ''}</div>`;
  }

  view('training', {
    render() {
      const t = T();
      sweep();
      const AC = App.academy, AV = App.advanced;
      const track = t.track === 'adv' && AV ? 'adv' : 'pro';
      const p = practice();
      const lvlDone = L => L.lessons.every(lessonDone);
      const proEarned = CORE.every(lessonDone) && AC.writtenPassed() && AC.practicalPassed();
      const advEarned = AV && ADV.every(lessonDone) && AV.writtenPassed() && AV.practicalPassed();
      const tabs = `<div class="seg track-seg" role="tablist"><button class="${track === 'pro' ? 'on' : ''}" data-action="t-track" data-v="pro">${proEarned ? ICON.check : ''}Professional Bookkeeping</button><button class="${track === 'adv' ? 'on' : ''}" data-action="t-track" data-v="adv">${advEarned ? ICON.check : ''}Advanced Accounting &amp; Tax</button></div>`;
      let side, main, sub;
      if (track === 'pro') {
        const levels = levelsWithLessons();
        const lessonsDone = CORE.filter(lessonDone).length, allLessons = lessonsDone === CORE.length;
        const wOk = AC.writtenPassed(), pOk = AC.practicalPassed();
        const req = CORE.length + 2, doneN = lessonsDone + (wOk ? 1 : 0) + (pOk ? 1 : 0);
        const examView = t.current === 'exam-written' || t.current === 'exam-practical';
        const cur = currentLesson('pro');
        const sideItem = (x, n) => `<button class="tl ${x.id === t.current || (!examView && x === cur) ? 'on' : ''} ${lessonDone(x) ? 'done' : ''}" data-action="t-go" data-id="${x.id}"><span class="step-n">${lessonDone(x) ? ICON.check : x.bonus ? '★' : n}</span><span><b>${esc(x.title)}</b><span class="muted">about ${fmtMins(workMins(x))}${x.bonus ? ' · bonus' : ''}</span></span></button>`;
        let n = 0;
        sub = `Four levels of hands-on lessons on a pretend bakery, then a written exam and a graded month-end. Pass both to earn the Professional Bookkeeping Certificate. Plan on about ${fmtMins(trackMins('pro'))} in all, at your own pace.`;
        side = `
          <div class="train-prog"><div class="tp-top"><b>${doneN} of ${req} steps</b><span class="muted">${Math.round(doneN / req * 100)}%</span></div><div class="progress"><div style="width:${doneN / req * 100}%"></div></div>${hoursLine('pro', wOk, pOk)}
            <div class="lvl-badges">${levels.map(L => `<span class="lvl-badge ${lvlDone(L) ? 'on' : ''}" title="${esc(L.title)}">${lvlDone(L) ? ICON.check : L.n}</span>`).join('')}<span class="lvl-badge exam ${wOk && pOk ? 'on' : ''}" title="Final exams">${wOk && pOk ? ICON.check : 'E'}</span></div></div>
          <div class="train-list">
            ${levels.map(L => `<div class="tl-group">${esc(L.title)}${lvlDone(L) ? ` <span class="tag green">${ICON.check}</span>` : ''}</div>${L.lessons.map(x => sideItem(x, ++n)).join('')}`).join('')}
            <div class="tl-group">Final exams${allLessons ? '' : ` <span class="muted" style="text-transform:none;letter-spacing:0">· after all lessons</span>`}</div>
            <button class="tl ${t.current === 'exam-written' ? 'on' : ''} ${wOk ? 'done' : ''} ${allLessons ? '' : 'locked'}" data-action="t-go" data-id="exam-written"><span class="step-n">${wOk ? ICON.check : allLessons ? 'W' : ICON.lock}</span><span><b>Written exam</b><span class="muted">30 questions · about 1 hr</span></span></button>
            <button class="tl ${t.current === 'exam-practical' ? 'on' : ''} ${pOk ? 'done' : ''} ${allLessons ? '' : 'locked'}" data-action="t-go" data-id="exam-practical"><span class="step-n">${pOk ? ICON.check : allLessons ? 'P' : ICON.lock}</span><span><b>Practical exam</b><span class="muted">A graded month-end · about 2 hrs</span></span></button>
            <div class="tl-group">Bonus</div>${LESSONS.filter(l => l.bonus).map(x => sideItem(x, 0)).join('')}
          </div>
          ${proEarned ? AC.proAdvisorCard() : ''}
          ${proEarned ? `<div class="cert-cta">${ICON.spark}<div><b>${t.cert ? 'Certificate earned' : 'You earned it!'}</b><div class="muted">${t.cert ? esc(t.cert.id) : 'Professional Bookkeeping Certificate'}</div></div><button class="btn sm gold" data-action="t-cert">${t.cert ? 'Badge & LinkedIn' : 'Get it'}</button></div>` : `<div class="cert-req"><div class="cap-label">To earn the certificate</div><div class="${allLessons ? 'ok' : ''}">${allLessons ? ICON.check : '○'} All ${CORE.length} lessons <span class="muted">(${lessonsDone} done)</span></div><div class="${wOk ? 'ok' : ''}">${wOk ? ICON.check : '○'} Written exam, 80% or better</div><div class="${pOk ? 'ok' : ''}">${pOk ? ICON.check : '○'} Practical exam, 80+ and balanced</div></div>`}`;
        if (examView) {
          main = !allLessons ? `<div class="tm-head"><span class="tag gold">Final exams</span></div><h2 class="tm-title">Finish the lessons first</h2><p class="tm-learn">The exams cover all four levels. You have ${plural(CORE.length - lessonsDone, 'lesson')} to go — the exams unlock as soon as they're done.</p><div class="tm-nav"><span></span><button class="btn primary" data-action="t-go" data-id="${(CORE.find(l => !lessonDone(l)) || CORE[0]).id}">Go to the next lesson ${ICON.right}</button></div>`
            : t.current === 'exam-written' ? AC.renderWritten() : AC.renderPractical();
        } else main = lessonMain(cur, CORE, LEVELS, 'exam-written');
      } else {
        const levels = advLevels();
        const lessonsDone = ADV.filter(lessonDone).length, allLessons = lessonsDone === ADV.length;
        const wOk = AV.writtenPassed(), pOk = AV.practicalPassed();
        const req = ADV.length + 2, doneN = lessonsDone + (wOk ? 1 : 0) + (pOk ? 1 : 0);
        const examView = /^adv-exam/.test(t.currentAdv || '');
        const cur = currentLesson('adv');
        const unlocked = allLessons && !!t.cert;
        let n = 0;
        sub = `For working bookkeepers ready to go further: accrual accounting, fixed assets, inventory, loans, payroll and sales tax compliance, business and owner taxes, internal controls and professional standards. Ends with a written exam and a graded month-end close. Plan on about ${fmtMins(trackMins('adv'))} in all.`;
        side = `
          <div class="train-prog"><div class="tp-top"><b>${doneN} of ${req} steps</b><span class="muted">${Math.round(doneN / req * 100)}%</span></div><div class="progress navy"><div style="width:${doneN / req * 100}%"></div></div>${hoursLine('adv', wOk, pOk)}
            <div class="lvl-badges">${levels.map((L, i) => `<span class="lvl-badge navy ${lvlDone(L) ? 'on' : ''}" title="${esc(L.title)}">${lvlDone(L) ? ICON.check : 'ABC'[i]}</span>`).join('')}<span class="lvl-badge exam ${wOk && pOk ? 'on' : ''}" title="Final exams">${wOk && pOk ? ICON.check : 'E'}</span></div></div>
          <div class="train-list">
            ${levels.map(L => `<div class="tl-group">${esc(L.title)}${lvlDone(L) ? ` <span class="tag green">${ICON.check}</span>` : ''}</div>${L.lessons.map(x => `<button class="tl ${!examView && x === cur ? 'on' : ''} ${lessonDone(x) ? 'done' : ''}" data-action="t-go" data-id="${x.id}"><span class="step-n">${lessonDone(x) ? ICON.check : ++n}</span><span><b>${esc(x.title)}</b><span class="muted">about ${fmtMins(workMins(x))}</span></span></button>`).join('')}`).join('')}
            <div class="tl-group">Final exams${unlocked ? '' : ` <span class="muted" style="text-transform:none;letter-spacing:0">· locked</span>`}</div>
            <button class="tl ${t.currentAdv === 'adv-exam-written' ? 'on' : ''} ${wOk ? 'done' : ''} ${unlocked ? '' : 'locked'}" data-action="t-go" data-id="adv-exam-written"><span class="step-n">${wOk ? ICON.check : unlocked ? 'W' : ICON.lock}</span><span><b>Advanced written exam</b><span class="muted">35 questions · about 1¼ hrs</span></span></button>
            <button class="tl ${t.currentAdv === 'adv-exam-practical' ? 'on' : ''} ${pOk ? 'done' : ''} ${unlocked ? '' : 'locked'}" data-action="t-go" data-id="adv-exam-practical"><span class="step-n">${pOk ? ICON.check : unlocked ? 'P' : ICON.lock}</span><span><b>Practical: month-end close</b><span class="muted">Adjusting entries · about 2 hrs</span></span></button>
          </div>
          ${advEarned ? `<div class="cert-cta navy">${ICON.spark}<div><b>${t.certAdv ? 'Certificate earned' : 'You earned it!'}</b><div class="muted">${t.certAdv ? esc(t.certAdv.id) : 'Advanced Accounting & Tax'}</div></div><button class="btn sm gold" data-action="adv-cert">${t.certAdv ? 'Badge & LinkedIn' : 'Get it'}</button></div>` : `<div class="cert-req"><div class="cap-label">To earn this certificate</div><div class="${t.cert ? 'ok' : ''}">${t.cert ? ICON.check : '○'} Professional Bookkeeping Certificate</div><div class="${allLessons ? 'ok' : ''}">${allLessons ? ICON.check : '○'} All ${ADV.length} advanced lessons <span class="muted">(${lessonsDone} done)</span></div><div class="${wOk ? 'ok' : ''}">${wOk ? ICON.check : '○'} Written exam, 80% or better</div><div class="${pOk ? 'ok' : ''}">${pOk ? ICON.check : '○'} Practical close, 80+ and closed</div></div>`}
          <div class="pa-card"><div class="pa-ic">${ICON.spark}</div><div class="grow"><b>Accredited programs</b><div class="muted">College credit, tax credentials and the CPA path.</div></div><button class="btn sm" data-action="adv-programs">See them</button></div>`;
        if (examView) {
          main = !unlocked ? `<div class="tm-head"><span class="tag navy">Final exams</span></div><h2 class="tm-title">Almost there</h2><p class="tm-learn">The advanced exams open once you've earned the Professional Bookkeeping Certificate and finished all ${ADV.length} advanced lessons${allLessons ? '' : ` (${plural(ADV.length - lessonsDone, 'lesson')} to go)`}.</p><div class="tm-nav"><span></span>${allLessons ? `<button class="btn primary" data-action="t-track" data-v="pro">Go to the Professional program ${ICON.right}</button>` : `<button class="btn primary" data-action="t-go" data-id="${(ADV.find(l => !lessonDone(l)) || ADV[0]).id}">Go to the next lesson ${ICON.right}</button>`}</div>`
            : t.currentAdv === 'adv-exam-written' ? AV.renderWritten() : AV.renderPractical();
        } else main = lessonMain(cur, ADV, ADV_LEVELS, 'adv-exam-written');
      }
      return `
        <div class="page-head">
          <div><h1>Coll Ledger Academy</h1><div class="sub">${sub}</div></div>
          <div class="actions">${p ? `<button class="btn" data-action="t-reset">${ICON.refresh}Reset practice account</button><button class="btn primary" data-action="t-open">${ICON.right}Open Bluebird Bakery</button>` : `<button class="btn primary" data-action="t-open">${ICON.spark}Create the practice account</button>`}</div>
        </div>
        ${tabs}
        <div class="train ${track === 'adv' ? 'adv' : ''}">
          <aside class="card train-side">${side}</aside>
          <article class="card train-main">${main}</article>
        </div>`;
    },
    after() {
      const el = $('#t-stmt'); const p = practice();
      if (el && p) { const s = statement(p); el.innerHTML = `<div class="stmt-bank">FIRST PRACTICE BANK</div><div class="stmt-row"><span>Bluebird Bakery LLC · Business Checking ····4821</span></div><div class="stmt-row"><span>Statement period ends</span><b>${fmtDate(s.date)}</b></div><div class="stmt-row big"><span>Ending balance</span><b>${money(s.balance)}</b></div>`; }
      else if (el) el.innerHTML = '<span class="muted">Create the practice account first.</span>';
    }
  });

  act({
    't-go': el => { const t = T(), id = el.dataset.id; const l = LESSONS.find(x => x.id === id);
      if (/^adv-exam/.test(id) || (l && l.track === 'adv')) { t.track = 'adv'; t.currentAdv = id; } else { t.track = 'pro'; t.current = id; }
      if (!/exam/.test(id)) S.ui.exam = null; save(); if (S.route.page !== 'training') go('training'); else render(); $('#view').scrollTop = 0; },
    't-track': el => { T().track = el.dataset.v; S.ui.exam = null; save(); if (S.route.page !== 'training') go('training'); else render(); $('#view').scrollTop = 0; },
    't-open': () => { const fresh = !practice(); ensurePractice(true, fresh ? 'dashboard' : 'dashboard'); if (fresh) U.toast('Bluebird Bakery is ready — the coach in the corner will guide you'); },
    't-do': el => { const l = LESSONS.find(x => x.id === el.dataset.id); if (l.track === 'adv') { T().currentAdv = l.id; T().track = 'adv'; } else T().current = l.id; T().coachHidden = false; save(); l.action[1](); },
    't-drill-check': () => { const t = T(); t.drill = t.drill || {}; $$('[data-drill]').forEach(s => { const i = s.dataset.drill; t.drill[i] = t.drill[i] || {}; t.drill[i][s.dataset.side] = s.value; }); t.drillChecked = true; save(); sweep(); render(); },
    't-quiz': el => { T().quiz[el.dataset.k] = +el.dataset.a; save(); sweep(); render(); },
    't-reset': async () => {
      const keep = await U.confirmBox({ title: 'Reset the practice account?', body: 'Bluebird Bakery goes back to how it started, so you can practice the lessons again. Your real clients are not touched. Lesson progress is kept unless you choose to start the class over in the next step.', ok: 'Reset the bakery' });
      if (!keep) return;
      S.data.clients = S.data.clients.filter(c => !c.practice);
      const again = await U.confirmBox({ title: 'Start the class over too?', body: 'Clear your lesson ticks and quiz answers as well?', ok: 'Start over', cancel: 'Keep my progress' });
      if (again) S.data.training = { done: {}, quiz: {}, flags: {} };
      const c = makePractice(); S.data.clients.push(c);
      if (S.data.activeClientId && !S.data.clients.some(x => x.id === S.data.activeClientId)) S.data.activeClientId = c.id;
      commit(); U.toast('Practice account reset');
    },
    't-cert': () => T().cert ? App.academy.credentialModal() : App.academy.certificate(levelsWithLessons()),
    't-cert-pdf': () => App.academy.certificate(levelsWithLessons()),
    't-coach-hide': () => { T().coachHidden = true; save(); coach(); },
    't-coach-show': () => { T().coachHidden = false; save(); coach(); }
  });

  // ------------------------------------------------------------------
  // The coach (bottom corner) and the practice banner
  // ------------------------------------------------------------------
  function coach() {
    let el = $('#coach');
    const c = client();
    if (!c || !c.practice || S.route.page === 'training' || !S.data.setupDone) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'coach'; document.body.appendChild(el); }
    if (c.advExam) { el.className = 'coach'; el.innerHTML = `<div class="coach-head">${ICON.spark}<b>Advanced practical</b><span class="muted">${U.fmtMonth(c.advKey.month.from)}</span></div><div class="coach-task"><span>Post the adjusting entries from the documents, fix the miscoded items, then close the month.</span></div><div class="coach-foot"><button class="btn sm primary" data-action="t-go" data-id="adv-exam-practical">Grade my work</button></div>`; return; }
    if (c.exam) { el.className = 'coach'; el.innerHTML = `<div class="coach-head">${ICON.spark}<b>Practical exam</b><span class="muted">${U.fmtMonth(c.examKey.month.from)}</span></div><div class="coach-task"><span>Categorize, apply the invoice payment, clean up, reconcile to ${money(c.examKey.statement)}, then close the month.</span></div><div class="coach-foot"><button class="btn sm primary" data-action="t-go" data-id="exam-practical">Grade my work</button></div>`; return; }
    const t = T();
    const l = currentLesson();
    let ok = false; try { ok = l.check(); } catch (e) { }
    if (t.coachHidden) { el.className = 'coach mini'; el.innerHTML = `<button data-action="t-coach-show">${ICON.spark}Coach · ${esc(l.title)}</button>`; return; }
    const needQuiz = ok && !quizDone(l);
    el.className = 'coach' + (ok ? ' ok' : '');
    el.innerHTML = `<div class="coach-head">${ICON.spark}<b>Training coach</b><span class="muted">${l.bonus ? 'Bonus' : l.track === 'adv' ? `Advanced ${ADV.indexOf(l) + 1}` : `Lesson ${CORE.indexOf(l) + 1}`}</span><button class="icon-btn" data-action="t-coach-hide" aria-label="Hide coach">${ICON.close}</button></div>
      <div class="coach-title">${esc(l.title)}</div>
      <div class="coach-task"><span class="tick ${ok ? 'on' : ''}">${ICON.check}</span><span>${esc(l.task || 'Read the lesson and answer the questions.')}</span></div>
      ${needQuiz ? '<div class="coach-note">Task done! Answer the quick check to finish the lesson.</div>' : ok ? '<div class="coach-note">Lesson complete — on to the next one.</div>' : ''}
      <div class="coach-foot"><button class="btn sm ${ok ? 'primary' : ''}" data-nav="training">${ok ? 'Back to the lesson' : 'Open the lesson'}</button></div>`;
  }
  function banner(c, page) {
    if (!c || !c.practice || page === 'training') return;
    const inner = $('#view .view-inner'); if (!inner) return;
    const b = document.createElement('div');
    b.className = 'practice-banner';
    b.innerHTML = c.advExam ? `${ICON.spark}<span><b>Advanced practical</b> — Aspen Trail Outfitters is pretend. Post the month-end adjustments, then grade your work in the Academy.</span><button class="btn sm" data-action="t-go" data-id="adv-exam-practical">Exam page</button>` : c.exam ? `${ICON.spark}<span><b>Practical exam</b> — Juniper Flower Co. is pretend. Do the month-end, then grade your work in the Academy.</span><button class="btn sm" data-action="t-go" data-id="exam-practical">Exam page</button>` : `${ICON.spark}<span><b>Practice account</b> — Bluebird Bakery is pretend. Try anything; nothing here touches a real client.</span><button class="btn sm" data-nav="training">Academy</button>`;
    inner.prepend(b);
  }
  App.hooks.push((c, page) => {
    if (c && c.practice) {
      const t = T();
      if (page === 'dashboard') t.flags.dashboard = true;
      if (page === 'reports' && S.ui.report.type === 'pl') t.flags.pl = true;
      if (page === 'reports' && S.ui.report.type === '1099') t.flags.r1099 = true;
      if (page === 'reports' && S.ui.report.type === 'health') t.flags.rHealth = true;
      if (page === 'reports' && S.ui.report.type === 'tb') t.flags.rTB = true;
      if (page === 'reports' && S.ui.report.type === 'tax') t.flags.rSalesTax = true;
      if (page === 'cleanup' && S.ui.clean && S.ui.clean.scope === 'all') t.flags.cleanAll = true;
      if (page === 'planning' && S.ui.plan && S.ui.plan.tab === 'owner') t.flags.ownerTab = true;
      sweep();
    }
    if (page === 'handbook') { T().flags.handbook = true; sweep(); }
    banner(c, page);
    coach();
  });
  document.addEventListener('change', e => { const el = e.target; if (!el.dataset || el.dataset.drill == null) return; const t = T(); t.drill = t.drill || {}; t.drill[el.dataset.drill] = t.drill[el.dataset.drill] || {}; t.drill[el.dataset.drill][el.dataset.side] = el.value; save(); });
  document.addEventListener('click', e => { if (e.target.closest('[data-action="year-end"]') && inPractice()) { T().flags.yearEnd = true; save(); setTimeout(sweep, 50); } }, true);
  document.addEventListener('click', e => { if (e.target.closest('[data-action="month-email"]') && inPractice()) { T().flags.monthEmail = true; save(); setTimeout(sweep, 50); } }, true);
  // keep the coach fresh after quick actions that don't re-render a screen
  document.addEventListener('click', () => setTimeout(() => { if (inPractice()) coach(); }, 400));
  App.practice = { workMins, trackMins, fmtMins, ensurePractice, LESSONS, CORE, ADV, advLevels, levelsWithLessons, T, sweep };
})();
