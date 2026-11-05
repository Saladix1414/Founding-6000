/**
 * OriginX — economic policy V4 cutover, READ-ONLY preflight.
 * Never posts reserve entries, authorizes NFT sales, changes membership,
 * migrates historical reserves, starts investments or permits redemption.
 *
 * The active CommerceCore holds evidence of payment settlements, NOT a
 * cryptographically independent view of Ethereum or the treasury vault.
 */
import { createHash } from 'node:crypto';
import { previewFoundingSaleReserve, RESERVE_COMMERCIAL_DRAFT } from './oxReservePolicyV4Draft.mjs';
import { requireStorage, assert, isSerial } from './oxRegistryCommon.mjs';

const USDT_ETHEREUM = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const TX_HASH = /^0x[0-9a-f]{64}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const REQUIRED = Object.freeze([
  'founding_orders', 'founding_memberships', 'inventory_allocations',
  'payment_settlements', 'payment_attempts',
]);
const BLOCKED = 'NOT_APPROVED_FOR_CUTOVER_OR_TRANSACTIONS';
export const CUTOVER_AUDIT_VERSION = 'OX-ECONOMIC-CUTOVER-AUDIT-3';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function rows(storage, query, ...args) {
  return storage.sql.exec(query, ...args).toArray();
}
function tableNames(storage) {
  return new Set(rows(storage, "SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name));
}
function minor(v) {
  return Number.isSafeInteger(v) && v >= 0;
}
function priceFor(serial) {
  return serial <= 1000 ? 50_000_000n : serial <= 3000 ? 70_000_000n : 90_000_000n;
}
function addIssue(collection, code, fingerprint = null) {
  collection.push(fingerprint === null ? { code } : { code, referenceHash: fingerprint });
}

/** A deliberately conservative source-of-record reconciliation. */
export function auditFoundingEconomicCutover({ storage }) {
  requireStorage(storage);
  const existing = tableNames(storage);
  const schemaMissing = REQUIRED.filter(name => !existing.has(name));
  const issues = [];
  for (const name of schemaMissing) addIssue(issues, `MISSING_${name.toUpperCase()}`);
  const hasJournal = existing.has('ox_reserve_movements');
  if (!hasJournal) addIssue(issues, 'OX_JOURNAL_NOT_INSTALLED');
  // Legacy reserveService uses a separate persistence layer; its history
  // cannot be inferred by querying this Cloudflare Durable Object.
  const legacyExternalHistoryReconciled = false;
  const sold = new Set();
  const references = new Set();
  const validSettlements = [];
  let paidOrders = 0;
  let ledgerRows = [];
  let saleRows = [];
  if (!schemaMissing.length) {
    saleRows = rows(storage, `
      SELECT o.id AS orderId, o.status AS orderStatus,
        o.reference_price_usd AS invoicePriceUsd,
        m.id AS membershipId, m.serial_number AS memberSerial,
        ia.serial_number AS allocatedSerial, ia.settlement_reference AS allocationReference,
        ps.id AS settlementId, ps.external_reference AS settlementReference,
        ps.amount_minor AS paidMinor, ps.network AS settlementNetwork,
        ps.chain_id AS settlementChainId, ps.token_contract AS settlementToken,
        ps.receiver_address AS settlementReceiver, ps.confirmations AS confirmations,
        pa.id AS attemptId, pa.order_id AS attemptOrderId,
        pa.tx_hash AS paymentHash, pa.status AS attemptStatus,
        pa.chain_id AS attemptChainId, pa.network AS attemptNetwork,
        pa.token_contract AS attemptToken, pa.token_decimals AS decimals,
        pa.receiver_address AS attemptReceiver, pa.expected_amount_minor AS expectedMinor
      FROM founding_orders o
      LEFT JOIN founding_memberships m ON m.order_id = o.id
      LEFT JOIN inventory_allocations ia ON ia.order_id = o.id
      LEFT JOIN payment_settlements ps ON ps.order_id = o.id
      LEFT JOIN payment_attempts pa ON pa.id = ps.payment_attempt_id
      WHERE o.status = 'PAID'
      ORDER BY o.id, ps.id, m.id, ia.serial_number
    `);
    const orderCounts = new Map();
    for (const r of saleRows) orderCounts.set(r.orderId, (orderCounts.get(r.orderId) ?? 0) + 1);
    paidOrders = orderCounts.size;
    for (const r of saleRows) {
      const ref = hash([r.orderId]); // never expose customer identifiers to report consumers
      if (orderCounts.get(r.orderId) !== 1) {
        if (orderCounts.get(r.orderId) > 1) {
          addIssue(issues, 'AMBIGUOUS_PAID_ORDER_RELATIONSHIP', ref);
          orderCounts.set(r.orderId, -1); // report just once
        }
        continue;
      }
      const serial = r.allocatedSerial;
      const permittedSerial = isSerial(serial) && r.memberSerial === serial;
      if (!permittedSerial || !r.membershipId || !r.settlementId || !r.attemptId) {
        addIssue(issues, 'PAID_ORDER_EVIDENCE_INCOMPLETE', ref);
        continue;
      }
      if (sold.has(serial) || references.has(String(r.settlementReference).toLowerCase())) {
        addIssue(issues, 'DUPLICATE_VERIFIED_SALE', ref);
        continue;
      }
      const price = priceFor(serial);
      const correct = minor(r.paidMinor) && r.paidMinor > 0 &&
        Number.isSafeInteger(r.invoicePriceUsd) && r.invoicePriceUsd >= 0 &&
        BigInt(r.invoicePriceUsd) * 1_000_000n === price &&
        BigInt(r.paidMinor) === price && r.paidMinor === r.expectedMinor &&
        r.attemptStatus === 'VERIFIED' && r.attemptOrderId === r.orderId && r.confirmations >= 12 &&
        r.settlementNetwork === 'ethereum-mainnet' && r.settlementChainId === 1 &&
        r.attemptNetwork === r.settlementNetwork && r.attemptChainId === r.settlementChainId &&
        r.decimals === 6 &&
        typeof r.settlementToken === 'string' && r.settlementToken.toLowerCase() === USDT_ETHEREUM &&
        typeof r.attemptToken === 'string' && r.attemptToken.toLowerCase() === USDT_ETHEREUM &&
        typeof r.settlementReceiver === 'string' && typeof r.attemptReceiver === 'string' &&
        r.settlementReceiver.toLowerCase() === r.attemptReceiver.toLowerCase() &&
        TX_HASH.test(r.settlementReference ?? '') &&
        r.settlementReference.toLowerCase() === String(r.allocationReference).toLowerCase() &&
        r.settlementReference.toLowerCase() === String(r.paymentHash).toLowerCase();
      if (!correct) {
        addIssue(issues, 'PAID_ORDER_SETTLEMENT_UNVERIFIED_OR_PRICE_MISMATCH', ref);
        continue;
      }
      sold.add(serial);
      references.add(r.settlementReference.toLowerCase());
      const draft = previewFoundingSaleReserve({serialNumber: serial, paidMinor: r.paidMinor});
      validSettlements.push({ serial, amountMinor: r.paidMinor,
        reference: r.settlementReference.toLowerCase(), settlementId: r.settlementId,
        draftReserveMinor: draft.reserve.amountMinor, fractionalMinorNumerator: draft.reserve.fractionalMinorNumerator });
    }
  }
  if (hasJournal) {
    ledgerRows = rows(storage, `SELECT event_key AS eventKey,kind,
       amount_minor AS amountMinor,policy_version AS policyVersion,
       source_reference AS sourceReference,serial_number AS serialNumber,
       chain_id AS chainId,evidence_hash AS evidenceHash
       FROM ox_reserve_movements ORDER BY event_key`);
    for (const entry of ledgerRows) {
      if (!minor(entry.amountMinor) || entry.amountMinor === 0 ||
          typeof entry.policyVersion !== 'string' || !HASH.test(entry.evidenceHash ?? '')) {
        addIssue(issues, 'JOURNAL_ENTRY_CORRUPT', hash([entry.eventKey]));
      }
    }
  }
  // Policies and recorded event types are never rewritten or revalued.
  const accrualByPolicy = new Map();
  const sourceByReference = new Map(validSettlements.map(s => [s.reference, s]));
  const sourceById = new Map(validSettlements.map(s => [s.settlementId, s]));
  const accountedSales = new Set();
  for (const entry of ledgerRows) {
    if (entry.kind !== 'ACCRUAL') continue;
    const version = entry.policyVersion;
    const prior = accrualByPolicy.get(version) ?? { count: 0, amountMinor: 0n };
    prior.count++;
    prior.amountMinor += BigInt(minor(entry.amountMinor) ? entry.amountMinor : 0);
    accrualByPolicy.set(version, prior);
    if (entry.serialNumber === null) continue; // e.g. future subscription/service accrual
    const sale = sourceByReference.get(String(entry.sourceReference).toLowerCase()) ??
      sourceById.get(entry.sourceReference);
    if (!sale || sale.serial !== entry.serialNumber) {
      addIssue(issues, 'SALE_ACCRUAL_SOURCE_NOT_LINKED', hash([entry.eventKey]));
    } else {
      if (accountedSales.has(sale.reference)) addIssue(issues, 'MULTIPLE_ACCRUALS_FOR_SALE', hash([entry.eventKey]));
      accountedSales.add(sale.reference);
    }
  }
  const draftExpectedMinor = validSettlements.reduce((n, sale) => n + BigInt(sale.draftReserveMinor), 0n);
  const grossMinor = validSettlements.reduce((n, sale) => n + BigInt(sale.amountMinor), 0n);
  const remainderNumerator = validSettlements.reduce((n, sale) => n + BigInt(sale.fractionalMinorNumerator), 0n);
  const ledgerPolicies = [...accrualByPolicy].sort(([a], [b]) => a.localeCompare(b)).map(([version, values]) =>
    Object.freeze({ policyVersion: version, accrualEntries: values.count, recordedMinor: values.amountMinor.toString() }));
  const reservedTokenObserved = existing.has('nft_release_assets')
    ? rows(storage, 'SELECT serial_number AS serialNumber,state FROM nft_release_assets WHERE serial_number=1').length > 0
    : false;
  const redemptionCount = existing.has('ox_redemption_requests')
    ? rows(storage, `SELECT COUNT(*) AS count FROM ox_redemption_requests WHERE status='SETTLED'`)[0]?.count ?? 0
    : null;
  const sourceDigest = hash({ saleRows, journalRows: ledgerRows });
  const stable = {
    schema: CUTOVER_AUDIT_VERSION,
    proposedPolicy: RESERVE_COMMERCIAL_DRAFT.version,
    verifiedPaidOrdersFromLocalRecords: validSettlements.length,
    paidOrders,
    localVerifiedGrossMinor: grossMinor.toString(),
    hypothetical50PercentReserveMinorForAlreadyPaidOrders: draftExpectedMinor.toString(),
    hypotheticalRemainderNumerator: remainderNumerator.toString(),
    hypothesisDenominator: 100,
    historicalAccrualPolicies: ledgerPolicies,
    historicalJournalMovementCount: ledgerRows.length,
    verifiedLocalSettlementsWithJournalAccrual: accountedSales.size,
    serial0001: { localPaidSalePresent: sold.has(1), releaseAssetPresent: reservedTokenObserved,
      releaseAssetTablePresent: existing.has('nft_release_assets'), policyTargetReserved: false },
    redemptionSettledCount: redemptionCount,
    oldServerLedgerIndependentlyReconciled: legacyExternalHistoryReconciled,
    // Even a zero-difference report is not evidence of cash custody.
    treasuryCustodyVerified: false,
    independentChainSettlementVerified: false,
    approvalGranted: false, autoPostingAllowed: false, redemptionAllowed: false,
    sourceDigest,
    issues: issues.sort((a,b) => a.code.localeCompare(b.code) || String(a.referenceHash).localeCompare(String(b.referenceHash))),
    status: BLOCKED,
  };
  return Object.freeze({ ...stable, reportHash: hash(stable) });
}

/** Creates a versioned, deterministic CUTOVER PROPOSAL, not an approval. */
export function buildEconomicCutoverProposal({ audit, effectiveAfterUtc, expectedReportHash }) {
  assert(audit?.schema === CUTOVER_AUDIT_VERSION && audit.status === BLOCKED &&
    typeof expectedReportHash === 'string' && HASH.test(expectedReportHash) &&
    audit.reportHash === expectedReportHash, 'OX_CUTOVER_AUDIT_MISMATCH');
  assert(typeof effectiveAfterUtc === 'string' && ISO.test(effectiveAfterUtc) &&
    !Number.isNaN(Date.parse(effectiveAfterUtc)), 'OX_CUTOVER_TIMESTAMP_INVALID');
  const proposal = {
    schema: 'OX-ECONOMIC-CUTOVER-PROPOSAL-3',
    oldHistoryBehavior: 'PRESERVE_ORIGINAL_POLICY_PER_EVENT',
    candidateNewPolicy: RESERVE_COMMERCIAL_DRAFT.version,
    newPrimarySaleReservePercent: 50,
    reservedSerials: [],
    effectiveAfterUtc,
    auditHash: audit.reportHash,
    historicalLedgerImportComplete: false,
    historicalBackfillAuthorized: false,
    historicalMoneyReclassificationAuthorized: false,
    approvedPolicyHash: null,
    contractAndReleaseCompatibilityChecked: false,
    canApply: false,
    canPostNewEntries: false,
    canEnableRedemption: false,
    requiredBeforeActivation: [
      'RECONCILE_LEGACY_SERVER_AND_CLOUDFLARE_RESERVE_HISTORY',
      'IDENTIFY_FINAL_SETTLEMENT_WATERMARK_WITH_NO_LOST_OR_DUPLICATE_SALES',
      'REMOVE_0001_EXCLUSIONS_FROM_RELEASE_AND_MINT_AFTER_ART_AND_CONTRACT_VERIFICATION',
      'APPROVE_POLICY_WITH_EFFECTIVE_TIMESTAMP_AND_SIGNED_OPERATOR_EVIDENCE',
      'VERIFY_TREASURY_CUSTODY_AND_OPERATING_VS_RESERVE_ACCOUNT_SEPARATION',
      'DEFINE_SEPARATE_REDEMPTION_DENOMINATORS_AND_SAME_CHAIN_LIQUIDITY',
      'PASS_ACCOUNTING_MIGRATION_AND_REPLAY_SECURITY_TESTS',
    ],
  };
  return Object.freeze({ ...proposal, proposalHash: hash(proposal) });
}
