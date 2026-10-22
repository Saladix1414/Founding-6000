import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureEconomicReconciliationEvidenceSchema,
} from "../db/economicReconciliationEvidenceSchema.js";

import {
  runEconomicReconciliation,
} from "./economicReconciliationService.js";

ensureEconomicReconciliationEvidenceSchema();

function canonicalJson(
  value:
    unknown,
) {
  return JSON.stringify(
    value,
  );
}

export function captureEconomicReconciliationEvidence() {
  ensureEconomicReconciliationEvidenceSchema();

  const report =
    runEconomicReconciliation();

  const reportJson =
    canonicalJson(
      report,
    );

  const reportHash =
    createHash(
      "sha256",
    )
      .update(
        reportJson,
      )
      .digest(
        "hex",
      );

  const existing =
    db.prepare(`
      SELECT
        id,
        report_hash
          AS reportHash

      FROM economic_reconciliation_runs

      WHERE report_hash = ?

      LIMIT 1
    `).get(
      reportHash,
    ) as
      | {
          id:
            string;

          reportHash:
            string;
        }
      | undefined;

  if (existing) {
    return {
      report,

      reportHash,

      id:
        existing.id,

      idempotentReplay:
        true,
    };
  }

  const id =
    randomUUID();

  const createdAt =
    new Date()
      .toISOString();

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
    id,
    report
      .reconciliationVersion,
    report.status,
    report
      .summary
      .criticalFailures,
    report
      .summary
      .warnings,
    reportHash,
    reportJson,
    report.reconciledAt,
    createdAt,
  );

  return {
    report,

    reportHash,

    id,

    idempotentReplay:
      false,
  };
}

export function getLatestEconomicReconciliationEvidence() {
  ensureEconomicReconciliationEvidenceSchema();

  const row =
    db.prepare(`
      SELECT
        id,

        reconciliation_version
          AS reconciliationVersion,

        status,

        critical_failures
          AS criticalFailures,

        warnings,

        report_hash
          AS reportHash,

        report_json
          AS reportJson,

        reconciled_at
          AS reconciledAt,

        created_at
          AS createdAt

      FROM economic_reconciliation_runs

      ORDER BY
        reconciled_at DESC,
        created_at DESC

      LIMIT 1
    `).get() as
      | {
          id:
            string;

          reconciliationVersion:
            string;

          status:
            "OK" |
            "WARNING" |
            "CRITICAL";

          criticalFailures:
            number;

          warnings:
            number;

          reportHash:
            string;

          reportJson:
            string;

          reconciledAt:
            string;

          createdAt:
            string;
        }
      | undefined;

  if (!row) {
    return null;
  }

  return {
    id:
      row.id,

    reconciliationVersion:
      row.reconciliationVersion,

    status:
      row.status,

    criticalFailures:
      Number(
        row.criticalFailures,
      ),

    warnings:
      Number(
        row.warnings,
      ),

    reportHash:
      row.reportHash,

    report:
      JSON.parse(
        row.reportJson,
      ) as Record<
        string,
        unknown
      >,

    reconciledAt:
      row.reconciledAt,

    createdAt:
      row.createdAt,
  };
}
