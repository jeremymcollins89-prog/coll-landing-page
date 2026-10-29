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
- **Practice / Training** (sidebar and Help): a pretend bakery, eleven short lessons with explanations, quizzes, a coach that checks each task, and a certificate.
- **Imports fill in categories automatically** (smart rules, past choices, and built-in knowledge of common vendors) and show them in the preview to confirm or change before importing. Everything stays editable afterward.
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

## Live Square / QuickBooks connections (future)

File import works today. A one-click live connection needs:
- **Square**: a Square Developer application (OAuth with PKCE works from a desktop app without a server).
- **QuickBooks**: an Intuit Developer app and a small server (Railway) to hold the client secret and refresh tokens.
