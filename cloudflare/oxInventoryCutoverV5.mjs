/*
 * OriginX Founding 6000 — additive, explicitly staged inventory migration V5.
 * Does NOT replace historical CommerceCore inventory, enable sales or allocate #0001.
 * This is an INTERNAL operator-only preparation module; not imported by Worker routes.
 */
import { createHash } from 'node:crypto';

export const INVENTORY_CUTOVER_VERSION = 'OX-INVENTORY-CUTOVER-5';
const HASH = /^[0-9a-f]{64}$/;
const REF = /^[a-z0-9-]{4,90}$/;
const fail = suffix => { throw new Error('OX_INVENTORY_V5_' + suffix); };
const sha = text => createHash('sha256').update(text).digest('hex');

function validStorage(storage) {
  if (!storage?.sql?.exec || typeof storage.transactionSync !== 'function') fail('STORAGE_UNAVAILABLE');
}
function tableExists(storage, name) {
  return storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name=?", name).toArray().length === 1;
}
function approvedCertificate(c) {
  if (!c || c.version !== 'OX-GENESIS-ASSET-CERTIFICATE-4' || c.serialNumber !== 1 ||
      c.serial !== '#0001' || c.tier !== 'RARE' || c.metadataPath !== '/nft/metadata/1.json' ||
      c.manifestStatus !== 'ARTIFACTS_HASH_VERIFIED' || c.saleApproved !== false ||
      c.releaseApproved !== false || c.mintApproved !== false || c.inventoryTable !== null ||
      c.inventoryAllocated !== false ||
      ![c.metadataHash,c.mediaHash,c.glyphHash,c.certificateHash].every(h=>typeof h==='string' && HASH.test(h))) fail('CERTIFICATE_INVALID');
  const {certificateHash,...body} = c;
  if (sha(JSON.stringify(body)) !== certificateHash) fail('CERTIFICATE_TAMPERED');
}

function legacySnapshot(storage, allowGenesisAllocation = false) {
  if (!tableExists(storage,'nft_release_assets') || !tableExists(storage,'inventory_allocations') ||
      !tableExists(storage,'founding_orders')) fail('LEGACY_SCHEMA_MISSING');
  const rows = storage.sql.exec(`SELECT serial_number AS serialNumber, batch_id AS batchId,
      metadata_hash AS metadataHash,media_hash AS mediaHash,metadata_path AS metadataPath,
      order_id AS orderId,state FROM nft_release_assets ORDER BY serial_number`).toArray();
  if (rows.length > 999) fail('LEGACY_CAPACITY_INVALID');
  const orders = new Set();
  for (const r of rows) {
    if (!Number.isInteger(r.serialNumber) || r.serialNumber < 2 || r.serialNumber > 1000 ||
        !REF.test(r.batchId) || ![r.metadataHash,r.mediaHash].every(h=>typeof h==='string' && HASH.test(h)) ||
        r.metadataPath !== `/nft/releases/${r.batchId}/${String(r.serialNumber).padStart(4,'0')}/metadata-${r.metadataHash}.json` ||
        !['PREPARED','RESERVED','ALLOCATED'].includes(r.state)) fail('LEGACY_ASSET_INVALID');
    if (r.state === 'PREPARED' && r.orderId !== null) fail('LEGACY_PREPARED_ORDER_CONFLICT');
    if (r.state !== 'PREPARED') {
      if (typeof r.orderId !== 'string' || !r.orderId.length || orders.has(r.orderId)) fail('LEGACY_ORDER_CONFLICT');
      orders.add(r.orderId);
      const order = storage.sql.exec('SELECT id,status FROM founding_orders WHERE id=?',r.orderId).toArray();
      if (order.length !== 1 || (r.state==='ALLOCATED' ? order[0].status!=='PAID' : order[0].status!=='CREATED')) fail('LEGACY_ORDER_STATE_MISMATCH');
    }
    const matches = storage.sql.exec('SELECT order_id FROM inventory_allocations WHERE serial_number=?',r.serialNumber).toArray();
    if (r.state === 'ALLOCATED' ? (matches.length!==1 || matches[0].order_id!==r.orderId) : matches.length!==0) fail('LEGACY_ALLOCATION_MISMATCH');
  }
  // Any legacy transaction/activation for #0001 must be reviewed, never silently replaced.
  if (!allowGenesisAllocation) for (const name of ['inventory_allocations','founding_memberships','nft_mint_jobs','nft_paid_delivery_intents']) {
    if (!tableExists(storage,name)) continue;
    if (storage.sql.exec(`SELECT serial_number FROM ${name} WHERE serial_number=1 LIMIT 1`).toArray().length) fail('GENESIS_ALREADY_ASSIGNED');
  }
  return { rows, hash: sha(JSON.stringify(rows)) };
}

export function initializeInventoryCutoverV5(storage) {
  validStorage(storage);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ox_release_assets_v5 (
      serial_number INTEGER PRIMARY KEY CHECK(serial_number BETWEEN 1 AND 6000),
      origin TEXT NOT NULL CHECK(origin IN ('GENESIS_V4','LEGACY_V1')),
      batch_id TEXT NOT NULL,metadata_hash TEXT NOT NULL,media_hash TEXT NOT NULL,
      metadata_path TEXT NOT NULL, certificate_hash TEXT,
      legacy_order_id TEXT UNIQUE,
      legacy_state TEXT NOT NULL CHECK(legacy_state IN ('PREPARED','RESERVED','ALLOCATED')),
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ox_inventory_cutovers_v5 (
      version TEXT PRIMARY KEY CHECK(version='OX-INVENTORY-CUTOVER-5'),
      legacy_snapshot_hash TEXT NOT NULL,genesis_certificate_hash TEXT NOT NULL,
      legacy_row_count INTEGER NOT NULL,imported_row_count INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status='STAGED_NOT_ACTIVE'),created_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS ox_v5_asset_immutable_update BEFORE UPDATE ON ox_release_assets_v5
      BEGIN SELECT RAISE(ABORT,'OX_V5_INVENTORY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ox_v5_asset_immutable_delete BEFORE DELETE ON ox_release_assets_v5
      BEGIN SELECT RAISE(ABORT,'OX_V5_INVENTORY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ox_v5_cutover_immutable_update BEFORE UPDATE ON ox_inventory_cutovers_v5
      BEGIN SELECT RAISE(ABORT,'OX_V5_CUTOVER_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ox_v5_cutover_immutable_delete BEFORE DELETE ON ox_inventory_cutovers_v5
      BEGIN SELECT RAISE(ABORT,'OX_V5_CUTOVER_IMMUTABLE'); END;
  `);
}

export function previewInventoryCutoverV5({storage}) {
  validStorage(storage);
  const savedAlready=tableExists(storage,'ox_inventory_cutovers_v5');
  const legacy=legacySnapshot(storage,savedAlready);
  const v4Candidate=tableExists(storage,'ox_genesis_asset_candidates_v4')
    ? storage.sql.exec('SELECT * FROM ox_genesis_asset_candidates_v4 WHERE serial_number=1').toArray() : [];
  const saved=tableExists(storage,'ox_inventory_cutovers_v5')
    ? storage.sql.exec('SELECT * FROM ox_inventory_cutovers_v5 WHERE version=?',INVENTORY_CUTOVER_VERSION).toArray() : [];
  return Object.freeze({version:INVENTORY_CUTOVER_VERSION,legacyRows:legacy.rows.length,
    legacySnapshotHash:legacy.hash,genesisCandidateRecorded:v4Candidate.length===1,
    alreadyStaged:saved.length===1,stageStatus:saved[0]?.status??'NOT_STAGED',
    historicalRowsPreserved:true,liveInventoryModified:false,salesEnabled:false,
    migrationsAutomaticallyApplied:false,mintAuthorized:false,redemptionAuthorized:false});
}

export function stageInventoryCutoverV5({storage,genesisCertificate,authorizeStaging,now=Date.now()}) {
  validStorage(storage);approvedCertificate(genesisCertificate);
  if (!Number.isSafeInteger(now) || now<0 || now>8640000000000000) fail('TIME_INVALID');
  if (typeof authorizeStaging!=='function') fail('AUTHORIZATION_REQUIRED');
  let authorized=false;
  try { authorized=authorizeStaging(Object.freeze({operation:'STAGE_INVENTORY_V5_ONLY',version:INVENTORY_CUTOVER_VERSION,
    genesisCertificateHash:genesisCertificate.certificateHash}))===true; } catch { /* deny */ }
  if (!authorized) fail('AUTHORIZATION_DENIED');
  return storage.transactionSync(()=>{
    const previouslyStaged=tableExists(storage,'ox_inventory_cutovers_v5') &&
      storage.sql.exec('SELECT version FROM ox_inventory_cutovers_v5 WHERE version=?',INVENTORY_CUTOVER_VERSION).toArray().length===1;
    const legacy=legacySnapshot(storage,previouslyStaged);
    const candidate=tableExists(storage,'ox_genesis_asset_candidates_v4')
      ? storage.sql.exec('SELECT * FROM ox_genesis_asset_candidates_v4 WHERE serial_number=1').toArray() : [];
    if (candidate.length!==1 || candidate[0].certificate_hash!==genesisCertificate.certificateHash ||
        candidate[0].metadata_hash!==genesisCertificate.metadataHash ||
        candidate[0].media_hash!==genesisCertificate.mediaHash ||
        candidate[0].glyph_hash!==genesisCertificate.glyphHash ||
        candidate[0].status!=='PREPARED_NOT_FOR_SALE') fail('GENESIS_CANDIDATE_NOT_VERIFIED');
    initializeInventoryCutoverV5(storage);
    const existing=storage.sql.exec('SELECT * FROM ox_inventory_cutovers_v5 WHERE version=?',INVENTORY_CUTOVER_VERSION).toArray();
    if (existing.length) {
      const prior=existing[0];
      if(existing.length!==1 || prior.legacy_snapshot_hash!==legacy.hash ||
          prior.genesis_certificate_hash!==genesisCertificate.certificateHash ||
          prior.legacy_row_count!==legacy.rows.length || prior.imported_row_count!==legacy.rows.length+1 ||
          prior.status!=='STAGED_NOT_ACTIVE' ||
          storage.sql.exec('SELECT COUNT(*) AS n FROM ox_release_assets_v5').toArray()[0].n!==legacy.rows.length+1) fail('STAGED_SNAPSHOT_CONFLICT');
      return Object.freeze({version:INVENTORY_CUTOVER_VERSION,status:'STAGED_NOT_ACTIVE',
        legacyRows:legacy.rows.length,importedRows:legacy.rows.length+1,idempotentReplay:true,salesEnabled:false});
    }
    if(storage.sql.exec('SELECT COUNT(*) AS n FROM ox_release_assets_v5').toArray()[0].n!==0) fail('SHADOW_TABLE_NOT_EMPTY');
    const at=new Date(now).toISOString();
    // Only a shadow inventory: immutable rows do not become saleable in CommerceCore.
    storage.sql.exec(`INSERT INTO ox_release_assets_v5(serial_number,origin,batch_id,metadata_hash,
      media_hash,metadata_path,certificate_hash,legacy_order_id,legacy_state,imported_at)
      VALUES(1,'GENESIS_V4','genesis-0001',?,?,?, ?,NULL,'PREPARED',?)`,
      genesisCertificate.metadataHash,genesisCertificate.mediaHash,genesisCertificate.metadataPath,
      genesisCertificate.certificateHash,at);
    for (const row of legacy.rows) {
      storage.sql.exec(`INSERT INTO ox_release_assets_v5(serial_number,origin,batch_id,metadata_hash,
        media_hash,metadata_path,certificate_hash,legacy_order_id,legacy_state,imported_at)
        VALUES (?,'LEGACY_V1',?,?,?, ?,NULL,?,?,?)`,row.serialNumber,row.batchId,row.metadataHash,
        row.mediaHash,row.metadataPath,row.orderId,row.state,at);
    }
    const count=storage.sql.exec('SELECT COUNT(*) AS n FROM ox_release_assets_v5').toArray()[0].n;
    if(count!==legacy.rows.length+1) fail('STAGE_ROW_COUNT_MISMATCH');
    storage.sql.exec(`INSERT INTO ox_inventory_cutovers_v5
      (version,legacy_snapshot_hash,genesis_certificate_hash,legacy_row_count,imported_row_count,status,created_at)
      VALUES(?,?,?,?,?,'STAGED_NOT_ACTIVE',?)`,INVENTORY_CUTOVER_VERSION,legacy.hash,
      genesisCertificate.certificateHash,legacy.rows.length,count,at);
    return Object.freeze({version:INVENTORY_CUTOVER_VERSION,status:'STAGED_NOT_ACTIVE',
      legacyRows:legacy.rows.length,importedRows:count,legacySnapshotHash:legacy.hash,
      idempotentReplay:false,salesEnabled:false,mintAuthorized:false,liveInventoryModified:false});
  });
}
