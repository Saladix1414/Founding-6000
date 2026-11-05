import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { auditFoundingEconomicCutover, buildEconomicCutoverProposal } from '../cloudflare/oxEconomicCutoverAudit.mjs';
import { initializeReserveRegistry, recordVerifiedReserveMovement } from '../cloudflare/oxReserveRegistry.mjs';

const tx = a => '0x' + a.repeat(64);
const address = a => '0x' + a.repeat(40);
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
function storage() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  return {
    sql: { exec(sql,...params) {
      if (!params.length && !/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)) { db.exec(sql); return {toArray:()=>[]}; }
      const stmt = db.prepare(sql);
      if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)) return {toArray:()=>stmt.all(...params)};
      stmt.run(...params); return {toArray:()=>[]};
    } },
    transactionSync(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const out=fn(); db.exec('COMMIT'); return out; }
      catch(err) { db.exec('ROLLBACK'); throw err; }
    },
  };
}
function setup() {
  const s=storage();
  s.sql.exec(`
    CREATE TABLE founding_orders (id TEXT PRIMARY KEY, status TEXT, reference_price_usd INTEGER);
    CREATE TABLE founding_memberships (id TEXT PRIMARY KEY, order_id TEXT, serial_number INTEGER);
    CREATE TABLE inventory_allocations (id TEXT PRIMARY KEY, order_id TEXT, serial_number INTEGER, settlement_reference TEXT);
    CREATE TABLE payment_settlements (id TEXT PRIMARY KEY, order_id TEXT, external_reference TEXT, amount_minor INTEGER,
      network TEXT,chain_id INTEGER,token_contract TEXT,receiver_address TEXT,confirmations INTEGER,payment_attempt_id TEXT);
    CREATE TABLE payment_attempts (id TEXT PRIMARY KEY, order_id TEXT, tx_hash TEXT, status TEXT, chain_id INTEGER,
      network TEXT,token_contract TEXT,token_decimals INTEGER,receiver_address TEXT,expected_amount_minor INTEGER);
    CREATE TABLE nft_release_assets (serial_number INTEGER PRIMARY KEY, state TEXT);
  `);
  initializeReserveRegistry(s);
  return s;
}
function addSale(s, {number=2, serial=number, amount=null, confirmations=12, status='PAID', settled=true}={}) {
  const id='sale-'+number, hash='0x'+number.toString(16).padStart(64,'0');
  const price= serial<=1000?50:serial<=3000?70:90;
  const minor=amount ?? price*1_000_000;
  s.sql.exec('INSERT INTO founding_orders VALUES (?,?,?)',id,status,price);
  s.sql.exec('INSERT INTO founding_memberships VALUES (?,?,?)', 'member-'+number,id,serial);
  s.sql.exec('INSERT INTO inventory_allocations VALUES (?,?,?,?)','allocation-'+number,id,serial,hash);
  if (settled) {
    s.sql.exec('INSERT INTO payment_attempts VALUES (?,?,?,?,?,?,?,?,?,?)', 'attempt-'+number,id,hash,'VERIFIED',1,'ethereum-mainnet',USDT,6,address('a'),minor);
    s.sql.exec('INSERT INTO payment_settlements VALUES (?,?,?,?,?,?,?,?,?,?)', 'settlement-'+number,id,hash,minor,'ethereum-mainnet',1,USDT,address('a'),confirmations,'attempt-'+number);
  }
}
function post(s, key, kind, amount, serial=2, version='OX-LEGACY-25') {
  return recordVerifiedReserveMovement({storage:s, movement:{eventKey:key,kind,amountMinor:amount,
    chainId:1,policyVersion:version,sourceReference:'settlement-'+serial,evidenceHash:'f'.repeat(64), serialNumber:serial},
    authorize:()=>true,verifyEvidence:()=>true});
}

test('read-only audit identifies missing required tables and remains blocked',()=>{
  const s=storage();
  const audit=auditFoundingEconomicCutover({storage:s});
  assert.equal(audit.status,'NOT_APPROVED_FOR_CUTOVER_OR_TRANSACTIONS');
  assert.equal(audit.issues.some(x=>x.code==='MISSING_FOUNDING_ORDERS'),true);
  assert.equal(audit.autoPostingAllowed,false);
  assert.equal(audit.oldServerLedgerIndependentlyReconciled,false);
});

test('verified paid receipts are accounted but never revalued as actual V4 ledger',()=>{
  const s=setup(); addSale(s,{number:2}); addSale(s,{number:1001,serial:1001});addSale(s,{number:3001,serial:3001});
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.paidOrders,3);
  assert.equal(a.verifiedPaidOrdersFromLocalRecords,3);
  assert.equal(a.localVerifiedGrossMinor,'210000000');
  assert.equal(a.hypothetical50PercentReserveMinorForAlreadyPaidOrders,'105000000');
  assert.deepEqual(a.historicalAccrualPolicies,[]);
  assert.equal(a.serial0001.policyTargetReserved,false);
  assert.equal(a.serial0001.releaseAssetPresent,false);
  assert.equal(a.treasuryCustodyVerified,false);
});

test('invalid settlement amount / confirmations or missing payment rejected',()=>{
  const s=setup();addSale(s,{number:2,confirmations:3}); addSale(s,{number:3,amount:49_000_000}); addSale(s,{number:4,settled:false});
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.paidOrders,3);assert.equal(a.verifiedPaidOrdersFromLocalRecords,0);
  assert.equal(a.issues.filter(x=>x.code==='PAID_ORDER_SETTLEMENT_UNVERIFIED_OR_PRICE_MISMATCH').length,2);
  assert.equal(a.issues.some(x=>x.code==='PAID_ORDER_EVIDENCE_INCOMPLETE'),true);
});

test('no reserved #0001 policy may count a valid settlement, without activating release',()=>{
  const s=setup();addSale(s,{number:1,serial:1});
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.serial0001.localPaidSalePresent,true);
  assert.equal(a.serial0001.releaseAssetPresent,false);
  assert.equal(a.verifiedPaidOrdersFromLocalRecords,1);
  assert.equal(a.approvalGranted,false);
});

test('historical 25% accrual remains unchanged and is separately classified',()=>{
  const s=setup();addSale(s,{number:2});post(s,'accrual:0002','ACCRUAL',12_500_000);
  const before=s.sql.exec('SELECT amount_minor FROM ox_reserve_movements').toArray()[0].amount_minor;
  const a=auditFoundingEconomicCutover({storage:s});
  const after=s.sql.exec('SELECT amount_minor FROM ox_reserve_movements').toArray()[0].amount_minor;
  assert.equal(before,after);
  assert.equal(a.historicalAccrualPolicies[0].policyVersion,'OX-LEGACY-25');
  assert.equal(a.historicalAccrualPolicies[0].recordedMinor,'12500000');
  assert.equal(a.verifiedLocalSettlementsWithJournalAccrual,1);
  assert.equal(a.hypothetical50PercentReserveMinorForAlreadyPaidOrders,'25000000');
});

test('unlinked accruals flagged, historical ledger unchanged',()=>{
  const s=setup();addSale(s,{number:2});post(s,'accrual:orphan','ACCRUAL',12_500_000,3);
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.issues.some(x=>x.code==='SALE_ACCRUAL_SOURCE_NOT_LINKED'),true);
});

test('same-source dual accrual flagged without modifying rows',()=>{
  const s=setup();addSale(s,{number:2});post(s,'accrual:0002','ACCRUAL',12_500_000);
  post(s,'accrual:0002:again','ACCRUAL',12_500_000);
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.issues.some(x=>x.code==='MULTIPLE_ACCRUALS_FOR_SALE'),true);
});

test('deterministic report hash; cutover proposal binds audit, never activates',()=>{
  const s=setup();addSale(s,{number:2});
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(auditFoundingEconomicCutover({storage:s}).reportHash,a.reportHash);
  const b=buildEconomicCutoverProposal({audit:a,expectedReportHash:a.reportHash,effectiveAfterUtc:'2026-12-01T00:00:00.000Z'});
  assert.equal(b.newPrimarySaleReservePercent,50);
  assert.deepEqual(b.reservedSerials,[]);
  assert.equal(b.canApply,false); assert.equal(b.canPostNewEntries,false);
  assert.equal(b.historicalMoneyReclassificationAuthorized,false);
  assert.equal(b.canEnableRedemption,false);
  assert.match(b.proposalHash,/^[a-f0-9]{64}$/);
  assert.throws(()=>buildEconomicCutoverProposal({audit:a,expectedReportHash:'0'.repeat(64),effectiveAfterUtc:'2026-12-01T00:00:00.000Z'}),/OX_CUTOVER_AUDIT_MISMATCH/);
  assert.throws(()=>buildEconomicCutoverProposal({audit:a,expectedReportHash:a.reportHash,effectiveAfterUtc:'bad'}),/OX_CUTOVER_TIMESTAMP_INVALID/);
});

test('paid orders with duplicated relationships cannot inflate sums',()=>{
  const s=setup();addSale(s,{number:2});
  s.sql.exec("INSERT INTO founding_memberships VALUES('member-duplicate','sale-2',2)");
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.paidOrders,1);assert.equal(a.verifiedPaidOrdersFromLocalRecords,0);
  assert.equal(a.issues.filter(x=>x.code==='AMBIGUOUS_PAID_ORDER_RELATIONSHIP').length,1);
});

test('settlement is not accepted if attempt belongs to a different order',()=>{
  const s=setup();addSale(s,{number:2});
  s.sql.exec("UPDATE payment_attempts SET order_id='foreign-order' WHERE id='attempt-2'");
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.verifiedPaidOrdersFromLocalRecords,0);
  assert.equal(a.issues.some(x=>x.code==='PAID_ORDER_SETTLEMENT_UNVERIFIED_OR_PRICE_MISMATCH'),true);
});

test('audit never executes INSERT, UPDATE, DELETE, PRAGMA mutations or begins a transaction',()=>{
  const s=setup();addSale(s,{number:2});
  const original=s.sql.exec;
  s.sql.exec=(query,...args)=>{
    assert.match(query.trim(),/^SELECT\b/i);
    return original(query,...args);
  };
  const a=auditFoundingEconomicCutover({storage:s});
  assert.equal(a.verifiedPaidOrdersFromLocalRecords,1);
});
