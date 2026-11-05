import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readPurchaseMonitorV8,authorizePurchaseMonitorV8,handlePurchaseMonitorV8 } from '../cloudflare/oxPurchaseMonitorV8.mjs';
const key='v'.repeat(48);
const url='https://founding-core.internal/internal/ops/purchase-status-v8';
function request(value=key,method='GET',path=url){return new Request(path,{method,headers:{'x-ox-monitor-key':value}})}
const env={OX_PURCHASE_MONITOR_V8_ENABLED:'true',OX_PURCHASE_MONITOR_V8_KEY:key};
function setup(){
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE founding_orders(id TEXT PRIMARY KEY,status TEXT,reference_price_usd INTEGER,email TEXT);
    CREATE TABLE payment_attempts(id TEXT PRIMARY KEY,order_id TEXT,status TEXT,tx_hash TEXT,token_contract TEXT,receiver_address TEXT,expected_amount_minor INTEGER);
    CREATE TABLE payment_settlements(id TEXT PRIMARY KEY,order_id TEXT,payment_attempt_id TEXT,external_reference TEXT,chain_id INTEGER,network TEXT,confirmations INTEGER,token_contract TEXT,receiver_address TEXT,amount_minor INTEGER);
    CREATE TABLE inventory_allocations(order_id TEXT,serial_number INTEGER,settlement_reference TEXT);
    CREATE TABLE founding_memberships(id TEXT PRIMARY KEY,order_id TEXT,serial_number INTEGER);
    CREATE TABLE nft_mint_jobs(id TEXT PRIMARY KEY,order_id TEXT,serial_number INTEGER,status TEXT);`);
  const storage={sql:{exec(q,...p){const stmt=db.prepare(q);return{toArray:()=>stmt.all(...p)}}}};
  return {db,storage};
}
const usdt='0xdac17f958d2ee523a2206206994597c13d831ec7',receiver='0x'+'4'.repeat(40),tx='0x'+'a'.repeat(64);
function insertPaid(db){
  db.prepare("INSERT INTO founding_orders VALUES('order-1','PAID',50,?)").run('buyer@example.com');
  db.prepare("INSERT INTO payment_attempts VALUES('attempt-1','order-1','VERIFIED',?,?,?,50000000)").run(tx,usdt,receiver);
  db.prepare("INSERT INTO payment_settlements VALUES('settlement-1','order-1','attempt-1',?,1,'ethereum-mainnet',12,?,?,50000000)").run(tx,usdt,receiver);
  db.prepare("INSERT INTO inventory_allocations VALUES('order-1',2,?)").run(tx);
  db.exec("INSERT INTO founding_memberships VALUES('member-1','order-1',2)");
  db.exec("INSERT INTO nft_mint_jobs VALUES('job-1','order-1',2,'AWAITING_WALLET')");
}
test('enabled gateway requires exact internal route and secret, no fail-open',()=>{
  assert.equal(authorizePurchaseMonitorV8(request(),env),true);
  for(const e of [{...env,OX_PURCHASE_MONITOR_V8_ENABLED:'false'},{...env,OX_PURCHASE_MONITOR_V8_KEY:'short'},{}]) assert.equal(authorizePurchaseMonitorV8(request(),e),false);
  assert.equal(authorizePurchaseMonitorV8(request('wrong'),env),false);
  assert.equal(authorizePurchaseMonitorV8(request(key,'POST'),env),false);
  assert.equal(authorizePurchaseMonitorV8(request(key,'GET',url+'/extra'),env),false);
});
test('missing DB tables are reported, never invented',()=>{
  const db=new DatabaseSync(':memory:'); const storage={sql:{exec(s){return{toArray:()=>db.prepare(s).all()}}}};
  const x=readPurchaseMonitorV8(storage);assert.equal(x.status,'SCHEMA_INCOMPLETE');assert.equal(x.missingTables.length,6);
});
test('coherent paid chain is aggregated without exposing PII',()=>{
  const {db,storage}=setup();insertPaid(db);const before=db.prepare('SELECT * FROM founding_orders').all();
  const a=readPurchaseMonitorV8(storage),b=readPurchaseMonitorV8(storage);
  assert.equal(a.reportHash,b.reportHash);assert.equal(a.status,'LOCAL_RECORDS_CONSISTENT');
  assert.equal(a.counts.orders.PAID,1);assert.equal(a.counts.mintJobs.AWAITING_WALLET,1);
  assert.equal(a.anomalies.inconsistentSettlements,0);assert.deepEqual(db.prepare('SELECT * FROM founding_orders').all(),before);
  assert.equal(JSON.stringify(a).includes('buyer@example.com'),false);
  assert.equal(JSON.stringify(a).includes(tx),false);
});
test('detects paid order with missing settlement and mint, never cancels order',()=>{
  const {db,storage}=setup();db.exec("INSERT INTO founding_orders VALUES('order-1','PAID',50,'someone@domain.com')");
  const a=readPurchaseMonitorV8(storage);assert.equal(a.status,'REVIEW_REQUIRED');
  assert.equal(a.anomalies.paidWithoutCompleteDeliveryChain,1);
  assert.equal(db.prepare('SELECT status FROM founding_orders').get().status,'PAID');
});
test('settlement anomalies and orphan allocations are reported',()=>{
  const {db,storage}=setup();insertPaid(db);db.exec("UPDATE payment_settlements SET confirmations=3");
  assert.equal(readPurchaseMonitorV8(storage).anomalies.inconsistentSettlements,1);
  db.exec("UPDATE inventory_allocations SET serial_number=3");
  assert.equal(readPurchaseMonitorV8(storage).anomalies.orphanOrMismatchedAllocations,1);
});
test('unauthorized GET does not touch database and authorized GET is privacy safe',async()=>{
  const {db,storage}=setup();insertPaid(db);
  const no=handlePurchaseMonitorV8({request:request('bad'),env,storage:{sql:{exec(){throw new Error('MUST_NOT_QUERY')}}}});
  assert.equal(no.status,404);
  const yes=handlePurchaseMonitorV8({request:request(),env,storage});assert.equal(yes.status,200);
  const body=await yes.json();assert.equal(body.counts.orders.PAID,1);assert.equal(body.independentChainProof,false);
  assert.equal(yes.headers.get('Cache-Control'),'no-store');
});
