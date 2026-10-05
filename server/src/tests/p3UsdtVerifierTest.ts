import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  Interface,
  getAddress,
} from "ethers";

const dbPath =
  process.env.DATABASE_PATH;

if (!dbPath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(dbPath);

for (
  const path of [
    resolved,
    `${resolved}-wal`,
    `${resolved}-shm`,
  ]
) {
  try {
    rmSync(
      path,
      {
        force: true,
      },
    );
  } catch {
    // best effort
  }
}

const {
  initializeDatabase,
  db,
} = await import(
  "../db/database.js"
);

const {
  createOrder,
} = await import(
  "../services/orderService.js"
);

const {
  createUsdtPaymentAttempt,
} = await import(
  "../services/usdtPaymentService.js"
);

const {
  verifyUsdtTransferEvidence,
} = await import(
  "../web3/usdtVerifier.js"
);

const {
  settleVerifiedUsdtTransfer,
} = await import(
  "../services/usdtSettlementService.js"
);

const {
  getCampaignReadModel,
} = await import(
  "../repositories/campaignRepository.js"
);

const {
  getUsdtRuntimeConfig,
} = await import(
  "../web3/usdtConfig.js"
);

initializeDatabase();

const config =
  getUsdtRuntimeConfig();

const transferInterface =
  new Interface([
    "event Transfer(address indexed from,address indexed to,uint256 value)",
  ]);

const sender =
  getAddress(
    "0x1111111111111111111111111111111111111111",
  );

const wrongReceiver =
  getAddress(
    "0x2222222222222222222222222222222222222222",
  );

const txHash =
  "0x" + "a".repeat(64);

function transferLog(
  input: {
    token?: string;
    from?: string;
    to?: string;
    amountMinor?: bigint;
  } = {},
) {
  const encoded =
    transferInterface
      .encodeEventLog(
        transferInterface.getEvent(
          "Transfer",
        )!,
        [
          input.from ??
            sender,

          input.to ??
            config.receiverAddress,

          input.amountMinor ??
            50_000_000n,
        ],
      );

  return {
    address:
      input.token ??
      config.tokenContract,

    topics:
      encoded.topics,

    data:
      encoded.data,
  };
}

function evidence(
  overrides: Partial<{
    txHash: string;
    chainId: number;
    receiptStatus: number;
    blockNumber: number;
    currentBlockNumber: number;
    logs: ReturnType<
      typeof transferLog
    >[];
  }> = {},
) {
  return {
    txHash:
      overrides.txHash ??
      txHash,

    chainId:
      overrides.chainId ??
      1,

    receiptStatus:
      overrides.receiptStatus ??
      1,

    blockNumber:
      overrides.blockNumber ??
      1000,

    currentBlockNumber:
      overrides.currentBlockNumber ??
      1011,

    transactionIndex:
      2,

    logs:
      overrides.logs ??
      [
        transferLog(),
      ],
  };
}

console.log("");
console.log(
  "[P3 TEST] Creating Genesis order...",
);

const order =
  createOrder({
    email:
      "p3-usdt@example.com",

    idempotencyKey:
      "p3-usdt-order-001",
  });

if (
  order.order.referencePriceUsd !==
  50
) {
  throw new Error(
    "GENESIS_REFERENCE_NOT_50",
  );
}

const attempt =
  createUsdtPaymentAttempt({
    orderPublicId:
      order.order.publicId,

    idempotencyKey:
      "p3-usdt-attempt-001",
  });

if (
  attempt.attempt.expectedAmountMinor !==
  50_000_000
) {
  throw new Error(
    "EXPECTED_50_USDT_MINOR_UNITS",
  );
}

if (
  attempt.attempt.expectedAmountUsdt !==
  "50.0"
) {
  throw new Error(
    `EXPECTED_50_USDT_GOT_${attempt.attempt.expectedAmountUsdt}`,
  );
}

console.log(
  "[PASS] 50 USDT payment attempt",
);

console.log("");
console.log(
  "[P3 TEST] Valid Ethereum evidence...",
);

const verified =
  verifyUsdtTransferEvidence({
    evidence:
      evidence(),

    expectedReceiver:
      config.receiverAddress,

    expectedAmountMinor:
      50_000_000n,

    confirmationsRequired:
      12,
  });

if (
  verified.amountMinor !==
  50_000_000n
) {
  throw new Error(
    "VERIFIED_AMOUNT_WRONG",
  );
}

if (
  verified.confirmations !==
  12
) {
  throw new Error(
    "CONFIRMATION_COUNT_WRONG",
  );
}

console.log(
  "[PASS] Valid transfer verified",
);

function expectFailure(
  label: string,
  fn: () => unknown,
  expectedError: string,
) {
  let blocked =
    false;

  try {
    fn();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        expectedError
    ) {
      blocked = true;
    } else {
      throw error;
    }
  }

  if (!blocked) {
    throw new Error(
      `${label}_NOT_BLOCKED`,
    );
  }

  console.log(
    `[PASS] ${label}`,
  );
}

console.log("");
console.log(
  "[P3 TEST] Adversarial verifier checks...",
);

expectFailure(
  "Wrong chain blocked",
  () =>
    verifyUsdtTransferEvidence({
      evidence:
        evidence({
          chainId: 137,
        }),

      expectedReceiver:
        config.receiverAddress,

      expectedAmountMinor:
        50_000_000n,

      confirmationsRequired:
        12,
    }),
  "WRONG_CHAIN",
);

expectFailure(
  "Failed transaction blocked",
  () =>
    verifyUsdtTransferEvidence({
      evidence:
        evidence({
          receiptStatus: 0,
        }),

      expectedReceiver:
        config.receiverAddress,

      expectedAmountMinor:
        50_000_000n,

      confirmationsRequired:
        12,
    }),
  "TRANSACTION_FAILED",
);

expectFailure(
  "Insufficient confirmations blocked",
  () =>
    verifyUsdtTransferEvidence({
      evidence:
        evidence({
          currentBlockNumber:
            1005,
        }),

      expectedReceiver:
        config.receiverAddress,

      expectedAmountMinor:
        50_000_000n,

      confirmationsRequired:
        12,
    }),
  "INSUFFICIENT_CONFIRMATIONS",
);

expectFailure(
  "Wrong receiver blocked",
  () =>
    verifyUsdtTransferEvidence({
      evidence:
        evidence({
          logs: [
            transferLog({
              to:
                wrongReceiver,
            }),
          ],
        }),

      expectedReceiver:
        config.receiverAddress,

      expectedAmountMinor:
        50_000_000n,

      confirmationsRequired:
        12,
    }),
  "EXPECTED_USDT_TRANSFER_NOT_FOUND",
);

expectFailure(
  "Wrong amount blocked",
  () =>
    verifyUsdtTransferEvidence({
      evidence:
        evidence({
          logs: [
            transferLog({
              amountMinor:
                49_000_000n,
            }),
          ],
        }),

      expectedReceiver:
        config.receiverAddress,

      expectedAmountMinor:
        50_000_000n,

      confirmationsRequired:
        12,
    }),
  "EXPECTED_USDT_TRANSFER_NOT_FOUND",
);

expectFailure(
  "Wrong token blocked",
  () =>
    verifyUsdtTransferEvidence({
      evidence:
        evidence({
          logs: [
            transferLog({
              token:
                "0x3333333333333333333333333333333333333333",
            }),
          ],
        }),

      expectedReceiver:
        config.receiverAddress,

      expectedAmountMinor:
        50_000_000n,

      confirmationsRequired:
        12,
    }),
  "EXPECTED_USDT_TRANSFER_NOT_FOUND",
);

console.log("");
console.log(
  "[P3 TEST] Atomic settlement...",
);

const settlement =
  settleVerifiedUsdtTransfer({
    paymentAttemptPublicId:
      attempt.attempt.publicId,

    transfer:
      verified,
  });

if (
  settlement.orderStatus !==
  "PAID"
) {
  throw new Error(
    "ORDER_NOT_PAID",
  );
}

if (
  settlement.paymentStatus !==
  "VERIFIED"
) {
  throw new Error(
    "PAYMENT_NOT_VERIFIED",
  );
}

if (
  settlement.serialNumber !==
  1
) {
  throw new Error(
    `EXPECTED_SERIAL_1_GOT_${settlement.serialNumber}`,
  );
}

console.log(
  "[PASS] Settlement verified",
);

console.log(
  "[PASS] Order marked PAID",
);

console.log(
  "[PASS] Genesis serial #0001 allocated",
);

console.log("");
console.log(
  "[P3 TEST] Transaction replay...",
);

const secondOrder =
  createOrder({
    email:
      "p3-usdt-second@example.com",

    idempotencyKey:
      "p3-usdt-order-002",
  });

const secondAttempt =
  createUsdtPaymentAttempt({
    orderPublicId:
      secondOrder.order.publicId,

    idempotencyKey:
      "p3-usdt-attempt-002",
  });

expectFailure(
  "Transaction replay blocked",
  () =>
    settleVerifiedUsdtTransfer({
      paymentAttemptPublicId:
        secondAttempt.attempt.publicId,

      transfer:
        verified,
    }),
  "TRANSACTION_ALREADY_SETTLED",
);

const campaign =
  getCampaignReadModel();

if (!campaign) {
  throw new Error(
    "CAMPAIGN_NOT_FOUND",
  );
}

if (
  campaign.sold !== 1
) {
  throw new Error(
    `EXPECTED_CAMPAIGN_SOLD_1_GOT_${campaign.sold}`,
  );
}

const settlementCount =
  db.prepare(`
    SELECT
      COUNT(*) AS count

    FROM payment_settlements
  `).get() as {
    count: number;
  };

if (
  Number(
    settlementCount.count,
  ) !== 1
) {
  throw new Error(
    "SETTLEMENT_COUNT_NOT_1",
  );
}

const allocationCount =
  db.prepare(`
    SELECT
      COUNT(*) AS count

    FROM inventory_allocations

    WHERE status = 'ALLOCATED'
  `).get() as {
    count: number;
  };

if (
  Number(
    allocationCount.count,
  ) !== 1
) {
  throw new Error(
    "ALLOCATION_COUNT_NOT_1",
  );
}

console.log(
  "[PASS] Replay created no settlement",
);

console.log(
  "[PASS] Replay created no inventory allocation",
);

console.log("");
console.log(
  "============================================",
);

console.log(
  " P3 USDT VERIFIER TEST PASS",
);

console.log(
  "============================================",
);

console.log(
  "Chain: Ethereum Mainnet",
);

console.log(
  "Chain ID: 1",
);

console.log(
  "Token: Official configured USDT",
);

console.log(
  "Expected amount: 50.000000 USDT",
);

console.log(
  "Wrong chain: BLOCKED",
);

console.log(
  "Wrong token: BLOCKED",
);

console.log(
  "Wrong receiver: BLOCKED",
);

console.log(
  "Wrong amount: BLOCKED",
);

console.log(
  "Failed receipt: BLOCKED",
);

console.log(
  "Insufficient confirmations: BLOCKED",
);

console.log(
  "Transaction replay: BLOCKED",
);

console.log(
  "Atomic settlement: PASS",
);

console.log(
  "Real RPC: NOT USED",
);

console.log(
  "Real payments: DISABLED",
);

db.close();
