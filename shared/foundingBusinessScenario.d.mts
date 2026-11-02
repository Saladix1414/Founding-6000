import type {ReserveTier} from './foundingReservePolicyV2.mjs';
export function simulateBusinessReserveYear(monthlyProfitMinor:bigint,strategyRateBps?:number):{
 monthlyProfitMinor:bigint;annualBusinessContribution:bigint;financialResult:bigint;
 openingReserve:bigint;closingReserve:bigint;increase:bigint;executionAuthorized:false;
 units:{tier:ReserveTier;openingPerNft:bigint;closingPerNft:bigint;increasePerNft:bigint}[];
};
