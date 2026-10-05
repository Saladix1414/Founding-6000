#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

echo ""
echo "============================================================"
echo " L1-D DEVELOPMENT SAFETY CHECK"
echo "============================================================"
echo ""

node <<'NODE'
const fs = require("fs");

const raw =
  fs.existsSync(".env")
    ? fs.readFileSync(".env", "utf8")
    : "";

function value(name) {
  const match =
    raw.match(
      new RegExp(
        "^" + name + "=(.*)$",
        "m"
      )
    );

  return match
    ? match[1].trim()
    : "";
}

const real =
  value(
    "REAL_PAYMENTS_ENABLED"
  );

const readiness =
  value(
    "PAYMENT_READINESS"
  );

const origin =
  value(
    "FRONTEND_ORIGIN"
  );

console.log(
  `REAL_PAYMENTS_ENABLED=${real || "MISSING"}`
);

console.log(
  `PAYMENT_READINESS=${readiness || "MISSING"}`
);

console.log(
  `FRONTEND_ORIGIN=${origin || "MISSING"}`
);

if (
  real !== "false"
) {
  throw new Error(
    "REAL_PAYMENTS_MUST_REMAIN_DISABLED_DURING_L1D"
  );
}

if (
  readiness !== "false"
) {
  throw new Error(
    "PAYMENT_READINESS_MUST_REMAIN_DISABLED_DURING_L1D"
  );
}

console.log(
  "REAL_PAYMENT_SAFETY=PASS"
);

console.log(
  "PAYMENT_READINESS_SAFETY=PASS"
);
NODE

test -f \
  public/legal/terms.html

test -f \
  public/legal/privacy.html

test -f \
  public/legal/refunds.html

test -f \
  docs/L1D_PRODUCTION_ACTIVATION_CHECKLIST.md

echo "LEGAL_FILES_PRESENT=PASS"
echo "PRODUCTION_CHECKLIST_PRESENT=PASS"

echo ""
echo "Running builds..."

npm run server:build
npm run build

echo ""
echo "SERVER_BUILD=PASS"
echo "FRONTEND_BUILD=PASS"

echo ""
echo "============================================================"
echo " L1-D DEVELOPMENT SAFETY = PASS"
echo "============================================================"
echo ""
echo "REAL_PAYMENTS_ENABLED=false"
echo "PAYMENT_READINESS=false"
echo "PRODUCTION_ACTIVATION=BLOCKED_UNTIL_CHECKLIST_COMPLETE"
