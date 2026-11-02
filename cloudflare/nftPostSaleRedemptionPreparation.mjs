// Preparation only: deliberately not mounted in Worker routes or payment jobs.
export const POST_SALE_REDEMPTION_VERSION = 'OX-POST-SALE-REDEMPTION-PREPARATION-1';

function serialSet(values, label) {
  if (!Array.isArray(values) || values.some(value => !Number.isInteger(value) || value < 1 || value > 6000) ||
      new Set(values).size !== values.length) throw new Error('INVALID_' + label);
  return new Set(values);
}

export function preparePostSaleRedemption({ settledSerials, reservedSerials }) {
  const sold = serialSet(settledSerials, 'SETTLED_SERIALS');
  const reserved = serialSet(reservedSerials, 'RESERVED_SERIALS');
  if (reserved.size !== 1 || !reserved.has(1) || sold.has(1)) throw new Error('AZHURAK_RESERVATION_REQUIRED');
  const missingSales = [];
  for (let serial = 2; serial <= 6000; serial++) if (!sold.has(serial)) missingSales.push(serial);
  // Coverage is based on supplied inputs, not authenticated settlement evidence.
  const inputCoverageComplete = missingSales.length === 0;
  return {
    version: POST_SALE_REDEMPTION_VERSION,
    collectionSize: 6000, saleTarget: 5999, reservedSerial: 1,
    suppliedSettledCount: sold.size, missingSales, inputCoverageComplete,
    settlementEvidenceAuthenticated: false,
    reservePrincipalLockedBeforeVerifiedClose: true,
    proposedFlow: 'OWNER_REQUEST_ATOMIC_PAYOUT_AND_BURN',
    status: inputCoverageComplete ? 'COVERAGE_COMPLETE_EXECUTION_UNIMPLEMENTED' : 'WAITING_FOR_SALES',
    pending: [
      'AUTHENTICATE_EVERY_SETTLED_SALE_AND_DELIVERY',
      'APPROVE_RESERVED_TOKEN_ELIGIBILITY_AND_REDEMPTION_DENOMINATOR',
      'VERIFY_FUNDED_LIQUID_RESERVES_AND_CUSTODY',
      'IMPLEMENT_SAME_CHAIN_ATOMIC_PAYOUT_AND_BURN',
      'VERIFY_OWNER_REPLAY_PROTECTION_AND_CONCURRENT_EXITS',
      'APPROVE_AND_ACTIVATE_VERSIONED_REDEMPTION_POLICY',
    ],
    burnAuthorized: false, redemptionAuthorized: false, reserveDebitAuthorized: false,
    transactionSubmitted: false, guaranteedProfit: false,
  };
}
