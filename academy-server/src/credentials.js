// Certificates: issue, sign, look up and revoke.
// The credential JSON and its proof are built EXACTLY like
// scripts/credentials/sign.js (with lib.js), so /verify.html and
// scripts/credentials/verify.js accept server-issued credentials unchanged.
import { fail } from './http.js';
import { randomString, b64url, fromB64, isoDate, isoTime } from './util.js';
import { bestPractical } from './practical/index.js';
import { EXAMS, hasCredential } from './written.js';

// ---------------------------------------------------------------- from lib.js
const ISSUER = {
  id: 'https://collbusinesssolutions.com',
  type: ['Profile'],
  name: 'Coll Business Solutions LLC',
  url: 'https://collbusinesssolutions.com',
  email: 'collbusinesssolutions@gmail.com'
};
export const KEY_ID = 'coll-2026-1';
const KEYS_URL = 'https://collbusinesssolutions.com/.well-known/coll-credentials-keys.json';
const VERIFICATION_METHOD = `${KEYS_URL}#${KEY_ID}`;
const PROOF_TYPE = 'DataIntegrityProof';
const CRYPTOSUITE = 'coll-ed25519-jcs-2026'; // Ed25519 over sorted-key JSON, proof removed
// The published public key ("x") for KEY_ID in /.well-known/coll-credentials-keys.json.
// The server refuses to sign with any private key that doesn't pair with it.
export const PUBLISHED_KEY_X = 'HhDDM8Ju-SxU_h65C0r27JUCaN3pPlbUtJ824pnyzm4';

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => (v === undefined ? 'null' : canonicalize(v))).join(',') + ']';
  return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}
const signingBytes = credential => { const copy = Object.assign({}, credential); delete copy.proof; return new TextEncoder().encode(canonicalize(copy)); };

// ---------------------------------------------------------------- from sign.js
const SITE = 'https://collbusinesssolutions.com';
export const PROGRAMS = {
  professional: {
    prefix: 'CL', exam: 'pro',
    name: 'Professional Bookkeeping Certificate',
    achievementId: `${SITE}/academy.html#professional`,
    description: 'A training certificate from the Coll Ledger Academy, issued by Coll Business Solutions LLC. The holder completed 29 hands-on lessons in four levels — foundations, month-end professional, client advisor and running a practice — covering bookkeeping fundamentals, debits and credits, payroll, journal entries, reconciliation and month-end close, cash flow, business types and estimated taxes, and professional practice, about 12½ hours of coursework and exams.',
    criteria: 'Complete all 29 lessons in four levels. Pass a written exam of 30 questions — 18 drawn from a 67-question bank plus 12 calculation questions with fresh numbers each attempt — with 80% or better. Pass a practical month-end close for Juniper Flower Co., graded automatically on 12 checks against the month-end books: 80 points or more, a balanced bank reconciliation and the month closed. Distinction: 100 on the practical and 92% or better on the written exam. This is a training certificate; it is not a CPA license, an IRS credential, a state license, or a credential from a professional accounting body, and it carries no college credit.',
    written: { questions: 30, bank: 67 },
    practical: 'Practical exam: month-end close for Juniper Flower Co. (12 checks, 100 points)'
  },
  advanced: {
    prefix: 'CA', exam: 'adv',
    name: 'Advanced Accounting & Tax Certificate',
    achievementId: `${SITE}/academy.html#advanced`,
    description: 'A training certificate from the Coll Ledger Academy, issued by Coll Business Solutions LLC, open only to holders of the Professional Bookkeeping Certificate. The holder completed 14 advanced lessons in three modules — accrual accounting and the close; tax compliance; and professional standards — about 8½ hours of coursework and exams.',
    criteria: 'Hold the Professional Bookkeeping Certificate. Complete all 14 lessons in three modules (A: accrual accounting and the close; B: tax compliance; C: professional standards). Pass a written exam of 35 questions — 21 drawn from a 60-question bank plus 14 calculation questions with fresh numbers each attempt — with 80% or better. Pass a practical month-end close with adjusting entries for Aspen Trail Outfitters, graded on the month-end account balances across 8 checks worth 100 points: 80 points or more, with the month closed. Distinction: 100 on the practical and 92% or better on the written exam. This is a training certificate; it is not a CPA license, an IRS credential, a state license, or a credential from a professional accounting body, and it carries no college credit.',
    written: { questions: 35, bank: 60 },
    practical: 'Practical exam: month-end close with adjusting entries for Aspen Trail Outfitters (8 checks, 100 points)'
  }
};
export const ID_RE = /^(CL|CA)-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;

// Identical to buildCredential() in scripts/credentials/sign.js.
export function buildCredential(e) {
  const P = PROGRAMS[e.program];
  const a = P.achievementId;
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
    id: `${SITE}/verify.html?id=${e.id}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: P.name + (e.distinction ? ' — with distinction' : ''),
    issuer: ISSUER,
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
        creator: ISSUER,
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
}

// ---------------------------------------------------------------- signing (Web Crypto)
let cachedKey = null; // { pem, key }
export async function signingStatus(env) { try { await signingKey(env); return 'ok'; } catch (e) { return (e && e.message) || 'unavailable'; } }
async function signingKey(env) {
  let pem = env.CREDENTIAL_SIGNING_KEY;
  if (!pem || !String(pem).trim()) fail(503, 'signing_unavailable', 'Certificates can\'t be issued right now (the signing key isn\'t set up). Please try again later.');
  if (cachedKey && cachedKey.pem === pem) return cachedKey.key;
  const der = fromB64(String(pem).replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, ''));
  let key, jwk;
  try {
    key = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, true, ['sign']);
    jwk = await crypto.subtle.exportKey('jwk', key);
  } catch (_) { fail(503, 'signing_unavailable', 'Certificates can\'t be issued right now (the signing key can\'t be read).'); }
  // Make sure it pairs with the published public key, so nothing is signed with a stray key.
  if (jwk.x !== (env.EXPECTED_KEY_X || PUBLISHED_KEY_X)) fail(503, 'signing_unavailable', 'Certificates can\'t be issued right now (the signing key doesn\'t match the published key).');
  cachedKey = { pem, key };
  return key;
}

// Same proof as sign() in sign.js.
async function sign(env, credential, now) {
  delete credential.proof;
  const key = await signingKey(env);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, signingBytes(credential)));
  credential.proof = {
    type: PROOF_TYPE,
    cryptosuite: CRYPTOSUITE,
    verificationMethod: VERIFICATION_METHOD,
    created: isoTime(now),
    proofPurpose: 'assertionMethod',
    proofValue: b64url(sig)
  };
  return credential;
}

// ---------------------------------------------------------------- entries
// The public shape — the same as an entry in /credentials.json.
export function entryOf(row) {
  const e = { id: row.id, name: row.name, awarded: row.awarded, written: row.written, practical: row.practical, distinction: !!row.distinction, program: row.program };
  if (row.revoked) e.revoked = true;
  e.credential = JSON.parse(row.credential);
  return e;
}

export async function listForStudent(env, studentId) {
  const rows = await env.DB.prepare('SELECT * FROM credentials WHERE student_id = ?1 ORDER BY created_at').bind(studentId).all();
  return (rows.results || []).map(entryOf);
}

// What the student still needs for a program.
export async function eligibility(env, student, program) {
  const exam = PROGRAMS[program].exam;
  const w = await env.DB.prepare("SELECT MAX(pct) AS best FROM results WHERE student_id = ?1 AND exam = ?2 AND kind = 'written' AND passed = 1").bind(student.id, exam).first();
  const p = await bestPractical(env, student.id, exam);
  const needs = [];
  if (program === 'advanced' && !(await hasCredential(env, student.id, 'professional'))) needs.push('professional_certificate');
  if (!w || w.best == null) needs.push('written');
  if (!p.passed) needs.push('practical');
  return { needs, writtenPct: w && w.best != null ? w.best : null, practical: p.passScore };
}

// POST /api/credential/claim {program}
export async function claim(env, student, program, now) {
  if (!PROGRAMS[program]) fail(400, 'invalid_program', 'program must be "professional" or "advanced".');
  const live = await env.DB.prepare('SELECT * FROM credentials WHERE student_id = ?1 AND program = ?2 AND revoked = 0').bind(student.id, program).first();
  if (live) return { ...entryOf(live), existing: true };
  const withdrawn = await env.DB.prepare('SELECT id FROM credentials WHERE student_id = ?1 AND program = ?2 AND revoked = 1 LIMIT 1').bind(student.id, program).first();
  if (withdrawn) fail(403, 'revoked', `Your certificate ${withdrawn.id} was withdrawn, so a new one can't be issued here. Write to collbusinesssolutions@gmail.com.`);
  const el = await eligibility(env, student, program);
  if (el.needs.length) {
    const words = { professional_certificate: 'the Professional certificate', written: `a passing ${EXAMS[PROGRAMS[program].exam].title}`, practical: 'a passing practical exam' };
    fail(403, 'not_eligible', `Not yet — still needed: ${el.needs.map(n => words[n]).join(', ')}.`, { needs: el.needs });
  }
  const written = Math.round(el.writtenPct * 100), practical = el.practical;
  const awarded = isoDate(now);
  const flat = { name: student.name, awarded, written, practical, distinction: written >= 92 && practical === 100, program };
  for (let attempt = 0; attempt < 5; attempt++) {
    const C36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const id = `${PROGRAMS[program].prefix}-${awarded.slice(0, 4)}-${randomString(4, C36)}-${randomString(4, C36)}`;
    const entry = { id, ...flat };
    const credential = await sign(env, buildCredential(entry), now);
    try {
      await env.DB.prepare('INSERT INTO credentials (id, student_id, program, name, awarded, written, practical, distinction, revoked, credential, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10)')
        .bind(id, student.id, program, entry.name, awarded, written, practical, entry.distinction ? 1 : 0, JSON.stringify(credential), now).run();
    } catch (e) {
      // Another request issued one at the same moment: return that one.
      const again = await env.DB.prepare('SELECT * FROM credentials WHERE student_id = ?1 AND program = ?2 AND revoked = 0').bind(student.id, program).first();
      if (again) return { ...entryOf(again), existing: true };
      continue; // an ID collision (very unlikely): try another ID
    }
    return { id, name: entry.name, awarded, written, practical, distinction: entry.distinction, program, credential, existing: false };
  }
  fail(500, 'server_error', 'Couldn\'t issue the certificate. Please try again.');
}

// GET /api/credentials/:id (public)
export async function getPublic(env, rawId) {
  const id = decodeURIComponent(String(rawId || '')).trim().toUpperCase();
  if (!ID_RE.test(id)) fail(404, 'not_found', 'No credential with that ID.');
  const row = await env.DB.prepare('SELECT * FROM credentials WHERE id = ?1').bind(id).first();
  if (!row) fail(404, 'not_found', 'No credential with that ID.');
  return entryOf(row);
}

// POST /api/admin/revoke {id} — marks it revoked and re-signs it, like sign.js --revoke.
export async function revoke(env, body, now) {
  const id = String(body.id || '').trim().toUpperCase();
  if (!ID_RE.test(id)) fail(400, 'invalid_id', 'id should look like CL-2026-XXXX-XXXX or CA-2026-XXXX-XXXX.');
  const row = await env.DB.prepare('SELECT * FROM credentials WHERE id = ?1').bind(id).first();
  if (!row) fail(404, 'not_found', 'No credential with that ID on the Academy server.');
  if (row.revoked) return { ...entryOf(row), alreadyRevoked: true };
  const credential = JSON.parse(row.credential);
  credential.revoked = true;
  credential.revokedOn = isoDate(now);
  await sign(env, credential, now);
  await env.DB.prepare('UPDATE credentials SET revoked = 1, credential = ?2 WHERE id = ?1').bind(id, JSON.stringify(credential)).run();
  return entryOf({ ...row, revoked: 1, credential: JSON.stringify(credential) });
}
