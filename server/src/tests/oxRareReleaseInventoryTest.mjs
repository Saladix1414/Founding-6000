import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { CommerceCore } from '../../../cloudflare/commerceCore.mjs';
import { rareArcadeRelease } from '../../../cloudflare/rareArcadeRelease.mjs';
import { initializeRareRelease } from '../../../cloudflare/rareReleaseInventory.mjs';

function harness(release) {
  const db = new DatabaseSync(':memory:');
  const storage = {
    sql: { exec(query, ...args) {
      if (!args.length && query.includes(';')) { db.exec(query); return {toArray:()=>[]}; }
      const stmt = db.prepare(query);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(query)) return {toArray:()=>stmt.all(...args)};
      stmt.run(...args); return {toArray:()=>[]};
    } },
    transactionSync(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const v=fn(); db.exec('COMMIT'); return v; }
      catch(e) { db.exec('ROLLBACK'); throw e; }
    }
  };
  db.exec(`CREATE TABLE audit_events (id TEXT PRIMARY KEY,event_type TEXT,entity_type TEXT,entity_id TEXT,payload_json TEXT,created_at TEXT)`);
  const core = new CommerceCore(storage,{rareRelease:release});
  core.initializeSchema();core.initializeRareRelease();core.initializeRareRelease();
  return {db,storage,core};
}
const disabled = harness(rareArcadeRelease);
assert.throws(()=>disabled.core.createOrder({email:'buyer@example.org',idempotencyKey:'disabled-order-1'}),/NFT_RELEASE_NOT_APPROVED/);
assert.equal(disabled.db.prepare('SELECT COUNT(*) AS n FROM founding_orders').get().n,0);
console.log('UNAPPROVED_RELEASE_FAIL_CLOSED=PASS');

const release = {...rareArcadeRelease,approvedForSale:true}; // Local fixture only.
const {db,storage,core} = harness(release);
const pending = [];
for(let i=0;i<100;i++) {
  const payload={email:`buyer${i}@example.org`,idempotencyKey:`rare-order-${i}`};
  const order=core.createOrder(payload);
  assert.equal(core.createOrder(payload).idempotentReplay,true);
  const attempt=core.createUsdtAttempt({orderPublicId:order.order.publicId,idempotencyKey:`rare-attempt-${i}`});
  const txHash='0x'+(i+1).toString(16).padStart(64,'0');
  core.submitUsdtHash({paymentAttemptPublicId:attempt.attempt.publicId,txHash});
  pending.push({attempt,txHash});
}
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nft_release_assets WHERE state='RESERVED'").get().n,100);
assert.throws(()=>core.createOrder({email:'overflow@example.org',idempotencyKey:'overflow-order'}),/NFT_RELEASE_SOLD_OUT/);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM founding_orders').get().n,100);

function transfer(p) {
 return {txHash:p.txHash,chainId:1,tokenContract:'0xdAC17F958D2ee523a2206206994597C13D831ec7',
 receiverAddress:'0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840',amountMinor:'50000000',confirmations:12,
 blockNumber:100000,blockHash:'0x'+'a'.repeat(64),fromAddress:'0x'+'1'.repeat(40),logIndex:0};
}
// A delivery insert failure must roll back payment, allocation AND asset state.
db.exec(`CREATE TRIGGER fail_delivery BEFORE INSERT ON nft_mint_jobs
  WHEN NEW.serial_number = 101 BEGIN SELECT RAISE(ABORT,'DELIVERY_FAILURE'); END`);
const failing = pending[99];
assert.throws(()=>core.settleVerifiedUsdt({paymentAttemptPublicId:failing.attempt.attempt.publicId,transfer:transfer(failing)}),/DELIVERY_FAILURE/);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory_allocations').get().n,0);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_settlements').get().n,0);
assert.equal(db.prepare("SELECT state FROM nft_release_assets WHERE serial_number=101").get().state,'RESERVED');
db.exec('DROP TRIGGER fail_delivery');
console.log('DELIVERY_FAILURE_ATOMIC_ROLLBACK=PASS');

// Settle in reverse order: each buyer must get their reserved serial, not MAX()+1.
for(let i=99;i>=0;i--) {
 const p=pending[i];
 const payload={paymentAttemptPublicId:p.attempt.attempt.publicId,transfer:transfer(p)};
 const result=core.settleVerifiedUsdt(payload);
 assert.equal(result.allocation.serialNumber,i+2);
 assert.equal(core.settleVerifiedUsdt(payload).idempotentReplay,true);
}
for(const table of ['inventory_allocations','founding_memberships','nft_mint_jobs','payment_settlements']) {
 assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,100);
}
assert.equal(db.prepare('SELECT MIN(serial_number) AS n FROM inventory_allocations').get().n,2);
assert.equal(db.prepare('SELECT MAX(serial_number) AS n FROM inventory_allocations').get().n,101);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nft_release_assets WHERE state='ALLOCATED'").get().n,100);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM founding_memberships WHERE activation_started_at IS NOT NULL').get().n,0);
const altered=structuredClone(release);altered.items[0].mediaHash='0'.repeat(64);
assert.throws(()=>initializeRareRelease(storage,altered),/IMMUTABLE_CONFLICT/);
const repeated=structuredClone(release);repeated.items.push(repeated.items[0]);
assert.throws(()=>initializeRareRelease(storage,repeated),/NFT_RELEASE_INVALID/);
console.log('100_ORDERS_100_DISTINCT_ASSETS=PASS');
console.log('ONE_NFT_PER_SETTLED_SALE_AND_REPLAY=PASS');
console.log('REVERSE_SETTLEMENT_RESERVATION_BINDING=PASS');
console.log('SOLD_OUT_AT_100_AND_ROLLBACK=PASS');
console.log('AZHURAK_RESERVED_AND_MEMBERSHIP_NOT_STARTED=PASS');
console.log('RELEASE_IMMUTABILITY=PASS');
