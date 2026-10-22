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
      "ox-reconciliation-evidence-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "evidence.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  /*
   * Minimal economic fixture required by the
   * read-only reconciliation engine.
   */
  db.exec(`
    CREATE TABLE payment_settlements (
      id TEXT PRIMARY KEY,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_minor INTEGER NOT NULL
    );

    CREATE TABLE reserve_contributions (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL,
      gross_amount_minor INTEGER NOT NULL,
      reserve_bps INTEGER NOT NULL,
      reserve_amount_minor INTEGER NOT NULL
    );

    CREATE TABLE reserve_allocations (
      id TEXT PRIMARY KEY,
      contribution_id TEXT NOT NULL,
      beneficiary_tier TEXT NOT NULL,
      weight_bps INTEGER NOT NULL,
      amount_minor INTEGER NOT NULL
    );

    CREATE TABLE reserve_sweeps (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      contribution_count INTEGER NOT NULL
    );

    CREATE TABLE reserve_sweep_items (
      id TEXT PRIMARY KEY,
      sweep_id TEXT NOT NULL,
      contribution_id TEXT NOT NULL,
      amount_minor INTEGER NOT NULL
    );

    CREATE TABLE economic_exit_decisions (
      id TEXT PRIMARY KEY,
      exit_policy_version TEXT NOT NULL,
      reserve_debit_authorized INTEGER NOT NULL,
      nav_denominator_changes INTEGER NOT NULL,
      serial_reusable INTEGER NOT NULL,
      burn_authorized INTEGER NOT NULL,
      redemption_authorized INTEGER NOT NULL
    );

    CREATE TABLE inventory_allocations (
      id TEXT PRIMARY KEY,
      serial_number INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL
    );

    CREATE TABLE reserve_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_hash TEXT NOT NULL UNIQUE,
      captured_at TEXT NOT NULL,
      total_liability_minor INTEGER NOT NULL,
      onchain_balance_minor INTEGER NOT NULL,
      rare_balance_minor INTEGER NOT NULL,
      epic_balance_minor INTEGER NOT NULL,
      genesis_balance_minor INTEGER NOT NULL,
      rare_issued_supply INTEGER NOT NULL,
      epic_issued_supply INTEGER NOT NULL,
      genesis_issued_supply INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.prepare(`
    INSERT INTO payment_settlements
    VALUES (?, ?, ?, ?)
  `).run(
    "settlement-1",
    "USDT",
    "VERIFIED",
    50_000_000,
  );

  db.prepare(`
    INSERT INTO reserve_contributions
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "contribution-1",
    "settlement-1",
    50_000_000,
    2500,
    12_500_000,
  );

  db.prepare(`
    INSERT INTO reserve_allocations
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "allocation-1",
    "contribution-1",
    "RARE",
    10_000,
    12_500_000,
  );

  db.prepare(`
    INSERT INTO reserve_sweeps
    VALUES (?, ?, ?, ?)
  `).run(
    "sweep-1",
    "CONFIRMED",
    12_500_000,
    1,
  );

  db.prepare(`
    INSERT INTO reserve_sweep_items
    VALUES (?, ?, ?, ?)
  `).run(
    "sweep-item-1",
    "sweep-1",
    "contribution-1",
    12_500_000,
  );

  db.prepare(`
    INSERT INTO economic_exit_decisions
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "exit-1",
    "OX-ECONOMIC-EXIT-1",
    0,
    0,
    0,
    0,
    0,
  );

  db.prepare(`
    INSERT INTO inventory_allocations
    VALUES (?, ?, ?)
  `).run(
    "inventory-1",
    1,
    "ALLOCATED",
  );

  const now =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO reserve_snapshots
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    "snapshot-1",
    "sha256:evidence-healthy",
    now,
    12_500_000,
    12_500_000,
    12_500_000,
    0,
    0,
    1,
    0,
    0,
    now,
  );

  const {
    ensureEconomicReconciliationEvidenceSchema,
  } =
    await import(
      "../db/economicReconciliationEvidenceSchema.js"
    );

  const {
    captureEconomicReconciliationEvidence,
    getLatestEconomicReconciliationEvidence,
  } =
    await import(
      "../services/economicReconciliationEvidenceService.js"
    );

  ensureEconomicReconciliationEvidenceSchema();

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

  /*
   * First evidence must be healthy.
   */
  const healthy =
    captureEconomicReconciliationEvidence();

  expect(
    healthy
      .report
      .status ===
      "OK",
    "HEALTHY_EVIDENCE_NOT_OK",
  );

  const latestHealthy =
    getLatestEconomicReconciliationEvidence();

  expect(
    latestHealthy !==
      null,
    "HEALTHY_EVIDENCE_NOT_PERSISTED",
  );

  expect(
    latestHealthy?.status ===
      "OK",
    "LATEST_HEALTHY_STATUS_INVALID",
  );

  /*
   * Controlled corruption:
   * verified settlement loses its reserve contribution.
   */
  db.prepare(`
    DELETE FROM reserve_allocations
    WHERE contribution_id = ?
  `).run(
    "contribution-1",
  );

  const critical =
    captureEconomicReconciliationEvidence();

  expect(
    critical
      .report
      .status ===
      "CRITICAL",
    "CORRUPTION_NOT_CAPTURED_AS_CRITICAL",
  );

  const latestCritical =
    getLatestEconomicReconciliationEvidence();

  expect(
    latestCritical !==
      null,
    "LATEST_CRITICAL_EVIDENCE_NOT_FOUND",
  );

  if (!latestCritical) {
    throw new Error(
      "LATEST_CRITICAL_EVIDENCE_NOT_FOUND",
    );
  }

  expect(
    latestCritical.status ===
      "CRITICAL",
    "LATEST_CRITICAL_STATUS_INVALID",
  );

  /*
   * Two distinct reconciliation runs must remain
   * as separate historical evidence.
   */
  const countRow =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM economic_reconciliation_runs
    `).get() as {
      count:
        number;
    };

  expect(
    Number(
      countRow.count,
    ) ===
      2,
    "RECONCILIATION_HISTORY_NOT_APPEND_ONLY",
  );

  /*
   * Existing evidence cannot be changed.
   */
  let updateRejected =
    false;

  try {
    db.prepare(`
      UPDATE economic_reconciliation_runs
      SET status = 'OK'
      WHERE id = ?
    `).run(
      latestCritical.id,
    );
  } catch {
    updateRejected =
      true;
  }

  expect(
    updateRejected,
    "RECONCILIATION_EVIDENCE_UPDATE_ALLOWED",
  );

  let deleteRejected =
    false;

  try {
    db.prepare(`
      DELETE FROM economic_reconciliation_runs
      WHERE id = ?
    `).run(
      latestCritical.id,
    );
  } catch {
    deleteRejected =
      true;
  }

  expect(
    deleteRejected,
    "RECONCILIATION_EVIDENCE_DELETE_ALLOWED",
  );

  console.log(
    "OX_ECONOMIC_RECONCILIATION_EVIDENCE_SQLITE=PASS",
  );

  console.log(
    "HEALTHY_EVIDENCE=OK",
  );

  console.log(
    "CORRUPTED_EVIDENCE=CRITICAL",
  );

  console.log(
    "HISTORY_ROWS=2",
  );

  console.log(
    "APPEND_ONLY_UPDATE_GUARD=PASS",
  );

  console.log(
    "APPEND_ONLY_DELETE_GUARD=PASS",
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
