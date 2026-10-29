'use strict';
/* =====================================================================
   Coll Ledger — password lock and encryption
   When a password is on, the books file, every backup and every receipt
   are encrypted with AES-256-GCM. A random data key does the encrypting;
   it is wrapped twice — once by the password and once by a recovery code —
   so either one can unlock the books.
   ===================================================================== */
const Secure = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  const ITER = 310000;

  async function kek(secret, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(secret.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const importDek = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function seal(key, bytes) { const iv = rand(12); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes); return { iv: b64(iv), data: b64(ct) }; }
  async function open(key, box) { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data))); }

  // A readable recovery code: 6 groups of 4 (no look-alike characters)
  function recoveryCode() {
    const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const r = rand(24);
    let s = '';
    for (let i = 0; i < 24; i++) { s += abc[r[i] % abc.length]; if (i % 4 === 3 && i < 23) s += '-'; }
    return s;
  }
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');

  // Create a new lock: returns { header, dek } — header goes in the file, dek stays in memory
  async function create(password, hint) {
    const dekRaw = rand(32);
    const code = recoveryCode();
    const salt = rand(16), saltR = rand(16);
    const header = {
      v: 1, hint: hint || '', salt: b64(salt), saltR: b64(saltR),
      wrapPw: await seal(await kek(password, salt), dekRaw),
      wrapRc: await seal(await kek(normCode(code), saltR), dekRaw)
    };
    return { header, dek: await importDek(dekRaw), dekRaw, code };
  }
  async function rewrapPassword(header, dekRaw, password, hint) {
    const salt = rand(16);
    return Object.assign({}, header, { salt: b64(salt), hint: hint != null ? hint : header.hint, wrapPw: await seal(await kek(password, salt), dekRaw) });
  }
  // Try the password, then (if it looks like one) the recovery code
  async function unlock(header, secret) {
    const tries = [[secret, header.salt, header.wrapPw]];
    if (/^[A-Za-z0-9]{4}(-?[A-Za-z0-9]{4}){5}$/.test(String(secret).trim())) tries.push([normCode(secret), header.saltR, header.wrapRc]);
    for (const [s, salt, box] of tries) {
      try { const raw = await open(await kek(s, unb64(salt)), box); return { dek: await importDek(raw), dekRaw: raw, byRecovery: box === header.wrapRc }; } catch (e) { }
    }
    return null;
  }
  async function encryptBooks(header, dek, obj) {
    const box = await seal(dek, enc.encode(JSON.stringify(obj)));
    return JSON.stringify({ collLedgerEncrypted: 1, header, box });
  }
  async function decryptBooks(dek, env) { return JSON.parse(dec.decode(await open(dek, env.box))); }
  const isEncrypted = d => !!(d && d.collLedgerEncrypted && d.header && d.box);
  async function encryptBytes(dek, bytes) { const box = await seal(dek, bytes); return enc.encode(JSON.stringify(box)); }
  async function decryptBytes(dek, bytes) { return open(dek, JSON.parse(dec.decode(bytes))); }

  return { create, unlock, rewrapPassword, encryptBooks, decryptBooks, isEncrypted, encryptBytes, decryptBytes, b64, unb64, normCode };
})();
if (typeof module !== 'undefined') module.exports = Secure;
