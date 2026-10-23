const HOUR_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_PER_HOUR = 3;

/*
 * Internal reservation only.
 * membershipId must come from authenticated context.
 *
 * No public route, email sending or mint authority.
 */
export function reserveBuyerEmailSend({
  storage,
  membershipId,
  now = Date.now(),
}) {
  if (
    typeof membershipId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(membershipId) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    throw new Error("NFT_EMAIL_RATE_INVALID_INPUT");
  }

  return storage.transactionSync(() => {
    const sql = storage.sql;
    const bucket = Math.floor(now / HOUR_MS) * HOUR_MS;

    const latest = sql.exec(`
      SELECT last_reserved_at AS lastReservedAt
      FROM nft_email_rate_limits
      WHERE membership_id = ?
      ORDER BY last_reserved_at DESC
      LIMIT 1
    `, membershipId).toArray()[0];

    if (
      latest &&
      now - Number(latest.lastReservedAt) < COOLDOWN_MS
    ) {
      throw new Error("NFT_EMAIL_COOLDOWN_ACTIVE");
    }

    const current = sql.exec(`
      SELECT request_count AS count
      FROM nft_email_rate_limits
      WHERE membership_id = ?
        AND bucket_start = ?
    `, membershipId, bucket).toArray()[0];

    if (Number(current?.count ?? 0) >= MAX_PER_HOUR) {
      throw new Error("NFT_EMAIL_HOURLY_LIMIT");
    }

    sql.exec(`
      INSERT INTO nft_email_rate_limits (
        membership_id, bucket_start,
        request_count, last_reserved_at
      ) VALUES (?, ?, 1, ?)
      ON CONFLICT(membership_id, bucket_start)
      DO UPDATE SET
        request_count = request_count + 1,
        last_reserved_at = excluded.last_reserved_at
    `, membershipId, bucket, now);

    return {
      reserved: true,
      remaining: MAX_PER_HOUR -
        Number(current?.count ?? 0) - 1,
    };
  });
}
