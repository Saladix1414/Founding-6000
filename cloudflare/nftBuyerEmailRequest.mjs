import {
  resolveBuyerOrderForEmail,
  buyerEmailRequestAcknowledgement,
} from "./nftBuyerOrderResolver.mjs";

import {
  deliverBuyerEmailCode,
} from "./nftBuyerEmailFlow.mjs";

const HOUR_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/*
 * Internal-only actor rate reservation.
 *
 * actorHash must be a server-generated, HMAC-based
 * identifier derived from the request origin.
 * Never trust a client-supplied actor hash.
 */
export function reserveBuyerEmailActor({
  storage,
  actorHash,
  now = Date.now(),
}) {
  if (
    typeof actorHash !== "string" ||
    !HASH_PATTERN.test(actorHash) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    throw new Error("NFT_BUYER_ACTOR_INVALID");
  }

  return storage.transactionSync(() => {
    const bucket = Math.floor(now / HOUR_MS) * HOUR_MS;

    const row = storage.sql.exec(`
      SELECT request_count AS requestCount
      FROM nft_email_actor_limits
      WHERE actor_hash = ?
        AND bucket_start = ?
    `, actorHash, bucket).toArray()[0];

    if (Number(row?.requestCount ?? 0) >= MAX_REQUESTS) {
      return { allowed: false };
    }

    storage.sql.exec(`
      INSERT INTO nft_email_actor_limits (
        actor_hash, bucket_start,
        request_count, updated_at
      ) VALUES (?, ?, 1, ?)
      ON CONFLICT(actor_hash, bucket_start)
      DO UPDATE SET
        request_count = request_count + 1,
        updated_at = excluded.updated_at
    `,
      actorHash,
      bucket,
      new Date(now).toISOString(),
    );

    return { allowed: true };
  });
}

/*
 * Service-level boundary only.
 *
 * No public endpoint is installed here.
 * The HTTP layer must derive actorHash itself,
 * enforce body-size limits, and handle CORS.
 *
 * Injected send is for testing. In production,
 * use deliverBuyerEmailCode after configuring
 * the trusted Resend sender.
 */
export async function requestBuyerEmailVerification({
  storage,
  orderPublicId,
  email,
  actorHash,
  apiKey,
  from,
  now = Date.now(),
  deliver = deliverBuyerEmailCode,
}) {
  const publicResponse =
    buyerEmailRequestAcknowledgement();

  /*
   * This reservation intentionally happens before
   * order lookup, including nonexistent orders.
   */
  const actor = reserveBuyerEmailActor({
    storage,
    actorHash,
    now,
  });

  if (!actor.allowed) {
    return publicResponse;
  }

  let resolution;

  try {
    resolution = resolveBuyerOrderForEmail({
      storage,
      orderPublicId,
      email,
    });
  } catch {
    return publicResponse;
  }

  try {
    await deliver({
      storage,
      membershipId: resolution.membershipId,
      apiKey,
      from,
      now,
    });
  } catch {
    /*
     * Never expose paid-order existence, provider
     * errors, member identity or email status.
     *
     * Internal monitoring must be added before
     * public deployment.
     */
  }

  return publicResponse;
}
