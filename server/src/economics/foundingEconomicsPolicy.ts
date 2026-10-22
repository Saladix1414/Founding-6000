export type FoundingCollectionTier =
  | "RARE"
  | "EPIC"
  | "GENESIS";

export const FOUNDING_MAX_SUPPLY =
  6000;

export const RESERVE_CONTRIBUTION_BPS =
  2500;

export const BPS_SCALE =
  10_000;

export type FoundingTierPolicy = {
  tier:
    FoundingCollectionTier;

  wave: number;

  serialStart: number;
  serialEnd: number;

  supply: number;

  primaryPriceUsdtMinor:
    bigint;

  waterfallBps:
    Readonly<
      Partial<
        Record<
          FoundingCollectionTier,
          number
        >
      >
    >;
};

export const FOUNDING_TIER_POLICIES:
  readonly FoundingTierPolicy[] = [
    {
      tier:
        "RARE",

      wave:
        1,

      serialStart:
        1,

      serialEnd:
        1000,

      supply:
        1000,

      primaryPriceUsdtMinor:
        50_000_000n,

      waterfallBps: {
        RARE:
          10_000,
      },
    },

    {
      tier:
        "EPIC",

      wave:
        2,

      serialStart:
        1001,

      serialEnd:
        3000,

      supply:
        2000,

      primaryPriceUsdtMinor:
        70_000_000n,

      waterfallBps: {
        RARE:
          7000,

        EPIC:
          3000,
      },
    },

    {
      tier:
        "GENESIS",

      wave:
        3,

      serialStart:
        3001,

      serialEnd:
        6000,

      supply:
        3000,

      primaryPriceUsdtMinor:
        90_000_000n,

      waterfallBps: {
        RARE:
          3000,

        EPIC:
          4000,

        GENESIS:
          3000,
      },
    },
  ] as const;

export function getFoundingTierPolicy(
  serialNumber:
    number,
): FoundingTierPolicy {
  if (
    !Number.isInteger(
      serialNumber,
    ) ||
    serialNumber < 1 ||
    serialNumber >
      FOUNDING_MAX_SUPPLY
  ) {
    throw new Error(
      "INVALID_FOUNDING_SERIAL",
    );
  }

  const policy =
    FOUNDING_TIER_POLICIES
      .find(
        (candidate) =>
          serialNumber >=
            candidate.serialStart &&
          serialNumber <=
            candidate.serialEnd,
      );

  if (!policy) {
    throw new Error(
      "FOUNDING_TIER_NOT_FOUND",
    );
  }

  return policy;
}

function exactBpsAmount(
  amountMinor:
    bigint,

  bps:
    number,
) {
  if (
    amountMinor < 0n
  ) {
    throw new Error(
      "NEGATIVE_ECONOMIC_AMOUNT",
    );
  }

  if (
    !Number.isInteger(
      bps,
    ) ||
    bps < 0 ||
    bps > BPS_SCALE
  ) {
    throw new Error(
      "INVALID_BPS",
    );
  }

  const numerator =
    amountMinor *
    BigInt(
      bps,
    );

  if (
    numerator %
      BigInt(
        BPS_SCALE,
      ) !==
    0n
  ) {
    throw new Error(
      "NON_EXACT_BPS_ALLOCATION",
    );
  }

  return (
    numerator /
    BigInt(
      BPS_SCALE,
    )
  );
}

export type ReserveAllocation = {
  beneficiaryTier:
    FoundingCollectionTier;

  weightBps:
    number;

  amountMinor:
    bigint;
};

export type ReserveContribution = {
  saleTier:
    FoundingCollectionTier;

  wave:
    number;

  grossAmountMinor:
    bigint;

  reserveBps:
    number;

  reserveAmountMinor:
    bigint;

  allocations:
    readonly ReserveAllocation[];
};

export function calculateReserveContribution(
  input: {
    serialNumber:
      number;

    grossAmountMinor:
      bigint;
  },
): ReserveContribution {
  const policy =
    getFoundingTierPolicy(
      input.serialNumber,
    );

  if (
    input.grossAmountMinor <=
    0n
  ) {
    throw new Error(
      "INVALID_GROSS_AMOUNT",
    );
  }

  const reserveAmountMinor =
    exactBpsAmount(
      input.grossAmountMinor,
      RESERVE_CONTRIBUTION_BPS,
    );

  const waterfallEntries =
    Object.entries(
      policy.waterfallBps,
    ) as Array<
      [
        FoundingCollectionTier,
        number,
      ]
    >;

  const totalWeight =
    waterfallEntries.reduce(
      (
        total,
        [, weight],
      ) =>
        total + weight,
      0,
    );

  if (
    totalWeight !==
    BPS_SCALE
  ) {
    throw new Error(
      "INVALID_RESERVE_WATERFALL",
    );
  }

  const allocations =
    waterfallEntries.map(
      (
        [
          beneficiaryTier,
          weightBps,
        ],
      ) => ({
        beneficiaryTier,

        weightBps,

        amountMinor:
          exactBpsAmount(
            reserveAmountMinor,
            weightBps,
          ),
      }),
    );

  const allocatedTotal =
    allocations.reduce(
      (
        total,
        allocation,
      ) =>
        total +
        allocation.amountMinor,
      0n,
    );

  if (
    allocatedTotal !==
    reserveAmountMinor
  ) {
    throw new Error(
      "RESERVE_ALLOCATION_MISMATCH",
    );
  }

  return {
    saleTier:
      policy.tier,

    wave:
      policy.wave,

    grossAmountMinor:
      input.grossAmountMinor,

    reserveBps:
      RESERVE_CONTRIBUTION_BPS,

    reserveAmountMinor,

    allocations,
  };
}
