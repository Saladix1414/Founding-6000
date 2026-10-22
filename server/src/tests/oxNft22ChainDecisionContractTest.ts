import {
  readFileSync,
} from "node:fs";

const decision =
  readFileSync(
    "docs/nft/OX-NFT-22-CHAIN-DECISION.md",
    "utf8",
  );

const benchmark =
  JSON.parse(
    readFileSync(
      "docs/nft/ox-nft-22-chain-benchmark.json",
      "utf8",
    ),
  ) as {
    scope: {
      mintCount:
        number;
    };

    measurement: {
      contractGasMeasured:
        boolean;

      conservativeBudgetGas:
        string;

      preferredChain:
        string;

      preferredTestnet:
        string;

      productionAuthorized:
        boolean;

      realFundsUsed:
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
  benchmark.scope.mintCount ===
    1000,
  "MINT_SCOPE_INVALID",
);

expect(
  benchmark
    .measurement
    .contractGasMeasured ===
    true,
  "CONTRACT_GAS_NOT_MEASURED",
);

expect(
  benchmark
    .measurement
    .conservativeBudgetGas ===
    "69666271",
  "CONSERVATIVE_GAS_BUDGET_INVALID",
);

expect(
  benchmark
    .measurement
    .preferredChain ===
    "BASE",
  "PREFERRED_CHAIN_INVALID",
);

expect(
  benchmark
    .measurement
    .preferredTestnet ===
    "BASE_SEPOLIA",
  "PREFERRED_TESTNET_INVALID",
);

expect(
  benchmark
    .measurement
    .productionAuthorized ===
    false,
  "PRODUCTION_UNEXPECTEDLY_AUTHORIZED",
);

expect(
  benchmark
    .measurement
    .realFundsUsed ===
    false,
  "REAL_FUNDS_UNEXPECTED",
);

for (
  const boundary of [
    "MINTER != ADMIN",
    "MINTER != RESERVE VAULT",
    "RESERVE != GAS TREASURY",
    "TESTNET RESULT != MAINNET APPROVAL",
    "MAINNET DEPLOYMENT REQUIRES EXPLICIT ACTIVATION",
  ]
) {
  expect(
    decision.includes(
      boundary,
    ),
    `BOUNDARY_MISSING:${boundary}`,
  );
}

console.log(
  "OX_NFT_22_CHAIN_DECISION_CONTRACT=PASS",
);

console.log(
  "PREFERRED_CHAIN=BASE",
);

console.log(
  "PREFERRED_TESTNET=BASE_SEPOLIA",
);

console.log(
  "TARGET_MINTS=1000",
);

console.log(
  "CONSERVATIVE_GAS_BUDGET=69666271",
);

console.log(
  "PRODUCTION_AUTHORIZED=NO",
);

console.log(
  "REAL_FUNDS_USED=NO",
);
