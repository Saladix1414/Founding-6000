import {
  mkdtempSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

const temporaryDirectory =
  mkdtempSync(
    join(
      tmpdir(),
      "ox-economic-incident-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "incidents.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  const {
    ensureEconomicIntegrityIncidentSchema,
  } =
    await import(
      "../db/economicIntegrityIncidentSchema.js"
    );

  const {
    recordEconomicIntegrityObservation,
    getLatestEconomicIntegrityIncidentEvent,
  } =
    await import(
      "../services/economicIntegrityIncidentService.js"
    );

  ensureEconomicIntegrityIncidentSchema();

  function expect(
    condition:
      boolean,

    message:
      string,
  ) {
    if (!condition) {
      throw new Error(
        message,
      );
    }
  }

  function countEvents() {
    const row =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM economic_integrity_incident_events
      `).get() as {
        count:
          number;
      };

    return Number(
      row.count,
    );
  }

  /*
   * -------------------------------------------------------
   * STEP 1 — HEALTHY SYSTEM
   *
   * No incident should be created.
   * -------------------------------------------------------
   */

  const healthy =
    recordEconomicIntegrityObservation({
      state:
        "OK",

      reportHash:
        "report-ok-1",
    });

  expect(
    healthy.action ===
      "NONE",
    "HEALTHY_SYSTEM_CREATED_INCIDENT",
  );

  expect(
    countEvents() ===
      0,
    "HEALTHY_SYSTEM_PERSISTED_EVENT",
  );

  /*
   * -------------------------------------------------------
   * STEP 2 — WARNING
   *
   * First degraded state opens incident #1.
   * -------------------------------------------------------
   */

  const warning =
    recordEconomicIntegrityObservation({
      state:
        "WARNING",

      reportHash:
        "report-warning-1",

      failingCodes: [
        "SNAPSHOT_NOT_AVAILABLE",
      ],

      evidence: {
        source:
          "SQLITE_TEST",
      },
    });

  expect(
    warning.action ===
      "OPEN",
    "WARNING_DID_NOT_OPEN_INCIDENT",
  );

  expect(
    warning.event?.eventType ===
      "OPENED",
    "WARNING_OPEN_EVENT_INVALID",
  );

  expect(
    warning.event?.severity ===
      "WARNING",
    "WARNING_SEVERITY_INVALID",
  );

  const warningIncidentId =
    warning.event?.incidentId;

  expect(
    typeof warningIncidentId ===
      "string",
    "WARNING_INCIDENT_ID_MISSING",
  );

  if (
    typeof warningIncidentId !==
      "string"
  ) {
    throw new Error(
      "WARNING_INCIDENT_ID_MISSING",
    );
  }

  expect(
    countEvents() ===
      1,
    "WARNING_EVENT_COUNT_INVALID",
  );

  /*
   * -------------------------------------------------------
   * STEP 3 — SAME WARNING
   *
   * Same fingerprint must NOT open a second incident.
   * It appends OBSERVED to the existing incident.
   * -------------------------------------------------------
   */

  const repeatedWarning =
    recordEconomicIntegrityObservation({
      state:
        "WARNING",

      reportHash:
        "report-warning-2",

      failingCodes: [
        "SNAPSHOT_NOT_AVAILABLE",
      ],
    });

  expect(
    repeatedWarning.action ===
      "OBSERVE",
    "SAME_WARNING_NOT_DEDUPLICATED",
  );

  expect(
    repeatedWarning.event?.eventType ===
      "OBSERVED",
    "SAME_WARNING_EVENT_NOT_OBSERVED",
  );

  expect(
    repeatedWarning.event?.incidentId ===
      warningIncidentId,
    "SAME_WARNING_OPENED_NEW_INCIDENT",
  );

  expect(
    countEvents() ===
      2,
    "SAME_WARNING_EVENT_COUNT_INVALID",
  );

  /*
   * -------------------------------------------------------
   * STEP 4 — DIFFERENT CRITICAL CONDITION
   *
   * New fingerprint:
   * 1. resolves incident #1 as superseded
   * 2. opens incident #2
   * -------------------------------------------------------
   */

  const critical =
    recordEconomicIntegrityObservation({
      state:
        "CRITICAL",

      reportHash:
        "report-critical-1",

      failingCodes: [
        "RESERVE_WATERFALL_RECONCILES",
      ],
    });

  expect(
    critical.action ===
      "OPEN",
    "CRITICAL_DID_NOT_OPEN_NEW_INCIDENT",
  );

  expect(
    critical.event?.eventType ===
      "OPENED",
    "CRITICAL_OPEN_EVENT_INVALID",
  );

  expect(
    critical.event?.severity ===
      "CRITICAL",
    "CRITICAL_SEVERITY_INVALID",
  );

  const criticalIncidentId =
    critical.event?.incidentId;

  expect(
    typeof criticalIncidentId ===
      "string",
    "CRITICAL_INCIDENT_ID_MISSING",
  );

  expect(
    criticalIncidentId !==
      warningIncidentId,
    "CRITICAL_REUSED_WARNING_INCIDENT_ID",
  );

  expect(
    countEvents() ===
      4,
    "CRITICAL_TRANSITION_EVENT_COUNT_INVALID",
  );

  const warningResolved =
    db.prepare(`
      SELECT
        event_type AS eventType,

        evidence_json AS evidenceJson

      FROM economic_integrity_incident_events

      WHERE
        incident_id = ?
        AND event_type = 'RESOLVED'

      ORDER BY rowid DESC

      LIMIT 1
    `).get(
      warningIncidentId,
    ) as
      | {
          eventType:
            string;

          evidenceJson:
            string;
        }
      | undefined;

  expect(
    warningResolved?.eventType ===
      "RESOLVED",
    "PRIOR_INCIDENT_NOT_RESOLVED",
  );

  const supersededEvidence =
    JSON.parse(
      warningResolved?.evidenceJson ??
      "{}",
    ) as {
      reason?:
        string;
    };

  expect(
    supersededEvidence.reason ===
      "SUPERSEDED_BY_NEW_INCIDENT",
    "PRIOR_INCIDENT_RESOLUTION_REASON_INVALID",
  );

  /*
   * -------------------------------------------------------
   * STEP 5 — RECOVERY TO OK
   *
   * Current critical incident must resolve.
   * -------------------------------------------------------
   */

  const recovered =
    recordEconomicIntegrityObservation({
      state:
        "OK",

      reportHash:
        "report-ok-2",

      evidence: {
        source:
          "SQLITE_TEST_RECOVERY",
      },
    });

  expect(
    recovered.action ===
      "RESOLVE",
    "RECOVERY_DID_NOT_RESOLVE_INCIDENT",
  );

  expect(
    recovered.event?.eventType ===
      "RESOLVED",
    "RECOVERY_EVENT_INVALID",
  );

  expect(
    recovered.event?.incidentId ===
      criticalIncidentId,
    "RECOVERY_RESOLVED_WRONG_INCIDENT",
  );

  expect(
    countEvents() ===
      5,
    "RECOVERY_EVENT_COUNT_INVALID",
  );

  const latest =
    getLatestEconomicIntegrityIncidentEvent();

  expect(
    latest?.eventType ===
      "RESOLVED",
    "LATEST_INCIDENT_STATE_NOT_RESOLVED",
  );

  expect(
    latest?.integrityState ===
      "OK",
    "LATEST_INTEGRITY_STATE_NOT_OK",
  );

  /*
   * -------------------------------------------------------
   * APPEND-ONLY GUARANTEE
   * -------------------------------------------------------
   */

  let updateRejected =
    false;

  try {
    db.prepare(`
      UPDATE economic_integrity_incident_events

      SET
        event_type = 'OPENED'

      WHERE id = ?
    `).run(
      latest?.id ??
      "",
    );
  } catch {
    updateRejected =
      true;
  }

  expect(
    updateRejected,
    "INCIDENT_EVENT_UPDATE_ALLOWED",
  );

  let deleteRejected =
    false;

  try {
    db.prepare(`
      DELETE FROM economic_integrity_incident_events
      WHERE id = ?
    `).run(
      latest?.id ??
      "",
    );
  } catch {
    deleteRejected =
      true;
  }

  expect(
    deleteRejected,
    "INCIDENT_EVENT_DELETE_ALLOWED",
  );

  console.log(
    "OX_ECONOMIC_INTEGRITY_INCIDENT_SQLITE=PASS",
  );

  console.log(
    "OK_TO_WARNING=OPENED",
  );

  console.log(
    "SAME_WARNING=OBSERVED",
  );

  console.log(
    "WARNING_TO_NEW_CRITICAL=SUPERSEDE_AND_OPEN",
  );

  console.log(
    "CRITICAL_TO_OK=RESOLVED",
  );

  console.log(
    "TOTAL_EVENTS=5",
  );

  console.log(
    "APPEND_ONLY_UPDATE_GUARD=PASS",
  );

  console.log(
    "APPEND_ONLY_DELETE_GUARD=PASS",
  );

  console.log(
    "AUTO_REPAIR=NO",
  );
} finally {
  rmSync(
    temporaryDirectory,
    {
      recursive:
        true,

      force:
        true,
    },
  );
}
