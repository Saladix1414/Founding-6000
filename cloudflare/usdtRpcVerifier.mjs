const ETHEREUM_MAINNET_CHAIN_ID =
  1;

const OFFICIAL_USDT =
  "0xdAC17F958D2ee523a2206206994597C13D831ec7";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function normalizeAddress(
  value,
) {
  if (
    typeof value !== "string" ||
    !/^0x[a-fA-F0-9]{40}$/
      .test(value)
  ) {
    throw new Error(
      "INVALID_ETHEREUM_ADDRESS",
    );
  }

  return value.toLowerCase();
}

function normalizeTxHash(
  value,
) {
  if (
    typeof value !== "string" ||
    !/^0x[a-fA-F0-9]{64}$/
      .test(value)
  ) {
    throw new Error(
      "INVALID_TX_HASH",
    );
  }

  return value.toLowerCase();
}

function hexToBigInt(
  value,
  errorCode,
) {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]+$/
      .test(value)
  ) {
    throw new Error(
      errorCode,
    );
  }

  return BigInt(value);
}

function topicToAddress(
  topic,
) {
  if (
    typeof topic !== "string" ||
    !/^0x[a-fA-F0-9]{64}$/
      .test(topic)
  ) {
    throw new Error(
      "INVALID_TRANSFER_TOPIC",
    );
  }

  return (
    "0x" +
    topic
      .slice(-40)
      .toLowerCase()
  );
}

async function rpc(
  rpcUrl,
  method,
  params,
  fetchImpl,
) {
  if (
    typeof rpcUrl !== "string" ||
    !rpcUrl.startsWith(
      "https://",
    )
  ) {
    throw new Error(
      "ETHEREUM_RPC_NOT_CONFIGURED",
    );
  }

  const response =
    await fetchImpl(
      rpcUrl,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            jsonrpc:
              "2.0",

            id:
              1,

            method,
            params,
          }),
      },
    );

  if (!response.ok) {
    throw new Error(
      "ETHEREUM_RPC_HTTP_ERROR",
    );
  }

  const payload =
    await response.json();

  if (
    payload?.error ||
    !Object.prototype
      .hasOwnProperty.call(
        payload,
        "result",
      )
  ) {
    throw new Error(
      "ETHEREUM_RPC_RESPONSE_ERROR",
    );
  }

  return payload.result;
}

export async function verifyUsdtOnEthereum(
  input,
) {
  const {
    rpcUrl,
    txHash,
    expectedReceiver,
    expectedAmountMinor,

    confirmationsRequired =
      12,

    fetchImpl =
      fetch,
  } = input;

  const normalizedHash =
    normalizeTxHash(
      txHash,
    );

  const receiver =
    normalizeAddress(
      expectedReceiver,
    );

  const expectedAmount =
    BigInt(
      expectedAmountMinor,
    );

  if (
    expectedAmount <= 0n
  ) {
    throw new Error(
      "INVALID_EXPECTED_AMOUNT",
    );
  }

  if (
    !Number.isInteger(
      confirmationsRequired,
    ) ||
    confirmationsRequired < 1
  ) {
    throw new Error(
      "INVALID_CONFIRMATION_REQUIREMENT",
    );
  }

  /*
   * -------------------------------------------------------
   * 1. Network
   * -------------------------------------------------------
   */

  const chainHex =
    await rpc(
      rpcUrl,
      "eth_chainId",
      [],
      fetchImpl,
    );

  const chainId =
    Number(
      hexToBigInt(
        chainHex,
        "INVALID_CHAIN_ID",
      ),
    );

  if (
    chainId !==
    ETHEREUM_MAINNET_CHAIN_ID
  ) {
    throw new Error(
      "WRONG_CHAIN",
    );
  }

  /*
   * -------------------------------------------------------
   * 2. Transaction receipt
   * -------------------------------------------------------
   */

  const receipt =
    await rpc(
      rpcUrl,
      "eth_getTransactionReceipt",
      [
        normalizedHash,
      ],
      fetchImpl,
    );

  if (!receipt) {
    throw new Error(
      "TRANSACTION_NOT_FOUND",
    );
  }

  if (
    typeof receipt.transactionHash ===
      "string" &&
    receipt.transactionHash
      .toLowerCase() !==
      normalizedHash
  ) {
    throw new Error(
      "TRANSACTION_HASH_MISMATCH",
    );
  }

  const status =
    hexToBigInt(
      receipt.status,
      "INVALID_RECEIPT_STATUS",
    );

  if (status !== 1n) {
    throw new Error(
      "TRANSACTION_FAILED",
    );
  }

  const blockNumberBig =
    hexToBigInt(
      receipt.blockNumber,
      "INVALID_RECEIPT_BLOCK",
    );

  /*
   * -------------------------------------------------------
   * 3. Confirmations
   * -------------------------------------------------------
   */

  const currentBlockHex =
    await rpc(
      rpcUrl,
      "eth_blockNumber",
      [],
      fetchImpl,
    );

  const currentBlockBig =
    hexToBigInt(
      currentBlockHex,
      "INVALID_CURRENT_BLOCK",
    );

  if (
    currentBlockBig <
    blockNumberBig
  ) {
    throw new Error(
      "INVALID_BLOCK_CONFIRMATION_STATE",
    );
  }

  const confirmationsBig =
    currentBlockBig -
    blockNumberBig +
    1n;

  if (
    confirmationsBig <
    BigInt(
      confirmationsRequired,
    )
  ) {
    throw new Error(
      "INSUFFICIENT_CONFIRMATIONS",
    );
  }

  /*
   * -------------------------------------------------------
   * 4. Official USDT Transfer logs
   * -------------------------------------------------------
   */

  const tokenContract =
    normalizeAddress(
      OFFICIAL_USDT,
    );

  const logs =
    Array.isArray(
      receipt.logs,
    )
      ? receipt.logs
      : [];

  const matches = [];

  for (
    const log of logs
  ) {
    try {
      const logAddress =
        normalizeAddress(
          log.address,
        );

      if (
        logAddress !==
        tokenContract
      ) {
        continue;
      }

      if (
        !Array.isArray(
          log.topics,
        ) ||
        log.topics.length < 3
      ) {
        continue;
      }

      if (
        String(
          log.topics[0],
        ).toLowerCase() !==
        TRANSFER_TOPIC
      ) {
        continue;
      }

      const sender =
        topicToAddress(
          log.topics[1],
        );

      const destination =
        topicToAddress(
          log.topics[2],
        );

      const amount =
        hexToBigInt(
          log.data,
          "INVALID_TRANSFER_AMOUNT",
        );

      if (
        destination !==
        receiver
      ) {
        continue;
      }

      if (
        amount !==
        expectedAmount
      ) {
        continue;
      }

      matches.push({
        senderAddress:
          sender,

        receiverAddress:
          destination,

        amountMinor:
          amount,
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

  const match =
    matches[0];

  const transactionIndex =
    receipt.transactionIndex
      ? Number(
          hexToBigInt(
            receipt.transactionIndex,
            "INVALID_TRANSACTION_INDEX",
          ),
        )
      : null;

  return {
    txHash:
      normalizedHash,

    chainId:
      ETHEREUM_MAINNET_CHAIN_ID,

    tokenContract:
      OFFICIAL_USDT,

    senderAddress:
      match.senderAddress,

    receiverAddress:
      match.receiverAddress,

    amountMinor:
      match.amountMinor
        .toString(),

    blockNumber:
      Number(
        blockNumberBig,
      ),

    transactionIndex,

    confirmations:
      Number(
        confirmationsBig,
      ),
  };
}
