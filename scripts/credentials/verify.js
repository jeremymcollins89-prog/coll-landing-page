#!/usr/bin/env node
'use strict';
/* =====================================================================
   Check every signed credential in /credentials.json
   ---------------------------------------------------------------------
   node scripts/credentials/verify.js [--file <path>] [--require-signed]
   Checks each entry's Ed25519 signature against the public key in
   /.well-known/coll-credentials-keys.json, and that the flat fields the
   site shows agree with the signed credential. Exits 1 on any failure.
   --require-signed also fails on entries that have no signature yet.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('./lib');

const root = path.join(__dirname, '..', '..');
let file = path.join(root, 'credentials.json'), requireSigned = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--file') file = process.argv[++i];
  else if (process.argv[i] === '--require-signed') requireSigned = true;
}

const keysDoc = JSON.parse(fs.readFileSync(path.join(root, '.well-known', 'coll-credentials-keys.json'), 'utf8'));
const keys = {};
for (const k of keysDoc.keys || []) keys[`${L.KEYS_URL}#${k.kid}`] = crypto.createPublicKey({ key: { kty: k.kty, crv: k.crv, x: k.x }, format: 'jwk' });

let list;
try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`Error: ${file} is not valid JSON (${e.message})`); process.exit(1); }
if (!Array.isArray(list)) { console.error(`Error: ${file} must hold a JSON array`); process.exit(1); }

let bad = 0, signed = 0, unsigned = 0;
const seen = new Set();
const results = c => {
  const out = {};
  for (const r of (c.credentialSubject && c.credentialSubject.result) || []) {
    const kind = String(r.resultDescription || r.achievedLevel || '').split('-').pop();
    if (kind === 'written' || kind === 'practical') out[kind] = Number(r.value);
    if (r.achievedLevel) out.distinction = /-distinction$/.test(r.achievedLevel);
  }
  return out;
};

for (const e of list) {
  const id = String(e && e.id || '').toUpperCase();
  const problems = [];
  if (seen.has(id)) problems.push('appears more than once');
  seen.add(id);
  const c = e && e.credential;
  if (!c || !c.proof) {
    unsigned++;
    if (requireSigned) problems.push('has no signature');
  } else {
    signed++;
    const p = c.proof;
    const key = keys[p.verificationMethod];
    if (!key) problems.push(`unknown signing key ${p.verificationMethod}`);
    else if (p.type !== L.PROOF_TYPE || p.cryptosuite !== L.CRYPTOSUITE) problems.push('unexpected proof type');
    else {
      let ok = false;
      try { ok = crypto.verify(null, L.signingBytes(c), key, L.fromB64url(p.proofValue)); } catch (_) { ok = false; }
      if (!ok) problems.push('SIGNATURE DOES NOT MATCH — the entry was changed after signing');
    }
    // the flat fields the website shows must say the same as the signed credential
    const r = results(c);
    const holder = ((c.credentialSubject && c.credentialSubject.identifier) || [])[0] || {};
    if (!String(c.id || '').endsWith('?id=' + id)) problems.push('ID differs from the signed credential');
    if (holder.identityHash !== e.name) problems.push('name differs from the signed credential');
    if (String(c.validFrom || '').slice(0, 10) !== e.awarded) problems.push('awarded date differs from the signed credential');
    if (r.written !== e.written) problems.push('written score differs from the signed credential');
    if (r.practical !== e.practical) problems.push('practical score differs from the signed credential');
    if (r.distinction !== !!e.distinction) problems.push('distinction differs from the signed credential');
    if (!!c.revoked !== !!e.revoked) problems.push('revoked flag differs from the signed credential');
  }
  if (problems.length) { bad++; console.error(`FAIL ${id || '(no id)'}: ${problems.join('; ')}`); }
  else console.log(`ok   ${id}${c && c.proof ? ' (signed' + (c.revoked ? ', revoked' : '') + ')' : ' (not signed)'}`);
}

console.log(`${list.length} entr${list.length === 1 ? 'y' : 'ies'}: ${signed} signed, ${unsigned} not signed, ${bad} failed`);
process.exit(bad ? 1 : 0);
