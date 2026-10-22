import {
  calculateReserveContribution,
  FOUNDING_TIER_POLICIES,
  getFoundingTierPolicy,
} from "../economics/foundingEconomicsPolicy.js";

function assertEqual(
  actual:
    bigint | number | string,

  expected:
    bigint | number | string,

  label:
    string,
) {
  if (
    actual !== expected
  ) {
    throw new Error(
      `${label}: expected ${expected}, got ${actual}`,
    );
  }
}

assertEqual(
  getFoundingTierPolicy(
    1,
  ).tier,
  "RARE",
  "serial 1 tier",
);

assertEqual(
  getFoundingTierPolicy(
    1000,
  ).tier,
  "RARE",
  "serial 1000 tier",
);

assertEqual(
  getFoundingTierPolicy(
    1001,
  ).tier,
  "EPIC",
  "serial 1001 tier",
);

assertEqual(
  getFoundingTierPolicy(
    3000,
  ).tier,
  "EPIC",
  "serial 3000 tier",
);

assertEqual(
  getFoundingTierPolicy(
    3001,
  ).tier,
  "GENESIS",
  "serial 3001 tier",
);

assertEqual(
  getFoundingTierPolicy(
    6000,
  ).tier,
  "GENESIS",
  "serial 6000 tier",
);

const rare =
  calculateReserveContribution({
    serialNumber:
      1,

    grossAmountMinor:
      50_000_000n,
  });

assertEqual(
  rare.reserveAmountMinor,
  12_500_000n,
  "RARE reserve",
);

assertEqual(
  rare.allocations[0]
    ?.amountMinor ?? 0n,
  12_500_000n,
  "RARE to RARE",
);

const epic =
  calculateReserveContribution({
    serialNumber:
      1001,

    grossAmountMinor:
      70_000_000n,
  });

assertEqual(
  epic.reserveAmountMinor,
  17_500_000n,
  "EPIC reserve",
);

assertEqual(
  epic.allocations.find(
    (value) =>
      value.beneficiaryTier ===
      "RARE",
  )?.amountMinor ?? 0n,
  12_250_000n,
  "EPIC sale to RARE",
);

assertEqual(
  epic.allocations.find(
    (value) =>
      value.beneficiaryTier ===
      "EPIC",
  )?.amountMinor ?? 0n,
  5_250_000n,
  "EPIC sale to EPIC",
);

const genesis =
  calculateReserveContribution({
    serialNumber:
      3001,

    grossAmountMinor:
      90_000_000n,
  });

assertEqual(
  genesis.reserveAmountMinor,
  22_500_000n,
  "GENESIS reserve",
);

assertEqual(
  genesis.allocations.find(
    (value) =>
      value.beneficiaryTier ===
      "RARE",
  )?.amountMinor ?? 0n,
  6_750_000n,
  "GENESIS sale to RARE",
);

assertEqual(
  genesis.allocations.find(
    (value) =>
      value.beneficiaryTier ===
      "EPIC",
  )?.amountMinor ?? 0n,
  9_000_000n,
  "GENESIS sale to EPIC",
);

assertEqual(
  genesis.allocations.find(
    (value) =>
      value.beneficiaryTier ===
      "GENESIS",
  )?.amountMinor ?? 0n,
  6_750_000n,
  "GENESIS sale to GENESIS",
);

/*
 * Full-sale economic simulation.
 *
 * Values are USDT minor units:
 * 1 USDT = 1,000,000.
 */
let rareBucket =
  0n;

let epicBucket =
  0n;

let genesisBucket =
  0n;

let totalReserve =
  0n;

for (
  const policy of
    FOUNDING_TIER_POLICIES
) {
  const contribution =
    calculateReserveContribution({
      serialNumber:
        policy.serialStart,

      grossAmountMinor:
        policy.primaryPriceUsdtMinor,
    });

  totalReserve +=
    contribution
      .reserveAmountMinor *
    BigInt(
      policy.supply,
    );

  for (
    const allocation of
      contribution.allocations
  ) {
    const total =
      allocation.amountMinor *
      BigInt(
        policy.supply,
      );

    if (
      allocation.beneficiaryTier ===
      "RARE"
    ) {
      rareBucket += total;
    }

    if (
      allocation.beneficiaryTier ===
      "EPIC"
    ) {
      epicBucket += total;
    }

    if (
      allocation.beneficiaryTier ===
      "GENESIS"
    ) {
      genesisBucket += total;
    }
  }
}

assertEqual(
  totalReserve,
  115_000_000_000n,
  "total reserve at sellout",
);

assertEqual(
  rareBucket,
  57_250_000_000n,
  "RARE bucket at sellout",
);

assertEqual(
  epicBucket,
  37_500_000_000n,
  "EPIC bucket at sellout",
);

assertEqual(
  genesisBucket,
  20_250_000_000n,
  "GENESIS bucket at sellout",
);

assertEqual(
  rareBucket /
    1000n,
  57_250_000n,
  "RARE base NAV",
);

assertEqual(
  epicBucket /
    2000n,
  18_750_000n,
  "EPIC base NAV",
);

assertEqual(
  genesisBucket /
    3000n,
  6_750_000n,
  "GENESIS base NAV",
);

console.log(
  "OX_FOUNDING_ECONOMICS_POLICY=PASS",
);

console.log(
  "RARE_0001_1000=PASS",
);

console.log(
  "EPIC_1001_3000=PASS",
);

console.log(
  "GENESIS_3001_6000=PASS",
);

console.log(
  "RESERVE_RATE_25_PERCENT=PASS",
);

console.log(
  "SELL_OUT_RESERVE_USDT=115000",
);

console.log(
  "RARE_BUCKET_USDT=57250",
);

console.log(
  "EPIC_BUCKET_USDT=37500",
);

console.log(
  "GENESIS_BUCKET_USDT=20250",
);

console.log(
  "RARE_BASE_NAV_USDT=57.25",
);

console.log(
  "EPIC_BASE_NAV_USDT=18.75",
);

console.log(
  "GENESIS_BASE_NAV_USDT=6.75",
);
