/*
 * Public illustrative simulator only.
 * This does not authorize or execute reserve allocations.
 * Values reflect the approved reference policy.
 */
export type SimulationTier = "RARE" | "EPIC" | "LEGENDARY";

export const SIMULATION_TIERS: readonly SimulationTier[] = [
  "RARE", "EPIC", "LEGENDARY",
];

const REFERENCE = {
  RARE: { price: 50_000_000n, weights: [10000n, 0n, 0n] },
  EPIC: { price: 70_000_000n, weights: [7000n, 3000n, 0n] },
  LEGENDARY: { price: 90_000_000n, weights: [3000n, 4000n, 3000n] },
} as const;

export function simulateReferenceSale(tier: SimulationTier) {
  const policy = REFERENCE[tier];
  if (!policy) throw new Error("INVALID_SIMULATION_TIER");

  const reserve = policy.price * 2500n / 10000n;
  const allocations = SIMULATION_TIERS.map((label, index) => ({
    tier: label,
    weightBps: policy.weights[index],
    amount: reserve * policy.weights[index] / 10000n,
  }));

  if (allocations.reduce((sum, item) => sum + item.amount, 0n) !== reserve) {
    throw new Error("SIMULATION_ALLOCATION_MISMATCH");
  }

  return {
    price: policy.price,
    reserve,
    outsideReserve: policy.price - reserve,
    allocations,
  };
}
