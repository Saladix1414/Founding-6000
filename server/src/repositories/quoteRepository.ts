import { db } from "../db/database.js";

export type PaymentQuoteRow = {
  id: string;
  publicId: string;
  orderId: string;

  currency: "ARS";

  referencePriceUsd: number;

  fxSource: string;
  fxRateArsPerUsd: string;

  quotedAmountArsMinor: number;

  providerSnapshotJson: string;

  status:
    | "ACTIVE"
    | "EXPIRED"
    | "USED"
    | "VOID";

  idempotencyKey:
    | string
    | null;

  quoteCreatedAt: string;
  quoteExpiresAt: string;
  updatedAt: string;
};

const selectFields = `
  SELECT
    id,
    public_id AS publicId,
    order_id AS orderId,
    currency,
    reference_price_usd AS referencePriceUsd,
    fx_source AS fxSource,
    fx_rate_ars_per_usd AS fxRateArsPerUsd,
    quoted_amount_ars_minor AS quotedAmountArsMinor,
    provider_snapshot_json AS providerSnapshotJson,
    status,
    idempotency_key AS idempotencyKey,
    quote_created_at AS quoteCreatedAt,
    quote_expires_at AS quoteExpiresAt,
    updated_at AS updatedAt
  FROM payment_quotes
`;

export function getQuoteByPublicId(
  publicId: string,
) {
  return db.prepare(`
    ${selectFields}
    WHERE public_id = ?
  `).get(
    publicId,
  ) as
    | PaymentQuoteRow
    | undefined;
}

export function getQuoteByIdempotencyKey(
  idempotencyKey: string,
) {
  return db.prepare(`
    ${selectFields}
    WHERE idempotency_key = ?
  `).get(
    idempotencyKey,
  ) as
    | PaymentQuoteRow
    | undefined;
}

export function expireQuoteIfNeeded(
  quote: PaymentQuoteRow,
) {
  if (
    quote.status !== "ACTIVE"
  ) {
    return quote;
  }

  const now =
    Date.now();

  const expires =
    new Date(
      quote.quoteExpiresAt,
    ).getTime();

  if (
    Number.isFinite(expires) &&
    now >= expires
  ) {
    const updatedAt =
      new Date().toISOString();

    db.prepare(`
      UPDATE payment_quotes
      SET
        status = 'EXPIRED',
        updated_at = ?
      WHERE
        id = ?
        AND status = 'ACTIVE'
    `).run(
      updatedAt,
      quote.id,
    );

    return {
      ...quote,
      status:
        "EXPIRED" as const,
      updatedAt,
    };
  }

  return quote;
}
