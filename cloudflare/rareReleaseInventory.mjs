/* Art registry only. Allocation, settlement and delivery remain in CommerceCore. */
export function initializeRareRelease(storage, release) {
  if (!release || release.version !== 'OX-RARE-RELEASE-1' ||
      release.quantityPerSale !== 1 || !Array.isArray(release.items) ||
      !release.items.length || release.items.length > 999 ||
      typeof release.batchId !== 'string' || !/^[a-z0-9-]+$/.test(release.batchId)) {
    throw new Error('NFT_RELEASE_INVALID');
  }
  const ids = new Set();
  for (const item of release.items) {
    if (!Number.isInteger(item.tokenId) || item.tokenId < 2 || item.tokenId > 1000 ||
        ids.has(item.tokenId) || !/^[a-f0-9]{64}$/.test(item.metadataHash) ||
        !/^[a-f0-9]{64}$/.test(item.mediaHash)) throw new Error('NFT_RELEASE_INVALID');
    if (item.metadataPath !== `/nft/releases/${release.batchId}/${String(item.tokenId).padStart(4,'0')}/metadata-${item.metadataHash}.json`) throw new Error('NFT_RELEASE_INVALID');
    ids.add(item.tokenId);
  }
  storage.sql.exec(`CREATE TABLE IF NOT EXISTS nft_release_assets (
    serial_number INTEGER PRIMARY KEY CHECK(serial_number BETWEEN 2 AND 1000),
    batch_id TEXT NOT NULL, metadata_hash TEXT NOT NULL, media_hash TEXT NOT NULL,
    metadata_path TEXT NOT NULL, order_id TEXT UNIQUE,
    state TEXT NOT NULL CHECK(state IN ('PREPARED','RESERVED','ALLOCATED'))
  )`);
  storage.transactionSync(() => {
    for (const item of release.items) {
      const prior = storage.sql.exec('SELECT * FROM nft_release_assets WHERE serial_number = ?', item.tokenId).toArray()[0];
      if (prior && (prior.batch_id !== release.batchId || prior.metadata_hash !== item.metadataHash ||
          prior.media_hash !== item.mediaHash || prior.metadata_path !== item.metadataPath)) {
        throw new Error('NFT_RELEASE_IMMUTABLE_CONFLICT');
      }
      if (!prior) storage.sql.exec(`INSERT INTO nft_release_assets
        (serial_number,batch_id,metadata_hash,media_hash,metadata_path,state)
        VALUES (?,?,?,?,?,'PREPARED')`, item.tokenId, release.batchId,
        item.metadataHash, item.mediaHash, item.metadataPath);
    }
  });
}

// Called only INSIDE CommerceCore's existing order transaction.
export function reserveRareAsset(storage, release, orderId, phase) {
  if (release.approvedForSale !== true) throw new Error('NFT_RELEASE_NOT_APPROVED');
  if (Number(phase.serialStart) !== 1 || Number(phase.serialEnd) !== 1000) {
    throw new Error('NFT_RELEASE_PHASE_UNAVAILABLE');
  }
  const asset = storage.sql.exec(`SELECT r.serial_number AS serialNumber
    FROM nft_release_assets r WHERE r.batch_id = ? AND r.state = 'PREPARED'
    AND NOT EXISTS (SELECT 1 FROM inventory_allocations a WHERE a.serial_number = r.serial_number)
    ORDER BY r.serial_number LIMIT 1`, release.batchId).toArray()[0];
  if (!asset) throw new Error('NFT_RELEASE_SOLD_OUT');
  storage.sql.exec(`UPDATE nft_release_assets SET order_id = ?, state = 'RESERVED'
    WHERE serial_number = ? AND state = 'PREPARED' AND order_id IS NULL`, orderId, asset.serialNumber);
  const check = storage.sql.exec(`SELECT order_id FROM nft_release_assets
    WHERE serial_number = ? AND state = 'RESERVED'`, asset.serialNumber).toArray()[0];
  if (check?.order_id !== orderId) throw new Error('NFT_RELEASE_RESERVATION_CONFLICT');
  return Number(asset.serialNumber);
}

// Called only INSIDE the existing verified settlement transaction.
export function reservedRareSerial(storage, release, orderId) {
  const rows = storage.sql.exec(`SELECT serial_number AS serialNumber
    FROM nft_release_assets WHERE batch_id = ? AND order_id = ? AND state = 'RESERVED'`,
    release.batchId, orderId).toArray();
  if (rows.length !== 1) throw new Error('NFT_RELEASE_RESERVATION_REQUIRED');
  return Number(rows[0].serialNumber);
}

export function completeRareAllocation(storage, release, orderId, serial) {
  const evidence = storage.sql.exec(`SELECT order_id FROM inventory_allocations
    WHERE serial_number = ? AND order_id = ?`, serial, orderId).toArray();
  if (evidence.length !== 1) throw new Error('NFT_RELEASE_ALLOCATION_EVIDENCE_REQUIRED');
  storage.sql.exec(`UPDATE nft_release_assets SET state = 'ALLOCATED'
    WHERE batch_id = ? AND order_id = ? AND serial_number = ? AND state = 'RESERVED'`,
    release.batchId, orderId, serial);
}
