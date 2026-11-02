import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preparePostSaleRedemption } from '../../../cloudflare/nftPostSaleRedemptionPreparation.mjs';
import { simulateHolderExit, simulateManagedReserveScenario } from '../../../src/components/landing/economySimulation.ts';

const allSales = Array.from({length:5999}, (_,i) => i+2);
const prepare = (settledSerials=allSales,reservedSerials=[1]) => preparePostSaleRedemption({settledSerials,reservedSerials});
const early=prepare(allSales.slice(0,-1));
assert.equal(early.status,'WAITING_FOR_SALES');
assert.deepEqual(early.missingSales,[6000]);
for (const sold of [[],[2],allSales]) {
  const result=prepare(sold);
  for (const key of ['burnAuthorized','redemptionAuthorized','reserveDebitAuthorized','transactionSubmitted','guaranteedProfit','settlementEvidenceAuthenticated']) assert.equal(result[key],false);
  assert.equal(result.reservePrincipalLockedBeforeVerifiedClose,true);
}
const completed=prepare();
assert.equal(completed.inputCoverageComplete,true);
assert.equal(completed.status,'COVERAGE_COMPLETE_EXECUTION_UNIMPLEMENTED');
assert.equal(completed.saleTarget,5999);
assert.throws(()=>prepare([1,...allSales]));
assert.throws(()=>prepare(allSales,[]));
assert.throws(()=>prepare(allSales,[1,2]));
for(const invalid of [[2,2],[0],[6001],[NaN],[2.5],['2'],null]) assert.throws(()=>prepare(invalid));

const expectations=[['RARE',30_000_000n,-20_000_000n],['EPIC',16_997_500n,-53_002_500n],['LEGENDARY',16_997_500n,-73_002_500n]];
for(const [tier,gross,difference] of expectations) {
  const preview=simulateHolderExit(tier,0,1);
  assert.equal(preview.modeledRedemption,gross);
  assert.equal(preview.differenceBeforeFees,difference);
  assert.equal(preview.executable,false);
  assert.equal(simulateHolderExit(tier,-10000,1).modeledRedemption,gross*9n/10n);
  assert.ok(simulateHolderExit(tier,1000,2).modeledRedemption>gross);
  assert.ok(simulateHolderExit(tier,-1000,2).modeledRedemption<gross);
}
assert.throws(()=>simulateHolderExit('UNKNOWN',0,1));
assert.throws(()=>simulateHolderExit('RARE',Infinity,1));
assert.throws(()=>simulateHolderExit('RARE',0,0));
// Rounding stays in the reserve, not an overpayment.
const reserve=simulateManagedReserveScenario(30_000_000_000n,500,3).closingReserve;
const preview=simulateHolderExit('RARE',500,3);
assert.equal(preview.modeledRedemption*1000n+preview.roundingRemainder,reserve);
const policy=readFileSync(new URL('../economics/economicExitPolicy.ts',import.meta.url),'utf8');
assert.match(policy,/DISABLED_REQUIRES_FUTURE_POLICY/);
const ui=readFileSync(new URL('../../../src/components/landing/FoundationEconomy.tsx',import.meta.url),'utf8');
assert.match(ui,/Resultados netos de la venta por tandas hasta finalizar/);
assert.match(ui,/Estimado del resultado de inversiones tras finalizar la venta/);
assert.match(ui,/SIMULACIÓN · RESCATE NO HABILITADO/);
assert.match(ui,/Ganancia \/ pérdida antes de costes/);
for(const label of ['EXACT_SERIAL_COVERAGE_AND_RESERVED_AZHURAK','INCOMPLETE_SALES_KEEP_REDEMPTION_LOCKED','COVERAGE_NEVER_AUTHORIZES_PAYOUT_OR_BURN','MALFORMED_DUPLICATE_AND_SUBSTITUTED_SERIALS_REJECTED','HOLDER_GAIN_AND_LOSS_SHOWN_WITHOUT_CLAMPING','INVESTMENT_LOSS_AND_ROUNDING_CONSERVATION','EXISTING_EXIT_POLICY_REMAINS_DISABLED','AGREED_HEADINGS_PRESERVED']) console.log(label+'=PASS');
console.log('TRANSACTIONS_SENT=NO');
