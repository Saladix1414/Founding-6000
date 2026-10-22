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
      "ox-economic-alert-cursor-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "cursor.sqlite",
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
    ensureEconomicAlertOutboxSchema,
  } =
    await import(
      "../db/economicAlertOutboxSchema.js"
    );

  const {
    recordEconomicIntegrityObservation,
  } =
    await import(
      "../services/economicIntegrityIncidentService.js"
    );

  const {
    syncEconomicIncidentAlerts,
    getPendingEconomicAlerts,
  } =
    await import(
      "../services/economicAlertOutboxService.js"
    );

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

  ensureEconomicIntegrityIncidentSchema();
  ensureEconomicAlertOutboxSchema();

  function readCursor() {
    const row =
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

    if (!row) {
      throw new Error(
        "SYNC_CURSOR_ROW_MISSING",
      );
    }

    return Number(
      row.lastIncidentRowid,
    );
  }

  expect(
    readCursor() ===
      0,
    "INITIAL_CURSOR_NOT_ZERO",
  );

  /*
   * Create exactly 125 durable incident events:
   *
   * #1     OPENED
   * #2-125 OBSERVED
   *
   * All share one incident fingerprint.
   */
  for (
    let index =
      1;
    index <=
      125;
    index +=
      1
  ) {
    recordEconomicIntegrityObservation({
      state:
        "WARNING",

      reportHash:
        `cursor-warning-${index}`,

      failingCodes: [
        "CURSOR_PROGRESS_TEST",
      ],

      evidence: {
        index,
      },
    });
  }

  const incidentCountBefore =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM economic_integrity_incident_events
    `).get() as {
      count:
        number;
    };

  expect(
    Number(
      incidentCountBefore.count,
    ) ===
      125,
    `INCIDENT_EVENT_COUNT_INVALID:${incidentCountBefore.count}`,
  );

  /*
   * First batch:
   *
   * source rowid 1..100
   *
   * Alert policy creates:
   * - one OPENED alert
   * - one OBSERVED alert
   *
   * remaining OBSERVED events replay against
   * the incident-scoped alert key.
   */
  const first =
    syncEconomicIncidentAlerts(
      100,
    );

  expect(
    first.scanned ===
      100,
    `FIRST_BATCH_SCAN_INVALID:${first.scanned}`,
  );

  expect(
    first.created ===
      2,
    `FIRST_BATCH_CREATED_INVALID:${first.created}`,
  );

  expect(
    first.replayed ===
      98,
    `FIRST_BATCH_REPLAY_INVALID:${first.replayed}`,
  );

  expect(
    readCursor() ===
      100,
    `FIRST_CURSOR_INVALID:${readCursor()}`,
  );

  /*
   * Second batch MUST continue from row 101,
   * not restart at row 1.
   */
  const second =
    syncEconomicIncidentAlerts(
      100,
    );

  expect(
    second.scanned ===
      25,
    `SECOND_BATCH_SCAN_INVALID:${second.scanned}`,
  );

  expect(
    second.created ===
      0,
    `SECOND_BATCH_CREATED_INVALID:${second.created}`,
  );

  expect(
    second.replayed ===
      25,
    `SECOND_BATCH_REPLAY_INVALID:${second.replayed}`,
  );

  expect(
    readCursor() ===
      125,
    `SECOND_CURSOR_INVALID:${readCursor()}`,
  );

  /*
   * With no new incident events, nothing should scan.
   */
  const empty =
    syncEconomicIncidentAlerts(
      100,
    );

  expect(
    empty.scanned ===
      0,
    `EMPTY_BATCH_SCANNED:${empty.scanned}`,
  );

  expect(
    empty.created ===
      0,
    `EMPTY_BATCH_CREATED:${empty.created}`,
  );

  expect(
    empty.replayed ===
      0,
    `EMPTY_BATCH_REPLAYED:${empty.replayed}`,
  );

  expect(
    readCursor() ===
      125,
    "EMPTY_BATCH_MOVED_CURSOR",
  );

  /*
   * Add row 126 by resolving the incident.
   *
   * This is the critical starvation proof:
   * a source event beyond the original LIMIT 100
   * must remain reachable.
   */
  const recovery =
    recordEconomicIntegrityObservation({
      state:
        "OK",

      reportHash:
        "cursor-recovery-126",
    });

  expect(
    recovery
      .event
      ?.eventType ===
      "RESOLVED",
    "RECOVERY_EVENT_NOT_RESOLVED",
  );

  const incidentCountAfter =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM economic_integrity_incident_events
    `).get() as {
      count:
        number;
    };

  expect(
    Number(
      incidentCountAfter.count,
    ) ===
      126,
    `FINAL_INCIDENT_COUNT_INVALID:${incidentCountAfter.count}`,
  );

  const third =
    syncEconomicIncidentAlerts(
      100,
    );

  expect(
    third.scanned ===
      1,
    `THIRD_BATCH_SCAN_INVALID:${third.scanned}`,
  );

  expect(
    third.created ===
      1,
    `THIRD_BATCH_CREATED_INVALID:${third.created}`,
  );

  expect(
    third.replayed ===
      0,
    `THIRD_BATCH_REPLAY_INVALID:${third.replayed}`,
  );

  expect(
    readCursor() ===
      126,
    `FINAL_CURSOR_INVALID:${readCursor()}`,
  );

  const pending =
    getPendingEconomicAlerts(
      25,
    ) as Array<{
      triggerType:
        string;

      status:
        string;
    }>;

  /*
   * One incident, therefore:
   *
   * OPENED
   * OBSERVED
   * RESOLVED
   *
   * = 3 alerts total despite 126 ledger events.
   */
  expect(
    pending.length ===
      3,
    `FINAL_ALERT_COUNT_INVALID:${pending.length}`,
  );

  expect(
    pending.filter(
      (row) =>
        row.triggerType ===
        "INCIDENT_OPENED",
    ).length ===
      1,
    "OPENED_ALERT_COUNT_INVALID",
  );

  expect(
    pending.filter(
      (row) =>
        row.triggerType ===
        "INCIDENT_OBSERVED",
    ).length ===
      1,
    "OBSERVED_ALERT_COUNT_INVALID",
  );

  expect(
    pending.filter(
      (row) =>
        row.triggerType ===
        "INCIDENT_RESOLVED",
    ).length ===
      1,
    "RESOLVED_ALERT_COUNT_INVALID",
  );

  expect(
    pending.every(
      (row) =>
        row.status ===
        "PENDING",
    ),
    "ALERT_DELIVERY_OCCURRED",
  );

  console.log(
    "OX_ECONOMIC_ALERT_SYNC_CURSOR_SQLITE=PASS",
  );

  console.log(
    "SOURCE_EVENTS=126",
  );

  console.log(
    "FIRST_BATCH_SCANNED=100",
  );

  console.log(
    "CURSOR_AFTER_FIRST_BATCH=100",
  );

  console.log(
    "SECOND_BATCH_SCANNED=25",
  );

  console.log(
    "CURSOR_AFTER_SECOND_BATCH=125",
  );

  console.log(
    "POST_LIMIT_EVENT_REACHED=YES",
  );

  console.log(
    "FINAL_CURSOR=126",
  );

  console.log(
    "STARVATION_PREVENTED=YES",
  );

  console.log(
    "ALERT_STORM_PREVENTED=YES",
  );

  console.log(
    "ALERT_DELIVERY=NO",
  );

  console.log(
    "ECONOMIC_AUTHORITY=NO",
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
