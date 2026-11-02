import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getAddress, Interface } from 'ethers';
import { CommerceCore } from '../../../cloudflare/commerceCore.mjs';
import { rareArcadeRelease } from '../../../cloudflare/rareArcadeRelease.mjs';
import { prepareNftMintReadiness } from '../../../cloudflare/nftMintReadinessTransition.mjs';
import { initializePaidDeliveryIntentSchema, preparePaidDeliveryIntent } from '../../../cloudflare/nftPaidDeliveryIntent.mjs';

// In-memory fixtures only: no network, production orders or real payment evidence.
const db = new DatabaseSync(':memory:');
const storage = {
  sql: { exec(query, ...args) {
    if (!args.length && query.includes(';')) { db.exec(query); return {toArray:()=>[]}; }
    const stmt = db.prepare(query);
    const rows = /^\s*(SELECT|WITH|PRAGMA)/i.test(query) ? stmt.all(...args) : (stmt.run(...args), []);
    return {toArray:()=>rows};
  } },
  transactionSync(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); db.exec('COMMIT'); return result; }
    catch(error) { db.exec('ROLLBACK'); throw error; }
  },
};
db.exec('CREATE TABLE audit_events (id TEXT PRIMARY KEY,event_type TEXT,entity_type TEXT,entity_id TEXT,payload_json TEXT,created_at TEXT)');
const core = new CommerceCore(storage, {rareRelease:{...rareArcadeRelease,approvedForSale:true}});
core.initializeSchema(); core.initializeRareRelease();
initializePaidDeliveryIntentSchema(storage); initializePaidDeliveryIntentSchema(storage);
const now=Date.now(), stamp=new Date(now).toISOString();
const wallet=getAddress('0x1111111111111111111111111111111111111111');
const jobs=[];
for (let i=0;i<100;i++) {
  const order=core.createOrder({email:`fixture${i}@example.org`,idempotencyKey:`intent-order-${i}`});
  const attempt=core.createUsdtAttempt({orderPublicId:order.order.publicId,idempotencyKey:`intent-attempt-${i}`});
  const txHash='0x'+(i+1).toString(16).padStart(64,'0');
  core.submitUsdtHash({paymentAttemptPublicId:attempt.attempt.publicId,txHash});
  core.settleVerifiedUsdt({paymentAttemptPublicId:attempt.attempt.publicId,transfer:{
    txHash,chainId:1,tokenContract:'0xdAC17F958D2ee523a2206206994597C13D831ec7',
    receiverAddress:'0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840',amountMinor:'50000000',confirmations:12,
    blockNumber:100000,blockHash:'0x'+'a'.repeat(64),fromAddress:wallet,senderAddress:wallet,logIndex:0,
  }});
  const job=db.prepare('SELECT j.* FROM nft_mint_jobs j JOIN founding_orders o ON o.id=j.order_id WHERE o.public_id=?').get(order.order.publicId);
  assert.ok(job,'Core order id required');
  const challenge=crypto.randomUUID(), binding=crypto.randomUUID();
  db.prepare(`INSERT INTO nft_wallet_challenges
    (id,membership_id,wallet_address,nonce,challenge_message,status,created_at,expires_at,verified_at)
    VALUES (?,?,?,?,'offline fixture','VERIFIED',?,?,?)`).run(challenge,job.membership_id,wallet,crypto.randomUUID(),stamp,new Date(now+300000).toISOString(),stamp);
  db.prepare(`INSERT INTO nft_claim_grants (id,membership_id,token_hash,status,expires_at,consumed_at,created_at)
    VALUES (?,?,?,'CONSUMED',?,?,?)`).run(crypto.randomUUID(),job.membership_id,crypto.randomUUID(),new Date(now+300000).toISOString(),stamp,stamp);
  db.prepare(`INSERT INTO nft_wallet_bindings
    (id,membership_id,challenge_id,wallet_address,chain_id,status,bound_at)
    VALUES (?,?,?,?,8453,'BOUND',?)`).run(binding,job.membership_id,challenge,wallet,stamp);
  db.prepare(`INSERT INTO nft_wallet_binding_events (id,binding_id,membership_id,challenge_id,event_type,created_at)
    VALUES (?,?,?,?,'WALLET_BOUND',?)`).run(crypto.randomUUID(),binding,job.membership_id,challenge,stamp);
  prepareNftMintReadiness({storage,membershipId:job.membership_id,email:`fixture${i}@example.org`,authorizeReadiness:()=>true,now});
  jobs.push(job);
}
function prepare(job=jobs[0], extra={}) {
  return preparePaidDeliveryIntent({storage,mintJobId:job.id,authorizePreparation:()=>true,now,...extra});
}
function count() { return db.prepare('SELECT count(*) AS n FROM nft_paid_delivery_intents').get().n; }
const protectedTables=['founding_orders','payment_attempts','payment_settlements','inventory_allocations','founding_memberships','nft_mint_jobs','nft_release_assets'];
function snapshot() { return JSON.stringify(protectedTables.map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all())); }
const before=snapshot();
for (const auth of [undefined,()=>false,()=>Promise.resolve(true),()=>{throw Error('denied');}]) assert.throws(()=>prepare(jobs[0],{authorizePreparation:auth}));
assert.equal(count(),0);
db.exec(`CREATE TRIGGER fail_intent AFTER INSERT ON nft_paid_delivery_intents BEGIN SELECT RAISE(ABORT,'INTENT_FAILURE'); END`);
assert.throws(()=>prepare(),/INTENT_FAILURE/);
assert.equal(count(),0); assert.equal(snapshot(),before);
db.exec('DROP TRIGGER fail_intent');
console.log('PREPARATION_AUTHORITY_REQUIRED=PASS');
console.log('ATOMIC_INTENT_WRITE_ROLLBACK=PASS');
const abi=new Interface(['function mint(address to,uint256 tokenId)']);
for (const job of jobs) {
  const first=prepare(job), replay=prepare(job,{now:now+1000});
  assert.equal(first.idempotentReplay,false); assert.equal(replay.idempotentReplay,true);
  assert.equal(first.intentId,replay.intentId); assert.equal(first.intentHash,replay.intentHash);
  assert.equal(first.payload.tokenId,job.serial_number);
  const decoded=abi.decodeFunctionData('mint',first.payload.calldata);
  assert.equal(decoded[0],wallet); assert.equal(decoded[1],BigInt(job.serial_number));
  assert.equal(first.payload.contractAddress,null);
  for(const key of ['sponsorshipApproved','mintAuthority','transactionSubmitted','membershipActivated']) assert.equal(first[key],false);
}
assert.equal(count(),100); assert.equal(snapshot(),before);
assert.equal(db.prepare('SELECT min(serial_number) AS n FROM nft_paid_delivery_intents').get().n,2);
console.log('100_SETTLED_ORDERS_100_UNIQUE_INTENTS=PASS');
console.log('REPLAY_RETURNS_SAME_INTENT=PASS');
console.log('CALLDATA_BINDS_ALLOCATED_TOKEN_AND_BOUND_WALLET=PASS');
console.log('PAYMENT_JOB_AND_MEMBERSHIP_STATES_UNCHANGED=PASS');
console.log('AZHURAK_NOT_ALLOCATED=PASS');

function mutate(table,column,value,whereColumn,key) {
  const old=db.prepare(`SELECT ${column} AS v FROM ${table} WHERE ${whereColumn}=?`).get(key).v;
  db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${whereColumn}=?`).run(value,key);
  try { assert.throws(()=>prepare()); } finally { db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${whereColumn}=?`).run(old,key); }
}
const job=jobs[0];
const settlement=db.prepare('SELECT * FROM payment_settlements WHERE order_id=?').get(job.order_id);
db.prepare('DELETE FROM payment_settlements WHERE id=?').run(settlement.id);
assert.throws(()=>prepare());
db.prepare(`INSERT INTO payment_settlements (${Object.keys(settlement).join(',')}) VALUES (${Object.keys(settlement).map(()=>'?').join(',')})`).run(...Object.values(settlement));
console.log('PAID_LABEL_WITHOUT_SETTLEMENT_BLOCKED=PASS');
mutate('founding_orders','status','CANCELLED','id',job.order_id);
mutate('payment_attempts','status','REJECTED','order_id',job.order_id);
mutate('payment_settlements','confirmations',11,'order_id',job.order_id);
mutate('payment_settlements','amount_minor',1,'order_id',job.order_id);
mutate('payment_settlements','chain_id',84532,'order_id',job.order_id);
mutate('inventory_allocations','settlement_reference','0x'+'f'.repeat(64),'order_id',job.order_id);
mutate('nft_release_assets','state','RESERVED','order_id',job.order_id);
mutate('nft_release_assets','metadata_hash','f'.repeat(64),'order_id',job.order_id);
mutate('nft_mint_jobs','status','SUBMITTED','id',job.id);
mutate('nft_mint_jobs','mint_tx_hash','0x'+'f'.repeat(64),'id',job.id);
mutate('founding_memberships','activation_started_at',stamp,'id',job.membership_id);
db.prepare("UPDATE nft_wallet_challenges SET status='REVOKED',verified_at=NULL WHERE membership_id=?").run(job.membership_id);
assert.throws(()=>prepare());
db.prepare("UPDATE nft_wallet_challenges SET status='VERIFIED',verified_at=? WHERE membership_id=?").run(stamp,job.membership_id);
mutate('nft_paid_delivery_intents','intent_hash','f'.repeat(64),'mint_job_id',job.id);
console.log('STALE_AND_SUBSTITUTED_CONTEXT_BLOCKED=PASS');
const replacement=getAddress('0x2222222222222222222222222222222222222222');
for(const [table,column,key] of [['nft_mint_jobs','recipient_address',job.id],['nft_wallet_bindings','wallet_address',job.membership_id],['nft_wallet_challenges','wallet_address',job.membership_id],['nft_mint_readiness_events','recipient_address',job.membership_id]]) {
  db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${table==='nft_mint_jobs'?'id':'membership_id'}=?`).run(replacement,key);
}
assert.throws(()=>prepare(),/NFT_PAID_DELIVERY_INTENT_UNAVAILABLE/);
console.log('CHANGED_VERIFIED_RECIPIENT_CANNOT_REBIND_INTENT=PASS');
assert.equal(count(),100);
console.log('NO_NETWORK_OR_SPONSORSHIP_REQUESTS=PASS');
console.log('NO_REAL_PAYMENTS_NO_MINT_NO_MEMBERSHIP_ACTIVATION=PASS');
db.close();
