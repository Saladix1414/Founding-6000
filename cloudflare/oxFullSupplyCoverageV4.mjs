/* OriginX Founding 6000 — evidence-agnostic coverage, NOT an exit policy. */
export const FULL_SUPPLY_COVERAGE_VERSION = 'OX-FULL-SUPPLY-COVERAGE-4';
const MAX = 6000;
const fail = code => { throw new Error('OX_COVERAGE_' + code); };
export function assessFullSupplyCoverageV4({ settledSerials = [], reservedSerials = [] } = {}) {
  if (!Array.isArray(settledSerials) || !Array.isArray(reservedSerials) ||
      settledSerials.some(x=>!Number.isInteger(x) || x < 1 || x > MAX) ||
      reservedSerials.some(x=>!Number.isInteger(x) || x < 1 || x > MAX) ||
      new Set(settledSerials).size !== settledSerials.length ||
      new Set(reservedSerials).size !== reservedSerials.length) fail('SERIAL_SET_INVALID');
  // The approved business direction has NO reserved tokens; never silently omit #0001.
  if (reservedSerials.length) fail('RESERVED_SERIALS_NOT_ALLOWED');
  const sold = new Set(settledSerials);
  const missingSerials = [];
  for (let n=1;n<=MAX;n++) if (!sold.has(n)) missingSerials.push(n);
  const inputCoverageComplete = missingSerials.length === 0;
  return Object.freeze({
    version: FULL_SUPPLY_COVERAGE_VERSION,
    collectionSize:MAX, saleTarget:MAX, reservedCount:0,
    suppliedSettledCount:sold.size,
    soldByTier:Object.freeze({RARE:settledSerials.filter(x=>x<=1000).length,
      EPIC:settledSerials.filter(x=>x>=1001&&x<=3000).length,
      LEGENDARY:settledSerials.filter(x=>x>=3001).length}),
    missingSerials, inputCoverageComplete,
    token0001CountedAsSale:sold.has(1),
    settlementEvidenceAuthenticated:false, treasuryCustodyVerified:false,
    reservePolicyApproved:false, investorVoteVerified:false,
    payoutAuthorized:false,burnAuthorized:false,redemptionAuthorized:false,
    transactionSubmitted:false, guaranteedReturn:false,
    status:inputCoverageComplete?'INPUT_COVERAGE_COMPLETE_EXECUTION_BLOCKED':'WAITING_FOR_VERIFIED_SALES',
  });
}
