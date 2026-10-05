import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import { Decimal } from "decimal.js";

import { env } from "../config/env.js";
import { db } from "../db/database.js";

import {
  getFxProvider,
} from "../fx/providerFactory.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  expireQuoteIfNeeded,
  getQuoteByIdempotencyKey,
  getQuoteByPublicId,
  type PaymentQuoteRow,
} from "../repositories/quoteRepository.js";

type QuoteOrderRow = {
  id: string;
  publicId: string;
  referencePriceUsd: number;
  status: string;
};

function createQuotePublicId() {
  return `Q-ARS-${randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

function getOrderForQuote(
  orderPublicId: string,
) {
  return db.prepare(`
    SELECT
      id,
      public_id AS publicId,
      reference_price_usd AS referencePriceUsd,
      status
    FROM founding_orders
    WHERE public_id = ?
  `).get(
    orderPublicId,
  ) as
    | QuoteOrderRow
    | undefined;
}

function normalizeQuote(
  quote: PaymentQuoteRow,
) {
  const snapshot =
    JSON.parse(
      quote.providerSnapshotJson,
    ) as Record<
      string,
      unknown
    >;

  return {
    publicId:
      quote.publicId,

    currency:
      quote.currency,

    referencePriceUsd:
      Number(
        quote.referencePriceUsd,
      ),

    fxSource:
      quote.fxSource,

    fxRateArsPerUsd:
      quote.fxRateArsPerUsd,

    quotedAmountArsMinor:
      Number(
        quote.quotedAmountArsMinor,
      ),

    quotedAmountArs:
      new Decimal(
        quote.quotedAmountArsMinor,
      )
        .div(100)
        .toFixed(2),

    status:
      quote.status,

    providerSnapshot:
      snapshot,

    quoteCreatedAt:
      quote.quoteCreatedAt,

    quoteExpiresAt:
      quote.quoteExpiresAt,
  };
}

export async function createArsQuote(
  input: {
    orderPublicId: string;
    idempotencyKey?: string | null;
  },
) {
  if (
    input.idempotencyKey
  ) {
    const existing =
      getQuoteByIdempotencyKey(
        input.idempotencyKey,
      );

    if (existing) {
      const current =
        expireQuoteIfNeeded(
          existing,
        );

      return {
        quote:
          normalizeQuote(
            current,
          ),

        idempotentReplay:
          true,
      };
    }
  }

  const order =
    getOrderForQuote(
      input.orderPublicId,
    );

  if (!order) {
    throw new Error(
      "ORDER_NOT_FOUND",
    );
  }

  if (
    [
      "PAID",
      "REFUNDED",
      "CANCELLED",
      "EXPIRED",
    ].includes(
      order.status,
    )
  ) {
    throw new Error(
      "ORDER_NOT_QUOTABLE",
    );
  }

  const fxProvider =
    getFxProvider();

  const snapshot =
    await fxProvider.getUsdArsRate();

  const referencePriceUsd =
    new Decimal(
      order.referencePriceUsd,
    );

  const fxRate =
    new Decimal(
      snapshot.rateArsPerUsd,
    );

  const quotedAmountArs =
    referencePriceUsd
      .mul(
        fxRate,
      )
      .toDecimalPlaces(
        2,
        Decimal.ROUND_HALF_UP,
      );

  const quotedAmountArsMinor =
    quotedAmountArs
      .mul(100)
      .toDecimalPlaces(
        0,
        Decimal.ROUND_HALF_UP,
      );

  if (
    quotedAmountArsMinor.lte(0) ||
    !quotedAmountArsMinor.isInteger()
  ) {
    throw new Error(
      "INVALID_QUOTED_AMOUNT",
    );
  }

  const quoteId =
    randomUUID();

  const publicId =
    createQuotePublicId();

  const createdAt =
    new Date();

  const expiresAt =
    new Date(
      createdAt.getTime() +
      env.FX_QUOTE_TTL_SECONDS *
        1000,
    );

  db.exec(
    "BEGIN IMMEDIATE",
  );

  try {
    db.prepare(`
      UPDATE payment_quotes
      SET
        status = 'VOID',
        updated_at = ?
      WHERE
        order_id = ?
        AND status = 'ACTIVE'
    `).run(
      createdAt.toISOString(),
      order.id,
    );

    db.prepare(`
      INSERT INTO payment_quotes (
        id,
        public_id,
        order_id,
        currency,
        reference_price_usd,
        fx_source,
        fx_rate_ars_per_usd,
        quoted_amount_ars_minor,
        provider_snapshot_json,
        status,
        idempotency_key,
        quote_created_at,
        quote_expires_at,
        updated_at
      )
      VALUES (
        ?, ?, ?, 'ARS', ?, ?, ?, ?, ?, 'ACTIVE',
        ?, ?, ?, ?
      )
    `).run(
      quoteId,
      publicId,
      order.id,
      order.referencePriceUsd,
      snapshot.source,
      snapshot.rateArsPerUsd,
      Number(
        quotedAmountArsMinor.toString(),
      ),
      JSON.stringify(
        snapshot,
      ),
      input.idempotencyKey ??
        null,
      createdAt.toISOString(),
      expiresAt.toISOString(),
      createdAt.toISOString(),
    );

    createAuditEvent({
      eventType:
        "ARS_QUOTE_CREATED",

      entityType:
        "PAYMENT_QUOTE",

      entityId:
        quoteId,

      payload: {
        quotePublicId:
          publicId,

        orderPublicId:
          order.publicId,

        referencePriceUsd:
          order.referencePriceUsd,

        fxSource:
          snapshot.source,

        fxRateArsPerUsd:
          snapshot.rateArsPerUsd,

        quotedAmountArsMinor:
          Number(
            quotedAmountArsMinor.toString(),
          ),

        quoteExpiresAt:
          expiresAt.toISOString(),
      },
    });

    db.exec(
      "COMMIT",
    );
  } catch (error) {
    try {
      db.exec(
        "ROLLBACK",
      );
    } catch {
      // Transaction may already be closed.
    }

    throw error;
  }

  const stored =
    getQuoteByPublicId(
      publicId,
    );

  if (!stored) {
    throw new Error(
      "QUOTE_PERSISTENCE_FAILED",
    );
  }

  return {
    quote:
      normalizeQuote(
        stored,
      ),

    idempotentReplay:
      false,
  };
}

export function getArsQuote(
  publicId: string,
) {
  const quote =
    getQuoteByPublicId(
      publicId,
    );

  if (!quote) {
    return null;
  }

  return normalizeQuote(
    expireQuoteIfNeeded(
      quote,
    ),
  );
}

export function assertArsQuoteUsable(
  publicId: string,
) {
  const quote =
    getQuoteByPublicId(
      publicId,
    );

  if (!quote) {
    throw new Error(
      "QUOTE_NOT_FOUND",
    );
  }

  const current =
    expireQuoteIfNeeded(
      quote,
    );

  if (
    current.status !== "ACTIVE"
  ) {
    throw new Error(
      "QUOTE_NOT_ACTIVE",
    );
  }

  return normalizeQuote(
    current,
  );
}
