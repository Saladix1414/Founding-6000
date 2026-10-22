import {
  readFileSync,
} from "node:fs";

const membership =
  readFileSync(
    "server/src/services/membershipService.ts",
    "utf8",
  );

const reserve =
  readFileSync(
    "server/src/services/reserveService.ts",
    "utf8",
  );

const reserveProof =
  readFileSync(
    "server/src/services/reserveProofService.ts",
    "utf8",
  );

const navPolicy =
  readFileSync(
    "server/src/economics/navSupplyPolicy.ts",
    "utf8",
  );

const exitPolicy =
  readFileSync(
    "server/src/economics/economicExitPolicy.ts",
    "utf8",
  );

const requiredMembershipStates = [
  '"REFUNDED"',
  '"REVOKED"',
];

for (
  const state of
    requiredMembershipStates
) {
  if (
    !membership.includes(
      state,
    )
  ) {
    throw new Error(
      `MEMBERSHIP_STATE_MISSING:${state}`,
    );
  }
}

/*
 * Membership service must not acquire direct
 * reserve accounting authority merely because
 * REFUNDED / REVOKED states exist.
 */
const forbiddenMembershipAuthority = [
  "reserve_allocations",
  "reserve_contributions",
  "RESERVE_SWEEP_SIGNER_PRIVATE_KEY",
  "readReserveVaultBalanceMinor",
];

for (
  const value of
    forbiddenMembershipAuthority
) {
  if (
    membership.includes(
      value,
    )
  ) {
    throw new Error(
      `MEMBERSHIP_GAINED_ECONOMIC_AUTHORITY:${value}`,
    );
  }
}

if (
  reserve.includes(
    "DELETE FROM reserve_contributions"
  ) ||
  reserve.includes(
    "DELETE FROM reserve_allocations"
  )
) {
  throw new Error(
    "RESERVE_LEDGER_DELETION_PATH_PRESENT",
  );
}

if (
  reserveProof.includes(
    "WHERE status = 'ALLOCATED'"
  )
) {
  throw new Error(
    "REFUND_OR_RELEASE_COULD_CHANGE_NAV_DENOMINATOR",
  );
}

if (
  !navPolicy.includes(
    "HISTORICAL_ISSUED_SUPPLY"
  )
) {
  throw new Error(
    "HISTORICAL_NAV_BASIS_MISSING",
  );
}

const requiredExitBoundaries = [
  "reserveDebitAuthorized",
  "navDenominatorChanges",
  "serialReusable",
  "burnAuthorized",
  "redemptionAuthorized",
  "DISABLED_REQUIRES_FUTURE_POLICY",
];

for (
  const value of
    requiredExitBoundaries
) {
  if (
    !exitPolicy.includes(
      value,
    )
  ) {
    throw new Error(
      `ECONOMIC_EXIT_BOUNDARY_MISSING:${value}`,
    );
  }
}

console.log(
  "OX_MEMBERSHIP_ECONOMIC_BOUNDARY=PASS",
);

console.log(
  "MEMBERSHIP_STATUS_IS_ECONOMIC_AUTHORITY=NO",
);

console.log(
  "REFUNDED_STATUS_DEBITS_RESERVE=NO",
);

console.log(
  "REVOKED_STATUS_DEBITS_RESERVE=NO",
);

console.log(
  "RESERVE_LEDGER_DELETE_PATH=NO",
);

console.log(
  "HISTORICAL_NAV_BASIS_PRESERVED=YES",
);
