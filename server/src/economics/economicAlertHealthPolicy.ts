import type {
  EconomicAlertDeliveryHealth,
} from "./economicAlertOperationsPolicy.js";

export const ECONOMIC_ALERT_HEALTH_POLICY_VERSION =
  "OX-ECONOMIC-ALERT-HEALTH-1";

export function isEconomicAlertOperationallyHealthy(
  state:
    EconomicAlertDeliveryHealth,
) {
  return (
    state ===
      "DISABLED" ||
    state ===
      "IDLE" ||
    state ===
      "ACTIVE"
  );
}

export function shouldEconomicAlertHealthBlockCoreReadiness(
  _state:
    EconomicAlertDeliveryHealth,
) {
  /*
   * Alert delivery is operational observability.
   *
   * It must never become payment, membership,
   * reserve, governance or blockchain authority.
   *
   * A degraded alert channel must be visible,
   * but does not make the authoritative API
   * unavailable.
   */
  return false;
}

/*
 * ALERT HEALTH != AUTHORITY
 * ALERT HEALTH != PAYMENT AUTHORITY
 * ALERT HEALTH != MEMBERSHIP AUTHORITY
 * ALERT HEALTH != GOVERNANCE
 * ALERT HEALTH != AUTO-REPAIR
 * ALERT HEALTH != TREASURY ACTION
 * ALERT HEALTH != RESERVE MUTATION
 * ALERT HEALTH != BLOCKCHAIN TRANSACTION
 */
