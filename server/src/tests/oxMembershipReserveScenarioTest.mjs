import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulateBusinessReserveYear} from '../../../shared/foundingBusinessScenario.mjs';
const cases=[
  [3000n,7_200_000_000n,123_107_400_000n,[41_885_217n,23_925_873n,11_123_478n]],
  [15000n,36_000_000_000n,151_907_400_000n,[48_146_086n,28_934_569n,15_297_391n]],
  [30000n,72_000_000_000n,187_907_400_000n,[55_972_173n,35_195_439n,20_514_782n]],
];
for(const [profit,contribution,final,perNft] of cases) {
  const result=simulateBusinessReserveYear(profit*1_000_000n);
  assert.equal(result.openingReserve,114_987_500_000n);
  assert.equal(result.financialResult,919_900_000n);
  assert.equal(result.annualBusinessContribution,contribution);
  assert.equal(result.closingReserve,final);
  assert.deepEqual(result.units.map(u=>u.closingPerNft),perNft);
  assert.equal(result.executionAuthorized,false);
  const allocated=result.units.reduce((s,u,i)=>s+u.closingPerNft*BigInt([1000,2000,3000][i]),0n);
  assert.ok(allocated<=final);assert.ok(final-allocated<6000n);
}
const noBusiness=simulateBusinessReserveYear(0n);assert.equal(noBusiness.annualBusinessContribution,0n);
assert.equal(noBusiness.closingReserve,115_907_400_000n);
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
assert.match(ui,/25% de cada venta inicial verificada/);
assert.match(ui,/20% del beneficio neto mensual futuro/);
assert.match(ui,/no beneficios actuales/);
assert.match(ui,/ox-business-reserve-scenario/);
for(const name of ['TRIPLE_BUSINESS_PROFIT_SCENARIOS_EXACT','INITIAL_25_PERCENT_NOT_DOUBLE_COUNTED','BUSINESS_20_PERCENT_SEPARATE_FROM_INITIAL_RESERVE','NEW_CONTRIBUTIONS_LIQUID_NO_INVENTED_INTEREST','PER_NFT_PROPORTIONAL_ALLOCATION_AND_ROUNDING','NO_PROFIT_AND_STRESS_SCENARIOS','TRANSFER_REMAINDER_WITHOUT_TERM_RESET','NO_SUBSCRIPTION_OR_RESERVE_EXECUTION_AUTHORITY']) console.log(name+'=PASS');

const twoYear=simulateBusinessReserveYear(15_000_000_000n,400,2);
assert.equal(twoYear.totalBusinessContribution,72_000_000_000n);
assert.equal(twoYear.financialResult,1_847_159_200n);
assert.equal(twoYear.closingReserve,188_834_659_200n);
assert.deepEqual(twoYear.units.map(u=>u.closingPerNft),[56_294_733n,35_376_828n,20_595_422n]);
for(const profit of [3000n,15000n,30000n]) for(const term of [1,2]) {
  const r=simulateBusinessReserveYear(profit*1_000_000n,400,term);
  const growth=r.units.map(u=>u.increasePerNft);
  assert.ok(growth[0]>growth[1]&&growth[1]>growth[2]);
  const represented=r.units.reduce((sum,u,i)=>sum+u.closingPerNft*BigInt([1000,2000,3000][i]),0n);
  assert.ok(represented<=r.closingReserve&&r.closingReserve-represented<6000n);
}
for(const term of [0,3,5,1.5,NaN,Infinity]) assert.throws(()=>simulateBusinessReserveYear(1n,400,term));
assert.doesNotMatch(ui,/\[1,2,3,4,5\]/);
assert.match(ui,/ox-business-years/);
assert.match(ui,/pesos por NFT de 1,5 para RARE, 1,2 para EPIC y 1 para LEGENDARY/);
console.log('ONE_OR_TWO_YEAR_TERM_ONLY=PASS');
console.log('BUSINESS_WEIGHTS_RARE_1_5_EPIC_1_2_LEGENDARY_1=PASS');
console.log('LARGER_LEGENDARY_SHARE_WITH_RARE_PER_NFT_PRIORITY=PASS');
console.log('TWO_YEAR_CONSERVATION_AND_NO_REINVESTMENT_OF_CONTRIBUTIONS=PASS');
