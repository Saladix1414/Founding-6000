import {
  ECONOMIC_EXIT_POLICY_VERSION,
  evaluateEconomicExit,
  type EconomicExitTrigger,
} from "../economics/economicExitPolicy.js";

const passiveTriggers:
  EconomicExitTrigger[] = [
    "MEMBERSHIP_REFUNDED",
    "MEMBERSHIP_REVOKED",
    "NFT_TRANSFERRED",
  ];

for (
  const trigger of
    passiveTriggers
) {
  const result =
    evaluateEconomicExit({
      serialNumber:
        1,

      tier:
        "RARE",

      trigger,
    });

  if (
    result.policyVersion !==
    ECONOMIC_EXIT_POLICY_VERSION
  ) {
    throw new Error(
      "EXIT_POLICY_VERSION_INVALID",
    );
  }

  if (
    result.decision !==
    "NO_RESERVE_EFFECT"
  ) {
    throw new Error(
      `PASSIVE_TRIGGER_CHANGED_RESERVE:${trigger}`,
    );
  }

  if (
    result.reserveDebitAuthorized
  ) {
    throw new Error(
      `PASSIVE_TRIGGER_AUTHORIZED_RESERVE_DEBIT:${trigger}`,
    );
  }

  if (
    result.navDenominatorChanges
  ) {
    throw new Error(
      `PASSIVE_TRIGGER_CHANGED_NAV_DENOMINATOR:${trigger}`,
    );
  }

  if (
    result.serialReusable
  ) {
    throw new Error(
      `PASSIVE_TRIGGER_REUSED_SERIAL:${trigger}`,
    );
  }

  if (
    result.burnAuthorized
  ) {
    throw new Error(
      `PASSIVE_TRIGGER_AUTHORIZED_BURN:${trigger}`,
    );
  }

  if (
    result.redemptionAuthorized
  ) {
    throw new Error(
      `PASSIVE_TRIGGER_AUTHORIZED_REDEMPTION:${trigger}`,
    );
  }
}

const disabledTriggers:
  EconomicExitTrigger[] = [
    "NFT_BURN_REQUESTED",
    "REDEMPTION_REQUESTED",
  ];

for (
  const trigger of
    disabledTriggers
) {
  const result =
    evaluateEconomicExit({
      serialNumber:
        3001,

      tier:
        "GENESIS",

      trigger,
    });

  if (
    result.decision !==
    "DISABLED_REQUIRES_FUTURE_POLICY"
  ) {
    throw new Error(
      `DISABLED_TRIGGER_NOT_FAIL_CLOSED:${trigger}`,
    );
  }

  if (
    result.reserveDebitAuthorized ||
    result.navDenominatorChanges ||
    result.serialReusable ||
    result.burnAuthorized ||
    result.redemptionAuthorized
  ) {
    throw new Error(
      `DISABLED_TRIGGER_GAINED_AUTHORITY:${trigger}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_EXIT_POLICY=PASS",
);

console.log(
  "MEMBERSHIP_REFUND_RESERVE_EFFECT=NO",
);

console.log(
  "MEMBERSHIP_REVOCATION_RESERVE_EFFECT=NO",
);

console.log(
  "TRANSFER_RESERVE_EFFECT=NO",
);

console.log(
  "NFT_BURN_ENABLED=NO",
);

console.log(
  "REDEMPTION_ENABLED=NO",
);

console.log(
  "SERIAL_REUSE=NO",
);

console.log(
  "NAV_DENOMINATOR_MUTATION=NO",
);
