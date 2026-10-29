# Coll Ledger Academy API

The Academy server is what makes Coll Ledger Academy certificates trustworthy. It
keeps each student's account, syncs their progress between devices, grades both
written exams and both practical exams **on the server**, applies the tries rule, and
issues signed certificates that `verify.html` can check.

- **Base URL:** the `workers.dev` address printed by the *Academy server* workflow,
  e.g. `https://coll-academy-api.<your-subdomain>.workers.dev`. Use this one value
  everywhere: the app, the phone web app and `verify.html` (`ACADEMY_API`).
- **Format:** JSON in, JSON out (`Content-Type: application/json`). Times are ISO 8601
  UTC (`2026-10-28T15:00:00Z`); dates are `YYYY-MM-DD`.
- **Sign-in:** every route marked 🔒 needs `Authorization: Bearer <token>`.
- **Who can call it from a browser:** `https://collbusinesssolutions.com` (and `www.`),
  `http://localhost:<port>`, `http://127.0.0.1:<port>`, and the desktop app (its
  `file://` pages send `Origin: null`). Requests without an `Origin` header are also
  allowed. Any other website gets `403 origin_not_allowed`. `GET /api/credentials/:id`
  is public and answers every origin.

## Contents

1. [Errors](#errors)
2. [Students and sign-in](#students-and-sign-in) — enroll, me, rename, codes, logout, delete
3. [Progress sync](#progress-sync)
4. [Written exams](#written-exams)
5. [Practical exams](#practical-exams)
6. [Certificates](#certificates)
7. [The tries rule](#the-tries-rule)
8. [What the app must do](#what-the-app-must-do)
9. [Limits](#limits)

---

## Errors

Every error has the same shape, with an HTTP status that matches:

```json
{ "error": "locked", "message": "Professional written exam opens again in 23 hr 59 min — …", "lockedUntil": "2026-10-29T15:00:00Z" }
```

`message` is written for the student and can be shown as-is. Some errors add fields
(shown below).

| Status | `error` | When |
|---|---|---|
| 400 | `invalid_json` | The body isn't a JSON object. |
| 400 | `invalid_name`, `invalid_email` | Enrollment or rename input is bad. |
| 400 | `invalid_exam`, `invalid_program` | `exam` isn't `pro`/`adv`; `program` isn't `professional`/`advanced`. |
| 400 | `invalid_code` | One-time code is wrong, expired or used. |
| 400 | `invalid_progress` | Progress `data`/`encoding`/`baseVersion` is bad. |
| 400 | `invalid_attempt`, `invalid_answers` | Written-exam submission is malformed. |
| 400 | `invalid_practical`, `invalid_client`, `wrong_client` | Practical submission is malformed, unreadable, or not the client that was issued. |
| 400 | `confirm_required` | `DELETE /api/me` without `{"confirm":"DELETE"}`. |
| 401 | `unauthorized` | Missing or unknown token (also: wrong admin token). |
| 403 | `origin_not_allowed` | The calling website isn't allowed. |
| 403 | `prerequisite` | Advanced exams need the Professional certificate. Extra: — |
| 403 | `not_eligible` | Certificate claimed too early. Extra: `needs` (see [claim](#post-apicredentialclaim-)). |
| 403 | `revoked` | The student's certificate for this program was withdrawn; no new one is issued. |
| 404 | `not_found` | Unknown route, attempt, practical or credential. |
| 409 | `already_submitted` | A written attempt can be submitted once. |
| 409 | `practical_replaced` | That practical was started over; grade the newer one. |
| 409 | `conflict` | Progress was saved from another device. Extra: `version`, `updatedAt`. |
| 409 | `name_locked` | The name is on an issued certificate. |
| 410 | `attempt_expired` | The 3 hours for a written attempt ran out (counts as a try). |
| 413 | `too_large` | Body over the size limit. |
| 423 | `locked` | Tries rule: 24-hour break. Extra: `lockedUntil`. |
| 429 | `rate_limited` | Too many requests from this network. Extra: `retryAfter` (seconds). |
| 500 | `server_error` | Unexpected; try again. |
| 503 | `signing_unavailable`, `admin_unavailable` | The signing key / admin token isn't set up on the server. |

---

## Students and sign-in

A student is a **name** and an **email** (lowercased, not verified). Enrolling returns a
**token** — a 43-character secret that is the student's sign-in on that device. The
server keeps only a SHA-256 hash of it, so a lost token can't be recovered: the student
signs in on a new device with a **one-time code** made on a device that's still signed in.

### `POST /api/enroll`

```json
// request
{ "name": "Avery Quinn", "email": "avery@example.com" }
// 201 response
{ "studentId": "st_k3j9x0b2mq7d", "token": "Qm9…43 chars…", "name": "Avery Quinn", "email": "avery@example.com" }
```
Rate limit: 20 enrollments per hour per network. Enrolling twice with the same email
creates a second account, but the [tries rule](#the-tries-rule) is shared by email.

### `GET /api/me` 🔒

Everything the Academy screens need in one call.

```json
{
  "student": { "id": "st_…", "name": "Avery Quinn", "email": "avery@example.com", "createdAt": "2026-10-28T15:00:00Z" },
  "nameLocked": false,
  "exams": {
    "pro": {
      "available": true,
      "written":   { "passed": true, "bestPercent": 93, "attempts": 2, "questions": 30,
                     "openAttempt": null,             // or { "attemptId": "wa_…", "expiresAt": "…" }
                     "tries": { "left": 3, "lockedUntil": null } },
      "practical": { "passed": false, "bestScore": 72, "bestPassingScore": null,
                     "practicalId": "pr_…",           // the active practical, or null
                     "tries": { "left": 2, "lockedUntil": null } },
      "certificate": { "program": "professional", "eligible": false, "needs": ["practical"] }
    },
    "adv": { "available": false, "…": "same shape; needs includes \"professional_certificate\" until it's earned" }
  },
  "credentials": [ /* certificate entries, same shape as GET /api/credentials/:id */ ],
  "progress": { "version": 4, "updatedAt": "2026-10-28T15:20:00Z" }
}
```

### `POST /api/me` 🔒 — fix the name

```json
{ "name": "Avery J. Quinn" }   →   { "name": "Avery J. Quinn" }
```
Allowed until a certificate is issued; after that `409 name_locked` (corrections by email).
Names: 1–120 characters, no `<`, `>` or control characters; spaces are tidied.

### `POST /api/code` 🔒 — one-time sign-in code

```json
→ { "code": "K7MP3QXA", "expiresAt": "2026-10-28T15:15:00Z", "expiresInSeconds": 900 }
```
8 characters (no look-alikes like 0/O or 1/I/L), valid **15 minutes**, works **once**.
Making a new code cancels the previous one. Limit: 10 codes per hour per student.

### `POST /api/code/redeem` — sign in on another device

```json
{ "code": "K7MP-3QXA" }   →   { "studentId": "st_…", "token": "…new token for this device…", "name": "…", "email": "…" }
```
Case, spaces and dashes are ignored. Rate limit: **10 tries per hour per network**.
Each device gets its own token; both stay signed in.

### `POST /api/logout` 🔒

Forgets this device's token (other devices stay signed in). `→ { "ok": true }`

### `DELETE /api/me` 🔒 — delete the account and its data

```json
{ "confirm": "DELETE", "keepCredentials": false }   →   { "deleted": true, "keptCredentials": false }
```
Deletes the student, all tokens, codes, saved progress, exam attempts, practicals and
results. Issued certificates are **deleted too** (their verify link then shows "not
found") unless `keepCredentials: true`, which keeps them publicly verifiable (name and
scores only, no longer linked to an account). A tries-rule counter keyed by a one-way
hash of the email stays until it expires (at most 30 days), so deleting the account
can't be used to skip a 24-hour break.

---

## Progress sync

One saved copy of the Academy progress per student, shared by all their devices.

### `PUT /api/progress` 🔒

```json
// request
{ "data": "{\"training\":{…}}", "encoding": "json", "baseVersion": 3 }
// 200 response
{ "version": 4, "updatedAt": "2026-10-28T15:20:00Z", "size": 18233 }
```
- `data` — a **string**, at most **900 KB** (921,600 characters): plain JSON text, or the
  JSON gzip-compressed then base64-encoded (`"encoding": "gzip-base64"`, recommended —
  progress usually shrinks 5–10×). The server stores it exactly as sent.
- `encoding` — `"json"` (default) or `"gzip-base64"`.
- `baseVersion` — optional but recommended: the `version` this device last downloaded or
  saved. If the server has a different version, nothing is saved and you get
  `409 conflict` with the server's `version` and `updatedAt`: download, merge, save again.

### `GET /api/progress` 🔒

```json
{ "data": "…", "encoding": "gzip-base64", "version": 4, "updatedAt": "2026-10-28T15:20:00Z" }
// nothing saved yet:
{ "data": null, "encoding": null, "version": 0, "updatedAt": null }
```

In the browser: `gzip` = `new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()`,
then base64; reverse with `DecompressionStream('gzip')`. Both work in Electron and phone browsers.

---

## Written exams

Each official exam mixes two kinds of question:

- **From the bank** (about 60%): questions from `src/banks/pro.js` / `adv.js`. These banks are
  in a public repository, so they can be studied but not trusted alone.
- **Generated** (about 40%): calculation questions made for **that attempt** from fresh random
  numbers (`src/banks/generated.js`), so the answers can't be memorized or shared. Each one is
  worked exactly to the cent, and its two wrong options come from real mistakes (forgetting
  salvage value, an annual figure instead of a monthly one, 6.2% instead of 7.65%, adding
  instead of subtracting, taxing a tax-included total…). Its explanation shows the worked math.

| Exam | Questions | From the bank | Generated | Pass | Time per attempt |
|---|---|---|---|---|---|
| `pro` — Professional | 30 | 18 of 67 (every topic at least once) | 12 of 15 templates | 80% (24 right) | 3 hours |
| `adv` — Advanced | 35 | 21 of 60 (every topic at least once) | 14 of 17 templates | 80% (28 right) | 3 hours |

The two kinds are mixed in a random order and look the same to the client (`id`, `topic`,
`question`, `options`). Option order is random. The answers, explanations and generated
inputs stay with the attempt on the server and are never sent before submitting. A resumed
attempt shows exactly the same questions, numbers and option order.

**Generated templates.**
*Professional:* transposition error (difference ÷ 9), bank reconciliation adjusted balance,
net pay (federal + Colorado 4.4% + employee FICA), employer payroll cost (7.65%), sales tax
backed out of a tax-included total, invoice total with discount and tax, gross margin, net
margin, prepaid insurance remaining, straight-line depreciation per month, owner's equity
roll-forward, average days to get paid, estimated-tax set-aside, 2026 mileage deduction
(72.5¢ Jan–Jun, 76¢ Jul–Dec), 1099-NEC needed? ($2,000 for 2026; card payments excluded).
*Advanced:* unearned revenue remaining, accrued wages, loan principal vs. interest, cost of goods
sold, inventory shrinkage entry, book value, gain or loss on sale, employer FICA, FUTA (0.6% of
the first $7,000), Social Security at the 2026 $184,500 wage base, self-employment tax
(92.35% × 15.3%), prior-year safe harbor (100% / 110% over $150,000 AGI), meals vs.
entertainment, 24% backup withholding, cash from operations (indirect), retained earnings
roll-forward, Sales Tax Payable balance.

### `POST /api/exam/start` 🔒

```json
// request
{ "exam": "pro" }
// 200 response
{
  "attemptId": "wa_0b1c2d3e4f5g6h7i", "exam": "pro", "title": "Professional written exam",
  "startedAt": "2026-10-28T15:00:00Z", "expiresAt": "2026-10-28T18:00:00Z",
  "total": 30, "passPercent": 80, "needed": 24,
  "questions": [
    { "id": "q1", "topic": "Basics", "question": "Assets − Liabilities = ?", "options": ["Cash", "Profit", "Equity"] },
    { "id": "q2", "topic": "Payroll", "question": "Gross wages for this payroll total $3,636.46. Not counting unemployment taxes, what does the payroll cost the business, including the employer's share of FICA?",
      "options": ["$3,636.46", "$3,861.92", "$3,914.65"] }
  ],
  "resumed": false, "triesLeft": 3
}
```
- If the student already has an **unfinished, unexpired** attempt, the same attempt comes
  back (`"resumed": true`, same questions, same option order) — so a dropped connection or
  a second device doesn't cost a try or draw new questions.
- An attempt left unfinished past `expiresAt` **counts as a failed try** (once), and a new
  one is drawn.
- Errors: `423 locked`, `403 prerequisite` (Advanced without the Professional certificate).

### `POST /api/exam/submit` 🔒

```json
// request — the answer is the POSITION of the option as shown (0, 1 or 2)
{ "attemptId": "wa_…", "answers": { "q1": 2, "q2": 0, "q3": 1 } }
// 200 response
{
  "attemptId": "wa_…", "exam": "pro",
  "score": 27, "total": 30, "pct": 0.9, "percent": 90, "passed": true, "needed": 24,
  "distinctionLevel": false,            // pct ≥ 92%
  "review": [                           // only the questions missed (unanswered counts as missed)
    { "id": "q7", "topic": "Reconciling", "question": "…", "yourAnswer": "…", "correctAnswer": "…", "why": "…" }
  ],
  "tries": { "left": 3, "lockedUntil": null }
}
```
- `review` works the same for generated questions: `correctAnswer` and a `why` with the worked math.
- One submission per attempt (`409 already_submitted` after).
- After `expiresAt`: `410 attempt_expired` (counts as a try).
- `pct` is a fraction (0–1), like the app's saved `written[].pct`; `percent` is rounded.

---

## Practical exams

The server builds each student's **own** practice client with the app's engine
(`ledger-app/src/renderer/core.js` + `plus.js`), using the same structure as the app's
practical — but with randomized amounts and dates, so every student's numbers, bank
statement and documents are different. The expected answers stay on the server; the
student's finished books are uploaded and graded there with the same checks and points
as the app.

| Exam | Client | Graded on | Pass |
|---|---|---|---|
| `pro` | Juniper Flower Co. — month-end with planted problems | 12 checks, 100 points | 80+ **and** checking reconciled to the statement **and** the month closed |
| `adv` | Aspen Trail Outfitters — accrual close (balances-based) | 7 checks (88) + month closed (12) | 80+ **and** the month closed |

The month is always **last month** (UTC) at the time the practical is started.

### `POST /api/practical/start` 🔒

```json
// request
{ "exam": "pro", "fresh": false }
// 200 response
{
  "practicalId": "pr_0a1b2c3d4e5f6g7h", "exam": "pro", "createdAt": "…", "resumed": false,
  "client": { /* the full Coll Ledger client JSON — insert it into S.data.clients as-is */ },
  "brief": {
    "client": "Juniper Flower Co.",
    "month": { "from": "2026-09-01", "to": "2026-09-30", "label": "September 2026" },
    "intro": "Juniper Flower Co. is a new client. Do September 2026's month-end …",
    "documents": [
      { "title": "Bank statement — Front Range Community Bank", "text": "…\nBeginning balance: $8,500.00\nChecks paid: #1243 · $172.50\nEnding balance: $9,128.06" },
      { "title": "Gusto payroll report", "text": "…" },
      { "title": "Invoice J-201 — Hotel Teatro", "text": "…" },
      { "title": "CPA's adjusting entry — AJE #1", "text": "…" }
    ],
    "tasks": ["Categorize everything in To Review. …", "…", "Close September 2026."],
    "grading": "Graded on 12 checks worth 100 points. …"
  }
}
```
- Without `fresh`, the student's **active** practical comes back (same numbers, same
  client as first issued) — use this to re-open it on another device. `fresh: true`
  ("Start over") makes a new one with new numbers; the old one can no longer be graded.
- `documents[].text` uses `\n` for line breaks. Show the documents and tasks in place of
  the app's hard-coded brief (the numbers differ per student).
- What's in `client`: everything the app's `buildExam()` / `build()` produce, including
  `examKey` / `advKey` with the **transaction ids** the coach uses and the `month`
  (Juniper's also has `statement`, `begin` and `checkNo`, which are on the bank
  statement). There is **no** `expect` or answer data. The client also carries
  `academy: { practicalId, exam }` so the app can tell it's server-issued.
- `pro` works for everyone; `adv` needs the Professional certificate (`403 prerequisite`).

### `POST /api/practical/submit` 🔒

```json
// request
{ "practicalId": "pr_…", "client": { /* the student's Juniper/Aspen client, as the app stores it */ } }
// 200 response
{
  "practicalId": "pr_…", "exam": "pro",
  "score": 92, "passed": true, "closed": true, "reconciled": true,   // "reconciled" for pro only
  "items": [
    { "label": "To Review is cleared", "pts": 4, "got": 4, "ok": true, "why": "…" },
    { "label": "Everyday items sensibly categorized (4 of 5)", "pts": 10, "got": 8, "ok": false, "why": "…" }
  ],
  "required": [ { "label": "Checking reconciled to the statement", "ok": true }, { "label": "September 2026 closed", "ok": true } ],
  "best": { "score": 92, "passed": true, "passScore": 92 },
  "tries": { "left": 3, "lockedUntil": null }
}
```
- **Each grading counts as a try** (as in the app). Locked → `423 locked`.
- `why` (the answer-key explanation) is included **only when this grading passed**.
  Before that, show the app's "Not right yet…" text.
- For `adv`, `items` has 8 entries; the last is "<Month> closed" worth 12 points, so the
  items always add up to `score`.
- The uploaded client must be the one issued (same `id`), or `400 wrong_client`. Limit
  1 MB — strip attachments (receipt images) before sending, if the client has any.
- The server ignores any `examKey`/`advKey` in the upload and grades against its own copy.

---

## Certificates

### `POST /api/credential/claim` 🔒

```json
// request
{ "program": "professional" }          // or "advanced"
// 200 response — a credentials.json entry, plus "existing"
{
  "id": "CL-2026-7Q2M-K9XA", "name": "Avery Quinn", "awarded": "2026-10-28",
  "written": 93, "practical": 100, "distinction": true, "program": "professional",
  "credential": { /* Open Badges 3.0–style JSON, Ed25519-signed exactly like scripts/credentials/sign.js */ },
  "existing": false
}
```
- Eligible when the student has passed the written exam **and** the practical for the
  program (Advanced also needs the Professional certificate). Otherwise
  `403 not_eligible` with `needs`: any of `"professional_certificate"`, `"written"`, `"practical"`.
- Scores on the certificate: the **best passing** written percentage (rounded) and the
  **best passing** practical score. Distinction: written ≥ 92 and practical = 100.
- The name is the student's current name, and is then locked. The date is today (UTC).
- IDs: `CL-YYYY-XXXX-XXXX` (Professional) or `CA-YYYY-XXXX-XXXX` (Advanced), random
  letters and digits.
- Claiming again returns the same certificate with `"existing": true`.
- `503 signing_unavailable` if the signing key isn't configured.

### `GET /api/credentials/:id` — public

```json
{ "id": "CL-2026-7Q2M-K9XA", "name": "Avery Quinn", "awarded": "2026-10-28", "written": 93,
  "practical": 100, "distinction": true, "program": "professional", "credential": { … } }
```
Same shape as an entry in `/credentials.json`; a withdrawn certificate also has
`"revoked": true` (and `credential.revoked`, `credential.revokedOn`, re-signed). Any
website may call it (CORS `*`), cached for 60 seconds. Unknown → `404 not_found`.
`verify.html` checks here first, then falls back to `/credentials.json`.

### `POST /api/admin/revoke` — admin

```
Authorization: Bearer <ADMIN_TOKEN>
{ "id": "CL-2026-7Q2M-K9XA" }
```
Marks it revoked, re-signs it (like `sign.js --revoke`) and returns the entry
(`"alreadyRevoked": true` if it was). The student can't claim a new one for that program.
Use this for server-issued certificates; `sign.js --revoke` is for ones in `credentials.json`.

From a terminal:
```sh
curl -X POST https://coll-academy-api.<sub>.workers.dev/api/admin/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"id":"CL-2026-7Q2M-K9XA"}'
```

---

## The tries rule

The same rule as the app: **three failed tries in a row, then a 24-hour break; a pass
resets the count.** The server keeps four separate counters — Professional written,
Professional practical, Advanced written, Advanced practical — and keeps each one
**per student and per email address** (so a new enrollment with the same email shares
the count; letter case doesn't matter). If either is locked, the exam is locked.

- Written: a submitted attempt that fails, or an attempt left past its 3 hours, is a try.
- Practical: every grading (`/practical/submit`) is a try.
- While locked: `/exam/start` and `/practical/submit` answer `423 locked` with
  `lockedUntil`. Starting or re-opening a practical still works.
- `GET /api/me` → `exams.<exam>.written.tries` / `.practical.tries` give `left` and
  `lockedUntil` for the screens.

---

## What the app must do

1. **Base URL.** One constant (e.g. `App.ACADEMY_API`) set to the deployed address.
2. **Enroll** once: ask for full name and email, `POST /api/enroll`, and save
   `{ token, studentId }` in `localStorage` (e.g. key `coll-academy`). In the Electron app
   `localStorage` persists per user; that's fine. Never put the token in a URL or log it.
3. **Send the token** as `Authorization: Bearer <token>` on every 🔒 call. On `401`,
   clear it and show "Sign in" (enroll or redeem a code).
4. **Second device:** on the signed-in device, a "Sign in on another device" button calls
   `POST /api/code` and shows the 8-character code in big letters with a 15-minute
   countdown. On the new device, "I already have an account" → type the code →
   `POST /api/code/redeem` → store the returned token.
   Optionally show the student code (the token) itself under "Advanced", for copy-paste.
5. **Sync progress:** after meaningful changes (debounced, e.g. 5 s) `PUT /api/progress`
   with gzip-base64 data and `baseVersion`; on start-up and when the app regains focus,
   `GET /api/progress` and use it if its `version` is newer. On `409 conflict`, download,
   merge (e.g. union of lessons done; keep best scores), save again.
6. **Written exams:** replace the local `BANK` draw with `/exam/start`; render
   `questions[].options` in the order given; send the option **position**. Show
   `review` after submitting. Store the result in `training.written` / `advWritten` as
   today, if the screens still read it, but treat the server as the source of truth.
7. **Practical exams:** `/practical/start` → insert `client` into `S.data.clients`
   (replace any older exam client), show `brief.documents` and `brief.tasks` instead of
   the hard-coded brief; "Grade my work" → `/practical/submit` with the client JSON;
   show `items` (and `why` only when present). "Start over" → `fresh: true`.
8. **Certificate:** before claiming, confirm the name (`POST /api/me` to fix it — it locks
   after). `POST /api/credential/claim` → use the returned `id`, `awarded`, scores and
   `distinction` for the PDF, badge, LinkedIn link and verify link. Registration by email
   is no longer needed: the verify page finds it on the server right away.
9. **Delete my data:** a settings button that confirms, then `DELETE /api/me` with
   `{"confirm":"DELETE"}` and clears the stored token.
10. **Offline:** lessons work offline; exams and certificates need a connection — show
    a friendly message on network errors.

---

## Limits

| What | Limit |
|---|---|
| Request body (most routes) | 16 KB |
| Written submission | 64 KB |
| Progress `data` | 900 KB (body up to 908 KB) |
| Practical submission | 1 MB |
| Enrollments | 20 per hour per network |
| One-time code redemptions | 10 per hour per network |
| One-time codes created | 10 per hour per student |
| Written attempt | 3 hours |
| One-time code | 15 minutes, single use |

Networks are told apart by a one-way hash of the IP address; IP addresses are never stored.
