import {
  reconciliationSeverity,
  type ReconciliationCheck,
} from "../economics/economicReconciliationPolicy.js";

const ok:
  ReconciliationCheck[] = [
    {
      code:
        "OK",

      severity:
        "CRITICAL",

      passed:
        true,

      detail:
        "ok",
    },
  ];

if (
  reconciliationSeverity(
    ok,
  ) !==
  "OK"
) {
  throw new Error(
    "OK_RECONCILIATION_STATUS_INVALID",
  );
}

const warning:
  ReconciliationCheck[] = [
    {
      code:
        "WARNING",

      severity:
        "WARNING",

      passed:
        false,

      detail:
        "warning",
    },
  ];

if (
  reconciliationSeverity(
    warning,
  ) !==
  "WARNING"
) {
  throw new Error(
    "WARNING_RECONCILIATION_STATUS_INVALID",
  );
}

const critical:
  ReconciliationCheck[] = [
    ...warning,

    {
      code:
        "CRITICAL",

      severity:
        "CRITICAL",

      passed:
        false,

      detail:
        "critical",
    },
  ];

if (
  reconciliationSeverity(
    critical,
  ) !==
  "CRITICAL"
) {
  throw new Error(
    "CRITICAL_RECONCILIATION_STATUS_INVALID",
  );
}

console.log(
  "OX_ECONOMIC_RECONCILIATION_POLICY=PASS",
);

console.log(
  "OK_STATUS=PASS",
);

console.log(
  "WARNING_STATUS=PASS",
);

console.log(
  "CRITICAL_STATUS=PASS",
);
