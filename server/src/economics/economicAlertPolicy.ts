import {
  createHash,
} from "node:crypto";

export const ECONOMIC_ALERT_POLICY_VERSION =
  "OX-ECONOMIC-ALERT-1";

export type EconomicAlertSeverity =
  | "WARNING"
  | "CRITICAL";

export type EconomicAlertTrigger =
  | "INCIDENT_OPENED"
  | "INCIDENT_OBSERVED"
  | "INCIDENT_RESOLVED";

export function severityForIncident(
  input: {
    eventType:
      "OPENED" |
      "OBSERVED" |
      "RESOLVED";

    severity:
      "WARNING" |
      "CRITICAL" |
      null;
  },
): EconomicAlertSeverity | null {
  if (
    input.eventType ===
    "RESOLVED"
  ) {
    return null;
  }

  return input.severity;
}

export function triggerForIncidentEvent(
  eventType:
    "OPENED" |
    "OBSERVED" |
    "RESOLVED",
): EconomicAlertTrigger {
  if (
    eventType ===
    "OPENED"
  ) {
    return "INCIDENT_OPENED";
  }

  if (
    eventType ===
    "OBSERVED"
  ) {
    return "INCIDENT_OBSERVED";
  }

  return "INCIDENT_RESOLVED";
}

/*
 * Alert identity is intentionally incident-scoped,
 * not event-scoped.
 *
 * Reconciliation can create many OBSERVED events for
 * the same unresolved incident. Those observations
 * must not create alert storms.
 *
 * One incident can therefore produce at most:
 *
 * - one INCIDENT_OPENED alert
 * - one INCIDENT_OBSERVED alert
 * - one INCIDENT_RESOLVED alert
 */
export function buildEconomicAlertKey(
  input: {
    incidentId:
      string;

    trigger:
      EconomicAlertTrigger;
  },
) {
  const material =
    [
      ECONOMIC_ALERT_POLICY_VERSION,
      input.incidentId,
      input.trigger,
    ].join(
      ":",
    );

  return createHash(
    "sha256",
  )
    .update(
      material,
    )
    .digest(
      "hex",
    );
}

/*
 * ALERT != AUTHORITY
 * ALERT != GOVERNANCE
 * ALERT != AUTO-REPAIR
 * ALERT != TREASURY ACTION
 *
 * Alerts are informational operational artifacts only.
 */
