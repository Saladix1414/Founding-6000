import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {makeV5Storage} from './oxV5Fixtures.mjs';
import {stageInventoryCutoverV5} from '../cloudflare/oxInventoryCutoverV5.mjs';
import {initializePaidGenesisDeliveryV5,preparePaidGenesisDeliveryV5} from '../cloudflare/oxPaidGenesisDeliveryV5.mjs';

const wallet=x=>'0x'+x.repeat(40);
const hash=x=>'0x'+x.repeat(64);
const uuid=randomUUID;
function paidFixture(){
  const f=makeV5Storage();
  stageInventoryCutoverV5({storage:f.storage,genesisCertificate:f.certificate,authorizeStaging:()=>true});
  const m=uuid(),o=uuid(),j=uuid(),b=uuid(),c=uuid(),g=uuid(),r=uuid(),p=uuid(),s=uuid();
  f.db.exec(`
    CREATE TABLE founding_memberships(id TEXT PRIMARY KEY,order_id TEXT,serial_number INTEGER,status TEXT,
       activation_started_at TEXT,activation_expires_at TEXT);
    CREATE TABLE nft_mint_jobs (id TEXT PRIMARY KEY,order_id TEXT,membership_id TEXT,
       serial_number INTEGER,recipient_address TEXT,status TEXT,mint_tx_hash TEXT);
    CREATE TABLE payment_attempts(id TEXT PRIMARY KEY,order_id TEXT,tx_hash TEXT,status TEXT,
       chain_id INTEGER,network TEXT,token_decimals INTEGER,token_contract TEXT,
       receiver_address TEXT,expected_amount_minor INTEGER);
    CREATE TABLE payment_settlements(id TEXT PRIMARY KEY,order_id TEXT,payment_attempt_id TEXT,
       external_reference TEXT,chain_id INTEGER,network TEXT,token_contract TEXT,receiver_address TEXT,
       confirmations INTEGER,amount_minor INTEGER);
    CREATE TABLE nft_wallet_bindings(id TEXT PRIMARY KEY,membership_id TEXT,challenge_id TEXT,
       chain_id INTEGER,status TEXT,wallet_address TEXT);
    CREATE TABLE nft_wallet_challenges(id TEXT PRIMARY KEY,membership_id TEXT,wallet_address TEXT,
       status TEXT,verified_at TEXT);
    CREATE TABLE nft_claim_grants(id TEXT PRIMARY KEY,membership_id TEXT,status TEXT,consumed_at TEXT);
    CREATE TABLE nft_wallet_binding_events(id TEXT PRIMARY KEY,binding_id TEXT,membership_id TEXT,
       challenge_id TEXT,event_type TEXT);
    CREATE TABLE nft_mint_readiness_events(id TEXT PRIMARY KEY,mint_job_id TEXT,membership_id TEXT,
       binding_id TEXT,event_type TEXT,recipient_address TEXT);
  `);
  const receiver='0xe695bc03a11d5de3f5e38b4acb66d13aede3b840';
  const usdt='0xdac17f958d2ee523a2206206994597c13d831ec7';
  const buyer=wallet('9'),tx=hash('a');
  const stamp='2026-11-05T10:00:00.000Z';
  f.db.prepare("INSERT INTO founding_orders VALUES (?,'PAID',50)").run(o);
  f.db.prepare("INSERT INTO inventory_allocations VALUES (?,1,?)").run(o,tx);
  f.db.prepare("INSERT INTO founding_memberships VALUES (?,?,1,'ACTIVATION_PENDING',NULL,NULL)").run(m,o);
  f.db.prepare("INSERT INTO nft_mint_jobs VALUES (?,?,?,1,?,'READY',NULL)").run(j,o,m,buyer);
  f.db.prepare("INSERT INTO payment_attempts VALUES (?,?,?,?,1,'ethereum-mainnet',6,?,?,50000000)")
    .run(p,o,tx,'VERIFIED',usdt,receiver);
  f.db.prepare("INSERT INTO payment_settlements VALUES (?,?,?,?,1,'ethereum-mainnet',?,?,12,50000000)")
    .run(s,o,p,tx,usdt,receiver);
  f.db.prepare("INSERT INTO nft_wallet_bindings VALUES (?,?,?,8453,'BOUND',?)").run(b,m,c,buyer);
  f.db.prepare("INSERT INTO nft_wallet_challenges VALUES (?,?,?,'VERIFIED',?)").run(c,m,buyer,stamp);
  f.db.prepare("INSERT INTO nft_claim_grants VALUES (?,?,'CONSUMED',?)").run(g,m,stamp);
  f.db.prepare("INSERT INTO nft_wallet_binding_events VALUES (?,?,?,?, 'WALLET_BOUND')").run(uuid(),b,m,c);
  f.db.prepare("INSERT INTO nft_mint_readiness_events VALUES (?,?,?,?, 'MINT_JOB_READY',?)").run(r,j,m,b,buyer);
  return {...f,j,m,o,p,s,b,c,g,receiver,usdt,buyer,tx};
}
const prepare=(f,extra={})=>preparePaidGenesisDeliveryV5({storage:f.storage,mintJobId:f.j,
  authorizePreparation:()=>true,verifySettlementEvidence:()=>true,now:Date.parse('2026-11-05T12:00:00Z'),...extra});

test('V5 Genesis paid intent requires verified settlement, verified wallet and mint readiness',()=>{
  const f=paidFixture();const x=prepare(f);
  assert.equal(x.payload.tokenId,1);assert.equal(x.payload.version,'OX-GENESIS-PAID-DELIVERY-5');
  assert.equal(x.payload.paymentTxHash,f.tx);assert.equal(x.payload.amountMinor,50000000);
  assert.equal(x.payload.metadataPath,'/nft/metadata/1.json');
  assert.equal(x.payload.releaseCertificateHash,f.certificate.certificateHash);
  assert.equal(x.status,'PREPARED_NOT_AUTHORIZED');assert.equal(x.mintAuthority,false);
  assert.equal(x.transactionSubmitted,false);assert.equal(x.payload.mintCalldataPrepared,false);
  assert.equal(prepare(f).idempotentReplay,true);
});

test('V5 Genesis paid intent requires operator authorization and independent settlement callback',()=>{
  const f=paidFixture();
  assert.throws(()=>prepare(f,{authorizePreparation:undefined}),/AUTHORITY_UNAVAILABLE/);
  assert.throws(()=>prepare(f,{authorizePreparation:()=>false}),/AUTHORITY_DENIED/);
  assert.throws(()=>prepare(f,{verifySettlementEvidence:undefined}),/EVIDENCE_VERIFIER_UNAVAILABLE/);
  assert.throws(()=>prepare(f,{verifySettlementEvidence:()=>false}),/SETTLEMENT_REVERIFICATION_REQUIRED/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM sqlite_master WHERE name=?').get('ox_paid_genesis_delivery_intents_v5').n,0);
});

test('V5 Genesis rejects insufficient confirmations, wrong transfer, wrong receiver',()=>{
  const f=paidFixture();f.db.exec('UPDATE payment_settlements SET confirmations=3');
  assert.throws(()=>prepare(f),/PAID_DELIVERY_EVIDENCE_MISSING/);
  f.db.exec('UPDATE payment_settlements SET confirmations=12,amount_minor=49000000');
  assert.throws(()=>prepare(f),/PAID_DELIVERY_EVIDENCE_MISSING/);
  f.db.exec('UPDATE payment_settlements SET amount_minor=50000000');
  f.db.exec("UPDATE payment_settlements SET receiver_address='0x1111111111111111111111111111111111111111'");
  assert.throws(()=>prepare(f),/PAID_DELIVERY_EVIDENCE_MISSING/);
  f.db.prepare('UPDATE payment_settlements SET receiver_address=?').run(f.receiver);
  assert.equal(prepare(f).status,'PREPARED_NOT_AUTHORIZED');
});

test('V5 Genesis rejects missing claim, wallet proof or readiness',()=>{
  const f=paidFixture();f.db.exec("UPDATE nft_claim_grants SET status='REVOKED'");
  assert.throws(()=>prepare(f),/PAID_DELIVERY_EVIDENCE_MISSING/);
  f.db.exec("UPDATE nft_claim_grants SET status='CONSUMED'");
  f.db.exec("UPDATE nft_wallet_challenges SET status='PENDING'");
  assert.throws(()=>prepare(f),/PAID_DELIVERY_EVIDENCE_MISSING/);
  f.db.exec("UPDATE nft_wallet_challenges SET status='VERIFIED'");
  f.db.exec("DELETE FROM nft_mint_readiness_events");
  assert.throws(()=>prepare(f),/PAID_DELIVERY_EVIDENCE_MISSING/);
});

test('V5 Genesis detects replay conflicts after tampering with paid source',()=>{
  const f=paidFixture();prepare(f);
  f.db.exec("UPDATE nft_mint_jobs SET recipient_address='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'");
  f.db.exec("UPDATE nft_wallet_bindings SET wallet_address='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'");
  f.db.exec("UPDATE nft_wallet_challenges SET wallet_address='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'");
  f.db.exec("UPDATE nft_mint_readiness_events SET recipient_address='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'");
  assert.throws(()=>prepare(f),/INTENT_REPLAY_CONFLICT/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ox_paid_genesis_delivery_intents_v5').get().n,1);
});

test('V5 Genesis intents are immutable, single-use and do not grant mint authority',()=>{
  const f=paidFixture();const x=prepare(f);
  assert.throws(()=>f.db.exec('DELETE FROM ox_paid_genesis_delivery_intents_v5'),/OX_V5_INTENT_IMMUTABLE/);
  assert.throws(()=>f.db.exec("UPDATE ox_paid_genesis_delivery_intents_v5 SET status='PREPARED_NOT_AUTHORIZED'"),/OX_V5_INTENT_IMMUTABLE/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ox_paid_genesis_delivery_intents_v5').get().n,1);
  assert.equal(x.payload.mainnetContractAddress,null);assert.equal(x.payload.membershipActivated,false);
  assert.equal(x.payload.actualMintVerified,false);
});

test('V5 Genesis intent does not accept missing staged certificate or ambiguous join',()=>{
  const f=paidFixture();
  f.db.exec('DROP TRIGGER ox_v5_asset_immutable_delete');
  f.db.exec('DELETE FROM ox_release_assets_v5 WHERE serial_number=1');
  assert.throws(()=>prepare(f),/PAID_DELIVERY_EVIDENCE_MISSING/);
});
