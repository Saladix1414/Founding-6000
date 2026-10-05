#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "============================================"
echo " FOUNDING 6000 — PRELAUNCH PREFLIGHT"
echo "============================================"

if [ "${NODE_ENV:-}" != "production" ]; then
  echo "NODE_ENV_PRODUCTION=FAIL"
  exit 1
fi

if [ "${PUBLIC_CHECKOUT_ENABLED:-false}" != "false" ]; then
  echo "PUBLIC_CHECKOUT_MUST_BE_FALSE=FAIL"
  exit 1
fi

if [ "${PAYMENT_READINESS:-false}" != "false" ]; then
  echo "PAYMENT_READINESS_MUST_BE_FALSE=FAIL"
  exit 1
fi

if [ "${REAL_PAYMENTS_ENABLED:-false}" != "false" ]; then
  echo "REAL_PAYMENTS_MUST_BE_FALSE=FAIL"
  exit 1
fi

echo "PRELAUNCH_PAYMENT_GATES=PASS"

if [ ! -f dist/index.html ]; then
  echo "FRONTEND_BUILD_MISSING=FAIL"
  exit 1
fi

if [ ! -f server/dist/index.js ]; then
  echo "SERVER_BUILD_MISSING=FAIL"
  exit 1
fi

if [ ! -f server/dist/workers/workerRunner.js ]; then
  echo "WORKER_BUILD_MISSING=FAIL"
  exit 1
fi

echo "COMPILED_ARTIFACTS=PASS"

if grep -R \
  --binary-files=without-match \
  -n \
  '127\.0\.0\.1:8787' \
  dist/assets \
  >/dev/null 2>&1
then
  echo "PRODUCTION_BUNDLE_LOCALHOST_API=FAIL"
  exit 1
fi

echo "PRODUCTION_BUNDLE_LOCALHOST_API=ABSENT"

npm run prod:runtime:check

echo ""
echo "============================================"
echo " PRELAUNCH PREFLIGHT = PASS"
echo "============================================"
echo "CHECKOUT=CLOSED"
echo "PAYMENTS=DISABLED"
echo "RUNTIME_CONTRACT=PASS"
echo "COMPILED_ARTIFACTS=PASS"
