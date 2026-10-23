#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  secret="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  password="$(node -e "console.log(require('crypto').randomBytes(4).toString('hex'))")"
  printf 'APP_PASSWORD=%s\nSESSION_SECRET=%s\n' "$password" "$secret" > .env
  echo "=================================================="
  echo " Document Tracker login password: $password"
  echo "=================================================="
fi

if ! pgrep -f "next dev" >/dev/null 2>&1; then
  nohup npm run dev -- --hostname 0.0.0.0 --port 3000 > /tmp/tracker.log 2>&1 &
  disown || true
  echo "Document Tracker started on port 3000."
fi
