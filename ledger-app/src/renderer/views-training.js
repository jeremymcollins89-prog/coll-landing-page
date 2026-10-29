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
  const practice = () => S.data.clients.find(c => c.practice) || null;
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
        `<p>When the payment arrives, open the invoice and click <b>Record payment</b>. That moves the money into the bank and clears what the customer owes. <b>Don't</b> also categorize that deposit as Sales — the income was already counted on the invoice, so it would count twice. (If the deposit came in through a bank import, exclude it.)</p>`,
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
  const CORE = LESSONS.filter(l => !l.bonus);
  const lessonDone = l => { const t = T(); return !!t.done[l.id]; };
  const quizDone = l => l.quiz.every((q, i) => T().quiz[l.id + ':' + i] === q.c);
  const currentLesson = () => { const t = T(); return LESSONS.find(l => l.id === t.current) || LESSONS.find(l => !lessonDone(l)) || LESSONS[0]; };

  // Mark lessons complete when their task check and quiz both pass
  function sweep() {
    const t = T(); let newly = null;
    for (const l of LESSONS) {
      if (t.done[l.id]) continue;
      let ok = false; try { ok = l.check(); } catch (e) { }
      if (ok && quizDone(l)) { t.done[l.id] = C.todayISO(); newly = l; }
    }
    if (newly) {
      if (!t.current || t.current === newly.id) { const next = LESSONS.find(l => !t.done[l.id]); if (next) t.current = next.id; }
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
      const l = currentLesson();
      const idx = LESSONS.indexOf(l);
      const doneN = CORE.filter(lessonDone).length;
      const allDone = doneN === CORE.length;
      let taskOk = false; try { taskOk = l.check(); } catch (e) { }
      const p = practice();
      return `
        <div class="page-head">
          <div><h1>Practice / Training</h1><div class="sub">A mini class on a pretend bakery. Read, try it in the practice account, answer a quick question — the coach ticks each lesson off as you go.</div></div>
          <div class="actions">${p ? `<button class="btn" data-action="t-reset">${ICON.refresh}Reset practice account</button><button class="btn primary" data-action="t-open">${ICON.right}Open Bluebird Bakery</button>` : `<button class="btn primary" data-action="t-open">${ICON.spark}Create the practice account</button>`}</div>
        </div>
        <div class="train">
          <aside class="card train-side">
            <div class="train-prog"><div class="tp-top"><b>${doneN} of ${CORE.length} lessons</b><span class="muted">${Math.round(doneN / CORE.length * 100)}%</span></div><div class="progress"><div style="width:${doneN / CORE.length * 100}%"></div></div></div>
            <div class="train-list">${LESSONS.map((x, i) => `<button class="tl ${x === l ? 'on' : ''} ${lessonDone(x) ? 'done' : ''}" data-action="t-go" data-id="${x.id}"><span class="step-n">${lessonDone(x) ? ICON.check : x.bonus ? '★' : i + 1}</span><span><b>${esc(x.title)}</b><span class="muted">${x.mins} min${x.bonus ? ' · bonus' : ''}</span></span></button>`).join('')}</div>
            ${allDone ? `<div class="cert-cta">${ICON.spark}<div><b>Class complete!</b><div class="muted">Download your certificate.</div></div><button class="btn sm gold" data-action="t-cert">Certificate</button></div>` : ''}
          </aside>
          <article class="card train-main">
            <div class="tm-head"><span class="tag ${l.bonus ? 'gold' : 'blue'}">${l.bonus ? 'Bonus lesson' : `Lesson ${idx + 1} of ${CORE.length}`} · about ${l.mins} minutes</span>${lessonDone(l) ? `<span class="tag green">${ICON.check}Complete</span>` : ''}</div>
            <h2 class="tm-title">${esc(l.title)}</h2>
            <p class="tm-learn"><b>You'll learn:</b> ${esc(l.learn)}</p>
            <div class="tm-body">${l.body.join('')}</div>
            <div class="tm-words"><div class="cap-label">Words to know</div>${l.words.map(([w, d]) => `<div class="word"><b>${esc(w)}</b><span>${esc(d)}</span></div>`).join('')}</div>
            <div class="tm-task ${taskOk ? 'ok' : ''}">
              <div class="tt-head"><span class="tick ${taskOk ? 'on' : ''}">${ICON.check}</span><div><div class="cap-label">Try it</div><b>${esc(l.task)}</b></div></div>
              <div class="tt-foot">${taskOk ? '<span class="pos">Done — nicely handled.</span>' : `<button class="btn primary" data-action="t-do" data-id="${l.id}">${esc(l.action[0])} ${ICON.right}</button><span class="muted">The coach in the corner keeps this task in view while you work.</span>`}</div>
            </div>
            <div class="tm-quiz"><div class="cap-label">Quick check</div>${l.quiz.map((q, qi) => { const key = l.id + ':' + qi, ans = t.quiz[key]; return `<div class="qz"><div class="qz-q">${esc(q.q)}</div><div class="qz-a">${q.a.map((a, ai) => `<button class="qa ${ans === ai ? (ai === q.c ? 'right' : 'wrong') : ''} ${ans != null && ai === q.c ? 'answer' : ''}" data-action="t-quiz" data-k="${key}" data-a="${ai}">${esc(a)}</button>`).join('')}</div>${ans != null ? `<div class="qz-why ${ans === q.c ? 'right' : 'wrong'}">${ans === q.c ? ICON.check + '<b>Right.</b>' : '<b>Not quite —</b>'} ${esc(q.why)}${ans !== q.c ? ' Try again.' : ''}</div>` : ''}</div>`; }).join('')}</div>
            <div class="tm-nav">${idx > 0 ? `<button class="btn ghost" data-action="t-go" data-id="${LESSONS[idx - 1].id}">${ICON.back}Previous</button>` : '<span></span>'}${idx < LESSONS.length - 1 ? `<button class="btn ${lessonDone(l) ? 'primary' : ''}" data-action="t-go" data-id="${LESSONS[idx + 1].id}">Next lesson ${ICON.right}</button>` : ''}</div>
          </article>
        </div>`;
    },
    after() {
      const el = $('#t-stmt'); const p = practice();
      if (el && p) { const s = statement(p); el.innerHTML = `<div class="stmt-bank">FIRST PRACTICE BANK</div><div class="stmt-row"><span>Bluebird Bakery LLC · Business Checking ····4821</span></div><div class="stmt-row"><span>Statement period ends</span><b>${fmtDate(s.date)}</b></div><div class="stmt-row big"><span>Ending balance</span><b>${money(s.balance)}</b></div>`; }
      else if (el) el.innerHTML = '<span class="muted">Create the practice account first.</span>';
    }
  });

  act({
    't-go': el => { T().current = el.dataset.id; save(); render(); $('#view').scrollTop = 0; },
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
    't-cert': () => {
      const f = S.data.firm, name = f.owner || 'Bookkeeper';
      U.printDoc(App.docShell('Certificate', `<div class="page" style="height:11in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:14px solid #1E6B53;outline:2px solid #B8893B;outline-offset:-24px">
        <div style="font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#6B756F">Coll Ledger Training</div>
        <div class="serif" style="font-size:48px;margin:24px 0 8px;color:#1E6B53">Certificate of Completion</div>
        <div class="muted" style="font-size:15px">This certifies that</div>
        <div class="serif" style="font-size:40px;margin:16px 0;border-bottom:1px solid #B8893B;padding:0 40px 10px">${esc(name)}</div>
        <div style="font-size:15px;max-width:520px;line-height:1.6;color:#4A5550">completed the Coll Ledger bookkeeping class: categorizing, smart rules, splits, invoices and receivables, bank reconciliation, Square sales, reports and month-end close.</div>
        <div style="margin-top:50px;display:flex;gap:80px;font-size:12px;color:#6B756F"><div><div class="serif" style="font-size:16px;color:#16201C">${fmtDate(C.todayISO())}</div>Date</div><div><div class="serif" style="font-size:16px;color:#16201C">${esc(f.name || 'Coll Ledger')}</div>Studio</div></div>
        <div style="margin-top:60px;font-size:11px;color:#9AA39E">Coll Business Solutions LLC</div></div>`), `Coll Ledger certificate - ${name}.pdf`);
    },
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
    b.innerHTML = `${ICON.spark}<span><b>Practice account</b> — Bluebird Bakery is pretend. Try anything; nothing here touches a real client.</span><button class="btn sm" data-nav="training">Training</button>`;
    inner.prepend(b);
  }
  App.hooks.push((c, page) => {
    if (c && c.practice) {
      const t = T();
      if (page === 'dashboard') t.flags.dashboard = true;
      if (page === 'reports' && S.ui.report.type === 'pl') t.flags.pl = true;
      sweep();
    }
    banner(c, page);
    coach();
  });
  // keep the coach fresh after quick actions that don't re-render a screen
  document.addEventListener('click', () => setTimeout(() => { if (inPractice()) coach(); }, 400));
  App.practice = { ensurePractice, LESSONS };
})();
