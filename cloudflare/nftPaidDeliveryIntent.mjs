import { createHash } from 'node:crypto';
import { buildNftMintExecutionPlan } from './nftMintExecutionPlan.mjs';
import { MAINNET_LAUNCH_PROFILE } from './nftMainnetLaunchPreparation.mjs';

// Internal preparation only. Never expose authorizePreparation to public input.
// A PREPARED intent is neither mint permission nor proof of sponsorship.
const deny = () => { throw new Error('NFT_PAID_DELIVERY_INTENT_UNAVAILABLE'); };
const hash = text => createHash('sha256').update(text).digest('hex');

export function initializePaidDeliveryIntentSchema(storage) {
  storage.sql.exec(`CREATE TABLE IF NOT EXISTS nft_paid_delivery_intents (
    id TEXT PRIMARY KEY,
    mint_job_id TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL UNIQUE,
    membership_id TEXT NOT NULL UNIQUE,
    serial_number INTEGER NOT NULL UNIQUE CHECK(serial_number BETWEEN 2 AND 1000),
    intent_hash TEXT NOT NULL UNIQUE,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status = 'PREPARED'),
    prepared_at TEXT NOT NULL
  )`);
}

export function preparePaidDeliveryIntent({ storage, mintJobId, authorizePreparation, now = Date.now() }) {
  if (!storage?.sql || typeof storage.transactionSync !== 'function' ||
      typeof mintJobId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mintJobId) ||
      typeof authorizePreparation !== 'function' || !Number.isSafeInteger(now) || now < 0 || now > 8640000000000000) deny();
  try {
    if (authorizePreparation(Object.freeze({ operation: 'PREPARE_PAID_NFT_DELIVERY_INTENT', mintJobId })) !== true) deny();
  } catch { deny(); }
  return storage.transactionSync(() => {
    const plan = buildNftMintExecutionPlan({ storage, mintJobId });
    // Reuse existing READY, wallet, membership and audit checks. Add settlement
    // and release allocation evidence here; PAID text alone is insufficient.
    const rows = storage.sql.exec(`
      SELECT o.id AS orderId, j.membership_id AS membershipId,
        ps.id AS settlementId, ps.external_reference AS paymentTxHash,
        r.batch_id AS batchId, r.metadata_hash AS metadataHash,
        r.media_hash AS mediaHash, r.metadata_path AS metadataPath,
        b.id AS bindingId
      FROM nft_mint_jobs j
      JOIN founding_orders o ON o.id = j.order_id
      JOIN founding_memberships m ON m.id = j.membership_id
        AND m.order_id = o.id AND m.serial_number = j.serial_number
      JOIN inventory_allocations ia ON ia.order_id = o.id
        AND ia.serial_number = j.serial_number
      JOIN payment_settlements ps ON ps.order_id = o.id
        AND ps.external_reference = ia.settlement_reference
      JOIN payment_attempts pa ON pa.id = ps.payment_attempt_id
        AND pa.order_id = o.id AND pa.tx_hash = ps.external_reference
      JOIN nft_release_assets r ON r.order_id = o.id
        AND r.serial_number = j.serial_number AND r.state = 'ALLOCATED'
      JOIN nft_wallet_bindings b ON b.membership_id = m.id
        AND b.wallet_address = j.recipient_address AND b.chain_id = 8453 AND b.status = 'BOUND'
      JOIN nft_wallet_challenges c ON c.id = b.challenge_id
        AND c.membership_id = m.id AND c.wallet_address = b.wallet_address
        AND c.status = 'VERIFIED' AND c.verified_at IS NOT NULL
      WHERE j.id = ? AND j.status = 'READY' AND j.mint_tx_hash IS NULL
        AND m.status = 'ACTIVATION_PENDING'
        AND m.activation_started_at IS NULL AND m.activation_expires_at IS NULL
        AND o.status = 'PAID' AND pa.status = 'VERIFIED'
        AND ps.chain_id = 1 AND ps.network = 'ethereum-mainnet'
        AND pa.chain_id = ps.chain_id AND pa.network = ps.network
        AND lower(pa.token_contract) = lower(ps.token_contract)
        AND lower(ps.token_contract) = '0xdac17f958d2ee523a2206206994597c13d831ec7'
        AND lower(pa.receiver_address) = lower(ps.receiver_address)
        AND ps.amount_minor = pa.expected_amount_minor
        AND ps.amount_minor = o.reference_price_usd * 1000000
        AND ps.amount_minor > 0 AND ps.confirmations >= 12
        AND EXISTS (SELECT 1 FROM nft_claim_grants g WHERE g.membership_id = m.id
          AND g.status = 'CONSUMED' AND g.consumed_at = c.verified_at)
        AND EXISTS (SELECT 1 FROM nft_wallet_binding_events e WHERE e.binding_id = b.id
          AND e.membership_id = m.id AND e.challenge_id = c.id AND e.event_type = 'WALLET_BOUND')
      LIMIT 2
    `, mintJobId).toArray();
    if (rows.length !== 1) deny();
    const row = rows[0];
    if (plan.chainId !== 8453 || plan.tokenId < 2 || plan.tokenId > 1000 ||
        row.bindingId !== plan.bindingId || row.membershipId !== plan.membershipId ||
        row.batchId !== 'rare-0002-0101' || plan.tokenId > 101 ||
        !/^[a-f0-9]{64}$/.test(row.metadataHash) || !/^[a-f0-9]{64}$/.test(row.mediaHash) ||
        !/^0x[a-f0-9]{64}$/.test(row.paymentTxHash) ||
        row.metadataPath !== `/nft/releases/${row.batchId}/${String(plan.tokenId).padStart(4,'0')}/metadata-${row.metadataHash}.json`) deny();
    const payload = {
      schema: 'OX-PAID-NFT-DELIVERY-INTENT-1',
      orderId: row.orderId, mintJobId: plan.mintJobId,
      membershipId: plan.membershipId, bindingId: plan.bindingId,
      settlementId: row.settlementId, paymentTxHash: row.paymentTxHash,
      chainId: 8453, tokenId: plan.tokenId, recipient: plan.recipient,
      batchId: row.batchId, metadataHash: row.metadataHash,
      mediaHash: row.mediaHash, metadataPath: row.metadataPath,
      calldata: plan.calldata,
      intendedMinter: MAINNET_LAUNCH_PROFILE.minter,
      expectedRuntimeSha256: MAINNET_LAUNCH_PROFILE.runtimeSha256,
      contractAddress: null,
      deploymentTargetStatus: 'PENDING_VERIFIED_MAINNET_DEPLOYMENT',
    };
    const json = JSON.stringify(payload);
    const intentHash = hash(json);
    const existing = storage.sql.exec(`SELECT * FROM nft_paid_delivery_intents
      WHERE mint_job_id = ? OR order_id = ? OR membership_id = ? OR serial_number = ? LIMIT 2`,
      plan.mintJobId, row.orderId, plan.membershipId, plan.tokenId).toArray();
    let id; let replay;
    if (existing.length) {
      const prior = existing[0];
      if (existing.length !== 1 || prior.mint_job_id !== plan.mintJobId || prior.order_id !== row.orderId ||
          prior.membership_id !== plan.membershipId || prior.serial_number !== plan.tokenId ||
          prior.intent_hash !== intentHash || prior.payload_json !== json || prior.status !== 'PREPARED') deny();
      id = prior.id; replay = true;
    } else {
      id = crypto.randomUUID(); replay = false;
      storage.sql.exec(`INSERT INTO nft_paid_delivery_intents
        (id,mint_job_id,order_id,membership_id,serial_number,intent_hash,payload_json,status,prepared_at)
        VALUES (?,?,?,?,?,?,?,'PREPARED',?)`, id, plan.mintJobId, row.orderId,
        plan.membershipId, plan.tokenId, intentHash, json, new Date(now).toISOString());
    }
    return Object.freeze({
      intentId: id, intentHash, idempotentReplay: replay,
      status: 'PREPARED', payload: Object.freeze(payload),
      sponsorshipApproved: false, mintAuthority: false,
      transactionSubmitted: false, membershipActivated: false,
    });
  });
}
