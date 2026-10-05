import {
  getPaymentReadinessChecks,
} from "../config/paymentReadiness.js";

const checks =
  getPaymentReadinessChecks();

console.log("");
console.log(
  "============================================",
);

console.log(
  " USDT PRODUCTION READINESS",
);

console.log(
  "============================================",
);

for (
  const check of checks
) {
  console.log(
    `${check.pass ? "PASS" : "FAIL"} — ${check.key} — ${check.detail}`,
  );
}

const failed =
  checks.filter(
    (check) =>
      !check.pass,
  );

console.log("");

if (
  failed.length > 0
) {
  console.log(
    "PAYMENT_READINESS_STATUS=FAIL",
  );

  console.log(
    "FAILED_CHECKS=" +
    failed
      .map(
        (check) =>
          check.key,
      )
      .join(","),
  );

  process.exit(1);
}

console.log(
  "PAYMENT_READINESS_STATUS=PASS",
);
