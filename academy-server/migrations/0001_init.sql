-- Coll Ledger Academy server — first schema.
-- Times are milliseconds since 1970 (UTC). Dates shown to people are YYYY-MM-DD.
-- The only personal data kept is a student's name and email address.

-- A student. Email is not verified; it is lowercased and used to share the
-- exam tries rule between enrollments with the same address.
CREATE TABLE students (
  id         TEXT PRIMARY KEY,           -- st_xxxxxxxxxxxx
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX students_email ON students(email);

-- Sign-in tokens. Only the SHA-256 of each token is stored. A student has one
-- token per device (enrolling gives the first, a one-time code gives another).
CREATE TABLE tokens (
  hash       TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX tokens_student ON tokens(student_id);

-- Short one-time codes for signing in on a second device (15 minutes).
CREATE TABLE signin_codes (
  hash       TEXT PRIMARY KEY,           -- SHA-256 of the 8-character code
  student_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX signin_codes_student ON signin_codes(student_id);

-- The app's saved progress (one copy per student, synced between devices).
CREATE TABLE progress (
  student_id TEXT PRIMARY KEY,
  data       TEXT NOT NULL,              -- as sent: JSON text or gzip+base64
  encoding   TEXT NOT NULL,              -- 'json' | 'gzip-base64'
  size       INTEGER NOT NULL,
  version    INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The tries rule: three failed tries in a row, then a 24-hour lock; a pass resets.
-- subject is 'student:<id>' or 'email:<sha256 of the email>'.
-- exam_key is 'pro-written', 'pro-practical', 'adv-written' or 'adv-practical'.
CREATE TABLE tries (
  subject    TEXT NOT NULL,
  exam_key   TEXT NOT NULL,
  fails      INTEGER NOT NULL DEFAULT 0,
  lock_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (subject, exam_key)
);

-- Written-exam attempts. questions holds the drawn bank indexes and the option
-- order shown to the student; the answer key itself is in the code, not here.
CREATE TABLE written_attempts (
  id           TEXT PRIMARY KEY,         -- wa_xxxxxxxxxxxxxxxx
  student_id   TEXT NOT NULL,
  exam         TEXT NOT NULL,            -- 'pro' | 'adv'
  questions    TEXT NOT NULL,            -- JSON [{ b: bankIndex, o: [order] }]
  status       TEXT NOT NULL,            -- 'open' | 'submitted' | 'expired'
  started_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  score        INTEGER,
  total        INTEGER,
  submitted_at INTEGER
);
CREATE INDEX written_attempts_student ON written_attempts(student_id, exam, status);

-- Practical exams: the generated client's expected answers stay here.
CREATE TABLE practicals (
  id         TEXT PRIMARY KEY,           -- pr_xxxxxxxxxxxxxxxx
  student_id TEXT NOT NULL,
  exam       TEXT NOT NULL,              -- 'pro' | 'adv'
  seed       INTEGER NOT NULL,
  answer_key TEXT NOT NULL,              -- JSON, never sent to the client
  client     TEXT NOT NULL,              -- JSON of the client as issued (re-sent on resume)
  status     TEXT NOT NULL,              -- 'active' | 'replaced'
  created_at INTEGER NOT NULL
);
CREATE INDEX practicals_student ON practicals(student_id, exam, status);

-- Every graded written submission and practical grading.
CREATE TABLE results (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  exam       TEXT NOT NULL,              -- 'pro' | 'adv'
  kind       TEXT NOT NULL,              -- 'written' | 'practical'
  ref_id     TEXT NOT NULL,              -- attempt or practical id
  score      INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  pct        REAL NOT NULL,              -- 0–1
  passed     INTEGER NOT NULL,           -- 0 | 1
  at         INTEGER NOT NULL
);
CREATE INDEX results_student ON results(student_id, exam, kind);

-- Issued credentials, in the same shape as /credentials.json entries.
CREATE TABLE credentials (
  id          TEXT PRIMARY KEY,          -- CL-YYYY-XXXX-XXXX or CA-YYYY-XXXX-XXXX
  student_id  TEXT,                      -- NULL once the student deleted their account but kept it public
  program     TEXT NOT NULL,             -- 'professional' | 'advanced'
  name        TEXT NOT NULL,
  awarded     TEXT NOT NULL,             -- YYYY-MM-DD
  written     INTEGER NOT NULL,
  practical   INTEGER NOT NULL,
  distinction INTEGER NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  credential  TEXT NOT NULL,             -- the signed Open Badges 3.0-style JSON
  created_at  INTEGER NOT NULL
);
CREATE INDEX credentials_student ON credentials(student_id, program);
-- One live (not revoked) certificate per student and program.
CREATE UNIQUE INDEX credentials_one_live ON credentials(student_id, program) WHERE revoked = 0 AND student_id IS NOT NULL;

-- Fixed-window rate limits. bucket is '<what>:<sha256 of the IP, shortened>'.
CREATE TABLE rate_limits (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
