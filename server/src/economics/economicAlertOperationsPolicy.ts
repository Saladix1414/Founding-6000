export const ECONOMIC_ALERT_OPERATIONS_VERSION =
  "OX-ECONOMIC-ALERT-OPS-1";

export type EconomicAlertDeliveryHealth =
  | "DISABLED"
  | "IDLE"
  | "ACTIVE"
  | "DEGRADED"
  | "FAILED";

export function resolveEconomicAlertDeliveryHealth(
  input: {
    enabled:
      boolean;

    pending:
      number;

    retrying:
      number;

    failed:
      number;

    leased:
      number;
  },
): EconomicAlertDeliveryHealth {
  if (
    !input.enabled
  ) {
    return "DISABLED";
  }

  if (
    input.failed >
    0
  ) {
    return "FAILED";
  }

  if (
    input.retrying >
      0 ||
    input.leased >
      0
  ) {
    return "DEGRADED";
  }

  if (
    input.pending >
      0
  ) {
    return "ACTIVE";
  }

  return "IDLE";
}

/*
 * ALERT OBSERVABILITY != AUTHORITY
 * ALERT OBSERVABILITY != GOVERNANCE
 * ALERT OBSERVABILITY != AUTO-REPAIR
 * ALERT OBSERVABILITY != TREASURY ACTION
 * ALERT OBSERVABILITY != RESERVE MUTATION
 * ALERT OBSERVABILITY != BLOCKCHAIN TRANSACTION
 */
