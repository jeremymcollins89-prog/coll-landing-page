'use strict';
/* =====================================================================
   Coll Ledger — Bookkeeper's Handbook
   Quick tips, rules of the road, tax rules and deadlines, checklists,
   FAQs and a glossary. Searchable. Lives under Help.
   Figures checked October 2026 — confirm current-year amounts with
   irs.gov or the client's tax preparer before relying on them.
   ===================================================================== */
(() => {
  const { S, U, view, act, go, render } = App;
  const { $, $$, esc, ICON } = U;
  S.ui.hb = S.ui.hb || { q: '', open: {} };

  // [id, title, icon, intro, items[]]  — item: [heading, html]
  const BOOK = [
    ['start', 'Quick tips', 'spark', 'The habits that make bookkeeping fast and calm.', [
      ['Little and often beats a big catch-up', 'Spend 15 minutes a week per client in <b>To Review</b>. A month of transactions takes an hour; a year of them takes a weekend.'],
      ['Let the app learn', 'When you pick a category, tick <b>Remember</b> or make a Smart Rule. After a month or two, most transactions arrive already filled in.'],
      ['Reconcile every account, every month', 'Reconciling is the only way to <i>prove</i> the books match the bank. If the difference isn\'t $0.00, something is missing or doubled.'],
      ['Close the month when it\'s done', '<b>Close the month</b> locks it, so nothing you\'ve already reported changes by accident. You can always reopen it.'],
      ['Run Clean up before you send reports', 'It catches duplicates, uncategorized items and missing receipts in about ten seconds.'],
      ['Ask, don\'t guess', 'If you can\'t tell what a transaction was, add a to-do for the client on their Dashboard instead of guessing. A wrong guess is harder to find later than a blank.'],
      ['Search finds everything', 'Press <span class="kbd">Ctrl</span> <span class="kbd">K</span> and type a payee, an amount, an invoice number or a screen name.'],
      ['Save receipts the moment you get them', 'Use <b>Read a receipt</b> on the Transactions page — it fills in the vendor, date and total and attaches the picture.'],
      ['Send a month-end email', 'Clients love a short "here\'s how last month went" note. The <b>Month-end email</b> button on Reports writes it for you.']
    ]],
    ['rules', 'Rules of the road', 'book', 'Bookkeeping basics every professional follows.', [
      ['Every dollar has two sides', 'Double-entry means each transaction touches two accounts: money left the bank (one side) and went to Rent (the other). Coll Ledger does this for you — it\'s why the Balance Sheet always balances.'],
      ['Keep business and personal separate', 'A business should have its own bank account and card. Personal purchases on the business card are recorded as <b>Owner\'s Draw</b>, not expenses. Personal money put into the business is <b>Owner\'s Contributions</b>.'],
      ['Transfers are not income or expenses', 'Moving money from checking to savings, or paying the credit card bill, just moves money between the client\'s own accounts. Categorize it as a transfer to the other account.'],
      ['Loan payments are split', 'The principal part lowers the loan (a liability). Only the interest part is an expense.'],
      ['Big purchases may be assets', 'Equipment and vehicles that last more than a year usually go to <b>Equipment &amp; Vehicles</b> (a fixed asset), not an expense. The tax preparer decides how to depreciate or expense them.'],
      ['Sales tax isn\'t the business\'s money', 'Sales tax collected from customers is owed to the state. It belongs in <b>Sales Tax Payable</b>, not in income.'],
      ['Don\'t change closed periods', 'Once a month is reported or a tax return is filed, fix mistakes with a new entry in the current month instead of editing the past.'],
      ['Cash basis or accrual — be consistent', 'Most small businesses report on the <b>cash basis</b> (income when it\'s received). Coll Ledger\'s invoices and bills track who owes what either way; ask the tax preparer which basis the return uses.'],
      ['Write it down', 'Use the memo field and client notes for anything unusual. Six months from now, "why is this here?" should have an answer.']
    ]],
    ['tax', 'Tax rules worth knowing', 'report', 'The numbers that come up all the time. Amounts change — confirm each year.', [
      ['Receipts the IRS expects', 'Keep proof of every business expense. For <b>travel, meals, lodging and gifts of $75 or more</b>, the IRS specifically asks for a receipt showing the amount, date, place and business reason. Lodging needs a receipt at any amount. Clean up flags the missing ones.'],
      ['Meals are usually 50% deductible', 'Business meals with a clear business purpose are generally 50% deductible. Keep the receipt and note who attended and why.'],
      ['Mileage', 'The 2026 IRS business rate is <b>72.5¢ a mile</b> for January–June and <b>76¢ a mile</b> from July 1, 2026 (it was 70¢ in 2025). The log needs the date, miles and business reason for each trip. Commuting from home to a regular workplace doesn\'t count.'],
      ['1099-NEC for contractors', 'Businesses send a 1099-NEC to unincorporated contractors they pay for services: <b>$600 or more</b> for payments made through 2025, and <b>$2,000 or more</b> starting with payments made in 2026. Due to the contractor and the IRS by <b>January 31</b>. Collect a W-9 before the first payment.'],
      ['Card and app payments', 'Payments made by credit card, PayPal, Venmo and similar are reported by the payment company (on a 1099-K), so the business doesn\'t send a 1099-NEC for those. The 1099-K threshold is back to <b>over $20,000 and over 200 transactions</b>.'],
      ['Quarterly estimated taxes', 'Owners who don\'t have tax withheld usually pay four times a year: <b>April 15, June 15, September 15 and January 15</b> (the next business day if it falls on a weekend). Setting aside 25–30% of profit is a common rule of thumb; the tax preparer gives the real number.'],
      ['How long to keep records', 'Generally <b>3 years</b> after filing. <b>6 years</b> if income was under-reported by more than 25%. <b>7 years</b> for a bad-debt or worthless-securities deduction. <b>4 years</b> for payroll (employment tax) records. Keep records for property and equipment until 3 years after it\'s sold. Many bookkeepers simply keep everything 7 years.'],
      ['You\'re the bookkeeper, not the tax preparer', 'Unless you\'re credentialed (EA, CPA or attorney), don\'t give tax advice or sign returns. Hand off clean books with the <b>Year-end for the CPA</b> package and let the preparer make the tax calls.']
    ]],
    ['dates', 'Deadline calendar', 'calendar', 'Federal dates for a calendar year business. States add their own — especially sales tax.', [
      ['January 15', 'Fourth-quarter estimated tax payment (for the prior year).'],
      ['January 31', 'W-2s to employees and the SSA. 1099-NEC to contractors and the IRS. Most payroll year-end forms.'],
      ['March 15', 'Partnership (Form 1065) and S corporation (Form 1120-S) returns — or file an extension.'],
      ['April 15', 'Individual returns (including Schedule C sole proprietors) and C corporation returns. First-quarter estimated tax.'],
      ['June 15', 'Second-quarter estimated tax.'],
      ['September 15', 'Third-quarter estimated tax. Extended partnership and S corporation returns.'],
      ['October 15', 'Extended individual returns.'],
      ['Every month', 'Reconcile and close the prior month. Sales tax returns if the client files monthly (many states are due around the 20th). Payroll tax deposits if they have employees.'],
      ['Weekends and holidays', 'When a due date lands on a weekend or federal holiday, it moves to the next business day.']
    ]],
    ['monthly', 'Month-end checklist', 'check', 'Do these in order, for each client, each month.', [
      ['1. Bring in everything', 'Import bank and card statements (and Square or other payment reports). Read in any receipts.'],
      ['2. Clear To Review', 'Categorize every transaction. Split mixed purchases. Flag anything you can\'t identify as a to-do for the client.'],
      ['3. Match invoices and bills', 'Make sure customer payments are applied to their invoices and bill payments to their bills, so <b>Who Owes Money</b> and <b>Bills to Pay</b> are right.'],
      ['4. Reconcile', 'Reconcile every bank and card account to its statement. Difference must be $0.00.'],
      ['5. Run Clean up', 'Fix duplicates, uncategorized items and missing receipts.'],
      ['6. Review the reports', 'Read the Profit &amp; Loss and Balance Sheet. Does anything look odd compared to last month? Negative bank balance? A huge one-off expense?'],
      ['7. Close the month', 'Lock it so the numbers you send can\'t change by accident.'],
      ['8. Send the package', 'Client package PDF plus the Month-end email. Chase overdue invoices with <b>Send reminders</b>.']
    ]],
    ['yearend', 'Year-end checklist', 'calendar', 'January for a calendar-year business.', [
      ['Close December', 'Finish the normal month-end steps for December first.'],
      ['1099s', 'Check the <b>1099 Contractors</b> report. Make sure every contractor has a W-9 (name, address and tax ID) and send 1099-NECs by January 31.'],
      ['Loans and assets', 'Match loan balances to the lender\'s year-end statement. List any equipment or vehicles bought during the year.'],
      ['Owner activity', 'Review Owner\'s Draw and Contributions with the owner. Personal expenses shouldn\'t be sitting in business expense accounts.'],
      ['Sales tax', 'Sales Tax Payable should equal what\'s still owed for the last period. Use the <b>Sales Tax</b> report.'],
      ['Hand off to the CPA', 'Reports → <b>Year-end for the CPA</b> builds one PDF (P&amp;L, Balance Sheet, Trial Balance, 1099 summary) plus the General Ledger spreadsheet.'],
      ['Lock the year', 'Close through December 31 once the return is filed so the year stays exactly as filed.']
    ]],
    ['clients', 'Working with clients', 'people', 'Running a professional bookkeeping practice.', [
      ['Use an engagement letter', 'Before starting, put the scope in writing: what you\'ll do, how often, what the client provides and by when, the fee, and what\'s not included (for example tax returns).'],
      ['Get read-only access', 'Ask for read-only or "accountant" access to bank and card accounts — never ask for or store a client\'s full password. Keep login hints only in Notes, never passwords.'],
      ['Set a monthly rhythm', 'Agree on a date each month for statements to arrive and a date you deliver reports. My studio tracks your time and bills monthly.'],
      ['Price for value', 'Monthly flat fees (by number of accounts and transactions) are easier for clients than hourly. Charge separately for catch-up work.'],
      ['Protect the books', 'Turn on the password lock and cloud backup in Settings. The books hold private financial information.'],
      ['Keep a clear trail', 'Questions and answers go in client to-dos and notes, with dates. It protects you and the client.'],
      ['Add a recognized credential', 'After the Coll Ledger Academy, get the free <b>QuickBooks Online certification</b> through Intuit\'s ProAdvisor Academy. Certified ProAdvisors can publish a profile in Intuit\'s <b>Find-a-ProAdvisor</b> directory, where small businesses look for help. <a href="#" data-action="pa-open">See why and how</a>.']
    ]],
    ['faq', 'FAQs', 'help', 'Quick answers about using Coll Ledger.', [
      ['A transaction shows up twice. What do I do?', 'Run <b>Clean up</b> — it lists likely duplicates side by side with a <b>Remove the second one</b> button. Imports also skip exact duplicates automatically.'],
      ['The reconcile difference isn\'t zero.', 'Look for a transaction that\'s on the statement but not ticked (or the reverse), an amount typed with a missing digit, a duplicate, or a transaction dated in the wrong month. The difference amount itself is a clue — search for it with Ctrl K.'],
      ['How do I record the owner paying themselves?', 'Categorize the transfer to the owner as <b>Owner\'s Draw</b>. It isn\'t an expense. Planning → Owner pay &amp; taxes shows what\'s been taken and about how much is safe to take.'],
      ['How do I record a credit card payment?', 'In the bank account, categorize the payment to the credit card account (a transfer). The card account\'s balance goes down; it\'s not an expense.'],
      ['A customer paid an invoice. Where does it go?', 'When the deposit comes in, choose the invoice it pays (or open the invoice and click <b>Record payment</b>). Don\'t categorize it as Sales — the invoice already counted the sale.'],
      ['I made a mistake in a closed month.', 'Reopen the month on <b>Close the month</b>, fix it, and close it again — or, if reports were already sent, record a correcting entry in the current month.'],
      ['Can I undo something?', 'Most actions show an <b>Undo</b> button in the message at the bottom of the screen. Deleting a client can be undone the same way, right after.'],
      ['Where are the books saved?', 'On this computer, with 30 days of daily backups. Turn on cloud backup in Settings to also save a copy to OneDrive, Google Drive or Dropbox every day.'],
      ['What if I forget the password?', 'Use the recovery code you saved when you turned the password on. Without the password or the code, nobody can open the books — that\'s what keeps them private.'],
      ['How do I practice without touching real books?', 'Help → <b>Practice / Training</b> opens a pretend bakery with lessons. Nothing there affects real clients.'],
      ['Can I make the text bigger?', 'Settings → Look → <b>Text size</b>, or press <span class="kbd">Ctrl</span> <span class="kbd">+</span>. The moon button at the top switches to dark mode.']
    ]],
    ['words', 'Glossary', 'list', 'Plain-English meanings of the words you\'ll hear.', [
      ['Accounts receivable (A/R)', 'Money customers owe the business for invoices not yet paid.'],
      ['Accounts payable (A/P)', 'Money the business owes vendors for bills not yet paid.'],
      ['Accrual basis', 'Income counts when it\'s earned and expenses when they\'re incurred, even if the cash moves later.'],
      ['Asset', 'Something the business owns: cash, equipment, money owed to it.'],
      ['Balance Sheet', 'A snapshot on one date: what the business owns, owes, and what\'s left for the owner.'],
      ['Cash basis', 'Income counts when it\'s received and expenses when they\'re paid.'],
      ['Chart of accounts', 'The list of categories every dollar is sorted into.'],
      ['COGS (cost of goods sold)', 'What the business paid for the products it sold — ingredients, inventory, materials.'],
      ['Debit / credit', 'The two sides of every entry. Debits increase assets and expenses; credits increase liabilities, equity and income.'],
      ['Depreciation', 'Spreading the cost of a long-lasting asset over the years it\'s used.'],
      ['Equity', 'The owner\'s share: what\'s left after subtracting what the business owes from what it owns.'],
      ['General ledger', 'The complete record of every entry in every account.'],
      ['Gross profit', 'Income minus cost of goods sold, before other expenses.'],
      ['Liability', 'Something the business owes: credit card balances, loans, sales tax collected.'],
      ['Net profit', 'What\'s left after all expenses. The bottom line.'],
      ['Owner\'s draw', 'Money the owner takes out of the business for themselves. Not an expense.'],
      ['Profit &amp; Loss (P&amp;L)', 'Income minus expenses over a period. Also called an income statement.'],
      ['Reconciliation', 'Matching the books to the bank or card statement so every dollar is accounted for.'],
      ['Retained earnings', 'Profits from past years that stayed in the business.'],
      ['Trial balance', 'A list of every account\'s balance in debit and credit columns. They should be equal.'],
      ['W-9', 'The form a contractor fills out with their name, address and tax ID, so a 1099 can be sent.']
    ]],
    ['keys', 'Keyboard shortcuts', 'keyboard', 'Faster with two hands on the keys.', [
      ['Ctrl K', 'Search and jump anywhere'],
      ['N', 'New transaction'], ['I', 'New invoice'],
      ['↑ ↓', 'Move through To Review'], ['Enter', 'Accept the highlighted transaction'], ['C', 'Change its category'], ['S', 'Split it'], ['Delete', 'Exclude it (duplicate or personal)'],
      ['Ctrl + / Ctrl − / Ctrl 0', 'Bigger, smaller, normal text'],
      ['Esc', 'Close any window']
    ]]
  ];
  const IC = { spark: ICON.spark, book: '<svg viewBox="0 0 24 24"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2M6 4h5v8l-2.5-1.5L6 12z"/></svg>', report: ICON.report, calendar: ICON.calendar, check: ICON.check, people: ICON.people, help: ICON.help, list: '<svg viewBox="0 0 24 24"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h12v2H3z"/></svg>', keyboard: ICON.keyboard };
  const strip = h => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const hl = (html, q) => !q ? html : html.replace(/(>|^)([^<]+)/g, (m, a, txt) => a + txt.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'));

  view('handbook', {
    render() {
      const q = S.ui.hb.q.trim();
      const ql = q.toLowerCase();
      const secs = BOOK.map(([id, title, ic, intro, items]) => [id, title, ic, intro, q ? items.filter(([h, b]) => (strip(h) + ' ' + strip(b)).toLowerCase().includes(ql)) : items]).filter(s => s[4].length);
      const hits = secs.reduce((n, s) => n + s[4].length, 0);
      return `
        <div class="page-head">
          <div><h1>Bookkeeper's Handbook</h1><div class="sub">Quick tips, the rules of the road, tax rules and deadlines, checklists, FAQs and a glossary.</div></div>
          <div class="actions"><button class="btn" data-nav="training">${ICON.spark}Practice / Training</button></div>
        </div>
        <div class="hb">
          <aside class="hb-toc">
            <div class="hb-search">${ICON.search}<input id="hb-q" placeholder="Search the handbook" value="${esc(q)}" data-input="hb-q" aria-label="Search the handbook" autocomplete="off"></div>
            <nav>${BOOK.map(([id, title, ic]) => `<a href="#hb-${id}" data-hb="${id}" class="${q && !secs.some(s => s[0] === id) ? 'dim' : ''}">${IC[ic]}<span>${title}</span></a>`).join('')}</nav>
            <div class="muted hb-note">Tax figures checked October 2026. Rules change — confirm current amounts at irs.gov or with the client's tax preparer.</div>
          </aside>
          <div class="hb-body">
            ${q ? `<div class="muted" style="margin:0 0 12px">${hits ? `${hits} result${hits === 1 ? '' : 's'} for “${esc(q)}”` : `Nothing found for “${esc(q)}”. Try a shorter word.`}</div>` : ''}
            ${secs.map(([id, title, ic, intro, items]) => `<section class="card hb-sec" id="hb-${id}">
              <div class="card-head"><div class="hb-ic">${IC[ic]}</div><div><h3>${title}</h3><div class="muted">${intro}</div></div></div>
              <div class="card-body">${id === 'keys' ? `<div class="shortcuts">${items.map(([k, d]) => `<div>${k.split(' ').map(x => x === '/' ? '/' : `<span class="kbd">${esc(x)}</span>`).join(' ')} ${esc(d)}</div>`).join('')}</div>`
                : id === 'faq' ? items.map(([h, b], i) => `<details class="hb-faq" ${q || S.ui.hb.open[id + i] ? 'open' : ''}><summary>${hl(esc(h), q)}</summary><div>${hl(b, q)}</div></details>`).join('')
                : id === 'words' ? `<dl class="hb-gloss">${items.map(([h, b]) => `<dt>${hl(h, q)}</dt><dd>${hl(b, q)}</dd>`).join('')}</dl>`
                : id === 'dates' ? `<div class="hb-dates">${items.map(([h, b]) => `<div class="hb-date"><b>${hl(esc(h), q)}</b><span>${hl(b, q)}</span></div>`).join('')}</div>`
                : `<div class="hb-items ${id === 'monthly' || id === 'yearend' ? 'steps' : ''}">${items.map(([h, b]) => `<div class="hb-item"><b>${hl(h, q)}</b><p>${hl(b, q)}</p></div>`).join('')}</div>`}</div>
            </section>`).join('')}
          </div>
        </div>`;
    },
    after() {
      $$('[data-hb]').forEach(a => a.onclick = e => { e.preventDefault(); const el = $('#hb-' + a.dataset.hb); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      if (S.ui.hb.focus) { const i = $('#hb-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } S.ui.hb.focus = false; }
    }
  });
  let t;
  act({ 'input:hb-q': el => { S.ui.hb.q = el.value; clearTimeout(t); t = setTimeout(() => { S.ui.hb.focus = true; const y = ($('#view') || {}).scrollTop; render(); }, 160); } });
  App.handbookSections = BOOK.map(([id, title]) => [id, title]);
})();
