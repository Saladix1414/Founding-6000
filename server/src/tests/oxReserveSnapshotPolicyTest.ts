import {
  buildReserveSnapshot,
} from "../economics/reserveSnapshotPolicy.js";

const snapshot =
  buildReserveSnapshot({
    capturedAt:
      "2026-10-21T00:00:00.000Z",

    network:
      "ethereum-mainnet",

    chainId:
      1,

    tokenContract:
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",

    vaultAddress:
      "0x1111111111111111111111111111111111111111",

    ledgerBalancesMinor: {
      RARE:
        57_250_000_000n,

      EPIC:
        37_500_000_000n,

      GENESIS:
        20_250_000_000n,
    },

    issuedSupply: {
      RARE:
        1000,

      EPIC:
        2000,

      GENESIS:
        3000,
    },

    onchainVaultBalanceMinor:
      115_000_000_000n,
  });

if (
  snapshot
    .ledger
    .totalLiabilityMinor !==
  "115000000000"
) {
  throw new Error(
    "TOTAL_LIABILITY_MISMATCH",
  );
}

if (
  snapshot
    .proof
    .onchainVaultBalanceMinor !==
  "115000000000"
) {
  throw new Error(
    "ONCHAIN_BALANCE_MISMATCH",
  );
}

if (
  snapshot
    .proof
    .coverageBps !==
  "10000"
) {
  throw new Error(
    "COVERAGE_BPS_MISMATCH",
  );
}

if (
  snapshot
    .proof
    .fullyCovered !==
  true
) {
  throw new Error(
    "FULL_COVERAGE_MISMATCH",
  );
}

if (
  snapshot
    .navMinorPerIssuedNft
    .RARE !==
  "57250000"
) {
  throw new Error(
    "RARE_NAV_MISMATCH",
  );
}

if (
  snapshot
    .navMinorPerIssuedNft
    .EPIC !==
  "18750000"
) {
  throw new Error(
    "EPIC_NAV_MISMATCH",
  );
}

if (
  snapshot
    .navMinorPerIssuedNft
    .GENESIS !==
  "6750000"
) {
  throw new Error(
    "GENESIS_NAV_MISMATCH",
  );
}

if (
  !snapshot
    .snapshotHash
    .startsWith(
      "sha256:",
    )
) {
  throw new Error(
    "SNAPSHOT_HASH_MISSING",
  );
}

const partial =
  buildReserveSnapshot({
    capturedAt:
      "2026-10-21T00:00:00.000Z",

    network:
      "ethereum-mainnet",

    chainId:
      1,

    tokenContract:
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",

    vaultAddress:
      "0x1111111111111111111111111111111111111111",

    ledgerBalancesMinor: {
      RARE:
        12_500_000n,

      EPIC:
        0n,

      GENESIS:
        0n,
    },

    issuedSupply: {
      RARE:
        1,

      EPIC:
        0,

      GENESIS:
        0,
    },

    onchainVaultBalanceMinor:
      12_500_000n,
  });

if (
  partial
    .navMinorPerIssuedNft
    .RARE !==
  "12500000"
) {
  throw new Error(
    "EARLY_RARE_NAV_MISMATCH",
  );
}

if (
  partial
    .navMinorPerIssuedNft
    .EPIC !==
  null
) {
  throw new Error(
    "UNISSUED_EPIC_NAV_NOT_NULL",
  );
}

console.log(
  "OX_RESERVE_SNAPSHOT_POLICY=PASS",
);

console.log(
  "PROOF_OF_RESERVE_100_PERCENT=PASS",
);

console.log(
  "RARE_FULL_NAV_USDT=57.25",
);

console.log(
  "EPIC_FULL_NAV_USDT=18.75",
);

console.log(
  "GENESIS_FULL_NAV_USDT=6.75",
);

console.log(
  "EARLY_RARE_0001_NAV_USDT=12.50",
);

console.log(
  "SNAPSHOT_HASH=PASS",
);
