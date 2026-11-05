import {
  assert, isSerial, isMinor, nowIso, requireStorage,
  requireAuthorization, requireProof, TX_HASH, WALLET, one,
} from './oxRegistryCommon.mjs';
import { postReserveMovementInTransaction } from './oxReserveRegistry.mjs';

export function initializeRedemptionRegistry(storage) {
  requireStorage(storage);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ox_redemption_requests (
      request_key TEXT PRIMARY KEY,
      serial_number INTEGER NOT NULL CHECK(serial_number BETWEEN 1 AND 6000),
      membership_id TEXT NOT NULL,
      requester_wallet TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('POLICY_PENDING','CANCELLED','SETTLED')),
      policy_version TEXT,
      amount_minor INTEGER,
      atomic_tx_hash TEXT UNIQUE,
      request_evidence_hash TEXT NOT NULL,
      prepared_at TEXT NOT NULL,
      settled_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ox_redemption_active_serial
      ON ox_redemption_requests(serial_number)
      WHERE status IN ('POLICY_PENDING','SETTLED');
    CREATE INDEX IF NOT EXISTS ox_redemption_membership ON ox_redemption_requests(membership_id);
  `);
}

// Never sends a blockchain transaction; never reserves liquidity or burns an NFT.
export function prepareRedemptionRequest({ storage, requestKey, serialNumber, membershipId,
  requesterWallet, ownershipEvidenceHash, authorize, verifyEvidence, now = Date.now() }) {
  requireStorage(storage);
  assert(typeof requestKey === 'string' && /^[a-zA-Z0-9.:_/-]{8,160}$/.test(requestKey), 'OX_REDEMPTION_REQUEST_INVALID');
  assert(isSerial(serialNumber) && typeof membershipId === 'string' && membershipId.length <= 100 &&
    WALLET.test(requesterWallet), 'OX_REDEMPTION_IDENTITY_INVALID');
  assert(typeof ownershipEvidenceHash === 'string' && /^[a-f0-9]{64}$/i.test(ownershipEvidenceHash), 'OX_REDEMPTION_EVIDENCE_INVALID');
  const at = nowIso(now);
  return storage.transactionSync(() => {
    const previous = storage.sql.exec('SELECT * FROM ox_redemption_requests WHERE request_key=?', requestKey).toArray();
    if (previous.length) {
      const old = one(previous);
      assert(old.serial_number === serialNumber && old.membership_id === membershipId &&
        old.requester_wallet.toLowerCase() === requesterWallet.toLowerCase() &&
        old.request_evidence_hash.toLowerCase() === ownershipEvidenceHash.toLowerCase(), 'OX_REDEMPTION_REPLAY_CONFLICT');
      return Object.freeze({ requestKey, serialNumber, status: old.status, idempotentReplay: true,
        paymentAuthorized: false, burnAuthorized: false });
    }
    const access = one(storage.sql.exec('SELECT * FROM ox_membership_access WHERE serial_number=? AND membership_id=?',
      serialNumber, membershipId).toArray(), 'OX_REDEMPTION_ACCESS_MISSING');
    assert(access.status === 'ACTIVE', 'OX_REDEMPTION_ACCESS_NOT_ACTIVE');
    const facts = { requestKey, serialNumber, membershipId, requesterWallet, ownershipEvidenceHash };
    requireAuthorization(authorize, 'PREPARE_REDEMPTION_REQUEST', facts);
    requireProof(verifyEvidence, 'VERIFY_CURRENT_BASE_OWNER_FOR_REDEMPTION', facts);
    // The verifier (not the cached initial wallet binding) must establish ownership.
    storage.sql.exec(`INSERT INTO ox_redemption_requests
      (request_key,serial_number,membership_id,requester_wallet,status,request_evidence_hash,prepared_at)
      VALUES (?,?,?,?,'POLICY_PENDING',?,?)`, requestKey, serialNumber, membershipId,
      requesterWallet, ownershipEvidenceHash.toLowerCase(), at);
    return Object.freeze({ requestKey, serialNumber, status: 'POLICY_PENDING', idempotentReplay: false,
      paymentAuthorized: false, burnAuthorized: false });
  });
}

// Reconciles only a completed, independently verified SAME-CHAIN atomic payout + burn.
// It cannot initiate, sign, approve or submit transactions. Do not wire this to public HTTP.
export function recordVerifiedAtomicRedemption({ storage, requestKey, settlement, authorize,
  verifyAtomicEvidence, verifyReserveEvidence, now = Date.now() }) {
  requireStorage(storage);
  assert(typeof requestKey === 'string' && requestKey.length >= 8, 'OX_REDEMPTION_REQUEST_INVALID');
  assert(settlement && settlement.chainId === 8453 && TX_HASH.test(settlement.txHash) &&
    settlement.txHash.toLowerCase() === String(settlement.burnTxHash).toLowerCase() &&
    isMinor(settlement.amountMinor) && typeof settlement.policyVersion === 'string' &&
    /^[A-Z0-9._-]{5,80}$/.test(settlement.policyVersion) &&
    /^[a-f0-9]{64}$/i.test(settlement.evidenceHash) &&
    WALLET.test(settlement.recipientWallet), 'OX_ATOMIC_SETTLEMENT_INVALID');
  const at = nowIso(now);
  return storage.transactionSync(() => {
    const row = one(storage.sql.exec('SELECT * FROM ox_redemption_requests WHERE request_key=?', requestKey).toArray());
    assert(row.status === 'POLICY_PENDING' || row.status === 'SETTLED', 'OX_REDEMPTION_STATUS_INVALID');
    assert(row.serial_number === settlement.tokenId &&
      row.requester_wallet.toLowerCase() === settlement.recipientWallet.toLowerCase(), 'OX_REDEMPTION_SETTLEMENT_MISMATCH');
    const movement = {
      eventKey: `redemption:${row.serial_number}`,
      kind: 'REDEMPTION', amountMinor: settlement.amountMinor, chainId: 8453,
      policyVersion: settlement.policyVersion, sourceReference: settlement.txHash.toLowerCase(),
      evidenceHash: settlement.evidenceHash.toLowerCase(), serialNumber: row.serial_number,
    };
    if (row.status === 'SETTLED') {
      assert(row.atomic_tx_hash === settlement.txHash.toLowerCase() &&
        row.amount_minor === settlement.amountMinor && row.policy_version === settlement.policyVersion,
      'OX_REDEMPTION_SETTLED_CONFLICT');
      return Object.freeze({ requestKey, serialNumber: row.serial_number, status: 'SETTLED', idempotentReplay: true });
    }
    const facts = { requestKey, serialNumber: row.serial_number, membershipId: row.membership_id,
      requestedBy: row.requester_wallet, settlement };
    requireAuthorization(authorize, 'RECONCILE_VERIFIED_ATOMIC_REDEMPTION', facts);
    requireProof(verifyAtomicEvidence, 'VERIFY_BASE_ATOMIC_PAYOUT_AND_BURN_WITH_POLICY', facts);
    // Reserve proof must independently confirm custody, amount, and the final payout.
    postReserveMovementInTransaction({ storage, movement, authorize,
      verifyEvidence: verifyReserveEvidence, now });
    storage.sql.exec(`UPDATE ox_redemption_requests SET status='SETTLED',policy_version=?,
      amount_minor=?,atomic_tx_hash=?,settled_at=? WHERE request_key=? AND status='POLICY_PENDING'`,
      settlement.policyVersion, settlement.amountMinor, settlement.txHash.toLowerCase(), at, requestKey);
    storage.sql.exec(`UPDATE ox_membership_access SET status='REDEEMED'
      WHERE serial_number=? AND membership_id=? AND status='ACTIVE'`, row.serial_number, row.membership_id);
    storage.sql.exec(`UPDATE founding_memberships SET status='REDEEMED',updated_at=?
      WHERE id=? AND serial_number=?`, at, row.membership_id, row.serial_number);
    return Object.freeze({ requestKey, serialNumber: row.serial_number, status: 'SETTLED', idempotentReplay: false });
  });
}


export function redemptionSnapshot({ storage, requestKey }) {
  requireStorage(storage);
  assert(typeof requestKey === 'string' && requestKey.length >= 8 && requestKey.length <= 160,
    'OX_REDEMPTION_REQUEST_INVALID');
  const row = storage.sql.exec('SELECT * FROM ox_redemption_requests WHERE request_key=?', requestKey).toArray()[0];
  if (!row) return null;
  return Object.freeze({ requestKey, serialNumber: row.serial_number, status: row.status,
    policyVersion: row.policy_version, amountMinor: row.amount_minor, currency: 'USDT',
    chainId: 8453, atomicTxHash: row.atomic_tx_hash, preparedAt: row.prepared_at,
    settledAt: row.settled_at, paymentAuthorized: false, burnAuthorized: false });
}
