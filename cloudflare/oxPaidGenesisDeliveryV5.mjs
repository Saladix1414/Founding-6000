/*
 * OriginX V5: paid Genesis #0001 delivery evidence record, INTERNAL preparation only.
 * Uses the existing paid order, verified Ethereum USDT settlement, claim, ECDSA wallet
 * binding and mint-readiness evidence. Never signs, submits or mints anything.
 * No public route or commerce checkout wiring in this module.
 */
import { createHash,randomUUID } from 'node:crypto';
const sha = value=>createHash('sha256').update(value).digest('hex');
const HASH = /^[a-f0-9]{64}$/i;
const TX = /^0x[a-f0-9]{64}$/i;
const WALLET = /^0x[a-f0-9]{40}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION = 'OX-GENESIS-PAID-DELIVERY-5';
const ETH_USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const ETH_RECEIVER = '0xe695bc03a11d5de3f5e38b4acb66d13aede3b840';
const fail = code=>{throw new Error('OX_PAID_GENESIS_V5_'+code);};

export function initializePaidGenesisDeliveryV5(storage) {
  if(!storage?.sql?.exec || typeof storage.transactionSync!=='function') fail('STORAGE_UNAVAILABLE');
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ox_paid_genesis_delivery_intents_v5 (
      id TEXT PRIMARY KEY,mint_job_id TEXT NOT NULL UNIQUE,order_id TEXT NOT NULL UNIQUE,
      membership_id TEXT NOT NULL UNIQUE,serial_number INTEGER NOT NULL UNIQUE CHECK(serial_number=1),
      intent_hash TEXT NOT NULL UNIQUE,payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status='PREPARED_NOT_AUTHORIZED'),prepared_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS ox_paid_genesis_v5_immutable_update
      BEFORE UPDATE ON ox_paid_genesis_delivery_intents_v5 BEGIN SELECT RAISE(ABORT,'OX_V5_INTENT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ox_paid_genesis_v5_immutable_delete
      BEFORE DELETE ON ox_paid_genesis_delivery_intents_v5 BEGIN SELECT RAISE(ABORT,'OX_V5_INTENT_IMMUTABLE'); END;
  `);
}

export function preparePaidGenesisDeliveryV5({storage,mintJobId,authorizePreparation,
    verifySettlementEvidence,now=Date.now()}) {
  if(!storage?.sql?.exec || typeof storage.transactionSync!=='function' ||
      typeof mintJobId!=='string' || !UUID.test(mintJobId) ||
      !Number.isSafeInteger(now) || now<0 || now>8640000000000000) fail('INPUT_INVALID');
  if(typeof authorizePreparation!=='function') fail('AUTHORITY_UNAVAILABLE');
  if(typeof verifySettlementEvidence!=='function') fail('EVIDENCE_VERIFIER_UNAVAILABLE');
  let allowed=false;
  try{allowed=authorizePreparation(Object.freeze({operation:'PREPARE_PAID_GENESIS_V5',mintJobId}))===true;}
  catch {/* deny */}
  if(!allowed) fail('AUTHORITY_DENIED');
  return storage.transactionSync(()=>{
    const rows=storage.sql.exec(`
      SELECT j.id AS mintJobId,j.order_id AS orderId,j.membership_id AS membershipId,
        j.serial_number AS serialNumber,j.recipient_address AS recipient,
        o.reference_price_usd AS priceUsd,ps.id AS settlementId,
        ps.external_reference AS paymentHash,ps.amount_minor AS paidMinor,
        ps.confirmations AS confirmations,ps.receiver_address AS receiver,
        a.metadata_path AS metadataPath,a.metadata_hash AS metadataHash,
        a.media_hash AS mediaHash,a.certificate_hash AS certificateHash,
        g.id AS grantId,b.id AS bindingId,c.id AS challengeId,
        r.id AS readinessId
      FROM nft_mint_jobs j
      JOIN founding_memberships m ON m.id=j.membership_id AND m.order_id=j.order_id
        AND m.serial_number=j.serial_number
      JOIN founding_orders o ON o.id=j.order_id AND o.status='PAID'
      JOIN inventory_allocations ia ON ia.order_id=o.id AND ia.serial_number=j.serial_number
      JOIN payment_settlements ps ON ps.order_id=o.id
        AND ps.external_reference=ia.settlement_reference
      JOIN payment_attempts pa ON pa.id=ps.payment_attempt_id AND pa.order_id=o.id
        AND pa.tx_hash=ps.external_reference AND pa.status='VERIFIED'
      JOIN ox_release_assets_v5 a ON a.serial_number=j.serial_number AND a.origin='GENESIS_V4'
        AND a.legacy_state='PREPARED' AND a.legacy_order_id IS NULL
      JOIN ox_inventory_cutovers_v5 cv5 ON cv5.genesis_certificate_hash=a.certificate_hash
        AND cv5.version='OX-INVENTORY-CUTOVER-5' AND cv5.status='STAGED_NOT_ACTIVE'
      JOIN ox_genesis_asset_candidates_v4 v4 ON v4.serial_number=a.serial_number
        AND v4.certificate_hash=a.certificate_hash AND v4.metadata_hash=a.metadata_hash
        AND v4.media_hash=a.media_hash AND v4.status='PREPARED_NOT_FOR_SALE'
      JOIN nft_wallet_bindings b ON b.membership_id=m.id AND b.chain_id=8453
        AND b.status='BOUND' AND b.wallet_address=j.recipient_address
      JOIN nft_wallet_challenges c ON c.id=b.challenge_id AND c.membership_id=m.id
        AND c.wallet_address=b.wallet_address AND c.status='VERIFIED' AND c.verified_at IS NOT NULL
      JOIN nft_claim_grants g ON g.membership_id=m.id AND g.status='CONSUMED'
        AND g.consumed_at=c.verified_at
      JOIN nft_wallet_binding_events be ON be.binding_id=b.id AND be.membership_id=m.id
        AND be.challenge_id=c.id AND be.event_type='WALLET_BOUND'
      JOIN nft_mint_readiness_events r ON r.mint_job_id=j.id AND r.membership_id=m.id
        AND r.binding_id=b.id AND r.event_type='MINT_JOB_READY'
        AND r.recipient_address=j.recipient_address
      WHERE j.id=? AND j.serial_number=1 AND j.status='READY' AND j.mint_tx_hash IS NULL
        AND m.status='ACTIVATION_PENDING' AND m.activation_started_at IS NULL
        AND m.activation_expires_at IS NULL
        AND ps.chain_id=1 AND ps.network='ethereum-mainnet'
        AND pa.chain_id=ps.chain_id AND pa.network=ps.network
        AND pa.token_decimals=6 AND lower(pa.token_contract)=lower(ps.token_contract)
        AND lower(ps.token_contract)=? AND lower(pa.receiver_address)=lower(ps.receiver_address)
        AND lower(ps.receiver_address)=? AND ps.confirmations>=12
        AND ps.amount_minor>0 AND ps.amount_minor=pa.expected_amount_minor
        AND ps.amount_minor=o.reference_price_usd*1000000
      LIMIT 2`,mintJobId,ETH_USDT,ETH_RECEIVER).toArray();
    if(rows.length!==1) fail('PAID_DELIVERY_EVIDENCE_MISSING');
    const row=rows[0];
    if(row.serialNumber!==1 || row.priceUsd!==50 || row.paidMinor!==50000000 ||
       !TX.test(row.paymentHash) || !WALLET.test(row.recipient) || !WALLET.test(row.receiver) ||
       ![row.metadataHash,row.mediaHash,row.certificateHash].every(h=>typeof h==='string'&&HASH.test(h)) ||
       row.metadataPath!=='/nft/metadata/1.json') fail('PAID_DELIVERY_EVIDENCE_INVALID');
    const evidence=Object.freeze({operation:'VERIFY_ETHEREUM_GENESIS_SETTLEMENT_V5',
      orderId:row.orderId,settlementId:row.settlementId,paymentHash:row.paymentHash,
      confirmations:row.confirmations,paidMinor:row.paidMinor,receiver:row.receiver,
      membershipId:row.membershipId,serialNumber:1});
    let verified=false;
    try{verified=verifySettlementEvidence(evidence)===true;}catch{/*deny*/}
    if(!verified) fail('SETTLEMENT_REVERIFICATION_REQUIRED');
    initializePaidGenesisDeliveryV5(storage);
    const payload=Object.freeze({version:VERSION,chainId:8453,tokenId:1,
      orderId:row.orderId,mintJobId:row.mintJobId,membershipId:row.membershipId,
      settlementId:row.settlementId,paymentTxHash:row.paymentHash.toLowerCase(),
      amountMinor:row.paidMinor,recipient:row.recipient,bindingId:row.bindingId,
      readinessId:row.readinessId,releaseCertificateHash:row.certificateHash,
      metadataPath:row.metadataPath,metadataHash:row.metadataHash,mediaHash:row.mediaHash,
      state:'PREPARED_NOT_AUTHORIZED',mainnetContractAddress:null,
      paidEvidenceRecheckedByTrustedCallback:true,chainOwnerVerified:false,
      mintCalldataPrepared:false,actualMintVerified:false,mintAuthority:false,
      transactionSubmitted:false,membershipActivated:false});
    const json=JSON.stringify(payload),intentHash=sha(json);
    const previous=storage.sql.exec(`SELECT * FROM ox_paid_genesis_delivery_intents_v5
      WHERE mint_job_id=? OR order_id=? OR membership_id=? OR serial_number=1 LIMIT 2`,
      mintJobId,row.orderId,row.membershipId).toArray();
    if(previous.length){
      const old=previous[0];
      if(previous.length!==1 || old.mint_job_id!==mintJobId ||old.order_id!==row.orderId ||
          old.membership_id!==row.membershipId ||old.serial_number!==1 ||
          old.intent_hash!==intentHash ||old.payload_json!==json ||
          old.status!=='PREPARED_NOT_AUTHORIZED') fail('INTENT_REPLAY_CONFLICT');
      return Object.freeze({intentId:old.id,intentHash,status:old.status,idempotentReplay:true,
        mintAuthority:false,transactionSubmitted:false,payload});
    }
    const id=randomUUID();
    storage.sql.exec(`INSERT INTO ox_paid_genesis_delivery_intents_v5
      (id,mint_job_id,order_id,membership_id,serial_number,intent_hash,payload_json,status,prepared_at)
      VALUES(?,?,?,?,1,?,?,'PREPARED_NOT_AUTHORIZED',?)`,id,mintJobId,row.orderId,row.membershipId,
      intentHash,json,new Date(now).toISOString());
    return Object.freeze({intentId:id,intentHash,status:'PREPARED_NOT_AUTHORIZED',
      idempotentReplay:false,mintAuthority:false,transactionSubmitted:false,payload});
  });
}
