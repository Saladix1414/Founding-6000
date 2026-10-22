import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureEconomicIntegrityIncidentSchema,
} from "../db/economicIntegrityIncidentSchema.js";

import {
  ECONOMIC_INTEGRITY_INCIDENT_VERSION,
  buildEconomicIncidentFingerprint,
  decideEconomicIncidentAction,
  incidentSeverityForState,
  type EconomicIntegrityState,
} from "../economics/economicIntegrityIncidentPolicy.js";

ensureEconomicIntegrityIncidentSchema();

type IncidentEventRow = {
  id:
    string;

  incidentId:
    string;

  eventType:
    "OPENED" |
    "OBSERVED" |
    "RESOLVED";

  severity:
    "WARNING" |
    "CRITICAL" |
    null;

  integrityState:
    EconomicIntegrityState;

  fingerprint:
    string |
    null;

  reportHash:
    string |
    null;

  evidenceJson:
    string;

  createdAt:
    string;
};

function latestIncidentEvent() {
  return db.prepare(`
    SELECT
      id,

      incident_id
        AS incidentId,

      event_type
        AS eventType,

      severity,

      integrity_state
        AS integrityState,

      fingerprint,

      report_hash
        AS reportHash,

      evidence_json
        AS evidenceJson,

      created_at
        AS createdAt

    FROM economic_integrity_incident_events

    ORDER BY
      rowid DESC

    LIMIT 1
  `).get() as
    | IncidentEventRow
    | undefined;
}

function appendIncidentEvent(
  input: {
    incidentId:
      string;

    eventType:
      "OPENED" |
      "OBSERVED" |
      "RESOLVED";

    integrityState:
      EconomicIntegrityState;

    severity:
      "WARNING" |
      "CRITICAL" |
      null;

    fingerprint:
      string |
      null;

    reportHash:
      string |
      null;

    evidence:
      Record<
        string,
        unknown
      >;
  },
) {
  const id =
    randomUUID();

  const createdAt =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO economic_integrity_incident_events (
      id,
      incident_id,
      incident_version,
      event_type,
      severity,
      integrity_state,
      fingerprint,
      report_hash,
      evidence_json,
      created_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    input.incidentId,
    ECONOMIC_INTEGRITY_INCIDENT_VERSION,
    input.eventType,
    input.severity,
    input.integrityState,
    input.fingerprint,
    input.reportHash,
    JSON.stringify(
      input.evidence,
    ),
    createdAt,
  );

  return {
    id,

    incidentId:
      input.incidentId,

    eventType:
      input.eventType,

    integrityState:
      input.integrityState,

    severity:
      input.severity,

    fingerprint:
      input.fingerprint,

    reportHash:
      input.reportHash,

    createdAt,
  };
}

export function recordEconomicIntegrityObservation(
  input: {
    state:
      EconomicIntegrityState;

    reportHash?:
      string | null;

    failingCodes?:
      readonly string[];

    evidence?:
      Record<
        string,
        unknown
      >;
  },
) {
  ensureEconomicIntegrityIncidentSchema();

  const latest =
    latestIncidentEvent();

  const hasOpenIncident =
    Boolean(
      latest &&
      latest.eventType !==
        "RESOLVED",
    );

  const failingCodes =
    input.failingCodes ??
    [];

  const fingerprint =
    input.state === "OK"
      ? null
      : buildEconomicIncidentFingerprint({
          state:
            input.state,

          failingCodes,
        });

  const sameFingerprint =
    Boolean(
      latest &&
      latest.fingerprint &&
      fingerprint &&
      latest.fingerprint ===
        fingerprint,
    );

  const action =
    decideEconomicIncidentAction({
      state:
        input.state,

      hasOpenIncident,

      sameFingerprint,
    });

  if (
    action === "NONE"
  ) {
    return {
      action,

      event:
        null,
    };
  }

  /*
   * A different failure replaces the prior incident
   * through history, never mutation.
   */
  if (
    action === "OPEN" &&
    hasOpenIncident &&
    latest
  ) {
    appendIncidentEvent({
      incidentId:
        latest.incidentId,

      eventType:
        "RESOLVED",

      integrityState:
        "OK",

      severity:
        null,

      fingerprint:
        latest.fingerprint,

      reportHash:
        input.reportHash ??
        null,

      evidence: {
        reason:
          "SUPERSEDED_BY_NEW_INCIDENT",

        nextFingerprint:
          fingerprint,
      },
    });
  }

  if (
    action === "RESOLVE" &&
    latest
  ) {
    const event =
      appendIncidentEvent({
        incidentId:
          latest.incidentId,

        eventType:
          "RESOLVED",

        integrityState:
          "OK",

        severity:
          null,

        fingerprint:
          latest.fingerprint,

        reportHash:
          input.reportHash ??
          null,

        evidence: {
          reason:
            "ECONOMIC_INTEGRITY_RECOVERED",

          ...(input.evidence ??
            {}),
        },
      });

    return {
      action,

      event,
    };
  }

  if (
    action === "OBSERVE" &&
    latest
  ) {
    const event =
      appendIncidentEvent({
        incidentId:
          latest.incidentId,

        eventType:
          "OBSERVED",

        integrityState:
          input.state,

        severity:
          incidentSeverityForState(
            input.state,
          ),

        fingerprint,

        reportHash:
          input.reportHash ??
          null,

        evidence: {
          failingCodes,

          ...(input.evidence ??
            {}),
        },
      });

    return {
      action,

      event,
    };
  }

  const incidentId =
    `eii_${randomUUID()}`;

  const event =
    appendIncidentEvent({
      incidentId,

      eventType:
        "OPENED",

      integrityState:
        input.state,

      severity:
        incidentSeverityForState(
          input.state,
        ),

      fingerprint,

      reportHash:
        input.reportHash ??
        null,

      evidence: {
        failingCodes,

        ...(input.evidence ??
          {}),
      },
    });

  return {
    action:
      "OPEN" as const,

    event,
  };
}

export function getLatestEconomicIntegrityIncidentEvent() {
  ensureEconomicIntegrityIncidentSchema();

  const row =
    latestIncidentEvent();

  if (!row) {
    return null;
  }

  return {
    id:
      row.id,

    incidentId:
      row.incidentId,

    eventType:
      row.eventType,

    severity:
      row.severity,

    integrityState:
      row.integrityState,

    fingerprint:
      row.fingerprint,

    reportHash:
      row.reportHash,

    evidence:
      JSON.parse(
        row.evidenceJson,
      ) as Record<
        string,
        unknown
      >,

    createdAt:
      row.createdAt,
  };
}
