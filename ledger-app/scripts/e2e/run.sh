#!/usr/bin/env bash
# End-to-end tests of the Academy online features against a LOCAL Academy server.
# Needs: academy-server/node_modules (npm ci there), xvfb-run, Playwright (Chromium), python3.
# Usage (from ledger-app): bash scripts/e2e/run.sh [out-dir]
set -u
cd "$(dirname "$0")/../.."
OUT="${1:-$(mktemp -d)}"; mkdir -p "$OUT"
PORT=8787 node --no-warnings scripts/e2e/academy-local.mjs > "$OUT/local-server.log" 2>&1 & SRV=$!
(cd .. && python3 -m http.server 8765 --bind 127.0.0.1 > "$OUT/site.log" 2>&1) & WEB=$!
trap 'kill $SRV $WEB 2>/dev/null' EXIT
sleep 2
node scripts/bundle-academy.js
OUT="$OUT/desktop" LOCAL=http://127.0.0.1:8787 xvfb-run -a ./node_modules/.bin/electron --no-sandbox scripts/e2e/desktop.js 2>&1 | grep -E '^(PASS|FAIL|ALL|[0-9]+ FAILED)'; D=${PIPESTATUS[0]}
SITE=http://127.0.0.1:8765 LOCAL=http://127.0.0.1:8787 OUT="$OUT/phone" DESK="$OUT/desktop" node scripts/e2e/phone.js; P=$?
echo "Results and screenshots: $OUT"
[ "$D" = 0 ] && [ "$P" = 0 ]
