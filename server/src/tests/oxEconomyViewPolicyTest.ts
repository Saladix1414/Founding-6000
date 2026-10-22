import {
  calculateEconomicGrowth,
  formatUsdtMinor,
} from "../economics/economyViewPolicy.js";

function expectEqual(
  actual:
    string | bigint | null,

  expected:
    string | bigint | null,

  label:
    string,
) {
  if (
    actual !== expected
  ) {
    throw new Error(
      `${label}: expected=${String(expected)} actual=${String(actual)}`,
    );
  }
}

expectEqual(
  formatUsdtMinor(
    50_000_000n,
  ),
  "50.000000",
  "50 USDT format",
);

expectEqual(
  formatUsdtMinor(
    12_500_000n,
  ),
  "12.500000",
  "12.50 USDT format",
);

expectEqual(
  formatUsdtMinor(
    -1_250_000n,
  ),
  "-1.250000",
  "negative USDT format",
);

const rare =
  calculateEconomicGrowth({
    baseMinor:
      12_500_000n,

    currentNavMinor:
      57_250_000n,
  });

expectEqual(
  rare.deltaMinor,
  44_750_000n,
  "RARE delta",
);

expectEqual(
  rare.growthBps,
  35_800n,
  "RARE growth bps",
);

const epic =
  calculateEconomicGrowth({
    baseMinor:
      5_250_000n,

    currentNavMinor:
      18_750_000n,
  });

expectEqual(
  epic.deltaMinor,
  13_500_000n,
  "EPIC delta",
);

expectEqual(
  epic.growthBps,
  25_714n,
  "EPIC growth bps",
);

const genesis =
  calculateEconomicGrowth({
    baseMinor:
      6_750_000n,

    currentNavMinor:
      6_750_000n,
  });

expectEqual(
  genesis.deltaMinor,
  0n,
  "GENESIS delta",
);

expectEqual(
  genesis.growthBps,
  0n,
  "GENESIS growth bps",
);

const unavailable =
  calculateEconomicGrowth({
    baseMinor:
      12_500_000n,

    currentNavMinor:
      null,
  });

expectEqual(
  unavailable.deltaMinor,
  null,
  "unavailable delta",
);

expectEqual(
  unavailable.growthBps,
  null,
  "unavailable growth",
);

console.log(
  "OX_ECONOMY_VIEW_POLICY=PASS",
);

console.log(
  "USDT_MINOR_FORMAT=PASS",
);

console.log(
  "RARE_GROWTH_MATH=PASS",
);

console.log(
  "EPIC_GROWTH_MATH=PASS",
);

console.log(
  "GENESIS_GROWTH_MATH=PASS",
);

console.log(
  "NULL_SNAPSHOT_HANDLING=PASS",
);
