import {
  type FoundingCollectionTier,
} from "./foundingEconomicsPolicy.js";

import {
  NAV_SUPPLY_BASIS,
  NAV_SUPPLY_POLICY_VERSION,
} from "./navSupplyPolicy.js";

export const ECONOMIC_EXIT_POLICY_VERSION =
  "OX-ECONOMIC-EXIT-1";

/*
 * OX-ECONOMIC-EXIT-1
 * ---------------------------------------------------------
 *
 * This policy is deliberately fail-closed.
 *
 * Current membership/account state is NOT sufficient
 * authority to move reserve assets.
 *
 * REFUNDED / REVOKED membership state does not:
 *
 * - debit the reserve;
 * - change the NAV denominator;
 * - free/reuse a Founding serial;
 * - authorize treasury movement;
 * - authorize an NFT burn;
 * - authorize redemption.
 *
 * Transfer likewise has no reserve effect.
 *
 * Any future redemption or reserve-return mechanism must
 * be introduced by a new explicit versioned policy with:
 *
 * - eligibility rules;
 * - authority rules;
 * - amount calculation;
 * - ledger entries;
 * - idempotency;
 * - treasury execution;
 * - proof/evidence;
 * - snapshot consequences;
 * - NFT lifecycle consequences.
 */

export type EconomicExitTrigger =
  | "MEMBERSHIP_REFUNDED"
  | "MEMBERSHIP_REVOKED"
  | "NFT_TRANSFERRED"
  | "NFT_BURN_REQUESTED"
  | "REDEMPTION_REQUESTED";

export type EconomicExitDecision =
  | "NO_RESERVE_EFFECT"
  | "DISABLED_REQUIRES_FUTURE_POLICY";

export type EconomicExitContext = {
  serialNumber:
    number;

  tier:
    FoundingCollectionTier;

  trigger:
    EconomicExitTrigger;
};

export function evaluateEconomicExit(
  context:
    EconomicExitContext,
) {
  if (
    !Number.isInteger(
      context.serialNumber,
    ) ||
    context.serialNumber < 1 ||
    context.serialNumber > 6000
  ) {
    throw new Error(
      "INVALID_FOUNDING_SERIAL",
    );
  }

  switch (
    context.trigger
  ) {
    case "MEMBERSHIP_REFUNDED":
    case "MEMBERSHIP_REVOKED":
    case "NFT_TRANSFERRED":
      return {
        policyVersion:
          ECONOMIC_EXIT_POLICY_VERSION,

        trigger:
          context.trigger,

        decision:
          "NO_RESERVE_EFFECT" as const,

        reserveDebitAuthorized:
          false,

        navDenominatorChanges:
          false,

        serialReusable:
          false,

        burnAuthorized:
          false,

        redemptionAuthorized:
          false,

        navSupplyPolicyVersion:
          NAV_SUPPLY_POLICY_VERSION,

        navSupplyBasis:
          NAV_SUPPLY_BASIS,
      };

    case "NFT_BURN_REQUESTED":
    case "REDEMPTION_REQUESTED":
      return {
        policyVersion:
          ECONOMIC_EXIT_POLICY_VERSION,

        trigger:
          context.trigger,

        decision:
          "DISABLED_REQUIRES_FUTURE_POLICY" as const,

        reserveDebitAuthorized:
          false,

        navDenominatorChanges:
          false,

        serialReusable:
          false,

        burnAuthorized:
          false,

        redemptionAuthorized:
          false,

        navSupplyPolicyVersion:
          NAV_SUPPLY_POLICY_VERSION,

        navSupplyBasis:
          NAV_SUPPLY_BASIS,
      };

    default: {
      const exhaustive:
        never =
        context.trigger;

      throw new Error(
        `UNKNOWN_ECONOMIC_EXIT_TRIGGER:${exhaustive}`,
      );
    }
  }
}
