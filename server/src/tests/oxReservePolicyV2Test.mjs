import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {referenceSaleV2,calculateReserveContributionV2,fullCloseV2,simulateManagedReserveScenario,investmentPreparationPlan} from '../../../shared/foundingReservePolicyV2.mjs';
import {simulateReferenceSale,simulateBatchClose,simulateHolderExit} from '../../../src/components/landing/economySimulation.ts';
const target=[40_000_000_000n,44_987_500_000n,30_000_000_000n];
const expected={RARE:[12_500_000n,0n,0n],EPIC:[8_750_000n,8_750_000n,0n],LEGENDARY:[3_337_500n,9_162_500n,10_000_000n]};
for(const tier of Object.keys(expected)) {
  const sale=referenceSaleV2(tier), ui=simulateReferenceSale(tier);
  assert.deepEqual(sale.allocations.map(a=>a.amountMinor),expected[tier]);
  assert.deepEqual(ui.allocations.map(a=>a.amount),expected[tier]);
  assert.equal(sale.allocations.reduce((s,a)=>s+a.amountMinor,0n),sale.reserveAmountMinor);
  assert.equal(sale.reserveAmountMinor*4n,sale.grossAmountMinor);
}
const totals=[0n,0n,0n];let count=0;
for(let serial=2;serial<=6000;serial++) {
  const tier=serial<=1000?'RARE':serial<=3000?'EPIC':'LEGENDARY';
  referenceSaleV2(tier).allocations.forEach((a,i)=>totals[i]+=a.amountMinor);count++;
}
assert.equal(count,5999);assert.deepEqual(totals,target);
assert.deepEqual(fullCloseV2().map(t=>t.reserve),target);
assert.deepEqual(simulateBatchClose().units.map(t=>t.reserve),target);
assert.deepEqual(fullCloseV2().map(t=>t.perNft),[40_000_000n,22_493_750n,10_000_000n]);
assert.equal(target.reduce((a,b)=>a+b),114_987_500_000n);
for(const bad of ['UNKNOWN','__proto__','constructor',null]) assert.throws(()=>referenceSaleV2(bad));
for(const bad of [0n,-1n,1,NaN,1_000_000_000_000_001n]) assert.throws(()=>calculateReserveContributionV2({tier:'RARE',grossAmountMinor:bad}));
assert.throws(()=>calculateReserveContributionV2({tier:'LEGENDARY',grossAmountMinor:4n}));
const base=114_987_500_000n;
const plan=investmentPreparationPlan();assert.ok(Object.isFrozen(plan));
assert.equal(plan.beforeCloseInvestedBps,0);assert.equal(plan.afterCloseMaxInvestedBps,1000);
assert.equal(plan.liquidTargetBps,9000);assert.equal(plan.executionAuthorized,false);
assert.equal(plan.redemptionAuthorized,false);assert.equal(plan.capitalGuaranteed,false);
const flat=simulateManagedReserveScenario(base,0,5);assert.equal(flat.closingReserve,base);
const moderate=simulateManagedReserveScenario(base,400,1);
assert.equal(moderate.openingInvested,11_498_750_000n);assert.equal(moderate.openingLiquid,103_488_750_000n);
assert.equal(moderate.netChange,459_950_000n);assert.equal(moderate.closingReserve,115_447_450_000n);
assert.equal(simulateManagedReserveScenario(base,800,1).netChange,919_900_000n);
assert.equal(simulateManagedReserveScenario(base,-2000,1).netChange,-2_299_750_000n);
assert.equal(simulateManagedReserveScenario(base,-10000,1).closingReserve,103_488_750_000n);
assert.equal(simulateHolderExit('RARE',400,1).modeledRedemption,40_160_000n);
for(const args of [[-1n,0,1],[1n,Infinity,1],[1n,10001,1],[1n,0,6],[1n,0,0]]) assert.throws(()=>simulateManagedReserveScenario(...args));
// V1 remains available for historical ledger calculations; it is not rewritten.
const legacy=readFileSync(new URL('../economics/foundingEconomicsPolicy.ts',import.meta.url),'utf8');
assert.match(legacy,/7000/);assert.match(legacy,/calculateReserveContributionV2/);
for(const label of ['V2_EXACT_PER_SALE_WATERFALL','5999_SALES_AND_RESERVED_AZHURAK','V2_TOTAL_RESERVE_CONSERVATION','TARGETS_40_22_49375_10','SHARED_FRONTEND_ENGINE_PARITY','INVALID_INPUTS_FAIL_CLOSED','90_LIQUID_10_INVESTED_ASSUMPTION','STRATEGY_RATE_NOT_APPLIED_TO_ENTIRE_FUND','STRESS_LOSS_AND_ANNUAL_REBALANCING','LEGACY_LEDGER_NOT_REWRITTEN','INVESTMENT_AND_REDEMPTION_EXECUTION_DISABLED']) console.log(label+'=PASS');
