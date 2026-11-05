import {
  assert, isMinor, nowIso, requireStorage, requireAuthorization,
  requireProof, canonicalEvidence, one, isSerial,
} from './oxRegistryCommon.mjs';

const JOURNAL = Object.freeze({
  ACCRUAL: amount => [['RECEIVABLE', amount], ['CONTRA', -amount]],
  FUNDING: amount => [['RECEIVABLE', -amount], ['LIQUID', amount]],
  INVESTMENT: amount => [['LIQUID', -amount], ['INVESTED', amount]],
  DIVESTMENT: amount => [['INVESTED', -amount], ['LIQUID', amount]],
  GAIN: amount => [['LIQUID', amount], ['CONTRA', -amount]],
  LOSS: amount => [['INVESTED', -amount], ['CONTRA', amount]],
  REDEMPTION: amount => [['LIQUID', -amount], ['REDEEMED', amount]],
});
const CHAIN_IDS = new Set([1, 8453]);
const ACCOUNTS = ['RECEIVABLE', 'LIQUID', 'INVESTED'];

export function initializeReserveRegistry(storage) {
  requireStorage(storage);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ox_reserve_movements (
      event_key TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('ACCRUAL','FUNDING','INVESTMENT','DIVESTMENT','GAIN','LOSS','REDEMPTION')),
      amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
      currency TEXT NOT NULL CHECK(currency = 'USDT'),
      chain_id INTEGER NOT NULL CHECK(chain_id IN (1,8453)),
      policy_version TEXT NOT NULL,
      source_reference TEXT NOT NULL,
      evidence_hash TEXT NOT NULL,
      serial_number INTEGER CHECK(serial_number BETWEEN 1 AND 6000),
      occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ox_reserve_lines (
      event_key TEXT NOT NULL REFERENCES ox_reserve_movements(event_key),
      account TEXT NOT NULL CHECK(account IN ('RECEIVABLE','LIQUID','INVESTED','CONTRA','REDEEMED')),
      amount_minor INTEGER NOT NULL,
      chain_id INTEGER NOT NULL,
      PRIMARY KEY(event_key,account)
    );
    CREATE INDEX IF NOT EXISTS ox_reserve_lines_account_chain ON ox_reserve_lines(account,chain_id);
    CREATE INDEX IF NOT EXISTS ox_reserve_movement_serial ON ox_reserve_movements(serial_number);
    CREATE TRIGGER IF NOT EXISTS ox_reserve_movement_immutable_update BEFORE UPDATE ON ox_reserve_movements BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RESERVE_JOURNAL'); END;
    CREATE TRIGGER IF NOT EXISTS ox_reserve_movement_immutable_delete BEFORE DELETE ON ox_reserve_movements BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RESERVE_JOURNAL'); END;
    CREATE TRIGGER IF NOT EXISTS ox_reserve_line_immutable_update BEFORE UPDATE ON ox_reserve_lines BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RESERVE_JOURNAL'); END;
    CREATE TRIGGER IF NOT EXISTS ox_reserve_line_immutable_delete BEFORE DELETE ON ox_reserve_lines BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RESERVE_JOURNAL'); END;
  `);
}

function accountBalance(storage, account, chainId) {
  const sum = account === 'RECEIVABLE'
    ? storage.sql.exec('SELECT COALESCE(SUM(amount_minor),0) AS balance FROM ox_reserve_lines WHERE account=?', account).toArray()[0]
    : storage.sql.exec('SELECT COALESCE(SUM(amount_minor),0) AS balance FROM ox_reserve_lines WHERE account=? AND chain_id=?', account, chainId).toArray()[0];
  return Number(sum?.balance ?? 0);
}

export function reserveBalances({ storage }) {
  requireStorage(storage);
  const at = { receivableMinor: accountBalance(storage, 'RECEIVABLE', 1),
    liquidEthereumMinor: accountBalance(storage, 'LIQUID', 1),
    liquidBaseMinor: accountBalance(storage, 'LIQUID', 8453),
    investedEthereumMinor: accountBalance(storage, 'INVESTED', 1),
    investedBaseMinor: accountBalance(storage, 'INVESTED', 8453) };
  return Object.freeze({ version: 'OX-RESERVE-JOURNAL-1', currency: 'USDT', decimals: 6,
    ...at, custodyVerifiedAtRead: false, redemptionEnabled: false });
}

// Caller MUST be an internal, trusted reconciler. A caller-supplied amount is not
// proof of a real payment, an investment vote, a treasury transfer or a legal entitlement.
export function postReserveMovementInTransaction({ storage, movement, authorize, verifyEvidence, now = Date.now() }) {
  requireStorage(storage);
  assert(movement && typeof movement === 'object', 'OX_RESERVE_MOVEMENT_INVALID');
  const { eventKey, kind, amountMinor, chainId, policyVersion, sourceReference,
    evidenceHash, serialNumber = null } = movement;
  assert(typeof eventKey === 'string' && /^[a-zA-Z0-9.:_/-]{8,160}$/.test(eventKey), 'OX_RESERVE_KEY_INVALID');
  assert(Object.hasOwn(JOURNAL, kind) && isMinor(amountMinor), 'OX_RESERVE_AMOUNT_INVALID');
  assert(CHAIN_IDS.has(chainId), 'OX_RESERVE_CHAIN_INVALID');
  assert(typeof policyVersion === 'string' && /^[A-Z0-9._-]{5,80}$/.test(policyVersion), 'OX_RESERVE_POLICY_INVALID');
  canonicalEvidence({ proofHash: evidenceHash, reference: sourceReference });
  assert(serialNumber === null || isSerial(serialNumber), 'OX_RESERVE_SERIAL_INVALID');
  assert(kind !== 'REDEMPTION' || (chainId === 8453 && isSerial(serialNumber)), 'OX_REDEMPTION_CHAIN_INVALID');
  const at = nowIso(now);
  const stored = storage.sql.exec('SELECT * FROM ox_reserve_movements WHERE event_key=?', eventKey).toArray();
  if (stored.length) {
    const prior = one(stored);
    assert(prior.kind === kind && prior.amount_minor === amountMinor && prior.chain_id === chainId &&
      prior.policy_version === policyVersion && prior.source_reference === sourceReference &&
      prior.evidence_hash.toLowerCase() === evidenceHash.toLowerCase() &&
      prior.serial_number === serialNumber, 'OX_RESERVE_REPLAY_CONFLICT');
    return Object.freeze({ eventKey, status: 'RECORDED', idempotentReplay: true });
  }
  // Always re-authorize and verify new evidence. No production-approved adapter is shipped here.
  const facts = { ...movement };
  requireAuthorization(authorize, 'POST_RESERVE_' + kind, facts);
  requireProof(verifyEvidence, 'VERIFY_RESERVE_' + kind, facts);
  const lines = JOURNAL[kind](amountMinor);
  assert(lines.reduce((sum, [, value]) => sum + value, 0) === 0, 'OX_RESERVE_NOT_BALANCED');
  for (const [account, delta] of lines) {
    if (ACCOUNTS.includes(account)) {
      const current = accountBalance(storage, account, chainId);
      assert(Number.isSafeInteger(current + delta) && current + delta >= 0,
        'OX_RESERVE_INSUFFICIENT_' + account);
    }
  }
  storage.sql.exec(`INSERT INTO ox_reserve_movements
    (event_key,kind,amount_minor,currency,chain_id,policy_version,
     source_reference,evidence_hash,serial_number,occurred_at)
    VALUES (?,?,?,'USDT',?,?,?,?,?,?)`, eventKey, kind, amountMinor, chainId,
    policyVersion, sourceReference, evidenceHash.toLowerCase(), serialNumber, at);
  for (const [account, delta] of lines) {
    storage.sql.exec('INSERT INTO ox_reserve_lines (event_key,account,amount_minor,chain_id) VALUES (?,?,?,?)',
      eventKey, account, delta, chainId);
  }
  return Object.freeze({ eventKey, status: 'RECORDED', idempotentReplay: false });
}

export function recordVerifiedReserveMovement({ storage, movement, authorize, verifyEvidence, now = Date.now() }) {
  requireStorage(storage);
  // Redemption debit is only reachable through the independently verified atomic reconciliation path.
  assert(movement?.kind !== 'REDEMPTION', 'OX_REDEMPTION_USE_ATOMIC_RECONCILIATION');
  return storage.transactionSync(() => postReserveMovementInTransaction({ storage, movement, authorize, verifyEvidence, now }));
}


export function reserveMovementHistory({ storage, limit = 50 }) {
  requireStorage(storage);
  assert(Number.isInteger(limit) && limit >= 1 && limit <= 100, 'OX_HISTORY_LIMIT_INVALID');
  const rows = storage.sql.exec(`SELECT event_key AS eventKey,kind,amount_minor AS amountMinor,
      chain_id AS chainId,policy_version AS policyVersion,source_reference AS sourceReference,
      serial_number AS serialNumber,occurred_at AS recordedAt
    FROM ox_reserve_movements ORDER BY occurred_at DESC,event_key DESC LIMIT ?`, limit).toArray();
  return Object.freeze(rows.map(row => Object.freeze(row)));
}
