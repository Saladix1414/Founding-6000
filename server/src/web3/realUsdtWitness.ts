import {
  Interface,
  getAddress,
  id,
} from "ethers";

import {
  getEthereumProvider,
} from "./ethereumProvider.js";

import {
  getUsdtRuntimeConfig,
} from "./usdtConfig.js";

import {
  verifyUsdtTransferEvidence,
  type UsdtTransactionEvidence,
} from "./usdtVerifier.js";

const transferInterface =
  new Interface([
    "event Transfer(address indexed from,address indexed to,uint256 value)",
  ]);

const TRANSFER_TOPIC =
  id(
    "Transfer(address,address,uint256)",
  );

export async function findRecentRealUsdtWitness() {
  const provider =
    getEthereumProvider();

  const config =
    getUsdtRuntimeConfig();

  const network =
    await provider.getNetwork();

  if (
    Number(network.chainId) !==
    1
  ) {
    throw new Error(
      "RPC_NOT_ETHEREUM_MAINNET",
    );
  }

  const latestBlock =
    await provider.getBlockNumber();

  /*
   * USDT is highly active.
   * We deliberately inspect only a tiny recent
   * window to keep RPC usage low.
   */
  const windows = [
    5,
    10,
    20,
    40,
  ];

  let logs:
    Awaited<
      ReturnType<
        typeof provider.getLogs
      >
    > = [];

  for (
    const window of windows
  ) {
    const fromBlock =
      Math.max(
        1,
        latestBlock - window,
      );

    logs =
      await provider.getLogs({
        address:
          config.tokenContract,

        topics: [
          TRANSFER_TOPIC,
        ],

        fromBlock,

        toBlock:
          latestBlock,
      });

    if (
      logs.length > 0
    ) {
      break;
    }
  }

  if (
    logs.length === 0
  ) {
    throw new Error(
      "NO_RECENT_USDT_TRANSFER_FOUND",
    );
  }

  const log =
    logs[
      logs.length - 1
    ];

  if (!log) {
    throw new Error(
      "USDT_LOG_MISSING",
    );
  }

  const parsed =
    transferInterface.parseLog({
      topics:
        [...log.topics],

      data:
        log.data,
    });

  if (
    !parsed ||
    parsed.name !==
      "Transfer"
  ) {
    throw new Error(
      "USDT_TRANSFER_DECODE_FAILED",
    );
  }

  const sender =
    getAddress(
      String(
        parsed.args[0],
      ),
    );

  const receiver =
    getAddress(
      String(
        parsed.args[1],
      ),
    );

  const amountMinor =
    BigInt(
      parsed.args[2]
        .toString(),
    );

  const receipt =
    await provider
      .getTransactionReceipt(
        log.transactionHash,
      );

  if (!receipt) {
    throw new Error(
      "REAL_RECEIPT_NOT_FOUND",
    );
  }

  const currentBlock =
    await provider
      .getBlockNumber();

  const evidence:
    UsdtTransactionEvidence =
  {
    txHash:
      log.transactionHash,

    chainId:
      1,

    receiptStatus:
      receipt.status ?? 0,

    blockNumber:
      receipt.blockNumber,

    currentBlockNumber:
      currentBlock,

    transactionIndex:
      receipt.index ?? null,

    logs:
      receipt.logs.map(
        (receiptLog) => ({
          address:
            receiptLog.address,

          topics:
            [...receiptLog.topics],

          data:
            receiptLog.data,
        }),
      ),
  };

  /*
   * For this read-only test we use the actual
   * receiver/amount discovered on-chain as
   * expectations.
   *
   * This proves our verifier can recognize
   * genuine Ethereum receipt evidence.
   *
   * It does NOT represent a Founding 6000 payment.
   */
  const verified =
    verifyUsdtTransferEvidence({
      evidence,

      expectedReceiver:
        receiver,

      expectedAmountMinor:
        amountMinor,

      confirmationsRequired:
        1,
    });

  return {
    txHash:
      verified.txHash,

    sender:
      verified.senderAddress,

    receiver:
      verified.receiverAddress,

    amountMinor:
      verified.amountMinor,

    tokenContract:
      verified.tokenContract,

    blockNumber:
      verified.blockNumber,

    confirmations:
      verified.confirmations,

    receiptStatus:
      receipt.status ?? 0,

    chainId:
      verified.chainId,
  };
}
