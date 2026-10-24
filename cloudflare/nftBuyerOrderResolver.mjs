/*
 * OriginX — Internal Buyer Order Resolver
 *
 * This module is NOT purchaser authentication.
 *
 * It may only be used to select the order's
 * registered email as the destination of a
 * verification challenge.
 *
 * Never return the internal resolution to
 * a public HTTP client.
 */

const ORDER_PATTERN = /^F6K-[A-F0-9]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid() {
  throw new Error("NFT_BUYER_ORDER_UNAVAILABLE");
}

export function resolveBuyerOrderForEmail({
  storage,
  orderPublicId,
  email,
}) {
  if (
    typeof orderPublicId !== "string" ||
    !ORDER_PATTERN.test(orderPublicId) ||
    typeof email !== "string" ||
    email.length > 320
  ) {
    invalid();
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (
    normalizedEmail.length < 3 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    invalid();
  }

  const rows = storage.sql.exec(`
    SELECT
      m.id AS membershipId,
      o.normalized_email AS registeredEmail,
      j.id AS mintJobId
    FROM founding_orders o
    JOIN founding_memberships m
      ON m.order_id = o.id
    JOIN nft_mint_jobs j
      ON j.membership_id = m.id
     AND j.order_id = o.id
     AND j.serial_number = m.serial_number
    WHERE o.public_id = ?
      AND o.normalized_email = ?
      AND o.status = 'PAID'
      AND m.status = 'ACTIVATION_PENDING'
      AND j.status = 'AWAITING_WALLET'
    LIMIT 2
  `, orderPublicId, normalizedEmail).toArray();

  if (rows.length !== 1) {
    invalid();
  }

  const row = rows[0];

  if (
    typeof row.membershipId !== "string" ||
    typeof row.registeredEmail !== "string" ||
    typeof row.mintJobId !== "string"
  ) {
    invalid();
  }

  return Object.freeze({
    membershipId: row.membershipId,
    registeredEmail: row.registeredEmail,
    mintJobId: row.mintJobId,
  });
}

/*
 * Public acknowledgement contract.
 *
 * Does not reveal whether an order exists,
 * is paid, or has a membership.
 *
 * This constant response is not a rate limiter
 * and must not be used as authorization.
 */
export function buyerEmailRequestAcknowledgement() {
  return {
    acceptedForProcessing: true,
    message:
      "Si los datos corresponden a una compra elegible, enviaremos instrucciones al correo registrado.",
  };
}
