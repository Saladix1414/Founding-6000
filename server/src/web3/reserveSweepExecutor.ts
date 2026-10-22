import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  keccak256,
  type TransactionRequest,
} from "ethers";

import {
  env,
} from "../config/env.js";

import {
  getNextExecutableReserveSweep,
  markReserveSweepConfirmed,
  markReserveSweepFailed,
  markReserveSweepPrepared,
  markReserveSweepSubmitted,
} from "../services/reserveSweepService.js";

const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

type StoredTransaction = {
  to:
    string;

  data:
    string;

  value:
    string;

  nonce:
    number;

  gasLimit:
    string;

  chainId:
    string;

  type:
    number | null;

  gasPrice:
    string | null;

  maxFeePerGas:
    string | null;

  maxPriorityFeePerGas:
    string | null;
};

type ExecutableSweep = {
  id:
    string;

  publicId:
    string;

  status:
    "PENDING" |
    "PREPARED" |
    "SUBMITTED";

  network:
    string;

  chainId:
    number;

  tokenContract:
    string;

  treasuryAddress:
    string;

  vaultAddress:
    string;

  amountMinor:
    number;

  contributionCount:
    number;

  transactionNonce:
    number | null;

  transactionHash:
    string | null;

  transactionJson:
    string | null;

  attempts:
    number;

  lastError:
    string | null;
};

function requireSweepConfig() {
  if (
    !env.RESERVE_SWEEP_ENABLED
  ) {
    throw new Error(
      "RESERVE_SWEEP_DISABLED",
    );
  }

  if (
    !env.ETHEREUM_RPC_URL
  ) {
    throw new Error(
      "ETHEREUM_RPC_URL_REQUIRED",
    );
  }

  if (
    !env.RESERVE_VAULT_ADDRESS
  ) {
    throw new Error(
      "RESERVE_VAULT_ADDRESS_REQUIRED",
    );
  }

  if (
    !env.RESERVE_SWEEP_TREASURY_ADDRESS
  ) {
    throw new Error(
      "RESERVE_SWEEP_TREASURY_ADDRESS_REQUIRED",
    );
  }

  if (
    !env.RESERVE_SWEEP_SIGNER_PRIVATE_KEY
  ) {
    throw new Error(
      "RESERVE_SWEEP_SIGNER_PRIVATE_KEY_REQUIRED",
    );
  }
}

function serializeTransaction(
  tx:
    TransactionRequest,
): StoredTransaction {
  if (
    !tx.to ||
    !tx.data ||
    tx.nonce === undefined ||
    tx.nonce === null ||
    tx.gasLimit === undefined ||
    tx.gasLimit === null ||
    tx.chainId === undefined ||
    tx.chainId === null
  ) {
    throw new Error(
      "RESERVE_SWEEP_TRANSACTION_INCOMPLETE",
    );
  }

  return {
    to:
      String(
        tx.to,
      ),

    data:
      String(
        tx.data,
      ),

    value:
      (
        tx.value ??
        0n
      ).toString(),

    nonce:
      Number(
        tx.nonce,
      ),

    gasLimit:
      BigInt(
        tx.gasLimit
          .toString(),
      ).toString(),

    chainId:
      BigInt(
        tx.chainId
          .toString(),
      ).toString(),

    type:
      tx.type ===
        undefined ||
      tx.type ===
        null
        ? null
        : Number(
            tx.type,
          ),

    gasPrice:
      tx.gasPrice ===
        undefined ||
      tx.gasPrice ===
        null
        ? null
        : tx.gasPrice
            .toString(),

    maxFeePerGas:
      tx.maxFeePerGas ===
        undefined ||
      tx.maxFeePerGas ===
        null
        ? null
        : tx.maxFeePerGas
            .toString(),

    maxPriorityFeePerGas:
      tx.maxPriorityFeePerGas ===
        undefined ||
      tx.maxPriorityFeePerGas ===
        null
        ? null
        : tx.maxPriorityFeePerGas
            .toString(),
  };
}

function deserializeTransaction(
  value:
    StoredTransaction,
): TransactionRequest {
  return {
    to:
      value.to,

    data:
      value.data,

    value:
      BigInt(
        value.value,
      ),

    nonce:
      value.nonce,

    gasLimit:
      BigInt(
        value.gasLimit,
      ),

    chainId:
      BigInt(
        value.chainId,
      ),

    type:
      value.type ??
      undefined,

    gasPrice:
      value.gasPrice === null
        ? undefined
        : BigInt(
            value.gasPrice,
          ),

    maxFeePerGas:
      value.maxFeePerGas === null
        ? undefined
        : BigInt(
            value.maxFeePerGas,
          ),

    maxPriorityFeePerGas:
      value.maxPriorityFeePerGas ===
        null
        ? undefined
        : BigInt(
            value.maxPriorityFeePerGas,
          ),
  };
}

export async function processReserveSweepOnce() {
  if (
    !env.RESERVE_SWEEP_ENABLED
  ) {
    return {
      status:
        "disabled" as const,
    };
  }

  requireSweepConfig();

  const rawSweep =
    getNextExecutableReserveSweep();

  if (!rawSweep) {
    return {
      status:
        "idle" as const,
    };
  }

  const sweep =
    rawSweep as
      ExecutableSweep;

  const provider =
    new JsonRpcProvider(
      env.ETHEREUM_RPC_URL,
      env.USDT_CHAIN_ID,
    );

  const wallet =
    new Wallet(
      env.RESERVE_SWEEP_SIGNER_PRIVATE_KEY!,
      provider,
    );

  const signerAddress =
    getAddress(
      await wallet.getAddress(),
    );

  const expectedTreasury =
    getAddress(
      env.RESERVE_SWEEP_TREASURY_ADDRESS!,
    );

  const expectedVault =
    getAddress(
      env.RESERVE_VAULT_ADDRESS!,
    );

  if (
    signerAddress !==
    expectedTreasury
  ) {
    throw new Error(
      "RESERVE_SWEEP_SIGNER_TREASURY_MISMATCH",
    );
  }

  if (
    getAddress(
      sweep.treasuryAddress,
    ) !==
    expectedTreasury
  ) {
    throw new Error(
      "RESERVE_SWEEP_JOB_TREASURY_MISMATCH",
    );
  }

  if (
    getAddress(
      sweep.vaultAddress,
    ) !==
    expectedVault
  ) {
    throw new Error(
      "RESERVE_SWEEP_JOB_VAULT_MISMATCH",
    );
  }

  if (
    sweep.chainId !==
    env.USDT_CHAIN_ID
  ) {
    throw new Error(
      "RESERVE_SWEEP_CHAIN_MISMATCH",
    );
  }

  let stored:
    StoredTransaction;

  let transactionHash:
    string;

  if (
    sweep.transactionJson &&
    sweep.transactionHash
  ) {
    stored =
      JSON.parse(
        sweep.transactionJson,
      ) as StoredTransaction;

    transactionHash =
      sweep.transactionHash;
  } else {
    const token =
      new Contract(
        getAddress(
          env.USDT_TOKEN_CONTRACT,
        ),
        ERC20_TRANSFER_ABI,
        wallet,
      );

    const transfer =
      token.getFunction(
        "transfer",
      );

    const request =
      await transfer
        .populateTransaction(
          expectedVault,
          BigInt(
            sweep.amountMinor,
          ),
        );

    const populated =
      await wallet
        .populateTransaction(
          request,
        );

    stored =
      serializeTransaction(
        populated,
      );

    const rawSigned =
      await wallet
        .signTransaction(
          deserializeTransaction(
            stored,
          ),
        );

    transactionHash =
      keccak256(
        rawSigned,
      );

    markReserveSweepPrepared({
      sweepId:
        sweep.id,

      nonce:
        stored.nonce,

      transactionHash,

      transactionJson:
        JSON.stringify(
          stored,
        ),
    });
  }

  const existingReceipt =
    await provider
      .getTransactionReceipt(
        transactionHash,
      );

  if (existingReceipt) {
    if (
      existingReceipt.status !==
      1
    ) {
      markReserveSweepFailed({
        sweepId:
          sweep.id,

        errorCode:
          "RESERVE_SWEEP_ONCHAIN_REVERT",
      });

      throw new Error(
        "RESERVE_SWEEP_ONCHAIN_REVERT",
      );
    }

    const confirmations =
      await existingReceipt
        .confirmations();

    if (
      confirmations >=
      env.RESERVE_SWEEP_CONFIRMATIONS
    ) {
      markReserveSweepConfirmed({
        sweepId:
          sweep.id,

        transactionHash,
      });

      return {
        status:
          "confirmed" as const,

        transactionHash,

        confirmations,
      };
    }

    markReserveSweepSubmitted({
      sweepId:
        sweep.id,

      transactionHash,
    });

    return {
      status:
        "confirming" as const,

      transactionHash,

      confirmations,
    };
  }

  const rawSigned =
    await wallet
      .signTransaction(
        deserializeTransaction(
          stored,
        ),
      );

  const recalculatedHash =
    keccak256(
      rawSigned,
    );

  if (
    recalculatedHash !==
    transactionHash
  ) {
    throw new Error(
      "RESERVE_SWEEP_SIGNED_HASH_MISMATCH",
    );
  }

  try {
    await provider
      .broadcastTransaction(
        rawSigned,
      );
  } catch (error) {
    /*
     * Crash-safe retry:
     * if this exact transaction is already known,
     * never generate a second transfer.
     */
    const existingTransaction =
      await provider
        .getTransaction(
          transactionHash,
        );

    if (
      !existingTransaction
    ) {
      throw error;
    }
  }

  markReserveSweepSubmitted({
    sweepId:
      sweep.id,

    transactionHash,
  });

  return {
    status:
      "submitted" as const,

    transactionHash,
  };
}
