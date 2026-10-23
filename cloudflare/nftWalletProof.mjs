import {
  getAddress,
  verifyMessage,
} from "ethers";

const MAX_LIFETIME_MS = 15 * 60 * 1000;

function validOrigin(value) {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.origin === value &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function createWalletChallenge({
  membershipId,
  walletAddress,
  origin,
  chainId,
  now = Date.now(),
}) {
  if (
    typeof membershipId !== "string" ||
    !/^mem_[0-9a-f-]{36}$/i.test(membershipId)
  ) {
    throw new Error("INVALID_MEMBERSHIP_ID");
  }

  if (!validOrigin(origin)) {
    throw new Error("INVALID_CHALLENGE_ORIGIN");
  }

  if (![8453, 84532].includes(chainId)) {
    throw new Error("UNSUPPORTED_NFT_CHAIN");
  }

  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("INVALID_CHALLENGE_TIME");
  }

  const address = getAddress(walletAddress);
  const nonce = crypto.randomUUID();

  const issuedAt = new Date(now).toISOString();
  const expiresAt =
    new Date(now + MAX_LIFETIME_MS).toISOString();

  const message = [
    "OriginX Founding 6000 NFT Wallet Verification",
    "",
    `Origin: ${origin}`,
    `Membership: ${membershipId}`,
    `Wallet: ${address}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
    "",
    "This signature proves wallet control only.",
    "It does not authorize payment or minting.",
  ].join("\n");

  return {
    membershipId,
    walletAddress: address,
    origin,
    chainId,
    nonce,
    issuedAt,
    expiresAt,
    message,
  };
}

export function verifyWalletSignature({
  challenge,
  signature,
  now = Date.now(),
}) {
  if (
    !challenge ||
    typeof challenge !== "object" ||
    typeof challenge.message !== "string" ||
    typeof signature !== "string" ||
    !Number.isSafeInteger(now)
  ) {
    return false;
  }

  const issued = Date.parse(challenge.issuedAt);
  const expires = Date.parse(challenge.expiresAt);

  if (
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    now < issued ||
    now >= expires ||
    expires - issued > MAX_LIFETIME_MS
  ) {
    return false;
  }

  try {
    const expected = createMessageFromChallenge(challenge);

    if (expected !== challenge.message) return false;

    const signer = verifyMessage(
      challenge.message,
      signature,
    );

    return (
      getAddress(signer) ===
      getAddress(challenge.walletAddress)
    );
  } catch {
    return false;
  }
}

function createMessageFromChallenge(c) {
  if (
    !validOrigin(c.origin) ||
    ![8453, 84532].includes(c.chainId) ||
    !/^mem_[0-9a-f-]{36}$/i.test(c.membershipId) ||
    !/^[0-9a-f-]{36}$/i.test(c.nonce)
  ) {
    throw new Error("INVALID_CHALLENGE");
  }

  return [
    "OriginX Founding 6000 NFT Wallet Verification",
    "",
    `Origin: ${c.origin}`,
    `Membership: ${c.membershipId}`,
    `Wallet: ${getAddress(c.walletAddress)}`,
    `Chain ID: ${c.chainId}`,
    `Nonce: ${c.nonce}`,
    `Issued At: ${c.issuedAt}`,
    `Expires At: ${c.expiresAt}`,
    "",
    "This signature proves wallet control only.",
    "It does not authorize payment or minting.",
  ].join("\n");
}
