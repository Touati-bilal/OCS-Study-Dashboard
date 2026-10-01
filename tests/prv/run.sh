#!/usr/bin/env bash
#
# PRV test suites.
#
#   week + metrics           pure unit tests over the reporting engine - no server needed.
#   snapshot + recovery      unit tests for the two server-side trust boundaries: the OCS-only
#                            snapshot allowlist, and recovery failing closed with no phrase set.
#   security                 black-box tests against a real production build, including the
#                            authorisation, brute-force, IDOR, disclosure and cross-origin checks.
#   files                    black-box tests for the study-file APIs: no session, no access; the
#                            owner can still use them; and no path, extension or size escapes.
#
# The security suite needs a *fresh* data directory, because it asserts on the first generation of
# a report and on lockout counters, so the runner always starts from an empty one.
set -euo pipefail

cd "$(dirname "$0")/../.."

PORT="${PRV_TEST_PORT:-3199}"
BASE="http://localhost:$PORT"
LOG="$(mktemp)"

CRON_SECRET=prv-test-cron-secret-0123456789

# Real owner account + real 4-digit code, as peppered hashes only. The plaintext exists solely in
# the throwaway test client, so the suites exercise the same verification path the owner uses.
PRV_TEST_ENV="$(npx tsx tests/prv/fixtures.mts)"
# shellcheck disable=SC1090
eval "$PRV_TEST_ENV"
: "${PRV_TEST_CODE:?fixtures.mts did not produce a code}"

# `next start` forks, so the pid of the background job is not necessarily the one holding the port.
# Resolving the owner through `ss` avoids matching this script's own command line with `pkill -f`.
port_owner() {
  ss -ltnp 2>/dev/null \
    | grep -E "[:.]$PORT[[:space:]]" \
    | grep -o 'pid=[0-9]*' \
    | head -1 \
    | cut -d= -f2
}

reclaim_port() {
  local owner
  owner="$(port_owner || true)"
  if [ -n "$owner" ]; then
    kill "$owner" 2>/dev/null || true
  fi
  for _ in $(seq 1 10); do
    if ! curl -fsS -m 1 -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

cleanup() {
  stop_server
  reclaim_port || true
}
trap cleanup EXIT

# Each black-box suite gets its own server, and therefore its own rate-limit buckets and its own
# persistent lockout counters. Sharing one server across all four meant the security suite's
# deliberate brute-force attempts counted against the browser suite's later logins: by the time the
# browser suite signed in it had already spent the 10-attempt login budget and every correct login
# came back 429, so the suite failed on its own exhaustible limiter rather than on a real defect.
#
# start_server <data-dir> <uploads-dir>
start_server() {
  local data_dir="$1" uploads_dir="$2"
  PRV_CRON_SECRET="$CRON_SECRET" \
  PRV_DATA_DIR="$data_dir" \
  STUDY_UPLOADS_DIR="$uploads_dir" \
  AI_API_KEY=prv-test-ai-key-must-never-reach-a-browser \
  PRV_SECRET_PEPPER="$PRV_SECRET_PEPPER" \
  PRV_SESSION_SECRET="$PRV_SESSION_SECRET" \
  PRV_OWNER_USERNAME="$PRV_OWNER_USERNAME" \
  PRV_OWNER_EMAIL="$PRV_OWNER_EMAIL" \
  PRV_OWNER_PASSWORD_HASH="$PRV_OWNER_PASSWORD_HASH" \
  PRV_ACCESS_CODE_HASH="$PRV_ACCESS_CODE_HASH" \
    npx next start -p "$PORT" > "$LOG" 2>&1 &
  SERVER_PID=$!

  for _ in $(seq 1 60); do
    if curl -fsS -m 2 -o /dev/null "$BASE/" 2>/dev/null; then break; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "!! server exited early:" >&2
      cat "$LOG" >&2
      exit 1
    fi
    sleep 1
  done

  if ! curl -fsS -m 2 -o /dev/null "$BASE/"; then
    echo "!! server never became ready" >&2
    cat "$LOG" >&2
    exit 1
  fi
}

stop_server() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  SERVER_PID=""
  reclaim_port || true
}

# run_suite <label> <suite-file> [extra env assignments...]
run_suite() {
  local label="$1" file="$2"
  shift 2
  local data_dir uploads_dir
  data_dir="$(mktemp -d)"
  # The file suite used to read and write the project's own `uploads/` tree, so a test run could
  # delete the owner's real documents. It gets a throwaway storage root instead.
  uploads_dir="$(mktemp -d)"

  echo
  echo "== $label =="
  start_server "$data_dir" "$uploads_dir"

  set +e
  env BASE="$BASE" PRV_TEST_CRON_SECRET="$CRON_SECRET" \
      STUDY_UPLOADS_DIR="$uploads_dir" \
      PRV_TEST_USERNAME="$PRV_TEST_USERNAME" \
      PRV_TEST_EMAIL="$PRV_TEST_EMAIL" \
      PRV_TEST_PASSWORD="$PRV_TEST_PASSWORD" \
      PRV_TEST_CODE="$PRV_TEST_CODE" \
      "$@" \
      npx tsx "$file"
  local status=$?
  set -e

  stop_server
  rm -rf "$data_dir" "$uploads_dir"
  SUITE_STATUS=$status
}

# A leftover server would silently serve stale lockout counters and stale report generations, which
# would make these suites report a false pass or a false failure. Reclaim the port, then insist it
# really is free.
if ! reclaim_port; then
  echo "!! something else is using port $PORT - stop it, or set PRV_TEST_PORT." >&2
  exit 1
fi

echo "== unit: week arithmetic =="
npx tsx tests/prv/week.test.ts

echo
echo "== unit: free periods, period keys, legacy refs =="
npx tsx tests/prv/period.test.ts

echo
echo "== unit: metrics, trajectory, recommendations =="
npx tsx tests/prv/metrics.test.ts

echo
echo "== unit: observation sanitising =="
npx tsx tests/prv/observations.test.ts

# The report modules import `server-only`, which throws unless Node resolves the `react-server`
# export condition - the same condition the Next server runs under.
echo
echo "== unit: the report PDF renders real bytes =="
npx tsx --conditions=react-server tests/prv/rapport-pdf.test.ts

# `config.server.ts` imports `server-only`, which throws unless Node resolves the `react-server`
# export condition - the same condition the Next server itself runs under.
echo
echo "== unit: snapshot OCS allowlist, recovery fails closed =="
npx tsx --conditions=react-server tests/prv/snapshot.test.ts

# `next start` needs a real production build. Checking the directory is not enough: a running
# `next dev` recreates `.next` without a BUILD_ID, and `next start` then dies with
# "Could not find a production build". BUILD_ID is only written by `next build`.
if [ ! -f .next/BUILD_ID ]; then
  echo
  echo "!! no production build found - run 'npm run build' first." >&2
  echo "   (a running 'next dev' does not count: it has no .next/BUILD_ID)" >&2
  exit 1
fi

run_suite "security: authorisation, brute force, IDOR, disclosure" tests/prv/security.test.mts
SECURITY_STATUS=$SUITE_STATUS

if grep -q "PDF generation failed" "$LOG"; then
  echo "!! the server logged a PDF failure:" >&2
  grep -A 5 "PDF generation failed" "$LOG" >&2
  exit 1
fi

run_suite "files: no session, no access; no traversal; inert downloads" tests/prv/files.test.mts
FILES_STATUS=$SUITE_STATUS

if [ "$FILES_STATUS" -ne 0 ]; then
  echo
  echo "!! the file suite failed; the server log tail is:" >&2
  tail -20 "$LOG" >&2
fi

run_suite "browser: all eight sections render, OCC isolation, lock" tests/prv/browser.test.mts
BROWSER_STATUS=$SUITE_STATUS

run_suite "cross-exam: OCC, ORS and EGTS are untouched and never see PRV" tests/prv/cross-exam.test.mts
CROSS_STATUS=$SUITE_STATUS

echo
if [ "$SECURITY_STATUS" -ne 0 ]; then
  echo "PRV suites: security suite failed" >&2
  exit "$SECURITY_STATUS"
fi
if [ "$FILES_STATUS" -ne 0 ]; then
  echo "PRV suites: files suite failed" >&2
  exit "$FILES_STATUS"
fi
if [ "$BROWSER_STATUS" -ne 0 ]; then
  echo "PRV suites: browser suite failed" >&2
  exit "$BROWSER_STATUS"
fi
if [ "$CROSS_STATUS" -ne 0 ]; then
  echo "PRV suites: cross-exam suite failed" >&2
  exit "$CROSS_STATUS"
fi
echo "PRV suites: all green"
