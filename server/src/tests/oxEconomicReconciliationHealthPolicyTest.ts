import {
  ECONOMIC_RECONCILIATION_STALE_MS,
  resolveEconomicReconciliationHealth,
} from "../economics/economicReconciliationHealthPolicy.js";

const now =
  Date.parse(
    "2026-10-22T18:00:00.000Z",
  );

if (
  resolveEconomicReconciliationHealth({
    status:
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
  resolveEconomicReconciliationHealth({
    status:
      "OK",

    reconciledAt:
      "2026-10-22T17:50:00.000Z",

    nowMs:
      now,
  }) !==
  "OK"
) {
  throw new Error(
    "FRESH_OK_INVALID",
  );
}

if (
  resolveEconomicReconciliationHealth({
    status:
      "WARNING",

    reconciledAt:
      "2026-10-22T17:50:00.000Z",

    nowMs:
      now,
  }) !==
  "WARNING"
) {
  throw new Error(
    "FRESH_WARNING_INVALID",
  );
}

const staleAt =
  new Date(
    now -
      ECONOMIC_RECONCILIATION_STALE_MS -
      1,
  ).toISOString();

if (
  resolveEconomicReconciliationHealth({
    status:
      "OK",

    reconciledAt:
      staleAt,

    nowMs:
      now,
  }) !==
  "STALE"
) {
  throw new Error(
    "STALE_THRESHOLD_INVALID",
  );
}

if (
  resolveEconomicReconciliationHealth({
    status:
      "OK",

    reconciledAt:
      "invalid-timestamp",

    nowMs:
      now,
  }) !==
  "STALE"
) {
  throw new Error(
    "INVALID_TIMESTAMP_NOT_STALE",
  );
}

console.log(
  "OX_ECONOMIC_RECONCILIATION_HEALTH_POLICY=PASS",
);

console.log(
  "STALE_THRESHOLD_MS=" +
    ECONOMIC_RECONCILIATION_STALE_MS,
);

console.log(
  "NOT_SEEN_BLOCKS_INCIDENT=NO",
);
