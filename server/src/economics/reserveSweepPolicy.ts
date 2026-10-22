export const RESERVE_SWEEP_VERSION =
  "OX-RESERVE-SWEEP-1";

export type ReserveSweepCandidate = {
  contributionId:
    string;

  amountMinor:
    bigint;
};

export function buildReserveSweepAmount(
  candidates:
    readonly ReserveSweepCandidate[],
) {
  if (
    candidates.length === 0
  ) {
    throw new Error(
      "EMPTY_RESERVE_SWEEP",
    );
  }

  const seen =
    new Set<string>();

  let totalAmountMinor =
    0n;

  for (
    const candidate of candidates
  ) {
    if (
      !candidate.contributionId.trim()
    ) {
      throw new Error(
        "INVALID_RESERVE_CONTRIBUTION_ID",
      );
    }

    if (
      seen.has(
        candidate.contributionId,
      )
    ) {
      throw new Error(
        "DUPLICATE_RESERVE_CONTRIBUTION",
      );
    }

    if (
      candidate.amountMinor <= 0n
    ) {
      throw new Error(
        "INVALID_RESERVE_SWEEP_AMOUNT",
      );
    }

    seen.add(
      candidate.contributionId,
    );

    totalAmountMinor +=
      candidate.amountMinor;
  }

  return {
    contributionCount:
      candidates.length,

    totalAmountMinor,
  };
}
