import assert from "node:assert/strict";

import {
  OX_NFT_FIRST_1000_DEPLOY_GAS,
  OX_NFT_FIRST_1000_GAS_UNITS,
  OX_NFT_FIRST_1000_MINT_GAS,
  TREASURY_FUNDING_POLICY,
  calculateTreasuryGasBudget,
  weiToEthDecimal,
} from "../web3/treasuryGasBudget.js";

assert.equal(
  OX_NFT_FIRST_1000_DEPLOY_GAS,
  1_498_867n,
);

assert.equal(
  OX_NFT_FIRST_1000_MINT_GAS,
  59_276_004n,
);

assert.equal(
  OX_NFT_FIRST_1000_GAS_UNITS,
  69_666_271n,
);

const oneGwei =
  1_000_000_000n;

const fiveGwei =
  5_000_000_000n;

const tenGwei =
  10_000_000_000n;

const atOne =
  calculateTreasuryGasBudget(
    oneGwei,
  );

const atFive =
  calculateTreasuryGasBudget(
    fiveGwei,
  );

const atTen =
  calculateTreasuryGasBudget(
    tenGwei,
  );

assert.equal(
  atOne.requiredWei,
  69_666_271_000_000_000n,
);

assert.equal(
  atFive.requiredWei,
  348_331_355_000_000_000n,
);

assert.equal(
  atTen.requiredWei,
  696_662_710_000_000_000n,
);

assert.equal(
  weiToEthDecimal(
    atOne.requiredWei,
  ),
  "0.069666271",
);

assert.equal(
  weiToEthDecimal(
    atFive.requiredWei,
  ),
  "0.348331355",
);

assert.equal(
  weiToEthDecimal(
    atTen.requiredWei,
  ),
  "0.69666271",
);

assert.throws(
  () =>
    calculateTreasuryGasBudget(
      0n,
    ),
  /GAS_PRICE_MUST_BE_POSITIVE/,
);

assert.throws(
  () =>
    calculateTreasuryGasBudget(
      -1n,
    ),
  /GAS_PRICE_MUST_BE_POSITIVE/,
);

assert.equal(
  TREASURY_FUNDING_POLICY.source,
  "OPERATING_TREASURY",
);

assert.equal(
  TREASURY_FUNDING_POLICY.target,
  "NFT_MINTER",
);

assert.equal(
  TREASURY_FUNDING_POLICY
    .reserveFundingAllowed,
  false,
);

assert.equal(
  TREASURY_FUNDING_POLICY
    .customerFundsAllowedInMinter,
  false,
);

assert.equal(
  TREASURY_FUNDING_POLICY
    .automaticFundingAuthorized,
  false,
);

assert.equal(
  TREASURY_FUNDING_POLICY
    .mainnetFundingAuthorized,
  false,
);

console.log(
  "OX_TREASURY_GAS_BUDGET_TEST=PASS",
);

console.log(
  "PLANNING_GAS_UNITS=69666271",
);

console.log(
  "1_GWEI_REQUIREMENT_ETH="
    + weiToEthDecimal(
      atOne.requiredWei,
    ),
);

console.log(
  "5_GWEI_REQUIREMENT_ETH="
    + weiToEthDecimal(
      atFive.requiredWei,
    ),
);

console.log(
  "10_GWEI_REQUIREMENT_ETH="
    + weiToEthDecimal(
      atTen.requiredWei,
    ),
);

console.log(
  "FUNDING_SOURCE=OPERATING_TREASURY",
);

console.log(
  "FUNDING_TARGET=NFT_MINTER",
);

console.log(
  "RESERVE_FUNDS_GAS=false",
);

console.log(
  "AUTOMATIC_FUNDING_AUTHORIZED=false",
);

console.log(
  "MAINNET_FUNDING_AUTHORIZED=false",
);
