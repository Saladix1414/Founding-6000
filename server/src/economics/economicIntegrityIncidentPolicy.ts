import {
  createHash,
} from "node:crypto";

export const ECONOMIC_INTEGRITY_INCIDENT_VERSION =
  "OX-ECONOMIC-INTEGRITY-INCIDENT-1";

export type EconomicIntegrityState =
  | "OK"
  | "WARNING"
  | "CRITICAL"
  | "STALE";

export type EconomicIncidentSeverity =
  | "WARNING"
  | "CRITICAL";

export type EconomicIncidentAction =
  | "NONE"
  | "OPEN"
  | "OBSERVE"
  | "RESOLVE";

export function incidentSeverityForState(
  state:
    EconomicIntegrityState,
) {
  if (
    state === "CRITICAL" ||
    state === "STALE"
  ) {
    return "CRITICAL" as const;
  }

  if (
    state === "WARNING"
  ) {
    return "WARNING" as const;
  }

  return null;
}

export function buildEconomicIncidentFingerprint(
  input: {
    state:
      Exclude<
        EconomicIntegrityState,
        "OK"
      >;

    failingCodes:
      readonly string[];
  },
) {
  const normalizedCodes =
    [...input.failingCodes]
      .filter(
        Boolean,
      )
      .sort();

  const material =
    [
      ECONOMIC_INTEGRITY_INCIDENT_VERSION,
      input.state,
      ...normalizedCodes,
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
 * INCIDENT != GOVERNANCE
 * INCIDENT != AUTO-REPAIR
 *
 * This policy only describes operational state.
 */
export function decideEconomicIncidentAction(
  input: {
    state:
      EconomicIntegrityState;

    hasOpenIncident:
      boolean;

    sameFingerprint:
      boolean;
  },
): EconomicIncidentAction {
  if (
    input.state === "OK"
  ) {
    return input.hasOpenIncident
      ? "RESOLVE"
      : "NONE";
  }

  if (
    !input.hasOpenIncident
  ) {
    return "OPEN";
  }

  if (
    input.sameFingerprint
  ) {
    return "OBSERVE";
  }

  /*
   * Different failure identity:
   * caller should resolve prior incident and open
   * a new incident with a new fingerprint.
   */
  return "OPEN";
}
