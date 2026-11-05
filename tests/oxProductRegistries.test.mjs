import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { initializeFoundingProductRegistries } from '../cloudflare/oxProductRegistries.mjs';
import { registerSettledMembership, activateVerifiedMembership, observeVerifiedOwnershipTransfer, membershipAccessSnapshot } from '../cloudflare/oxMembershipRegistry.mjs';
import { recordVerifiedReserveMovement, reserveBalances } from '../cloudflare/oxReserveRegistry.mjs';
import { prepareRedemptionRequest, recordVerifiedAtomicRedemption } from '../cloudflare/oxRedemptionRegistry.mjs';
import { previewFoundingSaleReserve, previewFutureNetServicesReserve, previewPortfolioLimits } from '../cloudflare/oxReservePolicyV4Draft.mjs';

function storage() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  return {
    sql: { exec(sql, ...params) {
      if (!params.length && !/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)) { db.exec(sql); return { toArray: () => [] }; }
      const statement = db.prepare(sql);
      if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)) return { toArray: () => statement.all(...params) };
      statement.run(...params); return { toArray: () => [] };
    } },
    transactionSync(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
const authorized = () => true;
const verified = () => true;
const rejected = () => false;
const tx = hex => '0x' + hex.repeat(64);
const wallet = hex => '0x' + hex.repeat(40);
const NOW = Date.parse('2026-11-05T12:00:00.000Z');

function fixture() {
  const db = storage();
  db.sql.exec(`
    CREATE TABLE founding_orders (id TEXT PRIMARY KEY,status TEXT,reference_price_usd INTEGER);
    CREATE TABLE founding_memberships (id TEXT PRIMARY KEY,order_id TEXT,serial_number INTEGER,status TEXT,activation_started_at TEXT,activation_expires_at TEXT,updated_at TEXT);
    CREATE TABLE inventory_allocations (order_id TEXT,serial_number INTEGER,settlement_reference TEXT);
    CREATE TABLE payment_settlements (id TEXT,order_id TEXT,external_reference TEXT,payment_attempt_id TEXT,confirmations INTEGER,chain_id INTEGER,network TEXT,token_contract TEXT,receiver_address TEXT,amount_minor INTEGER);
    CREATE TABLE payment_attempts (id TEXT,order_id TEXT,tx_hash TEXT,status TEXT,network TEXT,chain_id INTEGER,token_contract TEXT,token_decimals INTEGER,receiver_address TEXT,expected_amount_minor INTEGER);
  `);
  initializeFoundingProductRegistries(db);
  const membershipId = randomUUID();
  db.sql.exec(`INSERT INTO founding_orders(id,status,reference_price_usd) VALUES('order-1','PAID',50)`);
  db.sql.exec(`INSERT INTO founding_memberships (id,order_id,serial_number,status) VALUES (?,'order-1',2,'ACTIVATION_PENDING')`, membershipId);
  db.sql.exec(`INSERT INTO inventory_allocations VALUES ('order-1',2,?)`, tx('a'));
  db.sql.exec(`INSERT INTO payment_attempts VALUES ('attempt-1','order-1',?,'VERIFIED','ethereum-mainnet',1,'0xdAC17F958D2ee523a2206206994597C13D831ec7',6,?,50000000)`, tx('a'), wallet('1'));
  db.sql.exec(`INSERT INTO payment_settlements VALUES ('settlement-1','order-1',?,'attempt-1',12,1,'ethereum-mainnet',?,?,50000000)`, tx('a'), wallet('b'), wallet('1'));
  // Correct settlement token address for Ethereum-mainnet USDT.
  db.sql.exec(`UPDATE payment_settlements SET token_contract='0xdAC17F958D2ee523a2206206994597C13D831ec7'`);
  const ownershipProof = { chainId: 8453, tokenId: 2, contract: wallet('c'), owner: wallet('d'), txHash: tx('e'), blockNumber: 100, logIndex: 1 };
  return { db, membershipId, ownershipProof };
}

function activatedFixture() {
  const f = fixture();
  registerSettledMembership({ storage: f.db, membershipId: f.membershipId, now: NOW });
  activateVerifiedMembership({ storage: f.db, membershipId: f.membershipId, ownershipProof: f.ownershipProof, authorize: authorized, verifyEvidence: verified, now: NOW });
  return f;
}

test('schemas are idempotent and old commerce data is untouched', () => {
  const f = fixture();
  initializeFoundingProductRegistries(f.db);
  const row = f.db.sql.exec('SELECT status FROM founding_memberships WHERE id=?', f.membershipId).toArray()[0];
  assert.equal(row.status, 'ACTIVATION_PENDING');
});

test('membership requires settled payment; registration never activates access', () => {
  const f = fixture();
  assert.throws(() => activateVerifiedMembership({ storage:f.db, membershipId:f.membershipId, ownershipProof:f.ownershipProof, authorize:authorized,verifyEvidence:verified,now:NOW }));
  f.db.sql.exec(`UPDATE payment_settlements SET confirmations=3`);
  assert.throws(() => registerSettledMembership({ storage:f.db, membershipId:f.membershipId }), /OX_MEMBERSHIP_NOT_SETTLED/);
  f.db.sql.exec(`UPDATE payment_settlements SET confirmations=12,amount_minor=49000000`);
  assert.throws(() => registerSettledMembership({ storage:f.db, membershipId:f.membershipId }), /OX_MEMBERSHIP_NOT_SETTLED/);
  f.db.sql.exec(`UPDATE payment_settlements SET amount_minor=50000000`);
  assert.equal(registerSettledMembership({ storage:f.db, membershipId:f.membershipId, now:NOW }).status, 'PENDING_ACTIVATION');
  assert.equal(registerSettledMembership({ storage:f.db, membershipId:f.membershipId }).idempotentReplay, true);
  assert.equal(membershipAccessSnapshot({storage:f.db,serialNumber:2}).status, 'PENDING_ACTIVATION');
});

test('activation is fail closed; 12 months from activation, never from purchase', () => {
  const f = fixture();
  registerSettledMembership({storage:f.db,membershipId:f.membershipId,now:NOW});
  const args = {storage:f.db,membershipId:f.membershipId,ownershipProof:f.ownershipProof,now:NOW};
  assert.throws(() => activateVerifiedMembership({...args,authorize:authorized}), /OX_PROOF_VERIFIER_UNAVAILABLE/);
  assert.throws(() => activateVerifiedMembership({...args,authorize:authorized,verifyEvidence:rejected}), /OX_PROOF_REJECTED/);
  assert.equal(membershipAccessSnapshot({storage:f.db,serialNumber:2}).status, 'PENDING_ACTIVATION');
  const activation = activateVerifiedMembership({...args,authorize:authorized,verifyEvidence:verified});
  assert.equal(activation.expiresAt,'2027-11-05T12:00:00.000Z');
  assert.equal(membershipAccessSnapshot({storage:f.db,serialNumber:2,now:Date.parse('2027-11-06T00:00:00Z')}).status,'EXPIRED');
  assert.throws(() => activateVerifiedMembership({...args,authorize:authorized,verifyEvidence:verified}), /OX_ALREADY_ACTIVATED/);
});

test('transfer observation requires newer verified Base evidence and preserves expiry', () => {
  const f = activatedFixture();
  const nextProof = {...f.ownershipProof,owner:wallet('f'),blockNumber:101,txHash:tx('f'),logIndex:2};
  assert.throws(()=>observeVerifiedOwnershipTransfer({storage:f.db,serialNumber:2,ownershipProof:nextProof,authorize:authorized}), /OX_PROOF_VERIFIER_UNAVAILABLE/);
  const change = observeVerifiedOwnershipTransfer({storage:f.db,serialNumber:2,ownershipProof:nextProof,authorize:authorized,verifyEvidence:verified,now:NOW+123});
  assert.equal(change.expiresAt,'2027-11-05T12:00:00.000Z');
  assert.equal(observeVerifiedOwnershipTransfer({storage:f.db,serialNumber:2,ownershipProof:nextProof,authorize:authorized,verifyEvidence:verified}).idempotentReplay,true);
  assert.throws(()=>observeVerifiedOwnershipTransfer({storage:f.db,serialNumber:2,ownershipProof:{...nextProof,txHash:tx('0'),blockNumber:99},authorize:authorized,verifyEvidence:verified}), /OX_OWNERSHIP_STALE/);
  assert.equal(membershipAccessSnapshot({storage:f.db,serialNumber:2}).currentOwnershipVerified,false);
});

const movement = (eventKey,kind,amountMinor,chainId=1,serialNumber=null) => ({ eventKey,kind,amountMinor,chainId,serialNumber,
  policyVersion:'OX-50-V4-TEST',sourceReference:eventKey,evidenceHash:'f'.repeat(64) });

test('reserve double-entry, real liquidity distinction, idempotency, no overdrafts', () => {
  const f = fixture();
  const post = m => recordVerifiedReserveMovement({ storage:f.db,movement:m,authorize:authorized,verifyEvidence:verified,now:NOW });
  assert.throws(()=>recordVerifiedReserveMovement({storage:f.db,movement:movement('accrual:1','ACCRUAL',5_000_000),authorize:authorized}),/OX_PROOF_VERIFIER_UNAVAILABLE/);
  assert.equal(post(movement('accrual:1','ACCRUAL',5_000_000)).status,'RECORDED');
  assert.equal(reserveBalances({storage:f.db}).receivableMinor,5_000_000);
  assert.equal(reserveBalances({storage:f.db}).liquidEthereumMinor,0);
  assert.equal(post(movement('accrual:1','ACCRUAL',5_000_000)).idempotentReplay,true);
  assert.throws(()=>post(movement('accrual:1','ACCRUAL',4_000_000)),/OX_RESERVE_REPLAY_CONFLICT/);
  assert.throws(()=>post(movement('funding:1','FUNDING',6_000_000)),/OX_RESERVE_INSUFFICIENT_RECEIVABLE/);
  post(movement('funding:1','FUNDING',3_000_000));
  assert.equal(reserveBalances({storage:f.db}).liquidEthereumMinor,3_000_000);
  assert.throws(()=>post(movement('withdraw:1','REDEMPTION',1_000_000,1,2)),/OX_REDEMPTION_USE_ATOMIC_RECONCILIATION/);
  assert.throws(()=>post(movement('invest:1','INVESTMENT',4_000_000)),/OX_RESERVE_INSUFFICIENT_LIQUID/);
  post(movement('invest:1','INVESTMENT',1_000_000));
  assert.equal(reserveBalances({storage:f.db}).investedEthereumMinor,1_000_000);
  assert.equal(reserveBalances({storage:f.db}).liquidBaseMinor,0);
  const bad = f.db.sql.exec('SELECT COUNT(*) AS n FROM ox_reserve_movements').toArray()[0].n;
  assert.equal(bad,3);
});

test('redemption preparation is not settlement and proof cannot be forged by omission', () => {
  const f = activatedFixture();
  const req = {storage:f.db,requestKey:'redemption:0002',serialNumber:2,membershipId:f.membershipId,
    requesterWallet:wallet('d'),ownershipEvidenceHash:'e'.repeat(64),now:NOW};
  assert.throws(()=>prepareRedemptionRequest({...req,authorize:authorized}), /OX_PROOF_VERIFIER_UNAVAILABLE/);
  const prepared = prepareRedemptionRequest({...req,authorize:authorized,verifyEvidence:verified});
  assert.equal(prepared.status,'POLICY_PENDING');
  assert.equal(prepared.burnAuthorized,false);
  assert.equal(prepared.paymentAuthorized,false);
  assert.equal(prepareRedemptionRequest({...req,authorize:authorized,verifyEvidence:verified}).idempotentReplay,true);
  assert.throws(()=>prepareRedemptionRequest({...req,requestKey:'redemption:new-0002',authorize:authorized,verifyEvidence:verified}),/UNIQUE constraint failed/);
  assert.equal(membershipAccessSnapshot({storage:f.db,serialNumber:2}).status,'ACTIVE');
});

test('redemption reconciliation requires same-chain atomic proof and funded Base liquidity', () => {
  const f = activatedFixture();
  prepareRedemptionRequest({storage:f.db,requestKey:'redemption:0002',serialNumber:2,membershipId:f.membershipId,
    requesterWallet:wallet('d'),ownershipEvidenceHash:'e'.repeat(64),authorize:authorized,verifyEvidence:verified});
  const settlement = { chainId:8453,tokenId:2,txHash:tx('9'),burnTxHash:tx('9'),
    recipientWallet:wallet('d'),amountMinor:2_000_000,policyVersion:'OX-50-V4-TEST',evidenceHash:'8'.repeat(64) };
  const args = {storage:f.db,requestKey:'redemption:0002',settlement,authorize:authorized,verifyAtomicEvidence:verified,verifyReserveEvidence:verified};
  assert.throws(()=>recordVerifiedAtomicRedemption({...args,settlement:{...settlement,burnTxHash:tx('7')}}),/OX_ATOMIC_SETTLEMENT_INVALID/);
  assert.throws(()=>recordVerifiedAtomicRedemption(args),/OX_RESERVE_INSUFFICIENT_LIQUID/);
  assert.equal(f.db.sql.exec('SELECT status FROM ox_redemption_requests').toArray()[0].status,'POLICY_PENDING');
  // A verified accrual followed by independently verified custody on Base.
  recordVerifiedReserveMovement({storage:f.db,movement:movement('accrual:2','ACCRUAL',2_000_000),authorize:authorized,verifyEvidence:verified});
  recordVerifiedReserveMovement({storage:f.db,movement:movement('funding:2','FUNDING',2_000_000,8453),authorize:authorized,verifyEvidence:verified});
  assert.throws(()=>recordVerifiedAtomicRedemption({...args,verifyAtomicEvidence:rejected}),/OX_PROOF_REJECTED/);
  const result = recordVerifiedAtomicRedemption(args);
  assert.equal(result.status,'SETTLED');
  assert.equal(recordVerifiedAtomicRedemption(args).idempotentReplay,true);
  assert.equal(reserveBalances({storage:f.db}).liquidBaseMinor,0);
  assert.equal(membershipAccessSnapshot({storage:f.db,serialNumber:2}).status,'REDEEMED');
  assert.equal(f.db.sql.exec("SELECT COUNT(*) AS n FROM ox_reserve_movements WHERE kind='REDEMPTION'").toArray()[0].n,1);
});


test('commercial V4 draft models all 6000 serials and does not post cash', () => {
  const first = previewFoundingSaleReserve({serialNumber:1,paidMinor:100_000_000});
  const last = previewFoundingSaleReserve({serialNumber:6000,paidMinor:100_000_000});
  assert.equal(first.reserve.amountMinor,50_000_000);
  assert.equal(last.reserve.amountMinor,50_000_000);
  assert.equal(first.autoPostingAllowed,false);
  assert.equal(previewFutureNetServicesReserve({verifiedNetProfitMinor:100_000_000}).reserve.amountMinor,15_000_000);
  assert.deepEqual(previewPortfolioLimits({totalFundedMinor:100_000_000}),{
    version:'OX-RESERVE-COMMERCIAL-V4-DRAFT',maxInvestedMinor:10_000_000,
    minLiquidMinor:90_000_000,executable:false,voteVerified:false,custodyVerified:false
  });
  assert.equal(previewFutureNetServicesReserve({verifiedNetProfitMinor:1}).reserve.fractionalMinorNumerator,15);
  assert.throws(()=>previewFoundingSaleReserve({serialNumber:6001,paidMinor:100}),/OX_DRAFT_SERIAL_INVALID/);
});

test('ledger and access events cannot be edited or deleted after posting', () => {
  const f = fixture();
  registerSettledMembership({storage:f.db,membershipId:f.membershipId});
  assert.throws(()=>f.db.sql.exec('DELETE FROM ox_membership_access_events WHERE serial_number=2'),/IMMUTABLE_MEMBERSHIP_EVENT/);
  recordVerifiedReserveMovement({storage:f.db,movement:movement('accrual:3','ACCRUAL',1_000_000),authorize:authorized,verifyEvidence:verified});
  assert.throws(()=>f.db.sql.exec("UPDATE ox_reserve_movements SET amount_minor=2 WHERE event_key='accrual:3'"),/IMMUTABLE_RESERVE_JOURNAL/);
  assert.throws(()=>f.db.sql.exec("DELETE FROM ox_reserve_lines WHERE event_key='accrual:3'"),/IMMUTABLE_RESERVE_JOURNAL/);
});
