export const ECONOMIC_OPERATIONS_VIEW_VERSION =
  "OX-ECONOMIC-OPS-VIEW-1";

export const ECONOMIC_OPERATIONS_STALE_MS =
  15 * 60 * 1000;

export type PublicEconomicIntegrityState =
  | "OK"
  | "WARNING"
  | "CRITICAL"
  | "STALE"
  | "NOT_SEEN";

export function resolvePublicEconomicIntegrityState(
  input: {
    reconciliationStatus:
      "OK" |
      "WARNING" |
      "CRITICAL" |
      null;

    reconciledAt:
      string |
      null;

    nowMs?:
      number;
  },
): PublicEconomicIntegrityState {
  if (
    !input.reconciliationStatus ||
    !input.reconciledAt
  ) {
    return "NOT_SEEN";
  }

  const timestamp =
    Date.parse(
      input.reconciledAt,
    );

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    return "STALE";
  }

  const now =
    input.nowMs ??
    Date.now();

  if (
    now -
      timestamp >
    ECONOMIC_OPERATIONS_STALE_MS
  ) {
    return "STALE";
  }

  return input
    .reconciliationStatus;
}

export function calculateCoverageBps(
  input: {
    liabilityMinor:
      string;

    onchainMinor:
      string;
  },
) {
  const liability =
    BigInt(
      input.liabilityMinor,
    );

  const onchain =
    BigInt(
      input.onchainMinor,
    );

  if (
    liability ===
    0n
  ) {
    return null;
  }

  return (
    onchain *
    10_000n /
    liability
  ).toString();
}
