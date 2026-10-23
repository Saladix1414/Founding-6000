import { sha256 } from "ethers";

import {
  createWalletChallenge,
  verifyWalletSignature,
} from "./nftWalletProof.mjs";

/*
 * Internal-only domain operations.
 * membershipId MUST come from trusted authorization,
 * never directly from an unverified public request.
 */

function one(storage, sql, ...args) {
  return storage.sql.exec(sql, ...args).toArray()[0];
}

function fail(code) {
  throw new Error(code);
}

function eligible(storage, membershipId) {
  const row = one(storage, `
    SELECT
      m.public_id AS publicId,
      j.status AS jobStatus
    FROM founding_memberships m
    JOIN founding_orders o ON o.id = m.order_id
    JOIN nft_mint_jobs j ON j.membership_id = m.id
    WHERE m.id = ?
      AND o.status = 'PAID'
      AND m.status = 'ACTIVATION_PENDING'
  `, membershipId);

  if (!row || row.jobStatus !== "AWAITING_WALLET") {
    fail("NFT_WALLET_BINDING_NOT_ELIGIBLE");
  }

  return row;
}

export function beginNftWalletBinding({
  storage,
  membershipId,
  walletAddress,
  origin,
  chainId,
  now = Date.now(),
}) {
  return storage.transactionSync(() => {
    const member = eligible(storage, membershipId);

    const challenge = createWalletChallenge({
      membershipId: member.publicId,
      walletAddress,
      origin,
      chainId,
      now,
    });

    storage.sql.exec(`
      UPDATE nft_wallet_challenges
      SET status = 'REVOKED'
      WHERE membership_id = ?
        AND status = 'PENDING'
    `, membershipId);

    storage.sql.exec(`
      INSERT INTO nft_wallet_challenges (
        id, membership_id, wallet_address,
        nonce, challenge_message, status,
        created_at, expires_at, verified_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, NULL)
    `,
      crypto.randomUUID(),
      membershipId,
      challenge.walletAddress,
      challenge.nonce,
      challenge.message,
      challenge.issuedAt,
      challenge.expiresAt,
    );

    return challenge;
  });
}

export function completeNftWalletBinding({
  storage,
  membershipId,
  nonce,
  signature,
  claimToken,
  now = Date.now(),
}) {
  return storage.transactionSync(() => {
    eligible(storage, membershipId);

    const row = one(storage, `
      SELECT
        c.wallet_address AS walletAddress,
        c.challenge_message AS message,
        c.status,
        c.created_at AS issuedAt,
        c.expires_at AS expiresAt,
        m.public_id AS membershipPublicId
      FROM nft_wallet_challenges c
      JOIN founding_memberships m ON m.id = c.membership_id
      WHERE c.membership_id = ?
        AND c.nonce = ?
    `, membershipId, nonce);

    if (!row || row.status !== "PENDING") {
      fail("NFT_WALLET_CHALLENGE_NOT_PENDING");
    }

    const origin = row.message.match(
      /^Origin: (.+)$/m,
    )?.[1];

    const chainId = Number(
      row.message.match(/^Chain ID: ([0-9]+)$/m)?.[1],
    );

    const verified = verifyWalletSignature({
      challenge: {
        membershipId: row.membershipPublicId,
        walletAddress: row.walletAddress,
        origin,
        chainId,
        nonce,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
        message: row.message,
      },
      signature,
      now,
    });

    if (!verified) {
      fail("NFT_WALLET_SIGNATURE_INVALID");
    }

    /*
     * Claim authorization and wallet proof are consumed
     * together, inside the same SQLite transaction.
     */
    if (
      typeof claimToken !== "string" ||
      !/^0x[0-9a-f]{64}$/.test(claimToken) ||
      !Number.isSafeInteger(now) ||
      now < 0
    ) {
      fail("NFT_CLAIM_REQUIRED");
    }

    const grant = one(storage, `
      SELECT id, expires_at AS expiresAt
      FROM nft_claim_grants
      WHERE membership_id = ?
        AND token_hash = ?
        AND status = 'ISSUED'
    `, membershipId, sha256(claimToken));

    if (
      !grant ||
      !Number.isFinite(Date.parse(grant.expiresAt)) ||
      now >= Date.parse(grant.expiresAt)
    ) {
      fail("NFT_CLAIM_INVALID_OR_EXPIRED");
    }

    const verifiedAt = new Date(now).toISOString();

    storage.sql.exec(`
      UPDATE nft_claim_grants
      SET status = 'CONSUMED',
          consumed_at = ?
      WHERE id = ?
        AND status = 'ISSUED'
    `, verifiedAt, grant.id);

    const consumed = one(storage, `
      SELECT status, consumed_at AS consumedAt
      FROM nft_claim_grants
      WHERE id = ?
    `, grant.id);

    if (
      consumed?.status !== "CONSUMED" ||
      consumed.consumedAt !== verifiedAt
    ) {
      fail("NFT_CLAIM_CONSUME_FAILED");
    }



    storage.sql.exec(`
      UPDATE nft_wallet_challenges
      SET status = 'VERIFIED', verified_at = ?
      WHERE membership_id = ?
        AND nonce = ?
        AND status = 'PENDING'
    `, verifiedAt, membershipId, nonce);

    storage.sql.exec(`
      UPDATE nft_mint_jobs
      SET recipient_address = ?,
          status = 'READY',
          updated_at = ?
      WHERE membership_id = ?
        AND status = 'AWAITING_WALLET'
    `,
      row.walletAddress,
      verifiedAt,
      membershipId,
    );

    return {
      status: "READY",
      recipientAddress: row.walletAddress,
    };
  });
}
