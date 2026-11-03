import {fullCloseV3 as fullCloseV2,simulateManagedReserveScenario} from './foundingReservePolicyV3.mjs';
// Scenario assumptions only. No real profits, subscriptions or deposits are read.
export function simulateBusinessReserveYear(monthlyProfitMinor,strategyRateBps=400,years=1,units=fullCloseV2()) {
  if(typeof monthlyProfitMinor!=='bigint'||monthlyProfitMinor < 0n||monthlyProfitMinor>1_000_000_000_000_000n)
    throw new Error('INVALID_MONTHLY_PROFIT');
  const opening=units.reduce((s,u)=>s+u.reserve,0n);
  if(!Number.isInteger(years)||years<1||years>2) throw new Error('INVALID_BUSINESS_TERM');
  const financial=simulateManagedReserveScenario(opening,strategyRateBps,years);
  const annualBusinessContribution=monthlyProfitMinor*12n*1500n/10000n;
  const totalBusinessContribution=annualBusinessContribution*BigInt(years);
  const increase=totalBusinessContribution+financial.netChange;
  // Contributions stay liquid; no return is earned on them in this illustration.
  const closingReserve=opening+increase;
  // Future business contributions: per-NFT weights RARE 1.5, EPIC 1.2, LEGENDARY 1.
  // The 6,000-unit illustration has 69,000 total weight units (15/12/10 per NFT).
  const perNftWeights=[15n,12n,10n];
  const totalWeight=units.reduce((sum,u,i)=>sum+BigInt(u.supply)*perNftWeights[i],0n);
  return {monthlyProfitMinor,annualBusinessContribution,totalBusinessContribution,years,
    contributionPolicyVersion:'OX-BUSINESS-CONTRIBUTION-WEIGHTS-3',financialResult:financial.netChange,
    openingReserve:opening,closingReserve,increase,executionAuthorized:false,
    units:units.map((u,i)=>{
      const businessShare=totalBusinessContribution*BigInt(u.supply)*perNftWeights[i]/totalWeight;
      const categoryFinal=(opening === 0n ? 0n : financial.closingReserve*u.reserve/opening)+businessShare;
      const perNft=categoryFinal/BigInt(u.supply);
      return {tier:u.tier,openingPerNft:u.perNft,closingPerNft:perNft,increasePerNft:perNft-u.perNft};
    })};
}
