export const OX_NFT_FIRST_1000_GAS_UNITS =
  69_666_271n;

export const OX_NFT_FIRST_1000_DEPLOY_GAS =
  1_498_867n;

export const OX_NFT_FIRST_1000_MINT_GAS =
  59_276_004n;

export interface TreasuryGasBudget {
  gasUnits: bigint;
  gasPriceWei: bigint;
  requiredWei: bigint;
}

export function calculateTreasuryGasBudget(
  gasPriceWei: bigint,
  gasUnits: bigint =
    OX_NFT_FIRST_1000_GAS_UNITS,
): TreasuryGasBudget {
  if (gasPriceWei <= 0n) {
    throw new Error(
      "GAS_PRICE_MUST_BE_POSITIVE",
    );
  }

  if (gasUnits <= 0n) {
    throw new Error(
      "GAS_UNITS_MUST_BE_POSITIVE",
    );
  }

  return {
    gasUnits,
    gasPriceWei,
    requiredWei:
      gasUnits * gasPriceWei,
  };
}

export function weiToEthDecimal(
  wei: bigint,
): string {
  if (wei < 0n) {
    throw new Error(
      "WEI_MUST_NOT_BE_NEGATIVE",
    );
  }

  const scale =
    1_000_000_000_000_000_000n;

  const whole =
    wei / scale;

  const remainder =
    wei % scale;

  if (remainder === 0n) {
    return whole.toString();
  }

  const fraction =
    remainder
      .toString()
      .padStart(
        18,
        "0",
      )
      .replace(
        /0+$/,
        "",
      );

  return `${whole}.${fraction}`;
}

export interface TreasuryFundingPolicy {
  source:
    | "OPERATING_TREASURY";

  target:
    | "NFT_MINTER";

  reserveFundingAllowed: false;
  customerFundsAllowedInMinter: false;
  automaticFundingAuthorized: false;
  mainnetFundingAuthorized: false;
}

export const TREASURY_FUNDING_POLICY:
  TreasuryFundingPolicy = {
    source:
      "OPERATING_TREASURY",

    target:
      "NFT_MINTER",

    reserveFundingAllowed:
      false,

    customerFundsAllowedInMinter:
      false,

    automaticFundingAuthorized:
      false,

    mainnetFundingAuthorized:
      false,
  };
