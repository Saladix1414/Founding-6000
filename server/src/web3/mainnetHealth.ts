import {
  Interface,
  getAddress,
} from "ethers";

import {
  getEthereumProvider,
} from "./ethereumProvider.js";

import {
  getUsdtRuntimeConfig,
} from "./usdtConfig.js";

const usdtInterface =
  new Interface([
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ]);

async function readUsdtSymbol(
  tokenContract: string,
) {
  const provider =
    getEthereumProvider();

  const data =
    usdtInterface.encodeFunctionData(
      "symbol",
    );

  const result =
    await provider.call({
      to:
        tokenContract,

      data,
    });

  const decoded =
    usdtInterface.decodeFunctionResult(
      "symbol",
      result,
    );

  const symbol =
    decoded[0];

  if (
    typeof symbol !==
    "string"
  ) {
    throw new Error(
      "INVALID_TOKEN_SYMBOL_RESPONSE",
    );
  }

  return symbol;
}

async function readUsdtDecimals(
  tokenContract: string,
) {
  const provider =
    getEthereumProvider();

  const data =
    usdtInterface.encodeFunctionData(
      "decimals",
    );

  const result =
    await provider.call({
      to:
        tokenContract,

      data,
    });

  const decoded =
    usdtInterface.decodeFunctionResult(
      "decimals",
      result,
    );

  const decimals =
    decoded[0];

  const normalized =
    Number(decimals);

  if (
    !Number.isSafeInteger(
      normalized,
    )
  ) {
    throw new Error(
      "INVALID_TOKEN_DECIMALS_RESPONSE",
    );
  }

  return normalized;
}

export async function verifyEthereumMainnetReadOnly() {
  const config =
    getUsdtRuntimeConfig();

  const provider =
    getEthereumProvider();

  const network =
    await provider.getNetwork();

  const chainId =
    Number(
      network.chainId,
    );

  if (
    chainId !==
    1
  ) {
    throw new Error(
      `RPC_WRONG_CHAIN:${chainId}`,
    );
  }

  const blockNumber =
    await provider.getBlockNumber();

  if (
    !Number.isSafeInteger(
      blockNumber,
    ) ||
    blockNumber <= 0
  ) {
    throw new Error(
      "INVALID_MAINNET_BLOCK_NUMBER",
    );
  }

  const tokenContract =
    getAddress(
      config.tokenContract,
    );

  const code =
    await provider.getCode(
      tokenContract,
    );

  if (
    !code ||
    code === "0x"
  ) {
    throw new Error(
      "USDT_CONTRACT_CODE_NOT_FOUND",
    );
  }

  const [
    symbol,
    decimals,
  ] =
    await Promise.all([
      readUsdtSymbol(
        tokenContract,
      ),

      readUsdtDecimals(
        tokenContract,
      ),
    ]);

  if (
    symbol !==
    "USDT"
  ) {
    throw new Error(
      `UNEXPECTED_TOKEN_SYMBOL:${symbol}`,
    );
  }

  if (
    decimals !==
    6
  ) {
    throw new Error(
      `UNEXPECTED_TOKEN_DECIMALS:${decimals}`,
    );
  }

  return {
    chainId,

    blockNumber,

    tokenContract,

    symbol,

    decimals,

    codePresent:
      true,

    receiverAddress:
      getAddress(
        config.receiverAddress,
      ),

    mode:
      "READ_ONLY" as const,
  };
}
