import {
  readFileSync,
} from "node:fs";

const canon =
  readFileSync(
    "docs/nft/OX-NFT-22-FIRST-1000-INFRASTRUCTURE.md",
    "utf8",
  );

const benchmark =
  JSON.parse(
    readFileSync(
      "docs/nft/ox-nft-22-chain-benchmark.json",
      "utf8",
    ),
  ) as {
    version:
      string;

    scope: {
      tier:
        string;

      serialStart:
        number;

      serialEnd:
        number;

      mintCount:
        number;
    };

    developmentPolicy: {
      zeroCash:
        boolean;

      mainnetExecutionAuthorized:
        boolean;
    };

    storage: {
      strategy:
        string;

      databaseStoresCanonicalImageBlobs:
        boolean;

      r2RequiredAtLaunch:
        boolean;
    };

    candidates:
      Array<{
        chain:
          string;
      }>;

    measurement: {
      contractGasMeasured:
        boolean;

      winner?:
        string |
        null;

      preferredChain?:
        string |
        null;

      productionAuthorized?:
        boolean;
    };
  };

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

expect(
  benchmark.version ===
    "OX-NFT-CHAIN-BENCHMARK-1",
  "BENCHMARK_VERSION_INVALID",
);

expect(
  benchmark.scope.tier ===
    "RARE",
  "TARGET_TIER_INVALID",
);

expect(
  benchmark.scope.serialStart ===
    1 &&
  benchmark.scope.serialEnd ===
    1000 &&
  benchmark.scope.mintCount ===
    1000,
  "FIRST_1000_SCOPE_INVALID",
);

expect(
  benchmark
    .developmentPolicy
    .zeroCash ===
    true,
  "ZERO_CASH_POLICY_MISSING",
);

expect(
  benchmark
    .developmentPolicy
    .mainnetExecutionAuthorized ===
    false,
  "MAINNET_EXECUTION_UNEXPECTEDLY_AUTHORIZED",
);

expect(
  benchmark.storage.strategy ===
    "SELF_HOST_FIRST",
  "SELF_HOST_POLICY_INVALID",
);

expect(
  benchmark
    .storage
    .databaseStoresCanonicalImageBlobs ===
    false,
  "DATABASE_IMAGE_BLOB_POLICY_INVALID",
);

expect(
  benchmark
    .storage
    .r2RequiredAtLaunch ===
    false,
  "R2_UNEXPECTEDLY_REQUIRED",
);

const chains =
  benchmark.candidates.map(
    (candidate) =>
      candidate.chain,
  );

for (
  const chain of [
    "BASE",
    "POLYGON_POS",
    "ARBITRUM_ONE",
  ]
) {
  expect(
    chains.includes(
      chain,
    ),
    `CHAIN_MISSING:${chain}`,
  );
}

if (
  benchmark
    .measurement
    .contractGasMeasured ===
    false
) {
  expect(
    (
      benchmark
        .measurement
        .winner ??
      null
    ) ===
      null &&
    (
      benchmark
        .measurement
        .preferredChain ??
      null
    ) ===
      null,
    "CHAIN_WINNER_DECLARED_BEFORE_MEASUREMENT",
  );
}

expect(
  benchmark
    .measurement
    .productionAuthorized !==
    true,
  "PRODUCTION_UNEXPECTEDLY_AUTHORIZED",
);

for (
  const boundary of [
    "PAYMENT != MINT AUTHORITY",
    "NFT MINT != RESERVE AUTHORITY",
    "RESERVE != MINTER GAS WALLET",
    "TESTNET RESULT != MAINNET APPROVAL",
  ]
) {
  expect(
    canon.includes(
      boundary,
    ),
    `SAFETY_BOUNDARY_MISSING:${boundary}`,
  );
}

console.log(
  "OX_NFT_22_INFRASTRUCTURE_CONTRACT=PASS",
);

console.log(
  "TARGET_MINTS=1000",
);

console.log(
  "SELF_HOST_FIRST=YES",
);

console.log(
  "ZERO_CASH_DEVELOPMENT=YES",
);

console.log(
  "CHAIN_SELECTION_PHASE_TRANSITION=PASS",
);

console.log(
  "PRODUCTION_AUTHORIZED=NO",
);

console.log(
  "MAINNET_EXECUTION_AUTHORIZED=NO",
);
