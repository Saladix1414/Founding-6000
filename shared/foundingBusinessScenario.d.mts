import type {ReserveTier} from './foundingReservePolicyV2.mjs';
export function simulateBusinessReserveYear(monthlyProfitMinor:bigint,strategyRateBps?:number,years?:number,units?:{tier:ReserveTier;reserve:bigint;supply:number;perNft:bigint}[]):{
 monthlyProfitMinor:bigint;annualBusinessContribution:bigint;totalBusinessContribution:bigint;years:number;
 contributionPolicyVersion:string;financialResult:bigint;
 openingReserve:bigint;closingReserve:bigint;increase:bigint;executionAuthorized:false;
 units:{tier:ReserveTier;openingPerNft:bigint;closingPerNft:bigint;increasePerNft:bigint}[];
};
