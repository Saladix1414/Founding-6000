import {
  type FoundingCollectionTier,
} from "./foundingEconomicsPolicy.js";

export const NAV_SUPPLY_POLICY_VERSION =
  "OX-NAV-SUPPLY-1";

/*
 * Canonical NAV denominator.
 *
 * HISTORICAL_ISSUED_SUPPLY means:
 *
 * - every serial ever issued counts once;
 * - ALLOCATED and RELEASED inventory rows both count;
 * - a released serial is never reused;
 * - transfer does not change supply;
 * - membership/account state does not change supply;
 * - wallet ownership does not change supply;
 * - redemption/burn must NEVER silently alter this basis.
 *
 * A future outstanding-supply or burn-adjusted NAV model
 * requires a new versioned economic policy.
 */
export const NAV_SUPPLY_BASIS =
  "HISTORICAL_ISSUED_SUPPLY" as const;

export type NavSupplyBasis =
  typeof NAV_SUPPLY_BASIS;

export type TierIssuedSupply = {
  RARE:
    number;

  EPIC:
    number;

  GENESIS:
    number;
};

function assertSupplyCount(
  value:
    number,

  tier:
    FoundingCollectionTier,
) {
  if (
    !Number.isInteger(
      value,
    ) ||
    value < 0
  ) {
    throw new Error(
      `INVALID_${tier}_ISSUED_SUPPLY`,
    );
  }
}

export function validateIssuedSupply(
  supply:
    TierIssuedSupply,
) {
  assertSupplyCount(
    supply.RARE,
    "RARE",
  );

  assertSupplyCount(
    supply.EPIC,
    "EPIC",
  );

  assertSupplyCount(
    supply.GENESIS,
    "GENESIS",
  );

  if (
    supply.RARE >
    1000
  ) {
    throw new Error(
      "RARE_ISSUED_SUPPLY_EXCEEDS_MAX",
    );
  }

  if (
    supply.EPIC >
    2000
  ) {
    throw new Error(
      "EPIC_ISSUED_SUPPLY_EXCEEDS_MAX",
    );
  }

  if (
    supply.GENESIS >
    3000
  ) {
    throw new Error(
      "GENESIS_ISSUED_SUPPLY_EXCEEDS_MAX",
    );
  }

  return {
    version:
      NAV_SUPPLY_POLICY_VERSION,

    basis:
      NAV_SUPPLY_BASIS,

    supply,
  };
}
