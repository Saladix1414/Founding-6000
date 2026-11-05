/* OriginX Founding 6000: internal-only registry primitives. No HTTP routes. */
import { createHash } from 'node:crypto';

export const REGISTRY_VERSION = 'OX-REGISTRIES-1';
export const HEX_64 = /^[a-f0-9]{64}$/i;
export const TX_HASH = /^0x[a-f0-9]{64}$/i;
export const WALLET = /^0x[a-f0-9]{40}$/i;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fail(code) { throw new Error(code); }
export function assert(condition, code = 'OX_REGISTRY_INVALID') { if (!condition) fail(code); }
export function isSerial(value) { return Number.isInteger(value) && value >= 1 && value <= 6000; }
export function isMinor(value) { return Number.isSafeInteger(value) && value > 0; }
export function nowIso(ms = Date.now()) {
  assert(Number.isSafeInteger(ms) && ms >= 0 && ms <= 8640000000000000, 'OX_INVALID_TIME');
  return new Date(ms).toISOString();
}
export function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
export function requireStorage(storage) {
  assert(storage?.sql && typeof storage.sql.exec === 'function' &&
    typeof storage.transactionSync === 'function', 'OX_STORAGE_UNAVAILABLE');
}
export function requireAuthorization(authorize, operation, facts) {
  // Host-supplied, trusted internal gate; NEVER pass client-controlled callbacks or expose a route.
  assert(typeof authorize === 'function', 'OX_AUTHORITY_UNAVAILABLE');
  let permitted = false;
  try { permitted = authorize(Object.freeze({ operation, ...facts })) === true; } catch { /* deny */ }
  assert(permitted, 'OX_AUTHORITY_DENIED');
}
export function requireProof(verifyEvidence, operation, facts) {
  // An explicit proof-verifier backed by verified transaction / contract evidence is mandatory.
  assert(typeof verifyEvidence === 'function', 'OX_PROOF_VERIFIER_UNAVAILABLE');
  let valid = false;
  try { valid = verifyEvidence(Object.freeze({ operation, ...facts })) === true; } catch { /* deny */ }
  assert(valid, 'OX_PROOF_REJECTED');
}
export function one(rows, code = 'OX_EVIDENCE_AMBIGUOUS') {
  assert(rows.length === 1, code);
  return rows[0];
}
export function addCalendarYear(isoDate) {
  const source = new Date(isoDate);
  assert(!Number.isNaN(source.getTime()), 'OX_INVALID_ACTIVATION_TIME');
  const target = new Date(source);
  const year = source.getUTCFullYear() + 1;
  const month = source.getUTCMonth();
  // Feb 29 -> Feb 28, instead of rolling forward to March.
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), last));
  target.setUTCFullYear(year);
  return target.toISOString();
}
export function canonicalEvidence(input) {
  assert(typeof input?.proofHash === 'string' && HEX_64.test(input.proofHash), 'OX_PROOF_HASH_INVALID');
  assert(typeof input?.reference === 'string' && input.reference.length >= 4 &&
    input.reference.length <= 160 && /^[a-zA-Z0-9.:_/-]+$/.test(input.reference), 'OX_REFERENCE_INVALID');
}
