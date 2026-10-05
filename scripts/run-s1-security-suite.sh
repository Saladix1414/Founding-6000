#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

TMP_BASE="${TMPDIR:-$HOME}"

TEST_ADMIN_TOKEN="s1-security-suite-admin-token-000000000000000000000000000000000000"

COMMON_ENV=(
  NODE_ENV=test
  FRONTEND_ORIGIN=http://localhost:5173
  TRUST_PROXY=false
  ADMIN_API_TOKEN="$TEST_ADMIN_TOKEN"
  REAL_PAYMENTS_ENABLED=false
  PAYMENT_READINESS=false
  USDT_NETWORK=ethereum-mainnet
  USDT_CHAIN_ID=1
  USDT_TOKEN_CONTRACT=0xdAC17F958D2ee523a2206206994597C13D831ec7
  USDT_DECIMALS=6
  USDT_RECEIVER_ADDRESS=0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840
  USDT_CONFIRMATIONS_REQUIRED=12
)

run_test() {
  local name="$1"
  local file="$2"
  local db="$3"

  echo ""
  echo "------------------------------------------------------------"
  echo "RUNNING: $name"
  echo "------------------------------------------------------------"

  rm -f \
    "$db" \
    "$db-wal" \
    "$db-shm"

  env \
    DATABASE_PATH="$db" \
    "${COMMON_ENV[@]}" \
    npx tsx "$file"

  echo ""
  echo "$name=PASS"
}

echo ""
echo "============================================================"
echo " DIGITALBOOST ORIGIN — FOUNDING 6000"
echo " S1 SECURITY HARDENING FINAL GATE"
echo "============================================================"

echo ""
echo "[1/9] Server build"
npm run server:build
echo "SERVER_BUILD=PASS"

echo ""
echo "[2/9] Frontend build"
npm run build
echo "FRONTEND_BUILD=PASS"

run_test \
  "S1_A_HTTP_SECURITY" \
  "server/src/tests/s1aHttpSecurityTest.ts" \
  "$TMP_BASE/founding-6000-s1e-a.sqlite"

run_test \
  "S1_B_PAYMENT_SECURITY" \
  "server/src/tests/s1bPaymentSecurityTest.ts" \
  "$TMP_BASE/founding-6000-s1e-b.sqlite"

run_test \
  "S1_C_ADMIN_AUTHORITY" \
  "server/src/tests/s1cAdminAuthorityTest.ts" \
  "$TMP_BASE/founding-6000-s1e-c.sqlite"

run_test \
  "S1_D_EMAIL_WORKER" \
  "server/src/tests/s1dEmailWorkerHardeningTest.ts" \
  "$TMP_BASE/founding-6000-s1e-email.sqlite"

run_test \
  "S1_D_USDT_WORKER" \
  "server/src/tests/s1dUsdtWorkerHardeningTest.ts" \
  "$TMP_BASE/founding-6000-s1e-usdt.sqlite"

run_test \
  "P3_VERIFICATION_REGRESSION" \
  "server/src/tests/p3VerificationPipelineTest.ts" \
  "$TMP_BASE/founding-6000-s1e-p3.sqlite"

run_test \
  "B5_EMAIL_REGRESSION" \
  "server/src/tests/b5EmailOutboxTest.ts" \
  "$TMP_BASE/founding-6000-s1e-b5.sqlite"

echo ""
echo "============================================================"
echo " S1 SECURITY HARDENING = PASS"
echo "============================================================"
echo ""
echo "S1_A_HTTP_HEADERS_CORS_ERRORS=PASS"
echo "S1_B_PAYMENT_ENDPOINTS=PASS"
echo "S1_B_IDEMPOTENCY_BINDING=PASS"
echo "S1_B_TX_REPLAY_PROTECTION=PASS"
echo "S1_C_ADMIN_AUTHORITY=PASS"
echo "S1_C_BUYER_SELF_ACTIVATION=BLOCKED"
echo "S1_D_EMAIL_ATOMIC_CLAIM=PASS"
echo "S1_D_EMAIL_RETRY_RECOVERY=PASS"
echo "S1_D_USDT_ATOMIC_CLAIM=PASS"
echo "S1_D_USDT_LEASE_RECOVERY=PASS"
echo "S1_D_SETTLEMENT_EXACTLY_ONCE=PASS"
echo "P3_REGRESSION=PASS"
echo "B5_REGRESSION=PASS"
echo "REAL_PAYMENTS_ENABLED=false"
echo "PAYMENT_READINESS=false"
echo ""
echo "NEXT_PHASE=L1_LEGAL_PAYMENT_READINESS"
