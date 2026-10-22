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

const tempDirectory =
  mkdtempSync(
    join(
      tmpdir(),
      "ox-reconciliation-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    tempDirectory,
    "reconciliation.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  /*
   * Minimal real SQLite representation of the
   * authoritative economic path used by the
   * reconciliation engine.
   *
   * No production database.
   * No RPC.
   * No blockchain transaction.
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

  /*
   * -------------------------------------------------------
   * Healthy canonical circuit:
   *
   * 50 USDT verified sale
   * → 12.50 USDT reserve obligation
   * → 12.50 RARE allocation
   * → confirmed sweep
   * → snapshot
   * → historical issued supply = 1
   * -------------------------------------------------------
   */

  db.prepare(`
    INSERT INTO payment_settlements (
      id,
      payment_method,
      status,
      amount_minor
    )
    VALUES (?, ?, ?, ?)
  `).run(
    "settlement-1",
    "USDT",
    "VERIFIED",
    50_000_000,
  );

  db.prepare(`
    INSERT INTO reserve_contributions (
      id,
      settlement_id,
      gross_amount_minor,
      reserve_bps,
      reserve_amount_minor
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "contribution-1",
    "settlement-1",
    50_000_000,
    2500,
    12_500_000,
  );

  db.prepare(`
    INSERT INTO reserve_allocations (
      id,
      contribution_id,
      beneficiary_tier,
      weight_bps,
      amount_minor
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "allocation-1",
    "contribution-1",
    "RARE",
    10_000,
    12_500_000,
  );

  db.prepare(`
    INSERT INTO reserve_sweeps (
      id,
      status,
      amount_minor,
      contribution_count
    )
    VALUES (?, ?, ?, ?)
  `).run(
    "sweep-1",
    "CONFIRMED",
    12_500_000,
    1,
  );

  db.prepare(`
    INSERT INTO reserve_sweep_items (
      id,
      sweep_id,
      contribution_id,
      amount_minor
    )
    VALUES (?, ?, ?, ?)
  `).run(
    "sweep-item-1",
    "sweep-1",
    "contribution-1",
    12_500_000,
  );

  db.prepare(`
    INSERT INTO inventory_allocations (
      id,
      serial_number,
      status
    )
    VALUES (?, ?, ?)
  `).run(
    "inventory-1",
    1,
    "ALLOCATED",
  );

  db.prepare(`
    INSERT INTO economic_exit_decisions (
      id,
      exit_policy_version,
      reserve_debit_authorized,
      nav_denominator_changes,
      serial_reusable,
      burn_authorized,
      redemption_authorized
    )
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
    INSERT INTO reserve_snapshots (
      id,
      snapshot_hash,
      captured_at,
      total_liability_minor,
      onchain_balance_minor,
      rare_balance_minor,
      epic_balance_minor,
      genesis_balance_minor,
      rare_issued_supply,
      epic_issued_supply,
      genesis_issued_supply,
      created_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    "snapshot-1",
    "sha256:healthy",
    "2026-10-21T18:00:00.000Z",
    12_500_000,
    12_500_000,
    12_500_000,
    0,
    0,
    1,
    0,
    0,
    "2026-10-21T18:00:00.000Z",
  );

  const {
    runEconomicReconciliation,
  } =
    await import(
      "../services/economicReconciliationService.js"
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

  function check(
    result:
      ReturnType<
        typeof runEconomicReconciliation
      >,

    code:
      string,
  ) {
    const found =
      result.checks.find(
        (
          candidate,
        ) =>
          candidate.code ===
          code,
      );

    if (!found) {
      throw new Error(
        `RECONCILIATION_CHECK_NOT_FOUND:${code}`,
      );
    }

    return found;
  }

  /*
   * -------------------------------------------------------
   * CASE 1 — HEALTHY CIRCUIT
   * -------------------------------------------------------
   */

  const healthy =
    runEconomicReconciliation();

  expect(
    healthy.status ===
      "OK",
    `HEALTHY_RECONCILIATION_NOT_OK:${healthy.status}`,
  );

  expect(
    healthy
      .summary
      .criticalFailures ===
      0,
    "HEALTHY_CRITICAL_FAILURES_PRESENT",
  );

  expect(
    healthy
      .summary
      .warnings ===
      0,
    "HEALTHY_WARNINGS_PRESENT",
  );

  expect(
    healthy
      .summary
      .reserveContributionMinor ===
      "12500000",
    "HEALTHY_RESERVE_TOTAL_INVALID",
  );

  expect(
    healthy
      .summary
      .reserveAllocationMinor ===
      "12500000",
    "HEALTHY_ALLOCATION_TOTAL_INVALID",
  );

  expect(
    healthy
      .historicalIssuedSupply
      .RARE ===
      1,
    "HEALTHY_RARE_SUPPLY_INVALID",
  );

  /*
   * -------------------------------------------------------
   * CASE 2 — VERIFIED SETTLEMENT WITHOUT CONTRIBUTION
   * -------------------------------------------------------
   */

  db.prepare(`
    INSERT INTO payment_settlements (
      id,
      payment_method,
      status,
      amount_minor
    )
    VALUES (?, ?, ?, ?)
  `).run(
    "settlement-missing-contribution",
    "USDT",
    "VERIFIED",
    50_000_000,
  );

  const missingContribution =
    runEconomicReconciliation();

  expect(
    missingContribution.status ===
      "CRITICAL",
    "MISSING_CONTRIBUTION_NOT_CRITICAL",
  );

  expect(
    check(
      missingContribution,
      "VERIFIED_SETTLEMENT_HAS_RESERVE_CONTRIBUTION",
    ).passed ===
      false,
    "MISSING_CONTRIBUTION_NOT_DETECTED",
  );

  db.prepare(`
    DELETE FROM payment_settlements
    WHERE id = ?
  `).run(
    "settlement-missing-contribution",
  );

  /*
   * -------------------------------------------------------
   * CASE 3 — BROKEN WATERFALL
   * -------------------------------------------------------
   */

  db.prepare(`
    UPDATE reserve_allocations

    SET
      amount_minor = ?

    WHERE id = ?
  `).run(
    12_000_000,
    "allocation-1",
  );

  const brokenWaterfall =
    runEconomicReconciliation();

  expect(
    brokenWaterfall.status ===
      "CRITICAL",
    "BROKEN_WATERFALL_NOT_CRITICAL",
  );

  expect(
    check(
      brokenWaterfall,
      "RESERVE_WATERFALL_RECONCILES",
    ).passed ===
      false,
    "BROKEN_WATERFALL_NOT_DETECTED",
  );

  expect(
    check(
      brokenWaterfall,
      "GLOBAL_ALLOCATIONS_EQUAL_RESERVE_OBLIGATIONS",
    ).passed ===
      false,
    "GLOBAL_ALLOCATION_MISMATCH_NOT_DETECTED",
  );

  db.prepare(`
    UPDATE reserve_allocations

    SET
      amount_minor = ?

    WHERE id = ?
  `).run(
    12_500_000,
    "allocation-1",
  );

  /*
   * -------------------------------------------------------
   * CASE 4 — SWEEP ITEM DOES NOT MATCH CONTRIBUTION
   * -------------------------------------------------------
   */

  db.prepare(`
    UPDATE reserve_sweep_items

    SET
      amount_minor = ?

    WHERE id = ?
  `).run(
    12_000_000,
    "sweep-item-1",
  );

  const brokenSweepItem =
    runEconomicReconciliation();

  expect(
    check(
      brokenSweepItem,
      "SWEEP_ITEM_MATCHES_CONTRIBUTION",
    ).passed ===
      false,
    "BROKEN_SWEEP_ITEM_NOT_DETECTED",
  );

  db.prepare(`
    UPDATE reserve_sweep_items

    SET
      amount_minor = ?

    WHERE id = ?
  `).run(
    12_500_000,
    "sweep-item-1",
  );

  /*
   * -------------------------------------------------------
   * CASE 5 — SWEEP HEADER DOES NOT MATCH ITEMS
   * -------------------------------------------------------
   */

  db.prepare(`
    UPDATE reserve_sweeps

    SET
      amount_minor = ?

    WHERE id = ?
  `).run(
    13_000_000,
    "sweep-1",
  );

  const brokenSweepHeader =
    runEconomicReconciliation();

  expect(
    check(
      brokenSweepHeader,
      "SWEEP_HEADER_RECONCILES_ITEMS",
    ).passed ===
      false,
    "BROKEN_SWEEP_HEADER_NOT_DETECTED",
  );

  db.prepare(`
    UPDATE reserve_sweeps

    SET
      amount_minor = ?

    WHERE id = ?
  `).run(
    12_500_000,
    "sweep-1",
  );

  /*
   * -------------------------------------------------------
   * CASE 6 — SNAPSHOT TIER BALANCE CORRUPTION
   * -------------------------------------------------------
   */

  db.prepare(`
    UPDATE reserve_snapshots

    SET
      rare_balance_minor = ?

    WHERE id = ?
  `).run(
    11_000_000,
    "snapshot-1",
  );

  const brokenSnapshot =
    runEconomicReconciliation();

  expect(
    brokenSnapshot.status ===
      "CRITICAL",
    "BROKEN_SNAPSHOT_NOT_CRITICAL",
  );

  expect(
    check(
      brokenSnapshot,
      "SNAPSHOT_RARE_BALANCE_MATCHES_LEDGER",
    ).passed ===
      false,
    "BROKEN_SNAPSHOT_TIER_NOT_DETECTED",
  );

  db.prepare(`
    UPDATE reserve_snapshots

    SET
      rare_balance_minor = ?

    WHERE id = ?
  `).run(
    12_500_000,
    "snapshot-1",
  );

  /*
   * -------------------------------------------------------
   * CASE 7 — SNAPSHOT ISSUED SUPPLY CORRUPTION
   * -------------------------------------------------------
   */

  db.prepare(`
    UPDATE reserve_snapshots

    SET
      rare_issued_supply = ?

    WHERE id = ?
  `).run(
    2,
    "snapshot-1",
  );

  const brokenSupply =
    runEconomicReconciliation();

  expect(
    check(
      brokenSupply,
      "SNAPSHOT_RARE_SUPPLY_MATCHES_HISTORY",
    ).passed ===
      false,
    "BROKEN_SUPPLY_NOT_DETECTED",
  );

  db.prepare(`
    UPDATE reserve_snapshots

    SET
      rare_issued_supply = ?

    WHERE id = ?
  `).run(
    1,
    "snapshot-1",
  );

  /*
   * -------------------------------------------------------
   * CASE 8 — PROHIBITED EXIT AUTHORITY
   * -------------------------------------------------------
   */

  db.prepare(`
    INSERT INTO economic_exit_decisions (
      id,
      exit_policy_version,
      reserve_debit_authorized,
      nav_denominator_changes,
      serial_reusable,
      burn_authorized,
      redemption_authorized
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "exit-corrupt",
    "OX-ECONOMIC-EXIT-1",
    1,
    0,
    0,
    0,
    0,
  );

  const forbiddenAuthority =
    runEconomicReconciliation();

  expect(
    forbiddenAuthority.status ===
      "CRITICAL",
    "FORBIDDEN_EXIT_AUTHORITY_NOT_CRITICAL",
  );

  expect(
    check(
      forbiddenAuthority,
      "EXIT_POLICY_FAIL_CLOSED",
    ).passed ===
      false,
    "FORBIDDEN_EXIT_AUTHORITY_NOT_DETECTED",
  );

  db.prepare(`
    DELETE FROM economic_exit_decisions
    WHERE id = ?
  `).run(
    "exit-corrupt",
  );

  /*
   * -------------------------------------------------------
   * CASE 9 — EXTERNAL VAULT FUNDING IS ALLOWED
   *
   * Vault balance may legitimately exceed confirmed sweeps.
   * This must NOT create a reconciliation failure.
   * -------------------------------------------------------
   */

  db.prepare(`
    UPDATE reserve_snapshots

    SET
      onchain_balance_minor = ?

    WHERE id = ?
  `).run(
    20_000_000,
    "snapshot-1",
  );

  const externallyFundedVault =
    runEconomicReconciliation();

  expect(
    externallyFundedVault.status ===
      "OK",
    `EXTERNAL_VAULT_FUNDING_FALSE_POSITIVE:${externallyFundedVault.status}`,
  );

  expect(
    externallyFundedVault
      .custodyEvidence
      .confirmedSweepMinor ===
      "12500000",
    "CONFIRMED_SWEEP_EVIDENCE_INVALID",
  );

  expect(
    externallyFundedVault
      .custodyEvidence
      .latestObservedVaultBalanceMinor ===
      "20000000",
    "VAULT_BALANCE_EVIDENCE_INVALID",
  );

  expect(
    externallyFundedVault
      .custodyEvidence
      .strictEqualityRequired ===
      false,
    "VAULT_SWEEP_EQUALITY_INCORRECTLY_REQUIRED",
  );

  /*
   * Restore canonical observed balance.
   */
  db.prepare(`
    UPDATE reserve_snapshots

    SET
      onchain_balance_minor = ?

    WHERE id = ?
  `).run(
    12_500_000,
    "snapshot-1",
  );

  /*
   * -------------------------------------------------------
   * FINAL HEALTH CHECK
   * -------------------------------------------------------
   */

  const finalHealthy =
    runEconomicReconciliation();

  expect(
    finalHealthy.status ===
      "OK",
    `FINAL_RECONCILIATION_NOT_OK:${finalHealthy.status}`,
  );

  expect(
    finalHealthy
      .summary
      .criticalFailures ===
      0,
    "FINAL_CRITICAL_FAILURES_PRESENT",
  );

  console.log(
    "OX_ECONOMIC_RECONCILIATION_SQLITE=PASS",
  );

  console.log(
    "HEALTHY_CIRCUIT=PASS",
  );

  console.log(
    "MISSING_CONTRIBUTION_DETECTED=PASS",
  );

  console.log(
    "BROKEN_WATERFALL_DETECTED=PASS",
  );

  console.log(
    "BROKEN_SWEEP_ITEM_DETECTED=PASS",
  );

  console.log(
    "BROKEN_SWEEP_HEADER_DETECTED=PASS",
  );

  console.log(
    "BROKEN_SNAPSHOT_DETECTED=PASS",
  );

  console.log(
    "BROKEN_ISSUED_SUPPLY_DETECTED=PASS",
  );

  console.log(
    "FORBIDDEN_EXIT_AUTHORITY_DETECTED=PASS",
  );

  console.log(
    "EXTERNAL_VAULT_FUNDING_FALSE_POSITIVE=NO",
  );

  console.log(
    "FINAL_HEALTH=OK",
  );
} finally {
  rmSync(
    tempDirectory,
    {
      recursive:
        true,

      force:
        true,
    },
  );
}
