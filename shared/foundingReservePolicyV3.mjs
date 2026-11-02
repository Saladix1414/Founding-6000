// Versioned, deterministic calculation. No ledger, signer or network authority.
export const RESERVE_POLICY_VERSION = 'OX-FOUNDING-RESERVE-3';
export const INVESTMENT_PLAN_VERSION = 'OX-RESERVE-INVESTMENT-PREPARATION-2';
export const RESERVE_TIERS = Object.freeze(['RARE', 'EPIC', 'LEGENDARY']);
const rules = Object.freeze({
  RARE: Object.freeze({ price: 50_000_000n, quantity: 999, supply: 1000, denominator: 1n, weights: Object.freeze([1n,0n,0n]) }),
  EPIC: Object.freeze({ price: 70_000_000n, quantity: 2000, supply: 2000, denominator: 7n, weights: Object.freeze([3n,4n,0n]) }),
  LEGENDARY: Object.freeze({ price: 90_000_000n, quantity: 3000, supply: 3000, denominator: 9000n, weights: Object.freeze([335n,1866n,6799n]) }),
});

function amount(value) {
  if (typeof value !== 'bigint' || value < 0n || value > 1_000_000_000_000_000n) throw new Error('INVALID_RESERVE_AMOUNT');
}
function exact(value, numerator, denominator) {
  if (value * numerator % denominator !== 0n) throw new Error('NON_EXACT_V3_ALLOCATION');
  return value * numerator / denominator;
}
export function calculateReserveContributionV3({tier, grossAmountMinor}) {
  const policy = Object.hasOwn(rules,tier) ? rules[tier] : undefined;
  if (!policy) throw new Error('INVALID_RESERVE_TIER');
  amount(grossAmountMinor);
  if (grossAmountMinor === 0n) throw new Error('INVALID_GROSS_AMOUNT');
  const reserveAmountMinor = exact(grossAmountMinor,1n,4n);
  const allocations = RESERVE_TIERS.map((beneficiaryTier,i) => ({beneficiaryTier,
    weightNumerator:policy.weights[i], weightDenominator:policy.denominator,
    amountMinor:exact(reserveAmountMinor,policy.weights[i],policy.denominator)}));
  if (allocations.reduce((sum,a)=>sum+a.amountMinor,0n)!==reserveAmountMinor) throw new Error('ALLOCATION_MISMATCH');
  return {policyVersion:RESERVE_POLICY_VERSION, saleTier:tier, grossAmountMinor,
    reserveBps:2500, reserveAmountMinor, allocations};
}
export function referenceSaleV3(tier) {
  if (!Object.hasOwn(rules,tier)) throw new Error('INVALID_RESERVE_TIER');
  return calculateReserveContributionV3({tier,grossAmountMinor:rules[tier].price});
}
export function fullCloseV3() {
  const buckets = [0n,0n,0n];
  for(const tier of RESERVE_TIERS) {
    const sale=referenceSaleV3(tier);
    sale.allocations.forEach((a,i)=>{buckets[i]+=a.amountMinor*BigInt(rules[tier].quantity);});
  }
  return RESERVE_TIERS.map((tier,i)=>({tier,reserve:buckets[i],supply:rules[tier].supply,
    perNft:buckets[i]/BigInt(rules[tier].supply)}));
}

// 90% liquid, 10% invested, rebalanced annually for this illustration.
// Strategy rate is an assumed NET return on the invested sleeve, not the fund.
export function simulateManagedReserveScenario(openingReserve,strategyRateBps,years) {
  amount(openingReserve);
  if(!Number.isInteger(strategyRateBps)||strategyRateBps < -10000||strategyRateBps>10000||
    !Number.isInteger(years)||years<1||years>5) throw new Error('INVALID_MANAGED_SCENARIO');
  const openingInvested=openingReserve*1000n/10000n;
  let closingReserve=openingReserve;
  for(let i=0;i<years;i++) {
    const invested=closingReserve*1000n/10000n;
    const liquid=closingReserve-invested;
    closingReserve=liquid+invested*BigInt(10000+strategyRateBps)/10000n;
  }
  return {planVersion:INVESTMENT_PLAN_VERSION,openingReserve,openingInvested,
    openingLiquid:openingReserve-openingInvested,closingReserve,netChange:closingReserve-openingReserve,
    strategyRateBps,years,executionAuthorized:false};
}
export function investmentPreparationPlan() {
  return Object.freeze({version:INVESTMENT_PLAN_VERSION,status:'PREPARATION_ONLY',
    beforeCloseInvestedBps:0, requiresRedemptionActivation:true,afterCloseMaxInvestedBps:1000,liquidTargetBps:9000,
    maxPerProtocolBps:1000, borrowingAllowed:false,leverageAllowed:false,bridgesAllowed:false,
    actualProvidersApproved:false, actualNetRatesVerified:false,executionAuthorized:false,
    redemptionAuthorized:false,capitalGuaranteed:false});
}
