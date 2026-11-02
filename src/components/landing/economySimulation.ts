/*
 * Public illustrative simulator only.
 * This does not authorize or execute reserve allocations.
 * Values reflect the approved reference policy.
 */
export type SimulationTier = "RARE" | "EPIC" | "LEGENDARY";

export const SIMULATION_TIERS: readonly SimulationTier[] = [
  "RARE", "EPIC", "LEGENDARY",
];

import { referenceSaleV3 as referenceSaleV2, simulateManagedReserveScenario } from "../../../shared/foundingReservePolicyV3.mjs";
export { simulateManagedReserveScenario } from "../../../shared/foundingReservePolicyV3.mjs";

export function simulateReferenceSale(tier: SimulationTier) {
  const sale = referenceSaleV2(tier);
  return { price: sale.grossAmountMinor, reserve: sale.reserveAmountMinor,
    outsideReserve: sale.grossAmountMinor - sale.reserveAmountMinor,
    allocations: sale.allocations.map(item => ({tier:item.beneficiaryTier,
      weightBps:Number(item.weightNumerator)*10000/Number(item.weightDenominator),
      amount:item.amountMinor})), policyVersion:sale.policyVersion };
}

// Closing scenario: Azhurak #0001 remains reserved, never a simulated sale.
export function simulateBatchClose(completedBatches: number = 3, costsMinor: bigint | null = null) {
  if (!Number.isInteger(completedBatches) || completedBatches < 1 || completedBatches > 3 ||
      (costsMinor !== null && (typeof costsMinor !== 'bigint' || costsMinor < 0n || costsMinor > 1_000_000_000_000_000n))) {
    throw new Error('INVALID_BATCH_SCENARIO');
  }
  const quantities = [999, 2000, 3000];
  const maximumSupply = [1000, 2000, 3000];
  const reserves = [0n, 0n, 0n];
  let sales = 0n;
  const stages = SIMULATION_TIERS.slice(0, completedBatches).map((tier, index) => {
    const sale = simulateReferenceSale(tier);
    const quantity = quantities[index];
    const revenue = sale.price * BigInt(quantity);
    const contribution = sale.reserve * BigInt(quantity);
    sales += revenue;
    sale.allocations.forEach((item, i) => { reserves[i] += item.amount * BigInt(quantity); });
    return { tier, quantity, revenue, contribution, cumulativeRevenue: sales,
      cumulativeReserve: reserves.reduce((a, b) => a + b, 0n), reserves: [...reserves] };
  });
  const reserve = reserves.reduce((a, b) => a + b, 0n);
  return {
    stages, sales, reserve, outsideReserve: sales - reserve,
    costs: costsMinor,
    // User-entered aggregate costs; not an independently verified net profit.
    operatingNet: costsMinor === null ? null : sales - reserve - costsMinor,
    units: SIMULATION_TIERS.map((tier, i) => ({ tier, reserve: reserves[i],
      denominator: maximumSupply[i], averageReserve: reserves[i] / BigInt(maximumSupply[i]) })),
  };
}

export function simulateInvestmentScenario(reserveMinor: bigint, annualRateBps: number, years: number) {
  if (typeof reserveMinor !== 'bigint' || reserveMinor < 0n || reserveMinor > 1_000_000_000_000_000n ||
      !Number.isInteger(annualRateBps) || annualRateBps < -10000 || annualRateBps > 10000 ||
      !Number.isInteger(years) || years < 1 || years > 5) throw new Error('INVALID_INVESTMENT_SCENARIO');
  let closingReserve = reserveMinor;
  for (let i = 0; i < years; i++) closingReserve = closingReserve * BigInt(10000 + annualRateBps) / 10000n;
  return { openingReserve: reserveMinor, closingReserve, netChange: closingReserve - reserveMinor };
}

export function parseScenarioCosts(value: string): bigint | null {
  if (value.trim() === '') return null;
  if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(value)) throw new Error('INVALID_SCENARIO_COSTS');
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

// Illustration only. Maximum-supply denominator is NOT a live redemption policy.
export function simulateHolderExit(tier: SimulationTier, annualRateBps: number, years: number) {
  const unit = simulateBatchClose(3).units.find(item => item.tier === tier);
  if (!unit) throw new Error('INVALID_SIMULATION_TIER');
  const price = simulateReferenceSale(tier).price;
  const reserve = simulateManagedReserveScenario(unit.reserve, annualRateBps, years).closingReserve;
  const modeledRedemption = reserve / BigInt(unit.denominator);
  return { tier, price, modeledRedemption, differenceBeforeFees: modeledRedemption - price,
    denominator: unit.denominator, roundingRemainder: reserve % BigInt(unit.denominator),
    executable: false as const };
}
