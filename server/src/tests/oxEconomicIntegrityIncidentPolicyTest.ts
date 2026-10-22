import {
  buildEconomicIncidentFingerprint,
  decideEconomicIncidentAction,
  incidentSeverityForState,
} from "../economics/economicIntegrityIncidentPolicy.js";

if (
  incidentSeverityForState(
    "WARNING",
  ) !==
  "WARNING"
) {
  throw new Error(
    "WARNING_SEVERITY_INVALID",
  );
}

if (
  incidentSeverityForState(
    "CRITICAL",
  ) !==
  "CRITICAL"
) {
  throw new Error(
    "CRITICAL_SEVERITY_INVALID",
  );
}

if (
  incidentSeverityForState(
    "STALE",
  ) !==
  "CRITICAL"
) {
  throw new Error(
    "STALE_SEVERITY_INVALID",
  );
}

if (
  incidentSeverityForState(
    "OK",
  ) !==
  null
) {
  throw new Error(
    "OK_SEVERITY_INVALID",
  );
}

const first =
  buildEconomicIncidentFingerprint({
    state:
      "CRITICAL",

    failingCodes: [
      "B",
      "A",
    ],
  });

const reordered =
  buildEconomicIncidentFingerprint({
    state:
      "CRITICAL",

    failingCodes: [
      "A",
      "B",
    ],
  });

if (
  first !==
  reordered
) {
  throw new Error(
    "INCIDENT_FINGERPRINT_NOT_DETERMINISTIC",
  );
}

if (
  decideEconomicIncidentAction({
    state:
      "CRITICAL",

    hasOpenIncident:
      false,

    sameFingerprint:
      false,
  }) !==
  "OPEN"
) {
  throw new Error(
    "CRITICAL_OPEN_POLICY_INVALID",
  );
}

if (
  decideEconomicIncidentAction({
    state:
      "WARNING",

    hasOpenIncident:
      true,

    sameFingerprint:
      true,
  }) !==
  "OBSERVE"
) {
  throw new Error(
    "INCIDENT_OBSERVE_POLICY_INVALID",
  );
}

if (
  decideEconomicIncidentAction({
    state:
      "OK",

    hasOpenIncident:
      true,

    sameFingerprint:
      false,
  }) !==
  "RESOLVE"
) {
  throw new Error(
    "INCIDENT_RESOLUTION_POLICY_INVALID",
  );
}

console.log(
  "OX_ECONOMIC_INTEGRITY_INCIDENT_POLICY=PASS",
);

console.log(
  "WARNING_SEVERITY=WARNING",
);

console.log(
  "CRITICAL_SEVERITY=CRITICAL",
);

console.log(
  "STALE_SEVERITY=CRITICAL",
);

console.log(
  "FINGERPRINT_DETERMINISTIC=PASS",
);

console.log(
  "AUTO_REPAIR=NO",
);
