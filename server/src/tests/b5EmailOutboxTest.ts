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
  resolve(dbPath);

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
} =
  await import(
    "../services/membershipService.js"
  );

const {
  dispatchEmailOutbox,
} =
  await import(
    "../services/emailDispatcher.js"
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

const email =
  "b5-test@example.com";

console.log("");
console.log(
  "[TEST 1] Registration notification",
);

const order =
  createOrder({
    email,
    idempotencyKey:
      "b5-order",
  });

const registrationCount =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM email_outbox
    WHERE template =
      'REGISTRATION_RECEIVED'
  `).get() as {
    count: number;
  };

if (
  Number(
    registrationCount.count,
  ) !== 1
) {
  throw new Error(
    "REGISTRATION_EMAIL_NOT_QUEUED",
  );
}

/*
 * Retry same order.
 */
createOrder({
  email,
  idempotencyKey:
    "b5-order",
});

const registrationReplayCount =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM email_outbox
    WHERE template =
      'REGISTRATION_RECEIVED'
  `).get() as {
    count: number;
  };

if (
  Number(
    registrationReplayCount.count,
  ) !== 1
) {
  throw new Error(
    "REGISTRATION_EMAIL_DUPLICATED",
  );
}

console.log(
  "[PASS] Registration queued once",
);

console.log("");
console.log(
  "[TEST 2] Settlement notifications",
);

const attempt =
  createUsdtPaymentAttempt({
    orderPublicId:
      order.order.publicId,

    idempotencyKey:
      "b5-attempt",
  });

const txHash =
  "0x" +
  "f".repeat(64);

submitUsdtTransactionHash({
  paymentAttemptPublicId:
    attempt.attempt.publicId,

  txHash,
});

const sender =
  getAddress(
    "0x1111111111111111111111111111111111111111",
  );

const verifier:
  VerificationFunction =
  async (input) => ({
    txHash:
      txHash.toLowerCase(),

    chainId: 1,

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

await processPendingUsdtVerifications({
  verifier,

  testSettlementAuthority:
    true,
});

for (
  const template of [
    "PAYMENT_VERIFIED",
    "MEMBERSHIP_CREATED",
  ]
) {
  const row =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM email_outbox
      WHERE template = ?
    `).get(
      template,
    ) as {
      count: number;
    };

  if (
    Number(
      row.count,
    ) !== 1
  ) {
    throw new Error(
      `${template}_EMAIL_COUNT_INVALID`,
    );
  }
}

console.log(
  "[PASS] Payment email queued once",
);

console.log(
  "[PASS] Membership-created email queued once",
);

console.log("");
console.log(
  "[TEST 3] Activation notification",
);

const membership =
  getMembershipForOrder(
    order.order.publicId,
  );

if (!membership) {
  throw new Error(
    "MEMBERSHIP_NOT_FOUND",
  );
}

activateMembership({
  membershipPublicId:
    membership.publicId,

  activatedAt:
    new Date(
      "2027-01-05T15:00:00.000Z",
    ),
});

/*
 * Replay must not create another mail.
 */
activateMembership({
  membershipPublicId:
    membership.publicId,

  activatedAt:
    new Date(
      "2027-02-01T00:00:00.000Z",
    ),
});

const activationMailCount =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM email_outbox
    WHERE template =
      'MEMBERSHIP_ACTIVATED'
  `).get() as {
    count: number;
  };

if (
  Number(
    activationMailCount.count,
  ) !== 1
) {
  throw new Error(
    "ACTIVATION_EMAIL_DUPLICATED",
  );
}

console.log(
  "[PASS] Activation email queued once",
);

console.log("");
console.log(
  "[TEST 4] Outbox total",
);

const total =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM email_outbox
  `).get() as {
    count: number;
  };

if (
  Number(total.count) !==
    4
) {
  throw new Error(
    `EXPECTED_4_EMAILS_GOT_${total.count}`,
  );
}

console.log(
  "[PASS] Exactly 4 transactional emails",
);

console.log("");
console.log(
  "[TEST 5] Dispatcher idempotency",
);

const sent:
  Array<{
    to: string;
    subject: string;
  }> = [];

const captureTransport = {
  async send(
    input: {
      to: string;
      subject: string;
      text: string;
    },
  ) {
    sent.push({
      to:
        input.to,

      subject:
        input.subject,
    });
  },
};

const firstDispatch =
  await dispatchEmailOutbox({
    transport:
      captureTransport,
  });

if (
  firstDispatch.length !==
    4 ||
  sent.length !== 4
) {
  throw new Error(
    "FIRST_DISPATCH_COUNT_INVALID",
  );
}

const secondDispatch =
  await dispatchEmailOutbox({
    transport:
      captureTransport,
  });

if (
  secondDispatch.length !==
    0 ||
  sent.length !== 4
) {
  throw new Error(
    "DISPATCH_REPLAY_SENT_DUPLICATES",
  );
}

const sentCount =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM email_outbox
    WHERE status = 'SENT'
  `).get() as {
    count: number;
  };

if (
  Number(
    sentCount.count,
  ) !== 4
) {
  throw new Error(
    "OUTBOX_SENT_STATUS_INVALID",
  );
}

console.log(
  "[PASS] First dispatch sent 4",
);

console.log(
  "[PASS] Second dispatch sent 0",
);

console.log(
  "[PASS] No duplicate delivery",
);

console.log("");
console.log(
  "============================================",
);

console.log(
  " B5 EMAIL OUTBOX TEST PASS",
);

console.log(
  "============================================",
);

console.log(
  "Registration email: PASS",
);

console.log(
  "Payment verified email: PASS",
);

console.log(
  "Membership created email: PASS",
);

console.log(
  "Membership activated email: PASS",
);

console.log(
  "Event idempotency: PASS",
);

console.log(
  "Dispatcher idempotency: PASS",
);

console.log(
  "External email sent: NO",
);

db.close();
