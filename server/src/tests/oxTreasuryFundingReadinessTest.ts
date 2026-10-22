import assert from "node:assert/strict";

import {
  TREASURY_FUNDING_READINESS_VERSION,
  evaluateTreasuryFundingReadiness,
} from "../web3/treasuryFundingReadiness.js";

const oneGwei =
  1_000_000_000n;

const requiredAtOneGwei =
  69_666_271_000_000_000n;

const empty =
  evaluateTreasuryFundingReadiness({
    gasPriceWei:
      oneGwei,

    currentMinterBalanceWei:
      0n,
  });

assert.equal(
  empty.version,
  TREASURY_FUNDING_READINESS_VERSION,
);

assert.equal(
  empty.requiredBalanceWei,
  requiredAtOneGwei,
);

assert.equal(
  empty.currentBalanceWei,
  0n,
);

assert.equal(
  empty.fundingDeficitWei,
  requiredAtOneGwei,
);

assert.equal(
  empty.fundingSurplusWei,
  0n,
);

assert.equal(
  empty.balanceReady,
  false,
);

const exact =
  evaluateTreasuryFundingReadiness({
    gasPriceWei:
      oneGwei,

    currentMinterBalanceWei:
      requiredAtOneGwei,
  });

assert.equal(
  exact.fundingDeficitWei,
  0n,
);

assert.equal(
  exact.fundingSurplusWei,
  0n,
);

assert.equal(
  exact.balanceReady,
  true,
);

const overfunded =
  evaluateTreasuryFundingReadiness({
    gasPriceWei:
      oneGwei,

    currentMinterBalanceWei:
      requiredAtOneGwei +
      1_000_000_000_000_000n,
  });

assert.equal(
  overfunded.fundingDeficitWei,
  0n,
);

assert.equal(
  overfunded.fundingSurplusWei,
  1_000_000_000_000_000n,
);

assert.equal(
  overfunded.balanceReady,
  true,
);

for (
  const result of [
    empty,
    exact,
    overfunded,
  ]
) {
  assert.equal(
    result.fundingAuthorized,
    false,
  );

  assert.equal(
    result.mintAuthorized,
    false,
  );

  assert.equal(
    result.mainnetAuthorized,
    false,
  );

  assert.equal(
    result.reserveFundingAllowed,
    false,
  );
}

assert.throws(
  () =>
    evaluateTreasuryFundingReadiness({
      gasPriceWei:
        oneGwei,

      currentMinterBalanceWei:
        -1n,
    }),
  /MINTER_BALANCE_MUST_NOT_BE_NEGATIVE/,
);

assert.throws(
  () =>
    evaluateTreasuryFundingReadiness({
      gasPriceWei:
        0n,

      currentMinterBalanceWei:
        0n,
    }),
  /GAS_PRICE_MUST_BE_POSITIVE/,
);

console.log(
  "OX_TREASURY_FUNDING_READINESS_TEST=PASS",
);

console.log(
  "REQUIRED_BALANCE_AT_1_GWEI_WEI="
    + requiredAtOneGwei.toString(),
);

console.log(
  "ZERO_BALANCE_READY=false",
);

console.log(
  "EXACT_BALANCE_READY=true",
);

console.log(
  "SURPLUS_CALCULATION=PASS",
);

console.log(
  "FUNDING_AUTHORIZED=false",
);

console.log(
  "MINT_AUTHORIZED=false",
);

console.log(
  "MAINNET_AUTHORIZED=false",
);

console.log(
  "RESERVE_FUNDING_ALLOWED=false",
);
