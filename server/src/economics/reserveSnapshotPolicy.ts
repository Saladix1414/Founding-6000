import type {
  FoundingCollectionTier,
} from "./foundingEconomicsPolicy.js";

import {
  economicSha256,
} from "./economicCanonical.js";

export const RESERVE_SNAPSHOT_VERSION =
  "OX-RESERVE-SNAPSHOT-1";

export const USDT_MINOR_SCALE =
  1_000_000n;

export type TierMinorBalances =
  Record<
    FoundingCollectionTier,
    bigint
  >;

export type TierIssuedSupply =
  Record<
    FoundingCollectionTier,
    number
  >;

export type ReserveSnapshotInput = {
  capturedAt:
    string;

  chainId:
    number;

  network:
    string;

  tokenContract:
    string;

  vaultAddress:
    string;

  ledgerBalancesMinor:
    TierMinorBalances;

  issuedSupply:
    TierIssuedSupply;

  onchainVaultBalanceMinor:
    bigint;
};

function navMinor(
  balance:
    bigint,

  issued:
    number,
) {
  if (
    !Number.isInteger(
      issued,
    ) ||
    issued < 0
  ) {
    throw new Error(
      "INVALID_ISSUED_SUPPLY",
    );
  }

  if (
    issued === 0
  ) {
    return null;
  }

  return (
    balance /
    BigInt(
      issued,
    )
  );
}

export function buildReserveSnapshot(
  input:
    ReserveSnapshotInput,
) {
  const totalLedgerMinor =
    input
      .ledgerBalancesMinor
      .RARE +
    input
      .ledgerBalancesMinor
      .EPIC +
    input
      .ledgerBalancesMinor
      .GENESIS;

  const surplusDeficitMinor =
    input
      .onchainVaultBalanceMinor -
    totalLedgerMinor;

  const coverageBps =
    totalLedgerMinor ===
      0n
      ? null
      : (
          input
            .onchainVaultBalanceMinor *
          10_000n
        ) /
        totalLedgerMinor;

  const body = {
    snapshotVersion:
      RESERVE_SNAPSHOT_VERSION,

    capturedAt:
      input.capturedAt,

    network: {
      name:
        input.network,

      chainId:
        input.chainId,

      tokenContract:
        input.tokenContract,

      vaultAddress:
        input.vaultAddress,
    },

    ledger: {
      totalLiabilityMinor:
        totalLedgerMinor
          .toString(),

      balancesMinor: {
        RARE:
          input
            .ledgerBalancesMinor
            .RARE
            .toString(),

        EPIC:
          input
            .ledgerBalancesMinor
            .EPIC
            .toString(),

        GENESIS:
          input
            .ledgerBalancesMinor
            .GENESIS
            .toString(),
      },
    },

    proof: {
      onchainVaultBalanceMinor:
        input
          .onchainVaultBalanceMinor
          .toString(),

      surplusDeficitMinor:
        surplusDeficitMinor
          .toString(),

      coverageBps:
        coverageBps === null
          ? null
          : coverageBps.toString(),

      fullyCovered:
        input
          .onchainVaultBalanceMinor >=
        totalLedgerMinor,
    },

    issuedSupply: {
      RARE:
        input
          .issuedSupply
          .RARE,

      EPIC:
        input
          .issuedSupply
          .EPIC,

      GENESIS:
        input
          .issuedSupply
          .GENESIS,
    },

    navMinorPerIssuedNft: {
      RARE:
        navMinor(
          input
            .ledgerBalancesMinor
            .RARE,

          input
            .issuedSupply
            .RARE,
        )?.toString() ??
        null,

      EPIC:
        navMinor(
          input
            .ledgerBalancesMinor
            .EPIC,

          input
            .issuedSupply
            .EPIC,
        )?.toString() ??
        null,

      GENESIS:
        navMinor(
          input
            .ledgerBalancesMinor
            .GENESIS,

          input
            .issuedSupply
            .GENESIS,
        )?.toString() ??
        null,
    },
  };

  return {
    ...body,

    snapshotHash:
      economicSha256(
        body,
      ),
  };
}
