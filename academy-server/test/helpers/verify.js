// Checks a credentials.json-style entry three ways:
//  1. scripts/credentials/verify.js's logic (lib.js canonical form + Node crypto)
//  2. the browser: verify.html's own canon() and signedFacts(), lifted out of the
//     page, with Web Crypto Ed25519 — exactly what visitors' browsers run
//  3. with the real key: the repo's verify.js script against the published keys file
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { KEY, REPO } from './harness.js';

const require = createRequire(import.meta.url);
export const L = require(path.join(REPO, 'scripts/credentials/lib.js'));

// The browser check from verify.html, lifted straight out of the page.
const verifyHtml = fs.readFileSync(path.join(REPO, 'verify.html'), 'utf8');
const browserCanon = Function(grab(verifyHtml, /(function canon\(v\) \{[\s\S]*?\n  \})/) + '\nreturn canon;')();
const browserFacts = Function(grab(verifyHtml, /(function signedFacts\(cr\) \{[\s\S]*?\n  \})/) + '\nreturn signedFacts;')();
function grab(text, re) { const m = re.exec(text); assert(m, 'verify.html is missing ' + re); return m[1]; }

export async function assertVerifies(entry) {
  const cr = entry.credential;
  // 1. scripts/credentials/verify.js logic (lib.js canonical form + Node crypto)
  const pub = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: KEY.x }, format: 'jwk' });
  assert.equal(cr.proof.verificationMethod, L.VERIFICATION_METHOD);
  assert.equal(cr.proof.type, L.PROOF_TYPE); assert.equal(cr.proof.cryptosuite, L.CRYPTOSUITE);
  assert(crypto.verify(null, L.signingBytes(cr), pub, L.fromB64url(cr.proof.proofValue)), 'lib.js signature check failed');
  // 2. the browser: verify.html's canon() + Web Crypto Ed25519, and the facts it compares
  const key = await crypto.webcrypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: KEY.x }, { name: 'Ed25519' }, false, ['verify']);
  const copy = {}; Object.keys(cr).forEach(k => { if (k !== 'proof') copy[k] = cr[k]; });
  assert(await crypto.webcrypto.subtle.verify({ name: 'Ed25519' }, key, L.fromB64url(cr.proof.proofValue), new TextEncoder().encode(browserCanon(copy))), 'browser signature check failed');
  const f = browserFacts(cr);
  assert.equal(f.id.toUpperCase(), entry.id); assert.equal(f.name, entry.name); assert.equal(f.awarded, entry.awarded);
  assert.equal(f.written, entry.written); assert.equal(f.practical, entry.practical); assert.equal(f.distinction, !!entry.distinction);
  assert.equal(!!cr.revoked, !!entry.revoked);
  // 3. with the real key: the repo's own verify.js against the published keys file
  if (KEY.real) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-'));
    const file = path.join(dir, 'credentials.json');
    fs.writeFileSync(file, JSON.stringify([entry], null, 2));
    try {
      const out = execFileSync(process.execPath, [path.join(REPO, 'scripts/credentials/verify.js'), '--file', file, '--require-signed'], { encoding: 'utf8' });
      assert.match(out, /1 signed, 0 not signed, 0 failed/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
}

