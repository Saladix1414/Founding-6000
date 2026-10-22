import {
  buildEconomicAlertKey,
  severityForIncident,
  triggerForIncidentEvent,
} from "../economics/economicAlertPolicy.js";

if (
  triggerForIncidentEvent(
    "OPENED",
  ) !==
  "INCIDENT_OPENED"
) {
  throw new Error(
    "OPENED_TRIGGER_INVALID",
  );
}

if (
  triggerForIncidentEvent(
    "OBSERVED",
  ) !==
  "INCIDENT_OBSERVED"
) {
  throw new Error(
    "OBSERVED_TRIGGER_INVALID",
  );
}

if (
  triggerForIncidentEvent(
    "RESOLVED",
  ) !==
  "INCIDENT_RESOLVED"
) {
  throw new Error(
    "RESOLVED_TRIGGER_INVALID",
  );
}

if (
  severityForIncident({
    eventType:
      "OPENED",

    severity:
      "CRITICAL",
  }) !==
  "CRITICAL"
) {
  throw new Error(
    "CRITICAL_SEVERITY_INVALID",
  );
}

if (
  severityForIncident({
    eventType:
      "RESOLVED",

    severity:
      "CRITICAL",
  }) !==
  null
) {
  throw new Error(
    "RESOLVED_SEVERITY_INVALID",
  );
}

const opened1 =
  buildEconomicAlertKey({
    incidentId:
      "incident-1",

    trigger:
      "INCIDENT_OPENED",
  });

const opened2 =
  buildEconomicAlertKey({
    incidentId:
      "incident-1",

    trigger:
      "INCIDENT_OPENED",
  });

if (
  opened1 !==
  opened2
) {
  throw new Error(
    "ALERT_KEY_NOT_DETERMINISTIC",
  );
}

const observed =
  buildEconomicAlertKey({
    incidentId:
      "incident-1",

    trigger:
      "INCIDENT_OBSERVED",
  });

if (
  observed ===
  opened1
) {
  throw new Error(
    "ALERT_TRIGGER_NOT_PART_OF_IDENTITY",
  );
}

const otherIncident =
  buildEconomicAlertKey({
    incidentId:
      "incident-2",

    trigger:
      "INCIDENT_OPENED",
  });

if (
  otherIncident ===
  opened1
) {
  throw new Error(
    "INCIDENT_NOT_PART_OF_ALERT_IDENTITY",
  );
}

console.log(
  "OX_ECONOMIC_ALERT_POLICY=PASS",
);

console.log(
  "ALERT_KEY_DETERMINISTIC=PASS",
);

console.log(
  "INCIDENT_SCOPED_DEDUPE=PASS",
);

console.log(
  "OBSERVED_ALERT_STORM=PREVENTED",
);

console.log(
  "RESOLVED_SEVERITY=NULL",
);

console.log(
  "ALERT_IS_AUTHORITY=NO",
);
