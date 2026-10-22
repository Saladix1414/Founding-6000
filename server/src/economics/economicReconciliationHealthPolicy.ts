export const ECONOMIC_RECONCILIATION_STALE_MS =
  15 * 60 * 1000;

export type EconomicReconciliationHealthState =
  | "OK"
  | "WARNING"
  | "CRITICAL"
  | "STALE"
  | "NOT_SEEN";

export function resolveEconomicReconciliationHealth(
  input: {
    status:
      "OK" |
      "WARNING" |
      "CRITICAL" |
      null;

    reconciledAt:
      string |
      null;

    nowMs?:
      number;
  },
): EconomicReconciliationHealthState {
  if (
    !input.status ||
    !input.reconciledAt
  ) {
    return "NOT_SEEN";
  }

  const reconciledAtMs =
    Date.parse(
      input.reconciledAt,
    );

  if (
    !Number.isFinite(
      reconciledAtMs,
    )
  ) {
    return "STALE";
  }

  const now =
    input.nowMs ??
    Date.now();

  if (
    now -
      reconciledAtMs >
    ECONOMIC_RECONCILIATION_STALE_MS
  ) {
    return "STALE";
  }

  return input.status;
}
