#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:4000}"
TEST_USER_ID="${TEST_USER_ID:-smoke-user}"

req() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "x-user-id: $TEST_USER_ID" \
      -H 'content-type: application/json' \
      -d "$body"
  else
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "x-user-id: $TEST_USER_ID"
  fi
}

echo "[smoke] health"
curl -sS "$BASE_URL/health" >/dev/null

echo "[smoke] metrics"
curl -sS "$BASE_URL/metrics" >/dev/null

echo "[smoke] create household"
H=$(req POST /households '{"name":"Smoke Home"}')
HID=$(printf '%s' "$H" | python -c 'import sys,json;print(json.load(sys.stdin)["id"])')

echo "[smoke] list households"
req GET /households >/dev/null

echo "[smoke] add/list item"
req POST "/households/$HID/items" '{"name":"Buke","quantity":1}' >/dev/null
req GET "/households/$HID/items" >/dev/null

echo "[smoke] budget"
req GET "/households/$HID/budget" >/dev/null
req PUT "/households/$HID/budget" '{"limit":420}' >/dev/null

echo "[smoke] pricing"
req GET "/households/$HID/pricing/estimate" >/dev/null

echo "Smoke tests passed against $BASE_URL"
