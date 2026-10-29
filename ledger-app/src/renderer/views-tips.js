'use strict';
/* =====================================================================
   Coll Ledger Academy — Pro tips for every lesson
   Practical habits from working bookkeepers: things that save time,
   prevent mistakes and make clients' lives easier.
   ===================================================================== */
window.ACADEMY_TIPS = {
  // ---------------- Level 1 · Foundations ----------------
  basics: [
    'Before you categorize anything, ask: <b>"What did the business get, and where did the money come from?"</b> It answers almost every bookkeeping question.',
    'Keep the chart of accounts short. Twenty to forty categories a client actually uses beats a hundred nobody understands.',
    'Name categories the way the owner talks ("Ingredients", not "Raw Materials COGS – Food") — reports they understand are reports they read.'
  ],
  tour: [
    'Start each workday on <b>All clients</b>: it shows who needs you most, so the urgent work gets done first.',
    'Learn three shortcuts and you\'ll fly: <span class="kbd">Ctrl</span> <span class="kbd">K</span> to find anything, <span class="kbd">N</span> for a new transaction, <span class="kbd">I</span> for an invoice.',
    'When a client asks "how are we doing?", answer with three numbers: cash in the bank, profit this year, and what customers owe.'
  ],
  import: [
    'Download bank files on the same day each month (the 3rd works well — after statements close). A routine beats remembering.',
    'Import the <b>whole month</b>, even if some days overlap — Coll Ledger skips what\'s already in, so overlap is safe and gaps are not.',
    'Ask clients for read-only bank access so you can download files yourself instead of waiting on emails.'
  ],
  review: [
    'Sort To Review by payee in your head: do every Amazon line together, then every Gusto line. Batching is twice as fast as bouncing around.',
    'When you\'re unsure, add a to-do for the client instead of guessing — and send all the questions in one email at month end.',
    'Watch the amount, not just the payee: a $4.99 Apple charge is probably a subscription; a $1,299 Apple charge is probably equipment.'
  ],
  rules: [
    'Make a rule the <b>second</b> time you see a vendor, not the tenth. Rules pay for themselves within a month.',
    'Keep rule words short and specific ("gusto", "xcel energy") — long rules break when banks change their descriptions.',
    'Turn a rule to Automatic only after it\'s been right for two months in a row.'
  ],
  split: [
    'Costco, Walmart, Amazon and Target receipts are the usual split candidates — ask clients to snap a photo of those receipts at the register.',
    'If a split is under a few dollars of difference, put the small part in the main category. Your time costs more than the precision.',
    'When a client mixes personal items in, split the personal part to Owner\'s Draw — and gently suggest a separate card.'
  ],
  invoices: [
    'Put the payment instructions (Zelle, ACH, check address) on every invoice — clear instructions get paid faster.',
    'Send invoices the day work is done. Every week of delay adds roughly a week to when you get paid.',
    'Use short terms for small jobs (due on receipt or 15 days); 30 days is a habit, not a rule.'
  ],
  reconcile: [
    'Reconcile in the same order every month: checking, savings, then each card. Consistency is how you catch what\'s missing.',
    'If the difference is a round number, look for a missing transfer or deposit. If it divides by 9, look for swapped digits.',
    'Never "force" a reconciliation with an adjustment you can\'t explain — leave a note and ask instead.'
  ],
  square: [
    'Square\'s "Transactions" export is the one you want — not the deposits report — because it shows sales, tax, tips and fees separately.',
    'Check that the Square clearing account trends back toward zero each month; a growing balance means deposits are being categorized as sales.',
    'Tips belong to employees. Make sure the client pays them out through payroll so the Tips Payable balance clears.'
  ],
  close: [
    'Close each month by the 10th of the next one. Clients trust bookkeepers who deliver on a predictable day.',
    'Read the P&L like the owner would before you send it: anything surprising should have an explanation in your email.',
    'Lock the month right after sending reports — it protects you if someone edits something later.'
  ],
  // ---------------- Level 2 · Month-end professional ----------------
  debits: [
    'Remember <b>DEALER</b>: Draws, Expenses, Assets increase with debits; Liabilities, Equity, Revenue increase with credits.',
    'Bank statements use the bank\'s point of view — a "credit" on your statement is money <i>in</i>, which is a <i>debit</i> to Cash in your books. Don\'t let that trip you up.',
    'When a CPA says "debit X, credit Y", repeat it back with amounts before you post it. Saying it out loud catches reversed entries.'
  ],
  bills: [
    'Enter bills the day they arrive, with the due date — then you can tell the owner exactly what\'s coming each week.',
    'Pay bills in a weekly batch (Tuesday works well) instead of one at a time. Fewer interruptions, fewer mistakes.',
    'If a vendor offers an early-payment discount (like 2% if paid in 10 days), point it out — on $10,000 a month that\'s real money.'
  ],
  payroll: [
    'Download the payroll provider\'s "payroll journal" or summary report for each pay date — it has every number you need for the split.',
    'If the provider takes taxes in a separate withdrawal, categorize that one to Payroll Taxes and the net-pay withdrawal to Payroll & Wages.',
    'Once a quarter, compare total wages in the books to the Form 941 the provider filed. They should match to the penny.'
  ],
  journals: [
    'Write a clear memo on every journal entry ("AJE #3 from Smith CPA — 2026 depreciation"). Future you will be grateful.',
    'Attach the CPA\'s email or schedule to the entry so the support travels with it.',
    'Use the automatic reversal for accruals — it\'s the most common way bookkeepers accidentally double-count expenses.'
  ],
  receipts: [
    'Ask clients to photograph receipts the moment they get them — a receipt in a pocket for a month is a receipt that\'s gone.',
    'For meals, have clients write who attended and the business reason on the receipt before snapping the photo.',
    'Email receipts (software, online orders) can be saved as PDFs and read in one step.'
  ],
  cleanup: [
    'Run Clean up right before closing every month — it takes ten seconds and catches the mistakes clients notice first.',
    'Two identical charges on the same day aren\'t always duplicates (two coffees, two tickets). Check the statement before removing one.',
    'Keep Uncategorized at zero at month end. If you can\'t place something, it\'s a question for the client.'
  ],
  troubleshoot: [
    'Divide the difference by 2: if a matching amount exists, something was recorded with the wrong sign (a deposit entered as a payment).',
    'Divide by 9: a whole number means two digits are probably swapped.',
    'Check the statement\'s beginning balance against last month\'s reconciled ending balance — if they don\'t match, last month was changed.'
  ],
  monthwrap: [
    'Remind clients about mileage in your month-end email — most owners forget to log trips, and it\'s often their biggest missed deduction.',
    'Send payment reminders on a schedule: friendly at 7 days late, firm at 30, final at 60. Consistency gets results without awkwardness.',
    'Keep your month-end email short enough to read on a phone: four numbers, one insight, one question.'
  ],
  // ---------------- Level 3 · Client advisor ----------------
  planning: [
    'Look at the 90-day forecast before every client call — "you may run short in early March" is the kind of insight clients pay for.',
    'Start budgets from last year\'s actuals, then adjust for known changes (a new lease, a price increase). Blank-page budgets are guesses.',
    'Review budget vs. actual quarterly, not just at year end, so there\'s still time to change course.'
  ],
  ownertax: [
    'Suggest clients open a separate savings account just for taxes and move the set-aside amount there every month.',
    'Put the four estimated-tax due dates on the client\'s calendar the day you start working together.',
    'When profit jumps, warn the owner right away — the next estimated payment probably needs to go up.'
  ],
  entities: [
    'At onboarding, ask for the most recent tax return. The form number (Schedule C, 1065, 1120-S) tells you how the business is taxed.',
    'If an S-corp owner has no payroll set up, raise it with the client and the CPA in writing — it\'s a common and costly problem.',
    'For partnerships, keep a separate draw account for each partner so the year-end K-1 work is easy.'
  ],
  health: [
    'Compare this month to the same month last year, not just to last month — seasonal businesses look scary month to month.',
    'Pick one number per client that matters most (food cost for a café, days to get paid for a contractor) and track it every month.',
    'Explain numbers as stories: "For every $100 of sales, you keep $9" lands better than "net margin is 9%".'
  ],
  yearend: [
    'Collect W-9s when a vendor is set up, not in January — chasing W-9s at year end is everyone\'s least favorite task.',
    'Run the 1099 report in early December to catch missing tax IDs while there\'s still time.',
    'Send the CPA package by mid-February for partnerships and S-corps (due March 15) and by early March for sole proprietors.'
  ],
  // ---------------- Level 4 · Running your practice ----------------
  onboard: [
    'Don\'t start work until the engagement letter is signed and you have read-only bank access — those two things prevent most problems.',
    'Ask "Is there anything about your finances that worries you?" in the first meeting. You\'ll learn more from that than from any report.',
    'Set the books\' start date at the beginning of a month (ideally a year) so opening balances are easy to verify.'
  ],
  pricing: [
    'Raise prices for new clients first; existing clients can follow at their annual review with 30 days\' notice.',
    'Track your actual hours per client for three months. If one client takes twice the time of a similar one, their fee should reflect it.',
    'Offer three packages (basic, standard, advisory). Most people choose the middle one.'
  ],
  engagement: [
    'Send the letter with your proposal, not after the client says yes — it sets expectations from the start.',
    'Renew or confirm letters every year; scope quietly grows otherwise.',
    'When a request is out of scope, say "Happy to — here\'s what that costs" instead of "That\'s not included."'
  ],
  catchup: [
    'Before quoting, ask for one month of statements for every account — the volume and mess tell you how long it will really take.',
    'Work oldest to newest and reconcile each month before moving on. Never skip ahead.',
    'Give the client a simple progress update weekly ("4 of 9 months done"). Silence makes clients nervous.'
  ],
  industries: [
    'Ask every new client what their CPA wants to see at year end, then set up categories to match from day one.',
    'For restaurants, watch food cost and labor each as a share of sales — together they usually decide whether the business makes money.',
    'For contractors, collect W-9s from every subcontractor before the first payment and track jobs from the start.'
  ],
  pro: [
    'Use a password manager and turn on two-factor login for your email — your email is the key to every client account.',
    'Never take client documents through plain email if you can avoid it; use a secure upload link.',
    'Keep a short "decisions log" per client in Coll Ledger notes: what was decided, by whom, and when.'
  ],
  quickbooks: [
    'Before converting, run a QuickBooks Balance Sheet for the conversion date — your opening balances should match it exactly.',
    'Export customers and vendors first so invoice and bill history finds the right names.',
    'Keep the client\'s QuickBooks login active (read-only) for a few months after converting, in case you need to look something up.'
  ],
  // ---------------- Advanced Accounting & Tax ----------------
  'adv-accrual': [
    'Keep a running list of deposits held for future work. Review it monthly and move each one to income as the work is delivered.',
    'For businesses on the cash basis for taxes, accrual-basis monthly reports can still be more useful — just tell the CPA which basis you used.',
    'Recognize subscription and retainer income month by month — it makes profit steadier and more meaningful.'
  ],
  'adv-prepaid': [
    'Set up a simple schedule for each prepaid item (annual insurance, software, rent) and post the monthly entry on the same day you close.',
    'Ask clients for invoices received after month end before you close — they reveal expenses you should accrue.',
    'Small, recurring items (under a few hundred dollars) usually aren\'t worth accruing. Save accruals for amounts that change the picture.'
  ],
  'adv-assets': [
    'Keep a fixed-asset list with date, description, cost and serial number — the CPA and the insurance company will both ask for it.',
    'Write down the client\'s capitalization policy (for example, "items over $2,500 are capitalized") and apply it consistently.',
    'When equipment is sold or scrapped, tell the CPA right away so the disposal is handled on the tax return.'
  ],
  'adv-inventory': [
    'Count inventory on the last day of the month (or first morning of the next) — before any new sales or deliveries.',
    'Count by item and cost, not by retail price. Inventory is valued at what the business paid.',
    'If shrinkage grows month after month, suggest simple controls: locked storage, receiving checklists, spot counts.'
  ],
  'adv-loans': [
    'Ask the lender for an amortization schedule at closing and save it with the loan account — then each month\'s split is a lookup.',
    'Reconcile every loan balance to the lender\'s statement at least quarterly.',
    'Credit lines (revolving loans) usually charge interest on the average balance — use the statement\'s interest amount, not a formula.'
  ],
  'adv-close': [
    'Before the CPA hand-off, read the Trial Balance top to bottom: any balance with an odd sign (a negative expense, a debit liability) needs a look.',
    'Explain big changes in cash with a three-line story: "Cash went up $20,000: profit $35,000, minus $10,000 for the van, minus $5,000 to pay down the loan."',
    'Lock the prior year as soon as the tax return is filed so it stays exactly as reported.'
  ],
  'adv-payroll': [
    'Put the 941 due dates (April 30, July 31, October 31, January 31) on your calendar for every payroll client.',
    'New hires fill out a W-4 and Section 1 of the I-9 by their first day; the employer must finish the I-9 within three business days of the start date.',
    'If a client pays someone a regular weekly amount as a "contractor" and controls their schedule, raise the classification question with the CPA.'
  ],
  'adv-salestax': [
    'At onboarding, list every location where the client sells or delivers. That list decides which jurisdictions they owe.',
    'Reconcile Sales Tax Payable to each filed return: after paying, the balance for that period should be zero.',
    'Keep resale and exemption certificates in one folder per client — an auditor will ask for them.'
  ],
  'adv-biztax': [
    'Ask the CPA in October what they want in the year-end package and by when — then deliver it a week early.',
    'Keep nondeductible items (fines, entertainment, political donations) in their own accounts so the CPA spots them instantly.',
    'Send a short cover note with the package: anything unusual this year, big purchases, new loans, owner changes.'
  ],
  'adv-owners': [
    'Show clients the "safe harbor" number in January — it gives them a fixed target for the whole year.',
    'When an owner has a big one-time gain (selling equipment, a huge contract), flag it so the next estimate can be adjusted.',
    'Remind S-corp owners that salary and distributions should both run through the books — never as unexplained transfers.'
  ],
  'adv-info': [
    'Request W-9s by email with a short, friendly template — and don\'t release the first payment until it\'s back.',
    'Use the IRS\'s free IRIS portal to e-file 1099s; it\'s straightforward once you\'ve done it once.',
    'In early January, send each contractor a heads-up: "Your 1099 will arrive by January 31 — please confirm your mailing address."'
  ],
  'adv-controls': [
    'Recommend that the owner opens the bank statement themselves each month — it\'s the single most effective fraud deterrent.',
    'Never change a vendor\'s bank details based on an email alone. Call a number you already have.',
    'Mandatory vacations aren\'t just kind — schemes often surface when someone else has to do the job for a week.'
  ],
  'adv-ethics': [
    'Keep a written information security plan, even a one-page one: where data lives, who can access it, how it\'s backed up, what to do if it leaks.',
    'When you decline a request on ethical grounds, put it in a short, polite email so there\'s a record.',
    'If you\'re ever unsure whether something is within your competence, it\'s fine to say "Let me confirm with the CPA." Clients respect it.'
  ],
  'adv-path': [
    'Take one community-college course at a time while you work — employers and clients value steady progress.',
    'Many Colorado community-college credits transfer to four-year degrees, which matters if you\'re considering the CPA path.',
    'Ask your CPA contacts which credential they\'d hire for. Local advice beats any ranking website.'
  ]
};
