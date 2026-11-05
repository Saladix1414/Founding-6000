import test from 'node:test';
import assert from 'node:assert/strict';
import {makeV5Storage} from './oxV5Fixtures.mjs';
import {initializeInventoryCutoverV5,previewInventoryCutoverV5,stageInventoryCutoverV5} from '../cloudflare/oxInventoryCutoverV5.mjs';
const run=(f,extra={})=>stageInventoryCutoverV5({storage:f.storage,genesisCertificate:f.certificate,authorizeStaging:()=>true,...extra});

test('V5 migration stages 0001 and preserves legacy rows byte-for-byte without modifying old schema',()=>{
  const f=makeV5Storage();const before=f.db.prepare('SELECT * FROM nft_release_assets ORDER BY serial_number').all();
  const preview=previewInventoryCutoverV5({storage:f.storage});
  assert.equal(preview.legacyRows,2);assert.equal(preview.genesisCandidateRecorded,true);
  const staged=run(f);assert.equal(staged.status,'STAGED_NOT_ACTIVE');assert.equal(staged.importedRows,3);
  assert.equal(staged.salesEnabled,false);assert.equal(staged.liveInventoryModified,false);
  assert.deepEqual(f.db.prepare('SELECT * FROM nft_release_assets ORDER BY serial_number').all(),before);
  const genesis=f.db.prepare('SELECT * FROM ox_release_assets_v5 WHERE serial_number=1').get();
  assert.equal(genesis.origin,'GENESIS_V4');assert.equal(genesis.metadata_path,'/nft/metadata/1.json');
  assert.equal(genesis.legacy_state,'PREPARED');assert.equal(genesis.legacy_order_id,null);
  const reserved=f.db.prepare('SELECT * FROM ox_release_assets_v5 WHERE serial_number=3').get();
  assert.equal(reserved.legacy_order_id,'legacy-order');assert.equal(reserved.legacy_state,'RESERVED');
  assert.equal(run(f).idempotentReplay,true);
});

test('V5 migration authorization is deny-by-default',()=>{
  const f=makeV5Storage();
  assert.throws(()=>stageInventoryCutoverV5({storage:f.storage,genesisCertificate:f.certificate}),/AUTHORIZATION_REQUIRED/);
  assert.throws(()=>run(f,{authorizeStaging:()=>false}),/AUTHORIZATION_DENIED/);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='ox_release_assets_v5'").get().n,0);
});

test('V5 migration rejects forged certificate and missing candidate',()=>{
  const f=makeV5Storage();
  assert.throws(()=>run(f,{genesisCertificate:{...f.certificate,metadataHash:'0'.repeat(64)}}),/CERTIFICATE_TAMPERED/);
  f.db.exec('DROP TRIGGER ox_genesis_candidate_immutable_delete');
  f.db.exec('DELETE FROM ox_genesis_asset_candidates_v4');
  assert.throws(()=>run(f),/GENESIS_CANDIDATE_NOT_VERIFIED/);
});

test('V5 rejects silent pre-existing token 0001 allocations',()=>{
  const f=makeV5Storage();f.db.exec("INSERT INTO inventory_allocations VALUES('legacy-order',1,'tx')");
  assert.throws(()=>run(f),/GENESIS_ALREADY_ASSIGNED/);
});

test('V5 rejects inconsistent historical reservation / allocation',()=>{
  const f=makeV5Storage();f.db.exec("UPDATE nft_release_assets SET state='ALLOCATED' WHERE serial_number=3");
  assert.throws(()=>run(f),/LEGACY_ORDER_STATE_MISMATCH|LEGACY_ALLOCATION_MISMATCH/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM nft_release_assets').get().n,2);
});

test('V5 staging transaction rolls back all shadow imports on failure',()=>{
  const f=makeV5Storage();initializeInventoryCutoverV5(f.storage);
  f.db.exec(`CREATE TRIGGER ox_v5_simulated_write_failure BEFORE INSERT ON ox_release_assets_v5
    WHEN NEW.serial_number=3 BEGIN SELECT RAISE(ABORT,'SIMULATED_V5_FAILURE'); END;`);
  assert.throws(()=>run(f),/SIMULATED_V5_FAILURE/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ox_release_assets_v5').get().n,0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ox_inventory_cutovers_v5').get().n,0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM nft_release_assets').get().n,2);
});

test('V5 immutable shadow history and detection of legacy drift',()=>{
  const f=makeV5Storage();run(f);
  assert.throws(()=>f.db.exec('DELETE FROM ox_release_assets_v5'),/OX_V5_INVENTORY_IMMUTABLE/);
  assert.throws(()=>f.db.exec('UPDATE ox_inventory_cutovers_v5 SET legacy_row_count=0'),/OX_V5_CUTOVER_IMMUTABLE/);
  f.db.exec("UPDATE nft_release_assets SET state='RESERVED',order_id='other' WHERE serial_number=2");
  f.db.exec("INSERT INTO founding_orders VALUES('other','CREATED',50)");
  assert.throws(()=>run(f),/STAGED_SNAPSHOT_CONFLICT/);
});

test('V5 imports previously allocated legacy rows with exact order binding',()=>{
  const f=makeV5Storage();
  f.db.exec("UPDATE founding_orders SET status='PAID' WHERE id='legacy-order'");
  f.db.exec("UPDATE nft_release_assets SET state='ALLOCATED' WHERE serial_number=3");
  f.db.exec("INSERT INTO inventory_allocations VALUES('legacy-order',3,'legacy-settlement')");
  const r=run(f);assert.equal(r.importedRows,3);
  assert.equal(f.db.prepare('SELECT legacy_state AS s FROM ox_release_assets_v5 WHERE serial_number=3').get().s,'ALLOCATED');
  assert.equal(f.db.prepare("SELECT status FROM founding_orders WHERE id='legacy-order'").get().status,'PAID');
});
