import { getAddress } from "ethers";

/*
 * ORIGINX — PHASE 5J.3
 *
 * Internal post-verification operation.
 *
 * A wallet may be bound only after the
 * email-bound claim and ECDSA verification
 * have succeeded.
 *
 * The binding is an initial delivery record.
 * It is NOT current NFT ownership.
 *
 * No public HTTP route and no mint authority.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WINDOW_MS = 15 * 60 * 1000;

function unavailable() {
  throw new Error("NFT_WALLET_BINDING_UNAVAILABLE");
}

export function bindVerifiedWalletToMembership({
  storage,
  challengeId,
  email,
  now = Date.now(),
}) {
  if (
    !storage?.sql ||
    typeof storage.transactionSync !== "function" ||
    typeof challengeId !== "string" ||
    !UUID.test(challengeId) ||
    typeof email !== "string" ||
    email.length > 320 ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    unavailable();
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL.test(normalizedEmail)) {
    unavailable();
  }

  return storage.transactionSync(() => {
    const rows = storage.sql.exec(`
      SELECT
        c.id AS challengeId,
        c.membership_id AS membershipId,
        c.wallet_address AS walletAddress,
        c.verified_at AS verifiedAt,
        m.serial_number AS serialNumber,
        j.recipient_address AS recipientAddress
      FROM nft_wallet_challenges c
      JOIN founding_memberships m
        ON m.id = c.membership_id
      JOIN founding_orders o
        ON o.id = m.order_id
      JOIN nft_mint_jobs j
        ON j.membership_id = m.id
       AND j.order_id = o.id
       AND j.serial_number = m.serial_number
      WHERE c.id = ?
        AND c.status = 'VERIFIED'
        AND o.normalized_email = ?
        AND o.status = 'PAID'
        AND m.status = 'ACTIVATION_PENDING'
        AND j.status = 'AWAITING_WALLET'
        AND EXISTS (
          SELECT 1
          FROM nft_claim_grants g
          WHERE g.membership_id = m.id
            AND g.status = 'CONSUMED'
            AND g.consumed_at = c.verified_at
        )
      LIMIT 2
    `, challengeId, normalizedEmail).toArray();

    if (rows.length !== 1) {
      unavailable();
    }

    const row = rows[0];
    const verifiedAt = Date.parse(row.verifiedAt);

    if (
      !Number.isFinite(verifiedAt) ||
      now < verifiedAt ||
      now > verifiedAt + WINDOW_MS ||
      !Number.isInteger(row.serialNumber) ||
      row.serialNumber < 1 ||
      row.serialNumber > 6000 ||
      row.recipientAddress !== null
    ) {
      unavailable();
    }

    let wallet;

    try {
      wallet = getAddress(row.walletAddress);
    } catch {
      unavailable();
    }

    /*
     * Never overwrite an existing binding.
     * UNIQUE membership_id and challenge_id
     * remain the database's final defense.
     */
    const existing = storage.sql.exec(`
      SELECT id
      FROM nft_wallet_bindings
      WHERE membership_id = ?
         OR challenge_id = ?
      LIMIT 1
    `,
      row.membershipId,
      challengeId,
    ).toArray();

    if (existing.length !== 0) {
      unavailable();
    }

    const bindingId = crypto.randomUUID();
    const stamp = new Date(now).toISOString();

    storage.sql.exec(`
      INSERT INTO nft_wallet_bindings (
        id,
        membership_id,
        challenge_id,
        wallet_address,
        chain_id,
        status,
        bound_at
      )
      VALUES (?, ?, ?, ?, 8453, 'BOUND', ?)
    `,
      bindingId,
      row.membershipId,
      challengeId,
      wallet,
      stamp,
    );

    storage.sql.exec(`
      INSERT INTO nft_wallet_binding_events (
        id,
        binding_id,
        membership_id,
        challenge_id,
        event_type,
        created_at
      )
      VALUES (?, ?, ?, ?,
        'WALLET_BOUND', ?)
    `,
      crypto.randomUUID(),
      bindingId,
      row.membershipId,
      challengeId,
      stamp,
    );

    const saved = storage.sql.exec(`
      SELECT id, wallet_address AS walletAddress,
             status
      FROM nft_wallet_bindings
      WHERE membership_id = ?
        AND challenge_id = ?
    `,
      row.membershipId,
      challengeId,
    ).toArray();

    if (
      saved.length !== 1 ||
      saved[0].id !== bindingId ||
      saved[0].walletAddress !== wallet ||
      saved[0].status !== "BOUND"
    ) {
      unavailable();
    }

    return Object.freeze({
      bound: true,
      bindingId,
      membershipId: row.membershipId,
      serialNumber: row.serialNumber,
      walletAddress: wallet,
      chainId: 8453,
    });
  });
}
