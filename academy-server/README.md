# Academy server

The Academy server is a small program that runs on Cloudflare's free plan. It makes
Coll Ledger Academy certificates trustworthy:

- students get an account (name + email) and their progress syncs between phone and desktop
- written exams are graded **on the server** — the answer keys never go to the app
- each student gets **their own numbers** on the practical exams, graded on the server
- the "three tries, then a 24-hour break" rule is enforced on the server
- certificates are issued and **digitally signed** right away, and the verify page
  (`collbusinesssolutions.com/verify.html`) can check them instantly — no more emailing
  registration requests

It's built with Cloudflare Workers (the program) and Cloudflare D1 (its database), and
it deploys itself from GitHub every time it changes. Coll Business Solutions LLC.

---

## One-time setup (about 20 minutes)

You'll make a free Cloudflare account, give GitHub permission to deploy to it, and then
press "Run". You don't need to install anything on your computer.

### 1. Create a free Cloudflare account

1. Go to **https://dash.cloudflare.com/sign-up** and sign up with
   `collbusinesssolutions@gmail.com` (or whichever email you want for the business).
2. Confirm your email from the message Cloudflare sends.
3. In the dashboard's left menu, open **Workers & Pages** (under *Compute*). If it asks you
   to choose a **workers.dev subdomain**, pick something short like `collbusiness`. The
   server's address will be `https://coll-academy-api.<that-name>.workers.dev`.
   You do **not** need to pay or add a card; the free plan is enough.

### 2. Copy your Account ID

On the **Workers & Pages** page, find **Account details** on the right and click the copy
button next to **Account ID**. (Or press Ctrl+K / Cmd+K in the dashboard, type
"Copy account ID" and pick it.) Paste it somewhere for a minute — it's a long string of
letters and numbers. It isn't secret, but you'll store it with the others.

### 3. Create an API token (GitHub's key to deploy)

1. In the dashboard, open **Manage account → Account API tokens** (or click your profile
   icon → **My Profile → API Tokens**) and choose **Create Token**.
2. Next to **Edit Cloudflare Workers**, click **Use template**.
3. The database needs one more permission. Under **Permissions**, click
   **+ Add more**, then choose **Account** → **D1** → **Edit**.
4. Under **Account Resources**, choose **Include** → your account.
   Under **Zone Resources**, **All zones** is fine.
5. Click **Continue to summary**, then **Create Token**.
6. **Copy the token now** — Cloudflare shows it only once. (If you lose it, just make a new one.)

### 4. Add the secrets to GitHub

Open **https://github.com/jeremymcollins89-prog/coll-landing-page** → **Settings** →
**Secrets and variables** → **Actions** → **New repository secret**, and add:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 3 |
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID from step 2 |
| `ADMIN_TOKEN` | a long random password you make up (see below) — used only to withdraw a certificate |

**Making the `ADMIN_TOKEN`:** it should be long and random (at least 16 characters; 40+
is better). Any of these works:
- your password manager's "generate password" button (40 characters, letters and numbers), or
- on Windows, open **PowerShell** and paste: `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`, or
- on a Mac, open **Terminal** and paste: `openssl rand -hex 32`

Save it in your password manager too — GitHub won't show it to you again.

**Check `CREDENTIAL_SIGNING_KEY` is there.** It's the same private key the
*Register credential* workflow already uses (the contents of `coll-signing-key.pem`). It
should already be in the list of repository secrets. If it isn't, add it: name
`CREDENTIAL_SIGNING_KEY`, value = the whole file, including the `-----BEGIN PRIVATE KEY-----`
and `-----END PRIVATE KEY-----` lines. The server checks it matches the public key on the
website and refuses to sign with anything else.

### 5. Deploy

1. In the repository, open **Actions** → **Academy server** (left side) → **Run workflow** →
   keep branch **main** → **Run workflow**.
2. Wait about two minutes for the green check mark. Click the run: the **summary** shows
   the server's address, like `https://coll-academy-api.collbusiness.workers.dev`.
3. Open `<that address>/api/health` in your browser. You should see `"ok":true`.

The first run creates the database, sets it up, uploads the program and stores the two
secrets in Cloudflare. After that it runs by itself whenever the server's files change.
If the Cloudflare secrets aren't there yet, the workflow still runs the tests, then stops
with a note saying what's missing — it won't show a red failure.

### 6. Connect the website and the app

- In `verify.html`, near the top of the `<script>`, set
  `var ACADEMY_API = 'https://coll-academy-api.<your-name>.workers.dev';`
  so the verify page checks certificates on the server first (it still checks
  `credentials.json` too, for certificates registered by hand).
- Give the same address to the app as its Academy server (see `API.md`).

---

## Free plan limits (checked on developers.cloudflare.com, October 2026)

In plain words — these are generous for an online course:

- **Requests:** 100,000 a day for the Worker. A student taking an exam uses a few dozen;
  syncing progress adds a few more per study session.
- **Computer time per request:** 10 milliseconds. The heaviest thing the server does
  (building or grading a practical exam, or saving progress) takes about 1–2 ms.
- **Database reads:** 5 million rows a day. **Writes:** 100,000 rows a day.
- **Database storage:** 5 GB for the whole account, but **one database can be at most
  500 MB** on the free plan. Saved progress is the biggest item (up to 900 KB a student,
  usually far less when the app compresses it), so 500 MB holds thousands of students.
- The daily limits reset at midnight UTC (5 pm in Colorado in winter, 6 pm in summer).
  If a limit is ever reached, requests fail until the reset — stored data is safe — and
  Cloudflare emails you. The paid Workers plan raises everything if you ever need it.

Usage graphs: Cloudflare dashboard → **Workers & Pages → coll-academy-api → Metrics**,
and **Storage & Databases → D1 → coll-academy**.

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

---

## Everyday tasks

**Withdraw (revoke) a certificate** issued by the server. Ask Claude to do it, or run this
in a terminal (replace the address, admin token and ID):

```sh
curl -X POST https://coll-academy-api.<your-name>.workers.dev/api/admin/revoke \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"id":"CL-2026-XXXX-XXXX"}'
```
The verify page then shows it as **Revoked**. (Certificates registered by hand in
`credentials.json` are still withdrawn with the *Register credential* workflow.)

**Change the signing key or admin token:** update the GitHub secret, then run the
*Academy server* workflow again.

**Allow another website to use the API** (for example a staging site): add its address
to `ALLOWED_ORIGINS` in `wrangler.toml`, comma-separated.

---

## For developers

```
academy-server/
  src/index.js            routes, CORS, the daily clean-up
  src/students.js         enroll, tokens, one-time codes, rename, delete
  src/progress.js         progress sync
  src/written.js          written exams (draw, grade)
  src/banks/pro.js, adv.js  the question banks with answers (copied from the app)
  src/practical/          Juniper (pro) and Aspen Trail (adv): build, brief, grade
  src/credentials.js      certificates: same JSON and signature as scripts/credentials/sign.js
  src/limits.js           rate limits and the tries rule
  src/engine.js           the app's accounting engine (ledger-app/src/renderer/plus.js)
  migrations/             database changes, applied in order by the workflow
  schema.sql              the whole current schema, for reading
  test/                   npm test
  API.md                  every endpoint
```


- `npm install`, then `npm test` runs everything: the API end to end with a fake clock
  (in-process, Node's built-in SQLite standing in for D1), proof that the server builds
  and grades practicals exactly like the app, the real `verify.html` script against the
  server, and one run inside Cloudflare's own runtime (`workerd`) via Wrangler.
  Set `SKIP_WORKERD=1` to skip that last one.
- Tests make a throwaway signing key. To test with the real one (and compare
  byte-for-byte with `scripts/credentials/sign.js` and `verify.js`), set
  `CREDENTIAL_SIGNING_KEY_FILE=/path/to/coll-signing-key.pem`. Never copy the key into the repo.
- `npx wrangler dev` runs it locally (after `npx wrangler d1 migrations apply coll-academy --local`);
  put local secrets in `academy-server/.dev.vars` (git ignores it).
- Database changes: add `migrations/0002_….sql` (never edit one that's been applied) and
  update `schema.sql`.
- The server imports the app's engine directly, so the workflow also redeploys when
  `ledger-app/src/renderer/core.js` or `plus.js` change.
