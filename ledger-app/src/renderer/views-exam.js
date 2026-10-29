'use strict';
/* =====================================================================
   Coll Ledger Academy — final exams and the certificate
   - Written exam: 30 questions drawn from a 67-question bank, 80% to pass
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
    ['Basics', 'Which of these is an asset?', ['Money customers owe the business', 'A credit card balance', 'Sales tax collected from customers'], 0, 'An asset is something the business owns or has a right to receive. Money customers owe (Accounts Receivable) is a right to be paid, so it\'s an asset. A card balance and collected sales tax are amounts the business owes — liabilities.'],
    ['Basics', 'Assets − Liabilities = ?', ['Profit', 'Equity', 'Cash'], 1, 'The accounting equation is Assets = Liabilities + Equity, so what the business owns minus what it owes is the owner\'s stake: equity. Profit is different — it\'s income minus expenses for a period.'],
    ['Basics', 'A business buys a $40 printer cartridge with its debit card. What changes?', ['Business Checking goes down $40 and Office Supplies goes up $40', 'Business Checking goes down $40 and nothing else', 'Office Supplies goes up $40 and Sales goes down $40'], 0, 'Every entry has two sides of equal amounts. The bank (an asset) goes down $40 and an expense, Office Supplies, goes up $40. Sales isn\'t involved — nothing was sold.'],
    ['Basics', 'Which report shows whether the business made money last quarter?', ['Balance Sheet', 'Profit & Loss', 'Trial Balance'], 1, 'The Profit & Loss covers a period and shows income minus expenses — the profit or loss. The Balance Sheet is a snapshot on one date, and the Trial Balance lists account balances to prove debits equal credits.'],
    ['Basics', 'Most very small businesses keep their books on which basis?', ['Cash basis', 'Accrual basis', 'Tax basis only'], 0, 'Cash basis records income when it\'s received and expenses when they\'re paid. It\'s the simplest, so most very small businesses use it. Confirm the basis with the client\'s tax preparer.'],
    ['Categorizing', 'The owner moves $2,000 from the business account to her personal account. Category?', ["Owner's Draw", 'Payroll & Wages', 'Miscellaneous Expense'], 0, 'In a sole proprietorship, or an LLC that isn\'t taxed as a corporation, money the owner takes out is a draw from equity. It isn\'t an expense, so it doesn\'t lower profit.'],
    ['Categorizing', 'The business pays its $900 credit card bill from checking. Category?', ['Business Credit Card (a transfer)', 'Miscellaneous Expense', 'Bank & Merchant Fees'], 0, 'Paying the card bill pays down a liability. The purchases were already recorded as expenses when they hit the card, so recording the payment as an expense would count them twice.'],
    ['Categorizing', 'Money moves from Business Checking to Business Savings. What is it?', ['Income', 'A transfer between the business\'s own accounts', 'An expense'], 1, 'Moving money between the business\'s own accounts is a transfer. It changes neither income nor expenses — the money just sits in a different account.'],
    ['Categorizing', 'The owner puts $5,000 of personal money into the business to cover a slow month. Category?', ["Owner's Contributions", 'Sales', 'Other Income'], 0, 'Money the owner puts in raises their equity, so it goes to Owner\'s Contributions. It isn\'t income — recording it as income would mean paying tax on their own money.'],
    ['Categorizing', 'A $1,200 loan payment is $1,050 principal and $150 interest. How is it recorded?', ['All $1,200 to Interest Expense', '$1,050 to Loans Payable and $150 to Interest Expense', 'All $1,200 to Loans Payable'], 1, 'Split every loan payment into principal and interest. Principal pays down Loans Payable (a liability); only the interest is an expense. $1,050 + $150 = $1,200.'],
    ['Categorizing', 'A bakery buys flour and butter. Which category is best?', ['Cost of Goods Sold', 'Office Supplies', 'Repairs & Maintenance'], 0, 'Ingredients that go into the products a business sells are Cost of Goods Sold. Flour and butter become the bread on the shelf.'],
    ['Categorizing', 'A $3,500 commercial oven expected to last 10 years is usually recorded as…', ['A Repairs & Maintenance expense', 'A fixed asset (Equipment & Vehicles)', "Owner's Draw"], 1, 'Equipment that lasts more than a year is generally a fixed asset, not an expense — and $3,500 is above the $2,500-per-item de minimis safe harbor. The tax preparer decides how to depreciate or expense it.'],
    ['Categorizing', 'A store refunds $25 to the business credit card for a returned item. The refund should…', ['Reduce the original expense category', 'Be recorded as Sales', 'Be ignored'], 0, 'A refund reverses part of the original purchase, so record it to the same expense category the purchase used. That lowers the expense by $25. It isn\'t Sales — the business didn\'t sell anything.'],
    ['Categorizing', 'A transaction you can\'t identify is in To Review. Best move?', ['Guess the closest category', 'Leave it, ask the client, and note the question', 'Delete it'], 1, 'When you can\'t identify a transaction, ask — don\'t guess. A wrong guess hides in the reports, while an open question gets answered. Never delete a real bank transaction.'],
    ['Categorizing', 'Personal groceries were bought on the business card. Category?', ["Owner's Draw", 'Cost of Goods Sold', 'Meals'], 0, 'Personal spending paid with business money is an Owner\'s Draw, never a business expense. It lowers the owner\'s equity, not the business\'s profit.'],
    ['Tools', 'Which situation calls for a split transaction?', ['A single Costco receipt with ingredients and cleaning supplies', 'Two separate purchases on the same day', 'A transfer to savings'], 0, 'Split a transaction when one payment covers more than one category. The split lines must add up to the payment total.'],
    ['Tools', 'You want every "GUSTO PAYROLL" line categorized without review. What do you set up?', ['A smart rule set to Automatic', 'A split', 'A budget'], 0, 'A smart rule set to Automatic categorizes matching lines during import, so they skip To Review. A split divides one transaction; a budget sets spending targets.'],
    ['Tools', 'You import the same bank file twice by mistake. What happens in Coll Ledger?', ['Everything doubles', 'Lines already in the books are marked "Already in" and skipped', 'The first import is replaced'], 1, 'Coll Ledger compares each imported line with what\'s already in that account. Lines that match are marked "Already in" and skipped, so nothing doubles.'],
    ['Invoices & bills', 'An invoice is sent but not yet paid. Where does that money sit?', ['Accounts Receivable', 'Accounts Payable', 'Sales Tax Payable'], 0, 'An unpaid invoice is money the customer owes the business, so it sits in Accounts Receivable (an asset) until it\'s paid. Accounts Payable is the opposite: what the business owes vendors.'],
    ['Invoices & bills', 'A customer pays a $500 invoice and the deposit arrives in a bank import. Correct handling?', ['Categorize the deposit as Sales', 'Apply the payment to the invoice so it isn\'t counted twice', 'Create a new invoice'], 1, 'The sale was counted when the invoice was recorded. Applying the deposit to the invoice clears Accounts Receivable without recording the $500 as income a second time.'],
    ['Invoices & bills', 'A vendor bill arrives today, due in 30 days. Where does it show until paid?', ['Accounts Payable (Bills to Pay)', 'Accounts Receivable', "Owner's Draw"], 0, 'An unpaid vendor bill is money the business owes, so it sits in Accounts Payable (Bills to Pay), a liability, until it\'s paid.'],
    ['Invoices & bills', 'An invoice is 120 days overdue and the customer has closed. Reasonable next step?', ['Keep it open forever', 'Talk with the client, then void or write it off as they decide', 'Delete the customer'], 1, 'Receivables should show only money the business can actually collect. Talk with the client, then void or write off the invoice as they decide — it\'s their call, and deleting records erases history.'],
    ['Reconciling', 'The reconcile difference is $27. A smart first check?', ['Change the statement balance to match', 'Look for a $27 item unticked, a duplicate, or two digits swapped', 'Close the month anyway'], 1, 'The difference is a clue, so work it. Look for a $27 item you haven\'t ticked, a duplicate, or two digits swapped. Never change the statement balance to fit the books.'],
    ['Reconciling', 'A $72 check was entered as $27. The difference is $45. What does that suggest?', ['A missing deposit', 'Swapped (transposed) digits — the difference divides evenly by 9', 'A bank error'], 1, 'When two digits are swapped, the difference always divides evenly by 9. Here $72 − $27 = $45, and 45 ÷ 9 = 5 — a classic transposition.'],
    ['Reconciling', 'How often should every bank and card account be reconciled?', ['Once a year', 'Every month, to each statement', 'Only when something looks wrong'], 1, 'Reconcile every bank and card account every month, to each statement. It\'s how you prove the books match the bank, and it catches errors while they\'re small.'],
    ['Reconciling', 'An item on the statement is missing from the books. What do you do?', ['Ignore it', 'Add (or import) the missing transaction, then tick it', 'Adjust the statement balance'], 1, 'The books must include everything the bank shows. Add or import the missing transaction, categorize it, then tick it.'],
    ['Month end', 'Why lock a month after closing it?', ['To delete old transactions', 'So reported numbers can\'t change by accident', 'The IRS requires it'], 1, 'Locking protects numbers the client has already seen. Nothing is deleted, and Coll Ledger asks before any change to a locked month. It\'s good practice, not an IRS rule.'],
    ['Month end', 'What should come first at month end?', ['Send the reports', 'Get every transaction in and categorized', 'Lock the month'], 1, 'Month end runs in order: get every transaction in and clear To Review, then reconcile, clean up, review, close and send. Reports and locking come last.'],
    ['Month end', 'Square deposits arrive in the bank. They should be categorized as…', ['Sales', 'A transfer from the Square account', 'Other Income'], 1, 'Sales, sales tax, tips and fees are recorded from Square\'s own report. The bank deposit only moves what\'s left to checking, so it\'s a transfer — calling it Sales would count the sales twice.'],
    ['Taxes', 'Sales tax collected from customers belongs in…', ['Sales income', 'Sales Tax Payable (a liability)', 'Owner\'s Contributions'], 1, 'Collected sales tax is the state\'s money, not the business\'s income. It sits in Sales Tax Payable, a liability, until it\'s paid over.'],
    ['Taxes', 'Paying the state the sales tax collected last quarter is recorded to…', ['Taxes & Licenses', 'Sales Tax Payable', 'Cost of Goods Sold'], 1, 'The payment clears the liability that built up as tax was collected, so it goes to Sales Tax Payable. Recording it to Taxes & Licenses would create an expense that isn\'t real.'],
    ['Taxes', 'Starting with payments made in 2026, a 1099-NEC is generally required for a contractor paid…', ['$600 or more', '$2,000 or more', '$10,000 or more'], 1, 'For payments made in 2026, the 1099-NEC threshold is $2,000. It was $600 for payments through 2025.'],
    ['Taxes', 'A contractor was paid only by credit card. Does the business send them a 1099-NEC for those payments?', ['Yes, always', 'No — card and payment-app payments are reported by the payment company', 'Only if paid $2,000 or more'], 1, 'Payments by credit card or through apps like PayPal are reported by the payment company on Form 1099-K. The business doesn\'t also file a 1099-NEC for them, whatever the amount.'],
    ['Taxes', 'When are 1099-NEC forms due to contractors and the IRS?', ['January 31', 'April 15', 'March 15'], 0, 'Form 1099-NEC is due January 31 — both the contractor\'s copy and the IRS copy. Collect W-9s early so January isn\'t a scramble.'],
    ['Taxes', 'Before paying a new contractor, you should collect…', ['A W-9', 'A W-2', 'A 1099-K'], 0, 'Collect a Form W-9 before the first payment. It gives the contractor\'s legal name, address and taxpayer ID — everything the 1099 needs. A W-2 is for employees; a 1099-K comes from payment companies.'],
    ['Taxes', 'Quarterly estimated tax payments are generally due…', ['April 15, June 15, September 15 and January 15', 'The 15th of every month', 'March 31, June 30, September 30 and December 31'], 0, 'Federal estimated taxes are due April 15, June 15, September 15 and January 15 of the next year. A date that falls on a weekend or holiday moves to the next business day.'],
    ['Taxes', 'Business meals with a clear business purpose are generally…', ['100% deductible', '50% deductible', 'Not deductible'], 1, 'Business meals are generally 50% deductible. Keep the receipt and note who attended and the business purpose.'],
    ['Records', 'The IRS specifically expects receipts for travel, meals, lodging and gifts at or above…', ['$25', '$75', '$500'], 1, 'The IRS expects a receipt for travel, meal and gift expenses of $75 or more, and for lodging at any amount. Clean up flags the missing ones.'],
    ['Records', 'Generally, how long should business tax records be kept?', ['1 year', 'At least 3 years — 7 is a common safe rule', 'Forever'], 1, 'Keep most records at least 3 years after filing. Some need longer: 4 years for employment tax records, 6 if income was underreported by more than 25%, and 7 for a bad-debt or worthless-securities deduction.'],
    ['Records', 'Which mileage log entry is complete enough?', ['"Drove a lot in March"', 'Date, miles and business reason for each trip', 'Only the total for the year'], 1, 'A mileage log needs the date, miles and business purpose of each trip, recorded at the time. Totals and rough notes won\'t hold up if the IRS asks.'],
    ['Professional', 'A client asks you to sign and file their tax return. You\'re not an EA, CPA or attorney. You should…', ['Sign it — you know the numbers best', 'Refer them to a tax preparer and hand off clean books', 'File it without signing'], 1, 'Bookkeepers prepare the books; tax preparers prepare and sign returns. Refer the client to a tax preparer and hand off clean books — filing an unsigned return you prepared isn\'t a workaround.'],
    ['Professional', 'A client offers you their online-banking password. Best practice?', ['Save it in your notes', 'Ask for read-only or accountant access instead', 'Use it once and forget it'], 1, 'Ask for read-only or accountant access instead. It protects you and the client, and it keeps you out of any question about who moved money. Never store a client\'s full login.'],
    ['Debits & credits', 'Which accounts increase with a debit?', ['Assets and expenses', 'Liabilities and income', 'Equity and income'], 0, 'Debits increase assets, expenses and owner\'s draws. Credits increase liabilities, equity and income.'],
    ['Debits & credits', 'A $600 invoice is sent to a customer. The entry is…', ['Dr Sales, Cr Accounts Receivable', 'Dr Accounts Receivable, Cr Sales', 'Dr Business Checking, Cr Sales'], 1, 'Sending an invoice creates a right to be paid and earns income: debit Accounts Receivable $600 (asset up) and credit Sales $600 (income up). No cash has moved, so Business Checking isn\'t touched.'],
    ['Debits & credits', 'Supplies bought on the business credit card: which side is the card?', ['Debit — the card balance goes down', 'Credit — what the business owes goes up', 'Neither'], 1, 'The card is a liability, and liabilities increase with a credit. So credit the card and debit the supplies expense for the same amount.'],
    ['Debits & credits', 'In every entry, total debits must…', ['Be larger than credits', 'Equal total credits', 'Equal zero'], 1, 'In double-entry bookkeeping, every entry\'s total debits equal its total credits. That\'s why the Balance Sheet balances.'],
    ['Debits & credits', 'Paying $300 of loan principal from checking is…', ['Dr Loans Payable, Cr Business Checking', 'Dr Interest Expense, Cr Business Checking', 'Dr Business Checking, Cr Loans Payable'], 0, 'Paying principal shrinks the loan: debit Loans Payable $300 (liability down) and credit Business Checking $300 (cash down). Interest Expense is only for the interest part of a payment.'],
    ['Payroll', 'A payroll withdrawal covers net pay, employee withholdings and employer taxes. What goes to Payroll & Wages?', ['Net pay only', 'Gross wages (net pay plus employee withholdings)', 'The whole withdrawal'], 1, 'Payroll & Wages gets gross wages — net pay plus the employees\' withholdings — because that\'s what the employees earned. The employer\'s own taxes go to Payroll Taxes, so split the withdrawal.'],
    ['Payroll', 'The employer\'s share of Social Security and Medicare is…', ['Withheld from the employee', 'A business expense — Payroll Taxes', 'Owner\'s Draw'], 1, 'The employer pays its own matching share of Social Security and Medicare on top of what\'s withheld from the employee. It\'s a business expense, recorded to Payroll Taxes.'],
    ['Payroll', 'A client wants to pay a full-time worker as a "contractor" to avoid payroll. Your response?', ['Set it up — it\'s simpler', 'Explain the misclassification risk and refer them to their CPA or payroll provider', 'Pay them through Owner\'s Draw'], 1, 'Employee or contractor depends on the working relationship — mainly who controls how the work is done — not on the client\'s preference. Misclassification brings back taxes and penalties.'],
    ['Journal entries', 'The CPA sends adjusting entries after year end. You should…', ['Post them exactly as written so the books match the return', 'Round them to the nearest hundred dollars', 'Ignore them once the return is filed'], 0, 'Post the CPA\'s adjusting entries exactly as written, on the dates given. Your books should agree with the filed return, or next year starts from the wrong numbers.'],
    ['Journal entries', 'Monthly depreciation is recorded as…', ['Dr Depreciation Expense, Cr Accumulated Depreciation', 'Dr Equipment & Vehicles, Cr Business Checking', 'Dr Accumulated Depreciation, Cr Business Checking'], 0, 'Depreciation spreads an asset\'s cost over its useful life: debit Depreciation Expense, credit Accumulated Depreciation. No cash moves, and the accumulated balance reduces the asset\'s book value.'],
    ['Journal entries', 'Why set an accrual to reverse automatically next month?', ['So the expense isn\'t counted twice when the real bill is paid', 'To delete it', 'Because the IRS requires it'], 0, 'An accrual records an expense before the bill is paid. Reversing it on the first day of next month cancels it, so when the real bill is recorded, the expense counts only once.'],
    ['Journal entries', 'A $1,200 one-year insurance policy is paid in January. On a monthly-accrual basis, each month…', ['Expense $1,200 in January', 'Move $100 from Prepaid Expenses to Insurance', 'Nothing until December'], 1, 'Prepaid costs are expensed over the months they cover. $1,200 ÷ 12 = $100, so each month debit Insurance $100 and credit Prepaid Expenses $100.'],
    ['Business types', 'A sole proprietor\'s income tax is based on…', ['The owner\'s draws', 'The business\'s profit', 'Gross sales'], 1, 'A sole proprietor is taxed on the business\'s profit, whether or not the money is taken out. Draws don\'t change the tax, and gross sales are taxed only after expenses come off.'],
    ['Business types', 'An S-corp owner who works in the business should be paid…', ['Only through draws', 'A reasonable salary through payroll, then distributions', 'Only dividends'], 1, 'An S-corp owner who works in the business must take a reasonable salary through payroll. Distributions can come on top of that, but they can\'t replace it.'],
    ['Business types', 'A client says "we\'re an LLC." The most useful follow-up question is…', ['How do you file — Schedule C, 1065 or 1120-S?', 'When was it formed?', 'Who is your bank?'], 0, 'An LLC can be taxed several ways — for example as a sole proprietorship (Schedule C), a partnership (Form 1065) or an S corporation (Form 1120-S). The return type tells you how to record owner pay and equity.'],
    ['Advising', 'Sales $80,000, cost of goods sold $32,000. Gross margin?', ['40%', '60%', '32%'], 1, 'Gross margin is the share of sales left after cost of goods sold: ($80,000 − $32,000) ÷ $80,000 = 60%.'],
    ['Advising', 'Profit is up but cash is falling. Two usual causes?', ['Slow-paying customers and owner draws above profit', 'Too many reports', 'Low sales tax'], 0, 'Profit and cash split apart when money is tied up or taken out. Check receivables (slow-paying customers) and owner draws first, then loan principal payments and inventory.'],
    ['Advising', 'A cash cushion of 0.5 months means…', ['Cash covers about two weeks of normal spending', 'The business has half its sales in cash', 'Nothing to worry about'], 0, 'Cash cushion is cash in the bank divided by average monthly spending. Half a month is about two weeks — and less than one month is a warning sign.'],
    ['Practice', 'Which belongs in an engagement letter?', ['Services, client responsibilities, exclusions, fees and how to end it', 'Only the fee', 'The client\'s passwords'], 0, 'A clear engagement letter lists the services, the client\'s responsibilities, what\'s excluded, the fees and how either side can end the work. It prevents most client problems before they start.'],
    ['Practice', 'A client is eight months behind. How do you price the catch-up?', ['Free', 'A separate project fee, paid before starting', 'Add it to next month'], 1, 'Catch-up work is a separate project: quote it, collect payment, then do it. That way you never carry months of unpaid hours.'],
    ['Practice', 'During a catch-up, March won\'t reconcile. You should…', ['Move on and fix it at the end', 'Find the difference before starting April', 'Plug it to Miscellaneous Expense'], 1, 'Each month\'s ending balance is the next month\'s beginning balance. If March is wrong, April can\'t reconcile either, so find the difference before you move on.'],
    ['Practice', 'You find signs an employee is stealing from your client. You…', ['Confront the employee', 'Document it and tell the owner privately', 'Fix the books and stay quiet'], 1, 'Document what you found and report the facts privately to the owner. Don\'t investigate, confront or accuse anyone yourself — the owner decides what happens next.'],
    ['Practice', 'Before taking on clients, which protects your own business?', ['Errors & omissions insurance and a signed engagement letter', 'A bigger monitor', 'Lower prices'], 0, 'Errors & omissions (E&O) insurance covers you if a mistake costs a client money, and a signed engagement letter sets the scope. Together they\'re the basics of a professional practice.'],
    ['Practice', 'Gift cards a salon sold but customers haven\'t used yet are…', ['Income when sold', 'A liability until used', 'Owner\'s Contributions'], 1, 'An unused gift card means the salon still owes services, so the money is a liability. It becomes income when the customer redeems the card.'],
    ['Practice', 'A Shopify store\'s payouts arrive minus fees. Record…', ['Only the payouts as sales', 'Full sales and fees from the platform report; payouts are transfers', 'Fees as Owner\'s Draw'], 1, 'Same as Square: record gross sales and fees from Shopify\'s report, then treat each payout as a transfer to the bank. Recording only the payouts understates both sales and fees.']
  ];
  const DRAW = 30, PASS = 0.8;

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
        <div class="exam-rules"><div><b>${DRAW}</b><span>questions</span></div><div><b>${Math.round(PASS * 100)}%</b><span>to pass (${Math.ceil(DRAW * PASS)} right)</span></div><div><b>~1 hr</b><span>typical · no time limit</span></div><div><b>New</b><span>questions each try</span></div></div>
        <p class="muted">Answers aren't shown until you finish. Take your time — the Bookkeeper's Handbook is fair game to study from before you start.</p>
        ${T().written.length ? `<div class="exam-history"><div class="cap-label">Your attempts</div>${T().written.slice(-5).reverse().map(w => `<div><span>${fmtDate(w.date)}</span><b class="${w.pct >= PASS ? 'pos' : ''}">${w.score} / ${w.total} · ${Math.round(w.pct * 100)}%</b>${w.pct >= PASS ? `<span class="tag green">Passed</span>` : '<span class="tag">Not yet</span>'}</div>`).join('')}</div>` : ''}
        ${App.examRulesNote ? App.examRulesNote('written') : ''}
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
    // last month's sales tax and card statement, paid off this month
    C.acctByName(c, 'Sales Tax Payable').opening = 318.4;
    C.acctByName(c, 'Business Credit Card').opening = 350.21;
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
    add('payroll', day(15), 'GUSTO PAYROLL PPD', -3182.4, 'Payroll & Wages', { payee: 'Gusto Payroll' }); // to split: 2,950.00 wages + 232.40 employer taxes
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
    const pay = tx(k.payroll), ptax = C.acctByName(c, 'Payroll Taxes'), pwag = C.acctByName(c, 'Payroll & Wages');
    const payOk = !!pay && Array.isArray(pay.splits) && pay.splits.some(sp => ptax && sp.categoryId === ptax.id && Math.abs(Math.abs(sp.amount) - 232.4) < 0.005) && pay.splits.some(sp => pwag && sp.categoryId === pwag.id && Math.abs(Math.abs(sp.amount) - 2950) < 0.005);
    const dep = C.acctByName(c, 'Depreciation Expense'), adep = C.acctByName(c, 'Accumulated Depreciation');
    const ajeOk = !!dep && !!adep && (c.journals || []).some(j => !j.void && j.date <= k.month.to && j.date >= k.month.from && j.lines.some(l => l.accountId === dep.id && Math.abs(+l.debit - 175) < 0.005) && j.lines.some(l => l.accountId === adep.id && Math.abs(+l.credit - 175) < 0.005));
    const items = [
      ['To Review is cleared', 4, c.transactions.filter(t => t.status === 'review').length === 0, 'Every imported line needs a category before the month can close. Open To Review and categorize each line still waiting there.'],
      ['Transfer to savings → Business Savings', 8, is(k.sav, 'Business Savings'), 'Categorize the $2,000.00 "ONLINE TRANSFER TO SAV ...7731" to Business Savings. Money moving between the business\'s own accounts is a transfer, not an expense.'],
      ['Transfer to the owner → Owner\'s Draw', 8, is(k.draw, "Owner's Draw"), 'Categorize the $1,200.00 "ONLINE TRANSFER TO OWNER PERSONAL" to Owner\'s Draw. Money the owner takes out is a draw from equity — it doesn\'t lower profit.'],
      ['Card autopay → Business Credit Card', 8, is(k.card, 'Business Credit Card'), 'Categorize the $485.20 "CHASE CARD AUTOPAY" to Business Credit Card. The card purchases were already recorded as expenses; the payment just pays down the card.'],
      ['Sales tax payment → Sales Tax Payable', 8, is(k.tax, 'Sales Tax Payable'), 'Categorize the $318.40 Colorado Dept of Revenue payment to Sales Tax Payable. It pays over last month\'s collected tax, clearing the $318.40 liability — it isn\'t a new expense.'],
      ['Hotel Teatro payment applied to invoice J-201', 12, !!inv && C.invoiceState(c, inv).status === 'paid' && !doubleCounted, 'Invoice J-201 already counted the $640.00 as income (4 × $160 = $640). Apply the Hotel Teatro deposit to J-201 — or record the payment on the invoice and exclude the deposit — so the income isn\'t counted twice.'],
      [`Everyday items sensibly categorized (${evOk} of 5)`, 10, evOk === 5, 'Denver Wholesale Florist $742.18 → Cost of Goods Sold; Google Workspace $14.40 → Software & Subscriptions; State Farm $212.00 → Insurance; Shell $48.12 → Car & Truck; farmers market deposit $850.00 → Sales.', evOk * 2],
      ['Duplicate Xcel Energy payment removed', 8, dupGone, 'The same $164.22 Xcel Energy payment was in the books twice on the same day, but the statement shows it once. Delete one of the two.'],
      ['Check #1187 corrected to $182.50', 8, !!checkT && Math.abs(checkT.amount + 182.5) < 0.005, 'Edit check #1187 from $128.50 to $182.50 to match the statement. The digits were swapped: $182.50 − $128.50 = $54, and 54 ÷ 9 = 6 — a difference that divides evenly by 9 is the classic sign of a transposition.'],
      ['Payroll split: $2,950.00 wages and $232.40 payroll taxes', 8, payOk, 'Split the $3,182.40 Gusto withdrawal the way the payroll report reads: $2,950.00 gross wages to Payroll & Wages and $232.40 employer taxes to Payroll Taxes ($2,950.00 + $232.40 = $3,182.40).'],
      ['CPA\'s adjusting entry posted (depreciation $175)', 8, ajeOk, 'Post AJE #1 as a journal entry dated the last day of the month: debit Depreciation Expense $175.00, credit Accumulated Depreciation $175.00.'],
      ['Checking reconciled to the statement', 10, !!rec && Math.abs(bookEnd - k.statement) < 0.005, `Reconcile Business Checking to the statement ending balance of ${money(k.statement)} on ${fmtDate(k.month.to)}. The books must match to the cent — fix the items above first, then tick every cleared line.`]
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
        <ol class="t-list"><li>Categorize everything in <b>To Review</b>. Watch for transfers, the owner, the credit card and sales tax.</li><li>Hotel Teatro paid invoice <b>J-201</b>. Make sure that money isn't counted twice.</li><li>Split the <b>Gusto payroll</b> from the payroll report: gross wages <b>$2,950.00</b>, employer taxes <b>$232.40</b> (total $3,182.40).</li><li>Post the CPA's <b>AJE #1</b>: depreciation of <b>$175.00</b> for the month (debit Depreciation Expense, credit Accumulated Depreciation), dated the last day of the month.</li><li>Run <b>Clean up</b> to catch anything entered twice.</li><li><b>Reconcile</b> Business Checking to the statement below — it won't balance until the books are right.</li><li><b>Close</b> ${U.fmtMonth(M.from)}.</li></ol>
        <div class="t-stmt"><div class="stmt-bank">FRONT RANGE COMMUNITY BANK</div><div class="stmt-row"><span>Juniper Flower Co. LLC · Business Checking ····2290</span></div><div class="stmt-row"><span>Statement period</span><b>${fmtDate(M.from)} – ${fmtDate(M.to)}</b></div><div class="stmt-row"><span>Beginning balance</span><b>${money(8000)}</b></div><div class="stmt-row"><span>Checks paid</span><b>#1187 · ${money(182.5)}</b></div><div class="stmt-row big"><span>Ending balance</span><b>${c && c.examKey ? money(c.examKey.statement) : '<span class="muted" style="font-weight:400">shown when you start</span>'}</b></div></div>
        <p class="muted">Plan on about 2 hours. Graded on 12 checks worth 100 points. To pass: <b>80 points</b>, a balanced reconciliation and the month closed. A perfect 100, plus 92% or better on the written exam, earns the certificate's distinction.</p></div>`;
    return `<div class="tm-head"><span class="tag gold">Final exam · part 2 of 2</span>${prev && prev.passed ? `<span class="tag green">${ICON.check}Passed · ${prev.score}/100</span>` : ''}</div>
      <h2 class="tm-title">Practical exam: a real month-end</h2>
      ${brief}
      ${res ? `<div class="exam-result ${res.passed ? 'pass' : ''}"><div class="er-score">${res.score}<span>/ 100</span></div><div><h2 class="tm-title" style="margin:0">${res.passed ? 'You passed the practical!' : 'Not passed yet'}</h2><div class="muted">${res.passed ? (res.score === 100 ? 'A perfect month-end.' : 'Solid work.') : !res.reconciled ? 'The reconciliation has to balance to pass.' : !res.closed ? `Close ${U.fmtMonth(M.from)} once everything else is done.` : 'Fix the items marked below, then grade again.'}</div></div></div>
        <div class="grade-list">${res.items.map(x => `<div class="gl ${x.ok ? 'ok' : ''}"><span class="tick ${x.ok ? 'on' : ''}">${x.ok ? ICON.check : ICON.close}</span><div class="grow"><b>${esc(x.label)}</b>${x.ok ? '' : `<div class="muted">${res.passed ? esc(x.why) : 'Not right yet. Recheck the source documents and the lesson on this topic — the full answer key appears once you pass.'}</div>`}</div><span class="num">${x.got}/${x.pts}</span></div>`).join('')}
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
            <div style="font-size:13.5px;max-width:5.4in;line-height:1.65;color:#4A5550">completed all four levels of the Coll Ledger Academy — Foundations, Month-End Professional, Client Advisor and Running a Practice — and passed the written examination and a graded practical month-end close.</div>
            <div style="display:flex;gap:46px;margin-top:30px;font-size:12px;color:#6B756F">
              <div><div class="serif" style="font-size:20px;color:#16201C">${w}%</div>Written exam</div>
              <div><div class="serif" style="font-size:20px;color:#16201C">${p}/100</div>Practical exam</div>
              <div><div class="serif" style="font-size:20px;color:#16201C">${fmtDate(date)}</div>Awarded</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin:34px 0 18px;color:${gold}"><span style="width:70px;height:1px;background:${gold}"></span><span style="font-size:14px">&#9670;</span><span style="width:70px;height:1px;background:${gold}"></span></div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 26px;width:100%;font-size:11.5px;color:#4A5550;line-height:1.5;text-align:left">
              <div><div style="font-weight:700;color:${green};letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;margin-bottom:4px">Foundations</div>Categorizing · invoices · reconciliation · month-end close</div>
              <div><div style="font-weight:700;color:${green};letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;margin-bottom:4px">Month-end professional</div>Debits & credits · payroll · journal entries · error-finding</div>
              <div><div style="font-weight:700;color:${green};letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;margin-bottom:4px">Client advisor</div>Cash flow · budgets · estimated taxes · 1099s</div>
              <div><div style="font-weight:700;color:${green};letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;margin-bottom:4px">Running a practice</div>Onboarding · pricing · engagement letters · ethics</div>
            </div>
            <div style="margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#6B756F">
              <div style="text-align:left"><div style="font-family:Georgia,serif;font-size:15px;color:#16201C;border-bottom:1px solid #16201C;padding-bottom:4px;margin-bottom:4px">Coll Business Solutions LLC</div>Issuer</div>
              <div style="text-align:right"><div style="font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#16201C;margin-bottom:4px">${id}</div>Credential ID · verify at collbusinesssolutions.com/verify</div>
            </div>
          </div>
        </div>
        <div class="page">
          <div class="cap muted">Coll Ledger Academy · Transcript</div>
          <h1 class="serif" style="font-weight:400;font-size:28px;margin:4px 0 2px">${esc(name)}</h1>
          <div class="muted" style="margin-bottom:22px">Credential ${id} · awarded ${fmtDate(date)}${distinction ? ' · with distinction' : ''} · about ${App.practice.fmtMins(App.practice.trackMins('pro'))} of coursework and exams</div>
          ${transcript}
          <div style="font-weight:700;color:${green};margin:8px 0 6px">Examinations</div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>Written examination — ${DRAW} questions from a ${BANK.length}-question bank, ${Math.round(PASS * 100)}% to pass</span><b>${w}%</b></div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>Practical examination — month-end close with planted errors, auto-graded</span><b>${p}/100</b></div>
          <p class="muted" style="margin-top:26px;font-size:11px;line-height:1.6">Skills demonstrated: double-entry fundamentals and debit/credit entries; payroll recording; journal and adjusting entries; categorizing transfers, owner activity, credit card and sales-tax payments; invoices and receivables; bills and payables; split transactions and smart rules; bank and card reconciliation, including finding duplicates and transposed amounts; receipts and record-keeping; month-end close and client reporting; cash-flow and budget review; quarterly estimated-tax planning; business types and owner compensation; financial-health analysis; 1099 contractor reporting; client onboarding, pricing and engagement letters; catch-up projects; ethics and data security.<br><br>This certificate is issued by Coll Business Solutions LLC for completion of its Coll Ledger training program. It is not a state license or a credential from a professional accounting body.</p>
        </div>`), `Coll Ledger Professional Bookkeeping Certificate - ${name}.pdf`);
      setTimeout(credentialModal, 600);
    };
  }



  // ------------------------------------------------------------------
  // Next step after the Academy: QuickBooks ProAdvisor certification
  // (links and benefits from Intuit's own pages, checked October 2026)
  // ------------------------------------------------------------------
  const QB = {
    signup: 'https://quickbooks.intuit.com/accountants/pricing/',
    academy: 'https://proadvisoracademy.intuit.com',
    program: 'https://quickbooks.intuit.com/accountants/proadvisor/',
    cert: 'https://quickbooks.intuit.com/accountants/training-certification/certification/',
    directory: 'https://quickbooks.intuit.com/learn-support/en-us/help-article/proadvisor-program/learn-proadvisor-profile-find-proadvisor/L5Ipn6a0q_US_en_US'
  };
  const openLink = url => window.desktop ? window.desktop.openExternal(url) : window.open(url, '_blank');
  function proAdvisorModal() {
    const m = U.openModal(`${U.modalHead('Your next step: QuickBooks ProAdvisor', 'You know how bookkeeping works — now add the credential small businesses search for')}
      <div class="modal-body">
        <div class="pa-hero"><div class="pa-ic">${ICON.spark}</div><div><b>Why it's worth it</b><div class="muted">The Coll Ledger Academy proves you can do the work. The QuickBooks Online certification is the name clients and firms already recognize — and it unlocks a way for new clients to find you.</div></div></div>
        <div class="pa-reasons">
          <div><b>Get found by new clients</b><span>Intuit's <i>Find-a-ProAdvisor</i> directory is where small businesses look for QuickBooks help. You need a current QuickBooks Online certification to publish a profile there — with your services, industries, and client reviews and ratings.</span></div>
          <div><b>A name people already know</b><span>Many of the businesses you'll meet already run on QuickBooks. Being certified means you can take them on as they are, or move them to Coll Ledger — your choice, not a limit.</span></div>
          <div><b>Badges for your profiles</b><span>Intuit gives certified ProAdvisors badges to show on websites, directories and social profiles — right next to your Coll Ledger badge on LinkedIn.</span></div>
          <div><b>Discounts you can pass on</b><span>ProAdvisors get client discounts on QuickBooks Online, QuickBooks Payments, Bill Pay, and checks and tax forms.</span></div>
          <div><b>Free training that keeps going</b><span>ProAdvisor Academy courses, more certifications (like advisory) and CPE credits. Program tiers — Silver to Elite — add perks like premium support as you grow.</span></div>
          <div><b>Stronger résumé and rates</b><span>Two credentials — hands-on bookkeeping from the Academy plus QuickBooks certification — make it easier to win clients, apply at firms, and charge professional rates.</span></div>
        </div>
        <div class="cap-label" style="margin-top:16px">How to start — about an afternoon of study</div>
        <div class="cred-steps">
          <div class="cred-step"><span class="n">1</span><div class="grow"><b>Create a free QuickBooks Online Accountant account</b><div class="muted">It comes with a free ProAdvisor Program membership.</div></div><button class="btn primary" data-q="signup">Sign up free</button></div>
          <div class="cred-step"><span class="n">2</span><div class="grow"><b>Take the QuickBooks Online Certification in ProAdvisor Academy</b><div class="muted">Study the course modules, then take the exam.</div></div><button class="btn" data-q="academy">ProAdvisor Academy</button></div>
          <div class="cred-step"><span class="n">3</span><div class="grow"><b>Publish your Find-a-ProAdvisor profile</b><div class="muted">Add your services, industries and both credentials. Intuit reviews each profile before it goes live.</div></div><button class="btn" data-q="directory">How it works</button></div>
          <div class="cred-step"><span class="n">4</span><div class="grow"><b>Add it to LinkedIn next to your Coll Ledger certificate</b><div class="muted">Certification renews once a year — Intuit sends a reminder.</div></div><button class="btn ghost" data-q="program">About the program</button></div>
        </div>
        <p class="muted" style="font-size:11.5px;margin:12px 0 0">Benefits and steps are from Intuit's ProAdvisor pages as of October 2026; Intuit notes that additional terms and fees may apply to some services. Coll Ledger and Coll Business Solutions LLC aren't affiliated with Intuit.</p>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Maybe later</button><button class="btn primary" data-q="signup">Sign up free ${ICON.right}</button></div>`, { wide: true });
    $$('[data-q]', m).forEach(b => b.onclick = () => { T().proAdvisorOpened = today(); save(); openLink(QB[b.dataset.q]); });
  }
  App.proAdvisorModal = proAdvisorModal;
  const proAdvisorCard = () => `<div class="pa-card"><div class="pa-ic">${ICON.spark}</div><div class="grow"><b>Next step: QuickBooks ProAdvisor</b><div class="muted">Get listed where small businesses look for help.</div></div><button class="btn sm primary" data-action="pa-open">See why</button></div>`;
  // ------------------------------------------------------------------
  // Digital badge, LinkedIn, and the public verification link
  // ------------------------------------------------------------------
  const VERIFY = 'https://collbusinesssolutions.com/verify.html';
  const ISSUER = 'Coll Business Solutions LLC';
  const CRED_NAME = 'Coll Ledger Professional Bookkeeping Certificate';
  const verifyUrl = id => `${VERIFY}?id=${encodeURIComponent(id)}`;
  // The medallion. Same artwork as the website's badge image.
  function badgeSVG(o = {}) {
    const dist = !!o.distinction, year = o.year === '' ? '' : (o.year || today().slice(0, 4));
    const dot = a => `<circle cx="${600 + 474 * Math.cos(a)}" cy="${600 + 474 * Math.sin(a)}" r="9" fill="${o.adv ? '#0F1F3A' : '#0F2A21'}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6DEA0"/><stop offset=".45" stop-color="#D9AE5C"/><stop offset="1" stop-color="#9A6E2B"/></linearGradient>
        <radialGradient id="green" cx=".38" cy=".3" r=".85">${o.adv ? '<stop offset="0" stop-color="#3B5F95"/><stop offset=".55" stop-color="#22406E"/><stop offset="1" stop-color="#0F1F3A"/>' : '<stop offset="0" stop-color="#2F8A6A"/><stop offset=".55" stop-color="#1E6B53"/><stop offset="1" stop-color="#0F3B2D"/>'}</radialGradient>
        <path id="top" d="M 600 600 m -458 0 a 458 458 0 1 1 916 0"/>
        <path id="bot" d="M 600 600 m -492 0 a 492 492 0 0 0 984 0"/>
      </defs>
      <circle cx="600" cy="600" r="560" fill="url(#gold)"/>
      <circle cx="600" cy="600" r="520" fill="${o.adv ? '#0F1F3A' : '#0F2A21'}"/>
      <circle cx="600" cy="600" r="505" fill="url(#gold)"/>
      ${dot(0)}${dot(Math.PI)}
      <circle cx="600" cy="600" r="440" fill="url(#green)"/>
      <circle cx="600" cy="600" r="428" fill="none" stroke="#F1D79A" stroke-opacity=".55" stroke-width="3"/>
      <text font-family="Georgia, 'Times New Roman', serif" font-size="44" letter-spacing="9" fill="${o.adv ? '#0F1F3A' : '#0F2A21'}" font-weight="700"><textPath href="#top" startOffset="50%" text-anchor="middle">COLL LEDGER ACADEMY</textPath></text>
      <text font-family="Georgia, 'Times New Roman', serif" font-size="40" letter-spacing="7" fill="${o.adv ? '#0F1F3A' : '#0F2A21'}" font-weight="700"><textPath href="#bot" startOffset="50%" text-anchor="middle">${o.adv ? 'ACCOUNTING &amp; TAX' : 'PROFESSIONAL BOOKKEEPER'}</textPath></text>
      <circle cx="600" cy="560" r="150" fill="none" stroke="url(#gold)" stroke-width="10"/>
      <text x="600" y="628" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="210" fill="url(#gold)">C</text>
      <path d="M330 760 h540 l-38 52 38 52 h-540 l38 -52z" fill="url(#gold)"/>
      <text x="600" y="830" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="700" fill="#16201C" letter-spacing="5">${dist ? 'DISTINCTION' : o.adv ? ('ADVANCED ' + year).trim() : ('CERTIFIED ' + year).trim()}</text>
      ${dist ? `<text x="600" y="925" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#F1D79A" letter-spacing="8">${year}</text>` : ''}
      <g fill="#F1D79A">${[-1, 0, 1].map(k => `<path transform="translate(${600 + k * 70} ${k ? 300 : 286}) scale(${k ? 1.1 : 1.5})" d="M0-16 4.7-5.2 16.2-4.9 7.1 2.4 10.4 13.5 0 7 -10.4 13.5 -7.1 2.4 -16.2-4.9 -4.7-5.2z"/>`).join('')}</g>
    </svg>`;
  }
  async function svgToPngBase64(svg, w, h) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    return cv.toDataURL('image/png').split(',')[1];
  }
  // A LinkedIn-sized share image: badge, name and what was earned
  function shareSVG(cert) {
    const b = badgeSVG({ distinction: cert.distinction, year: cert.date.slice(0, 4) }).replace('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">', '<svg x="70" y="63" width="500" height="500" viewBox="0 0 1200 1200">');
    const nm = esc(cert.name);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="627" viewBox="0 0 1200 627">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16362B"/><stop offset="1" stop-color="#0B1712"/></linearGradient></defs>
      <rect width="1200" height="627" fill="url(#bg)"/>
      <rect x="18" y="18" width="1164" height="591" fill="none" stroke="#B8893B" stroke-opacity=".6" stroke-width="2"/>
      ${b}
      <text x="620" y="190" font-family="Arial, sans-serif" font-size="22" letter-spacing="6" fill="#C9D3CD">COLL LEDGER ACADEMY</text>
      <text x="620" y="268" font-family="Georgia, serif" font-size="${nm.length > 22 ? 46 : 58}" fill="#FFFFFF">${nm}</text>
      <text x="620" y="330" font-family="Arial, sans-serif" font-size="26" fill="#C9D3CD">earned the</text>
      <text x="620" y="380" font-family="Georgia, serif" font-size="40" fill="#F1D79A">Professional Bookkeeping</text>
      <text x="620" y="428" font-family="Georgia, serif" font-size="40" fill="#F1D79A">Certificate${cert.distinction ? ' · with distinction' : ''}</text>
      <text x="620" y="500" font-family="Arial, sans-serif" font-size="20" fill="#8FA39A">Issued by ${ISSUER} · ${esc(fmtDate(cert.date))}</text>
      <text x="620" y="532" font-family="Arial, sans-serif" font-size="20" fill="#8FA39A">Credential ${esc(cert.id)}</text>
    </svg>`;
  }
  async function saveImage(b64, name) {
    if (window.desktop) { const p = await window.desktop.saveFile({ defaultName: name, base64: b64, filters: [{ name: 'PNG image', extensions: ['png'] }] }); if (p) U.toast('Image saved'); return; }
    const a = document.createElement('a'); a.href = 'data:image/png;base64,' + b64; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function linkedInUrl(cert) {
    const q = new URLSearchParams({ startTask: 'CERTIFICATION_NAME', name: CRED_NAME, organizationName: ISSUER, issueYear: cert.date.slice(0, 4), issueMonth: String(+cert.date.slice(5, 7)), certUrl: verifyUrl(cert.id), certId: cert.id });
    return 'https://www.linkedin.com/profile/add?' + q.toString();
  }
  function registryEntry(cert) { return JSON.stringify({ id: cert.id, name: cert.name, awarded: cert.date, written: cert.written, practical: cert.practical, distinction: cert.distinction }); }
  function credentialModal() {
    const cert = T().cert; if (!cert) return;
    const open = url => window.desktop ? window.desktop.openExternal(url) : window.open(url, '_blank');
    const m = U.openModal(`${U.modalHead('Your credential', 'Share it on LinkedIn, add the badge anywhere, and let anyone check it\'s real')}
      <div class="modal-body">
        <div class="cred-top"><div class="cred-badge">${badgeSVG({ distinction: cert.distinction, year: cert.date.slice(0, 4) })}</div>
          <div class="cred-info"><div class="cap-label">${esc(ISSUER)}</div><h3>${esc(CRED_NAME)}${cert.distinction ? ' <span class="tag gold">with distinction</span>' : ''}</h3>
            <div class="cred-rows"><div><span>Name</span><b>${esc(cert.name)}</b></div><div><span>Issued</span><b>${fmtDate(cert.date)}</b></div><div><span>Credential ID</span><b class="mono">${esc(cert.id)}</b></div><div><span>Credential URL</span><b class="mono ellip">${esc(verifyUrl(cert.id))}</b></div></div></div></div>
        <div class="cred-steps">
          <div class="cred-step"><span class="n">1</span><div class="grow"><b>Add it to LinkedIn</b><div class="muted">Opens LinkedIn with the name, issuer, date, credential ID and link already filled in. Click <b>Save</b>.</div></div><button class="btn primary" data-c="li">Add to LinkedIn</button></div>
          <div class="cred-step"><span class="n">2</span><div class="grow"><b>Save the badge</b><div class="muted">A square image for your profile's media, résumé, website or email signature.</div></div><button class="btn" data-c="badge">${ICON.download}Badge</button></div>
          <div class="cred-step"><span class="n">3</span><div class="grow"><b>Post it</b><div class="muted">A share image sized for LinkedIn and Facebook posts, with your name on it.</div></div><button class="btn" data-c="share">${ICON.download}Share image</button></div>
          <div class="cred-step"><span class="n">4</span><div class="grow"><b>Get it registered for verification</b><div class="muted">${cert.registeredAsked ? 'Request sent — once Coll Business Solutions adds it, the credential link shows "Verified".' : 'Sends your credential to Coll Business Solutions so the link above shows "Verified" for anyone who checks.'}</div></div><button class="btn" data-c="reg">${ICON.mail}${cert.registeredAsked ? 'Send again' : 'Request'}</button></div>
          <div class="cred-step pa-step"><span class="n">5</span><div class="grow"><b>Next: QuickBooks ProAdvisor certification</b><div class="muted">Free to join — gets you listed in Intuit's Find-a-ProAdvisor directory, where small businesses look for help.</div></div><button class="btn primary" data-c="pa">See why ${ICON.right}</button></div>
          <div class="cred-step"><span class="n">${ICON.check}</span><div class="grow"><b>Certificate PDF and link</b><div class="muted">The printable certificate and transcript, or copy the credential link.</div></div><button class="btn ghost" data-c="copy">${ICON.copy}Copy link</button><button class="btn" data-c="pdf">${ICON.pdf}Certificate</button></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn primary" data-action="close-modal">Done</button></div>`, { wide: true });
    $('[data-c=li]', m).onclick = () => open(linkedInUrl(cert));
    $('[data-c=pa]', m).onclick = () => { U.closeModal(); proAdvisorModal(); };
    $('[data-c=badge]', m).onclick = async () => saveImage(await svgToPngBase64(badgeSVG({ distinction: cert.distinction, year: cert.date.slice(0, 4) }), 1200, 1200), 'Coll Ledger Academy badge.png');
    $('[data-c=share]', m).onclick = async () => saveImage(await svgToPngBase64(shareSVG(cert), 1200, 627), `Coll Ledger certificate - ${cert.name}.png`);
    $('[data-c=copy]', m).onclick = () => U.copyText(verifyUrl(cert.id));
    $('[data-c=pdf]', m).onclick = () => { U.closeModal(); App.actions['t-cert-pdf'](); };
    $('[data-c=reg]', m).onclick = () => {
      const body = `Please register this Coll Ledger Academy credential so it shows as verified.\n\nName: ${cert.name}\nCredential ID: ${cert.id}\nAwarded: ${fmtDate(cert.date)}\nWritten exam: ${cert.written}%\nPractical exam: ${cert.practical}/100${cert.distinction ? '\nWith distinction' : ''}\n\nTo register: on GitHub open the coll-landing-page repository → Actions → Register credential → Run workflow, paste this entry, and click Run.\nRegistry entry:\n${registryEntry(cert)}\n\nCredential link: ${verifyUrl(cert.id)}`;
      open(`mailto:collbusinesssolutions@gmail.com?subject=${encodeURIComponent('Credential registration ' + cert.id)}&body=${encodeURIComponent(body)}`);
      cert.registeredAsked = today(); save(); U.toast('Opening your email — just press Send');
    };
  }

  act({
    'pa-open': () => proAdvisorModal(),
    'ex-start': () => App.examGate('written', T().written, 'Professional written exam', () => { S.ui.exam = Object.assign(newAttempt(), { kind: 'written' }); render(); $('#view').scrollTop = 0; }),
    'ex-close': () => { S.ui.exam = null; render(); },
    'ex-pick': el => { const E = S.ui.exam; const q = E.qs[E.at]; E.answers[q.i] = +el.dataset.a; render(); },
    'ex-move': el => { const E = S.ui.exam; E.at = Math.max(0, Math.min(E.qs.length - 1, E.at + +el.dataset.d)); render(); },
    'ex-jump': el => { S.ui.exam.at = +el.dataset.k; render(); },
    'ex-submit': async () => {
      const E = S.ui.exam;
      if (!await U.confirmBox({ title: 'Submit your answers?', body: 'You can\'t change them after this.', ok: 'Submit' })) return;
      const score = E.qs.filter(q => E.answers[q.i] === BANK[q.i][3]).length;
      const res = { date: today(), score, total: E.qs.length, pct: score / E.qs.length, passed: score / E.qs.length >= PASS, at: Date.now(), mins: Math.round((Date.now() - E.started) / 60000) };
      T().written.push(res); save(); App.tries.record('written', res.passed);
      E.done = true; E.result = res; render(); $('#view').scrollTop = 0;
      U.toast(res.passed ? `Passed — ${score} of ${res.total}` : `${score} of ${res.total} — ${App.tries.afterMiss('written')}`);
    },
    'ex-prac-start': () => startPractical(false),
    'ex-prac-open': () => startPractical(false),
    'ex-prac-reset': async () => { if (!await U.confirmBox({ title: 'Start the practical over?', body: 'Juniper Flower Co. goes back to the beginning.', ok: 'Start over' })) return; S.ui.examGrade = null; startPractical(true); go('training'); },
    'ex-prac-grade': async () => {
      const c = examClient(); if (!c) return;
      if (App.tries.blocked('practical', 'Grading')) return;
      if (!await U.confirmBox({ title: 'Grade your work?', body: `Each grading counts as a try. ${App.tries.line('practical')}`, ok: 'Grade it' })) return;
      const r = grade(c); S.ui.examGrade = r; App.tries.record('practical', r.passed);
      const t = T();
      if (!t.practical || r.score > t.practical.score || (r.passed && !t.practical.passed)) t.practical = { score: r.score, passed: r.passed, date: today() };
      save(); render();
      U.toast(r.passed ? `Practical passed — ${r.score}/100` : `${r.score}/100 — ${App.tries.afterMiss('practical')}`);
    }
  });

  App.academy = { svgToPngBase64, saveImage, verifyUrl, credId, openLink, T, proAdvisorCard, proAdvisorModal, credentialModal, badgeSVG, shareSVG, linkedInUrl, renderWritten, renderPractical, writtenPassed, practicalPassed: () => !!(T().practical && T().practical.passed), certificate, examClient, BANK, grade, buildExam };
})();
