import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFoundingPolicySources } from '../scripts/auditFoundingPolicySources.mjs';

const mock = {
  'cloudflare/oxReservePolicyV4Draft.mjs': 'saleReserveNumerator: 50, reservedSerials: Object.freeze([])',
  'src/components/landing/economySimulation.ts': 'const reserve = price / 2n;',
  'cloudflare/rareReleaseInventory.mjs': 'if (item.tokenId < 2 || item.tokenId > 1000) throw Error();\nserial_number INTEGER PRIMARY KEY CHECK(serial_number BETWEEN 2 AND 1000)',
  'cloudflare/nftPaidDeliveryIntent.mjs': 'plan.tokenId < 2 || plan.tokenId > 1000\nserial_number INTEGER NOT NULL UNIQUE CHECK(serial_number BETWEEN 2 AND 1000)',
  'cloudflare/nftPostSaleRedemptionPreparation.mjs': "reservedSerial: 1, reserved.size !== 1",
  'docs/nft/OX-RESERVE-V2-AND-INVESTMENT-PLAN.md': '25%',
  'docs/nft/OX-RESERVE-V3-RARE-30.md': '25%',
};
function report(source=mock) {
  return analyzeFoundingPolicySources(p=>{
    if (!Object.hasOwn(source,p)) throw Error('missing');
    return source[p];
  });
}
test('source report finds blockers but never approves V4 operations',()=>{
  const a=report();
  assert.equal(a.checks.filter(c=>!c.pass&&c.required).length,3);
  assert.equal(a.sourceCompatible,false);
  assert.equal(a.productionCutoverApproved,false);
  assert.equal(a.reserveWriteAuthorized,false);
  assert.equal(a.redemptionAuthorized,false);
  assert.match(a.reportHash,/^[a-f0-9]{64}$/);
  assert.equal(report().reportHash,a.reportHash);
});
test('code compatibility alone does not allow financial policy activation',()=>{
  const source={...mock,
    'cloudflare/rareReleaseInventory.mjs':'serial_number INTEGER PRIMARY KEY CHECK(serial_number BETWEEN 1 AND 1000)',
    'cloudflare/nftPaidDeliveryIntent.mjs':'serial_number INTEGER NOT NULL UNIQUE CHECK(serial_number BETWEEN 1 AND 1000)',
    'cloudflare/nftPostSaleRedemptionPreparation.mjs':'reservedSerials: []',
  };
  const a=report(source);
  assert.equal(a.sourceCompatible,true);
  assert.equal(a.serverLegacyLedgerReconciled,false);
  assert.equal(a.productionCutoverApproved,false);
});
test('missing files produce blockers; never assume missing file is fixed',()=>{
  const source={...mock};delete source['cloudflare/rareReleaseInventory.mjs'];
  const a=report(source);
  assert.equal(a.checks.find(x=>x.id==='RARE_RELEASE_ACCEPTS_0001').pass,false);
  assert.equal(a.sourceFingerprints.find(x=>x.path==='cloudflare/rareReleaseInventory.mjs').sha256,null);
});
