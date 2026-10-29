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
    'Keep the chart of accounts lean. Twenty to forty accounts the client actually uses beat a hundred nobody understands.',
    'Name accounts the way the owner talks ("Ingredients," not "Raw Materials COGS – Food"). Reports they understand are reports they read.'
  ],
  tour: [
    'Start each workday on <b>All clients</b>. It shows who needs you most, so the urgent work gets done first.',
    'Learn three keys and you\'ll rarely reach for the mouse: <span class="kbd">Ctrl</span> <span class="kbd">K</span> to find anything, <span class="kbd">N</span> for a new transaction and <span class="kbd">I</span> for a new invoice.',
    '<span class="kbd">Ctrl</span> <span class="kbd">K</span> runs actions too. Type "log a trip" or "month-end email" and press Enter instead of hunting through menus.'
  ],
  import: [
    'Download bank files on the same day each month (the 3rd works well, after statements close) and name them the same way every time, like "Bakery – Checking – 2026-09.csv".',
    'Import the <b>whole month</b>, even if some days overlap. Coll Ledger skips what\'s already in, so overlap is safe and gaps are not.',
    'Skip the Import page: drag a bank file anywhere onto the Coll Ledger window and it lands in To Review.'
  ],
  review: [
    'Work To Review from the keyboard: <span class="kbd">↑</span> <span class="kbd">↓</span> to move, <span class="kbd">C</span> to change the category, <span class="kbd">S</span> to split and <span class="kbd">Enter</span> to accept.',
    'When you\'re unsure, add a to-do for the client instead of guessing, then send all the questions in one email at month end. One list gets answered; ten separate texts get ignored.',
    'Watch the amount, not just the payee: a $4.99 Apple charge is probably a subscription; a $1,299 Apple charge is probably equipment.'
  ],
  rules: [
    'Make a rule the <b>second</b> time you see a vendor, not the tenth. Rules pay for themselves within a month.',
    'Keep rule words short and specific ("gusto," "xcel energy"). Long rules break when banks change their descriptions.',
    'Switch a rule to <b>Automatic</b> only after its suggestions have been right two months in a row. Automatic matches skip To Review, so a bad rule hides its own mistakes.'
  ],
  split: [
    'Costco, Walmart, Amazon and Target are the usual split candidates. Ask clients to snap a photo of those receipts at the register.',
    'If the odd item is only a few dollars, leave it in the main category. Your time costs more than the precision.',
    'When a client mixes in personal items, split the personal part to <b>Owner\'s Draw</b> and gently suggest a separate card.'
  ],
  invoices: [
    'Put payment instructions (Zelle, ACH, check address) in <b>Message on the invoice</b>. Clear instructions get paid faster.',
    'Send invoices the day the work is done. Every day an invoice waits is a day added to when you get paid.',
    'Use short terms for small jobs (due on receipt or 15 days). Thirty days is a habit, not a rule.'
  ],
  reconcile: [
    'Reconcile in the same order every month: checking, savings, then each card. Consistency is how you notice what\'s missing.',
    'If the difference is a round number, look for a missing transfer or deposit. If it divides evenly by 9, look for swapped digits.',
    'Never "force" a reconciliation with an adjustment you can\'t explain. Leave a note and ask instead.'
  ],
  square: [
    'Export Square\'s <b>Transactions CSV</b>, not the deposits report. It shows sales, tax, tips and fees separately.',
    'The <b>Square</b> account should drift back toward zero each month. A growing balance usually means bank deposits were categorized as Sales instead of as transfers from Square.',
    'Tips belong to employees. Make sure the client pays them out through payroll so <b>Tips Payable</b> clears each pay period.'
  ],
  close: [
    'Close each month by the 10th of the next one. Clients trust bookkeepers who deliver on a predictable day.',
    'Read the Profit &amp; Loss the way the owner would before you send it. Anything surprising should have an explanation in your email.',
    'Close the month right after you send reports. The lock protects you if someone edits something later.'
  ],
  // ---------------- Level 2 · Month-end professional ----------------
  debits: [
    'Remember <b>DEALER</b>: Draws, Expenses and Assets increase with debits; Liabilities, Equity and Revenue increase with credits.',
    'Bank statements use the bank\'s point of view. A "credit" on the statement is money <i>in</i>, which is a <i>debit</i> to cash in your books.',
    'When a CPA says "debit X, credit Y," repeat it back with the amounts before you post it. Saying it out loud catches reversed entries.'
  ],
  bills: [
    'Enter bills the day they arrive, with the due date. Then you can tell the owner exactly what\'s due each week.',
    'For rent, loan payments and subscriptions, open the bill and choose More → <b>Repeat this bill</b> so next month\'s copy appears on its own.',
    'Point out early-payment discounts (like 2% if paid within 10 days): $10,000 × 2% = $200 saved on a single bill.'
  ],
  payroll: [
    'Check every payday: gross wages plus employer taxes should equal the total the provider took from the bank. If they don\'t, a withdrawal is missing or split wrong.',
    'If the provider takes taxes in a separate withdrawal, don\'t put all of it in <b>Payroll Taxes</b>. The employee withholding inside it is part of gross wages, so split it using the payroll report.',
    'Once a quarter, compare total wages in the books to the Form 941 the provider filed. If they don\'t match, find out why before the next quarter.'
  ],
  journals: [
    'Write a clear memo on every journal entry ("AJE #3 from Smith CPA — 2026 depreciation"). Future you will be grateful.',
    'Attach the CPA\'s email or schedule to the entry so the support travels with it.',
    'On accruals, tick <b>Reverse it automatically</b>. Forgetting to reverse is the most common way bookkeepers double-count expenses.'
  ],
  receipts: [
    'Ask clients to photograph receipts the moment they get them. A receipt in a pocket for a month is a receipt that\'s gone.',
    'For meals, have clients write who attended and the business reason on the receipt before they snap the photo.',
    'Save email receipts (software, online orders) as PDFs. <b>Read a receipt</b> reads PDFs as well as photos.'
  ],
  cleanup: [
    'Run <b>Clean up</b> right before you close every month. It takes ten seconds and catches the mistakes clients notice first.',
    'Two identical charges on the same day aren\'t always duplicates (two coffees, two tickets). Check the statement before you remove one.',
    'Keep Uncategorized Income and Uncategorized Expense at zero at month end. If you can\'t place something, it\'s a question for the client.'
  ],
  troubleshoot: [
    'Divide the difference by 2. If a transaction for that amount exists, it was probably recorded with the wrong sign (a deposit entered as a payment).',
    'Divide the difference by 9. If it comes out even, two digits are probably swapped (for example, $54 typed as $45).',
    'Check the statement\'s beginning balance against last month\'s reconciled ending balance. If they don\'t match, something in last month was changed.'
  ],
  monthwrap: [
    'Ask about mileage in every month-end email. Most owners forget to log trips, and it\'s often their biggest missed deduction.',
    'Send payment reminders on a schedule: friendly at 7 days late, firm at 30, final at 60. <b>Send reminders</b> has a template for each tone.',
    'Keep your month-end email short enough to read on a phone: four numbers, one insight, one question.'
  ],
  // ---------------- Level 3 · Client advisor ----------------
  planning: [
    'Look at the 90-day cash forecast before every client call. "You may run short in early March" is the kind of insight clients pay for.',
    'Start budgets from last year\'s actuals, then adjust for known changes (a new lease, a price increase). Blank-page budgets are guesses.',
    'Review budget vs. actual every quarter, not just at year end, so there\'s still time to change course.'
  ],
  ownertax: [
    'Suggest clients open a separate savings account just for taxes and move the set-aside amount there every month.',
    'Put the four estimated-tax due dates (April 15, June 15, September 15 and January 15) on the client\'s calendar the day you start working together.',
    'When profit jumps, tell the owner right away. The next estimated payment probably needs to go up.'
  ],
  entities: [
    'At onboarding, ask for the most recent tax return. The form (Schedule C, Form 1065, Form 1120-S or Form 1120) tells you how the business is taxed.',
    'If an S corporation owner has no payroll set up, raise it with the client and the CPA in writing. It\'s a common and costly problem.',
    'For partnerships, keep a separate draw account for each partner so the year-end K-1 work is easy.'
  ],
  health: [
    'Compare this month to the same month last year, not just to last month. Seasonal businesses look scary month to month.',
    'Pick the one number that matters most for each client (food cost for a café, days to get paid for a contractor) and track it every month.',
    'Explain numbers as stories: "For every $100 of sales, you keep $9" lands better than "Net margin is 9%."'
  ],
  yearend: [
    'Collect W-9s when a vendor is set up, not in January. Chasing W-9s at year end is everyone\'s least favorite task.',
    'Run the <b>1099 Contractors</b> report in early December. It flags anyone missing a W-9 while there\'s still time to chase it.',
    'Send the CPA package by mid-February for partnerships and S corporations (due March 15) and by early March for sole proprietors.'
  ],
  // ---------------- Level 4 · Running your practice ----------------
  onboard: [
    'Don\'t start work until the engagement letter is signed and you have read-only bank access. Those two things prevent most problems.',
    'Ask "Is there anything about your finances that worries you?" in the first meeting. You\'ll learn more from that than from any report.',
    'Start the books on the first day of a month (ideally January 1) so opening balances are easy to verify against a statement.'
  ],
  pricing: [
    'Raise prices for new clients first; existing clients can follow at their annual review with 30 days\' notice.',
    'Track your actual hours per client for three months. If one client takes twice the time of a similar one, their fee should reflect it.',
    'Offer three packages (basic, standard, advisory). Most clients pick the middle one, so make it the one you most want to sell.'
  ],
  engagement: [
    'Send the letter with your proposal, not after the client says yes. It sets expectations from the start.',
    'Renew or confirm the letter every year. Otherwise, scope quietly grows.',
    'When a request is out of scope, say "Happy to — here\'s what that costs" instead of "That\'s not included."'
  ],
  catchup: [
    'Before quoting, ask for one month of statements for every account. The volume and the mess tell you how long it will really take.',
    'Work oldest to newest and reconcile each month before moving on. Never skip ahead.',
    'Send the client a short progress update every week ("4 of 9 months done"). Silence makes clients nervous.'
  ],
  industries: [
    'Ask every new client what their CPA wants to see at year end, then set up accounts to match from day one.',
    'For restaurants, watch food cost and labor, each as a share of sales. Together they usually decide whether the business makes money.',
    'For contractors, collect a W-9 from every subcontractor before the first payment and track each job from the start.'
  ],
  pro: [
    'Use a password manager and turn on two-factor login for your email. Your email is the key to every client account.',
    'Don\'t accept client documents by plain email if you can avoid it. Use a secure upload link.',
    'Keep a short decisions log in each client\'s Dashboard notes: what was decided, by whom and when.'
  ],
  quickbooks: [
    'Before converting, run a QuickBooks Balance Sheet for the conversion date. Your opening balances should match it exactly.',
    'Bring data over in order: chart of accounts, then customers and vendors, then transactions. Each step gives the next one the names it needs to match.',
    'Keep the client\'s QuickBooks login active (read-only) for a few months after converting, in case you need to look something up.'
  ],
  // ---------------- Advanced Accounting & Tax ----------------
  'adv-accrual': [
    'Keep a running list of deposits held for future work. Review it monthly and move each one to income as the work is delivered.',
    'Even when the tax return is on the cash basis, accrual-basis monthly reports can be more useful. Just tell the CPA which basis you used.',
    'Recognize subscription and retainer income month by month. It makes profit steadier and more meaningful.'
  ],
  'adv-prepaid': [
    'Keep a schedule for each prepaid item (annual insurance, software, rent) and post the monthly entry the day you close. On Journal entries, <b>From a template</b> → Use up a prepaid expense fills in both accounts.',
    'Ask clients for invoices received after month end before you close. They reveal expenses you should accrue.',
    'Small, recurring items (under a few hundred dollars) usually aren\'t worth accruing. Save accruals for amounts that change the picture.'
  ],
  'adv-assets': [
    'Keep a fixed-asset list with date, description, cost and serial number. The CPA and the insurance company will both ask for it.',
    'Write down the client\'s capitalization policy (for example, "items over $2,500 are capitalized") and apply it consistently.',
    'When equipment is sold or scrapped, tell the CPA right away so the disposal is handled on the tax return.'
  ],
  'adv-inventory': [
    'Count inventory on the last day of the month (or the first morning of the next), before any new sales or deliveries.',
    'Count by item and cost, not by retail price. Inventory is valued at what the business paid.',
    'If shrinkage grows month after month, suggest simple controls: locked storage, receiving checklists and spot counts.'
  ],
  'adv-loans': [
    'Ask the lender for an amortization schedule at closing and save it with the loan account. Then each month\'s split is a lookup.',
    'Reconcile every loan balance to the lender\'s statement at least quarterly.',
    'Credit lines (revolving loans) usually charge interest on the average daily balance. Use the interest shown on the statement, not a formula.'
  ],
  'adv-close': [
    'Before the CPA hand-off, read the Trial Balance top to bottom. Any balance with an odd sign (a negative expense, a debit liability) needs a look.',
    'Explain big changes in cash with a three-line story: "Cash went up $20,000: profit of $35,000, minus $10,000 for the van, minus $5,000 to pay down the loan."',
    'Lock the prior year as soon as the tax return is filed so it stays exactly as reported.'
  ],
  'adv-payroll': [
    'Put the Form 941 due dates (April 30, July 31, October 31 and January 31) on your calendar for every payroll client.',
    'New hires fill out a W-4 and Section 1 of the I-9 by their first day; the employer must finish the I-9 within three business days of the start date.',
    'If a client pays a "contractor" the same amount every week and controls their schedule, raise the classification question with the CPA.'
  ],
  'adv-salestax': [
    'At onboarding, list every location where the client sells or delivers. In Colorado, flag any home-rule city (Denver and Boulder, for example) that collects its own sales tax apart from the state.',
    'Reconcile Sales Tax Payable to each filed return. After the payment, the balance for that period should be zero.',
    'Keep resale and exemption certificates in one folder per client. An auditor will ask for them.'
  ],
  'adv-biztax': [
    'Ask the CPA in October what they want in the year-end package and by when, then deliver it a week early.',
    'Keep nondeductible items (fines, entertainment, political donations) in their own accounts so the CPA spots them instantly.',
    'Send a short cover note with the package: anything unusual this year, big purchases, new loans and owner changes.'
  ],
  'adv-owners': [
    'Show clients the safe harbor number in January. It gives them a fixed target for the whole year.',
    'When an owner has a big one-time gain (selling equipment, a huge contract), flag it so the next estimate can be adjusted.',
    'Remind S corporation owners that salary and distributions both need to run through the books, never as unexplained transfers.'
  ],
  'adv-info': [
    'Request W-9s by email with a short, friendly template, and don\'t release the first payment until it\'s back.',
    'Tick <b>Contractor who gets a 1099</b> and enter the tax ID on the vendor in Customers &amp; Vendors the day you set them up. Then the 1099 Contractors report is ready in January.',
    'In early January, send each contractor a heads-up: "Your 1099 will arrive by January 31. Please confirm your mailing address."'
  ],
  'adv-controls': [
    'Recommend that the owner open the bank statement personally each month. It\'s the single most effective fraud deterrent.',
    'Never change a vendor\'s bank details based on an email alone. Call a number you already have on file.',
    'Mandatory vacations aren\'t just kind. Schemes often surface when someone else has to do the job for a week.'
  ],
  'adv-ethics': [
    'Keep a written information security plan, even a one-page one: where data lives, who can access it, how it\'s backed up and what to do if it leaks.',
    'When you decline a request on ethical grounds, put it in a short, polite email so there\'s a record.',
    'If you\'re unsure whether something is within your competence, say "Let me confirm with the CPA." Clients respect it.'
  ],
  'adv-path': [
    'Take one community college course at a time while you work. Employers and clients value steady progress.',
    'Many Colorado community college credits transfer to four-year degrees, which matters if you\'re considering the CPA path.',
    'Ask your CPA contacts which credential they\'d hire for. Local advice beats any ranking website.'
  ]
};
