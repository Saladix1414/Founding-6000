// Public campaign projections. The verified-sale ledger uses its own versioned policy.
import { simulateManagedReserveScenario } from "../../../shared/foundingReservePolicyV3.mjs";
import { simulateBusinessReserveYear } from "../../../shared/foundingBusinessScenario.mjs";

export { simulateManagedReserveScenario };

const campaignTiers = {
  RARE: { quantity: 1000, price: 50_000_000n },
  EPIC: { quantity: 2000, price: 70_000_000n },
  LEGENDARY: { quantity: 3000, price: 90_000_000n },
} as const;

export type SimulationTier = keyof typeof campaignTiers;
export const SIMULATION_TIERS: readonly SimulationTier[] = ["RARE", "EPIC", "LEGENDARY"];

export function simulateReferenceSale(tier: SimulationTier) {
  const { price } = campaignTiers[tier];
  const reserve = price / 2n;
  return {
    price,
    reserve,
    outsideReserve: price - reserve,
    allocations: SIMULATION_TIERS.map(beneficiary => ({
      tier: beneficiary,
      weightBps: beneficiary === tier ? 10000 : 0,
      amount: beneficiary === tier ? reserve : 0n,
    })),
  };
}

// The video model assumes the entire 6,000-unit supply is sold.
export function simulateBatchClose(completedBatches = 3, costsMinor: bigint | null = null) {
  if (!Number.isInteger(completedBatches) || completedBatches < 1 || completedBatches > 3 ||
      (costsMinor !== null && (typeof costsMinor !== "bigint" || costsMinor < 0n || costsMinor > 1_000_000_000_000_000n))) {
    throw new Error("INVALID_BATCH_SCENARIO");
  }

  let sales = 0n;
  let reserve = 0n;
  let minting = 0n;
  const stages = SIMULATION_TIERS.slice(0, completedBatches).map(tier => {
    const sale = simulateReferenceSale(tier);
    const { quantity } = campaignTiers[tier];
    const revenue = sale.price * BigInt(quantity);
    const contribution = sale.reserve * BigInt(quantity);
    sales += revenue;
    reserve += contribution;
    minting += 10_000_000n * BigInt(quantity);
    return { tier, quantity, revenue, contribution, cumulativeReserve: reserve };
  });
  const outsideReserve = sales - reserve;

  return {
    stages,
    sales,
    reserve,
    outsideReserve,
    minting,
    forWebsite: outsideReserve - minting,
    operatingNet: costsMinor === null ? null : outsideReserve - costsMinor,
    units: SIMULATION_TIERS.map((tier, index) => {
      const supply = campaignTiers[tier].quantity;
      const categoryReserve = stages[index]?.contribution ?? 0n;
      return { tier, reserve: categoryReserve, supply, perNft: categoryReserve / BigInt(supply) };
    }),
  };
}

export function simulateCampaignBusinessYear(monthlyProfitMinor: bigint, strategyRateBps: number, years: number) {
  return simulateBusinessReserveYear(monthlyProfitMinor, strategyRateBps, years, simulateBatchClose().units);
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
  const modeledRedemption = reserve / BigInt(unit.supply);
  return { tier, price, modeledRedemption, differenceBeforeFees: modeledRedemption - price,
    denominator: unit.supply, roundingRemainder: reserve % BigInt(unit.supply),
    executable: false as const };
}
