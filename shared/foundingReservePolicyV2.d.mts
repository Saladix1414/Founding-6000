export type ReserveTier = 'RARE' | 'EPIC' | 'LEGENDARY';
export const RESERVE_POLICY_VERSION: string;
export const INVESTMENT_PLAN_VERSION: string;
export const RESERVE_TIERS: readonly ReserveTier[];
export type V2Allocation = {beneficiaryTier:ReserveTier;weightNumerator:bigint;weightDenominator:bigint;amountMinor:bigint};
export type V2Contribution = {policyVersion:string;saleTier:ReserveTier;grossAmountMinor:bigint;reserveBps:number;reserveAmountMinor:bigint;allocations:V2Allocation[]};
export function calculateReserveContributionV2(input:{tier:ReserveTier;grossAmountMinor:bigint}):V2Contribution;
export function referenceSaleV2(tier:ReserveTier):V2Contribution;
export function fullCloseV2():{tier:ReserveTier;reserve:bigint;supply:number;perNft:bigint}[];
export function simulateManagedReserveScenario(openingReserve:bigint,strategyRateBps:number,years:number):{
  planVersion:string;openingReserve:bigint;openingInvested:bigint;openingLiquid:bigint;
  closingReserve:bigint;netChange:bigint;strategyRateBps:number;years:number;executionAuthorized:false;
};
export function investmentPreparationPlan():Readonly<{
  version:string;status:'PREPARATION_ONLY';beforeCloseInvestedBps:0;requiresRedemptionActivation:true;afterCloseMaxInvestedBps:1000;
  liquidTargetBps:9000;maxPerProtocolBps:1000;borrowingAllowed:false;leverageAllowed:false;
  bridgesAllowed:false;actualProvidersApproved:false;actualNetRatesVerified:false;
  executionAuthorized:false;redemptionAuthorized:false;capitalGuaranteed:false;
}>;
