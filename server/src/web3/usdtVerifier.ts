import {
  Interface,
  getAddress,
  isHexString,
} from "ethers";

import {
  getEthereumProvider,
} from "./ethereumProvider.js";

import {
  getUsdtRuntimeConfig,
} from "./usdtConfig.js";

const usdtInterface =
  new Interface([
    "event Transfer(address indexed from,address indexed to,uint256 value)",
  ]);

export type EthereumLogEvidence = {
  address: string;
  topics: string[];
  data: string;
};

export type UsdtTransactionEvidence = {
  txHash: string;

  chainId: number;

  receiptStatus: number;

  blockNumber: number;

  currentBlockNumber: number;

  transactionIndex:
    | number
    | null;

  logs: EthereumLogEvidence[];
};

export type VerifiedUsdtTransfer = {
  txHash: string;

  chainId: 1;

  tokenContract: string;

  senderAddress: string;

  receiverAddress: string;

  amountMinor: bigint;

  blockNumber: number;

  transactionIndex:
    | number
    | null;

  confirmations: number;
};

function normalizeTxHash(
  txHash: string,
) {
  if (
    !isHexString(
      txHash,
      32,
    )
  ) {
    throw new Error(
      "INVALID_TX_HASH",
    );
  }

  return txHash.toLowerCase();
}

export function verifyUsdtTransferEvidence(
  input: {
    evidence:
      UsdtTransactionEvidence;

    expectedReceiver:
      string;

    expectedAmountMinor:
      bigint;

    confirmationsRequired:
      number;
  },
): VerifiedUsdtTransfer {
  const config =
    getUsdtRuntimeConfig();

  const txHash =
    normalizeTxHash(
      input.evidence.txHash,
    );

  if (
    input.evidence.chainId !==
    config.chainId
  ) {
    throw new Error(
      "WRONG_CHAIN",
    );
  }

  if (
    input.evidence.receiptStatus !==
    1
  ) {
    throw new Error(
      "TRANSACTION_FAILED",
    );
  }

  const confirmations =
    input.evidence.currentBlockNumber -
    input.evidence.blockNumber +
    1;

  if (
    confirmations < 1
  ) {
    throw new Error(
      "INVALID_BLOCK_CONFIRMATION_STATE",
    );
  }

  if (
    confirmations <
    input.confirmationsRequired
  ) {
    throw new Error(
      "INSUFFICIENT_CONFIRMATIONS",
    );
  }

  const tokenContract =
    getAddress(
      config.tokenContract,
    );

  const expectedReceiver =
    getAddress(
      input.expectedReceiver,
    );

  const matches:
    VerifiedUsdtTransfer[] =
    [];

  for (
    const log of
    input.evidence.logs
  ) {
    let logAddress: string;

    try {
      logAddress =
        getAddress(
          log.address,
        );
    } catch {
      continue;
    }

    if (
      logAddress !==
      tokenContract
    ) {
      continue;
    }

    try {
      const parsed =
        usdtInterface.parseLog({
          topics:
            log.topics,

          data:
            log.data,
        });

      if (
        !parsed ||
        parsed.name !==
          "Transfer"
      ) {
        continue;
      }

      const senderAddress =
        getAddress(
          String(
            parsed.args[0],
          ),
        );

      const receiverAddress =
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

      if (
        receiverAddress !==
        expectedReceiver
      ) {
        continue;
      }

      if (
        amountMinor !==
        input.expectedAmountMinor
      ) {
        continue;
      }

      matches.push({
        txHash,

        chainId: 1,

        tokenContract,

        senderAddress,

        receiverAddress,

        amountMinor,

        blockNumber:
          input.evidence.blockNumber,

        transactionIndex:
          input.evidence
            .transactionIndex,

        confirmations,
      });
    } catch {
      continue;
    }
  }

  if (
    matches.length === 0
  ) {
    throw new Error(
      "EXPECTED_USDT_TRANSFER_NOT_FOUND",
    );
  }

  if (
    matches.length > 1
  ) {
    throw new Error(
      "AMBIGUOUS_USDT_TRANSFER",
    );
  }

  return matches[0]!;
}

export async function verifyUsdtTransactionOnChain(
  input: {
    txHash: string;

    expectedReceiver:
      string;

    expectedAmountMinor:
      bigint;
  },
) {
  const config =
    getUsdtRuntimeConfig();

  const provider =
    getEthereumProvider();

  const network =
    await provider.getNetwork();

  if (
    Number(
      network.chainId,
    ) !==
    config.chainId
  ) {
    throw new Error(
      "RPC_WRONG_CHAIN",
    );
  }

  const txHash =
    normalizeTxHash(
      input.txHash,
    );

  const receipt =
    await provider
      .getTransactionReceipt(
        txHash,
      );

  if (!receipt) {
    throw new Error(
      "TRANSACTION_NOT_FOUND",
    );
  }

  const currentBlockNumber =
    await provider
      .getBlockNumber();

  const evidence:
    UsdtTransactionEvidence =
  {
    txHash,

    chainId:
      Number(
        network.chainId,
      ),

    receiptStatus:
      receipt.status ?? 0,

    blockNumber:
      receipt.blockNumber,

    currentBlockNumber,

    transactionIndex:
      receipt.index ?? null,

    logs:
      receipt.logs.map(
        (log) => ({
          address:
            log.address,

          topics:
            [...log.topics],

          data:
            log.data,
        }),
      ),
  };

  return verifyUsdtTransferEvidence({
    evidence,

    expectedReceiver:
      input.expectedReceiver,

    expectedAmountMinor:
      input.expectedAmountMinor,

    confirmationsRequired:
      config.confirmationsRequired,
  });
}
