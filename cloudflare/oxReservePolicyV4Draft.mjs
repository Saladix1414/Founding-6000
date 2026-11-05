/* Pure economic preview. NOT approved accounting, custody, profit or payout policy. */
import { assert, isSerial } from './oxRegistryCommon.mjs';

export const RESERVE_COMMERCIAL_DRAFT = Object.freeze({
  version: 'OX-RESERVE-COMMERCIAL-V4-DRAFT',
  collectionSize: 6000,
  reservedSerials: Object.freeze([]),
  saleReserveNumerator: 50,
  serviceNetShareNumerator: 15,
  investmentPortfolioMaxNumerator: 10,
  liquidPortfolioMinNumerator: 90,
  denominator: 100,
  status: 'NOT_APPROVED_FOR_LEDGER_OR_PAYOUT',
});

function positiveMinor(value) {
  assert(Number.isSafeInteger(value) && value >= 0, 'OX_DRAFT_AMOUNT_INVALID');
}
function draftShare(amountMinor, numerator) {
  positiveMinor(amountMinor);
  const exactNumerator = BigInt(amountMinor) * BigInt(numerator);
  const minor = exactNumerator / 100n;
  const remainderOfMinor = exactNumerator % 100n;
  assert(minor <= BigInt(Number.MAX_SAFE_INTEGER), 'OX_DRAFT_AMOUNT_TOO_LARGE');
  return { amountMinor: Number(minor), fractionalMinorNumerator: Number(remainderOfMinor), denominator: 100 };
}

export function previewFoundingSaleReserve({ serialNumber, paidMinor }) {
  assert(isSerial(serialNumber), 'OX_DRAFT_SERIAL_INVALID');
  const share = draftShare(paidMinor, 50);
  return Object.freeze({ version: RESERVE_COMMERCIAL_DRAFT.version,
    serialNumber, reserve: Object.freeze(share),
    autoPostingAllowed: false, governanceAuthority: false, payoutAuthority: false });
}

export function previewFutureNetServicesReserve({ verifiedNetProfitMinor }) {
  const share = draftShare(verifiedNetProfitMinor, 15);
  return Object.freeze({ version: RESERVE_COMMERCIAL_DRAFT.version,
    reserve: Object.freeze(share), autoPostingAllowed: false });
}

export function previewPortfolioLimits({ totalFundedMinor }) {
  positiveMinor(totalFundedMinor);
  const investedCap = draftShare(totalFundedMinor, 10);
  const liquidFloor = draftShare(totalFundedMinor, 90);
  return Object.freeze({ version: RESERVE_COMMERCIAL_DRAFT.version,
    maxInvestedMinor: investedCap.amountMinor,
    minLiquidMinor: liquidFloor.amountMinor + (liquidFloor.fractionalMinorNumerator ? 1 : 0),
    executable: false, voteVerified: false, custodyVerified: false });
}
