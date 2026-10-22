import {
  calculateCoverageBps,
  resolvePublicEconomicIntegrityState,
} from "../economics/economicOperationsViewPolicy.js";

const now =
  Date.parse(
    "2026-10-22T03:00:00.000Z",
  );

if (
  resolvePublicEconomicIntegrityState({
    reconciliationStatus:
      null,

    reconciledAt:
      null,

    nowMs:
      now,
  }) !==
  "NOT_SEEN"
) {
  throw new Error(
    "NOT_SEEN_POLICY_INVALID",
  );
}

if (
  resolvePublicEconomicIntegrityState({
    reconciliationStatus:
      "OK",

    reconciledAt:
      "2026-10-22T02:55:00.000Z",

    nowMs:
      now,
  }) !==
  "OK"
) {
  throw new Error(
    "FRESH_OK_POLICY_INVALID",
  );
}

if (
  resolvePublicEconomicIntegrityState({
    reconciliationStatus:
      "OK",

    reconciledAt:
      "2026-10-22T02:30:00.000Z",

    nowMs:
      now,
  }) !==
  "STALE"
) {
  throw new Error(
    "STALE_POLICY_INVALID",
  );
}

if (
  calculateCoverageBps({
    liabilityMinor:
      "12500000",

    onchainMinor:
      "12500000",
  }) !==
  "10000"
) {
  throw new Error(
    "FULL_COVERAGE_BPS_INVALID",
  );
}

if (
  calculateCoverageBps({
    liabilityMinor:
      "20000000",

    onchainMinor:
      "10000000",
  }) !==
  "5000"
) {
  throw new Error(
    "PARTIAL_COVERAGE_BPS_INVALID",
  );
}

if (
  calculateCoverageBps({
    liabilityMinor:
      "0",

    onchainMinor:
      "0",
  }) !==
  null
) {
  throw new Error(
    "ZERO_LIABILITY_POLICY_INVALID",
  );
}

console.log(
  "OX_ECONOMIC_OPERATIONS_VIEW_POLICY=PASS",
);

console.log(
  "NOT_SEEN=PASS",
);

console.log(
  "STALE=PASS",
);

console.log(
  "COVERAGE_INTEGER_MATH=PASS",
);
