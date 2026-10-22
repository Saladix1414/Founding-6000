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
      "ox-economic-stale-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "stale.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  const {
    ensureEconomicReconciliationEvidenceSchema,
  } =
    await import(
      "../db/economicReconciliationEvidenceSchema.js"
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
    ECONOMIC_RECONCILIATION_STALE_MS,
  } =
    await import(
      "../economics/economicReconciliationHealthPolicy.js"
    );

  const {
    evaluateEconomicReconciliationStaleness,
  } =
    await import(
      "../services/economicIntegrityStaleService.js"
    );

  const {
    syncEconomicIncidentAlerts,
    getPendingEconomicAlerts,
  } =
    await import(
      "../services/economicAlertOutboxService.js"
    );

  ensureEconomicReconciliationEvidenceSchema();
  ensureEconomicIntegrityIncidentSchema();
  ensureEconomicAlertOutboxSchema();

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

  const now =
    Date.parse(
      "2026-10-22T18:00:00.000Z",
    );

  const staleReconciledAt =
    new Date(
      now -
        ECONOMIC_RECONCILIATION_STALE_MS -
        1,
    ).toISOString();

  db.prepare(`
    INSERT INTO economic_reconciliation_runs (
      id,
      reconciliation_version,
      status,
      critical_failures,
      warnings,
      report_hash,
      report_json,
      reconciled_at,
      created_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    "stale-run-1",
    "OX-ECONOMIC-RECONCILIATION-1",
    "OK",
    0,
    0,
    "stale-report-hash-1",
    JSON.stringify({
      test:
        true,
    }),
    staleReconciledAt,
    staleReconciledAt,
  );

  const result =
    evaluateEconomicReconciliationStaleness({
      nowMs:
        now,
    });

  expect(
    result.stale ===
      true,
    "STALE_NOT_DETECTED",
  );

  expect(
    result.state ===
      "STALE",
    "STALE_STATE_INVALID",
  );

  expect(
    result
      .incidentResult
      ?.action ===
      "OPEN",
    "STALE_INCIDENT_NOT_OPENED",
  );

  expect(
    result
      .incidentResult
      ?.event
      ?.eventType ===
      "OPENED",
    "STALE_INCIDENT_EVENT_INVALID",
  );

  expect(
    result
      .incidentResult
      ?.event
      ?.severity ===
      "CRITICAL",
    "STALE_SEVERITY_NOT_CRITICAL",
  );

  const sync =
    syncEconomicIncidentAlerts();

  expect(
    sync.created ===
      1,
    "STALE_ALERT_NOT_CREATED",
  );

  const pending =
    getPendingEconomicAlerts(
      10,
    ) as Array<{
      triggerType:
        string;

      severity:
        string |
        null;

      status:
        string;

      payloadJson:
        string;
    }>;

  expect(
    pending.length ===
      1,
    "STALE_ALERT_COUNT_INVALID",
  );

  expect(
    pending[0]
      ?.triggerType ===
      "INCIDENT_OPENED",
    "STALE_ALERT_TRIGGER_INVALID",
  );

  expect(
    pending[0]
      ?.severity ===
      "CRITICAL",
    "STALE_ALERT_SEVERITY_INVALID",
  );

  expect(
    pending[0]
      ?.status ===
      "PENDING",
    "STALE_ALERT_DELIVERED_UNEXPECTEDLY",
  );

  const payload =
    JSON.parse(
      pending[0]
        ?.payloadJson ??
        "{}",
    ) as {
      integrityState?:
        string;

      authority?: {
        governance?:
          boolean;

        reserveMutation?:
          boolean;

        blockchainTransaction?:
          boolean;

        autoRepair?:
          boolean;
      };
    };

  expect(
    payload.integrityState ===
      "STALE",
    "STALE_ALERT_PAYLOAD_STATE_INVALID",
  );

  expect(
    payload
      .authority
      ?.governance ===
      false,
    "STALE_ALERT_GAINED_GOVERNANCE_AUTHORITY",
  );

  expect(
    payload
      .authority
      ?.reserveMutation ===
      false,
    "STALE_ALERT_GAINED_RESERVE_AUTHORITY",
  );

  expect(
    payload
      .authority
      ?.blockchainTransaction ===
      false,
    "STALE_ALERT_GAINED_BLOCKCHAIN_AUTHORITY",
  );

  expect(
    payload
      .authority
      ?.autoRepair ===
      false,
    "STALE_ALERT_GAINED_REPAIR_AUTHORITY",
  );

  /*
   * Re-evaluation of same stale condition must observe
   * the same incident, not open a second one.
   *
   * Alert key dedupe prevents duplicate OPENED alerts.
   */
  const repeated =
    evaluateEconomicReconciliationStaleness({
      nowMs:
        now +
        60_000,
    });

  expect(
    repeated
      .incidentResult
      ?.action ===
      "OBSERVE",
    "REPEATED_STALE_NOT_OBSERVED",
  );

  const secondSync =
    syncEconomicIncidentAlerts();

  /*
   * One OBSERVED alert is allowed per incident,
   * according to OX-ECONOMIC-ALERT-1.
   */
  expect(
    secondSync.created ===
      1,
    "STALE_OBSERVED_ALERT_INVALID",
  );

  console.log(
    "OX_ECONOMIC_INTEGRITY_STALE_SQLITE=PASS",
  );

  console.log(
    "STALE_DETECTED=YES",
  );

  console.log(
    "STALE_SEVERITY=CRITICAL",
  );

  console.log(
    "STALE_INCIDENT=OPENED",
  );

  console.log(
    "STALE_ALERT=PENDING",
  );

  console.log(
    "REPEATED_STALE=OBSERVED",
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
