'use strict';
// Shared pieces for sign.js and verify.js.
// The browser check in /verify.html uses the identical canonical form:
// keys sorted at every level, no extra spaces, and the `proof` property left out.

const ISSUER = {
  id: 'https://collbusinesssolutions.com',
  type: ['Profile'],
  name: 'Coll Business Solutions LLC',
  url: 'https://collbusinesssolutions.com',
  email: 'collbusinesssolutions@gmail.com'
};
const KEY_ID = 'coll-2026-1';
const KEYS_URL = 'https://collbusinesssolutions.com/.well-known/coll-credentials-keys.json';
const VERIFICATION_METHOD = `${KEYS_URL}#${KEY_ID}`;
const PROOF_TYPE = 'DataIntegrityProof';
const CRYPTOSUITE = 'coll-ed25519-jcs-2026'; // Ed25519 over sorted-key JSON, proof removed

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => (v === undefined ? 'null' : canonicalize(v))).join(',') + ']';
  return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

// What gets signed: the credential without its proof.
function signingBytes(credential) {
  const copy = Object.assign({}, credential);
  delete copy.proof;
  return Buffer.from(canonicalize(copy), 'utf8');
}

const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

module.exports = { ISSUER, KEY_ID, KEYS_URL, VERIFICATION_METHOD, PROOF_TYPE, CRYPTOSUITE, canonicalize, signingBytes, b64url, fromB64url };
