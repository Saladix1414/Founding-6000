import {
  db,
} from "../db/database.js";

import {
  getFoundingTierPolicy,
  type FoundingCollectionTier,
} from "../economics/foundingEconomicsPolicy.js";

import {
  ECONOMY_VIEW_VERSION,
  calculateEconomicGrowth,
  formatUsdtMinor,
} from "../economics/economyViewPolicy.js";

type ContributionRow = {
  id:
    string;

  serialNumber:
    number;

  saleTier:
    FoundingCollectionTier;

  grossAmountMinor:
    number;

  reserveAmountMinor:
    number;

  reserveBps:
    number;

  economicModelVersion:
    string;

  waterfallVersion:
    string;

  createdAt:
    string;
};

type AllocationRow = {
  beneficiaryTier:
    FoundingCollectionTier;

  amountMinor:
    number;

  weightBps:
    number;
};

type SnapshotRow = {
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

function latestSnapshot() {
  return db.prepare(`
    SELECT
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

    ORDER BY
      captured_at DESC,
      created_at DESC

    LIMIT 1
  `).get() as
    | SnapshotRow
    | undefined;
}

function snapshotTierView(
  snapshot:
    SnapshotRow,

  tier:
    FoundingCollectionTier,
) {
  if (
    tier === "RARE"
  ) {
    return {
      reserveBalanceMinor:
        BigInt(
          snapshot.rareBalanceMinor,
        ),

      issuedSupply:
        Number(
          snapshot.rareIssuedSupply,
        ),

      navMinor:
        snapshot.rareNavMinor ===
          null
          ? null
          : BigInt(
              snapshot.rareNavMinor,
            ),
    };
  }

  if (
    tier === "EPIC"
  ) {
    return {
      reserveBalanceMinor:
        BigInt(
          snapshot.epicBalanceMinor,
        ),

      issuedSupply:
        Number(
          snapshot.epicIssuedSupply,
        ),

      navMinor:
        snapshot.epicNavMinor ===
          null
          ? null
          : BigInt(
              snapshot.epicNavMinor,
            ),
    };
  }

  return {
    reserveBalanceMinor:
      BigInt(
        snapshot.genesisBalanceMinor,
      ),

    issuedSupply:
      Number(
        snapshot.genesisIssuedSupply,
      ),

    navMinor:
      snapshot.genesisNavMinor ===
        null
        ? null
        : BigInt(
            snapshot.genesisNavMinor,
          ),
  };
}

export function getTokenEconomy(
  tokenId:
    number,
) {
  const policy =
    getFoundingTierPolicy(
      tokenId,
    );

  const contribution =
    db.prepare(`
      SELECT
        id,

        serial_number
          AS serialNumber,

        sale_tier
          AS saleTier,

        gross_amount_minor
          AS grossAmountMinor,

        reserve_amount_minor
          AS reserveAmountMinor,

        reserve_bps
          AS reserveBps,

        economic_model_version
          AS economicModelVersion,

        waterfall_version
          AS waterfallVersion,

        created_at
          AS createdAt

      FROM reserve_contributions

      WHERE serial_number = ?

      LIMIT 1
    `).get(
      tokenId,
    ) as
      | ContributionRow
      | undefined;

  if (!contribution) {
    return null;
  }

  /*
   * The authoritative economic baseline for growth
   * is the amount from this purchase allocated to
   * its own commercial tier.
   *
   * This avoids treating the entire 25% reserve
   * contribution as belonging to EPIC or GENESIS
   * when their waterfalls also fund earlier tiers.
   */
  const ownTierAllocation =
    db.prepare(`
      SELECT
        beneficiary_tier
          AS beneficiaryTier,

        amount_minor
          AS amountMinor,

        weight_bps
          AS weightBps

      FROM reserve_allocations

      WHERE
        contribution_id = ?
        AND beneficiary_tier = ?

      LIMIT 1
    `).get(
      contribution.id,
      contribution.saleTier,
    ) as
      | AllocationRow
      | undefined;

  if (
    !ownTierAllocation
  ) {
    throw new Error(
      "TOKEN_OWN_TIER_ALLOCATION_MISSING",
    );
  }

  const snapshot =
    latestSnapshot();

  const baseMinor =
    BigInt(
      ownTierAllocation.amountMinor,
    );

  const tierSnapshot =
    snapshot
      ? snapshotTierView(
          snapshot,
          contribution.saleTier,
        )
      : null;

  const growth =
    calculateEconomicGrowth({
      baseMinor,

      currentNavMinor:
        tierSnapshot
          ?.navMinor ??
        null,
    });

  const proofStatus =
    !snapshot
      ? "UNAVAILABLE"
      : Boolean(
          snapshot.fullyCovered,
        )
        ? "VERIFIED"
        : "NOT_FULLY_COVERED";

  return {
    viewVersion:
      ECONOMY_VIEW_VERSION,

    tokenId,

    serialNumber:
      tokenId,

    collectionTier:
      contribution.saleTier,

    tierPolicy: {
      wave:
        policy.wave,

      serialStart:
        policy.serialStart,

      serialEnd:
        policy.serialEnd,

      supply:
        policy.supply,

      canonicalPrimaryPriceMinor:
        policy
          .primaryPriceUsdtMinor
          .toString(),

      canonicalPrimaryPriceUsdt:
        formatUsdtMinor(
          policy.primaryPriceUsdtMinor,
        ),
    },

    acquisition: {
      amountMinor:
        BigInt(
          contribution
            .grossAmountMinor,
        ).toString(),

      amountUsdt:
        formatUsdtMinor(
          BigInt(
            contribution
              .grossAmountMinor,
          ),
        ),

      settledAt:
        contribution.createdAt,
    },

    reserveContribution: {
      totalMinor:
        BigInt(
          contribution
            .reserveAmountMinor,
        ).toString(),

      totalUsdt:
        formatUsdtMinor(
          BigInt(
            contribution
              .reserveAmountMinor,
          ),
        ),

      reserveBps:
        contribution.reserveBps,

      economicModelVersion:
        contribution
          .economicModelVersion,

      waterfallVersion:
        contribution
          .waterfallVersion,
    },

    tierBaseAllocation: {
      amountMinor:
        baseMinor.toString(),

      amountUsdt:
        formatUsdtMinor(
          baseMinor,
        ),

      weightBps:
        ownTierAllocation
          .weightBps,
    },

    current: tierSnapshot
      ? {
          reserveBalanceMinor:
            tierSnapshot
              .reserveBalanceMinor
              .toString(),

          reserveBalanceUsdt:
            formatUsdtMinor(
              tierSnapshot
                .reserveBalanceMinor,
            ),

          issuedSupply:
            tierSnapshot
              .issuedSupply,

          navMinor:
            tierSnapshot.navMinor
              ?.toString() ??
            null,

          navUsdt:
            tierSnapshot.navMinor ===
              null
              ? null
              : formatUsdtMinor(
                  tierSnapshot
                    .navMinor,
                ),

          growthDeltaMinor:
            growth.deltaMinor
              ?.toString() ??
            null,

          growthDeltaUsdt:
            growth.deltaMinor ===
              null
              ? null
              : formatUsdtMinor(
                  growth.deltaMinor,
                ),

          growthBps:
            growth.growthBps
              ?.toString() ??
            null,
        }
      : null,

    proofOfReserve: snapshot
      ? {
          status:
            proofStatus,

          snapshotVersion:
            snapshot
              .snapshotVersion,

          snapshotHash:
            snapshot
              .snapshotHash,

          capturedAt:
            snapshot
              .capturedAt,

          network:
            snapshot.network,

          chainId:
            snapshot.chainId,

          tokenContract:
            snapshot
              .tokenContract,

          vaultAddress:
            snapshot
              .vaultAddress,

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

          coverageBps:
            snapshot.coverageBps,

          fullyCovered:
            Boolean(
              snapshot
                .fullyCovered,
            ),
        }
      : {
          status:
            proofStatus,

          snapshotVersion:
            null,

          snapshotHash:
            null,

          capturedAt:
            null,

          network:
            null,

          chainId:
            null,

          tokenContract:
            null,

          vaultAddress:
            null,

          totalLiabilityMinor:
            null,

          onchainBalanceMinor:
            null,

          surplusDeficitMinor:
            null,

          coverageBps:
            null,

          fullyCovered:
            false,
        },
  };
}
