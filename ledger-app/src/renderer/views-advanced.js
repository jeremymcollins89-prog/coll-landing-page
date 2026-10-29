'use strict';
/* =====================================================================
   Coll Ledger Academy — Advanced Accounting & Tax
   Second certificate: written exam (35 of 60 questions, 80% to pass),
   practical month-end close for Aspen Trail Outfitters (graded on the
   account balances, so any correct method earns credit), certificate,
   badge, LinkedIn, and accredited-program recommendations.
   Figures checked October 2026.
   ===================================================================== */
(() => {
  const { S, C, U, client, act, go, render, commit, save } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;
  const T = () => { S.data.training = S.data.training || {}; const t = S.data.training; t.done = t.done || {}; t.quiz = t.quiz || {}; t.flags = t.flags || {}; t.advWritten = t.advWritten || []; return t; };

  // [topic, question, answers, correct index, why]   (math worked in comments)
  const BANK = [
    // Accrual accounting
    ['Accrual accounting', 'On November 1 a client receives $2,400 for 12 months of service. How much is still unearned on December 31?', ['$2,000', '$400', '$2,400'], 0, 'Unearned revenue becomes earned as the service is delivered. $2,400 ÷ 12 = $200 a month, and two months are done: $200 × 2 = $400 earned. $2,400 − $400 = $2,000 is still owed in service.'], // 2400/12=200
    ['Accrual accounting', 'Which basis records income when it\'s earned, regardless of when cash arrives?', ['Cash basis', 'Accrual basis', 'Tax basis'], 1, 'Accrual basis records income when it\'s earned and expenses when they\'re incurred, no matter when cash moves. Cash basis waits for the money.'],
    ['Accrual accounting', 'A customer pays a deposit for work next month. The deposit is…', ['Income now', 'A liability (unearned revenue) until the work is done', 'Owner\'s equity'], 1, 'Money received before the work is done is a liability, Unearned Revenue, because the business still owes the work. It becomes income when the work is delivered.'],
    ['Accrual accounting', 'Recording a sales commission in the same month as the sale follows the…', ['Matching principle', 'Cost principle', 'Going-concern principle'], 0, 'The matching principle puts expenses in the same period as the income they helped earn. The commission helped make the sale, so it belongs in the sale\'s month.'],
    // Prepaids and accruals
    ['Prepaids & accruals', 'A $3,600 annual insurance policy starts April 1 and is paid that day. After April\'s adjusting entry, Prepaid Expenses is…', ['$3,600', '$3,300', '$300'], 1, 'A prepaid cost is used up evenly over the months it covers. $3,600 ÷ 12 = $300 moves to Insurance for April, so $3,600 − $300 = $3,300 stays in Prepaid Expenses.'], // 3600/12=300
    ['Prepaids & accruals', 'Wages earned but not yet paid at month end are recorded as…', ['Debit Payroll & Wages, credit Accrued Liabilities', 'Debit Accrued Liabilities, credit Business Checking', 'No entry until payday'], 0, 'Under accrual, the expense belongs to the month the work was done. Debit Payroll & Wages for the wages earned and credit Accrued Liabilities for the amount still owed. No cash has moved yet.'],
    ['Prepaids & accruals', 'Why reverse an accrual on the first day of the next month?', ['So the real bill isn\'t counted as a second expense', 'To delete the accrual from history', 'Tax law requires it'], 0, 'The reversing entry cancels the accrual on day one of the new month. When the real bill is paid and recorded, the expense counts only once overall.'],
    ['Prepaids & accruals', 'A 6-month software subscription costs $1,800, paid up front. Monthly expense?', ['$1,800', '$300', '$150'], 1, 'Spread a prepaid cost evenly over the months it covers: $1,800 ÷ 6 = $300 a month.'], // 1800/6=300
    // Fixed assets
    ['Fixed assets', 'A $50,000 truck with a $10,000 salvage value and an 8-year life. Annual straight-line depreciation?', ['$6,250', '$5,000', '$4,000'], 1, 'Straight-line depreciation is (cost − salvage) ÷ useful life: ($50,000 − $10,000) ÷ 8 = $5,000 a year.'], // 40000/8=5000
    ['Fixed assets', 'Equipment costs $18,000 with no salvage value and a 5-year life. Monthly straight-line depreciation?', ['$300', '$360', '$3,600'], 0, 'Convert the life to months, then divide: 5 × 12 = 60 months, and $18,000 ÷ 60 = $300 a month.'], // 18000/60=300
    ['Fixed assets', 'Cost $24,000; accumulated depreciation $9,000. Book value?', ['$33,000', '$15,000', '$9,000'], 1, 'Book value is cost minus accumulated depreciation: $24,000 − $9,000 = $15,000.'],
    ['Fixed assets', 'Equipment cost $20,000 with $14,000 accumulated depreciation is sold for $7,500. Result?', ['$1,500 gain', '$1,500 loss', '$7,500 gain'], 0, 'Gain or loss is the sale price minus book value. Book value is $20,000 − $14,000 = $6,000, and $7,500 − $6,000 = $1,500 gain.'], // 20000-14000=6000; 7500-6000=1500
    ['Fixed assets', 'Under the IRS de minimis safe harbor, a business without audited financial statements can expense items up to…', ['$500 per item', '$2,500 per item or invoice', '$25,000 per year'], 1, 'Without audited financial statements, the de minimis safe harbor lets a business expense items up to $2,500 per item or invoice. It needs a consistent policy from the start of the year and the election with each year\'s return.'],
    ['Fixed assets', 'The Section 179 expensing limit for tax years beginning in 2026 is about…', ['$1.16 million', '$2.56 million', '$5 million'], 1, 'For tax years beginning in 2026, the Section 179 limit is $2,560,000. It shrinks dollar for dollar once qualifying purchases top $4,090,000.'],
    ['Fixed assets', 'Bonus depreciation for qualifying property acquired and placed in service after January 19, 2025 is…', ['40%', '60%', '100%'], 2, 'The 2025 tax law restored 100% bonus depreciation for qualifying property acquired and placed in service after January 19, 2025. Property acquired earlier still follows the old phase-down schedule.'],
    // Inventory
    ['Inventory', 'Beginning inventory $8,000, purchases $30,000, ending inventory $9,500. Cost of goods sold?', ['$28,500', '$31,500', '$47,500'], 0, 'Cost of goods sold is beginning inventory plus purchases minus ending inventory: $8,000 + $30,000 − $9,500 = $28,500.'], // 38000-9500=28500
    ['Inventory', 'Sales $60,000 and cost of goods sold $36,000. Gross margin?', ['60%', '40%', '24%'], 1, 'Gross margin is (sales − cost of goods sold) ÷ sales: ($60,000 − $36,000) ÷ $60,000 = 40%.'], // 24000/60000=0.4
    ['Inventory', 'The physical count is $750 less than the books. The adjusting entry is…', ['Debit Cost of Goods Sold $750, credit Inventory $750', 'Debit Inventory $750, credit Cost of Goods Sold $750', 'Debit Sales $750, credit Inventory $750'], 0, 'The count wins. Goods that are missing were sold, used or lost, so credit Inventory $750 to bring it down to the count and debit Cost of Goods Sold $750.'],
    ['Inventory', 'Inventory is valued at…', ['Retail selling price', 'What the business paid (cost)', 'Whatever the owner estimates'], 1, 'Inventory is recorded at cost — what the business paid — not at its selling price. The profit shows up only when the goods are sold.'],
    // Loans
    ['Loans', 'A $48,000 loan balance at 5% annual interest. This month\'s interest?', ['$2,400', '$400', '$200'], 2, 'Monthly interest is the balance times the annual rate, divided by 12: $48,000 × 5% ÷ 12 = $200. ($2,400 is a full year\'s interest.)'], // 48000*.05=2400/12=200
    ['Loans', 'A $1,000 payment includes $200 of interest on a $48,000 balance. New balance?', ['$47,000', '$47,200', '$47,800'], 1, 'Only principal reduces the balance. Principal is $1,000 − $200 = $800, so the new balance is $48,000 − $800 = $47,200.'],
    ['Loans', 'A business receives $30,000 of loan proceeds. The entry is…', ['Debit Business Checking, credit Sales', 'Debit Business Checking, credit Loans Payable', 'Debit Loans Payable, credit Business Checking'], 1, 'Borrowed money is a liability, not income. Debit Business Checking $30,000 (cash up) and credit Loans Payable $30,000 (what the business owes goes up).'],
    // The close and cash flow
    ['Closing & cash flow', 'Net income $25,000, depreciation $5,000, and receivables fell by $3,000. Cash from operations (indirect method)?', ['$33,000', '$27,000', '$17,000'], 0, 'The indirect method starts with net income, adds back non-cash expenses like depreciation, and adds a drop in receivables (customers paid in cash): $25,000 + $5,000 + $3,000 = $33,000.'],
    ['Closing & cash flow', 'Loan principal payments appear on the cash flow statement under…', ['Operating', 'Investing', 'Financing'], 2, 'Borrowing and repaying loan principal are financing activities, along with owner contributions and draws. Interest paid stays in operating.'],
    ['Closing & cash flow', 'A corporation\'s retained earnings were $40,000. This year: net income $25,000, dividends $10,000. Ending retained earnings?', ['$55,000', '$65,000', '$75,000'], 0, 'Ending retained earnings are beginning retained earnings plus net income minus dividends: $40,000 + $25,000 − $10,000 = $55,000.'],
    ['Closing & cash flow', 'Closing entries at year end…', ['Delete the year\'s transactions', 'Move income and expense balances into retained earnings', 'Reverse every adjusting entry'], 1, 'Closing entries zero out the income and expense accounts so the new year starts fresh, and move the year\'s profit into retained earnings. Nothing is deleted.'],
    // Payroll
    ['Payroll compliance', 'Gross wages of $3,000. The employer\'s share of FICA?', ['$229.50', '$459.00', '$186.00'], 0, 'The employer\'s FICA share is 7.65% of wages (6.2% Social Security plus 1.45% Medicare): $3,000 × 7.65% = $229.50.'], // 3000*.0765=229.5
    ['Payroll compliance', 'An employee earns $190,000 in 2026. Employee Social Security tax for the year?', ['$11,780.00', '$11,439.00', '$14,535.00'], 1, 'Social Security tax stops at the yearly wage base, $184,500 for 2026: $184,500 × 6.2% = $11,439. Medicare has no wage cap.'], // 184500*.062=11439
    ['Payroll compliance', 'After the full state credit, FUTA on one employee who earns $40,000 is…', ['$2,400', '$420', '$42'], 2, 'FUTA applies only to the first $7,000 of each employee\'s wages, at 0.6% after the full state credit: $7,000 × 0.6% = $42.'], // 7000*.006=42
    ['Payroll compliance', 'The second-quarter Form 941 is due…', ['June 30', 'July 31', 'August 15'], 1, 'Form 941 is due the last day of the month after the quarter ends. The second quarter ends June 30, so it\'s due July 31.'],
    ['Payroll compliance', 'W-2s are due to employees by…', ['January 31', 'February 28', 'April 15'], 0, 'Form W-2 is due to employees by January 31, and the copies are due to the Social Security Administration the same day.'],
    ['Payroll compliance', 'Employee withholdings the business hasn\'t sent to the IRS are…', ['The business\'s money', 'Trust fund taxes — responsible people can be personally liable', 'Optional'], 1, 'Taxes withheld from employees are held in trust for the government. If they aren\'t paid over, the IRS can hold the responsible people personally liable.'],
    // Sales tax
    ['Sales tax', 'Colorado\'s state sales tax rate is…', ['2.9%', '4.5%', '6.0%'], 0, 'Colorado\'s state rate is 2.9%. County, city and special-district taxes are added on top, so the total rate depends on the location.'],
    ['Sales tax', 'Economic nexus means…', ['A business owes sales tax only where it has a store', 'Enough sales into a state can require collecting its tax — often $100,000 a year', 'Sales tax applies only to services'], 1, 'Economic nexus means a seller must collect a state\'s sales tax once its sales into that state pass a threshold, even with no store there. Many states, including Colorado, use $100,000 in annual sales.'],
    ['Sales tax', 'A customer buying for resale should give the seller…', ['A W-9', 'A resale or exemption certificate', 'Nothing'], 1, 'A buyer purchasing for resale gives the seller a resale or exemption certificate. Keep it on file — it\'s the seller\'s proof for not charging tax. A W-9 is for 1099 reporting.'],
    ['Sales tax', 'Sales through a marketplace like Amazon or Etsy are generally taxed by…', ['The marketplace (as marketplace facilitator)', 'The buyer directly', 'Nobody'], 0, 'Marketplace facilitator laws make the platform collect and remit sales tax on the sales it handles. The seller doesn\'t collect it a second time.'],
    ['Sales tax', 'A client collected $1,840 of sales tax and has paid $1,500 to the state. Sales Tax Payable should be…', ['$3,340', '$340', '$1,840'], 1, 'Sales Tax Payable is tax collected minus tax paid: $1,840 − $1,500 = $340 still owed to the state.'],
    // Business tax returns
    ['Business returns', 'A calendar-year partnership\'s Form 1065 is due…', ['January 31', 'March 15', 'April 15'], 1, 'Calendar-year partnerships (Form 1065) and S corporations (Form 1120-S) file by March 15. Individuals, including sole proprietors, file by April 15.'],
    ['Business returns', 'A sole proprietor\'s Schedule C is due with Form 1040 on…', ['March 15', 'April 15', 'June 15'], 1, 'Schedule C is part of the owner\'s Form 1040, which is due April 15 for calendar-year individuals.'],
    ['Business returns', 'A filing extension gives more time to…', ['File and pay', 'File only — tax is still due on the original date', 'Pay only'], 1, 'An extension gives more time to file, not to pay. Interest and penalties run on any tax unpaid after the original due date.'],
    ['Business returns', 'A client had $800 of qualifying business meals. The deductible amount is generally…', ['$800', '$400', '$0'], 1, 'Business meals are generally 50% deductible: $800 × 50% = $400.'],
    ['Business returns', 'A government fine for a late permit is…', ['Fully deductible', 'Not deductible', '50% deductible'], 1, 'Fines and penalties paid to a government for breaking a law or rule aren\'t deductible. The permit fee itself is; the fine for being late isn\'t.'],
    // Owner taxes
    ['Owner taxes', 'Net self-employment profit of $60,000. Self-employment tax is about…', ['$9,180.00', '$8,477.73', '$7,344.00'], 1, 'Self-employment tax is 15.3% of 92.35% of net profit. $60,000 × 92.35% = $55,410, and $55,410 × 15.3% = $8,477.73.'], // 60000*.9235=55410*.153=8477.73
    ['Owner taxes', 'How much of self-employment tax is deductible on the owner\'s return?', ['None', 'Half', 'All'], 1, 'The owner deducts the employer-equivalent half of self-employment tax — the same share an employer would deduct for an employee.'],
    ['Owner taxes', 'The qualified business income (QBI) deduction is generally up to…', ['10%', '20%', '30%'], 1, 'The QBI deduction is generally up to 20% of qualified business income, subject to income limits. The 2025 tax law made it permanent.'],
    ['Owner taxes', 'Last year\'s tax was $20,000 and AGI was $180,000. The prior-year safe harbor for estimates is…', ['$18,000', '$20,000', '$22,000'], 2, 'Paying 100% of last year\'s tax avoids the underpayment penalty — 110% when last year\'s AGI was over $150,000. $20,000 × 110% = $22,000.'], // 20000*1.1=22000
    ['Owner taxes', 'S-corp distributions aren\'t subject to payroll taxes. That\'s why the IRS requires…', ['No salary at all', 'A reasonable salary for owners who work in the business', 'Monthly distributions'], 1, 'Because distributions skip payroll taxes, owners who work in an S corp must take a reasonable salary through payroll. They can\'t avoid payroll tax by taking only distributions.'],
    // 1099s
    ['1099s & W-9s', 'In 2026 a contractor (sole proprietor) is paid $1,900 by check for services. Is a 1099-NEC required?', ['Yes', 'No — it\'s under the $2,000 threshold for 2026 payments', 'Only if paid in cash'], 1, 'For payments made in 2026, the 1099-NEC threshold is $2,000. At $1,900 no form is required, whether the contractor was paid by check or in cash.'],
    ['1099s & W-9s', 'Payments to an incorporated law firm for legal services…', ['Never get a 1099', 'Get a 1099 — attorneys are the main exception to the corporation exemption', 'Get a W-2'], 1, 'Payments to corporations are usually exempt from 1099 reporting, but legal fees are the big exception. Report payments for legal services on a 1099-NEC even when the firm is incorporated.'],
    ['1099s & W-9s', 'Backup withholding when a payee won\'t give a valid tax ID is…', ['10%', '24%', '37%'], 1, 'When a payee won\'t provide a valid taxpayer ID, the payer must withhold 24% of reportable payments and send it to the IRS.'],
    ['1099s & W-9s', 'A business filing 10 or more information returns in total generally must…', ['File on paper', 'File electronically', 'Skip filing'], 1, 'A business that files 10 or more information returns in total for the year — W-2s and 1099s counted together — must file them electronically.'],
    // Internal controls
    ['Internal controls', 'Segregation of duties means…', ['One trusted person handles everything', 'Different people approve, pay and record transactions', 'The CPA does the books'], 1, 'Segregation of duties splits the cycle: one person approves, another pays, another records. Fraud then takes two people working together, and honest errors get caught.'],
    ['Internal controls', 'A "vendor" emails new bank details. Best control?', ['Update immediately', 'Call the vendor at a number already on file before changing anything', 'Reply to the email to confirm'], 1, 'Verify any change to payment details through a channel you already trust, such as a phone number on file. Replying to the email may just reach the scammer.'],
    ['Internal controls', 'Which is a classic fraud red flag?', ['An employee who never takes vacation and won\'t let anyone help with their tasks', 'A busy December', 'A price increase from a supplier'], 0, 'Many schemes need constant attention to stay hidden, so the person running one avoids time off and won\'t share tasks. Busy seasons and price increases are normal business.'],
    // Ethics
    ['Ethics & security', 'To prepare federal tax returns for pay, you must have…', ['A CPA license', 'A PTIN', 'Nothing'], 1, 'Anyone who prepares federal tax returns for pay needs a Preparer Tax Identification Number (PTIN), renewed each year. A CPA license isn\'t required.'],
    ['Ethics & security', 'Circular 230 governs…', ['Sales tax in Colorado', 'Practice before the IRS by CPAs, attorneys and enrolled agents', 'Payroll deposits'], 1, 'Treasury Department Circular 230 sets the rules for practice before the IRS by CPAs, attorneys, enrolled agents and others who represent taxpayers.'],
    ['Ethics & security', 'Tax preparers are required to keep…', ['A written information security plan', 'Paper copies only', 'Client passwords'], 0, 'The FTC Safeguards Rule requires tax preparers to keep a written information security plan (WISP) that spells out how client data is protected.'],
    // Career paths
    ['Career paths', 'The IRS enrolled agent exam (SEE) has…', ['One part', 'Three parts', 'Four parts'], 1, 'The Special Enrollment Examination has three parts: Individuals; Businesses; and Representation, Practices and Procedures.'],
    ['Career paths', 'Enrolled agents must complete continuing education of…', ['72 hours every three years (at least 16 a year, 2 on ethics)', '40 hours a year', 'None'], 0, 'Enrolled agents generally need 72 hours of continuing education every three-year cycle, with at least 16 hours each year — 2 of them on ethics.'],
    ['Career paths', 'Colorado\'s new CPA licensure pathways take effect…', ['January 1, 2027', 'July 1, 2026', 'They already ended'], 0, 'Colorado\'s three new CPA licensure pathways begin January 1, 2027. Each requires the CPA Exam, a professional ethics course and verified experience.']
  ];
  const DRAW = 35, PASS = 0.8;
  const shuffle = (a, seed) => { const r = () => { seed = (seed * 16807) % 2147483646 + 1; return (seed - 1) / 2147483646; }; const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  function newAttempt() {
    const seed = (Date.now() % 2147483640) + 3;
    const topics = [...new Set(BANK.map(q => q[0]))], idx = BANK.map((_, i) => i);
    const picked = new Set(topics.map(tp => shuffle(idx.filter(i => BANK[i][0] === tp), seed + tp.length)[0]));
    for (const i of shuffle(idx, seed)) { if (picked.size >= DRAW) break; picked.add(i); }
    return { kind: 'adv', qs: shuffle([...picked], seed + 11).map(i => ({ i, order: shuffle([0, 1, 2], seed + i * 7) })), at: 0, answers: {}, started: Date.now() };
  }
  const writtenPassed = () => T().advWritten.some(w => w.pct >= PASS);
  const writtenBest = () => T().advWritten.reduce((b, w) => (!b || w.pct > b.pct ? w : b), null);

  function renderWritten() {
    const E = S.ui.exam && S.ui.exam.kind === 'adv' ? S.ui.exam : null;
    const best = writtenBest();
    if (!E) return `<div class="tm-head"><span class="tag navy">Advanced final · part 1 of 2</span>${writtenPassed() ? `<span class="tag green">${ICON.check}Passed · ${Math.round(best.pct * 100)}%</span>` : ''}</div>
      <h2 class="tm-title">Advanced written exam</h2>
      <p class="tm-learn">${DRAW} questions drawn from a bank of ${BANK.length}: accrual accounting, prepaids and accruals, fixed assets, inventory, loans, the close and cash flow, payroll and sales tax compliance, business and owner taxes, 1099s, internal controls, ethics and career paths. Several questions need a calculator.</p>
      <div class="exam-rules"><div><b>${DRAW}</b><span>questions</span></div><div><b>${Math.round(PASS * 100)}%</b><span>to pass (${Math.ceil(DRAW * PASS)} right)</span></div><div><b>~75 min</b><span>typical · no time limit</span></div><div><b>New</b><span>questions each try</span></div></div>
      ${T().advWritten.length ? `<div class="exam-history"><div class="cap-label">Your attempts</div>${T().advWritten.slice(-5).reverse().map(w => `<div><span>${fmtDate(w.date)}</span><b class="${w.pct >= PASS ? 'pos' : ''}">${w.score} / ${w.total} · ${Math.round(w.pct * 100)}%</b>${w.pct >= PASS ? '<span class="tag green">Passed</span>' : '<span class="tag">Not yet</span>'}</div>`).join('')}</div>` : ''}
      ${App.examRulesNote ? App.examRulesNote('advWritten') : ''}
      <div class="tm-nav"><button class="btn ghost" data-nav="handbook">${ICON.help}Study the handbook</button><button class="btn primary" data-action="ax-start">${writtenPassed() ? 'Take it again' : 'Start the exam'} ${ICON.right}</button></div>`;
    if (E.done) {
      const r = E.result, missed = E.qs.filter(q => E.answers[q.i] !== BANK[q.i][3]);
      return `<div class="exam-result ${r.passed ? 'pass' : ''}"><div class="er-score">${r.score}<span>/ ${r.total}</span></div><div><h2 class="tm-title" style="margin:0">${r.passed ? 'You passed!' : 'Not quite yet'}</h2><div class="muted">${Math.round(r.pct * 100)}% · ${r.passed ? (r.pct >= 0.92 ? 'Distinction-level score.' : 'Nicely done.') : `You need ${Math.ceil(DRAW * PASS)} right. Review what you missed and try again — you'll get new questions.`}</div></div></div>
        ${missed.length ? `<div class="cap-label" style="margin-top:18px">Review what you missed</div>${missed.map(q => { const [tp, qq, a, c, why] = BANK[q.i]; return `<div class="qz"><div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.08em">${esc(tp)}</div><div class="qz-q">${esc(qq)}</div><div class="qz-a">${q.order.map(ai => `<div class="qa ${ai === c ? 'right answer' : E.answers[q.i] === ai ? 'wrong' : ''}">${esc(a[ai])}</div>`).join('')}</div><div class="qz-why right">${ICON.check}${esc(why)}</div></div>`; }).join('')}` : '<p class="pos"><b>Perfect score.</b></p>'}
        <div class="tm-nav"><button class="btn ghost" data-action="ax-close">Back to the exam page</button>${r.passed ? `<button class="btn primary" data-action="t-go" data-id="adv-exam-practical">On to the practical ${ICON.right}</button>` : `<button class="btn primary" data-action="ax-start">Try again ${ICON.right}</button>`}</div>`;
    }
    const q = E.qs[E.at], [tp, qq, a] = BANK[q.i], answered = Object.keys(E.answers).length;
    return `<div class="tm-head"><span class="tag navy">Advanced written exam</span><span class="muted">Question ${E.at + 1} of ${E.qs.length} · ${answered} answered</span></div>
      <div class="progress navy" style="margin:6px 0 18px"><div style="width:${(answered / E.qs.length * 100).toFixed(1)}%"></div></div>
      <div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.08em">${esc(tp)}</div>
      <h2 class="tm-title" style="font-size:22px;line-height:1.35">${esc(qq)}</h2>
      <div class="exam-opts">${q.order.map((ai, k) => `<button class="exam-opt ${E.answers[q.i] === ai ? 'on' : ''}" data-action="ax-pick" data-a="${ai}"><span class="eo-k">${'ABC'[k]}</span><span>${esc(a[ai])}</span></button>`).join('')}</div>
      <div class="exam-dots">${E.qs.map((x, k) => `<button class="${k === E.at ? 'cur' : ''} ${E.answers[x.i] != null ? 'ans' : ''}" data-action="ax-jump" data-k="${k}" aria-label="Question ${k + 1}">${k + 1}</button>`).join('')}</div>
      <div class="tm-nav"><button class="btn ghost" data-action="ax-move" data-d="-1" ${E.at === 0 ? 'disabled' : ''}>${ICON.back}Back</button>${E.at < E.qs.length - 1 ? `<button class="btn ${E.answers[q.i] != null ? 'primary' : ''}" data-action="ax-move" data-d="1">Next ${ICON.right}</button>` : `<button class="btn primary" data-action="ax-submit" ${answered < E.qs.length ? 'disabled' : ''}>Submit for grading</button>`}</div>`;
  }

  // ------------------------------------------------------------------
  // Practical: month-end close for Aspen Trail Outfitters
  // ------------------------------------------------------------------
  const examClient = () => S.data.clients.find(c => c.advExam) || null;
  const month = () => { const d = C.parseISO(today()); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); return { from: C.isoOf(s), to: C.isoOf(new Date(s.getFullYear(), s.getMonth() + 1, 0)) }; };
  function build() {
    const M = month(), pad = n => String(n).padStart(2, '0');
    const day = n => `${M.from.slice(0, 8)}${pad(Math.min(n, +M.to.slice(8)))}`;
    const c = C.newClient({ name: 'Aspen Trail Outfitters', legalName: 'Aspen Trail Outfitters LLC', industry: 'Outdoor gear store · advanced practical', color: '#2D5A88', startDate: M.from, invoicePrefix: 'AT-', email: 'hello@aspentrail.example', phone: '(970) 555-0172', address: '401 Main St\nFrisco, CO 80443' });
    c.practice = true; c.advExam = true; c.checklistDismissed = true; c.entity = 'llc1';
    const A = n => (C.acctByName(c, n) || {}).id;
    const ens = (name, type, sub) => C.acctByName(c, name) || C.ensureAccount(c, { name, type, sub });
    ens('Inventory', 'asset', 'current'); ens('Unearned Revenue', 'liability', 'current');
    const open = { 'Business Checking': 42000, 'Inventory': 19200, 'Equipment & Vehicles': 36000, 'Prepaid Expenses': 3600, 'Loans Payable': 28800, 'Sales Tax Payable': 640 };
    for (const [n, v] of Object.entries(open)) C.acctByName(c, n).opening = v;
    const K = {};
    const add = (key, d, desc, amt, cat, payee) => { const t = { id: C.uid(), date: day(d), description: desc, payee: payee || C.cleanPayee(desc), amount: amt, accountId: A('Business Checking'), categoryId: A(cat), memo: '', status: 'posted', cleared: false, reconciled: false }; c.transactions.push(t); if (key) K[key] = t.id; };
    add(null, 4, 'DEPOSIT - STORE SALES', 6240.5, 'Sales', 'Store sales');
    add(null, 11, 'DEPOSIT - STORE SALES', 5880.25, 'Sales', 'Store sales');
    add(null, 18, 'DEPOSIT - STORE SALES', 6415, 'Sales', 'Store sales');
    add(null, 25, 'DEPOSIT - STORE SALES', 6102.75, 'Sales', 'Store sales');
    add('deposit', 9, 'SPECIAL ORDER DEPOSIT - K MARTIN', 2000, 'Sales', 'K. Martin (special order)');
    add(null, 6, 'SUMMIT GEAR DISTRIBUTORS', -4800, 'Cost of Goods Sold', 'Summit Gear Distributors');
    add(null, 1, 'MAIN ST PROPERTIES RENT', -3200, 'Rent & Lease', 'Main St Properties');
    add(null, 14, 'XCEL ENERGY ONLINE PMT', -410.36, 'Utilities', 'Xcel Energy');
    add(null, 15, 'GUSTO PAYROLL PPD', -3100, 'Payroll & Wages', 'Gusto Payroll');
    add(null, 30, 'GUSTO PAYROLL PPD', -3100, 'Payroll & Wages', 'Gusto Payroll');
    add('loan', 20, 'FIRSTBANK LOAN PAYMENT', -1100, 'Loans Payable', 'FirstBank');
    add('tax', 20, 'COLORADO DEPT OF REVENUE', -640, 'Taxes & Licenses', 'Colorado Dept of Revenue');
    c.transactions.sort((a, b) => a.date.localeCompare(b.date));
    // Expected month-end balances (natural signs) after correct adjustments:
    //   Depreciation ($36,000 − $7,200) ÷ 120 = $240; inventory count $18,450 (books $19,200 → $750 to COGS);
    //   loan interest $28,800 × 7.5% ÷ 12 = $180, principal $920; insurance $3,600 ÷ 12 = $300;
    //   accrued wages 50 h × $25 = $1,250; K. Martin $2,000 to Unearned Revenue; $640 sales tax payment clears the liability.
    c.advKey = { ...K, month: M, expect: {
      'Depreciation Expense': 240, 'Accumulated Depreciation': -240, 'Inventory': 18450, 'Cost of Goods Sold': 5550,
      'Interest Expense': 180, 'Loans Payable': 27880, 'Insurance': 300, 'Prepaid Expenses': 3300,
      'Accrued Liabilities': 1250, 'Payroll & Wages': 7450, 'Unearned Revenue': 2000, 'Sales': 24638.5,
      'Sales Tax Payable': 0, 'Taxes & Licenses': 0 } };
    return c;
  }
  function start(fresh) {
    if (fresh) S.data.clients = S.data.clients.filter(c => !c.advExam);
    let c = examClient(); if (!c) { c = build(); S.data.clients.push(c); }
    save(); App.switchClient(c.id, 'journal');
  }
  function grade(c) {
    const k = c.advKey, bal = C.balances(c, { to: k.month.to });
    const v = n => { const a = C.acctByName(c, n); return a ? C.round2(bal.get(a.id) || 0) : null; };
    const is = (n) => { const got = v(n); return got != null && Math.abs(got - k.expect[n]) < 0.005; };
    const show = n => `${n} ${money(v(n) || 0)} (expected ${money(k.expect[n])})`;
    const items = [
      ['Depreciation for the month ($240)', 12, is('Depreciation Expense') && is('Accumulated Depreciation'), `Straight-line depreciation is (cost − salvage) ÷ months of life: ($36,000 − $7,200) ÷ 120 = $240. Post a journal entry dated the last day of the month: debit Depreciation Expense $240, credit Accumulated Depreciation $240. Now: ${show('Depreciation Expense')}.`],
      ['Inventory adjusted to the count ($18,450)', 14, is('Inventory') && is('Cost of Goods Sold'), `The physical count wins. The books show $19,200 and the count is $18,450: $19,200 − $18,450 = $750. Post a journal entry dated the last day of the month: debit Cost of Goods Sold $750, credit Inventory $750. Now: ${show('Inventory')}.`],
      ['Loan payment split ($920 principal, $180 interest)', 12, is('Interest Expense') && is('Loans Payable'), `Only principal reduces the loan. Interest = $28,800 × 7.5% ÷ 12 = $180; principal = $1,100 − $180 = $920. Split the $1,100 FirstBank payment: $920 to Loans Payable and $180 to Interest Expense. Now: ${show('Loans Payable')}.`],
      ['Prepaid insurance used ($300)', 12, is('Insurance') && is('Prepaid Expenses'), `A prepaid cost is expensed over the months it covers: $3,600 ÷ 12 = $300. Post a journal entry dated the last day of the month: debit Insurance $300, credit Prepaid Expenses $300. Now: ${show('Prepaid Expenses')}.`],
      ['Wages accrued at month end ($1,250)', 12, is('Accrued Liabilities') && is('Payroll & Wages'), `Wages belong to the month the work was done: 50 × $25 = $1,250. Post a journal entry dated the last day of the month: debit Payroll & Wages $1,250, credit Accrued Liabilities $1,250, set to reverse on the first day of next month. Now: ${show('Accrued Liabilities')}.`],
      ['Special-order deposit deferred ($2,000)', 14, is('Unearned Revenue') && is('Sales'), `Money received before the goods ship is owed, not earned. Post a journal entry dated the last day of the month: debit Sales $2,000, credit Unearned Revenue $2,000. Now: ${show('Unearned Revenue')}.`],
      ['Sales tax payment cleared the liability', 12, is('Sales Tax Payable') && is('Taxes & Licenses'), `Paying collected sales tax clears a liability; it isn't an expense. Recategorize the $640 Colorado Dept of Revenue payment from Taxes & Licenses to Sales Tax Payable. Now: ${show('Sales Tax Payable')}.`]
    ].map(([label, pts, ok, why]) => ({ label, pts, ok, why, got: ok ? pts : 0 }));
    const closed = !!c.lockDate && c.lockDate >= k.month.to;
    const score = items.reduce((s, x) => s + x.got, 0) + (closed ? 12 : 0);
    return { items, closed, score, passed: score >= 80 && closed };
  }
  function renderPractical() {
    const c = examClient(), M = month(), res = S.ui.advGrade && c ? S.ui.advGrade : null, prev = T().advPractical;
    const docs = `<div class="adv-docs">
      <div class="adv-doc"><b>1 · Fixed-asset schedule</b><span>Store fixtures and equipment placed in service on the first day of this month: cost $36,000, salvage value $7,200, 10-year straight-line. Book this month's depreciation.</span></div>
      <div class="adv-doc"><b>2 · Inventory count, last day of the month</b><span>Jackets $7,200 · Boots $5,350 · Packs $3,900 · Accessories $2,000 · <b>Total $18,450</b>. Purchases go to Cost of Goods Sold; the books still show the opening inventory of $19,200.</span></div>
      <div class="adv-doc"><b>3 · FirstBank loan statement</b><span>Payment $1,100. Balance before the payment $28,800, at 7.5% annual interest. Work out how much of the payment is interest and how much is principal.</span></div>
      <div class="adv-doc"><b>4 · Insurance policy</b><span>12-month policy, $3,600, paid before this month and recorded in Prepaid Expenses. Coverage started the first day of this month.</span></div>
      <div class="adv-doc"><b>5 · Timesheets</b><span>Wages earned in the last days of the month, paid next payday: 50 hours at $25 an hour.</span></div>
      <div class="adv-doc"><b>6 · Special order</b><span>K. Martin paid a $2,000 deposit on a custom tent that ships next month. It was recorded as Sales.</span></div>
      <div class="adv-doc"><b>7 · Colorado sales tax return</b><span>The $640 payment to the Colorado Department of Revenue paid last month's collected sales tax. It was recorded as Taxes &amp; Licenses.</span></div>
    </div>`;
    return `<div class="tm-head"><span class="tag navy">Advanced final · part 2 of 2</span>${prev && prev.passed ? `<span class="tag green">${ICON.check}Passed · ${prev.score}/100</span>` : ''}</div>
      <h2 class="tm-title">Practical: close ${U.fmtMonth(M.from)} for Aspen Trail Outfitters</h2>
      <p class="tm-learn">A retail client on monthly accrual reporting. Use the source documents below to post the adjusting entries, fix two miscoded transactions and split the loan payment, then close the month. Grading looks at the month-end balances, so any correct method earns full credit — journal entries, splits or recategorizing.</p>
      ${docs}
      <p class="muted">Plan on about 2 hours. Graded on 8 checks worth 100 points; closing the month is one of them and is required to pass. Pass with 80 points or more. A perfect 100, plus 92% or better on the written exam, earns distinction.</p>
      ${res ? `<div class="exam-result ${res.passed ? 'pass' : ''}"><div class="er-score">${res.score}<span>/ 100</span></div><div><h2 class="tm-title" style="margin:0">${res.passed ? 'You passed the practical!' : 'Not passed yet'}</h2><div class="muted">${res.passed ? (res.score === 100 ? 'A perfect close.' : 'Solid work.') : !res.closed ? 'Close the month once the entries are in.' : 'Fix the items marked below, then grade again.'}</div></div></div>
        <div class="grade-list">${res.items.map(x => `<div class="gl ${x.ok ? 'ok' : ''}"><span class="tick ${x.ok ? 'on' : ''}">${x.ok ? ICON.check : ICON.close}</span><div class="grow"><b>${esc(x.label)}</b>${x.ok ? '' : `<div class="muted">${res.passed ? esc(x.why) : 'Not right yet. Recheck the source documents and the lesson on this topic — the full answer key appears once you pass.'}</div>`}</div><span class="num">${x.got}/${x.pts}</span></div>`).join('')}<div class="gl ${res.closed ? 'ok' : ''}"><span class="tick ${res.closed ? 'on' : ''}">${res.closed ? ICON.check : ICON.close}</span><div class="grow"><b>Month closed</b>${res.closed ? '' : '<div class="muted">Required to pass.</div>'}</div><span class="num">${res.closed ? 12 : 0}/12</span></div></div>` : ''}
      <div class="tm-nav">${c ? `<button class="btn ghost" data-action="ax-prac-reset">${ICON.refresh}Start over</button><span style="flex:1"></span><button class="btn" data-action="ax-prac-open">Open Aspen Trail ${ICON.right}</button><button class="btn primary" data-action="ax-prac-grade">${ICON.check}Grade my work</button>` : `<span></span><button class="btn primary" data-action="ax-prac-start">Start the practical ${ICON.right}</button>`}</div>`;
  }

  // ------------------------------------------------------------------
  // Certificate, badge, LinkedIn
  // ------------------------------------------------------------------
  const NAME = 'Coll Ledger Advanced Accounting & Tax Certificate';
  const AC = () => App.academy;
  function certificate() {
    const t = T(), best = writtenBest(), prac = t.advPractical;
    const m = U.openModal(`${U.modalHead('Advanced certificate', 'Check how your name should appear')}
      <div class="modal-body"><div class="field"><label for="ca-name">Full name</label><input id="ca-name" class="input" value="${esc((t.certAdv && t.certAdv.name) || (t.cert && t.cert.name) || S.data.firm.owner || '')}"></div>
      <div class="cert-sum"><div><span>Written exam</span><b>${Math.round(best.pct * 100)}%</b></div><div><span>Practical close</span><b>${prac.score}/100</b></div><div><span>Lessons</span><b>${App.practice.ADV.length}</b></div></div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="ca-go">${ICON.pdf}Save certificate PDF</button></div>`);
    $('#ca-go', m).onclick = () => {
      const name = $('#ca-name', m).value.trim(); if (!name) return U.toast('Add your name', null, 'warn');
      const date = (t.certAdv && t.certAdv.name === name && t.certAdv.date) || today();
      const w = Math.round(best.pct * 100), p = prac.score, distinction = w >= 92 && p === 100;
      const id = AC().credId(name + '|adv', date, w, p).replace(/^CL-/, 'CA-');
      t.certAdv = { name, date, id, written: w, practical: p, distinction, program: 'advanced' }; save();
      U.closeModal();
      const navy = '#22406E', gold = '#B8893B';
      const levels = App.practice.advLevels();
      const transcript = levels.map(L => `<div style="margin-bottom:16px"><div style="font-weight:700;color:${navy};margin-bottom:6px">${esc(L.title)}</div>${L.lessons.map(l => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>${esc(l.title)}</span><span class="muted">${t.done[l.id] ? fmtDate(t.done[l.id]) : ''}</span></div>`).join('')}</div>`).join('');
      U.printDoc(App.docShell('Advanced certificate', `
        <div class="page" style="height:11in;padding:0;display:flex;align-items:center;justify-content:center">
          <div style="width:7.3in;height:9.9in;border:3px solid ${navy};outline:1px solid ${gold};outline-offset:-12px;display:flex;flex-direction:column;align-items:center;text-align:center;padding:60px 56px">
            <div style="font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#6B756F">Coll Ledger Academy</div>
            <div style="width:110px;height:110px;margin:22px 0 4px">${AC().badgeSVG({ adv: true, distinction, year: date.slice(0, 4) }).replace('width="1200" height="1200"', 'width="110" height="110"')}</div>
            <div class="serif" style="font-size:38px;line-height:1.15;margin:14px 0 6px;color:${navy}">Advanced Accounting<br>&amp; Tax Certificate</div>
            ${distinction ? `<div style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:${gold};font-weight:700">with distinction</div>` : ''}
            <div class="muted" style="font-size:14px;margin-top:22px">This certifies that</div>
            <div class="serif" style="font-size:38px;margin:10px 0 10px;padding:0 30px 10px;border-bottom:1px solid ${gold}">${esc(name)}</div>
            <div style="font-size:13.5px;max-width:5.5in;line-height:1.65;color:#4A5550">completed the Coll Ledger Academy's advanced program — accrual accounting and the close, tax compliance, and professional standards — and passed the advanced written examination and a graded month-end close with adjusting entries.</div>
            <div style="display:flex;gap:46px;margin-top:26px;font-size:12px;color:#6B756F"><div><div class="serif" style="font-size:20px;color:#16201C">${w}%</div>Written exam</div><div><div class="serif" style="font-size:20px;color:#16201C">${p}/100</div>Practical close</div><div><div class="serif" style="font-size:20px;color:#16201C">${fmtDate(date)}</div>Awarded</div></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:100%;margin-top:28px;font-size:11px;color:#4A5550;line-height:1.5;text-align:left">
              <div><div style="font-weight:700;color:${navy};letter-spacing:.06em;text-transform:uppercase;font-size:10px;margin-bottom:3px">Accrual &amp; close</div>Deferrals · accruals · depreciation · inventory · loans</div>
              <div><div style="font-weight:700;color:${navy};letter-spacing:.06em;text-transform:uppercase;font-size:10px;margin-bottom:3px">Tax compliance</div>Payroll · sales tax · business &amp; owner taxes · 1099s</div>
              <div><div style="font-weight:700;color:${navy};letter-spacing:.06em;text-transform:uppercase;font-size:10px;margin-bottom:3px">Professional standards</div>Internal controls · ethics · data security</div>
            </div>
            <div style="margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#6B756F">
              <div style="text-align:left"><div style="font-family:Georgia,serif;font-size:15px;color:#16201C;border-bottom:1px solid #16201C;padding-bottom:4px;margin-bottom:4px">Coll Business Solutions LLC</div>Issuer</div>
              <div style="text-align:right"><div style="font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#16201C;margin-bottom:4px">${id}</div>Credential ID · verify at collbusinesssolutions.com/verify</div>
            </div>
          </div></div>
        <div class="page"><div class="cap muted">Coll Ledger Academy · Advanced transcript</div><h1 class="serif" style="font-weight:400;font-size:28px;margin:4px 0 2px">${esc(name)}</h1><div class="muted" style="margin-bottom:22px">Credential ${id} · awarded ${fmtDate(date)}${distinction ? ' · with distinction' : ''}${t.cert ? ` · Professional Bookkeeping Certificate ${esc(t.cert.id)}` : ''} · about ${App.practice.fmtMins(App.practice.trackMins('adv'))} of coursework and exams</div>${transcript}
          <div style="font-weight:700;color:${navy};margin:8px 0 6px">Examinations</div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>Advanced written examination — ${DRAW} questions from a ${BANK.length}-question bank, ${Math.round(PASS * 100)}% to pass</span><b>${w}%</b></div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #E6E2D9;padding:5px 0"><span>Practical examination — month-end close with seven adjusting and correcting entries, graded on balances</span><b>${p}/100</b></div>
          <p class="muted" style="margin-top:26px;font-size:11px;line-height:1.6">This certificate is issued by Coll Business Solutions LLC for completion of its Coll Ledger training program. It is not a CPA license, an IRS credential, or a credential from a professional accounting body.</p></div>`), `Coll Ledger Advanced Accounting and Tax Certificate - ${name}.pdf`);
      setTimeout(credentialModal, 600);
    };
  }
  function credentialModal() {
    const cert = T().certAdv; if (!cert) return;
    const badge = o => AC().badgeSVG(Object.assign({ adv: true, distinction: cert.distinction, year: cert.date.slice(0, 4) }, o || {}));
    const li = 'https://www.linkedin.com/profile/add?' + new URLSearchParams({ startTask: 'CERTIFICATION_NAME', name: NAME, organizationName: 'Coll Business Solutions LLC', issueYear: cert.date.slice(0, 4), issueMonth: String(+cert.date.slice(5, 7)), certUrl: AC().verifyUrl(cert.id), certId: cert.id }).toString();
    const m = U.openModal(`${U.modalHead('Your advanced credential', 'Add it to LinkedIn next to your Professional certificate')}
      <div class="modal-body">
        <div class="cred-top"><div class="cred-badge">${badge()}</div><div class="cred-info"><div class="cap-label">Coll Business Solutions LLC</div><h3>${esc(NAME)}${cert.distinction ? ' <span class="tag gold">with distinction</span>' : ''}</h3>
          <div class="cred-rows"><div><span>Name</span><b>${esc(cert.name)}</b></div><div><span>Issued</span><b>${fmtDate(cert.date)}</b></div><div><span>Credential ID</span><b class="mono">${esc(cert.id)}</b></div><div><span>Credential URL</span><b class="mono ellip">${esc(AC().verifyUrl(cert.id))}</b></div></div></div></div>
        <div class="cred-steps">
          <div class="cred-step"><span class="n">1</span><div class="grow"><b>Add it to LinkedIn</b><div class="muted">Opens LinkedIn with the name, issuer, date, credential ID and link already filled in. Click <b>Save</b>.</div></div><button class="btn primary" data-c="li">Add to LinkedIn</button></div>
          <div class="cred-step"><span class="n">2</span><div class="grow"><b>Save the badge</b><div class="muted">The navy-and-gold advanced badge for your profile, résumé and website.</div></div><button class="btn" data-c="badge">${ICON.download}Badge</button></div>
          <div class="cred-step"><span class="n">3</span><div class="grow"><b>Get it registered for verification</b><div class="muted">${cert.registeredAsked ? 'Request sent — once Coll Business Solutions adds it, the credential link shows "Verified".' : 'Sends your credential to Coll Business Solutions so the link above shows "Verified" for anyone who checks.'}</div></div><button class="btn" data-c="reg">${ICON.mail}${cert.registeredAsked ? 'Send again' : 'Request'}</button></div>
          <div class="cred-step pa-step"><span class="n">4</span><div class="grow"><b>Next: an accredited program</b><div class="muted">College credit, the Enrolled Agent exam, and the CPA path.</div></div><button class="btn primary" data-c="prog">See programs ${ICON.right}</button></div>
          <div class="cred-step"><span class="n">${ICON.check}</span><div class="grow"><b>Certificate PDF and link</b><div class="muted">The printable certificate and transcript.</div></div><button class="btn ghost" data-c="copy">${ICON.copy}Copy link</button><button class="btn" data-c="pdf">${ICON.pdf}Certificate</button></div>
        </div></div>
      <div class="modal-foot"><button class="btn primary" data-action="close-modal">Done</button></div>`, { wide: true });
    $('[data-c=li]', m).onclick = () => AC().openLink(li);
    $('[data-c=badge]', m).onclick = async () => AC().saveImage(await AC().svgToPngBase64(badge(), 1200, 1200), 'Coll Ledger Advanced badge.png');
    $('[data-c=copy]', m).onclick = () => U.copyText(AC().verifyUrl(cert.id));
    $('[data-c=pdf]', m).onclick = () => { U.closeModal(); certificate(); };
    $('[data-c=prog]', m).onclick = () => { U.closeModal(); programsModal(); };
    $('[data-c=reg]', m).onclick = () => {
      const entry = JSON.stringify({ id: cert.id, name: cert.name, awarded: cert.date, written: cert.written, practical: cert.practical, distinction: cert.distinction, program: 'advanced' });
      const body = `Please register this Coll Ledger Academy advanced credential.\n\nName: ${cert.name}\nCredential ID: ${cert.id}\nAwarded: ${fmtDate(cert.date)}\nWritten exam: ${cert.written}%\nPractical close: ${cert.practical}/100${cert.distinction ? '\nWith distinction' : ''}\n\nTo register: on GitHub open the coll-landing-page repository → Actions → Register credential → Run workflow, paste this entry, and click Run.\nRegistry entry:\n${entry}\n\nCredential link: ${AC().verifyUrl(cert.id)}`;
      AC().openLink(`mailto:collbusinesssolutions@gmail.com?subject=${encodeURIComponent('Credential registration ' + cert.id)}&body=${encodeURIComponent(body)}`);
      cert.registeredAsked = today(); save(); U.toast('Opening your email — just press Send');
    };
  }

  // ------------------------------------------------------------------
  // Accredited programs and credentials (checked October 2026)
  // ------------------------------------------------------------------
  const PROGRAMS = [
    { name: 'Emily Griffith Technical College — Accounting', where: 'Denver · hybrid', acc: 'Accredited by the Council on Occupational Education', facts: ['About 10 months, part-time', 'About $5,145 and eligible for financial aid', 'Prepares for the QuickBooks Certified User exam and includes Tax Help Colorado volunteer tax experience'], best: 'Best if you like a structured class schedule and hands-on tax-season experience.', url: 'https://www.emilygriffith.edu/programs/accounting/' },
    { name: 'Front Range Community College — Accounting', where: 'Online · Westminster · Boulder County · Larimer', acc: 'Accredited by the Higher Learning Commission', facts: ['Bookkeeping Certificate — 19 credits, about two semesters, online', 'Tax Preparation Certificate — 18 credits, online', 'AAS in Accounting — 60 credits; certificate courses count toward it'], best: 'Best if you want to study online and earn college credit that builds toward a degree.', url: 'https://frontrange.edu/programs-courses/program-list/accounting.html' },
    { name: 'Red Rocks Community College — Accounting', where: 'Lakewood area · online and flexible options', acc: 'Accredited by the Higher Learning Commission', facts: ['Bookkeeping Clerk, Accounting Clerk and Accounting Fundamentals certificates', 'Individual Tax Preparer and Individual Tax Paraprofessional certificates', 'Accounting Technician and Accounting Paraprofessional AAS degrees'], best: 'Best if you want a menu of short certificates, including tax preparation.', url: 'https://rrcc.edu/node/306' }
  ];
  const CREDS = [
    { name: 'IRS Enrolled Agent (EA)', facts: ['Prepare returns and represent taxpayers before the IRS', 'No degree required: get a PTIN, pass the three-part Special Enrollment Examination ($317 per part), pass a suitability check', '72 hours of continuing education every three years (at least 16 a year, 2 on ethics)'], url: 'https://www.irs.gov/tax-professionals/enrolled-agents/enrolled-agents-frequently-asked-questions' },
    { name: 'CPA — Colorado', facts: ['A state license from the Colorado State Board of Accountancy', 'New pathways begin January 1, 2027: bachelor\'s + 30 credits + 1 year of experience; bachelor\'s + 2 years; or master\'s + 1 year', 'All require the Uniform CPA Exam, a professional ethics course, and experience verified by a CPA'], url: 'https://cocpa.org/legislative-advocacy/licensure-pathways' },
    { name: 'QuickBooks Online certification (ProAdvisor)', facts: ['Free with a QuickBooks Online Accountant account', 'Required to be listed in Intuit\'s Find-a-ProAdvisor directory'], url: 'https://quickbooks.intuit.com/accountants/training-certification/certification/' }
  ];
  function programsModal() {
    T().flags.programs = true; save(); setTimeout(() => App.practice.sweep && App.practice.sweep(), 50);
    const open = u => AC().openLink(u);
    const m = U.openModal(`${U.modalHead('Your next step: an accredited program', 'College credit and recognized credentials that build on everything you\'ve learned')}
      <div class="modal-body">
        <div class="pa-hero"><div class="pa-ic">${ICON.spark}</div><div><b>Our recommendation</b><div class="muted">Keep working with clients and take one accredited certificate alongside it. <b>Front Range's online Bookkeeping or Tax Preparation certificate</b> fits around work and its credits count toward an associate degree; <b>Emily Griffith</b> is the pick if you'd like a set schedule in Denver and real tax-season experience. If tax work excites you, the <b>Enrolled Agent</b> exam is the fastest route to a credential that lets you represent clients before the IRS.</div></div></div>
        <div class="cap-label" style="margin-top:16px">Accredited programs in Colorado</div>
        <div class="prog-list">${PROGRAMS.map((p, i) => `<div class="prog"><div class="prog-head"><div><b>${esc(p.name)}</b><div class="muted">${esc(p.where)}</div></div><span class="tag green">${ICON.check}${esc(p.acc.replace('Accredited by the ', ''))}</span></div><ul>${p.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul><div class="prog-foot"><span class="muted">${esc(p.best)}</span><button class="btn sm primary" data-pg="${i}">Visit and apply ${ICON.right}</button></div></div>`).join('')}</div>
        <div class="cap-label" style="margin-top:16px">Professional credentials</div>
        <div class="prog-list">${CREDS.map((p, i) => `<div class="prog"><div class="prog-head"><b>${esc(p.name)}</b></div><ul>${p.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul><div class="prog-foot"><span></span><button class="btn sm" data-cr="${i}">Learn more ${ICON.right}</button></div></div>`).join('')}</div>
        <p class="muted" style="font-size:11.5px;margin:12px 0 0">Program details, costs and schedules were checked in October 2026 and can change — confirm with each school. Ask about financial aid, credit for prior learning, and whether credits transfer. Coll Ledger isn't affiliated with any of these schools.</p>
      </div>
      <div class="modal-foot"><button class="btn primary" data-action="close-modal">Done</button></div>`, { wide: true });
    $$('[data-pg]', m).forEach(b => b.onclick = () => open(PROGRAMS[+b.dataset.pg].url));
    $$('[data-cr]', m).forEach(b => b.onclick = () => open(CREDS[+b.dataset.cr].url));
  }

  act({
    'ax-start': () => App.examGate('advWritten', T().advWritten, 'Advanced written exam', () => { S.ui.exam = newAttempt(); render(); $('#view').scrollTop = 0; }),
    'ax-close': () => { S.ui.exam = null; render(); },
    'ax-pick': el => { const E = S.ui.exam; E.answers[E.qs[E.at].i] = +el.dataset.a; render(); },
    'ax-move': el => { const E = S.ui.exam; E.at = Math.max(0, Math.min(E.qs.length - 1, E.at + +el.dataset.d)); render(); },
    'ax-jump': el => { S.ui.exam.at = +el.dataset.k; render(); },
    'ax-submit': async () => {
      const E = S.ui.exam;
      if (!await U.confirmBox({ title: 'Submit your answers?', body: 'You can\'t change them after this.', ok: 'Submit' })) return;
      const score = E.qs.filter(q => E.answers[q.i] === BANK[q.i][3]).length;
      const res = { date: today(), score, total: E.qs.length, pct: score / E.qs.length, passed: score / E.qs.length >= PASS, at: Date.now(), mins: Math.round((Date.now() - E.started) / 60000) };
      T().advWritten.push(res); save(); App.tries.record('advWritten', res.passed); E.done = true; E.result = res; render(); $('#view').scrollTop = 0;
    },
    'ax-prac-start': () => start(false),
    'ax-prac-open': () => start(false),
    'ax-prac-reset': async () => { if (!await U.confirmBox({ title: 'Start the practical over?', body: 'Aspen Trail Outfitters goes back to the beginning.', ok: 'Start over' })) return; S.ui.advGrade = null; start(true); go('training'); },
    'ax-prac-grade': async () => {
      const c = examClient(); if (!c) return;
      if (App.tries.blocked('advPractical', 'Grading')) return;
      if (!await U.confirmBox({ title: 'Grade your work?', body: `Each grading counts as a try. ${App.tries.line('advPractical')}`, ok: 'Grade it' })) return;
      const r = grade(c); S.ui.advGrade = r; App.tries.record('advPractical', r.passed);
      const t = T(); if (!t.advPractical || r.score > t.advPractical.score || (r.passed && !t.advPractical.passed)) t.advPractical = { score: r.score, passed: r.passed, date: today() };
      save(); if (S.route.page !== 'training') { t.track = 'adv'; t.currentAdv = 'adv-exam-practical'; go('training'); } else render();
      U.toast(r.passed ? `Practical passed — ${r.score}/100` : `${r.score}/100 — ${App.tries.afterMiss('advPractical')}`);
    },
    'adv-cert': () => T().certAdv ? credentialModal() : certificate(),
    'adv-programs': () => programsModal()
  });

  App.advanced = { BANK, DRAW, PASS, renderWritten, renderPractical, writtenPassed, practicalPassed: () => !!(T().advPractical && T().advPractical.passed), certificate, credentialModal, programsModal, build, grade, examClient };
})();
