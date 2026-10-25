import {
  resolveBuyerOrderForEmail,
} from "./nftBuyerOrderResolver.mjs";

import {
  verifyBuyerEmailCode,
} from "./nftBuyerEmailAuth.mjs";

import {
  issueNftClaimGrant,
} from "./nftClaimGrant.mjs";

const CHALLENGE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CODE_PATTERN = /^[0-9a-f]{32}$/;

function fail() {
  throw new Error("NFT_BUYER_CLAIM_UNAVAILABLE");
}

/*
 * INTERNAL ONLY — not an HTTP endpoint.
 *
 * The email code is the buyer's proof.
 * The order and email only select the membership;
 * they are NOT independent authentication.
 *
 * This function must later be protected by
 * per-actor / per-challenge verification limits
 * and non-enumerating HTTP responses.
 */
export function completeBuyerEmailClaim({
  storage,
  orderPublicId,
  email,
  challengeId,
  code,
  now = Date.now(),
}) {
  if (
    typeof challengeId !== "string" ||
    !CHALLENGE_PATTERN.test(challengeId) ||
    typeof code !== "string" ||
    !CODE_PATTERN.test(code) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    fail();
  }

  /*
   * All writes share one transaction.
   *
   * Existing domain functions already own
   * their own transactions, so this adapter
   * joins the current SQLite transaction.
   */
  const joinedStorage = {
    sql: storage.sql,
    transactionSync: fn => fn(),
  };

  const result = storage.transactionSync(() => {
    const order = resolveBuyerOrderForEmail({
      storage: joinedStorage,
      orderPublicId,
      email,
    });

    const checked = verifyBuyerEmailCode({
      storage: joinedStorage,
      membershipId: order.membershipId,
      challengeId,
      code,
      now,
    });

    if (checked.verified !== true) {
      /*
       * Return instead of throwing inside SQLite:
       * failed-attempt counter must be committed.
       */
      return { verified: false };
    }

    const grant = issueNftClaimGrant({
      storage: joinedStorage,
      membershipId: order.membershipId,
      emailChallengeId: challengeId,
      now,
    });

    return {
      verified: true,
      claimToken: grant.token,
      claimExpiresAt: grant.expiresAt,
    };
  });

  if (!result.verified) {
    fail();
  }

  return result;
}


/*
 * NFT_BUYER_SAFE_CLAIM_BOUNDARY_V1
 *
 * Call this from the future trusted HTTP layer,
 * rather than exposing the internal primitive.
 *
 * Errors deliberately carry no membership,
 * challenge, database or provider information.
 */
export function completeBuyerEmailClaimSafely(options) {
  try {
    return completeBuyerEmailClaim(options);
  } catch {
    throw new Error("NFT_BUYER_CLAIM_UNAVAILABLE");
  }
}
