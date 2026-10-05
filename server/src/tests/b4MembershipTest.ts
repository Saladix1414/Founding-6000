import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
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
  resolve(
    dbPath,
  );

for (
  const filename of [
    resolved,
    `${resolved}-wal`,
    `${resolved}-shm`,
  ]
) {
  rmSync(
    filename,
    {
      force: true,
    },
  );
}

const {
  initializeDatabase,
  db,
} =
  await import(
    "../db/database.js"
  );

const {
  createOrder,
} =
  await import(
    "../services/orderService.js"
  );

const {
  createUsdtPaymentAttempt,
  submitUsdtTransactionHash,
} =
  await import(
    "../services/usdtPaymentService.js"
  );

const {
  processPendingUsdtVerifications,
} =
  await import(
    "../services/usdtVerificationPipeline.js"
  );

const {
  getMembershipForOrder,
  activateMembership,
  expireEligibleMemberships,
} =
  await import(
    "../services/membershipService.js"
  );

const {
  getUsdtRuntimeConfig,
} =
  await import(
    "../web3/usdtConfig.js"
  );

import type {
  VerificationFunction,
} from "../services/usdtVerificationPipeline.js";

initializeDatabase();

const config =
  getUsdtRuntimeConfig();

const sender =
  getAddress(
    "0x1111111111111111111111111111111111111111",
  );

function verifierFor(
  txHash: string,
): VerificationFunction {
  return async (input) => ({
    txHash:
      txHash.toLowerCase(),

    chainId:
      1,

    tokenContract:
      config.tokenContract,

    senderAddress:
      sender,

    receiverAddress:
      getAddress(
        input.expectedReceiver,
      ),

    amountMinor:
      input.expectedAmountMinor,

    blockNumber:
      1000,

    transactionIndex:
      1,

    confirmations:
      12,
  });
}

console.log("");
console.log(
  "[TEST 1] Membership must not exist before settlement",
);

const order =
  createOrder({
    email:
      "b4-member@example.com",

    idempotencyKey:
      "b4-order-1",
  });

const beforeSettlement =
  getMembershipForOrder(
    order.order.publicId,
  );

if (
  beforeSettlement !==
    null
) {
  throw new Error(
    "MEMBERSHIP_CREATED_BEFORE_SETTLEMENT",
  );
}

console.log(
  "[PASS] No membership before verified payment",
);

const attempt =
  createUsdtPaymentAttempt({
    orderPublicId:
      order.order.publicId,

    idempotencyKey:
      "b4-attempt-1",
  });

const txHash =
  "0x" +
  "e".repeat(64);

submitUsdtTransactionHash({
  paymentAttemptPublicId:
    attempt.attempt.publicId,

  txHash,
});

console.log("");
console.log(
  "[TEST 2] Verified settlement creates pending membership",
);

const results =
  await processPendingUsdtVerifications({
    verifier:
      verifierFor(
        txHash,
      ),

    testSettlementAuthority:
      true,
  });

const verified =
  results.find(
    (item) =>
      item.publicId ===
      attempt.attempt.publicId,
  );

if (
  verified?.outcome !==
    "VERIFIED"
) {
  throw new Error(
    "PAYMENT_NOT_VERIFIED_IN_TEST",
  );
}

const membership =
  getMembershipForOrder(
    order.order.publicId,
  );

if (!membership) {
  throw new Error(
    "MEMBERSHIP_NOT_CREATED",
  );
}

if (
  membership.status !==
    "ACTIVATION_PENDING"
) {
  throw new Error(
    `EXPECTED_ACTIVATION_PENDING_GOT_${membership.status}`,
  );
}

if (
  membership.serialNumber !==
    1
) {
  throw new Error(
    `EXPECTED_SERIAL_1_GOT_${membership.serialNumber}`,
  );
}

if (
  !membership.foundingMember
) {
  throw new Error(
    "FOUNDING_MEMBER_FLAG_MISSING",
  );
}

if (
  !membership.genesisMember
) {
  throw new Error(
    "GENESIS_MEMBER_FLAG_MISSING",
  );
}

if (
  membership.activationStartedAt !==
    null ||
  membership.activationExpiresAt !==
    null
) {
  throw new Error(
    "ENTITLEMENT_STARTED_AT_PURCHASE",
  );
}

console.log(
  "[PASS] Membership created after settlement",
);

console.log(
  "[PASS] Status ACTIVATION_PENDING",
);

console.log(
  "[PASS] Founding Member",
);

console.log(
  "[PASS] Genesis Member for serial #0001",
);

console.log(
  "[PASS] 12-month clock has NOT started",
);

console.log("");
console.log(
  "[TEST 3] Activation starts entitlement",
);

const activationDate =
  new Date(
    "2027-01-05T15:00:00.000Z",
  );

const activation =
  activateMembership({
    membershipPublicId:
      membership.publicId,

    activatedAt:
      activationDate,
  });

if (
  activation.membership.status !==
    "ACTIVE"
) {
  throw new Error(
    "MEMBERSHIP_NOT_ACTIVE",
  );
}

if (
  activation.membership.activationStartedAt !==
    "2027-01-05T15:00:00.000Z"
) {
  throw new Error(
    "ACTIVATION_START_INCORRECT",
  );
}

if (
  activation.membership.activationExpiresAt !==
    "2028-01-05T15:00:00.000Z"
) {
  throw new Error(
    "TWELVE_MONTH_EXPIRY_INCORRECT",
  );
}

console.log(
  "[PASS] ACTIVATION_PENDING -> ACTIVE",
);

console.log(
  "[PASS] Start = activation date",
);

console.log(
  "[PASS] Expiry = 12 calendar months later",
);

console.log("");
console.log(
  "[TEST 4] Activation idempotency",
);

const replay =
  activateMembership({
    membershipPublicId:
      membership.publicId,

    activatedAt:
      new Date(
        "2027-02-01T00:00:00.000Z",
      ),
  });

if (
  !replay.idempotentReplay
) {
  throw new Error(
    "ACTIVATION_NOT_IDEMPOTENT",
  );
}

if (
  replay.membership.activationStartedAt !==
    "2027-01-05T15:00:00.000Z"
) {
  throw new Error(
    "REPLAY_CHANGED_ACTIVATION_START",
  );
}

console.log(
  "[PASS] Repeated activation does not reset clock",
);

console.log("");
console.log(
  "[TEST 5] Expiration",
);

const beforeExpiry =
  expireEligibleMemberships(
    new Date(
      "2028-01-05T14:59:59.000Z",
    ),
  );

if (
  beforeExpiry.expiredCount !==
    0
) {
  throw new Error(
    "MEMBERSHIP_EXPIRED_TOO_EARLY",
  );
}

const atExpiry =
  expireEligibleMemberships(
    new Date(
      "2028-01-05T15:00:00.000Z",
    ),
  );

if (
  atExpiry.expiredCount !==
    1
) {
  throw new Error(
    "MEMBERSHIP_NOT_EXPIRED",
  );
}

const expired =
  getMembershipForOrder(
    order.order.publicId,
  );

if (
  expired?.status !==
    "EXPIRED"
) {
  throw new Error(
    "FINAL_STATUS_NOT_EXPIRED",
  );
}

console.log(
  "[PASS] Membership expires at entitlement boundary",
);

console.log("");
console.log(
  "[TEST 6] Exactly one membership",
);

const membershipCount =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM founding_memberships
  `).get() as {
    count: number;
  };

if (
  Number(
    membershipCount.count,
  ) !== 1
) {
  throw new Error(
    "DUPLICATE_MEMBERSHIP",
  );
}

console.log(
  "[PASS] One order = one membership",
);

console.log("");
console.log(
  "============================================",
);

console.log(
  " B4 MEMBERSHIP TEST PASS",
);

console.log(
  "============================================",
);

console.log(
  "Verified settlement required: PASS",
);

console.log(
  "Genesis classification: PASS",
);

console.log(
  "Activation pending: PASS",
);

console.log(
  "12 months from activation: PASS",
);

console.log(
  "Activation idempotency: PASS",
);

console.log(
  "Expiration: PASS",
);

db.close();
