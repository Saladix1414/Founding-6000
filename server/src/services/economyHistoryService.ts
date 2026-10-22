import {
  db,
} from "../db/database.js";

import {
  type FoundingCollectionTier,
} from "../economics/foundingEconomicsPolicy.js";

import {
  calculateEconomicGrowth,
  formatUsdtMinor,
} from "../economics/economyViewPolicy.js";

import {
  NAV_SUPPLY_BASIS,
  NAV_SUPPLY_POLICY_VERSION,
} from "../economics/navSupplyPolicy.js";

export const ECONOMY_HISTORY_VERSION =
  "OX-ECONOMY-HISTORY-1";

type ContributionContextRow = {
  contributionId:
    string;

  saleTier:
    FoundingCollectionTier;

  ownTierBaseMinor:
    number;

  createdAt:
    string;
};

type SnapshotCursorRow = {
  id:
    string;

  capturedAt:
    string;
};

type HistorySnapshotRow = {
  id:
    string;

  snapshotVersion:
    string;

  snapshotHash:
    string;

  capturedAt:
    string;

  network:
    string;

  chainId:
    number;

  tokenContract:
    string;

  vaultAddress:
    string;

  totalLiabilityMinor:
    number;

  onchainBalanceMinor:
    number;

  surplusDeficitMinor:
    number;

  coverageBps:
    string | null;

  fullyCovered:
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

  rareNavMinor:
    string | null;

  epicNavMinor:
    string | null;

  genesisNavMinor:
    string | null;
};

function getContributionContext(
  tokenId:
    number,
) {
  return db.prepare(`
    SELECT
      rc.id AS contributionId,

      rc.sale_tier AS saleTier,

      ra.amount_minor
        AS ownTierBaseMinor,

      rc.created_at
        AS createdAt

    FROM reserve_contributions rc

    JOIN reserve_allocations ra
      ON ra.contribution_id =
         rc.id

     AND ra.beneficiary_tier =
         rc.sale_tier

    WHERE rc.serial_number = ?

    LIMIT 1
  `).get(
    tokenId,
  ) as
    | ContributionContextRow
    | undefined;
}

function tierSnapshotView(
  snapshot:
    HistorySnapshotRow,

  tier:
    FoundingCollectionTier,
) {
  if (
    tier === "RARE"
  ) {
    return {
      reserveBalanceMinor:
        BigInt(
          snapshot
            .rareBalanceMinor,
        ),

      issuedSupply:
        Number(
          snapshot
            .rareIssuedSupply,
        ),

      navMinor:
        snapshot
          .rareNavMinor ===
          null
          ? null
          : BigInt(
              snapshot
                .rareNavMinor,
            ),
    };
  }

  if (
    tier === "EPIC"
  ) {
    return {
      reserveBalanceMinor:
        BigInt(
          snapshot
            .epicBalanceMinor,
        ),

      issuedSupply:
        Number(
          snapshot
            .epicIssuedSupply,
        ),

      navMinor:
        snapshot
          .epicNavMinor ===
          null
          ? null
          : BigInt(
              snapshot
                .epicNavMinor,
            ),
    };
  }

  return {
    reserveBalanceMinor:
      BigInt(
        snapshot
          .genesisBalanceMinor,
      ),

    issuedSupply:
      Number(
        snapshot
          .genesisIssuedSupply,
      ),

    navMinor:
      snapshot
        .genesisNavMinor ===
        null
        ? null
        : BigInt(
            snapshot
              .genesisNavMinor,
          ),
  };
}

function resolveCursor(
  cursor:
    string,
) {
  const row =
    db.prepare(`
      SELECT
        id,

        captured_at
          AS capturedAt

      FROM reserve_snapshots

      WHERE snapshot_hash = ?

      LIMIT 1
    `).get(
      cursor,
    ) as
      | SnapshotCursorRow
      | undefined;

  if (!row) {
    throw new Error(
      "ECONOMY_HISTORY_CURSOR_NOT_FOUND",
    );
  }

  return row;
}

export function getTokenEconomyHistory(
  input: {
    tokenId:
      number;

    limit:
      number;

    cursor?:
      string | null;
  },
) {
  const context =
    getContributionContext(
      input.tokenId,
    );

  if (!context) {
    return null;
  }

  const limit =
    Math.max(
      1,
      Math.min(
        100,
        Math.trunc(
          input.limit,
        ),
      ),
    );

  const cursor =
    input.cursor
      ? resolveCursor(
          input.cursor,
        )
      : null;

  const rows =
    (
      cursor
        ? db.prepare(`
            SELECT
              id,

              snapshot_version
                AS snapshotVersion,

              snapshot_hash
                AS snapshotHash,

              captured_at
                AS capturedAt,

              network,

              chain_id
                AS chainId,

              token_contract
                AS tokenContract,

              vault_address
                AS vaultAddress,

              total_liability_minor
                AS totalLiabilityMinor,

              onchain_balance_minor
                AS onchainBalanceMinor,

              surplus_deficit_minor
                AS surplusDeficitMinor,

              coverage_bps
                AS coverageBps,

              fully_covered
                AS fullyCovered,

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
                AS genesisIssuedSupply,

              rare_nav_minor
                AS rareNavMinor,

              epic_nav_minor
                AS epicNavMinor,

              genesis_nav_minor
                AS genesisNavMinor

            FROM reserve_snapshots

            WHERE
              captured_at >= ?

              AND (
                captured_at < ?

                OR (
                  captured_at = ?
                  AND id < ?
                )
              )

            ORDER BY
              captured_at DESC,
              id DESC

            LIMIT ?
          `).all(
            context.createdAt,
            cursor.capturedAt,
            cursor.capturedAt,
            cursor.id,
            limit + 1,
          )
        : db.prepare(`
            SELECT
              id,

              snapshot_version
                AS snapshotVersion,

              snapshot_hash
                AS snapshotHash,

              captured_at
                AS capturedAt,

              network,

              chain_id
                AS chainId,

              token_contract
                AS tokenContract,

              vault_address
                AS vaultAddress,

              total_liability_minor
                AS totalLiabilityMinor,

              onchain_balance_minor
                AS onchainBalanceMinor,

              surplus_deficit_minor
                AS surplusDeficitMinor,

              coverage_bps
                AS coverageBps,

              fully_covered
                AS fullyCovered,

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
                AS genesisIssuedSupply,

              rare_nav_minor
                AS rareNavMinor,

              epic_nav_minor
                AS epicNavMinor,

              genesis_nav_minor
                AS genesisNavMinor

            FROM reserve_snapshots

            WHERE
              captured_at >= ?

            ORDER BY
              captured_at DESC,
              id DESC

            LIMIT ?
          `).all(
            context.createdAt,
            limit + 1,
          )
    ) as HistorySnapshotRow[];

  const hasMore =
    rows.length >
    limit;

  const pageRows =
    hasMore
      ? rows.slice(
          0,
          limit,
        )
      : rows;

  const baseMinor =
    BigInt(
      context
        .ownTierBaseMinor,
    );

  const items =
    pageRows.map(
      (
        snapshot,
      ) => {
        const tier =
          tierSnapshotView(
            snapshot,
            context.saleTier,
          );

        const growth =
          calculateEconomicGrowth({
            baseMinor,

            currentNavMinor:
              tier.navMinor,
          });

        return {
          snapshotVersion:
            snapshot
              .snapshotVersion,

          snapshotHash:
            snapshot
              .snapshotHash,

          capturedAt:
            snapshot
              .capturedAt,

          tier:
            context.saleTier,

          reserve: {
            balanceMinor:
              tier
                .reserveBalanceMinor
                .toString(),

            balanceUsdt:
              formatUsdtMinor(
                tier
                  .reserveBalanceMinor,
              ),

            issuedSupply:
              tier
                .issuedSupply,

            navMinor:
              tier.navMinor
                ?.toString() ??
              null,

            navUsdt:
              tier.navMinor ===
                null
                ? null
                : formatUsdtMinor(
                    tier
                      .navMinor,
                  ),
          },

          growth: {
            baseMinor:
              baseMinor
                .toString(),

            baseUsdt:
              formatUsdtMinor(
                baseMinor,
              ),

            deltaMinor:
              growth
                .deltaMinor
                ?.toString() ??
              null,

            deltaUsdt:
              growth
                .deltaMinor ===
                null
                ? null
                : formatUsdtMinor(
                    growth
                      .deltaMinor,
                  ),

            growthBps:
              growth
                .growthBps
                ?.toString() ??
              null,
          },

          proofOfReserve: {
            status:
              Boolean(
                snapshot
                  .fullyCovered,
              )
                ? "VERIFIED"
                : "NOT_FULLY_COVERED",

            coverageBps:
              snapshot
                .coverageBps,

            fullyCovered:
              Boolean(
                snapshot
                  .fullyCovered,
              ),

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

            surplusDeficitMinor:
              BigInt(
                snapshot
                  .surplusDeficitMinor,
              ).toString(),

            network:
              snapshot
                .network,

            chainId:
              snapshot
                .chainId,

            tokenContract:
              snapshot
                .tokenContract,

            vaultAddress:
              snapshot
                .vaultAddress,
          },
        };
      },
    );

  const last =
    pageRows[
      pageRows.length - 1
    ];

  return {
    historyVersion:
      ECONOMY_HISTORY_VERSION,

    tokenId:
      input.tokenId,

    collectionTier:
      context.saleTier,

    navPolicy: {
      version:
        NAV_SUPPLY_POLICY_VERSION,

      supplyBasis:
        NAV_SUPPLY_BASIS,
    },

    order:
      "DESC" as const,

    pagination: {
      limit,

      hasMore,

      nextCursor:
        hasMore &&
        last
          ? last.snapshotHash
          : null,
    },

    items,
  };
}
