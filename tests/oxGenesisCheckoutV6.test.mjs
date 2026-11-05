import test from 'node:test';
import assert from 'node:assert/strict';
import { makeV5Storage } from './oxV5Fixtures.mjs';
import { stageInventoryCutoverV5 } from '../cloudflare/oxInventoryCutoverV5.mjs';
import { initializeGenesisCheckoutV6, previewGenesisCheckoutV6,
  simulateGenesisReservationV6,readReservedGenesisV6,simulateGenesisAllocationV6,
  GENESIS_CHECKOUT_VERSION } from '../cloudflare/oxGenesisCheckoutV6.mjs';

const TX = '0x' + 'a'.repeat(64);
const release = Object.freeze({version:'OX-RARE-RELEASE-1',batchId:'rare-0002-0101',approvedForSale:true});
const phase = Object.freeze({id:'phase-genesis',code:'GENESIS',serialStart:1,serialEnd:1000,referencePriceUsd:50});
function f() {
  const x = makeV5Storage();
  const staged=stageInventoryCutoverV5({storage:x.storage,genesisCertificate:x.certificate,authorizeStaging:()=>true});
  x.db.exec('CREATE TABLE nft_mint_jobs (serial_number INTEGER)');
  const config={version:GENESIS_CHECKOUT_VERSION,mode:'INTERNAL_REVIEW_ONLY',serialNumber:1,
    certificateHash:x.certificate.certificateHash,legacySnapshotHash:staged.legacySnapshotHash,
    salesActivationApproved:false,mintActivationApproved:false};
  return {...x,config};
}
function setup(x) {return initializeGenesisCheckoutV6(x.storage,x.config,release);}
function reserve(x,orderId='v6-order',changes={}) {
  return simulateGenesisReservationV6(x.storage,x.config,release,orderId,{...phase,...changes});
}
function finish(x,orderId='v6-order',tx=TX) {
  return simulateGenesisAllocationV6(x.storage,x.config,release,orderId,1,tx);
}

test('V6 initializes exactly one token #0001; V5 and legacy remain unchanged',()=>{
  const x=f(); const legacy=x.db.prepare('SELECT * FROM nft_release_assets ORDER BY serial_number').all();
  const shadow=x.db.prepare('SELECT * FROM ox_release_assets_v5 ORDER BY serial_number').all();
  assert.equal(setup(x).state,'AVAILABLE');assert.equal(setup(x).state,'AVAILABLE');
  const p=previewGenesisCheckoutV6({storage:x.storage,config:x.config,rareRelease:release});
  assert.equal(p.availableForInternalSimulation,true);assert.equal(p.liveSalesApproved,false);
  assert.deepEqual(x.db.prepare('SELECT * FROM nft_release_assets ORDER BY serial_number').all(),legacy);
  assert.deepEqual(x.db.prepare('SELECT * FROM ox_release_assets_v5 ORDER BY serial_number').all(),shadow);
  assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM ox_genesis_checkout_v6').get().n,1);
});
test('V6 only allows approved release & pinned staged hashes, never a live-enabled flag',()=>{
  const x=f();
  for(const c of [{...x.config,mode:'LIVE'}, {...x.config,salesActivationApproved:true},
    {...x.config,mintActivationApproved:true},{...x.config,certificateHash:'0'.repeat(64)},
    {...x.config,legacySnapshotHash:'f'.repeat(64)}])
    assert.throws(()=>initializeGenesisCheckoutV6(x.storage,c,release),/OX_GENESIS_CHECKOUT_V6/);
  assert.throws(()=>initializeGenesisCheckoutV6(x.storage,x.config,{...release,approvedForSale:false}),/POLICY_NOT_REVIEWABLE/);
});
test('V6 rejects checkout when V5 staging or Genesis candidate is absent',()=>{
  const x=f(); x.db.exec('DROP TABLE ox_inventory_cutovers_v5');
  assert.throws(()=>setup(x),/V5_STAGE_MISSING|no such table/);
  const y=f(); y.db.exec('DROP TRIGGER ox_genesis_candidate_immutable_delete');
  y.db.exec('DELETE FROM ox_genesis_asset_candidates_v4');
  assert.throws(()=>setup(y),/GENESIS_CANDIDATE_MISSING/);
});
test('V6 reserves #0001 once, then falls through to old RARE stock on second order',()=>{
  const x=f();setup(x);x.db.exec("INSERT INTO founding_orders VALUES('v6-order','CREATED',50)");
  assert.equal(reserve(x),true);
  assert.equal(readReservedGenesisV6(x.storage,x.config,release,'v6-order'),1);
  assert.equal(reserve(x,'other-order'),false);
  assert.equal(readReservedGenesisV6(x.storage,x.config,release,'other-order'),null);
  assert.equal(x.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'RESERVED');
  assert.equal(x.db.prepare("SELECT COUNT(*) AS n FROM ox_genesis_checkout_events_v6 WHERE event_type='RESERVED'").get().n,1);
});
test('V6 rejects wrong campaign, serial range or price',()=>{
  const x=f();setup(x);
  for(const bad of [{serialStart:2},{serialEnd:999},{referencePriceUsd:60},{code:'EARLY_ACCESS'},{id:'other'}])
    assert.throws(()=>reserve(x,'v6-order',bad),/PHASE_INVALID/);
  assert.equal(x.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'AVAILABLE');
});
test('V6 rejects reservation if #0001 is already paid in historical allocations',()=>{
  const x=f();setup(x);
  x.db.exec("INSERT INTO inventory_allocations VALUES('legacy-order',1,'tx')");
  assert.throws(()=>reserve(x),/SERIAL_ALREADY_SOLD/);
  assert.equal(x.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'AVAILABLE');
});
test('V6 allocation must follow verified CommerceCore inventory allocation',()=>{
  const x=f();setup(x);x.db.exec("INSERT INTO founding_orders VALUES('v6-order','CREATED',50)");reserve(x);
  assert.throws(()=>finish(x),/PAID_ALLOCATION_MISSING/);
  x.db.prepare('INSERT INTO inventory_allocations VALUES (?,1,?)').run('v6-order',TX);
  assert.equal(finish(x).allocated,true);
  assert.equal(readReservedGenesisV6(x.storage,x.config,release,'v6-order'),null);
  assert.equal(x.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'ALLOCATED');
  assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM ox_genesis_checkout_events_v6').get().n,2);
  assert.throws(()=>finish(x),/RESERVATION_MISSING/);
});
test('V6 detects wrong tx reference and misbound sale before allocation',()=>{
  const x=f();setup(x);x.db.exec("INSERT INTO founding_orders VALUES('v6-order','CREATED',50)");reserve(x);
  x.db.exec("INSERT INTO inventory_allocations VALUES('v6-order',1,'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')");
  assert.throws(()=>finish(x),/ALLOCATION_CONFLICT/);
  assert.equal(x.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'RESERVED');
});
test('V6 reservation transaction can rollback with no double-claim or orphan',()=>{
  const x=f();setup(x);
  x.db.exec(`CREATE TRIGGER fail_v6_event BEFORE INSERT ON ox_genesis_checkout_events_v6
    BEGIN SELECT RAISE(ABORT,'SIMULATED_EVENT_FAILURE'); END`);
  assert.throws(()=>x.storage.transactionSync(()=>reserve(x)),/SIMULATED_EVENT_FAILURE/);
  assert.equal(x.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'AVAILABLE');
  assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM ox_genesis_checkout_events_v6').get().n,0);
  x.db.exec('DROP TRIGGER fail_v6_event');
  assert.equal(x.storage.transactionSync(()=>reserve(x)),true);
});
test('V6 settlement rollback conserves RESERVED and original payment source',()=>{
  const x=f();setup(x);x.db.exec("INSERT INTO founding_orders VALUES('v6-order','CREATED',50)");
  x.storage.transactionSync(()=>reserve(x));
  x.db.exec(`CREATE TRIGGER fail_v6_allocation BEFORE INSERT ON ox_genesis_checkout_events_v6
    WHEN NEW.event_type='ALLOCATED' BEGIN SELECT RAISE(ABORT,'SIMULATED_ALLOCATION_FAILURE'); END`);
  assert.throws(()=>x.storage.transactionSync(()=>{
    x.db.prepare('INSERT INTO inventory_allocations VALUES (?,1,?)').run('v6-order',TX);
    finish(x);
  }),/SIMULATED_ALLOCATION_FAILURE/);
  assert.equal(x.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'RESERVED');
  assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM inventory_allocations WHERE serial_number=1').get().n,0);
});
test('V6 keeps sidecar history append-only; state does not authorize mint',()=>{
  const x=f();setup(x);reserve(x);
  assert.throws(()=>x.db.exec('DELETE FROM ox_genesis_checkout_events_v6'),/OX_GENESIS_V6_AUDIT_IMMUTABLE/);
  assert.throws(()=>x.db.exec("UPDATE ox_genesis_checkout_events_v6 SET event_type='ALLOCATED'"),/OX_GENESIS_V6_AUDIT_IMMUTABLE/);
  assert.equal(previewGenesisCheckoutV6({storage:x.storage,config:x.config,rareRelease:release}).mintAuthorized,false);
});
