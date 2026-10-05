import {
  getAddress,
} from "ethers";

import { env } from "../config/env.js";

export const ETHEREUM_MAINNET_CHAIN_ID =
  1;

export const OFFICIAL_USDT_ETHEREUM =
  "0xdAC17F958D2ee523a2206206994597C13D831ec7";

export const USDT_DECIMALS =
  6;

export type UsdtRuntimeConfig = {
  network: "ethereum-mainnet";
  chainId: 1;
  tokenContract: string;
  decimals: 6;
  receiverAddress: string;
  confirmationsRequired: number;
};

export function getUsdtRuntimeConfig():
  UsdtRuntimeConfig
{
  if (
    env.USDT_NETWORK !==
    "ethereum-mainnet"
  ) {
    throw new Error(
      "INVALID_USDT_NETWORK",
    );
  }

  if (
    env.USDT_CHAIN_ID !==
    ETHEREUM_MAINNET_CHAIN_ID
  ) {
    throw new Error(
      "INVALID_ETHEREUM_CHAIN_ID",
    );
  }

  const configuredToken =
    getAddress(
      env.USDT_TOKEN_CONTRACT,
    );

  const officialToken =
    getAddress(
      OFFICIAL_USDT_ETHEREUM,
    );

  if (
    configuredToken !==
    officialToken
  ) {
    throw new Error(
      "INVALID_USDT_TOKEN_CONTRACT",
    );
  }

  if (
    env.USDT_DECIMALS !==
    USDT_DECIMALS
  ) {
    throw new Error(
      "INVALID_USDT_DECIMALS",
    );
  }

  const receiverAddress =
    getAddress(
      env.USDT_RECEIVER_ADDRESS,
    );

  return {
    network:
      "ethereum-mainnet",

    chainId:
      1,

    tokenContract:
      configuredToken,

    decimals:
      6,

    receiverAddress,

    confirmationsRequired:
      env.USDT_CONFIRMATIONS_REQUIRED,
  };
}
