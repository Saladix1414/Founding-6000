/*
 * OriginX V6 — opt-in genesis checkout routing, internal-only.
 * Historical V1 and V5 rows remain untouched. The feature MUST NOT be passed
 * from an HTTP request or enabled in FoundingCore before independent approval.
 * No minting, membership activation, reserve posting or new payment verifier.
 */
import { createHash } from 'node:crypto';

export const GENESIS_CHECKOUT_VERSION = 'OX-GENESIS-CHECKOUT-6';
const HASH = /^[a-f0-9]{64}$/i;
const fail = suffix => { throw new Error(`OX_GENESIS_CHECKOUT_V6_${suffix}`); };
const sha = value => createHash('sha256').update(value).digest('hex');
function one(rows, code) { if (rows.length !== 1) fail(code); return rows[0]; }
function required(storage) {
  if (!storage?.sql?.exec || typeof storage.transactionSync !== 'function') fail('STORAGE_UNAVAILABLE');
}
function assertConfiguration(config, release) {
  if (!config || config.version !== GENESIS_CHECKOUT_VERSION ||
      config.mode !== 'INTERNAL_REVIEW_ONLY' || config.serialNumber !== 1 ||
      config.salesActivationApproved !== false || config.mintActivationApproved !== false ||
      !HASH.test(config.certificateHash ?? '') || !HASH.test(config.legacySnapshotHash ?? '') ||
      release?.approvedForSale !== true || release?.version !== 'OX-RARE-RELEASE-1' ||
      release?.batchId !== 'rare-0002-0101') fail('POLICY_NOT_REVIEWABLE');
  // Never allow a preparation-only policy to be used for a sale.
}
function stage(storage, config) {
  const s = one(storage.sql.exec(`SELECT legacy_snapshot_hash,genesis_certificate_hash,status
    FROM ox_inventory_cutovers_v5 WHERE version='OX-INVENTORY-CUTOVER-5'`).toArray(), 'V5_STAGE_MISSING');
  if (s.status !== 'STAGED_NOT_ACTIVE' || s.legacy_snapshot_hash !== config.legacySnapshotHash ||
      s.genesis_certificate_hash !== config.certificateHash) fail('V5_STAGE_MISMATCH');
  const asset = one(storage.sql.exec(`SELECT * FROM ox_release_assets_v5
    WHERE serial_number=1 AND origin='GENESIS_V4' AND legacy_state='PREPARED'
      AND legacy_order_id IS NULL`).toArray(), 'GENESIS_ASSET_MISSING');
  const candidate = one(storage.sql.exec(`SELECT * FROM ox_genesis_asset_candidates_v4
    WHERE serial_number=1 AND status='PREPARED_NOT_FOR_SALE'`).toArray(), 'GENESIS_CANDIDATE_MISSING');
  if (asset.certificate_hash !== config.certificateHash ||
      candidate.certificate_hash !== config.certificateHash ||
      asset.metadata_hash !== candidate.metadata_hash ||
      asset.media_hash !== candidate.media_hash ||
      asset.metadata_path !== '/nft/metadata/1.json') fail('GENESIS_CERTIFICATE_MISMATCH');
  return asset;
}

// Deliberately only a *route simulation*; neither release V1 nor V6 is approved for real buyers.
// A future activation must introduce a NEW reviewed policy, not just change env flags.
export function initializeGenesisCheckoutV6(storage, config, rareRelease) {
  required(storage); assertConfiguration(config, rareRelease); stage(storage, config);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ox_genesis_checkout_v6 (
      serial_number INTEGER PRIMARY KEY CHECK(serial_number=1),
      certificate_hash TEXT NOT NULL, legacy_snapshot_hash TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('AVAILABLE','RESERVED','ALLOCATED')),
      order_id TEXT UNIQUE, settlement_reference TEXT UNIQUE,
      updated_at TEXT NOT NULL,
      CHECK((state='AVAILABLE' AND order_id IS NULL AND settlement_reference IS NULL)
        OR (state='RESERVED' AND order_id IS NOT NULL AND settlement_reference IS NULL)
        OR (state='ALLOCATED' AND order_id IS NOT NULL AND settlement_reference IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS ox_genesis_checkout_events_v6 (
      event_key TEXT PRIMARY KEY, event_type TEXT NOT NULL CHECK(event_type IN ('RESERVED','ALLOCATED')),
      serial_number INTEGER NOT NULL CHECK(serial_number=1),
      order_id TEXT NOT NULL, settlement_reference TEXT, created_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS ox_genesis_v6_events_immutable_update BEFORE UPDATE ON ox_genesis_checkout_events_v6 BEGIN SELECT RAISE(ABORT,'OX_GENESIS_V6_AUDIT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ox_genesis_v6_events_immutable_delete BEFORE DELETE ON ox_genesis_checkout_events_v6 BEGIN SELECT RAISE(ABORT,'OX_GENESIS_V6_AUDIT_IMMUTABLE'); END;
  `);
  const now = new Date().toISOString();
  storage.sql.exec(`INSERT OR IGNORE INTO ox_genesis_checkout_v6
    (serial_number,certificate_hash,legacy_snapshot_hash,state,order_id,settlement_reference,updated_at)
    VALUES (1,?,?,'AVAILABLE',NULL,NULL,?)`,config.certificateHash,config.legacySnapshotHash,now);
  const row = one(storage.sql.exec('SELECT * FROM ox_genesis_checkout_v6 WHERE serial_number=1').toArray(), 'STATE_MISSING');
  if (row.certificate_hash !== config.certificateHash || row.legacy_snapshot_hash !== config.legacySnapshotHash) fail('CONFIGURATION_DRIFT');
  return Object.freeze({version:GENESIS_CHECKOUT_VERSION,state:row.state,
    orderId:row.order_id ?? null,liveSalesApproved:false,mintAuthorized:false});
}

// Read-only simulation for a prospective checkout. Never writes an order.
export function previewGenesisCheckoutV6({storage,config,rareRelease}) {
  required(storage);assertConfiguration(config,rareRelease);stage(storage,config);
  const row = one(storage.sql.exec('SELECT state,order_id FROM ox_genesis_checkout_v6 WHERE serial_number=1').toArray(),'STATE_MISSING');
  return Object.freeze({version:GENESIS_CHECKOUT_VERSION,serialNumber:1,
    availableForInternalSimulation:row.state==='AVAILABLE',
    currentState:row.state,serialReservedByExistingOrder:row.state!=='AVAILABLE',
    liveSalesApproved:false,paymentAuthorized:false,mintAuthorized:false});
}

/* Called from CommerceCore ONLY in an operator-controlled in-memory simulation.
   A real public checkout intentionally has no activateable V6 policy in this release. */
export function simulateGenesisReservationV6(storage, config, rareRelease, orderId, phase) {
  required(storage);assertConfiguration(config,rareRelease);stage(storage,config);
  if (typeof orderId !== 'string' || !orderId || phase?.id !== 'phase-genesis' ||
      phase?.code !== 'GENESIS' || Number(phase.serialStart) !== 1 ||
      Number(phase.serialEnd) !== 1000 || Number(phase.referencePriceUsd) !== 50) fail('PHASE_INVALID');
  const row = one(storage.sql.exec('SELECT * FROM ox_genesis_checkout_v6 WHERE serial_number=1').toArray(), 'STATE_MISSING');
  if (row.state !== 'AVAILABLE') return false; // Exactly one simulated reservation. Others use existing RARE inventory.
  if (storage.sql.exec('SELECT serial_number FROM inventory_allocations WHERE serial_number=1 LIMIT 1').toArray().length) fail('SERIAL_ALREADY_SOLD');
  if (storage.sql.exec('SELECT serial_number FROM nft_mint_jobs WHERE serial_number=1 LIMIT 1').toArray().length) fail('SERIAL_MINT_JOB_CONFLICT');
  const at=new Date().toISOString();
  storage.sql.exec(`UPDATE ox_genesis_checkout_v6 SET state='RESERVED',order_id=?,updated_at=?
    WHERE serial_number=1 AND state='AVAILABLE' AND order_id IS NULL`,orderId,at);
  const claimed = one(storage.sql.exec('SELECT state,order_id FROM ox_genesis_checkout_v6 WHERE serial_number=1').toArray(), 'STATE_MISSING');
  if (claimed.state!=='RESERVED' || claimed.order_id!==orderId) fail('CONCURRENT_RESERVATION');
  storage.sql.exec(`INSERT INTO ox_genesis_checkout_events_v6
    (event_key,event_type,serial_number,order_id,settlement_reference,created_at)
    VALUES (?,'RESERVED',1,?,NULL,?)`,sha(`reserve:${orderId}`),orderId,at);
  return true;
}

export function readReservedGenesisV6(storage,config,rareRelease,orderId) {
  required(storage);assertConfiguration(config,rareRelease);stage(storage,config);
  if (typeof orderId!=='string' || !orderId) fail('ORDER_INVALID');
  const rows=storage.sql.exec(`SELECT serial_number FROM ox_genesis_checkout_v6
    WHERE order_id=? AND state='RESERVED'`,orderId).toArray();
  if (rows.length>1) fail('AMBIGUOUS_RESERVATION');
  return rows.length ? 1 : null;
}

export function simulateGenesisAllocationV6(storage,config,rareRelease,orderId,serialNumber,txHash) {
  required(storage);assertConfiguration(config,rareRelease);stage(storage,config);
  if (serialNumber!==1 || typeof orderId!=='string' || !orderId ||
      typeof txHash!=='string' || !/^0x[a-f0-9]{64}$/i.test(txHash)) fail('SETTLEMENT_INPUT_INVALID');
  const row = one(storage.sql.exec(`SELECT * FROM ox_genesis_checkout_v6 WHERE serial_number=1`).toArray(),'STATE_MISSING');
  if(row.state!=='RESERVED' || row.order_id!==orderId) fail('RESERVATION_MISSING');
  const allocation = one(storage.sql.exec(`SELECT ia.serial_number,ia.settlement_reference,
      o.status AS order_status FROM inventory_allocations ia
      JOIN founding_orders o ON o.id=ia.order_id WHERE ia.serial_number=1 AND ia.order_id=?`,orderId).toArray(),'PAID_ALLOCATION_MISSING');
  // Existing CommerceCore sets PAID after allocating the NFT; allow CREATED here.
  if (allocation.settlement_reference.toLowerCase()!==txHash.toLowerCase() ||
      allocation.order_status!=='CREATED') fail('ALLOCATION_CONFLICT');
  const at=new Date().toISOString();
  storage.sql.exec(`UPDATE ox_genesis_checkout_v6 SET state='ALLOCATED',settlement_reference=?,updated_at=?
    WHERE serial_number=1 AND state='RESERVED' AND order_id=?`,txHash.toLowerCase(),at,orderId);
  const check=one(storage.sql.exec('SELECT state,order_id,settlement_reference FROM ox_genesis_checkout_v6 WHERE serial_number=1').toArray(),'STATE_MISSING');
  if(check.state!=='ALLOCATED' || check.order_id!==orderId || check.settlement_reference!==txHash.toLowerCase()) fail('ALLOCATION_RACE');
  storage.sql.exec(`INSERT INTO ox_genesis_checkout_events_v6
    (event_key,event_type,serial_number,order_id,settlement_reference,created_at)
    VALUES (?,'ALLOCATED',1,?,?,?)`,sha(`allocate:${orderId}:${txHash.toLowerCase()}`),orderId,txHash.toLowerCase(),at);
  return Object.freeze({serialNumber:1,orderId,allocated:true,subscriptionActivated:false,mintAuthorized:false});
}
