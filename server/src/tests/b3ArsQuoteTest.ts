import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const dbPath =
  process.env.DATABASE_PATH;

if (!dbPath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(dbPath);

for (const path of [
  resolved,
  `${resolved}-wal`,
  `${resolved}-shm`,
]) {
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
  assertArsQuoteUsable,
  createArsQuote,
  getArsQuote,
} = await import(
  "../services/quoteService.js"
);

initializeDatabase();

console.log("");
console.log(
  "[B3 TEST] Creating Genesis order...",
);

const order =
  createOrder({
    email:
      "b3-quote@example.com",

    idempotencyKey:
      "b3-order-001",
  });

if (
  order.order.referencePriceUsd !==
  50
) {
  throw new Error(
    "EXPECTED_USD_REFERENCE_50",
  );
}

console.log(
  "[PASS] Reference price US$50",
);

console.log("");
console.log(
  "[B3 TEST] Creating ARS quote...",
);

const result =
  await createArsQuote({
    orderPublicId:
      order.order.publicId,

    idempotencyKey:
      "b3-quote-idempotency-001",
  });

if (
  result.idempotentReplay
) {
  throw new Error(
    "FIRST_QUOTE_SHOULD_NOT_BE_REPLAY",
  );
}

const quote =
  result.quote;

console.log(
  JSON.stringify(
    quote,
    null,
    2,
  ),
);

if (
  quote.currency !== "ARS"
) {
  throw new Error(
    "QUOTE_CURRENCY_NOT_ARS",
  );
}

if (
  quote.referencePriceUsd !==
  50
) {
  throw new Error(
    "QUOTE_REFERENCE_PRICE_CHANGED",
  );
}

/*
 * Test-only FX rate:
 *
 * US$50 × ARS 1475.25
 * = ARS 73,762.50
 *
 * Stored as minor units:
 * 7,376,250 centavos.
 */
if (
  quote.fxRateArsPerUsd !==
  "1475.25"
) {
  throw new Error(
    `UNEXPECTED_TEST_RATE_${quote.fxRateArsPerUsd}`,
  );
}

if (
  quote.quotedAmountArsMinor !==
  7376250
) {
  throw new Error(
    `EXPECTED_7376250_MINOR_GOT_${quote.quotedAmountArsMinor}`,
  );
}

if (
  quote.quotedAmountArs !==
  "73762.50"
) {
  throw new Error(
    `EXPECTED_73762_50_GOT_${quote.quotedAmountArs}`,
  );
}

if (
  quote.fxSource !==
  "DEVELOPMENT_FIXED_RATE"
) {
  throw new Error(
    "FX_SOURCE_NOT_AUDITABLE",
  );
}

if (
  quote.status !==
  "ACTIVE"
) {
  throw new Error(
    "NEW_QUOTE_NOT_ACTIVE",
  );
}

console.log(
  "[PASS] Decimal calculation exact",
);

console.log(
  "[PASS] FX source persisted",
);

console.log(
  "[PASS] Quote amount persisted in minor units",
);

console.log("");
console.log(
  "[B3 TEST] Idempotency...",
);

const replay =
  await createArsQuote({
    orderPublicId:
      order.order.publicId,

    idempotencyKey:
      "b3-quote-idempotency-001",
  });

if (
  replay.idempotentReplay !==
  true
) {
  throw new Error(
    "QUOTE_REPLAY_NOT_IDEMPOTENT",
  );
}

if (
  replay.quote.publicId !==
  quote.publicId
) {
  throw new Error(
    "IDEMPOTENCY_CREATED_NEW_QUOTE",
  );
}

console.log(
  "[PASS] Quote idempotency",
);

console.log("");
console.log(
  "[B3 TEST] Quote usable before expiration...",
);

const usable =
  assertArsQuoteUsable(
    quote.publicId,
  );

if (
  usable.status !==
  "ACTIVE"
) {
  throw new Error(
    "QUOTE_NOT_USABLE",
  );
}

console.log(
  "[PASS] Active quote usable",
);

console.log("");
console.log(
  "[B3 TEST] Audit event...",
);

const audit =
  db.prepare(`
    SELECT
      event_type AS eventType,
      payload_json AS payloadJson
    FROM audit_events
    WHERE
      event_type = 'ARS_QUOTE_CREATED'
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as
    | {
        eventType: string;
        payloadJson: string;
      }
    | undefined;

if (!audit) {
  throw new Error(
    "QUOTE_AUDIT_EVENT_MISSING",
  );
}

const auditPayload =
  JSON.parse(
    audit.payloadJson,
  ) as {
    fxRateArsPerUsd?: string;
    quotedAmountArsMinor?: number;
  };

if (
  auditPayload.fxRateArsPerUsd !==
  "1475.25"
) {
  throw new Error(
    "AUDIT_FX_RATE_MISSING",
  );
}

if (
  auditPayload.quotedAmountArsMinor !==
  7376250
) {
  throw new Error(
    "AUDIT_QUOTED_AMOUNT_MISSING",
  );
}

console.log(
  "[PASS] Quote audit event reproducible",
);

console.log("");
console.log(
  "[B3 TEST] Forcing expiration...",
);

db.prepare(`
  UPDATE payment_quotes
  SET
    quote_expires_at = ?,
    updated_at = ?
  WHERE public_id = ?
`).run(
  new Date(
    Date.now() - 5000,
  ).toISOString(),

  new Date().toISOString(),

  quote.publicId,
);

const expired =
  getArsQuote(
    quote.publicId,
  );

if (!expired) {
  throw new Error(
    "EXPIRED_QUOTE_MISSING",
  );
}

if (
  expired.status !==
  "EXPIRED"
) {
  throw new Error(
    `EXPECTED_EXPIRED_GOT_${expired.status}`,
  );
}

let rejected =
  false;

try {
  assertArsQuoteUsable(
    quote.publicId,
  );
} catch (error) {
  if (
    error instanceof Error &&
    error.message ===
      "QUOTE_NOT_ACTIVE"
  ) {
    rejected =
      true;
  } else {
    throw error;
  }
}

if (!rejected) {
  throw new Error(
    "EXPIRED_QUOTE_WAS_ACCEPTED",
  );
}

console.log(
  "[PASS] Expired quote rejected",
);

console.log("");
console.log(
  "[B3 TEST] New quote voids prior active quote...",
);

const secondOrder =
  createOrder({
    email:
      "b3-second@example.com",

    idempotencyKey:
      "b3-order-002",
  });

const firstForSecondOrder =
  await createArsQuote({
    orderPublicId:
      secondOrder.order.publicId,

    idempotencyKey:
      "b3-second-quote-A",
  });

const secondForSecondOrder =
  await createArsQuote({
    orderPublicId:
      secondOrder.order.publicId,

    idempotencyKey:
      "b3-second-quote-B",
  });

const older =
  getArsQuote(
    firstForSecondOrder.quote.publicId,
  );

const newer =
  getArsQuote(
    secondForSecondOrder.quote.publicId,
  );

if (
  older?.status !== "VOID"
) {
  throw new Error(
    "OLD_ACTIVE_QUOTE_NOT_VOIDED",
  );
}

if (
  newer?.status !== "ACTIVE"
) {
  throw new Error(
    "NEW_QUOTE_NOT_ACTIVE",
  );
}

console.log(
  "[PASS] Only one active quote per order",
);

console.log("");
console.log(
  "============================================",
);

console.log(
  " B3 ARS QUOTING TEST PASS",
);

console.log(
  "============================================",
);

console.log(
  "Reference USD: 50",
);

console.log(
  "Test FX rate: 1475.25 ARS/USD",
);

console.log(
  "Test quote: ARS 73762.50",
);

console.log(
  "Expiration: PASS",
);

console.log(
  "Idempotency: PASS",
);

console.log(
  "Auditability: PASS",
);

console.log(
  "Real FX provider: NOT CONNECTED",
);

console.log(
  "Real payments: DISABLED",
);

db.close();
