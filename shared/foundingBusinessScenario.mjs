import {fullCloseV2,simulateManagedReserveScenario} from './foundingReservePolicyV2.mjs';
// Scenario assumptions only. No real profits, subscriptions or deposits are read.
export function simulateBusinessReserveYear(monthlyProfitMinor,strategyRateBps=400) {
  if(typeof monthlyProfitMinor!=='bigint'||monthlyProfitMinor < 0n||monthlyProfitMinor>1_000_000_000_000_000n)
    throw new Error('INVALID_MONTHLY_PROFIT');
  const units=fullCloseV2();const opening=units.reduce((s,u)=>s+u.reserve,0n);
  const financial=simulateManagedReserveScenario(opening,strategyRateBps,1);
  const annualBusinessContribution=monthlyProfitMinor*12n*2000n/10000n;
  const increase=annualBusinessContribution+financial.netChange;
  // Contributions stay liquid; no return is earned on them in this illustration.
  const closingReserve=opening+increase;
  return {monthlyProfitMinor,annualBusinessContribution,financialResult:financial.netChange,
    openingReserve:opening,closingReserve,increase,executionAuthorized:false,
    units:units.map(u=>{
      const categoryFinal=closingReserve*u.reserve/opening;
      const perNft=categoryFinal/BigInt(u.supply);
      return {tier:u.tier,openingPerNft:u.perNft,closingPerNft:perNft,increasePerNft:perNft-u.perNft};
    })};
}
