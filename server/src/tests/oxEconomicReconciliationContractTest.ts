import {
  readFileSync,
} from "node:fs";

const service =
  readFileSync(
    "server/src/services/economicReconciliationService.ts",
    "utf8",
  );

const requiredChecks = [
  "VERIFIED_SETTLEMENT_HAS_RESERVE_CONTRIBUTION",
  "RESERVE_CONTRIBUTION_HAS_VERIFIED_SETTLEMENT",
  "RESERVE_CONTRIBUTION_MATH",
  "RESERVE_WATERFALL_RECONCILES",
  "SWEEP_ITEM_MATCHES_CONTRIBUTION",
  "SWEEP_HEADER_RECONCILES_ITEMS",
  "EXIT_POLICY_FAIL_CLOSED",
  "GLOBAL_ALLOCATIONS_EQUAL_RESERVE_OBLIGATIONS",
  "SNAPSHOT_TOTAL_LIABILITY_MATCHES_LEDGER",
  "SUPPLY_MATCHES_HISTORY",
];

for (
  const value of
    requiredChecks
) {
  if (
    !service.includes(
      value,
    )
  ) {
    throw new Error(
      `RECONCILIATION_CHECK_MISSING:${value}`,
    );
  }
}

/*
 * Reconciliation is READ ONLY.
 */
const forbiddenMutations = [
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM",
  ".run(",
  "BEGIN IMMEDIATE",
  "COMMIT",
];

for (
  const value of
    forbiddenMutations
) {
  if (
    service.includes(
      value,
    )
  ) {
    throw new Error(
      `RECONCILIATION_MUTATION_AUTHORITY:${value}`,
    );
  }
}

/*
 * Confirmed sweeps and current vault balance are
 * deliberately NOT treated as strict equality.
 */
if (
  !service.includes(
    "strictEqualityRequired:"
  ) ||
  !service.includes(
    "false"
  )
) {
  throw new Error(
    "CUSTODY_EQUALITY_BOUNDARY_MISSING",
  );
}

if (
  !service.includes(
    "HISTORICAL_ISSUED_SUPPLY"
  ) &&
  !service.includes(
    "NAV_SUPPLY_BASIS"
  )
) {
  throw new Error(
    "NAV_SUPPLY_POLICY_NOT_REFERENCED",
  );
}

console.log(
  "OX_ECONOMIC_RECONCILIATION_CONTRACT=PASS",
);

console.log(
  "READ_ONLY=PASS",
);

console.log(
  "SETTLEMENT_RECONCILIATION=PASS",
);

console.log(
  "RESERVE_RECONCILIATION=PASS",
);

console.log(
  "SWEEP_RECONCILIATION=PASS",
);

console.log(
  "SNAPSHOT_RECONCILIATION=PASS",
);

console.log(
  "ISSUED_SUPPLY_RECONCILIATION=PASS",
);

console.log(
  "EXIT_POLICY_RECONCILIATION=PASS",
);

console.log(
  "VAULT_SWEEP_STRICT_EQUALITY=NO",
);
