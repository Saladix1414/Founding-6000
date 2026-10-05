import {
  db,
} from "../db/database.js";

import {
  ensureUsdtPaymentSchema,
} from "../db/usdtPaymentSchema.js";

ensureUsdtPaymentSchema();

export const USDT_VERIFICATION_LEASE_MS =
  10 * 60 * 1000;

export type PendingVerificationRow = {
  id: string;
  publicId: string;
  orderId: string;
  txHash: string;

  receiverAddress: string;
  expectedAmountMinor: number;

  status:
    "VERIFYING";

  verificationAttempts:
    number;
};

function boundedLimit(
  limit: number,
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return 1;
  }

  return Math.min(
    limit,
    100,
  );
}

function safeReason(
  reason:
    string | null | undefined,
) {
  if (!reason) {
    return null;
  }

  return reason
    .replace(
      /[\r\n\t]+/g,
      " ",
    )
    .slice(
      0,
      300,
    );
}

/*
 * Recover a VERIFYING attempt if the worker that
 * owned the lease disappeared.
 *
 * Pre-S1-D VERIFYING rows are also recoverable via
 * updated_at when verification_started_at is NULL.
 */
export function recoverStaleUsdtVerificationClaims(
  now:
    Date =
      new Date(),
) {
  ensureUsdtPaymentSchema();

  const nowIso =
    now.toISOString();

  const staleBefore =
    new Date(
      now.getTime() -
        USDT_VERIFICATION_LEASE_MS,
    ).toISOString();

  return db.prepare(`
    UPDATE payment_attempts

    SET
      status = 'SUBMITTED',
      verification_started_at = NULL,
      next_verification_at = ?,

      last_verification_error =
        COALESCE(
          last_verification_error,
          'USDT_VERIFICATION_LEASE_EXPIRED'
        ),

      updated_at = ?

    WHERE
      payment_method = 'USDT'

      AND status = 'VERIFYING'

      AND tx_hash IS NOT NULL

      AND COALESCE(
        verification_started_at,
        updated_at
      ) <= ?
  `).run(
    nowIso,
    nowIso,
    staleBefore,
  );
}

/*
 * Atomic queue claim.
 *
 * Workers may observe the same SUBMITTED candidate,
 * but only one conditional UPDATE can transition it
 * into VERIFYING.
 */
export function claimUsdtAttemptsAwaitingVerification(
  limit = 20,
  now:
    Date =
      new Date(),
) {
  ensureUsdtPaymentSchema();

  recoverStaleUsdtVerificationClaims(
    now,
  );

  const nowIso =
    now.toISOString();

  const candidates =
    db.prepare(`
      SELECT
        id

      FROM payment_attempts

      WHERE
        payment_method = 'USDT'

        AND tx_hash IS NOT NULL

        AND status = 'SUBMITTED'

        AND (
          next_verification_at IS NULL
          OR next_verification_at <= ?
        )

      ORDER BY updated_at ASC

      LIMIT ?
    `).all(
      nowIso,
      boundedLimit(
        limit,
      ),
    ) as Array<{
      id: string;
    }>;

  const claimed:
    PendingVerificationRow[] =
    [];

  for (
    const candidate of candidates
  ) {
    const result =
      db.prepare(`
        UPDATE payment_attempts

        SET
          status = 'VERIFYING',

          verification_attempts =
            verification_attempts + 1,

          verification_started_at = ?,

          next_verification_at = NULL,

          last_verification_error = NULL,

          updated_at = ?

        WHERE
          id = ?

          AND status = 'SUBMITTED'

          AND tx_hash IS NOT NULL

          AND (
            next_verification_at IS NULL
            OR next_verification_at <= ?
          )
      `).run(
        nowIso,
        nowIso,
        candidate.id,
        nowIso,
      );

    if (
      Number(
        result.changes,
      ) !== 1
    ) {
      continue;
    }

    const stored =
      db.prepare(`
        SELECT
          id,

          public_id AS publicId,

          order_id AS orderId,

          tx_hash AS txHash,

          receiver_address AS receiverAddress,

          expected_amount_minor AS expectedAmountMinor,

          status,

          verification_attempts AS verificationAttempts

        FROM payment_attempts

        WHERE id = ?
      `).get(
        candidate.id,
      ) as
        | PendingVerificationRow
        | undefined;

    if (
      stored &&
      stored.status ===
        "VERIFYING"
    ) {
      claimed.push(
        stored,
      );
    }
  }

  return claimed;
}

export function releaseUsdtAttemptForRetry(
  input: {
    attemptId: string;

    reason:
      string;

    delayMs:
      number;

    now?:
      Date;
  },
) {
  ensureUsdtPaymentSchema();

  const now =
    input.now ??
    new Date();

  const nowIso =
    now.toISOString();

  const nextVerificationAt =
    new Date(
      now.getTime() +
        Math.max(
          0,
          input.delayMs,
        ),
    ).toISOString();

  const result =
    db.prepare(`
      UPDATE payment_attempts

      SET
        status = 'SUBMITTED',

        verification_started_at =
          NULL,

        next_verification_at = ?,

        last_verification_error = ?,

        updated_at = ?

      WHERE
        id = ?

        AND status = 'VERIFYING'
    `).run(
      nextVerificationAt,
      safeReason(
        input.reason,
      ),
      nowIso,
      input.attemptId,
    );

  if (
    Number(
      result.changes,
    ) !== 1
  ) {
    throw new Error(
      "USDT_VERIFICATION_RELEASE_STATE_CONFLICT",
    );
  }

  return {
    nextVerificationAt,
  };
}

export function updateUsdtAttemptStatus(
  input: {
    attemptId: string;

    status:
      | "SUBMITTED"
      | "VERIFYING"
      | "VERIFIED"
      | "REJECTED";

    lastVerificationError?:
      string | null;
  },
) {
  ensureUsdtPaymentSchema();

  const now =
    new Date().toISOString();

  const clearLease =
    input.status !==
      "VERIFYING";

  const result =
    db.prepare(`
      UPDATE payment_attempts

      SET
        status = ?,

        verification_started_at =
          CASE
            WHEN ?
              THEN NULL
            ELSE verification_started_at
          END,

        next_verification_at =
          CASE
            WHEN ?
              THEN NULL
            ELSE next_verification_at
          END,

        last_verification_error = ?,

        updated_at = ?

      WHERE id = ?
    `).run(
      input.status,
      clearLease
        ? 1
        : 0,
      clearLease
        ? 1
        : 0,
      safeReason(
        input
          .lastVerificationError,
      ),
      now,
      input.attemptId,
    );

  if (
    Number(
      result.changes,
    ) !== 1
  ) {
    throw new Error(
      "USDT_VERIFICATION_STATUS_UPDATE_FAILED",
    );
  }
}
