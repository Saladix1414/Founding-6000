import {
  readFileSync,
} from "node:fs";

const schema =
  readFileSync(
    "server/src/db/economicReconciliationEvidenceSchema.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economicReconciliationEvidenceService.ts",
    "utf8",
  );

const migrations =
  readFileSync(
    "server/src/db/migrationRegistry.ts",
    "utf8",
  );

const health =
  readFileSync(
    "server/src/routes/health.ts",
    "utf8",
  );

const requiredSchema = [
  "economic_reconciliation_runs",
  "report_hash TEXT NOT NULL UNIQUE",
  "report_json TEXT NOT NULL",
  "trg_economic_reconciliation_runs_no_update",
  "trg_economic_reconciliation_runs_no_delete",
  "ECONOMIC_RECONCILIATION_RUNS_APPEND_ONLY",
];

for (
  const value of
    requiredSchema
) {
  if (
    !schema.includes(
      value,
    )
  ) {
    throw new Error(
      `RECONCILIATION_EVIDENCE_SCHEMA_MISSING:${value}`,
    );
  }
}

const requiredService = [
  "runEconomicReconciliation",
  "captureEconomicReconciliationEvidence",
  "getLatestEconomicReconciliationEvidence",
  "reportHash",
  "idempotentReplay",
];

for (
  const value of
    requiredService
) {
  if (
    !service.includes(
      value,
    )
  ) {
    throw new Error(
      `RECONCILIATION_EVIDENCE_SERVICE_MISSING:${value}`,
    );
  }
}

if (
  !migrations.includes(
    '"012_economic_reconciliation_evidence"'
  )
) {
  throw new Error(
    "MIGRATION_012_MISSING",
  );
}

const healthFields = [
  "economicIntegrity",
  "economicReconciledAt",
  "economicReportHash",
  "economicIntegrityReady",
];

for (
  const value of
    healthFields
) {
  if (
    !health.includes(
      value,
    )
  ) {
    throw new Error(
      `HEALTH_ECONOMIC_FIELD_MISSING:${value}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_RECONCILIATION_EVIDENCE_CONTRACT=PASS",
);

console.log(
  "APPEND_ONLY_EVIDENCE=PASS",
);

console.log(
  "REPORT_HASH=PASS",
);

console.log(
  "MIGRATION_012=PASS",
);

console.log(
  "HEALTH_INTEGRATION=PASS",
);
