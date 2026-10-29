# Coll Ledger

Bookkeeping software for independent bookkeepers — by Coll Business Solutions LLC.

Download: https://collbusinesssolutions.com/projects.html#coll-ledger
(direct: https://github.com/jeremymcollins89-prog/coll-landing-page/releases/download/coll-ledger/Coll-Ledger-Setup.exe)

## What it does

- **All clients** home: every business at a glance — what's to review, to reconcile, and overdue.
- **First-run setup** in two steps, plus a self-ticking checklist for each new client.
- **To Review**: imported activity arrives with categories already suggested (smart rules and past choices). Keyboard: ↑↓ move, Enter accept, C change category, S split, Del exclude.
- **Import** anything by dropping it on the window:
  - Bank and card statements (CSV or Excel), duplicates skipped.
  - **Square** Transactions CSV — one entry per day, split into sales, sales tax, tips, fees and cash, posted to a Square clearing account so deposits are never double-counted. Square customer exports too.
  - **QuickBooks** Online and Desktop — chart of accounts, customers and vendors (Excel/CSV/IIF), and "Transaction Detail by Account", with an account-matching screen.
  - Every import can be undone.
- **Split transactions**, bulk re-categorize, quick category picker with type-to-search.
- **Invoices** with payments, voids, duplicates, PDF and a ready-made email.
- **Reconcile** with a live difference and hints when it's off.
- **Close the month**: checklist, then lock the month so sent numbers never change by accident.
- **Reports**: Profit & Loss, Balance Sheet, Spending by Category, Month by Month, Who Owes Money, General Ledger — PDF or spreadsheet, click any line to see what's in it.
- **Client package**: one polished PDF (summary page, P&L, Balance Sheet, unpaid invoices) prepared under the bookkeeper's studio name.
- **Coll Ledger Academy** (Practice / Training): 29 hands-on lessons in four levels — Foundations; Month-end professional (debits and credits drill, bills, payroll splits, journal entries, receipts, Clean up, troubleshooting); Client advisor (cash flow, budgets, owner pay and quarterly taxes, business types, reading the numbers, year-end and 1099s); and Running your practice (onboarding, pricing, engagement letters, catch-up projects, industries, ethics and security). Then a written exam (30 questions from a 67-question bank, 80% to pass) and a practical month-end for Juniper Flower Co. auto-graded on 12 checks (80 points, a balanced reconciliation and a closed month to pass). Passing both earns the Professional Bookkeeping Certificate. About 12½ hours in all; each lesson shows its reading time and a realistic time with practice.
- **Journal entries** (Month end): adjusting entries from the CPA, depreciation, accruals with automatic reversal, prepaid expenses, loan interest and reclassifications; entries must balance.
- **Business Health report**: gross and net margin, cash cushion, current ratio, days to get paid and to pay, owner pay vs. profit — with plain-English readings.
- **Practice tools** (My studio): a pricing calculator, an engagement letter generator, and a one-click new-client onboarding checklist. Each client has a business type that drives owner-pay guidance.
- **Digital badge and LinkedIn**: after earning the certificate, the credential window adds it to LinkedIn in one click (name, issuer, date, credential ID and link prefilled), saves a badge image and a share image, and requests registration so the credential link on collbusinesssolutions.com/verify.html shows "Verified". To register a credential, add the entry from the request email to `credentials.json` at the website root.
- **Advanced Accounting & Tax Certificate** (second track, unlocked by the Professional certificate): 14 lessons in three modules — accrual accounting and the close (deferred revenue, prepaids and reversing accruals, fixed assets and depreciation, inventory, loans, closing and cash flow); tax compliance (payroll, sales tax, business returns, owner taxes, 1099s); professional standards (internal controls, ethics and data security, career paths). Then a written exam (35 questions from a 60-question bank, 80% to pass) and a graded month-end close for Aspen Trail Outfitters with seven adjusting and correcting entries, graded on account balances. Earns a navy-and-gold badge, a LinkedIn add-to-profile link (ID prefix `CA-`), and recommendations for accredited Colorado programs (Emily Griffith, Front Range CC, Red Rocks CC), the Enrolled Agent exam and the Colorado CPA pathways.
- **Pro tips** on every lesson: three practical tips that save time and prevent mistakes.
- **Next step: QuickBooks ProAdvisor**: once the Academy is complete, Coll Ledger recommends Intuit's free QuickBooks Online certification, with the reasons it helps and live sign-up links.
- **Deposits match invoices, payments match bills**: To Review and imports suggest "Pays invoice J-201" when a deposit equals an open invoice (and the same for bills), so payments are never counted twice.
- **Imports fill in categories automatically** (smart rules, past choices, and built-in knowledge of common vendors) and show them in the preview to confirm or change before importing. Everything stays editable afterward.
- **Bills (accounts payable)**: enter vendor bills when they arrive, see what's due soon or overdue, pay in one click. Receipts and files attach to bills and transactions.
- **Repeating invoices and bills**: weekly, every two weeks, monthly, quarterly or yearly — created automatically.
- **Tax time**: Trial Balance, 1099 Contractors ($600 threshold through 2025, $2,000 from 2026), Sales Tax, and a one-click year-end PDF package for the CPA with the General Ledger as a spreadsheet.
- **My studio**: the bookkeeper's own clients, a start/stop timer, monthly fees plus hourly time, and branded invoices ("Bill this month" does every client at once).
- **Password lock** (Settings → Protection & backups): AES-256 encryption of the books, backups and receipts, a recovery code, and auto-lock when idle. **Cloud backup**: pick a OneDrive, Google Drive or Dropbox folder and a dated copy is written there every day.
- **Planning**: a 90-day cash-flow forecast (invoices, bills, repeating items and everyday activity), budget vs. actual with "fill from the last 3 months", and owner pay with quarterly estimated-tax set-asides and an "about safe to pay the owner" number.
- **Read a receipt**: drop in a photo or PDF and it fills in the vendor, date and total (read on the computer with Tesseract — nothing leaves it), matches it to the bank transaction, or adds it as an expense or a bill.
- **Mileage log** at the IRS rate in effect on each trip's date (72.5¢ Jan–Jun 2026, 76¢ from July 1, 2026), recorded monthly to Car & Truck, with a printable log.
- **Clean up**: finds possible duplicates, uncategorized items, items waiting in review over 30 days, unusually large charges, travel/meal receipts the IRS expects, and invoices over 90 days late — with one-click fixes.
- **Payment reminders** (friendly, firm, final notice) grouped per customer, and a **month-end email** that writes the client's monthly summary.
- **Notes and to-dos** for each client on the Dashboard; due to-dos show under "Needs your attention".
- **Text size** (Settings, or Ctrl + / − / 0) and a one-click light/dark switch.
- **Bookkeeper's Handbook** under Help: quick tips, rules of the road, tax rules, a deadline calendar, month-end and year-end checklists, FAQs, a glossary and shortcuts — searchable.
- **Search anything** with Ctrl K. Help (?) with short how-to guides.
- Double-entry underneath, so the Balance Sheet always balances. Data stays on the computer, with 30 days of daily backups. Updates install themselves.

## Developing

```
cd ledger-app
npm install
npm start        # run the app
npm test         # accounting and import checks
npm run preview  # single-file web preview (preview.html)
```

Pushing changes under `ledger-app/` to `main` builds the Windows installer on GitHub Actions
(`.github/workflows/coll-ledger.yml`) and replaces the files on the `coll-ledger` release.
Bump `version` in package.json so installed copies update themselves.

## Where the data lives

- Windows: `%APPDATA%\Coll Ledger\books\ledger.json` (daily backups in `books\backups`)
- Mac: `~/Library/Application Support/Coll Ledger/books/`

## Still to come (need outside accounts)

- Phone companion: needs a small sync server.
- Live bank feeds (Plaid): a Plaid account and a server.
- Code signing so Windows shows no warning: Microsoft's signing service (about $10/month).

## Live Square / QuickBooks connections (future)

File import works today. A one-click live connection needs:
- **Square**: a Square Developer application (OAuth with PKCE works from a desktop app without a server).
- **QuickBooks**: an Intuit Developer app and a small server (Railway) to hold the client secret and refresh tokens.
