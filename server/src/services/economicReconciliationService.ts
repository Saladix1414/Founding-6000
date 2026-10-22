import {
  db,
} from "../db/database.js";

import {
  ECONOMIC_RECONCILIATION_VERSION,
  reconciliationSeverity,
  type ReconciliationCheck,
} from "../economics/economicReconciliationPolicy.js";

import {
  NAV_SUPPLY_BASIS,
  NAV_SUPPLY_POLICY_VERSION,
} from "../economics/navSupplyPolicy.js";

type CountSumRow = {
  count:
    number;

  amountMinor:
    number;
};

type LatestSnapshotRow = {
  snapshotHash:
    string;

  capturedAt:
    string;

  totalLiabilityMinor:
    number;

  onchainBalanceMinor:
    number;

  rareBalanceMinor:
    number;

  epicBalanceMinor:
    number;

  genesisBalanceMinor:
    number;

  rareIssuedSupply:
    number;

  epicIssuedSupply:
    number;

  genesisIssuedSupply:
    number;
};

function countSum(
  sql:
    string,
) {
  const row =
    db.prepare(
      sql,
    ).get() as
      | CountSumRow
      | undefined;

  return {
    count:
      Number(
        row?.count ??
        0,
      ),

    amountMinor:
      BigInt(
        row?.amountMinor ??
        0,
      ),
  };
}

function latestSnapshot() {
  return db.prepare(`
    SELECT
      snapshot_hash
        AS snapshotHash,

      captured_at
        AS capturedAt,

      total_liability_minor
        AS totalLiabilityMinor,

      onchain_balance_minor
        AS onchainBalanceMinor,

      rare_balance_minor
        AS rareBalanceMinor,

      epic_balance_minor
        AS epicBalanceMinor,

      genesis_balance_minor
        AS genesisBalanceMinor,

      rare_issued_supply
        AS rareIssuedSupply,

      epic_issued_supply
        AS epicIssuedSupply,

      genesis_issued_supply
        AS genesisIssuedSupply

    FROM reserve_snapshots

    ORDER BY
      captured_at DESC,
      created_at DESC

    LIMIT 1
  `).get() as
    | LatestSnapshotRow
    | undefined;
}

function tierAllocationBalances() {
  const rows =
    db.prepare(`
      SELECT
        beneficiary_tier
          AS tier,

        COALESCE(
          SUM(
            amount_minor
          ),
          0
        ) AS amountMinor

      FROM reserve_allocations

      GROUP BY
        beneficiary_tier
    `).all() as Array<{
      tier:
        "RARE" |
        "EPIC" |
        "GENESIS";

      amountMinor:
        number;
    }>;

  const result = {
    RARE:
      0n,

    EPIC:
      0n,

    GENESIS:
      0n,
  };

  for (
    const row of
      rows
  ) {
    result[
      row.tier
    ] =
      BigInt(
        row.amountMinor,
      );
  }

  return result;
}

function historicalIssuedSupply() {
  const row =
    db.prepare(`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN serial_number
                BETWEEN 1 AND 1000
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS rare,

        COALESCE(
          SUM(
            CASE
              WHEN serial_number
                BETWEEN 1001 AND 3000
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS epic,

        COALESCE(
          SUM(
            CASE
              WHEN serial_number
                BETWEEN 3001 AND 6000
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS genesis

      FROM inventory_allocations
    `).get() as {
      rare:
        number;

      epic:
        number;

      genesis:
        number;
    };

  return {
    RARE:
      Number(
        row.rare,
      ),

    EPIC:
      Number(
        row.epic,
      ),

    GENESIS:
      Number(
        row.genesis,
      ),
  };
}

export function runEconomicReconciliation() {
  const checks:
    ReconciliationCheck[] =
    [];

  /*
   * -------------------------------------------------------
   * 1. Every VERIFIED USDT settlement must have exactly
   *    one reserve contribution.
   * -------------------------------------------------------
   */
  const verifiedSettlements =
    countSum(`
      SELECT
        COUNT(*) AS count,

        COALESCE(
          SUM(amount_minor),
          0
        ) AS amountMinor

      FROM payment_settlements

      WHERE
        status = 'VERIFIED'
        AND payment_method = 'USDT'
    `);

  const missingContribution =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM payment_settlements ps

      LEFT JOIN reserve_contributions rc
        ON rc.settlement_id =
           ps.id

      WHERE
        ps.status = 'VERIFIED'
        AND ps.payment_method = 'USDT'
        AND rc.id IS NULL
    `).get() as {
      count:
        number;
    };

  checks.push({
    code:
      "VERIFIED_SETTLEMENT_HAS_RESERVE_CONTRIBUTION",

    severity:
      "CRITICAL",

    passed:
      Number(
        missingContribution.count,
      ) === 0,

    expected:
      0,

    actual:
      Number(
        missingContribution.count,
      ),

    detail:
      "Every verified USDT settlement must create a reserve contribution.",
  });

  /*
   * -------------------------------------------------------
   * 2. Contributions must never exist without a verified
   *    settlement authority.
   * -------------------------------------------------------
   */
  const orphanContributions =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM reserve_contributions rc

      LEFT JOIN payment_settlements ps
        ON ps.id =
           rc.settlement_id

      WHERE
        ps.id IS NULL
        OR ps.status != 'VERIFIED'
        OR ps.payment_method != 'USDT'
    `).get() as {
      count:
        number;
    };

  checks.push({
    code:
      "RESERVE_CONTRIBUTION_HAS_VERIFIED_SETTLEMENT",

    severity:
      "CRITICAL",

    passed:
      Number(
        orphanContributions.count,
      ) === 0,

    expected:
      0,

    actual:
      Number(
        orphanContributions.count,
      ),

    detail:
      "Reserve contributions require verified USDT settlement authority.",
  });

  /*
   * -------------------------------------------------------
   * 3. Reserve contribution arithmetic must equal 25%
   *    of the gross settlement amount.
   *
   * Integer minor units only.
   * -------------------------------------------------------
   */
  const invalidContributionMath =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM reserve_contributions

      WHERE
        reserve_bps != 2500

        OR (
          gross_amount_minor *
          reserve_bps
        ) != (
          reserve_amount_minor *
          10000
        )
    `).get() as {
      count:
        number;
    };

  checks.push({
    code:
      "RESERVE_CONTRIBUTION_MATH",

    severity:
      "CRITICAL",

    passed:
      Number(
        invalidContributionMath.count,
      ) === 0,

    expected:
      0,

    actual:
      Number(
        invalidContributionMath.count,
      ),

    detail:
      "Every reserve contribution must equal the canonical 25% obligation.",
  });

  /*
   * -------------------------------------------------------
   * 4. Waterfall allocations must reconcile exactly
   *    back to each contribution.
   * -------------------------------------------------------
   */
  const allocationMismatch =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM (
        SELECT
          rc.id,

          rc.reserve_amount_minor,

          COALESCE(
            SUM(
              ra.amount_minor
            ),
            0
          ) AS allocated_minor,

          COALESCE(
            SUM(
              ra.weight_bps
            ),
            0
          ) AS allocated_bps

        FROM reserve_contributions rc

        LEFT JOIN reserve_allocations ra
          ON ra.contribution_id =
             rc.id

        GROUP BY
          rc.id,
          rc.reserve_amount_minor

        HAVING
          allocated_minor !=
            rc.reserve_amount_minor

          OR allocated_bps !=
            10000
      )
    `).get() as {
      count:
        number;
    };

  checks.push({
    code:
      "RESERVE_WATERFALL_RECONCILES",

    severity:
      "CRITICAL",

    passed:
      Number(
        allocationMismatch.count,
      ) === 0,

    expected:
      0,

    actual:
      Number(
        allocationMismatch.count,
      ),

    detail:
      "Allocation amounts and weights must fully reconcile to each reserve contribution.",
  });

  /*
   * -------------------------------------------------------
   * 5. Sweep items must match their source contribution.
   * -------------------------------------------------------
   */
  const invalidSweepItems =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM reserve_sweep_items rsi

      JOIN reserve_contributions rc
        ON rc.id =
           rsi.contribution_id

      WHERE
        rsi.amount_minor !=
          rc.reserve_amount_minor
    `).get() as {
      count:
        number;
    };

  checks.push({
    code:
      "SWEEP_ITEM_MATCHES_CONTRIBUTION",

    severity:
      "CRITICAL",

    passed:
      Number(
        invalidSweepItems.count,
      ) === 0,

    expected:
      0,

    actual:
      Number(
        invalidSweepItems.count,
      ),

    detail:
      "A reserve sweep item must carry exactly its source reserve obligation.",
  });

  /*
   * -------------------------------------------------------
   * 6. Each sweep header must reconcile to its items.
   * -------------------------------------------------------
   */
  const invalidSweepHeaders =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM (
        SELECT
          rs.id,

          rs.amount_minor,

          rs.contribution_count,

          COALESCE(
            SUM(
              rsi.amount_minor
            ),
            0
          ) AS item_amount_minor,

          COUNT(
            rsi.id
          ) AS item_count

        FROM reserve_sweeps rs

        LEFT JOIN reserve_sweep_items rsi
          ON rsi.sweep_id =
             rs.id

        GROUP BY
          rs.id,
          rs.amount_minor,
          rs.contribution_count

        HAVING
          item_amount_minor !=
            rs.amount_minor

          OR item_count !=
            rs.contribution_count
      )
    `).get() as {
      count:
        number;
    };

  checks.push({
    code:
      "SWEEP_HEADER_RECONCILES_ITEMS",

    severity:
      "CRITICAL",

    passed:
      Number(
        invalidSweepHeaders.count,
      ) === 0,

    expected:
      0,

    actual:
      Number(
        invalidSweepHeaders.count,
      ),

    detail:
      "Sweep total and contribution count must exactly match its immutable source items.",
  });

  /*
   * -------------------------------------------------------
   * 7. OX-ECONOMIC-EXIT-1 cannot contain an authorized
   *    reserve debit/burn/redemption/denominator mutation.
   * -------------------------------------------------------
   */
  const unauthorizedExitAuthority =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM economic_exit_decisions

      WHERE
        exit_policy_version =
          'OX-ECONOMIC-EXIT-1'

        AND (
          reserve_debit_authorized != 0
          OR nav_denominator_changes != 0
          OR serial_reusable != 0
          OR burn_authorized != 0
          OR redemption_authorized != 0
        )
    `).get() as {
      count:
        number;
    };

  checks.push({
    code:
      "EXIT_POLICY_FAIL_CLOSED",

    severity:
      "CRITICAL",

    passed:
      Number(
        unauthorizedExitAuthority.count,
      ) === 0,

    expected:
      0,

    actual:
      Number(
        unauthorizedExitAuthority.count,
      ),

    detail:
      "OX-ECONOMIC-EXIT-1 must never authorize economic exit authority.",
  });

  const allocations =
    countSum(`
      SELECT
        COUNT(*) AS count,

        COALESCE(
          SUM(amount_minor),
          0
        ) AS amountMinor

      FROM reserve_allocations
    `);

  const contributions =
    countSum(`
      SELECT
        COUNT(*) AS count,

        COALESCE(
          SUM(reserve_amount_minor),
          0
        ) AS amountMinor

      FROM reserve_contributions
    `);

  /*
   * This is intentionally a global second-level check.
   */
  checks.push({
    code:
      "GLOBAL_ALLOCATIONS_EQUAL_RESERVE_OBLIGATIONS",

    severity:
      "CRITICAL",

    passed:
      allocations.amountMinor ===
      contributions.amountMinor,

    expected:
      contributions
        .amountMinor
        .toString(),

    actual:
      allocations
        .amountMinor
        .toString(),

    detail:
      "Total waterfall allocations must equal total reserve obligations.",
  });

  const tierBalances =
    tierAllocationBalances();

  const issuedSupply =
    historicalIssuedSupply();

  const snapshot =
    latestSnapshot();

  if (!snapshot) {
    checks.push({
      code:
        "LATEST_RESERVE_SNAPSHOT_AVAILABLE",

      severity:
        contributions.count ===
          0
          ? "WARNING"
          : "CRITICAL",

      passed:
        false,

      expected:
        "snapshot",

      actual:
        null,

      detail:
        contributions.count ===
          0
          ? "No snapshot exists yet; there are also no reserve obligations."
          : "Reserve obligations exist but no Proof-of-Reserve snapshot is available.",
    });
  } else {
    const totalLedger =
      tierBalances.RARE +
      tierBalances.EPIC +
      tierBalances.GENESIS;

    checks.push({
      code:
        "SNAPSHOT_TOTAL_LIABILITY_MATCHES_LEDGER",

      severity:
        "CRITICAL",

      passed:
        BigInt(
          snapshot
            .totalLiabilityMinor,
        ) ===
        totalLedger,

      expected:
        totalLedger
          .toString(),

      actual:
        BigInt(
          snapshot
            .totalLiabilityMinor,
        ).toString(),

      detail:
        "Latest snapshot liability must match the reserve allocation ledger.",
    });

    const snapshotTierChecks = [
      {
        tier:
          "RARE",

        snapshot:
          BigInt(
            snapshot
              .rareBalanceMinor,
          ),

        ledger:
          tierBalances.RARE,
      },

      {
        tier:
          "EPIC",

        snapshot:
          BigInt(
            snapshot
              .epicBalanceMinor,
          ),

        ledger:
          tierBalances.EPIC,
      },

      {
        tier:
          "GENESIS",

        snapshot:
          BigInt(
            snapshot
              .genesisBalanceMinor,
          ),

        ledger:
          tierBalances.GENESIS,
      },
    ] as const;

    for (
      const item of
        snapshotTierChecks
    ) {
      checks.push({
        code:
          `SNAPSHOT_${item.tier}_BALANCE_MATCHES_LEDGER`,

        severity:
          "CRITICAL",

        passed:
          item.snapshot ===
          item.ledger,

        expected:
          item.ledger
            .toString(),

        actual:
          item.snapshot
            .toString(),

        detail:
          `Latest ${item.tier} snapshot balance must match ledger allocations.`,
      });
    }

    const snapshotSupply = {
      RARE:
        Number(
          snapshot
            .rareIssuedSupply,
        ),

      EPIC:
        Number(
          snapshot
            .epicIssuedSupply,
        ),

      GENESIS:
        Number(
          snapshot
            .genesisIssuedSupply,
        ),
    };

    for (
      const tier of [
        "RARE",
        "EPIC",
        "GENESIS",
      ] as const
    ) {
      checks.push({
        code:
          `SNAPSHOT_${tier}_SUPPLY_MATCHES_HISTORY`,

        severity:
          "CRITICAL",

        passed:
          snapshotSupply[tier] ===
          issuedSupply[tier],

        expected:
          issuedSupply[tier],

        actual:
          snapshotSupply[tier],

        detail:
          `Latest ${tier} issued supply must match historical issued inventory.`,
      });
    }
  }

  /*
   * Confirmed sweeps are useful reconciliation evidence,
   * but are NOT required to equal current vault balance.
   *
   * The vault may contain legitimate external funding.
   */
  const confirmedSweeps =
    countSum(`
      SELECT
        COUNT(*) AS count,

        COALESCE(
          SUM(amount_minor),
          0
        ) AS amountMinor

      FROM reserve_sweeps

      WHERE status =
        'CONFIRMED'
    `);

  const criticalFailures =
    checks.filter(
      (
        check,
      ) =>
        !check.passed &&
        check.severity ===
          "CRITICAL",
    ).length;

  const warnings =
    checks.filter(
      (
        check,
      ) =>
        !check.passed &&
        check.severity ===
          "WARNING",
    ).length;

  return {
    reconciliationVersion:
      ECONOMIC_RECONCILIATION_VERSION,

    status:
      reconciliationSeverity(
        checks,
      ),

    reconciledAt:
      new Date()
        .toISOString(),

    navPolicy: {
      version:
        NAV_SUPPLY_POLICY_VERSION,

      supplyBasis:
        NAV_SUPPLY_BASIS,
    },

    summary: {
      criticalFailures,

      warnings,

      verifiedSettlementCount:
        verifiedSettlements.count,

      reserveContributionCount:
        contributions.count,

      reserveContributionMinor:
        contributions
          .amountMinor
          .toString(),

      reserveAllocationMinor:
        allocations
          .amountMinor
          .toString(),

      confirmedSweepCount:
        confirmedSweeps.count,

      confirmedSweepMinor:
        confirmedSweeps
          .amountMinor
          .toString(),
    },

    tierLedgerMinor: {
      RARE:
        tierBalances.RARE
          .toString(),

      EPIC:
        tierBalances.EPIC
          .toString(),

      GENESIS:
        tierBalances.GENESIS
          .toString(),
    },

    historicalIssuedSupply:
      issuedSupply,

    latestSnapshot:
      snapshot
        ? {
            snapshotHash:
              snapshot
                .snapshotHash,

            capturedAt:
              snapshot
                .capturedAt,

            totalLiabilityMinor:
              BigInt(
                snapshot
                  .totalLiabilityMinor,
              ).toString(),

            onchainBalanceMinor:
              BigInt(
                snapshot
                  .onchainBalanceMinor,
              ).toString(),
          }
        : null,

    /*
     * Explicit informational evidence.
     *
     * DO NOT interpret this as:
     * confirmedSweepMinor === onchainBalanceMinor
     */
    custodyEvidence: {
      confirmedSweepMinor:
        confirmedSweeps
          .amountMinor
          .toString(),

      latestObservedVaultBalanceMinor:
        snapshot
          ? BigInt(
              snapshot
                .onchainBalanceMinor,
            ).toString()
          : null,

      strictEqualityRequired:
        false,
    },

    checks,
  };
}
