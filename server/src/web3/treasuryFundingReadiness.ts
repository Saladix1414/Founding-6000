import {
  OX_NFT_FIRST_1000_GAS_UNITS,
  calculateTreasuryGasBudget,
} from "./treasuryGasBudget.js";

export const TREASURY_FUNDING_READINESS_VERSION =
  "OX-TREASURY-FUNDING-READINESS-1" as const;

export interface TreasuryFundingReadinessInput {
  gasPriceWei: bigint;
  currentMinterBalanceWei: bigint;
  planningGasUnits?: bigint;
}

export interface TreasuryFundingReadinessResult {
  version:
    typeof TREASURY_FUNDING_READINESS_VERSION;

  planningGasUnits: bigint;
  gasPriceWei: bigint;

  requiredBalanceWei: bigint;
  currentBalanceWei: bigint;

  fundingDeficitWei: bigint;
  fundingSurplusWei: bigint;

  balanceReady: boolean;

  fundingAuthorized: false;
  mintAuthorized: false;
  mainnetAuthorized: false;
  reserveFundingAllowed: false;
}

export function evaluateTreasuryFundingReadiness(
  input: TreasuryFundingReadinessInput,
): TreasuryFundingReadinessResult {
  if (
    input.currentMinterBalanceWei < 0n
  ) {
    throw new Error(
      "MINTER_BALANCE_MUST_NOT_BE_NEGATIVE",
    );
  }

  const planningGasUnits =
    input.planningGasUnits ??
    OX_NFT_FIRST_1000_GAS_UNITS;

  const budget =
    calculateTreasuryGasBudget(
      input.gasPriceWei,
      planningGasUnits,
    );

  const required =
    budget.requiredWei;

  const current =
    input.currentMinterBalanceWei;

  const deficit =
    current >= required
      ? 0n
      : required - current;

  const surplus =
    current > required
      ? current - required
      : 0n;

  return {
    version:
      TREASURY_FUNDING_READINESS_VERSION,

    planningGasUnits,
    gasPriceWei:
      input.gasPriceWei,

    requiredBalanceWei:
      required,

    currentBalanceWei:
      current,

    fundingDeficitWei:
      deficit,

    fundingSurplusWei:
      surplus,

    balanceReady:
      current >= required,

    fundingAuthorized:
      false,

    mintAuthorized:
      false,

    mainnetAuthorized:
      false,

    reserveFundingAllowed:
      false,
  };
}
