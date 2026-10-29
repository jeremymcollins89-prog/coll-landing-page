#!/usr/bin/env node
'use strict';
/* =====================================================================
   Register (sign) a Coll Ledger Academy credential in /credentials.json
   ---------------------------------------------------------------------
   Usage
     node scripts/credentials/sign.js entry.json        a file holding the entry
     node scripts/credentials/sign.js '{"id":"CL-…"}'   the entry itself
     cat email.txt | node scripts/credentials/sign.js   from stdin (the whole
                                                        registration email is
                                                        fine — the {…} entry is
                                                        picked out of it)
     node scripts/credentials/sign.js --revoke CL-2026-XXXX-XXXX
   Options
     --file <path>   credentials file to update (default: <repo>/credentials.json)
   Needs the private key (PEM) in the environment variable CREDENTIAL_SIGNING_KEY.

   Each entry in credentials.json keeps the flat fields the site has always
   used (id, name, awarded, written, practical, distinction, program) and adds
   `credential`: an Open Badges 3.0–style credential signed with Ed25519.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('./lib');

const SITE = 'https://collbusinesssolutions.com';
const PROGRAMS = {
  professional: {
    prefix: 'CL',
    name: 'Professional Bookkeeping Certificate',
    achievementId: `${SITE}/academy.html#professional`,
    description: 'A training certificate from the Coll Ledger Academy, issued by Coll Business Solutions LLC. The holder completed 29 hands-on lessons in four levels — foundations, month-end professional, client advisor and running a practice — covering bookkeeping fundamentals, debits and credits, payroll, journal entries, reconciliation and month-end close, cash flow, business types and estimated taxes, and professional practice, about 12½ hours of coursework and exams.',
    criteria: 'Complete all 29 lessons in four levels. Pass a written exam of 30 questions drawn from a 67-question bank with 80% or better. Pass a practical month-end close for Juniper Flower Co., graded automatically on 12 checks against the month-end books: 80 points or more, a balanced bank reconciliation and the month closed. Distinction: 100 on the practical and 92% or better on the written exam. This is a training certificate; it is not a CPA license, an IRS credential, a state license, or a credential from a professional accounting body, and it carries no college credit.',
    written: { questions: 30, bank: 67 },
    practical: 'Practical exam: month-end close for Juniper Flower Co. (12 checks, 100 points)'
  },
  advanced: {
    prefix: 'CA',
    name: 'Advanced Accounting & Tax Certificate',
    achievementId: `${SITE}/academy.html#advanced`,
    description: 'A training certificate from the Coll Ledger Academy, issued by Coll Business Solutions LLC, open only to holders of the Professional Bookkeeping Certificate. The holder completed 14 advanced lessons in three modules — accrual accounting and the close; tax compliance; and professional standards — about 8½ hours of coursework and exams.',
    criteria: 'Hold the Professional Bookkeeping Certificate. Complete all 14 lessons in three modules (A: accrual accounting and the close; B: tax compliance; C: professional standards). Pass a written exam of 35 questions drawn from a 60-question bank with 80% or better. Pass a practical month-end close with adjusting entries for Aspen Trail Outfitters, graded on the month-end account balances across 8 checks worth 100 points: 80 points or more, with the month closed. Distinction: 100 on the practical and 92% or better on the written exam. This is a training certificate; it is not a CPA license, an IRS credential, a state license, or a credential from a professional accounting body, and it carries no college credit.',
    written: { questions: 35, bank: 60 },
    practical: 'Practical exam: month-end close with adjusting entries for Aspen Trail Outfitters (8 checks, 100 points)'
  }
};
const ID_RE = /^(CL|CA)-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;

function fail(msg) { console.error('Error: ' + msg); process.exit(1); }

// ---------------------------------------------------------------- input
function parseArgs(argv) {
  const o = { file: path.join(__dirname, '..', '..', 'credentials.json'), revoke: null, input: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') o.file = argv[++i];
    else if (a === '--revoke') o.revoke = argv[++i];
    else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 22).join('\n')); process.exit(0); }
    else if (o.input == null) o.input = a;
    else fail(`unexpected argument "${a}"`);
  }
  if (o.revoke != null && !String(o.revoke).trim()) fail('--revoke needs a credential ID');
  return o;
}

function readInput(arg) {
  if (arg != null) {
    if (/[{]/.test(arg)) return arg;
    if (fs.existsSync(arg)) return fs.readFileSync(arg, 'utf8');
    fail(`"${arg}" is neither a JSON entry nor a file`);
  }
  if (process.stdin.isTTY) fail('give the entry as a file, as an argument, or on stdin');
  return fs.readFileSync(0, 'utf8');
}

// Picks the {…} entry out of whatever was pasted (often the whole email),
// undoing the "smart quotes" some mail programs add.
function extractEntry(text) {
  const t = String(text || '').replace(/[“”„″]/g, '"').replace(/[‘’]/g, "'").replace(/ /g, ' ');
  const start = t.indexOf('{');
  if (start < 0) fail('no registry entry found — paste the line that starts with { and ends with }');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try { return JSON.parse(t.slice(start, i + 1)); } catch (e) { fail('the registry entry is not valid JSON (' + e.message + ')'); }
    }
  }
  fail('the registry entry is cut off — it must end with }');
}

// ---------------------------------------------------------------- validation
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('the entry must be a JSON object');
  const id = String(raw.id || '').trim().toUpperCase();
  if (!ID_RE.test(id)) fail(`credential ID "${raw.id}" should look like CL-2026-XXXX-XXXX or CA-2026-XXXX-XXXX`);
  const inferred = id.startsWith('CA-') ? 'advanced' : 'professional';
  const program = raw.program == null || raw.program === '' ? inferred : String(raw.program).trim().toLowerCase();
  if (!PROGRAMS[program]) fail(`program must be "professional" or "advanced" (got "${raw.program}")`);
  if (program !== inferred) fail(`program "${program}" doesn't match the ID prefix ${id.slice(0, 2)}- (CL- is professional, CA- is advanced)`);

  const name = String(raw.name || '').replace(/\s+/g, ' ').trim();
  if (!name) fail('name is missing');
  if (name.length > 120) fail('name is longer than 120 characters');
  if (/[\u0000-\u001F\u007F<>]/.test(name)) fail('name contains characters that aren\'t allowed');

  const awarded = String(raw.awarded || '').trim();
  if (!validDate(awarded)) fail(`awarded date "${raw.awarded}" must be a real date written YYYY-MM-DD`);
  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
  if (awarded > tomorrow) fail(`awarded date ${awarded} is in the future`);
  if (awarded < '2025-01-01') fail(`awarded date ${awarded} is before the Academy existed`);
  if (awarded.slice(0, 4) !== id.slice(3, 7)) fail(`the year in the ID (${id.slice(3, 7)}) doesn't match the awarded date (${awarded})`);

  const score = (v, label) => {
    const n = typeof v === 'string' ? Number(v.replace(/[%\s]|\/\s*100$/g, '')) : v;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 100) fail(`${label} must be a whole number from 0 to 100 (got ${JSON.stringify(v)})`);
    if (n < 80) fail(`${label} of ${n} is below the passing mark of 80 — a certificate isn't issued for that`);
    return n;
  };
  const written = score(raw.written, 'written exam score');
  const practical = score(raw.practical, 'practical exam score');
  const shouldDistinction = written >= 92 && practical === 100;
  const distinction = raw.distinction === true || raw.distinction === 'true';
  if (distinction !== shouldDistinction) fail(`distinction is ${distinction} but the scores (${written}% written, ${practical}/100 practical) mean it should be ${shouldDistinction}`);
  return { id, name, awarded, written, practical, distinction, program };
}

// ---------------------------------------------------------------- credential
function buildCredential(e) {
  const P = PROGRAMS[e.program];
  const a = P.achievementId;
  const credential = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
    id: `${SITE}/verify.html?id=${e.id}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: P.name + (e.distinction ? ' — with distinction' : ''),
    issuer: L.ISSUER,
    validFrom: `${e.awarded}T00:00:00Z`,
    credentialSubject: {
      type: ['AchievementSubject'],
      identifier: [{ type: 'IdentityObject', identityHash: e.name, identityType: 'name', hashed: false }],
      achievement: {
        id: a,
        type: ['Achievement'],
        achievementType: 'Certificate',
        name: P.name,
        description: P.description,
        criteria: { narrative: P.criteria },
        creator: L.ISSUER,
        image: { id: `${SITE}/img/coll-ledger-academy-badge.png`, type: 'Image' },
        resultDescription: [
          { id: `${a}-written`, type: ['ResultDescription'], name: `Written exam: ${P.written.questions} questions drawn from a ${P.written.bank}-question bank`, resultType: 'Percent', requiredValue: '80', valueMin: '0', valueMax: '100' },
          { id: `${a}-practical`, type: ['ResultDescription'], name: P.practical, resultType: 'ScaledScore', requiredValue: '80', valueMin: '0', valueMax: '100' },
          { id: `${a}-standing`, type: ['ResultDescription'], name: 'Standing', resultType: 'RubricCriterionLevel', rubricCriterionLevel: [
            { id: `${a}-pass`, type: ['RubricCriterionLevel'], name: 'Pass', description: '80% or better on the written exam and 80 or more on the practical.' },
            { id: `${a}-distinction`, type: ['RubricCriterionLevel'], name: 'With distinction', description: '100 on the practical and 92% or better on the written exam.' }
          ] }
        ]
      },
      result: [
        { type: ['Result'], resultDescription: `${a}-written`, value: String(e.written) },
        { type: ['Result'], resultDescription: `${a}-practical`, value: String(e.practical) },
        { type: ['Result'], resultDescription: `${a}-standing`, achievedLevel: e.distinction ? `${a}-distinction` : `${a}-pass` }
      ]
    }
  };
  return credential;
}

function loadKey() {
  let pem = process.env.CREDENTIAL_SIGNING_KEY;
  if (!pem || !pem.trim()) fail('CREDENTIAL_SIGNING_KEY is not set. Add the private key (the whole contents of coll-signing-key.pem) as a repository secret named CREDENTIAL_SIGNING_KEY.');
  pem = pem.replace(/\\n/g, '\n').replace(/\r/g, '').trim() + '\n';
  let key;
  try { key = crypto.createPrivateKey(pem); } catch (e) { fail('CREDENTIAL_SIGNING_KEY is not a readable private key — paste the whole file, including the BEGIN and END lines.'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('CREDENTIAL_SIGNING_KEY must be an Ed25519 key');
  // Make sure it pairs with the published public key, so nothing is signed with a stray key.
  const pub = crypto.createPublicKey(key).export({ format: 'jwk' });
  const keysFile = path.join(__dirname, '..', '..', '.well-known', 'coll-credentials-keys.json');
  const published = JSON.parse(fs.readFileSync(keysFile, 'utf8')).keys.find(k => k.kid === L.KEY_ID);
  if (!published || published.x !== pub.x) fail(`CREDENTIAL_SIGNING_KEY doesn't match the public key "${L.KEY_ID}" in .well-known/coll-credentials-keys.json`);
  return key;
}

function sign(credential, key) {
  delete credential.proof;
  const sig = crypto.sign(null, L.signingBytes(credential), key);
  credential.proof = {
    type: L.PROOF_TYPE,
    cryptosuite: L.CRYPTOSUITE,
    verificationMethod: L.VERIFICATION_METHOD,
    created: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    proofPurpose: 'assertionMethod',
    proofValue: L.b64url(sig)
  };
  return credential;
}

// ---------------------------------------------------------------- main
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const key = loadKey();
  let list = [];
  if (fs.existsSync(opts.file)) {
    const txt = fs.readFileSync(opts.file, 'utf8').trim();
    try { list = txt ? JSON.parse(txt) : []; } catch (e) { fail(`${opts.file} is not valid JSON (${e.message})`); }
    if (!Array.isArray(list)) fail(`${opts.file} must hold a JSON array`);
  }

  let entry, action;
  if (opts.revoke != null) {
    const id = String(opts.revoke).trim().toUpperCase();
    const at = list.findIndex(x => String(x.id).toUpperCase() === id);
    if (at < 0) fail(`no credential ${id} in ${path.basename(opts.file)}`);
    const flat = normalizeLoose(list[at]);
    const credential = list[at].credential && list[at].credential.credentialSubject ? list[at].credential : buildCredential(flat);
    credential.revoked = true;
    credential.revokedOn = new Date().toISOString().slice(0, 10);
    entry = Object.assign({}, flat, { revoked: true, credential: sign(credential, key) });
    list[at] = entry; action = 'Revoked';
  } else {
    const flat = normalize(extractEntry(readInput(opts.input)));
    entry = Object.assign({}, flat, { credential: sign(buildCredential(flat), key) });
    const at = list.findIndex(x => String(x.id).toUpperCase() === flat.id);
    if (at >= 0) { list[at] = entry; action = 'Replaced'; } else { list.push(entry); action = 'Registered'; }
  }

  fs.writeFileSync(opts.file, JSON.stringify(list, null, 2) + '\n');
  console.log(`${action} ${entry.id} — ${entry.name} (${PROGRAMS[entry.program].name})`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `id=${entry.id}\naction=${action}\n`);
}

// For revoking an older entry: keep its flat fields as they are.
function normalizeLoose(x) {
  const id = String(x.id).trim().toUpperCase();
  return { id, name: x.name, awarded: x.awarded, written: x.written, practical: x.practical, distinction: !!x.distinction, program: x.program || (id.startsWith('CA-') ? 'advanced' : 'professional') };
}

main();
