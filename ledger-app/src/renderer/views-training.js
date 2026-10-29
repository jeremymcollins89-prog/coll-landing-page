'use strict';
/* =====================================================================
   Coll Ledger — Practice account / Training
   A pretend bakery to practice on, eleven short lessons with plain-
   language explanations, quizzes, a coach that checks your work as you
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
  const practice = () => S.data.clients.find(c => c.practice && !c.exam) || null;
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
        const gross = C.round2(4 + r() * 30), disc = k === 0 ? -1 : 0, net = C.round2(gross + disc), tax = C.round2(net * 0.0881), tip = [0, 1, 2][k % 3];
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
  // Draws a realistic receipt for the Sunshine Packaging charge and reads it
  async function practiceReceipt() {
    T().flags.receiptTried = true; save();
    const c = P(); if (!c) return;
    const tx = c.transactions.find(x => /SUNSHINE PACKAGING/i.test(x.description));
    const d = tx ? tx.date : today();
    const cv = document.createElement('canvas'); cv.width = 520; cv.height = 760;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#111';
    const lines = ['SUNSHINE PACKAGING CO', '4410 Brighton Blvd', 'Denver CO 80216', '', `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}  10:42 AM`, '', 'BAKERY BOXES 10X10  50   42.50', 'PASTRY BAGS 500CT       31.20', 'LABEL ROLLS 2           15.65', '', 'SUBTOTAL                89.35', 'SALES TAX                6.95', 'TOTAL                   96.30', '', 'DEBIT ****4821           96.30', '', 'THANK YOU'];
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
      id: 'receipts', level: 2, title: 'Receipts and the paper trail', mins: 4,
      learn: 'Which receipts the IRS expects, and how to read one into the books in seconds.',
      body: [
        `<p>Every business expense needs proof. The bank statement shows <i>that</i> money left; the <b>receipt</b> shows <i>what it was for</i>. For travel, meals, lodging and gifts of <b>$75 or more</b>, the IRS specifically expects a receipt.</p>`,
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
      quiz: [{ q: 'The reconcile difference is $36. What\'s a likely cause?', a: ['Swapped digits — 36 divides evenly by 9', 'The bank made a mistake', 'Sales tax'], c: 0, why: 'Transposed digits always leave a difference divisible by 9 — for example $63 typed as $27.' }]
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
        `<p>Owners of sole proprietorships and LLCs don't get a paycheck — they take <b>draws</b>. Draws aren't expenses, so they don't lower profit — and the owner pays income tax on the <b>profit</b>, not on what they took.</p>`,
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
    {
      id: 'pro', level: 3, title: 'Working like a professional', mins: 4,
      learn: 'Engagement letters, access, confidentiality and knowing where your role ends.',
      body: [
        `<p>Put every client relationship in writing with an <b>engagement letter</b>: what you'll do, how often, what the client provides and by when, the fee, and what's <i>not</i> included — like tax returns.</p>`,
        `<p>Ask for <b>read-only or accountant access</b> to bank accounts — never store a client's full password. Turn on the <b>password lock</b> and <b>cloud backup</b> in Settings; the books hold private financial information.</p>`,
        `<p>Know your lane. Unless you're an EA, CPA or attorney, don't give tax advice or sign returns. Hand off clean books and let the preparer make the tax calls. The <b>Bookkeeper's Handbook</b> under Help has the rules, deadlines and checklists to keep handy.</p>`
      ],
      words: [['Engagement letter', 'A written agreement on scope, timing and fees.'], ['Read-only access', 'Permission to view accounts without moving money.']],
      task: 'Open the Bookkeeper\'s Handbook and skim the Tax rules and Deadline calendar.',
      action: ['Open the handbook', () => go('handbook')],
      check: () => !!T().flags.handbook,
      quiz: [{ q: 'A client asks you, a bookkeeper, to file their tax return. You\'re not an EA or CPA. Best answer?', a: ['File it anyway', 'Refer them to a tax preparer and send clean books', 'Tell them to skip filing'], c: 1, why: 'Bookkeepers prepare the books; credentialed preparers handle returns and tax advice.' }]
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
    }
  ];
  LESSONS.forEach(l => { l.level = l.level || 1; });
  const LEVELS = [
    { n: 1, title: 'Level 1 · Foundations', blurb: 'The daily work: accounts, importing, categorizing, invoices, reconciling and closing.' },
    { n: 2, title: 'Level 2 · Month-end professional', blurb: 'Bills, receipts, catching mistakes, troubleshooting and client extras.' },
    { n: 3, title: 'Level 3 · Client advisor', blurb: 'Cash flow, budgets, owner pay, taxes, year-end and professional practice.' }
  ];
  const CORE = LESSONS.filter(l => !l.bonus);
  const levelsWithLessons = () => LEVELS.map(L => ({ ...L, lessons: CORE.filter(l => l.level === L.n) }));
  const lessonDone = l => { const t = T(); return !!t.done[l.id]; };
  const quizDone = l => l.quiz.every((q, i) => T().quiz[l.id + ':' + i] === q.c);
  const currentLesson = () => { const t = T(); return LESSONS.find(l => l.id === t.current) || CORE.find(l => !lessonDone(l)) || LESSONS[0]; };

  // Mark lessons complete when their task check and quiz both pass
  function sweep() {
    const t = T(); let newly = null;
    for (const l of LESSONS) {
      if (t.done[l.id]) continue;
      let ok = false; try { ok = l.check(); } catch (e) { }
      if (ok && quizDone(l)) { t.done[l.id] = C.todayISO(); newly = l; }
    }
    if (newly) {
      if (!t.current || t.current === newly.id) { const next = CORE.find(l => !t.done[l.id]); t.current = next ? next.id : 'exam-written'; }
      save(); U.toast(`Lesson complete: ${newly.title}`);
    }
    return newly;
  }

  // ------------------------------------------------------------------
  // Training screen
  // ------------------------------------------------------------------
  view('training', {
    render() {
      const t = T();
      sweep();
      const AC = App.academy;
      const levels = levelsWithLessons();
      const lessonsDone = CORE.filter(lessonDone).length;
      const allLessons = lessonsDone === CORE.length;
      const wOk = AC.writtenPassed(), pOk = AC.practicalPassed();
      const req = CORE.length + 2, doneN = lessonsDone + (wOk ? 1 : 0) + (pOk ? 1 : 0);
      const earned = allLessons && wOk && pOk;
      const examView = t.current === 'exam-written' || t.current === 'exam-practical';
      const p = practice();
      const lvlDone = L => L.lessons.every(lessonDone);
      const sideItem = (x, n) => `<button class="tl ${x.id === t.current || (!examView && x === currentLesson()) ? 'on' : ''} ${lessonDone(x) ? 'done' : ''}" data-action="t-go" data-id="${x.id}"><span class="step-n">${lessonDone(x) ? ICON.check : x.bonus ? '★' : n}</span><span><b>${esc(x.title)}</b><span class="muted">${x.mins} min${x.bonus ? ' · bonus' : ''}</span></span></button>`;
      let n = 0;
      const side = `
        <div class="train-prog"><div class="tp-top"><b>${doneN} of ${req} steps</b><span class="muted">${Math.round(doneN / req * 100)}%</span></div><div class="progress"><div style="width:${doneN / req * 100}%"></div></div>
          <div class="lvl-badges">${levels.map(L => `<span class="lvl-badge ${lvlDone(L) ? 'on' : ''}" title="${esc(L.title)}">${lvlDone(L) ? ICON.check : L.n}</span>`).join('')}<span class="lvl-badge exam ${wOk && pOk ? 'on' : ''}" title="Final exams">${wOk && pOk ? ICON.check : 'E'}</span></div></div>
        <div class="train-list">
          ${levels.map(L => `<div class="tl-group">${esc(L.title)}${lvlDone(L) ? ` <span class="tag green">${ICON.check}</span>` : ''}</div>${L.lessons.map(x => sideItem(x, ++n)).join('')}`).join('')}
          <div class="tl-group">Final exams${allLessons ? '' : ` <span class="muted" style="text-transform:none;letter-spacing:0">· after all lessons</span>`}</div>
          <button class="tl ${t.current === 'exam-written' ? 'on' : ''} ${wOk ? 'done' : ''} ${allLessons ? '' : 'locked'}" data-action="t-go" data-id="exam-written"><span class="step-n">${wOk ? ICON.check : allLessons ? 'W' : ICON.lock}</span><span><b>Written exam</b><span class="muted">25 questions · 80% to pass</span></span></button>
          <button class="tl ${t.current === 'exam-practical' ? 'on' : ''} ${pOk ? 'done' : ''} ${allLessons ? '' : 'locked'}" data-action="t-go" data-id="exam-practical"><span class="step-n">${pOk ? ICON.check : allLessons ? 'P' : ICON.lock}</span><span><b>Practical exam</b><span class="muted">A graded month-end</span></span></button>
          <div class="tl-group">Bonus</div>${LESSONS.filter(l => l.bonus).map(x => sideItem(x, 0)).join('')}
        </div>
        ${earned ? `<div class="cert-cta">${ICON.spark}<div><b>${t.cert ? 'Certificate earned' : 'You earned it!'}</b><div class="muted">${t.cert ? esc(t.cert.id) : 'Professional Bookkeeping Certificate'}</div></div><button class="btn sm gold" data-action="t-cert">${t.cert ? 'Download' : 'Get it'}</button></div>` : `<div class="cert-req"><div class="cap-label">To earn the certificate</div><div class="${allLessons ? 'ok' : ''}">${allLessons ? ICON.check : '○'} All ${CORE.length} lessons <span class="muted">(${lessonsDone} done)</span></div><div class="${wOk ? 'ok' : ''}">${wOk ? ICON.check : '○'} Written exam, 80% or better</div><div class="${pOk ? 'ok' : ''}">${pOk ? ICON.check : '○'} Practical exam, 80+ and balanced</div></div>`}`;
      let main;
      if (examView) {
        main = !allLessons ? `<div class="tm-head"><span class="tag gold">Final exams</span></div><h2 class="tm-title">Finish the lessons first</h2><p class="tm-learn">The exams cover all three levels. You have ${plural(CORE.length - lessonsDone, 'lesson')} to go — the exams unlock as soon as they're done.</p><div class="tm-nav"><span></span><button class="btn primary" data-action="t-go" data-id="${(CORE.find(l => !lessonDone(l)) || CORE[0]).id}">Go to the next lesson ${ICON.right}</button></div>`
          : t.current === 'exam-written' ? AC.renderWritten() : AC.renderPractical();
      } else {
        const l = currentLesson();
        const idx = CORE.indexOf(l);
        let taskOk = false; try { taskOk = l.check(); } catch (e) { }
        const L = LEVELS.find(x => x.n === l.level);
        const nextId = l.bonus ? null : (idx < CORE.length - 1 ? CORE[idx + 1].id : 'exam-written');
        main = `
            <div class="tm-head"><span class="tag ${l.bonus ? 'gold' : 'blue'}">${l.bonus ? 'Bonus lesson' : `${esc(L.title)} · lesson ${idx + 1} of ${CORE.length}`} · about ${l.mins} minutes</span>${lessonDone(l) ? `<span class="tag green">${ICON.check}Complete</span>` : ''}</div>
            <h2 class="tm-title">${esc(l.title)}</h2>
            <p class="tm-learn"><b>You'll learn:</b> ${esc(l.learn)}</p>
            <div class="tm-body">${l.body.join('')}</div>
            <div class="tm-words"><div class="cap-label">Words to know</div>${l.words.map(([w, d]) => `<div class="word"><b>${esc(w)}</b><span>${esc(d)}</span></div>`).join('')}</div>
            <div class="tm-task ${taskOk ? 'ok' : ''}">
              <div class="tt-head"><span class="tick ${taskOk ? 'on' : ''}">${ICON.check}</span><div><div class="cap-label">Try it</div><b>${esc(l.task)}</b></div></div>
              <div class="tt-foot">${taskOk ? '<span class="pos">Done — nicely handled.</span>' : `<button class="btn primary" data-action="t-do" data-id="${l.id}">${esc(l.action[0])} ${ICON.right}</button><span class="muted">The coach in the corner keeps this task in view while you work.</span>`}</div>
            </div>
            <div class="tm-quiz"><div class="cap-label">Quick check</div>${l.quiz.map((q, qi) => { const key = l.id + ':' + qi, ans = t.quiz[key]; return `<div class="qz"><div class="qz-q">${esc(q.q)}</div><div class="qz-a">${q.a.map((a, ai) => `<button class="qa ${ans === ai ? (ai === q.c ? 'right' : 'wrong') : ''} ${ans != null && ai === q.c ? 'answer' : ''}" data-action="t-quiz" data-k="${key}" data-a="${ai}">${esc(a)}</button>`).join('')}</div>${ans != null ? `<div class="qz-why ${ans === q.c ? 'right' : 'wrong'}">${ans === q.c ? ICON.check + '<b>Right.</b>' : '<b>Not quite —</b>'} ${esc(q.why)}${ans !== q.c ? ' Try again.' : ''}</div>` : ''}</div>`; }).join('')}</div>
            <div class="tm-nav">${idx > 0 ? `<button class="btn ghost" data-action="t-go" data-id="${CORE[idx - 1].id}">${ICON.back}Previous</button>` : '<span></span>'}${nextId ? `<button class="btn ${lessonDone(l) ? 'primary' : ''}" data-action="t-go" data-id="${nextId}">${nextId === 'exam-written' ? 'On to the final exams' : 'Next lesson'} ${ICON.right}</button>` : ''}</div>`;
      }
      return `
        <div class="page-head">
          <div><h1>Coll Ledger Academy</h1><div class="sub">Three levels of hands-on lessons on a pretend bakery, then a written exam and a graded month-end. Pass both to earn the Professional Bookkeeping Certificate.</div></div>
          <div class="actions">${p ? `<button class="btn" data-action="t-reset">${ICON.refresh}Reset practice account</button><button class="btn primary" data-action="t-open">${ICON.right}Open Bluebird Bakery</button>` : `<button class="btn primary" data-action="t-open">${ICON.spark}Create the practice account</button>`}</div>
        </div>
        <div class="train">
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
    't-go': el => { T().current = el.dataset.id; if (!/^exam/.test(el.dataset.id)) S.ui.exam = null; save(); if (S.route.page !== 'training') go('training'); else render(); $('#view').scrollTop = 0; },
    't-open': () => { const fresh = !practice(); ensurePractice(true, fresh ? 'dashboard' : 'dashboard'); if (fresh) U.toast('Bluebird Bakery is ready — the coach in the corner will guide you'); },
    't-do': el => { const l = LESSONS.find(x => x.id === el.dataset.id); T().current = l.id; T().coachHidden = false; save(); l.action[1](); },
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
    't-cert': () => App.academy.certificate(levelsWithLessons()),
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
    if (c.exam) { el.className = 'coach'; el.innerHTML = `<div class="coach-head">${ICON.spark}<b>Practical exam</b><span class="muted">${U.fmtMonth(c.examKey.month.from)}</span></div><div class="coach-task"><span>Categorize, apply the invoice payment, clean up, reconcile to ${money(c.examKey.statement)}, then close the month.</span></div><div class="coach-foot"><button class="btn sm primary" data-action="t-go" data-id="exam-practical">Grade my work</button></div>`; return; }
    const t = T();
    const l = currentLesson();
    let ok = false; try { ok = l.check(); } catch (e) { }
    if (t.coachHidden) { el.className = 'coach mini'; el.innerHTML = `<button data-action="t-coach-show">${ICON.spark}Coach · ${esc(l.title)}</button>`; return; }
    const needQuiz = ok && !quizDone(l);
    el.className = 'coach' + (ok ? ' ok' : '');
    el.innerHTML = `<div class="coach-head">${ICON.spark}<b>Training coach</b><span class="muted">${l.bonus ? 'Bonus' : `Lesson ${LESSONS.indexOf(l) + 1}`}</span><button class="icon-btn" data-action="t-coach-hide" aria-label="Hide coach">${ICON.close}</button></div>
      <div class="coach-title">${esc(l.title)}</div>
      <div class="coach-task"><span class="tick ${ok ? 'on' : ''}">${ICON.check}</span><span>${esc(l.task)}</span></div>
      ${needQuiz ? '<div class="coach-note">Task done! Answer the quick check to finish the lesson.</div>' : ok ? '<div class="coach-note">Lesson complete — on to the next one.</div>' : ''}
      <div class="coach-foot"><button class="btn sm ${ok ? 'primary' : ''}" data-nav="training">${ok ? 'Back to the lesson' : 'Open the lesson'}</button></div>`;
  }
  function banner(c, page) {
    if (!c || !c.practice || page === 'training') return;
    const inner = $('#view .view-inner'); if (!inner) return;
    const b = document.createElement('div');
    b.className = 'practice-banner';
    b.innerHTML = c.exam ? `${ICON.spark}<span><b>Practical exam</b> — Juniper Flower Co. is pretend. Do the month-end, then grade your work in the Academy.</span><button class="btn sm" data-action="t-go" data-id="exam-practical">Exam page</button>` : `${ICON.spark}<span><b>Practice account</b> — Bluebird Bakery is pretend. Try anything; nothing here touches a real client.</span><button class="btn sm" data-nav="training">Academy</button>`;
    inner.prepend(b);
  }
  App.hooks.push((c, page) => {
    if (c && c.practice) {
      const t = T();
      if (page === 'dashboard') t.flags.dashboard = true;
      if (page === 'reports' && S.ui.report.type === 'pl') t.flags.pl = true;
      if (page === 'reports' && S.ui.report.type === '1099') t.flags.r1099 = true;
      if (page === 'planning' && S.ui.plan && S.ui.plan.tab === 'owner') t.flags.ownerTab = true;
      sweep();
    }
    if (page === 'handbook') { T().flags.handbook = true; sweep(); }
    banner(c, page);
    coach();
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-action="month-email"]') && inPractice()) { T().flags.monthEmail = true; save(); setTimeout(sweep, 50); } }, true);
  // keep the coach fresh after quick actions that don't re-render a screen
  document.addEventListener('click', () => setTimeout(() => { if (inPractice()) coach(); }, 400));
  App.practice = { ensurePractice, LESSONS, CORE };
})();
