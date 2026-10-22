export const ECONOMY_VIEW_VERSION =
  "OX-ECONOMY-VIEW-1";

export const USDT_MINOR_SCALE =
  1_000_000n;

export function formatUsdtMinor(
  amountMinor:
    bigint,
) {
  const negative =
    amountMinor < 0n;

  const absolute =
    negative
      ? -amountMinor
      : amountMinor;

  const whole =
    absolute /
    USDT_MINOR_SCALE;

  const fraction =
    (
      absolute %
      USDT_MINOR_SCALE
    )
      .toString()
      .padStart(
        6,
        "0",
      );

  return (
    negative
      ? "-"
      : ""
  ) +
    whole.toString() +
    "." +
    fraction;
}

export function calculateEconomicGrowth(
  input: {
    baseMinor:
      bigint;

    currentNavMinor:
      bigint | null;
  },
) {
  if (
    input.baseMinor <= 0n
  ) {
    return {
      deltaMinor:
        null,

      growthBps:
        null,
    };
  }

  if (
    input.currentNavMinor ===
      null
  ) {
    return {
      deltaMinor:
        null,

      growthBps:
        null,
    };
  }

  const deltaMinor =
    input.currentNavMinor -
    input.baseMinor;

  const growthBps =
    (
      deltaMinor *
      10_000n
    ) /
    input.baseMinor;

  return {
    deltaMinor,

    growthBps,
  };
}
