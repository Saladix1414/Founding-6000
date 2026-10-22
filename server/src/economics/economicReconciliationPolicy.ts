export const ECONOMIC_RECONCILIATION_VERSION =
  "OX-ECONOMIC-RECONCILIATION-1";

export type ReconciliationSeverity =
  | "OK"
  | "WARNING"
  | "CRITICAL";

export type ReconciliationCheck = {
  code:
    string;

  severity:
    ReconciliationSeverity;

  passed:
    boolean;

  expected?:
    string | number | null;

  actual?:
    string | number | null;

  detail:
    string;
};

export function reconciliationSeverity(
  checks:
    readonly ReconciliationCheck[],
) {
  if (
    checks.some(
      (
        check,
      ) =>
        !check.passed &&
        check.severity ===
          "CRITICAL",
    )
  ) {
    return "CRITICAL" as const;
  }

  if (
    checks.some(
      (
        check,
      ) =>
        !check.passed &&
        check.severity ===
          "WARNING",
    )
  ) {
    return "WARNING" as const;
  }

  return "OK" as const;
}
