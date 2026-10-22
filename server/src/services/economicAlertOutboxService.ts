import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureEconomicAlertOutboxSchema,
} from "../db/economicAlertOutboxSchema.js";

import {
  ensureEconomicIntegrityIncidentSchema,
} from "../db/economicIntegrityIncidentSchema.js";

import {
  ECONOMIC_ALERT_POLICY_VERSION,
  buildEconomicAlertKey,
  severityForIncident,
  triggerForIncidentEvent,
} from "../economics/economicAlertPolicy.js";

ensureEconomicAlertOutboxSchema();
ensureEconomicIntegrityIncidentSchema();

export type EconomicIncidentAlertInput = {
  incidentId:
    string;

  incidentEventId:
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
    "OK" |
    "WARNING" |
    "CRITICAL" |
    "STALE";

  reportHash:
    string |
    null;

  createdAt:
    string;
};

type UnsyncedIncidentEventRow = {
  sourceRowid:
    number;

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
    "OK" |
    "WARNING" |
    "CRITICAL" |
    "STALE";

  reportHash:
    string |
    null;

  createdAt:
    string;
};

export function enqueueEconomicIncidentAlert(
  input:
    EconomicIncidentAlertInput,
) {
  ensureEconomicAlertOutboxSchema();

  const trigger =
    triggerForIncidentEvent(
      input.eventType,
    );

  const alertKey =
    buildEconomicAlertKey({
      incidentId:
        input.incidentId,

      trigger,
    });

  const existing =
    db.prepare(`
      SELECT
        id,

        alert_key
          AS alertKey

      FROM economic_alert_outbox

      WHERE alert_key = ?

      LIMIT 1
    `).get(
      alertKey,
    ) as
      | {
          id:
            string;

          alertKey:
            string;
        }
      | undefined;

  if (existing) {
    return {
      id:
        existing.id,

      alertKey:
        existing.alertKey,

      idempotentReplay:
        true,
    };
  }

  const id =
    randomUUID();

  const createdAt =
    new Date()
      .toISOString();

  const severity =
    severityForIncident({
      eventType:
        input.eventType,

      severity:
        input.severity,
    });

  const payload = {
    policyVersion:
      ECONOMIC_ALERT_POLICY_VERSION,

    incidentId:
      input.incidentId,

    incidentEventId:
      input.incidentEventId,

    trigger,

    severity,

    integrityState:
      input.integrityState,

    reportHash:
      input.reportHash,

    incidentCreatedAt:
      input.createdAt,

    authority: {
      governance:
        false,

      reserveMutation:
        false,

      blockchainTransaction:
        false,

      autoRepair:
        false,
    },
  };

  db.prepare(`
    INSERT INTO economic_alert_outbox (
      id,
      alert_policy_version,
      alert_key,
      incident_id,
      incident_event_id,
      trigger_type,
      severity,
      status,
      payload_json,
      created_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?
    )
  `).run(
    id,
    ECONOMIC_ALERT_POLICY_VERSION,
    alertKey,
    input.incidentId,
    input.incidentEventId,
    trigger,
    severity,
    JSON.stringify(
      payload,
    ),
    createdAt,
  );

  return {
    id,

    alertKey,

    idempotentReplay:
      false,
  };
}

/*
 * Synchronize durable incident history into the alert
 * outbox.
 *
 * This intentionally reads the incident event ledger
 * instead of relying only on the event returned by the
 * reconciliation cycle.
 *
 * That matters because one reconciliation observation
 * may create:
 *
 *   RESOLVED(old incident)
 *   OPENED(new incident)
 *
 * Both must be observable.
 *
 * OBSERVED events are deduplicated by the alert key.
 */
export function syncEconomicIncidentAlerts(
  limit:
    number = 100,
) {
  ensureEconomicIntegrityIncidentSchema();
  ensureEconomicAlertOutboxSchema();

  if (
    !Number.isInteger(
      limit,
    ) ||
    limit < 1 ||
    limit > 1000
  ) {
    throw new Error(
      "INVALID_ECONOMIC_ALERT_SYNC_LIMIT",
    );
  }

  const cursorRow =
    db.prepare(`
      SELECT
        last_incident_rowid
          AS lastIncidentRowid

      FROM economic_alert_sync_state

      WHERE stream = ?

      LIMIT 1
    `).get(
      "economic_integrity_incident_events",
    ) as
      | {
          lastIncidentRowid:
            number;
        }
      | undefined;

  const lastIncidentRowid =
    Number(
      cursorRow
        ?.lastIncidentRowid ??
        0,
    );

  const rows =
    db.prepare(`
      SELECT
        rowid
          AS sourceRowid,

        id,

        incident_id
          AS incidentId,

        event_type
          AS eventType,

        severity,

        integrity_state
          AS integrityState,

        report_hash
          AS reportHash,

        created_at
          AS createdAt

      FROM economic_integrity_incident_events

      WHERE rowid > ?

      ORDER BY
        rowid ASC

      LIMIT ?
    `).all(
      lastIncidentRowid,
      limit,
    ) as
      UnsyncedIncidentEventRow[];

  let created =
    0;

  let replayed =
    0;

  for (
    const row of
      rows
  ) {
    const result =
      enqueueEconomicIncidentAlert({
        incidentId:
          row.incidentId,

        incidentEventId:
          row.id,

        eventType:
          row.eventType,

        severity:
          row.severity,

        integrityState:
          row.integrityState,

        reportHash:
          row.reportHash,

        createdAt:
          row.createdAt,
      });

    if (
      result.idempotentReplay
    ) {
      replayed +=
        1;
    } else {
      created +=
        1;
    }

    /*
     * Advance only after this source event has been
     * processed successfully.
     *
     * A crash before the cursor update safely replays
     * the same source event on the next cycle.
     */
    db.prepare(`
      UPDATE economic_alert_sync_state

      SET
        last_incident_rowid = ?,
        updated_at = ?

      WHERE stream = ?
    `).run(
      row.sourceRowid,
      new Date()
        .toISOString(),
      "economic_integrity_incident_events",
    );
  }

  return {
    scanned:
      rows.length,

    created,

    replayed,
  };
}

export function getPendingEconomicAlerts(
  limit:
    number = 25,
) {
  ensureEconomicAlertOutboxSchema();

  if (
    !Number.isInteger(
      limit,
    ) ||
    limit < 1 ||
    limit > 250
  ) {
    throw new Error(
      "INVALID_ECONOMIC_ALERT_LIMIT",
    );
  }

  return db.prepare(`
    SELECT
      id,

      alert_key
        AS alertKey,

      incident_id
        AS incidentId,

      incident_event_id
        AS incidentEventId,

      trigger_type
        AS triggerType,

      severity,

      status,

      payload_json
        AS payloadJson,

      created_at
        AS createdAt

    FROM economic_alert_outbox

    WHERE status =
      'PENDING'

    ORDER BY
      created_at ASC,
      rowid ASC

    LIMIT ?
  `).all(
    limit,
  );
}
