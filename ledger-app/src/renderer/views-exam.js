'use strict';
/* =====================================================================
   Coll Ledger Academy — final exams and the certificate
   - Written exam: 25 questions drawn from a 42-question bank, 80% to pass
   - Practical exam: a month-end for Juniper Flower Co. with planted
     problems, graded automatically, 80 points and a balanced
     reconciliation to pass
   - Certificate with a credential ID and a skills transcript
   ===================================================================== */
(() => {
  const { S, C, U, client, act, go, render, commit, save } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;
  const T = () => { S.data.training = S.data.training || {}; const t = S.data.training; t.done = t.done || {}; t.quiz = t.quiz || {}; t.flags = t.flags || {}; t.written = t.written || []; return t; };
  S.ui.exam = S.ui.exam || null;

  // ------------------------------------------------------------------
  // Written exam question bank  [topic, question, answers[], correct, why]
  // ------------------------------------------------------------------
  const BANK = [
    ['Basics', 'Which of these is an asset?', ['Money customers owe the business', 'A credit card balance', 'Sales tax collected from customers'], 0, 'Money customers owe (Accounts Receivable) is something the business has a right to — an asset. Card balances and collected sales tax are owed by the business — liabilities.'],
    ['Basics', 'Assets − Liabilities = ?', ['Profit', 'Equity', 'Cash'], 1, 'What the business owns minus what it owes is the owner\'s stake: equity.'],
    ['Basics', 'A business buys a $40 printer cartridge with its debit card. What changes?', ['Checking goes down $40, Office Supplies goes up $40', 'Checking goes down $40 and nothing else', 'Office Supplies goes up $40 and Sales goes down $40'], 0, 'Every entry has two sides of the same amount: the bank (asset) goes down and an expense goes up.'],
    ['Basics', 'Which report shows whether the business made money last quarter?', ['Balance Sheet', 'Profit & Loss', 'Trial Balance'], 1, 'The Profit & Loss covers a period and shows income minus expenses. The Balance Sheet is a snapshot on one date.'],
    ['Basics', 'Most very small businesses report on which basis?', ['Cash basis', 'Accrual basis', 'Tax basis only'], 0, 'Most small businesses use the cash basis — income when received, expenses when paid. Confirm with the client\'s tax preparer.'],
    ['Categorizing', 'The owner moves $2,000 from the business account to her personal account. Category?', ["Owner's Draw", 'Payroll & Wages', 'Miscellaneous Expense'], 0, 'An owner of a sole proprietorship or LLC taking money out is a draw from equity — not an expense.'],
    ['Categorizing', 'The business pays its $900 credit card bill from checking. Category?', ['Business Credit Card (a transfer)', 'Miscellaneous Expense', 'Bank & Merchant Fees'], 0, 'The purchases were recorded when they hit the card. The payment just moves money to pay down what\'s owed.'],
    ['Categorizing', 'Money moves from Business Checking to Business Savings. What is it?', ['Income', 'A transfer between the business\'s own accounts', 'An expense'], 1, 'Moving money between your own accounts changes neither income nor expenses.'],
    ['Categorizing', 'The owner puts $5,000 of personal money into the business to cover a slow month. Category?', ["Owner's Contributions", 'Sales', 'Other Income'], 0, 'Money the owner puts in raises their equity. It\'s not income — counting it as income would mean paying tax on their own money.'],
    ['Categorizing', 'A $1,200 loan payment is $1,050 principal and $150 interest. How is it recorded?', ['All $1,200 as an expense', '$1,050 to Loans Payable and $150 to interest expense', 'All $1,200 to Loans Payable'], 1, 'Principal pays down the loan (a liability). Only the interest is an expense — so split it.'],
    ['Categorizing', 'A bakery buys flour and butter. Which category is best?', ['Cost of Goods Sold', 'Office Supplies', 'Repairs & Maintenance'], 0, 'Ingredients that go into the products the business sells are cost of goods sold.'],
    ['Categorizing', 'A $3,500 commercial oven expected to last 10 years is usually recorded as…', ['A Repairs & Maintenance expense', 'A fixed asset (Equipment)', "Owner's Draw"], 1, 'Long-lasting equipment is generally a fixed asset; the tax preparer decides how to depreciate or expense it.'],
    ['Categorizing', 'A store refunds $25 to the business credit card for a returned item. The refund should…', ['Reduce the original expense category', 'Be recorded as Sales', 'Be ignored'], 0, 'A refund reverses part of the original purchase, so it goes back to that same expense category.'],
    ['Categorizing', 'A transaction you can\'t identify is in To Review. Best move?', ['Guess the closest category', 'Leave it, ask the client, and note the question', 'Delete it'], 1, 'Ask instead of guessing — a wrong guess is harder to catch later than an open question.'],
    ['Categorizing', 'Personal groceries were bought on the business card. Category?', ["Owner's Draw", 'Cost of Goods Sold', 'Meals'], 0, 'Personal spending paid with business money is a draw, never a business expense.'],
    ['Tools', 'Which situation calls for a split transaction?', ['A single Costco receipt with ingredients and cleaning supplies', 'Two separate purchases on the same day', 'A transfer to savings'], 0, 'Split when one payment covers more than one category. The split lines must add up to the total.'],
    ['Tools', 'You want every "GUSTO PAYROLL" line categorized without review. What do you set up?', ['A smart rule set to Automatic', 'A split', 'A budget'], 0, 'Automatic smart rules categorize matching lines during import so they skip To Review.'],
    ['Tools', 'You import the same bank file twice by mistake. What happens in Coll Ledger?', ['Everything doubles', 'Lines already in the books are marked "Already in" and skipped', 'The first import is replaced'], 1, 'Each line is compared with what\'s already in that account and skipped if it matches.'],
    ['Invoices & bills', 'An invoice is sent but not yet paid. Where does that money sit?', ['Accounts Receivable', 'Accounts Payable', 'Sales Tax Payable'], 0, 'Accounts Receivable is money customers owe the business.'],
    ['Invoices & bills', 'A customer pays a $500 invoice and the deposit arrives in a bank import. Correct handling?', ['Categorize the deposit as Sales', 'Apply the payment to the invoice so it isn\'t counted twice', 'Create a new invoice'], 1, 'The sale was counted when the invoice was recorded. Applying the payment clears Accounts Receivable without counting income again.'],
    ['Invoices & bills', 'A vendor bill arrives today, due in 30 days. Where does it show until paid?', ['Accounts Payable (Bills to Pay)', 'Accounts Receivable', "Owner's Draw"], 0, 'Accounts Payable tracks what the business owes vendors.'],
    ['Invoices & bills', 'An invoice is 120 days overdue and the customer has closed. Reasonable next step?', ['Keep it open forever', 'Talk with the client, then void or write it off as they decide', 'Delete the customer'], 1, 'Old invoices that won\'t be paid should be resolved with the client so receivables are real.'],
    ['Reconciling', 'The reconcile difference is $27. A smart first check?', ['Change the statement balance to match', 'Look for a $27 item unticked, a duplicate, or two digits swapped', 'Close the month anyway'], 1, 'The difference is a clue. Never change the statement to fit the books.'],
    ['Reconciling', 'A $72 check was entered as $27. The difference is $45. What does that suggest?', ['A missing deposit', 'Swapped (transposed) digits — the difference divides evenly by 9', 'A bank error'], 1, 'When two digits are swapped, the difference is always divisible by 9.'],
    ['Reconciling', 'How often should every bank and card account be reconciled?', ['Once a year', 'Every month, to each statement', 'Only when something looks wrong'], 1, 'Monthly reconciliation is how you prove the books match the bank.'],
    ['Reconciling', 'An item on the statement is missing from the books. What do you do?', ['Ignore it', 'Add (or import) the missing transaction, then tick it', 'Adjust the statement balance'], 1, 'The books must include everything the bank shows.'],
    ['Month end', 'Why lock a month after closing it?', ['To delete old transactions', 'So reported numbers can\'t change by accident', 'The IRS requires it'], 1, 'Once a client has the reports, those numbers should stay put. Coll Ledger asks before any change.'],
    ['Month end', 'What should come first at month end?', ['Send the reports', 'Get every transaction in and categorized', 'Lock the month'], 1, 'Bring everything in and clear To Review, then reconcile, clean up, review, close and send.'],
    ['Month end', 'Square deposits arrive in the bank. They should be categorized as…', ['Sales', 'A transfer from the Square account', 'Other Income'], 1, 'Sales, tax, tips and fees were recorded from Square\'s report. The deposit only moves the rest to checking.'],
    ['Taxes', 'Sales tax collected from customers belongs in…', ['Sales income', 'Sales Tax Payable (a liability)', 'Owner\'s Contributions'], 1, 'Collected sales tax is the state\'s money until it\'s paid over.'],
    ['Taxes', 'Paying the state the sales tax collected last quarter is recorded to…', ['Taxes & Licenses expense', 'Sales Tax Payable', 'Cost of Goods Sold'], 1, 'The payment clears the liability that built up as tax was collected.'],
    ['Taxes', 'Starting with payments made in 2026, a 1099-NEC is generally required for a contractor paid…', ['$600 or more', '$2,000 or more', '$10,000 or more'], 1, 'The threshold rose from $600 (through 2025) to $2,000 for payments made in 2026.'],
    ['Taxes', 'A contractor was paid only by credit card. Does the business send them a 1099-NEC for those payments?', ['Yes, always', 'No — card and payment-app payments are reported by the payment company', 'Only if over $600'], 1, 'Payments by card or apps like PayPal are reported on a 1099-K by the processor.'],
    ['Taxes', 'When are 1099-NEC forms due to contractors and the IRS?', ['January 31', 'April 15', 'March 15'], 0, 'January 31 for both.'],
    ['Taxes', 'Before paying a new contractor, you should collect…', ['A W-9', 'A W-2', 'A 1099-K'], 0, 'The W-9 gives their legal name, address and tax ID for the 1099.'],
    ['Taxes', 'Quarterly estimated tax payments are generally due…', ['Apr 15, Jun 15, Sep 15, Jan 15', 'Every month on the 15th', 'Mar 31, Jun 30, Sep 30, Dec 31'], 0, 'The four federal dates, moved to the next business day when they fall on a weekend or holiday.'],
    ['Taxes', 'Business meals with a clear business purpose are generally…', ['100% deductible', '50% deductible', 'Not deductible'], 1, 'Generally 50% — keep the receipt and note who attended and why.'],
    ['Records', 'The IRS specifically expects receipts for travel, meals, lodging and gifts at or above…', ['$25', '$75', '$500'], 1, 'At $75 and up (lodging at any amount) — Clean up flags the missing ones.'],
    ['Records', 'Generally, how long should business tax records be kept?', ['1 year', 'At least 3 years — 7 is a common safe rule', 'Forever'], 1, 'Generally 3 years after filing, longer in some cases (6 for big under-reporting, 7 for bad debts, 4 for payroll).'],
    ['Records', 'Which mileage log entry is complete enough?', ['"Drove a lot in March"', 'Date, miles and business reason for each trip', 'Only the total for the year'], 1, 'Each trip needs the date, miles and business purpose.'],
    ['Professional', 'A client asks you to sign and file their tax return. You\'re not an EA, CPA or attorney. You should…', ['Sign it — you know the numbers best', 'Refer them to a tax preparer and hand off clean books', 'File it without signing'], 1, 'Bookkeepers prepare the books; credentialed preparers handle returns and tax advice.'],
    ['Professional', 'A client offers you their online-banking password. Best practice?', ['Save it in your notes', 'Ask for read-only or accountant access instead', 'Use it once and forget it'], 1, 'Read-only access protects you and the client. Never store full passwords.']
  ];
  const DRAW = 25, PASS = 0.8;

  function shuffle(a, seed) { const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
  function newAttempt() {
    const seed = (Date.now() % 2147483646) + 1;
    // at least one question from every topic, then fill at random
    const topics = [...new Set(BANK.map(q => q[0]))];
    const idx = BANK.map((_, i) => i);
    const picked = new Set(topics.map(tp => shuffle(idx.filter(i => BANK[i][0] === tp), seed + tp.length)[0]));
    for (const i of shuffle(idx, seed)) { if (picked.size >= DRAW) break; picked.add(i); }
    const qs = shuffle([...picked], seed + 7).map(i => ({ i, order: shuffle([0, 1, 2], seed + i) }));
    return { qs, at: 0, answers: {}, started: Date.now() };
  }
  const writtenBest = () => T().written.reduce((b, w) => (!b || w.pct > b.pct ? w : b), null);
  const writtenPassed = () => T().written.some(w => w.pct >= PASS);

  function renderWritten() {
    const E = S.ui.exam && S.ui.exam.kind === 'written' ? S.ui.exam : null;
    const best = writtenBest();
    if (!E) {
      return `<div class="tm-head"><span class="tag gold">Final exam · part 1 of 2</span>${writtenPassed() ? `<span class="tag green">${ICON.check}Passed · ${Math.round(best.pct * 100)}%</span>` : ''}</div>
        <h2 class="tm-title">Written exam</h2>
        <p class="tm-learn">${DRAW} questions drawn at random from a bank of ${BANK.length}, covering every level: bookkeeping basics, categorizing, invoices and bills, reconciling, month end, taxes, records and professional practice.</p>
        <div class="exam-rules"><div><b>${DRAW}</b><span>questions</span></div><div><b>${Math.round(PASS * 100)}%</b><span>to pass (${Math.ceil(DRAW * PASS)} right)</span></div><div><b>No</b><span>time limit</span></div><div><b>New</b><span>questions each try</span></div></div>
        <p class="muted">Answers aren't shown until you finish. Take your time — the Bookkeeper's Handbook is fair game to study from before you start.</p>
        ${T().written.length ? `<div class="exam-history"><div class="cap-label">Your attempts</div>${T().written.slice(-5).reverse().map(w => `<div><span>${fmtDate(w.date)}</span><b class="${w.pct >= PASS ? 'pos' : ''}">${w.score} / ${w.total} · ${Math.round(w.pct * 100)}%</b>${w.pct >= PASS ? `<span class="tag green">Passed</span>` : '<span class="tag">Not yet</span>'}</div>`).join('')}</div>` : ''}
        <div class="tm-nav"><button class="btn ghost" data-nav="handbook">${ICON.help}Study the handbook</button><button class="btn primary" data-action="ex-start">${writtenPassed() ? 'Take it again' : 'Start the exam'} ${ICON.right}</button></div>`;
    }
    if (E.done) {
      const res = E.result;
      const missed = E.qs.filter(q => E.answers[q.i] !== BANK[q.i][3]);
      return `<div class="exam-result ${res.passed ? 'pass' : ''}"><div class="er-score">${res.score}<span>/ ${res.total}</span></div><div><h2 class="tm-title" style="margin:0">${res.passed ? 'You passed!' : 'Not quite yet'}</h2><div class="muted">${Math.round(res.pct * 100)}% · ${res.passed ? (res.pct >= 0.92 ? 'Distinction-level score.' : 'Nicely done.') : `You need ${Math.ceil(DRAW * PASS)} right to pass. Review what you missed, then try again — you'll get a fresh set of questions.`}</div></div></div>
        ${missed.length ? `<div class="cap-label" style="margin-top:18px">Review what you missed</div>${missed.map(q => { const [tp, qq, a, c, why] = BANK[q.i]; return `<div class="qz"><div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.08em">${esc(tp)}</div><div class="qz-q">${esc(qq)}</div><div class="qz-a">${q.order.map(ai => `<div class="qa ${ai === c ? 'right answer' : E.answers[q.i] === ai ? 'wrong' : ''}">${esc(a[ai])}</div>`).join('')}</div><div class="qz-why right">${ICON.check}${esc(why)}</div></div>`; }).join('')}` : '<p class="pos"><b>Perfect score.</b></p>'}
        <div class="tm-nav"><button class="btn ghost" data-action="ex-close">Back to the exam page</button>${!res.passed ? `<button class="btn primary" data-action="ex-start">Try again ${ICON.right}</button>` : `<button class="btn primary" data-action="t-go" data-id="exam-practical">On to the practical exam ${ICON.right}</button>`}</div>`;
    }
    const q = E.qs[E.at], [tp, qq, a] = BANK[q.i];
    const answered = Object.keys(E.answers).length;
    return `<div class="tm-head"><span class="tag gold">Written exam</span><span class="muted">Question ${E.at + 1} of ${E.qs.length} · ${answered} answered</span></div>
      <div class="progress" style="margin:6px 0 18px"><div style="width:${(answered / E.qs.length * 100).toFixed(1)}%"></div></div>
      <div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.08em">${esc(tp)}</div>
      <h2 class="tm-title" style="font-size:22px;line-height:1.35">${esc(qq)}</h2>
      <div class="exam-opts">${q.order.map((ai, k) => `<button class="exam-opt ${E.answers[q.i] === ai ? 'on' : ''}" data-action="ex-pick" data-a="${ai}"><span class="eo-k">${'ABC'[k]}</span><span>${esc(a[ai])}</span></button>`).join('')}</div>
      <div class="exam-dots">${E.qs.map((x, k) => `<button class="${k === E.at ? 'cur' : ''} ${E.answers[x.i] != null ? 'ans' : ''}" data-action="ex-jump" data-k="${k}" aria-label="Question ${k + 1}">${k + 1}</button>`).join('')}</div>
      <div class="tm-nav"><button class="btn ghost" data-action="ex-move" data-d="-1" ${E.at === 0 ? 'disabled' : ''}>${ICON.back}Back</button>
        ${E.at < E.qs.length - 1 ? `<button class="btn ${E.answers[q.i] != null ? 'primary' : ''}" data-action="ex-move" data-d="1">Next ${ICON.right}</button>` : `<button class="btn primary" data-action="ex-submit" ${answered < E.qs.length ? 'disabled' : ''}>Submit for grading</button>`}</div>
      ${E.at === E.qs.length - 1 && answered < E.qs.length ? `<p class="muted" style="text-align:right">${plural(E.qs.length - answered, 'question')} still unanswered — use the numbers above to jump back.</p>` : ''}`;
  }

  // ------------------------------------------------------------------
  // Practical exam — Juniper Flower Co.
  // ------------------------------------------------------------------
  const examClient = () => S.data.clients.find(c => c.exam) || null;
  const pad = n => String(n).padStart(2, '0');
  function examMonth() { const d = C.parseISO(today()); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); return { from: C.isoOf(s), to: C.isoOf(new Date(s.getFullYear(), s.getMonth() + 1, 0)) }; }
  function buildExam() {
    const M = examMonth();
    const day = n => `${M.from.slice(0, 8)}${pad(Math.min(n, +M.to.slice(8)))}`;
    const c = C.newClient({ name: 'Juniper Flower Co.', legalName: 'Juniper Flower Co. LLC', industry: 'Florist · practical exam', color: '#8A4F7D', startDate: M.from, invoicePrefix: 'J-', nextInvoice: 202, email: 'hello@juniperflowers.example', phone: '(720) 555-0144', address: '17 Bloom St\nDenver, CO 80206' });
    c.practice = true; c.exam = true; c.checklistDismissed = true;
    const A = n => C.acctByName(c, n).id;
    C.acctByName(c, 'Business Checking').opening = 8000;
    C.acctByName(c, 'Business Savings').opening = 5000;
    const K = {};
    const add = (key, date, description, amount, cat, opt = {}) => {
      const t = { id: C.uid(), date, description, payee: opt.payee || C.cleanPayee(description), amount: C.round2(amount), accountId: A(opt.account || 'Business Checking'), categoryId: cat ? A(cat) : '', memo: '', status: opt.review ? 'review' : 'posted', cleared: false, reconciled: false };
      if (opt.review) { t.categoryId = ''; t.importId = 'exam'; }
      c.transactions.push(t); if (key) K[key] = t.id; return t;
    };
    // Already categorized activity
    [2, 9, 16, 23, 30].forEach((d, i) => add(null, day(d), 'DEPOSIT - COUNTER SALES', [1480.25, 1322.4, 1610.75, 1395.1, 1544.6][i], 'Sales', { payee: 'Counter sales' }));
    add(null, day(1), 'BLOOM ST PROPERTIES RENT', -2100, 'Rent & Lease', { payee: 'Bloom St Properties' });
    add(null, day(5), 'DENVER WHOLESALE FLORIST', -688.4, 'Cost of Goods Sold', { payee: 'Denver Wholesale Florist' });
    add(null, day(15), 'GUSTO PAYROLL PPD', -2240.15, 'Payroll & Wages', { payee: 'Gusto Payroll' });
    add('xcel1', day(11), 'XCEL ENERGY ONLINE PMT', -164.22, 'Utilities', { payee: 'Xcel Energy' });
    add('xcel2', day(11), 'XCEL ENERGY ONLINE PMT', -164.22, 'Utilities', { payee: 'Xcel Energy' }); // planted duplicate
    add('check', day(13), 'CHECK #1187 GARDEN GATE SUPPLY', -128.5, 'Cost of Goods Sold', { payee: 'Garden Gate Supply' }); // planted typo: really 182.50
    add(null, day(8), 'CANVA PRO', -14.99, 'Software & Subscriptions', { account: 'Business Credit Card', payee: 'Canva' });
    add(null, day(19), 'FACEBK *ADS', -120, 'Advertising & Marketing', { account: 'Business Credit Card', payee: 'Facebook Ads' });
    // Waiting in To Review
    add('sav', day(26), 'ONLINE TRANSFER TO SAV ...7731', -2000, null, { review: true, payee: 'Transfer to savings' });
    add('draw', day(25), 'ONLINE TRANSFER TO OWNER PERSONAL', -1200, null, { review: true, payee: 'Transfer to owner' });
    add('card', day(27), 'CHASE CARD AUTOPAY', -485.2, null, { review: true, payee: 'Chase card autopay' });
    add('tax', day(20), 'COLORADO DEPT REVENUE SALES TAX', -318.4, null, { review: true, payee: 'Colorado Dept of Revenue' });
    add('teatro', day(24), 'MOBILE DEPOSIT HOTEL TEATRO', 640, null, { review: true, payee: 'Hotel Teatro' });
    add('flor', day(19), 'DENVER WHOLESALE FLORIST', -742.18, null, { review: true, payee: 'Denver Wholesale Florist' });
    add('goog', day(7), 'GOOGLE *WORKSPACE', -14.4, null, { review: true, payee: 'Google Workspace' });
    add('ins', day(10), 'STATE FARM INSURANCE', -212, null, { review: true, payee: 'State Farm' });
    add('dep', day(21), 'DEPOSIT - FARMERS MARKET SALES', 850, null, { review: true, payee: 'Farmers market sales' });
    add('gas', day(17), 'SHELL OIL 57432', -48.12, null, { review: true, payee: 'Shell' });
    // Customer and invoice
    const teatro = { id: C.uid(), kind: 'customer', name: 'Hotel Teatro', email: 'events@teatro.example', phone: '', address: '1100 14th St\nDenver, CO 80202', notes: 'Weekly lobby arrangements' };
    c.contacts.push(teatro, { id: C.uid(), kind: 'vendor', name: 'Denver Wholesale Florist', email: '', phone: '', address: '', notes: '' }, { id: C.uid(), kind: 'vendor', name: 'Garden Gate Supply', email: '', phone: '', address: '', notes: '' });
    const inv = { id: C.uid(), number: 'J-201', contactId: teatro.id, date: day(3), dueDate: day(18), status: 'sent', taxRate: 0, discount: 0, notes: 'Thank you!', lines: [{ id: C.uid(), desc: 'Lobby arrangements — 4 weeks', qty: 4, rate: 160, accountId: A('Sales') }] };
    c.invoices.push(inv); K.inv = inv.id;
    c.transactions.sort((a, b) => a.date.localeCompare(b.date));
    // The statement shows the truth: no duplicate, and check #1187 was $182.50
    const truth = 8000 + c.transactions.filter(t => t.accountId === A('Business Checking') && t.id !== K.xcel2).reduce((s, t) => s + (t.id === K.check ? -182.5 : t.amount), 0);
    c.examKey = { ...K, month: M, statement: C.round2(truth), begin: 8000 };
    return c;
  }
  function startPractical(fresh) {
    if (fresh) S.data.clients = S.data.clients.filter(c => !c.exam);
    let c = examClient();
    if (!c) { c = buildExam(); S.data.clients.push(c); T().practicalStarted = today(); }
    save();
    App.switchClient(c.id, 'review');
  }

  function grade(c) {
    const k = c.examKey, tx = id => c.transactions.find(t => t.id === id);
    const catOf = id => { const t = tx(id); return t && t.status !== 'review' ? C.acct(c, t.categoryId) : null; };
    const is = (id, name) => { const a = catOf(id); return !!a && a.name === name; };
    const typeOk = (id, type) => { const a = catOf(id); return !!a && a.type === type && !['unc_inc', 'unc_exp'].includes(a.key); };
    const inv = c.invoices.find(i => i.id === k.inv);
    const teatro = tx(k.teatro);
    const doubleCounted = c.transactions.some(t => t.status !== 'review' && Math.abs(t.amount - 640) < 0.005 && !t.invoiceId && (C.acct(c, t.categoryId) || {}).type === 'income');
    const chk = C.acctByName(c, 'Business Checking');
    const bookEnd = C.round2(C.balances(c, { to: k.month.to }).get(chk.id));
    const rec = c.reconciliations.find(r => r.accountId === chk.id && r.date >= k.month.to && Math.abs(r.ending - k.statement) < 0.005);
    const dupGone = c.transactions.filter(t => Math.abs(t.amount + 164.22) < 0.005 && /xcel/i.test(t.description)).length === 1;
    const checkT = tx(k.check) || c.transactions.find(t => /1187/.test(t.description));
    const everyday = [['flor', 'expense'], ['goog', 'expense'], ['ins', 'expense'], ['gas', 'expense'], ['dep', 'income']];
    const evOk = everyday.filter(([id, ty]) => typeOk(k[id], ty)).length;
    const items = [
      ['To Review is cleared', 5, c.transactions.filter(t => t.status === 'review').length === 0, 'Every imported line needs a category before the month can close.'],
      ['Transfer to savings → Business Savings', 10, is(k.sav, 'Business Savings'), 'Money moving between the business\'s own accounts is a transfer, not an expense.'],
      ['Transfer to the owner → Owner\'s Draw', 10, is(k.draw, "Owner's Draw"), 'The owner taking money out is a draw from equity — it doesn\'t lower profit.'],
      ['Card autopay → Business Credit Card', 10, is(k.card, 'Business Credit Card'), 'The card purchases were already expenses; the payment pays down the card.'],
      ['Sales tax payment → Sales Tax Payable', 10, is(k.tax, 'Sales Tax Payable'), 'Paying the state clears the sales tax collected — it isn\'t a new expense.'],
      ['Hotel Teatro payment applied to invoice J-201', 15, !!inv && C.invoiceState(c, inv).status === 'paid' && !doubleCounted, 'The $640 was already income on the invoice. Apply the deposit to J-201 (or record the payment on the invoice and exclude the deposit) so it isn\'t counted twice.'],
      [`Everyday items sensibly categorized (${evOk} of 5)`, 10, evOk === 5, 'Flowers → Cost of Goods Sold, Google → Software, State Farm → Insurance, Shell → Car & Truck, farmers market deposit → Sales.', evOk * 2],
      ['Duplicate Xcel Energy payment removed', 10, dupGone, 'The same $164.22 payment was in the books twice on the same day.'],
      ['Check #1187 corrected to $182.50', 10, !!checkT && Math.abs(checkT.amount + 182.5) < 0.005, 'The statement shows $182.50 — the books had the digits swapped ($128.50). A difference of $54 divides evenly by 9, the classic sign of a transposition.'],
      ['Checking reconciled to the statement', 10, !!rec && Math.abs(bookEnd - k.statement) < 0.005, `Statement ending balance ${money(k.statement)} on ${fmtDate(k.month.to)}; the books must match to the cent.`]
    ].map(([label, pts, ok, why, partial]) => ({ label, pts, ok, why, got: ok ? pts : (partial || 0) }));
    const score = items.reduce((s, x) => s + x.got, 0);
    const closed = !!c.lockDate && c.lockDate >= k.month.to;
    const reconciled = items[items.length - 1].ok;
    return { items, score, closed, reconciled, passed: score >= 80 && reconciled && closed };
  }

  function renderPractical() {
    const t = T(); const c = examClient(); const M = examMonth();
    const res = S.ui.examGrade && c ? S.ui.examGrade : null;
    const prev = t.practical;
    const brief = `<div class="exam-brief">
        <p><b>The job:</b> Juniper Flower Co. is a new client. Do ${U.fmtMonth(M.from)}'s month-end the way you would for a real client — and catch the problems a careless bookkeeper would miss.</p>
        <ol class="t-list"><li>Categorize everything in <b>To Review</b>. Watch for transfers, the owner, the credit card and sales tax.</li><li>Hotel Teatro paid invoice <b>J-201</b>. Make sure that money isn't counted twice.</li><li>Run <b>Clean up</b> for anything doubled.</li><li><b>Reconcile</b> Business Checking to the statement below — it won't balance until the books are right.</li><li><b>Close</b> ${U.fmtMonth(M.from)}.</li></ol>
        <div class="t-stmt"><div class="stmt-bank">FRONT RANGE COMMUNITY BANK</div><div class="stmt-row"><span>Juniper Flower Co. LLC · Business Checking ····2290</span></div><div class="stmt-row"><span>Statement period</span><b>${fmtDate(M.from)} – ${fmtDate(M.to)}</b></div><div class="stmt-row"><span>Beginning balance</span><b>${money(8000)}</b></div><div class="stmt-row"><span>Checks paid</span><b>#1187 · ${money(182.5)}</b></div><div class="stmt-row big"><span>Ending balance</span><b>${c && c.examKey ? money(c.examKey.statement) : '<span class="muted" style="font-weight:400">shown when you start</span>'}</b></div></div>
        <p class="muted">Graded on 10 checks worth 100 points. To pass: <b>80 points</b>, a balanced reconciliation and the month closed. All 100 earns the certificate's distinction.</p></div>`;
    return `<div class="tm-head"><span class="tag gold">Final exam · part 2 of 2</span>${prev && prev.passed ? `<span class="tag green">${ICON.check}Passed · ${prev.score}/100</span>` : ''}</div>
      <h2 class="tm-title">Practical exam: a real month-end</h2>
      ${brief}
      ${res ? `<div class="exam-result ${res.passed ? 'pass' : ''}"><div class="er-score">${res.score}<span>/ 100</span></div><div><h2 class="tm-title" style="margin:0">${res.passed ? 'You passed the practical!' : 'Not passed yet'}</h2><div class="muted">${res.passed ? (res.score === 100 ? 'A perfect month-end.' : 'Solid work.') : !res.reconciled ? 'The reconciliation has to balance to pass.' : !res.closed ? `Close ${U.fmtMonth(M.from)} once everything else is done.` : 'Fix the items marked below, then grade again.'}</div></div></div>
        <div class="grade-list">${res.items.map(x => `<div class="gl ${x.ok ? 'ok' : ''}"><span class="tick ${x.ok ? 'on' : ''}">${x.ok ? ICON.check : ICON.close}</span><div class="grow"><b>${esc(x.label)}</b>${x.ok ? '' : `<div class="muted">${esc(x.why)}</div>`}</div><span class="num">${x.got}/${x.pts}</span></div>`).join('')}
          <div class="gl ${res.closed ? 'ok' : ''}"><span class="tick ${res.closed ? 'on' : ''}">${res.closed ? ICON.check : ICON.close}</span><div class="grow"><b>${U.fmtMonth(M.from)} closed</b>${res.closed ? '' : '<div class="muted">Required to pass.</div>'}</div><span class="num">required</span></div></div>` : ''}
      <div class="tm-nav">${c ? `<button class="btn ghost" data-action="ex-prac-reset">${ICON.refresh}Start over</button><span style="flex:1"></span><button class="btn" data-action="ex-prac-open">Open Juniper Flower Co. ${ICON.right}</button><button class="btn primary" data-action="ex-prac-grade">${ICON.check}Grade my work</button>`
        : `<span></span><button class="btn primary" data-action="ex-prac-start">Start the practical exam ${ICON.right}</button>`}</div>`;
  }

  // ------------------------------------------------------------------
  // Certificate
  // ------------------------------------------------------------------
  const fnv = s => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const credId = (name, date, w, p) => { const h = fnv(`${name}|${date}|${w}|${p}`).toString(36).toUpperCase().padStart(7, '0'); return `CL-${date.slice(0, 4)}-${h.slice(0, 4)}-${h.slice(4, 7)}${(fnv(h) % 36).toString(36).toUpperCase()}`; };
  function certificate(levels) {
    const t = T();
    const best = writtenBest(), prac = t.practical;
    const m = U.openModal(`${U.modalHead('Your certificate', 'Check how your name should appear — it can\'t be changed on this certificate later')}
      <div class="modal-body"><div class="field"><label for="ce-name">Full name</label><input id="ce-name" class="input" value="${esc((t.cert && t.cert.name) || S.data.firm.owner || '')}" placeholder="Your full name"></div>
      <div class="cert-sum"><div><span>Written exam</span><b>${Math.round(best.pct * 100)}%</b></div><div><span>Practical exam</span><b>${prac.score}/100</b></div><div><span>Lessons</span><b>${levels.reduce((s, L) => s + L.lessons.length, 0)}</b></div></div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="ce-go">${ICON.pdf}Save certificate PDF</button></div>`);
    $('#ce-go', m).onclick = () => {
      const name = $('#ce-name', m).value.trim(); if (!name) return U.toast('Add your name', null, 'warn');
      const date = (t.cert && t.cert.name === name && t.cert.date) || today();
      const w = Math.round(best.pct * 100), p = prac.score;
      const distinction = w >= 92 && p === 100;
      const id = credId(name, date, w, p);
      t.cert = { name, date, id, written: w, practical: p, distinction }; save();
      U.closeModal();
      const gold = '#B8893B', green = '#1E6B53';
      const transcript = levels.map(L => `<div style="margin-bottom:16px"><div style="font-weight:700;color:${green};margin-bottom:6px">${esc(L.title)}</div>${L.lessons.map(l => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>${esc(l.title)}</span><span class="muted">${t.done[l.id] ? fmtDate(t.done[l.id]) : ''}</span></div>`).join('')}</div>`).join('');
      U.printDoc(App.docShell('Certificate', `
        <div class="page" style="height:11in;padding:0;display:flex;align-items:center;justify-content:center">
          <div style="width:7.3in;height:9.9in;border:3px solid ${green};outline:1px solid ${gold};outline-offset:-12px;display:flex;flex-direction:column;align-items:center;text-align:center;padding:64px 56px;position:relative">
            <div style="font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#6B756F">Coll Ledger Academy</div>
            <div style="width:64px;height:64px;border-radius:50%;margin:26px 0 6px;background:radial-gradient(circle at 35% 30%,#F1D79A,${gold} 60%,#8C6424);display:flex;align-items:center;justify-content:center;color:#fff;font-family:Georgia,serif;font-size:28px;box-shadow:0 0 0 4px #fff,0 0 0 5px ${gold}">C</div>
            <div class="serif" style="font-size:40px;line-height:1.15;margin:18px 0 6px;color:${green}">Professional Bookkeeping<br>Certificate</div>
            ${distinction ? `<div style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:${gold};font-weight:700;margin-top:4px">with distinction</div>` : ''}
            <div class="muted" style="font-size:14px;margin-top:26px">This certifies that</div>
            <div class="serif" style="font-size:38px;margin:12px 0 10px;padding:0 30px 10px;border-bottom:1px solid ${gold}">${esc(name)}</div>
            <div style="font-size:13.5px;max-width:5.4in;line-height:1.65;color:#4A5550">completed all three levels of the Coll Ledger Academy — Foundations, Month-End Professional and Client Advisor — and passed the written examination and a graded practical month-end close.</div>
            <div style="display:flex;gap:46px;margin-top:30px;font-size:12px;color:#6B756F">
              <div><div class="serif" style="font-size:20px;color:#16201C">${w}%</div>Written exam</div>
              <div><div class="serif" style="font-size:20px;color:#16201C">${p}/100</div>Practical exam</div>
              <div><div class="serif" style="font-size:20px;color:#16201C">${fmtDate(date)}</div>Awarded</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin:34px 0 18px;color:${gold}"><span style="width:70px;height:1px;background:${gold}"></span><span style="font-size:14px">&#9670;</span><span style="width:70px;height:1px;background:${gold}"></span></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;width:100%;font-size:11.5px;color:#4A5550;line-height:1.5">
              <div><div style="font-weight:700;color:${green};letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;margin-bottom:4px">Foundations</div>Categorizing · invoices · reconciliation · month-end close</div>
              <div><div style="font-weight:700;color:${green};letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;margin-bottom:4px">Month-end professional</div>Bills · receipts · error-finding · client reporting</div>
              <div><div style="font-weight:700;color:${green};letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;margin-bottom:4px">Client advisor</div>Cash flow · budgets · estimated taxes · 1099s</div>
            </div>
            <div style="margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#6B756F">
              <div style="text-align:left"><div style="font-family:Georgia,serif;font-size:15px;color:#16201C;border-bottom:1px solid #16201C;padding-bottom:4px;margin-bottom:4px">Coll Business Solutions LLC</div>Issuer</div>
              <div style="text-align:right"><div style="font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#16201C;margin-bottom:4px">${id}</div>Credential ID</div>
            </div>
          </div>
        </div>
        <div class="page">
          <div class="cap muted">Coll Ledger Academy · Transcript</div>
          <h1 class="serif" style="font-weight:400;font-size:28px;margin:4px 0 2px">${esc(name)}</h1>
          <div class="muted" style="margin-bottom:22px">Credential ${id} · awarded ${fmtDate(date)}${distinction ? ' · with distinction' : ''}</div>
          ${transcript}
          <div style="font-weight:700;color:${green};margin:8px 0 6px">Examinations</div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>Written examination — ${DRAW} questions from a ${BANK.length}-question bank, ${Math.round(PASS * 100)}% to pass</span><b>${w}%</b></div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>Practical examination — month-end close with planted errors, auto-graded</span><b>${p}/100</b></div>
          <p class="muted" style="margin-top:26px;font-size:11px;line-height:1.6">Skills demonstrated: double-entry fundamentals; categorizing transfers, owner activity, credit card and sales-tax payments; invoices and receivables; bills and payables; split transactions and smart rules; bank and card reconciliation, including finding duplicates and transposed amounts; receipts and record-keeping; month-end close and client reporting; cash-flow and budget review; quarterly estimated-tax planning; 1099 contractor reporting; professional practice.<br><br>This certificate is issued by Coll Business Solutions LLC for completion of its Coll Ledger training program. It is not a state license or a credential from a professional accounting body.</p>
        </div>`), `Coll Ledger Professional Bookkeeping Certificate - ${name}.pdf`);
    };
  }

  act({
    'ex-start': () => { S.ui.exam = Object.assign(newAttempt(), { kind: 'written' }); render(); $('#view').scrollTop = 0; },
    'ex-close': () => { S.ui.exam = null; render(); },
    'ex-pick': el => { const E = S.ui.exam; const q = E.qs[E.at]; E.answers[q.i] = +el.dataset.a; render(); },
    'ex-move': el => { const E = S.ui.exam; E.at = Math.max(0, Math.min(E.qs.length - 1, E.at + +el.dataset.d)); render(); },
    'ex-jump': el => { S.ui.exam.at = +el.dataset.k; render(); },
    'ex-submit': async () => {
      const E = S.ui.exam;
      if (!await U.confirmBox({ title: 'Submit your answers?', body: 'You can\'t change them after this.', ok: 'Submit' })) return;
      const score = E.qs.filter(q => E.answers[q.i] === BANK[q.i][3]).length;
      const res = { date: today(), score, total: E.qs.length, pct: score / E.qs.length, passed: score / E.qs.length >= PASS, mins: Math.round((Date.now() - E.started) / 60000) };
      T().written.push(res); save();
      E.done = true; E.result = res; render(); $('#view').scrollTop = 0;
      U.toast(res.passed ? `Passed — ${score} of ${res.total}` : `${score} of ${res.total} — review and try again`);
    },
    'ex-prac-start': () => startPractical(false),
    'ex-prac-open': () => startPractical(false),
    'ex-prac-reset': async () => { if (!await U.confirmBox({ title: 'Start the practical over?', body: 'Juniper Flower Co. goes back to the beginning.', ok: 'Start over' })) return; S.ui.examGrade = null; startPractical(true); go('training'); },
    'ex-prac-grade': () => {
      const c = examClient(); if (!c) return;
      const r = grade(c); S.ui.examGrade = r;
      const t = T();
      if (!t.practical || r.score > t.practical.score || (r.passed && !t.practical.passed)) t.practical = { score: r.score, passed: r.passed, date: today() };
      save(); render();
      U.toast(r.passed ? `Practical passed — ${r.score}/100` : `${r.score}/100 — see what's left`);
    }
  });

  App.academy = { renderWritten, renderPractical, writtenPassed, practicalPassed: () => !!(T().practical && T().practical.passed), certificate, examClient, BANK, grade, buildExam };
})();
