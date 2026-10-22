export const ECONOMIC_ALERT_DELIVERY_POLICY_VERSION =
  "OX-ECONOMIC-ALERT-DELIVERY-1";

export const ECONOMIC_ALERT_MAX_ATTEMPTS =
  5;

export const ECONOMIC_ALERT_LEASE_MS =
  60_000;

export const ECONOMIC_ALERT_RETRY_BASE_MS =
  60_000;

export const ECONOMIC_ALERT_RETRY_MAX_MS =
  60 * 60 * 1000;

/*
 * ALERT DELIVERY != AUTHORITY
 * ALERT DELIVERY != GOVERNANCE
 * ALERT DELIVERY != AUTO-REPAIR
 * ALERT DELIVERY != TREASURY ACTION
 * ALERT DELIVERY != RESERVE MUTATION
 * ALERT DELIVERY != BLOCKCHAIN TRANSACTION
 */

export function nextEconomicAlertRetryDelayMs(
  attemptNumber:
    number,
) {
  if (
    !Number.isInteger(
      attemptNumber,
    ) ||
    attemptNumber < 1
  ) {
    throw new Error(
      "INVALID_ECONOMIC_ALERT_ATTEMPT",
    );
  }

  const exponential =
    ECONOMIC_ALERT_RETRY_BASE_MS *
    (2 ** (
      attemptNumber -
      1
    ));

  return Math.min(
    exponential,
    ECONOMIC_ALERT_RETRY_MAX_MS,
  );
}

export function shouldTerminallyFailEconomicAlert(
  attemptNumber:
    number,
) {
  return attemptNumber >=
    ECONOMIC_ALERT_MAX_ATTEMPTS;
}
