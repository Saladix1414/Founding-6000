import {
  buildReserveSweepAmount,
} from "../economics/reserveSweepPolicy.js";

const single =
  buildReserveSweepAmount([
    {
      contributionId:
        "contribution-0001",

      amountMinor:
        12_500_000n,
    },
  ]);

if (
  single.contributionCount !==
  1
) {
  throw new Error(
    "SINGLE_SWEEP_COUNT_MISMATCH",
  );
}

if (
  single.totalAmountMinor !==
  12_500_000n
) {
  throw new Error(
    "SINGLE_SWEEP_AMOUNT_MISMATCH",
  );
}

const batch =
  buildReserveSweepAmount([
    {
      contributionId:
        "contribution-0001",

      amountMinor:
        12_500_000n,
    },

    {
      contributionId:
        "contribution-0002",

      amountMinor:
        12_500_000n,
    },

    {
      contributionId:
        "contribution-1001",

      amountMinor:
        17_500_000n,
    },
  ]);

if (
  batch.contributionCount !==
  3
) {
  throw new Error(
    "BATCH_COUNT_MISMATCH",
  );
}

if (
  batch.totalAmountMinor !==
  42_500_000n
) {
  throw new Error(
    "BATCH_AMOUNT_MISMATCH",
  );
}

let duplicateRejected =
  false;

try {
  buildReserveSweepAmount([
    {
      contributionId:
        "same",

      amountMinor:
        1n,
    },

    {
      contributionId:
        "same",

      amountMinor:
        1n,
    },
  ]);
} catch (error) {
  duplicateRejected =
    error instanceof Error &&
    error.message ===
      "DUPLICATE_RESERVE_CONTRIBUTION";
}

if (
  !duplicateRejected
) {
  throw new Error(
    "DUPLICATE_NOT_REJECTED",
  );
}

let zeroRejected =
  false;

try {
  buildReserveSweepAmount([
    {
      contributionId:
        "zero",

      amountMinor:
        0n,
    },
  ]);
} catch (error) {
  zeroRejected =
    error instanceof Error &&
    error.message ===
      "INVALID_RESERVE_SWEEP_AMOUNT";
}

if (
  !zeroRejected
) {
  throw new Error(
    "ZERO_NOT_REJECTED",
  );
}

console.log(
  "OX_RESERVE_SWEEP_POLICY=PASS",
);

console.log(
  "SINGLE_SWEEP_12_50_USDT=PASS",
);

console.log(
  "BATCH_SWEEP_42_50_USDT=PASS",
);

console.log(
  "DUPLICATE_CONTRIBUTION_REJECTION=PASS",
);

console.log(
  "ZERO_AMOUNT_REJECTION=PASS",
);
