// A tiny stand-in for Cloudflare D1, backed by Node's built-in SQLite, so the
// Worker's code runs unchanged in fast in-process tests (with a fake clock).
// Only the parts of the D1 API the server uses: prepare/bind/first/all/run, batch.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) {
    for (const a of args) if (a === undefined || typeof a === 'boolean') throw new TypeError(`D1 can't bind ${typeof a} (in: ${this.sql})`);
    return new Statement(this.db, this.sql, args);
  }
  _first() { const r = this.db.prepare(this.sql).get(...this.args); return r ? { ...r } : null; }
  _all() { return { results: this.db.prepare(this.sql).all(...this.args).map(r => ({ ...r })), success: true, meta: {} }; }
  _run() {
    if (/\bRETURNING\b/i.test(this.sql)) { const rows = this._all().results; return { success: true, results: rows, meta: { changes: rows.length } }; }
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async first(col) { const r = this._first(); return r == null ? null : col ? r[col] : r; }
  async all() { return this._all(); }
  async run() { return this._run(); }
}

export class FakeD1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(stmts) {
    this.db.exec('BEGIN');
    try { const out = stmts.map(s => (/^\s*SELECT/i.test(s.sql) ? s._all() : s._run())); this.db.exec('COMMIT'); return out; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  // Applies every migration in order, like `wrangler d1 migrations apply`.
  migrate(dir) {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) this.db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    return this;
  }
}
