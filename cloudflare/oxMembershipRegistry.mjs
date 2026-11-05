import {
  assert, isSerial, nowIso, addCalendarYear, requireStorage,
  requireAuthorization, requireProof, one, UUID, WALLET, TX_HASH, sha256,
} from './oxRegistryCommon.mjs';

export function initializeMembershipRegistry(storage) {
  requireStorage(storage);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ox_membership_access (
      serial_number INTEGER PRIMARY KEY CHECK(serial_number BETWEEN 1 AND 6000),
      membership_id TEXT NOT NULL UNIQUE,
      settlement_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('PENDING_ACTIVATION','ACTIVE','REDEEMED')),
      activated_at TEXT, expires_at TEXT,
      last_observed_owner TEXT, last_observed_block INTEGER, last_observed_log_index INTEGER,
      registered_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ox_membership_access_events (
      event_key TEXT PRIMARY KEY,
      serial_number INTEGER NOT NULL REFERENCES ox_membership_access(serial_number),
      event_type TEXT NOT NULL CHECK(event_type IN ('REGISTERED','ACTIVATED','TRANSFER_OBSERVED')),
      proof_reference TEXT NOT NULL,
      proof_hash TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ox_member_events_serial ON ox_membership_access_events(serial_number);
    CREATE TRIGGER IF NOT EXISTS ox_member_events_immutable_update BEFORE UPDATE ON ox_membership_access_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_MEMBERSHIP_EVENT'); END;
    CREATE TRIGGER IF NOT EXISTS ox_member_events_immutable_delete BEFORE DELETE ON ox_membership_access_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_MEMBERSHIP_EVENT'); END;
  `);
}

// Existing payment-settlement and membership tables remain the source of issuance eligibility.
// This does not grant product access or certify NFT minting.
export function registerSettledMembership({ storage, membershipId, now = Date.now() }) {
  requireStorage(storage);
  assert(typeof membershipId === 'string' && UUID.test(membershipId), 'OX_MEMBERSHIP_ID_INVALID');
  const registeredAt = nowIso(now);
  return storage.transactionSync(() => {
    const row = one(storage.sql.exec(`
      SELECT m.id AS membershipId, m.serial_number AS serialNumber,
             m.status AS membershipStatus, ps.id AS settlementId,
             ps.external_reference AS paymentHash
      FROM founding_memberships m
      JOIN founding_orders o ON o.id = m.order_id AND o.status = 'PAID'
      JOIN inventory_allocations ia ON ia.order_id = o.id AND ia.serial_number = m.serial_number
      JOIN payment_settlements ps ON ps.order_id = o.id AND ps.external_reference = ia.settlement_reference
      JOIN payment_attempts pa ON pa.id = ps.payment_attempt_id AND pa.order_id = o.id
       AND pa.tx_hash = ps.external_reference AND pa.status = 'VERIFIED'
       AND pa.network = ps.network AND pa.chain_id = ps.chain_id
       AND pa.token_decimals = 6 AND lower(pa.token_contract) = lower(ps.token_contract)
       AND lower(pa.receiver_address) = lower(ps.receiver_address)
      WHERE m.id = ? AND ps.confirmations >= 12
       AND ps.amount_minor > 0 AND ps.amount_minor = pa.expected_amount_minor
       AND ps.amount_minor = o.reference_price_usd * 1000000
       AND ps.chain_id = 1 AND ps.network = 'ethereum-mainnet'
       AND lower(ps.token_contract) = '0xdac17f958d2ee523a2206206994597c13d831ec7'
      LIMIT 2
    `, membershipId).toArray(), 'OX_MEMBERSHIP_NOT_SETTLED');
    assert(isSerial(row.serialNumber), 'OX_SERIAL_INVALID');
    assert(['ACTIVATION_PENDING','ACTIVE'].includes(row.membershipStatus), 'OX_MEMBERSHIP_STATUS_INVALID');
    const previous = storage.sql.exec('SELECT * FROM ox_membership_access WHERE serial_number = ? OR membership_id = ? OR settlement_id = ? LIMIT 2', row.serialNumber, membershipId, row.settlementId).toArray();
    if (previous.length) {
      const found = one(previous);
      assert(found.membership_id === membershipId && found.serial_number === row.serialNumber && found.settlement_id === row.settlementId, 'OX_MEMBERSHIP_CONFLICT');
      return Object.freeze({ serialNumber: row.serialNumber, membershipId, status: found.status, idempotentReplay: true });
    }
    assert(row.membershipStatus === 'ACTIVATION_PENDING', 'OX_MEMBERSHIP_ALREADY_ACTIVE_UNRECONCILED');
    storage.sql.exec(`INSERT INTO ox_membership_access
      (serial_number,membership_id,settlement_id,status,registered_at)
      VALUES (?,?,?,'PENDING_ACTIVATION',?)`, row.serialNumber, membershipId, row.settlementId, registeredAt);
    storage.sql.exec(`INSERT INTO ox_membership_access_events
      (event_key,serial_number,event_type,proof_reference,proof_hash,occurred_at)
      VALUES (?,?,'REGISTERED',?,?,?)`, 'register:' + membershipId, row.serialNumber, row.settlementId,
        // The payment identifier is a pointer only, not a new claim of verified custody.
        row.paymentHash.toLowerCase().replace(/^0x/, ''), registeredAt);
    return Object.freeze({ serialNumber: row.serialNumber, membershipId, status: 'PENDING_ACTIVATION', idempotentReplay: false });
  });
}

function validateOwnershipProof(proof, serialNumber) {
  assert(proof && proof.chainId === 8453 && proof.tokenId === serialNumber &&
    typeof proof.contract === 'string' && WALLET.test(proof.contract) &&
    typeof proof.owner === 'string' && WALLET.test(proof.owner) &&
    typeof proof.txHash === 'string' && TX_HASH.test(proof.txHash) &&
    Number.isSafeInteger(proof.blockNumber) && proof.blockNumber > 0 &&
    Number.isSafeInteger(proof.logIndex) && proof.logIndex >= 0,
  'OX_OWNERSHIP_PROOF_INVALID');
}

export function activateVerifiedMembership({ storage, membershipId, ownershipProof, authorize, verifyEvidence, now = Date.now() }) {
  requireStorage(storage);
  assert(typeof membershipId === 'string' && UUID.test(membershipId), 'OX_MEMBERSHIP_ID_INVALID');
  const at = nowIso(now);
  return storage.transactionSync(() => {
    const row = one(storage.sql.exec(`SELECT a.*, m.status AS legacyStatus
      FROM ox_membership_access a JOIN founding_memberships m ON m.id = a.membership_id
      WHERE a.membership_id = ? LIMIT 2`, membershipId).toArray());
    assert(row.status === 'PENDING_ACTIVATION' && row.legacyStatus === 'ACTIVATION_PENDING', 'OX_ALREADY_ACTIVATED');
    validateOwnershipProof(ownershipProof, row.serial_number);
    const evidence = { membershipId, serialNumber: row.serial_number, ownershipProof };
    requireAuthorization(authorize, 'ACTIVATE_MEMBERSHIP', evidence);
    requireProof(verifyEvidence, 'VERIFY_CURRENT_BASE_OWNER_AND_MINT', evidence);
    const expiresAt = addCalendarYear(at);
    storage.sql.exec(`UPDATE ox_membership_access SET status='ACTIVE',activated_at=?,expires_at=?,
      last_observed_owner=?,last_observed_block=?,last_observed_log_index=? WHERE serial_number=? AND status='PENDING_ACTIVATION'`,
      at, expiresAt, ownershipProof.owner, ownershipProof.blockNumber, ownershipProof.logIndex, row.serial_number);
    storage.sql.exec(`UPDATE founding_memberships SET status='ACTIVE',activation_started_at=?,
      activation_expires_at=?,updated_at=? WHERE id=? AND status='ACTIVATION_PENDING'`, at, expiresAt, at, membershipId);
    storage.sql.exec(`INSERT INTO ox_membership_access_events
      (event_key,serial_number,event_type,proof_reference,proof_hash,occurred_at)
      VALUES (?,?,'ACTIVATED',?,?,?)`, `activate:${membershipId}`, row.serial_number,
      `${ownershipProof.chainId}:${ownershipProof.txHash}:${ownershipProof.logIndex}`,
      sha256(JSON.stringify(ownershipProof)), at);
    return Object.freeze({ membershipId, serialNumber: row.serial_number, activatedAt: at, expiresAt, status: 'ACTIVE' });
  });
}

// An observation is not authorization for app access. Check CURRENT owner on Base at login.
export function observeVerifiedOwnershipTransfer({ storage, serialNumber, ownershipProof, authorize, verifyEvidence, now = Date.now() }) {
  requireStorage(storage);
  assert(isSerial(serialNumber), 'OX_SERIAL_INVALID');
  const at = nowIso(now);
  return storage.transactionSync(() => {
    const row = one(storage.sql.exec('SELECT * FROM ox_membership_access WHERE serial_number=?', serialNumber).toArray());
    assert(row.status === 'ACTIVE', 'OX_MEMBERSHIP_NOT_ACTIVE');
    validateOwnershipProof(ownershipProof, serialNumber);
    const eventKey = `owner:${ownershipProof.chainId}:${ownershipProof.txHash.toLowerCase()}:${ownershipProof.logIndex}`;
    const existing = storage.sql.exec('SELECT serial_number,proof_hash FROM ox_membership_access_events WHERE event_key=?', eventKey).toArray();
    if (existing.length) {
      const prior = one(existing);
      assert(prior.serial_number === serialNumber && prior.proof_hash === sha256(JSON.stringify(ownershipProof)), 'OX_OWNERSHIP_EVENT_CONFLICT');
      return { serialNumber, expiresAt: row.expires_at, idempotentReplay: true };
    }
    assert(ownershipProof.blockNumber > row.last_observed_block ||
      (ownershipProof.blockNumber === row.last_observed_block &&
        ownershipProof.logIndex > row.last_observed_log_index), 'OX_OWNERSHIP_STALE');
    const facts = { serialNumber, ownershipProof, expiresAt: row.expires_at };
    requireAuthorization(authorize, 'OBSERVE_OWNER_TRANSFER', facts);
    requireProof(verifyEvidence, 'VERIFY_CURRENT_BASE_OWNER_AND_TRANSFER', facts);
    storage.sql.exec('UPDATE ox_membership_access SET last_observed_owner=?,last_observed_block=?,last_observed_log_index=? WHERE serial_number=?',
      ownershipProof.owner, ownershipProof.blockNumber, ownershipProof.logIndex, serialNumber);
    storage.sql.exec(`INSERT INTO ox_membership_access_events
      (event_key,serial_number,event_type,proof_reference,proof_hash,occurred_at)
      VALUES (?,?,'TRANSFER_OBSERVED',?,?,?)`, eventKey, serialNumber,
      ownershipProof.txHash, sha256(JSON.stringify(ownershipProof)), at);
    return Object.freeze({ serialNumber, expiresAt: row.expires_at, idempotentReplay: false });
  });
}

export function membershipAccessSnapshot({ storage, serialNumber, now = Date.now() }) {
  requireStorage(storage);
  assert(isSerial(serialNumber), 'OX_SERIAL_INVALID');
  const row = storage.sql.exec('SELECT * FROM ox_membership_access WHERE serial_number=?', serialNumber).toArray()[0];
  if (!row) return null;
  const expired = row.status === 'ACTIVE' && nowIso(now) >= row.expires_at;
  return Object.freeze({
    serialNumber, membershipId: row.membership_id, status: expired ? 'EXPIRED' : row.status,
    activatedAt: row.activated_at, expiresAt: row.expires_at,
    lastObservedOwner: row.last_observed_owner,
    currentOwnershipVerified: false, // No cached balance grants access.
  });
}
