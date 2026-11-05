/* Integration test: executes against the REAL CommerceCore in the user's repo.
 * Explicitly simulated with an in-memory DB and a locally approved fixture.
 * The production FoundingCore never enables this option. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {CommerceCore} from '../cloudflare/commerceCore.mjs';
import {rareArcadeRelease} from '../cloudflare/rareArcadeRelease.mjs';
import {initializeGenesisCandidateSchema,recordGenesisCandidate} from '../cloudflare/oxGenesisInventoryV4.mjs';
import {stageInventoryCutoverV5} from '../cloudflare/oxInventoryCutoverV5.mjs';
import {makeV5TestCertificate} from './oxV5Fixtures.mjs';
import {GENESIS_CHECKOUT_VERSION,previewGenesisCheckoutV6} from '../cloudflare/oxGenesisCheckoutV6.mjs';

function harness(withGenesis=true){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  const storage={sql:{exec(query,...params){
    if(!params.length && query.includes(';')){db.exec(query);return {toArray:()=>[]};}
    const stmt=db.prepare(query);
    if(/^\s*(SELECT|WITH|PRAGMA)/i.test(query))return {toArray:()=>stmt.all(...params)};
    stmt.run(...params);return {toArray:()=>[]};
  }},transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}}};
  db.exec('CREATE TABLE audit_events (id TEXT PRIMARY KEY,event_type TEXT,entity_type TEXT,entity_id TEXT,payload_json TEXT,created_at TEXT)');
  const release={...rareArcadeRelease,approvedForSale:true}; // TEST ONLY: never modify actual release.
  const original=new CommerceCore(storage,{rareRelease:release});
  original.initializeSchema();original.initializeRareRelease();
  if(!withGenesis)return {db,storage,core:original,release};
  initializeGenesisCandidateSchema(storage);
  const certificate=makeV5TestCertificate();recordGenesisCandidate({storage,certificate});
  const staged=stageInventoryCutoverV5({storage,genesisCertificate:certificate,authorizeStaging:()=>true});
  const genesisCheckout={version:GENESIS_CHECKOUT_VERSION,mode:'INTERNAL_REVIEW_ONLY',
    serialNumber:1,certificateHash:certificate.certificateHash,
    legacySnapshotHash:staged.legacySnapshotHash,salesActivationApproved:false,mintActivationApproved:false};
  const core=new CommerceCore(storage,{rareRelease:release,genesisCheckout});
  core.initializeRareRelease();
  return {db,storage,core,release,genesisCheckout};
}
function transfer(attempt,seed){return {txHash:seed,chainId:1,
  tokenContract:'0xdAC17F958D2ee523a2206206994597C13D831ec7',
  receiverAddress:'0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840',
  amountMinor:'50000000',confirmations:12,blockNumber:100000,
  blockHash:'0x'+'e'.repeat(64),fromAddress:'0x'+'1'.repeat(40),logIndex:0};}
function preparePayment(core,key,seed){
  const order=core.createOrder({email:`${key}@example.org`,idempotencyKey:`order-${key}`});
  const attempt=core.createUsdtAttempt({orderPublicId:order.order.publicId,idempotencyKey:`attempt-${key}`});
  core.submitUsdtHash({paymentAttemptPublicId:attempt.attempt.publicId,txHash:seed});
  return {order,attempt,seed};
}
function settle(core,p){return core.settleVerifiedUsdt({paymentAttemptPublicId:p.attempt.attempt.publicId,transfer:transfer(p.attempt,p.seed)});}

test('V6 integration remains fully disabled when CommerceCore has no genesisCheckout option',()=>{
  const f=harness(false);
  f.core.createOrder({email:'legacy@example.org',idempotencyKey:'order-legacy'});
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='ox_genesis_checkout_v6'").get().n,0);
});

test('V6 routes the first simulated order to #0001 and next one to legacy #0002',()=>{
  const f=harness();const before=f.db.prepare('SELECT COUNT(*) AS n FROM nft_release_assets').get().n;
  const first=preparePayment(f.core,'first','0x'+'a'.repeat(64));
  const again=f.core.createOrder({email:'first@example.org',idempotencyKey:'order-first'});
  assert.equal(again.idempotentReplay,true);
  const second=preparePayment(f.core,'second','0x'+'b'.repeat(64));
  assert.equal(f.db.prepare('SELECT state FROM ox_genesis_checkout_v6').get().state,'RESERVED');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM nft_release_assets').get().n,before);
  const settlement2=settle(f.core,second);
  const settlement1=settle(f.core,first);
  assert.equal(settlement1.allocation.serialNumber,1);
  assert.equal(settlement2.allocation.serialNumber,2);
  assert.equal(settle(f.core,first).idempotentReplay,true);
  assert.equal(settle(f.core,second).idempotentReplay,true);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM founding_memberships').get().n,2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM nft_mint_jobs').get().n,2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM payment_settlements').get().n,2);
  assert.equal(f.db.prepare("SELECT state FROM ox_genesis_checkout_v6 WHERE serial_number=1").get().state,'ALLOCATED');
  assert.equal(previewGenesisCheckoutV6({storage:f.storage,config:f.genesisCheckout,rareRelease:f.release}).mintAuthorized,false);
});

test('V6 settlement failure rolls back payment, membership, allocation and shadow state',()=>{
  const f=harness();const p=preparePayment(f.core,'fail','0x'+'c'.repeat(64));
  f.db.exec(`CREATE TRIGGER fail_v6_mint BEFORE INSERT ON nft_mint_jobs
    WHEN NEW.serial_number=1 BEGIN SELECT RAISE(ABORT,'SIMULATED_MINT_JOB_FAILURE'); END`);
  assert.throws(()=>settle(f.core,p),/SIMULATED_MINT_JOB_FAILURE/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM payment_settlements').get().n,0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM inventory_allocations').get().n,0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM founding_memberships').get().n,0);
  assert.equal(f.db.prepare("SELECT state FROM ox_genesis_checkout_v6").get().state,'RESERVED');
  f.db.exec('DROP TRIGGER fail_v6_mint');
  assert.equal(settle(f.core,p).allocation.serialNumber,1);
});

test('V6 fails closed on inconsistent V5 snapshot before any checkout opens',()=>{
  const f=harness();
  const second=new CommerceCore(f.storage,{rareRelease:f.release,
    genesisCheckout:{...f.genesisCheckout,certificateHash:'0'.repeat(64)}});
  assert.throws(()=>second.initializeRareRelease(),/V5_STAGE_MISMATCH/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM founding_orders').get().n,0);
});
