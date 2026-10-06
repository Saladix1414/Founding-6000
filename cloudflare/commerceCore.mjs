const USDT_NETWORK =
  "ethereum-mainnet";

const USDT_CHAIN_ID =
  1;

const USDT_TOKEN_CONTRACT =
  "0xdAC17F958D2ee523a2206206994597C13D831ec7";

const USDT_DECIMALS =
  6;

const USDT_CONFIRMATIONS_REQUIRED =
  12;


const USDT_RECEIVER_ADDRESS =
  "0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840";

function normalizeEmail(value) {
  return value
    .trim()
    .toLowerCase();
}

function validEmail(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 3 &&
    value.trim().length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(value.trim())
  );
}

function validIdempotencyKey(value) {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/
      .test(value)
  );
}

function shortHex() {
  const bytes =
    new Uint8Array(6);

  crypto.getRandomValues(
    bytes,
  );

  return Array.from(bytes)
    .map(
      (value) =>
        value
          .toString(16)
          .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();
}

function createOrderPublicId() {
  return `F6K-${shortHex()}`;
}

function createPaymentPublicId() {
  return `PAY-USDT-${shortHex()}`;
}

function formatUsdtMinor(
  value,
) {
  const raw =
    String(value)
      .padStart(
        USDT_DECIMALS + 1,
        "0",
      );

  const splitAt =
    raw.length -
    USDT_DECIMALS;

  return (
    raw.slice(
      0,
      splitAt,
    ) +
    "." +
    raw.slice(
      splitAt,
    )
  );
}

function validTxHash(value) {
  return (
    typeof value === "string" &&
    /^0x[a-fA-F0-9]{64}$/
      .test(value.trim())
  );
}

export function commerceErrorStatus(
  code,
) {
  if (
    [
      "INVALID_EMAIL",
      "INVALID_IDEMPOTENCY_KEY",
      "INVALID_ORDER_ID",
      "INVALID_PAYMENT_ATTEMPT_ID",
      "INVALID_TX_HASH",
    ].includes(code)
  ) {
    return 400;
  }

  if (
    [
      "ORDER_NOT_FOUND",
      "PAYMENT_ATTEMPT_NOT_FOUND",
    ].includes(code)
  ) {
    return 404;
  }

  if (
    [
      "NO_ACTIVE_PHASE",
      "ORDER_NOT_PAYABLE",
      "IDEMPOTENCY_KEY_CONFLICT",
      "PAYMENT_ATTEMPT_HASH_LOCKED",
      "PAYMENT_ATTEMPT_NOT_SUBMITTABLE",
      "TX_HASH_ALREADY_SUBMITTED",
      "PAYMENT_ATTEMPT_NOT_SETTLEABLE",
      "TRANSACTION_ALREADY_SETTLED",
      "PAYMENT_ATTEMPT_ALREADY_SETTLED",
      "PHASE_SOLD_OUT",
      "PHASE_SERIAL_RANGE_EXHAUSTED",
    ].includes(code)
  ) {
    return 409;
  }

  return 500;
}

export class CommerceCore {
  constructor(storage) {
    this.storage =
      storage;

    this.sql =
      storage.sql;
  }

  initializeSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS campaign_phases (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL UNIQUE,
        capacity INTEGER NOT NULL,
        reference_price_usd INTEGER NOT NULL,
        serial_start INTEGER NOT NULL,
        serial_end INTEGER NOT NULL,
        active INTEGER NOT NULL
          CHECK (active IN (0, 1))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS
        idx_cloudflare_single_active_phase
      ON campaign_phases(active)
      WHERE active = 1;

      CREATE TABLE IF NOT EXISTS founding_orders (
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        phase_id TEXT NOT NULL,

        email TEXT NOT NULL,
        normalized_email TEXT NOT NULL,

        reference_price_usd INTEGER NOT NULL,

        status TEXT NOT NULL
          CHECK (
            status IN (
              'CREATED',
              'PAID',
              'CANCELLED'
            )
          ),

        idempotency_key TEXT UNIQUE,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS
        idx_cloudflare_orders_email
      ON founding_orders(
        normalized_email
      );

      CREATE TABLE IF NOT EXISTS payment_attempts (
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,

        order_id TEXT NOT NULL,

        payment_method TEXT NOT NULL
          CHECK (
            payment_method = 'USDT'
          ),

        network TEXT NOT NULL,
        chain_id INTEGER NOT NULL,

        token_contract TEXT NOT NULL,
        token_decimals INTEGER NOT NULL,

        receiver_address TEXT NOT NULL,

        expected_amount_minor INTEGER NOT NULL,

        status TEXT NOT NULL
          CHECK (
            status IN (
              'AWAITING_TRANSFER',
              'SUBMITTED',
              'VERIFYING',
              'VERIFIED',
              'REJECTED',
              'EXPIRED'
            )
          ),

        tx_hash TEXT,

        idempotency_key TEXT UNIQUE,

        verification_attempts INTEGER
          NOT NULL
          DEFAULT 0,

        last_verification_error TEXT,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS
        idx_cloudflare_payment_tx_hash
      ON payment_attempts(tx_hash)
      WHERE tx_hash IS NOT NULL;

      CREATE INDEX IF NOT EXISTS
        idx_cloudflare_payment_order
      ON payment_attempts(
        order_id,
        status
      );

      CREATE TABLE IF NOT EXISTS payment_settlements (
        id TEXT PRIMARY KEY,

        payment_attempt_id TEXT
          NOT NULL
          UNIQUE,

        order_id TEXT NOT NULL,

        external_reference TEXT
          NOT NULL
          UNIQUE,

        network TEXT NOT NULL,
        chain_id INTEGER NOT NULL,

        token_contract TEXT NOT NULL,

        sender_address TEXT NOT NULL,
        receiver_address TEXT NOT NULL,

        amount_minor INTEGER NOT NULL,

        block_number INTEGER NOT NULL,
        transaction_index INTEGER,

        confirmations INTEGER NOT NULL,

        evidence_json TEXT NOT NULL,

        verified_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_allocations (
        id TEXT PRIMARY KEY,

        phase_id TEXT NOT NULL,
        order_id TEXT NOT NULL UNIQUE,

        serial_number INTEGER NOT NULL UNIQUE,

        settlement_reference TEXT
          NOT NULL
          UNIQUE,

        allocated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS founding_memberships (
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,

        order_id TEXT NOT NULL UNIQUE,

        serial_number INTEGER
          NOT NULL
          UNIQUE,

        founding_member INTEGER
          NOT NULL,

        genesis_member INTEGER
          NOT NULL,

        status TEXT NOT NULL,

        activation_started_at TEXT,
        activation_expires_at TEXT,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.sql.exec(
      `
        INSERT OR IGNORE INTO campaign_phases (
          id,
          code,
          name,
          position,
          capacity,
          reference_price_usd,
          serial_start,
          serial_end,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      "phase-genesis",
      "GENESIS",
      "Genesis",
      1,
      1000,
      50,
      1,
      1000,
      1,
    );

    this.sql.exec(
      `
        INSERT OR IGNORE INTO campaign_phases (
          id,
          code,
          name,
          position,
          capacity,
          reference_price_usd,
          serial_start,
          serial_end,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      "phase-early-access",
      "EARLY_ACCESS",
      "Early Access",
      2,
      2000,
      70,
      1001,
      3000,
      0,
    );

    this.sql.exec(
      `
        INSERT OR IGNORE INTO campaign_phases (
          id,
          code,
          name,
          position,
          capacity,
          reference_price_usd,
          serial_start,
          serial_end,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      "phase-founding-access",
      "FOUNDING_ACCESS",
      "Founding Access",
      3,
      3000,
      90,
      3001,
      6000,
      0,
    );
  }

  audit(
    eventType,
    entityType,
    entityId,
    payload,
  ) {
    this.sql.exec(
      `
        INSERT INTO audit_events (
          id,
          event_type,
          entity_type,
          entity_id,
          payload_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      crypto.randomUUID(),
      eventType,
      entityType,
      entityId,
      JSON.stringify(
        payload ?? {},
      ),
      new Date()
        .toISOString(),
    );
  }

  normalizeOrder(row) {
    return {
      publicId:
        row.publicId,

      email:
        row.email,

      phase: {
        code:
          row.phaseCode,

        name:
          row.phaseName,
      },

      referencePriceUsd:
        Number(
          row.referencePriceUsd,
        ),

      status:
        row.status,

      createdAt:
        row.createdAt,
    };
  }

  getOrderByPublicId(
    publicId,
  ) {
    return this.sql.exec(
      `
        SELECT
          o.id,
          o.public_id AS publicId,
          o.email,
          o.reference_price_usd AS referencePriceUsd,
          o.status,
          o.created_at AS createdAt,

          p.code AS phaseCode,
          p.name AS phaseName

        FROM founding_orders o

        JOIN campaign_phases p
          ON p.id = o.phase_id

        WHERE o.public_id = ?

        LIMIT 1
      `,
      publicId,
    )
      .toArray()[0];
  }

  createOrder(payload) {
    const email =
      payload?.email;

    const idempotencyKey =
      payload?.idempotencyKey;

    if (!validEmail(email)) {
      throw new Error(
        "INVALID_EMAIL",
      );
    }

    if (
      !validIdempotencyKey(
        idempotencyKey,
      )
    ) {
      throw new Error(
        "INVALID_IDEMPOTENCY_KEY",
      );
    }

    return this.storage
      .transactionSync(() => {
        const existing =
          this.sql.exec(
            `
              SELECT
                o.id,
                o.public_id AS publicId,
                o.email,
                o.normalized_email AS normalizedEmail,
                o.reference_price_usd AS referencePriceUsd,
                o.status,
                o.created_at AS createdAt,

                p.code AS phaseCode,
                p.name AS phaseName

              FROM founding_orders o

              JOIN campaign_phases p
                ON p.id = o.phase_id

              WHERE o.idempotency_key = ?

              LIMIT 1
            `,
            idempotencyKey,
          )
            .toArray()[0];

        if (existing) {
          if (
            existing.normalizedEmail !==
            normalizeEmail(email)
          ) {
            throw new Error(
              "IDEMPOTENCY_KEY_CONFLICT",
            );
          }

          return {
            order:
              this.normalizeOrder(
                existing,
              ),

            idempotentReplay:
              true,
          };
        }

        const phase =
          this.sql.exec(`
            SELECT
              id,
              code,
              name,
              capacity,
              reference_price_usd AS referencePriceUsd,
              serial_start AS serialStart,
              serial_end AS serialEnd

            FROM campaign_phases

            WHERE active = 1

            ORDER BY position ASC

            LIMIT 1
          `)
            .toArray()[0];

        if (!phase) {
          throw new Error(
            "NO_ACTIVE_PHASE",
          );
        }

        const id =
          crypto.randomUUID();

        const publicId =
          createOrderPublicId();

        const trimmedEmail =
          email.trim();

        const now =
          new Date()
            .toISOString();

        this.sql.exec(
          `
            INSERT INTO founding_orders (
              id,
              public_id,
              phase_id,
              email,
              normalized_email,
              reference_price_usd,
              status,
              idempotency_key,
              created_at,
              updated_at
            )
            VALUES (
              ?, ?, ?, ?, ?, ?,
              'CREATED', ?, ?, ?
            )
          `,
          id,
          publicId,
          phase.id,
          trimmedEmail,
          normalizeEmail(
            trimmedEmail,
          ),
          phase.referencePriceUsd,
          idempotencyKey,
          now,
          now,
        );

        this.audit(
          "FOUNDING_ORDER_CREATED",
          "FOUNDING_ORDER",
          id,
          {
            publicId,
            phase:
              phase.code,
            referencePriceUsd:
              phase.referencePriceUsd,
          },
        );

        return {
          order: {
            publicId,
            email:
              trimmedEmail,

            phase: {
              code:
                phase.code,

              name:
                phase.name,
            },

            referencePriceUsd:
              Number(
                phase.referencePriceUsd,
              ),

            status:
              "CREATED",

            createdAt:
              now,
          },

          idempotentReplay:
            false,
        };
      });
  }

  normalizeAttempt(row) {
    return {
      publicId:
        row.publicId,

      paymentMethod:
        "USDT",

      network:
        row.network,

      chainId:
        Number(
          row.chainId,
        ),

      tokenContract:
        row.tokenContract,

      tokenDecimals:
        Number(
          row.tokenDecimals,
        ),

      receiverAddress:
        row.receiverAddress,

      expectedAmountMinor:
        Number(
          row.expectedAmountMinor,
        ),

      expectedAmountUsdt:
        formatUsdtMinor(
          Number(
            row.expectedAmountMinor,
          ),
        ),

      status:
        row.status,

      txHash:
        row.txHash ?? null,

      createdAt:
        row.createdAt,
    };
  }

  getAttemptByPublicId(
    publicId,
  ) {
    return this.sql.exec(
      `
        SELECT
          pa.id,
          pa.public_id AS publicId,
          pa.order_id AS orderId,

          pa.network,
          pa.chain_id AS chainId,

          pa.token_contract AS tokenContract,
          pa.token_decimals AS tokenDecimals,

          pa.receiver_address AS receiverAddress,

          pa.expected_amount_minor AS expectedAmountMinor,

          pa.status,
          pa.tx_hash AS txHash,
          pa.created_at AS createdAt

        FROM payment_attempts pa

        WHERE pa.public_id = ?

        LIMIT 1
      `,
      publicId,
    )
      .toArray()[0];
  }

  createUsdtAttempt(payload) {
    const orderPublicId =
      payload?.orderPublicId;

    const idempotencyKey =
      payload?.idempotencyKey;

    if (
      typeof orderPublicId !==
        "string" ||
      !/^F6K-[A-F0-9]{12}$/
        .test(orderPublicId)
    ) {
      throw new Error(
        "INVALID_ORDER_ID",
      );
    }

    if (
      !validIdempotencyKey(
        idempotencyKey,
      )
    ) {
      throw new Error(
        "INVALID_IDEMPOTENCY_KEY",
      );
    }

    return this.storage
      .transactionSync(() => {
        const order =
          this.getOrderByPublicId(
            orderPublicId,
          );

        if (!order) {
          throw new Error(
            "ORDER_NOT_FOUND",
          );
        }

        if (
          order.status !==
          "CREATED"
        ) {
          throw new Error(
            "ORDER_NOT_PAYABLE",
          );
        }

        const existing =
          this.sql.exec(
            `
              SELECT
                id,
                public_id AS publicId,
                order_id AS orderId,

                network,
                chain_id AS chainId,

                token_contract AS tokenContract,
                token_decimals AS tokenDecimals,

                receiver_address AS receiverAddress,

                expected_amount_minor AS expectedAmountMinor,

                status,
                tx_hash AS txHash,
                created_at AS createdAt

              FROM payment_attempts

              WHERE idempotency_key = ?

              LIMIT 1
            `,
            idempotencyKey,
          )
            .toArray()[0];

        if (existing) {
          if (
            existing.orderId !==
            order.id
          ) {
            throw new Error(
              "IDEMPOTENCY_KEY_CONFLICT",
            );
          }

          return {
            attempt:
              this.normalizeAttempt(
                existing,
              ),

            idempotentReplay:
              true,
          };
        }

        const id =
          crypto.randomUUID();

        const publicId =
          createPaymentPublicId();

        const expectedAmountMinor =
          Number(
            order.referencePriceUsd,
          ) *
          10 ** USDT_DECIMALS;

        const now =
          new Date()
            .toISOString();

        this.sql.exec(
          `
            INSERT INTO payment_attempts (
              id,
              public_id,
              order_id,
              payment_method,
              network,
              chain_id,
              token_contract,
              token_decimals,
              receiver_address,
              expected_amount_minor,
              status,
              tx_hash,
              idempotency_key,
              verification_attempts,
              last_verification_error,
              created_at,
              updated_at
            )
            VALUES (
              ?, ?, ?, 'USDT',
              ?, ?, ?, ?, ?, ?,
              'AWAITING_TRANSFER',
              NULL,
              ?,
              0,
              NULL,
              ?,
              ?
            )
          `,
          id,
          publicId,
          order.id,
          USDT_NETWORK,
          USDT_CHAIN_ID,
          USDT_TOKEN_CONTRACT,
          USDT_DECIMALS,
          USDT_RECEIVER_ADDRESS,
          expectedAmountMinor,
          idempotencyKey,
          now,
          now,
        );

        this.audit(
          "USDT_PAYMENT_ATTEMPT_CREATED",
          "PAYMENT_ATTEMPT",
          id,
          {
            paymentPublicId:
              publicId,

            orderPublicId,

            network:
              USDT_NETWORK,

            chainId:
              USDT_CHAIN_ID,

            tokenContract:
              USDT_TOKEN_CONTRACT,

            receiverAddress:
              USDT_RECEIVER_ADDRESS,

            expectedAmountMinor,

            authoritativePayment:
              false,
          },
        );

        return {
          attempt:
            this.normalizeAttempt(
              this.getAttemptByPublicId(
                publicId,
              ),
            ),

          idempotentReplay:
            false,
        };
      });
  }

  getUsdtAttempt(
    publicId,
  ) {
    if (
      typeof publicId !==
        "string" ||
      !/^PAY-USDT-[A-F0-9]{12}$/
        .test(publicId)
    ) {
      throw new Error(
        "INVALID_PAYMENT_ATTEMPT_ID",
      );
    }

    const attempt =
      this.getAttemptByPublicId(
        publicId,
      );

    if (!attempt) {
      throw new Error(
        "PAYMENT_ATTEMPT_NOT_FOUND",
      );
    }

    return {
      attempt:
        this.normalizeAttempt(
          attempt,
        ),
    };
  }

  submitUsdtHash(payload) {
    const publicId =
      payload?.paymentAttemptPublicId;

    const rawTxHash =
      payload?.txHash;

    if (
      typeof publicId !==
        "string" ||
      !/^PAY-USDT-[A-F0-9]{12}$/
        .test(publicId)
    ) {
      throw new Error(
        "INVALID_PAYMENT_ATTEMPT_ID",
      );
    }

    if (
      !validTxHash(
        rawTxHash,
      )
    ) {
      throw new Error(
        "INVALID_TX_HASH",
      );
    }

    const txHash =
      rawTxHash
        .trim()
        .toLowerCase();

    return this.storage
      .transactionSync(() => {
        const attempt =
          this.getAttemptByPublicId(
            publicId,
          );

        if (!attempt) {
          throw new Error(
            "PAYMENT_ATTEMPT_NOT_FOUND",
          );
        }

        if (
          attempt.status ===
          "VERIFIED"
        ) {
          throw new Error(
            "PAYMENT_ATTEMPT_NOT_SUBMITTABLE",
          );
        }

        if (
          [
            "REJECTED",
            "EXPIRED",
          ].includes(
            attempt.status,
          )
        ) {
          throw new Error(
            "PAYMENT_ATTEMPT_NOT_SUBMITTABLE",
          );
        }

        if (
          attempt.txHash &&
          attempt.txHash
            .toLowerCase() ===
            txHash
        ) {
          return {
            attempt:
              this.normalizeAttempt(
                attempt,
              ),

            idempotentReplay:
              true,

            paymentVerified:
              false,

            settlementCreated:
              false,
          };
        }

        if (
          attempt.txHash ||
          attempt.status !==
            "AWAITING_TRANSFER"
        ) {
          throw new Error(
            "PAYMENT_ATTEMPT_HASH_LOCKED",
          );
        }

        const duplicate =
          this.sql.exec(
            `
              SELECT public_id AS publicId
              FROM payment_attempts
              WHERE tx_hash = ?
              LIMIT 1
            `,
            txHash,
          )
            .toArray()[0];

        if (duplicate) {
          throw new Error(
            "TX_HASH_ALREADY_SUBMITTED",
          );
        }

        const now =
          new Date()
            .toISOString();

        this.sql.exec(
          `
            UPDATE payment_attempts

            SET
              tx_hash = ?,
              status = 'SUBMITTED',
              updated_at = ?

            WHERE id = ?
          `,
          txHash,
          now,
          attempt.id,
        );

        this.audit(
          "USDT_TX_HASH_SUBMITTED",
          "PAYMENT_ATTEMPT",
          attempt.id,
          {
            paymentPublicId:
              publicId,

            txHash,

            authoritativePayment:
              false,

            settlementCreated:
              false,
          },
        );

        return {
          attempt:
            this.normalizeAttempt(
              this.getAttemptByPublicId(
                publicId,
              ),
            ),

          idempotentReplay:
            false,

          paymentVerified:
            false,

          settlementCreated:
            false,
        };
      });
  }

  /*
   * -------------------------------------------------------
   * P6-B2 — AUTHORITATIVE USDT SETTLEMENT
   * -------------------------------------------------------
   *
   * This function accepts ONLY evidence that has already
   * passed the Ethereum verifier.
   *
   * All authoritative state changes happen inside ONE
   * Durable Object SQLite transaction:
   *
   * VERIFIED PAYMENT
   * → ORDER PAID
   * → INVENTORY SERIAL
   * → FOUNDING MEMBERSHIP
   *
   * Any error rolls back the entire operation.
   */
  settleVerifiedUsdt(
    payload,
  ) {
    const paymentPublicId =
      payload
        ?.paymentAttemptPublicId;

    const transfer =
      payload
        ?.transfer;

    if (
      typeof paymentPublicId !==
        "string" ||
      !/^PAY-USDT-[A-F0-9]{12}$/
        .test(
          paymentPublicId,
        )
    ) {
      throw new Error(
        "INVALID_PAYMENT_ATTEMPT_ID",
      );
    }

    if (
      !transfer ||
      typeof transfer !==
        "object"
    ) {
      throw new Error(
        "INVALID_VERIFIED_TRANSFER",
      );
    }

    if (
      !validTxHash(
        transfer.txHash,
      )
    ) {
      throw new Error(
        "INVALID_TX_HASH",
      );
    }

    const txHash =
      transfer.txHash
        .trim()
        .toLowerCase();

    if (
      Number(
        transfer.chainId,
      ) !==
      USDT_CHAIN_ID
    ) {
      throw new Error(
        "SETTLEMENT_CHAIN_MISMATCH",
      );
    }

    if (
      typeof transfer.tokenContract !==
        "string" ||
      transfer.tokenContract
        .toLowerCase() !==
      USDT_TOKEN_CONTRACT
        .toLowerCase()
    ) {
      throw new Error(
        "SETTLEMENT_TOKEN_MISMATCH",
      );
    }

    if (
      Number(
        transfer.confirmations,
      ) <
      USDT_CONFIRMATIONS_REQUIRED
    ) {
      throw new Error(
        "INSUFFICIENT_CONFIRMATIONS",
      );
    }

    return this.storage
      .transactionSync(() => {
        const context =
          this.sql.exec(
            `
              SELECT
                pa.id AS attemptId,
                pa.public_id AS attemptPublicId,
                pa.status AS attemptStatus,
                pa.tx_hash AS txHash,

                pa.receiver_address AS receiverAddress,
                pa.expected_amount_minor AS expectedAmountMinor,

                o.id AS orderId,
                o.public_id AS orderPublicId,
                o.status AS orderStatus,

                p.id AS phaseId,
                p.code AS phaseCode,
                p.name AS phaseName,
                p.position AS phasePosition,
                p.capacity AS phaseCapacity,
                p.serial_start AS serialStart,
                p.serial_end AS serialEnd

              FROM payment_attempts pa

              JOIN founding_orders o
                ON o.id = pa.order_id

              JOIN campaign_phases p
                ON p.id = o.phase_id

              WHERE pa.public_id = ?

              LIMIT 1
            `,
            paymentPublicId,
          )
            .toArray()[0];

        if (!context) {
          throw new Error(
            "PAYMENT_ATTEMPT_NOT_FOUND",
          );
        }

        /*
         * Safe replay of an already-settled payment.
         */
        const existingSettlement =
          this.sql.exec(
            `
              SELECT
                ps.id AS settlementId,
                ps.external_reference AS txHash,

                ia.serial_number AS serialNumber,

                fm.public_id AS membershipPublicId,
                fm.status AS membershipStatus,
                fm.founding_member AS foundingMember,
                fm.genesis_member AS genesisMember

              FROM payment_settlements ps

              JOIN inventory_allocations ia
                ON ia.order_id = ps.order_id

              JOIN founding_memberships fm
                ON fm.order_id = ps.order_id

              WHERE ps.payment_attempt_id = ?

              LIMIT 1
            `,
            context.attemptId,
          )
            .toArray()[0];

        if (existingSettlement) {
          if (
            existingSettlement
              .txHash
              .toLowerCase() !==
            txHash
          ) {
            throw new Error(
              "PAYMENT_ATTEMPT_ALREADY_SETTLED",
            );
          }

          return {
            idempotentReplay:
              true,

            settlement: {
              id:
                existingSettlement
                  .settlementId,

              txHash:
                existingSettlement
                  .txHash,
            },

            order: {
              publicId:
                context.orderPublicId,

              status:
                "PAID",
            },

            allocation: {
              serialNumber:
                Number(
                  existingSettlement
                    .serialNumber,
                ),

              phaseCode:
                context.phaseCode,

              phaseTransitioned:
                false,
            },

            membership: {
              publicId:
                existingSettlement
                  .membershipPublicId,

              serialNumber:
                Number(
                  existingSettlement
                    .serialNumber,
                ),

              foundingMember:
                Boolean(
                  existingSettlement
                    .foundingMember,
                ),

              genesisMember:
                Boolean(
                  existingSettlement
                    .genesisMember,
                ),

              status:
                existingSettlement
                  .membershipStatus,
            },
          };
        }

        /*
         * The transaction submitted by the user must be
         * exactly the transaction verified on-chain.
         */
        if (
          !context.txHash ||
          context.txHash
            .toLowerCase() !==
          txHash
        ) {
          throw new Error(
            "SETTLEMENT_TX_HASH_MISMATCH",
          );
        }

        if (
          ![
            "SUBMITTED",
            "VERIFYING",
          ].includes(
            context.attemptStatus,
          )
        ) {
          throw new Error(
            "PAYMENT_ATTEMPT_NOT_SETTLEABLE",
          );
        }

        if (
          context.orderStatus !==
          "CREATED"
        ) {
          throw new Error(
            "ORDER_NOT_PAYABLE",
          );
        }

        if (
          typeof transfer.receiverAddress !==
            "string" ||
          transfer.receiverAddress
            .toLowerCase() !==
          context.receiverAddress
            .toLowerCase()
        ) {
          throw new Error(
            "SETTLEMENT_RECEIVER_MISMATCH",
          );
        }

        if (
          BigInt(
            transfer.amountMinor,
          ) !==
          BigInt(
            context.expectedAmountMinor,
          )
        ) {
          throw new Error(
            "SETTLEMENT_AMOUNT_MISMATCH",
          );
        }

        /*
         * A blockchain transaction can settle only once
         * across the entire campaign.
         */
        const reusedTransaction =
          this.sql.exec(
            `
              SELECT id
              FROM payment_settlements
              WHERE external_reference = ?
              LIMIT 1
            `,
            txHash,
          )
            .toArray()[0];

        if (reusedTransaction) {
          throw new Error(
            "TRANSACTION_ALREADY_SETTLED",
          );
        }

        /*
         * Permanent historical issuance count.
         */
        const issuedRow =
          this.sql.exec(
            `
              SELECT
                COUNT(*) AS count,
                MAX(serial_number) AS maxSerial

              FROM inventory_allocations

              WHERE phase_id = ?
            `,
            context.phaseId,
          )
            .toArray()[0];

        const issued =
          Number(
            issuedRow?.count ??
            0,
          );

        if (
          issued >=
          Number(
            context.phaseCapacity,
          )
        ) {
          throw new Error(
            "PHASE_SOLD_OUT",
          );
        }

        const highestSerial =
          issuedRow
            ?.maxSerial === null ||
          issuedRow
            ?.maxSerial === undefined
            ? null
            : Number(
                issuedRow.maxSerial,
              );

        const serialNumber =
          highestSerial === null
            ? Number(
                context.serialStart,
              )
            : highestSerial + 1;

        if (
          serialNumber <
            Number(
              context.serialStart,
            ) ||
          serialNumber >
            Number(
              context.serialEnd,
            )
        ) {
          throw new Error(
            "PHASE_SERIAL_RANGE_EXHAUSTED",
          );
        }

        const now =
          new Date()
            .toISOString();

        const settlementId =
          crypto.randomUUID();

        /*
         * Persist authoritative blockchain evidence.
         */
        this.sql.exec(
          `
            INSERT INTO payment_settlements (
              id,
              payment_attempt_id,
              order_id,
              external_reference,
              network,
              chain_id,
              token_contract,
              sender_address,
              receiver_address,
              amount_minor,
              block_number,
              transaction_index,
              confirmations,
              evidence_json,
              verified_at
            )
            VALUES (
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?,
              ?, ?, ?, ?,
              ?, ?
            )
          `,
          settlementId,
          context.attemptId,
          context.orderId,
          txHash,
          USDT_NETWORK,
          USDT_CHAIN_ID,
          USDT_TOKEN_CONTRACT,
          String(
            transfer.senderAddress,
          ).toLowerCase(),
          String(
            transfer.receiverAddress,
          ).toLowerCase(),
          Number(
            transfer.amountMinor,
          ),
          Number(
            transfer.blockNumber,
          ),
          transfer.transactionIndex ===
            null ||
          transfer.transactionIndex ===
            undefined
            ? null
            : Number(
                transfer.transactionIndex,
              ),
          Number(
            transfer.confirmations,
          ),
          JSON.stringify({
            txHash,

            chainId:
              USDT_CHAIN_ID,

            tokenContract:
              USDT_TOKEN_CONTRACT,

            senderAddress:
              String(
                transfer.senderAddress,
              ).toLowerCase(),

            receiverAddress:
              String(
                transfer.receiverAddress,
              ).toLowerCase(),

            amountMinor:
              String(
                transfer.amountMinor,
              ),

            blockNumber:
              Number(
                transfer.blockNumber,
              ),

            transactionIndex:
              transfer.transactionIndex ??
              null,

            confirmations:
              Number(
                transfer.confirmations,
              ),
          }),
          now,
        );

        /*
         * Permanent Founding serial allocation.
         */
        this.sql.exec(
          `
            INSERT INTO inventory_allocations (
              id,
              phase_id,
              order_id,
              serial_number,
              settlement_reference,
              allocated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          crypto.randomUUID(),
          context.phaseId,
          context.orderId,
          serialNumber,
          txHash,
          now,
        );

        /*
         * Payment authority transitions.
         */
        this.sql.exec(
          `
            UPDATE payment_attempts

            SET
              status = 'VERIFIED',
              updated_at = ?

            WHERE id = ?
          `,
          now,
          context.attemptId,
        );

        this.sql.exec(
          `
            UPDATE founding_orders

            SET
              status = 'PAID',
              updated_at = ?

            WHERE id = ?
          `,
          now,
          context.orderId,
        );

        /*
         * Founding membership exists only after verified
         * settlement + serial allocation.
         *
         * 12-month access does NOT start here.
         */
        const membershipId =
          crypto.randomUUID();

        const membershipPublicId =
          `mem_${crypto.randomUUID()}`;

        const genesisMember =
          serialNumber <= 1000;

        this.sql.exec(
          `
            INSERT INTO founding_memberships (
              id,
              public_id,
              order_id,
              serial_number,
              founding_member,
              genesis_member,
              status,
              activation_started_at,
              activation_expires_at,
              created_at,
              updated_at
            )
            VALUES (
              ?, ?, ?, ?,
              1, ?,
              'ACTIVATION_PENDING',
              NULL,
              NULL,
              ?,
              ?
            )
          `,
          membershipId,
          membershipPublicId,
          context.orderId,
          serialNumber,
          genesisMember
            ? 1
            : 0,
          now,
          now,
        );

        /*
         * Advance campaign phase atomically when this
         * payment consumes the final available serial.
         */
        const newIssuedCount =
          issued + 1;

        let phaseTransitioned =
          false;

        if (
          newIssuedCount ===
          Number(
            context.phaseCapacity,
          )
        ) {
          const nextPhase =
            this.sql.exec(
              `
                SELECT id
                FROM campaign_phases

                WHERE position > ?

                ORDER BY position ASC

                LIMIT 1
              `,
              context.phasePosition,
            )
              .toArray()[0];

          this.sql.exec(
            `
              UPDATE campaign_phases
              SET active = 0
              WHERE id = ?
            `,
            context.phaseId,
          );

          if (nextPhase) {
            this.sql.exec(
              `
                UPDATE campaign_phases
                SET active = 1
                WHERE id = ?
              `,
              nextPhase.id,
            );

            phaseTransitioned =
              true;
          }
        }

        this.audit(
          "USDT_PAYMENT_SETTLED",
          "FOUNDING_ORDER",
          context.orderId,
          {
            orderPublicId:
              context.orderPublicId,

            paymentAttemptPublicId:
              context.attemptPublicId,

            txHash,

            senderAddress:
              String(
                transfer.senderAddress,
              ).toLowerCase(),

            receiverAddress:
              String(
                transfer.receiverAddress,
              ).toLowerCase(),

            amountMinor:
              String(
                transfer.amountMinor,
              ),

            confirmations:
              Number(
                transfer.confirmations,
              ),

            serialNumber,

            phaseCode:
              context.phaseCode,

            authoritativePayment:
              true,
          },
        );

        return {
          idempotentReplay:
            false,

          settlement: {
            id:
              settlementId,

            txHash,
          },

          order: {
            publicId:
              context.orderPublicId,

            status:
              "PAID",
          },

          allocation: {
            serialNumber,

            phaseCode:
              context.phaseCode,

            phaseTransitioned,
          },

          membership: {
            publicId:
              membershipPublicId,

            serialNumber,

            foundingMember:
              true,

            genesisMember,

            status:
              "ACTIVATION_PENDING",
          },
        };
      });
  }

}
