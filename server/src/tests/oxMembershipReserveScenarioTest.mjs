import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulateBusinessReserveYear} from '../../../shared/foundingBusinessScenario.mjs';
const cases=[
  [1000n,1800000000n,117247450000n,[30511304n,17378533n,17326359n]],
  [5000n,9000000000n,124447450000n,[32076521n,18630707n,18369837n]],
  [10000n,18000000000n,133447450000n,[34033043n,20195924n,19674185n]],
];
for(const [profit,contribution,final,perNft] of cases) {
  const result=simulateBusinessReserveYear(profit*1_000_000n);
  assert.equal(result.openingReserve,114_987_500_000n);
  assert.equal(result.financialResult,459_950_000n);
  assert.equal(result.annualBusinessContribution,contribution);
  assert.equal(result.closingReserve,final);
  assert.deepEqual(result.units.map(u=>u.closingPerNft),perNft);
  assert.equal(result.executionAuthorized,false);
  const allocated=result.units.reduce((s,u,i)=>s+u.closingPerNft*BigInt([1000,2000,3000][i]),0n);
  assert.ok(allocated<=final);assert.ok(final-allocated<6000n);
}
const noBusiness=simulateBusinessReserveYear(0n);assert.equal(noBusiness.annualBusinessContribution,0n);
assert.equal(noBusiness.closingReserve,115_447_450_000n);
assert.equal(simulateBusinessReserveYear(0n,0).closingReserve,114_987_500_000n);
assert.ok(simulateBusinessReserveYear(0n,-2000).increase<0n);
for(const invalid of [-1n,1,NaN,Infinity,null,1_000_000_000_000_001n]) assert.throws(()=>simulateBusinessReserveYear(invalid));
assert.throws(()=>simulateBusinessReserveYear(1n,10001));
const membership=readFileSync(new URL('../../../src/components/landing/FoundingMembership.tsx',import.meta.url),'utf8');
assert.match(membership,/Suscripción transferible con tu NFT/);
assert.match(membership,/transferir no genera otros 12 meses ni duplica el acceso/);
assert.match(membership,/aproximadamente 8 meses restantes/);
assert.match(membership,/activación válida/);
const ui=readFileSync(new URL('../../../src/components/landing/FoundationEconomy.tsx',import.meta.url),'utf8');
assert.match(ui,/50% de cada venta inicial verificada/);
assert.match(ui,/15% del beneficio neto realizado/);
assert.match(ui,/no beneficios actuales/);
assert.match(ui,/ox-business-reserve-scenario/);
for(const name of ['NET_PROFIT_15_PERCENT_SCENARIOS_EXACT','INITIAL_25_PERCENT_NOT_DOUBLE_COUNTED','BUSINESS_15_PERCENT_SEPARATE_FROM_INITIAL_RESERVE','NEW_CONTRIBUTIONS_LIQUID_NO_INVENTED_INTEREST','PER_NFT_PROPORTIONAL_ALLOCATION_AND_ROUNDING','NO_PROFIT_AND_STRESS_SCENARIOS','TRANSFER_REMAINDER_WITHOUT_TERM_RESET','NO_SUBSCRIPTION_OR_RESERVE_EXECUTION_AUTHORITY']) console.log(name+'=PASS');

const twoYear=simulateBusinessReserveYear(15_000_000_000n,400,2);
assert.equal(twoYear.totalBusinessContribution,54000000000n);
assert.equal(twoYear.financialResult,921739800n);
assert.equal(twoYear.closingReserve,169909239800n);
assert.deepEqual(twoYear.units.map(u=>u.closingPerNft),[41979610n,26525056n,24959838n]);
for(const profit of [1000n,5000n,10000n]) for(const term of [1,2]) {
  const r=simulateBusinessReserveYear(profit*1_000_000n,400,term);
  const growth=r.units.map(u=>u.increasePerNft);
  assert.ok(growth[0]>growth[1]&&growth[1]>growth[2]);
  const represented=r.units.reduce((sum,u,i)=>sum+u.closingPerNft*BigInt([1000,2000,3000][i]),0n);
  assert.ok(represented<=r.closingReserve&&r.closingReserve-represented<6000n);
}
for(const term of [0,3,5,1.5,NaN,Infinity]) assert.throws(()=>simulateBusinessReserveYear(1n,400,term));
assert.doesNotMatch(ui,/<select[^>]+id="ox-(?:investment|business)-years"/);
assert.match(ui,/const years = 1;/);
assert.match(ui,/const businessYears = 1;/);
assert.match(ui,/ox-investment-gain-per-nft/);
assert.match(ui,/useState\(400\)/);
const {simulateManagedReserveScenario}=await import('../../../shared/foundingReservePolicyV2.mjs');
for(const [opening,gain] of [[30_000_000n,120_000n],[16_997_500n,67_990n],[16_997_500n,67_990n]]) assert.equal(simulateManagedReserveScenario(opening,400,1).netChange,gain);
assert.ok(simulateManagedReserveScenario(40_000_000n,-2000,1).netChange<0n);
assert.match(ui,/ox-business-years/);
assert.match(ui,/pesos por NFT de 1,5 para RARE, 1,2 para EPIC y 1 para LEGENDARY/);
console.log('ONE_YEAR_DISPLAY_ONLY=PASS' );
console.log('INVESTMENT_GAIN_SEPARATE_FROM_BUSINESS_AND_PURCHASE=PASS');
console.log('BUSINESS_WEIGHTS_RARE_1_5_EPIC_1_2_LEGENDARY_1=PASS');
console.log('LARGER_LEGENDARY_SHARE_WITH_RARE_PER_NFT_PRIORITY=PASS');
console.log('TWO_YEAR_CONSERVATION_AND_NO_REINVESTMENT_OF_CONTRIBUTIONS=PASS');

assert.match(ui,/85% restante del beneficio neto/);
assert.match(ui,/no se cuentan como nuevos cobros mensuales/);
assert.doesNotMatch(ui,/negocio rentable|20% invertido|80% líquido/);
console.log("NO_GUARANTEED_PROFIT_OR_INCLUDED_SUBSCRIPTION_DOUBLE_COUNT=PASS");

assert.match(ui,/ox-reserve-investment-totals/);
const totalProjection=simulateManagedReserveScenario(114_987_500_000n,400,1);
assert.equal(totalProjection.openingReserve+totalProjection.netChange,totalProjection.closingReserve);
assert.equal(totalProjection.netChange,459_950_000n);
assert.equal(totalProjection.closingReserve,115_447_450_000n);
for(const rate of [-2000,0,200,400,800]) {
 const total=simulateManagedReserveScenario(114_987_500_000n,rate,1);
 assert.equal(total.openingReserve+total.netChange,total.closingReserve);
}
console.log('TOTAL_RESERVE_CAPITAL_AND_NET_RESULT_SEPARATE=PASS');
