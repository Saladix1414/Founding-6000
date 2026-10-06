import {
  verifyUsdtOnEthereum,
} from "../../../cloudflare/usdtRpcVerifier.mjs";

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

async function expectError(
  fn,
  expected,
) {
  let received = null;

  try {
    await fn();
  } catch (error) {
    received =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assert(
    received === expected,
    `EXPECTED_${expected}_GOT_${received}`,
  );
}

const txHash =
  `0x${"a".repeat(64)}`;

const receiver =
  "0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840";

const sender =
  "0x1111111111111111111111111111111111111111";

const usdt =
  "0xdAC17F958D2ee523a2206206994597C13D831ec7";

const transferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function addressTopic(
  address,
) {
  return (
    "0x" +
    address
      .slice(2)
      .toLowerCase()
      .padStart(
        64,
        "0",
      )
  );
}

function amountHex(
  value,
) {
  return (
    "0x" +
    BigInt(value)
      .toString(16)
      .padStart(
        64,
        "0",
      )
  );
}

function makeReceipt(
  overrides = {},
) {
  return {
    transactionHash:
      txHash,

    status:
      "0x1",

    blockNumber:
      "0x64",

    transactionIndex:
      "0x2",

    logs: [
      {
        address:
          usdt,

        topics: [
          transferTopic,
          addressTopic(
            sender,
          ),
          addressTopic(
            receiver,
          ),
        ],

        data:
          amountHex(
            50_000_000n,
          ),
      },
    ],

    ...overrides,
  };
}

function makeRpc(
  options = {},
) {
  return async (
    _url,
    init,
  ) => {
    const request =
      JSON.parse(
        init.body,
      );

    let result;

    if (
      request.method ===
      "eth_chainId"
    ) {
      result =
        options.chainId ??
        "0x1";
    } else if (
      request.method ===
      "eth_getTransactionReceipt"
    ) {
      result =
        Object.prototype
          .hasOwnProperty.call(
            options,
            "receipt",
          )
          ? options.receipt
          : makeReceipt();
    } else if (
      request.method ===
      "eth_blockNumber"
    ) {
      result =
        options.currentBlock ??
        "0x6f";
    } else {
      throw new Error(
        "UNEXPECTED_RPC_METHOD",
      );
    }

    return new Response(
      JSON.stringify({
        jsonrpc:
          "2.0",

        id:
          1,

        result,
      }),
      {
        status:
          200,

        headers: {
          "Content-Type":
            "application/json",
        },
      },
    );
  };
}

const baseInput = {
  rpcUrl:
    "https://rpc.example.test",

  txHash,

  expectedReceiver:
    receiver,

  expectedAmountMinor:
    50_000_000,

  confirmationsRequired:
    12,
};

console.log("");
console.log(
  "============================================",
);
console.log(
  " P6-B1 ETHEREUM USDT VERIFIER",
);
console.log(
  "============================================",
);

/*
 * Valid:
 * receipt block = 100
 * current block = 111
 * confirmations = 12
 */
const verified =
  await verifyUsdtOnEthereum({
    ...baseInput,

    fetchImpl:
      makeRpc(),
  });

assert(
  verified.chainId === 1,
  "CHAIN_ID_INVALID",
);

assert(
  verified.txHash ===
    txHash,
  "TX_HASH_INVALID",
);

assert(
  verified.receiverAddress ===
    receiver.toLowerCase(),
  "RECEIVER_INVALID",
);

assert(
  verified.senderAddress ===
    sender.toLowerCase(),
  "SENDER_INVALID",
);

assert(
  verified.amountMinor ===
    "50000000",
  "AMOUNT_INVALID",
);

assert(
  verified.confirmations ===
    12,
  "CONFIRMATION_COUNT_INVALID",
);

console.log(
  "VALID_MAINNET_TRANSFER=PASS",
);

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      fetchImpl:
        makeRpc({
          chainId:
            "0x89",
        }),
    }),

  "WRONG_CHAIN",
);

console.log(
  "WRONG_CHAIN_BLOCKED=PASS",
);

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      fetchImpl:
        makeRpc({
          receipt:
            null,
        }),
    }),

  "TRANSACTION_NOT_FOUND",
);

console.log(
  "MISSING_TRANSACTION=PASS",
);

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      fetchImpl:
        makeRpc({
          receipt:
            makeReceipt({
              status:
                "0x0",
            }),
        }),
    }),

  "TRANSACTION_FAILED",
);

console.log(
  "FAILED_TRANSACTION_BLOCKED=PASS",
);

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      fetchImpl:
        makeRpc({
          currentBlock:
            "0x6e",
        }),
    }),

  "INSUFFICIENT_CONFIRMATIONS",
);

console.log(
  "CONFIRMATIONS_ENFORCED=PASS",
);

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      expectedAmountMinor:
        51_000_000,

      fetchImpl:
        makeRpc(),
    }),

  "EXPECTED_USDT_TRANSFER_NOT_FOUND",
);

console.log(
  "EXACT_AMOUNT_ENFORCED=PASS",
);

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      expectedReceiver:
        "0x2222222222222222222222222222222222222222",

      fetchImpl:
        makeRpc(),
    }),

  "EXPECTED_USDT_TRANSFER_NOT_FOUND",
);

console.log(
  "EXACT_RECEIVER_ENFORCED=PASS",
);

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      fetchImpl:
        makeRpc({
          receipt:
            makeReceipt({
              logs: [
                {
                  address:
                    "0x3333333333333333333333333333333333333333",

                  topics: [
                    transferTopic,
                    addressTopic(
                      sender,
                    ),
                    addressTopic(
                      receiver,
                    ),
                  ],

                  data:
                    amountHex(
                      50_000_000n,
                    ),
                },
              ],
            }),
        }),
    }),

  "EXPECTED_USDT_TRANSFER_NOT_FOUND",
);

console.log(
  "OFFICIAL_USDT_CONTRACT_ENFORCED=PASS",
);

const duplicatedLog =
  makeReceipt().logs[0];

await expectError(
  () =>
    verifyUsdtOnEthereum({
      ...baseInput,

      fetchImpl:
        makeRpc({
          receipt:
            makeReceipt({
              logs: [
                duplicatedLog,
                {
                  ...duplicatedLog,
                },
              ],
            }),
        }),
    }),

  "AMBIGUOUS_USDT_TRANSFER",
);

console.log(
  "AMBIGUOUS_TRANSFER_BLOCKED=PASS",
);

console.log("");
console.log(
  "============================================",
);
console.log(
  " P6-B1 TESTS = PASS",
);
console.log(
  " SETTLEMENT AUTHORITY = STILL CLOSED",
);
console.log(
  "============================================",
);
