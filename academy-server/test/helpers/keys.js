// The signing key for tests.
// - If CREDENTIAL_SIGNING_KEY (the PEM) or CREDENTIAL_SIGNING_KEY_FILE (a path to it)
//   is set, the real key is used, and credentials are also checked with the repo's
//   own scripts/credentials/verify.js against /.well-known/coll-credentials-keys.json.
// - Otherwise a throwaway Ed25519 key is made, and the server is told to expect it
//   (EXPECTED_KEY_X), so the tests still run anywhere — nothing secret is needed.
import crypto from 'node:crypto';
import fs from 'node:fs';

export function testKey() {
  let pem = process.env.CREDENTIAL_SIGNING_KEY;
  if ((!pem || !pem.trim()) && process.env.CREDENTIAL_SIGNING_KEY_FILE) pem = fs.readFileSync(process.env.CREDENTIAL_SIGNING_KEY_FILE, 'utf8');
  if (pem && pem.trim()) {
    pem = pem.replace(/\\n/g, '\n').replace(/\r/g, '').trim() + '\n';
    const pub = crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ format: 'jwk' });
    return { pem, x: pub.x, real: true };
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), x: publicKey.export({ format: 'jwk' }).x, real: false };
}
