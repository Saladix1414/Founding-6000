import assert from "node:assert/strict";
import { Wallet } from "ethers";
import {
  createWalletChallenge,
  verifyWalletSignature,
} from "../../../cloudflare/nftWalletProof.mjs";

const owner = Wallet.createRandom();
const attacker = Wallet.createRandom();

const membershipId =
  "mem_11111111-2222-4333-8444-555555555555";

const now = Date.now();

const challenge = createWalletChallenge({
  membershipId,
  walletAddress: owner.address,
  origin: "https://founding.example.org",
  chainId: 8453,
  now,
});

const signature = await owner.signMessage(
  challenge.message,
);

assert.equal(
  verifyWalletSignature({
    challenge, signature, now: now + 1000,
  }),
  true,
);

console.log("VALID_WALLET_SIGNATURE=PASS");

assert.equal(
  verifyWalletSignature({
    challenge,
    signature: await attacker.signMessage(
      challenge.message,
    ),
    now: now + 1000,
  }),
  false,
);

console.log("WRONG_SIGNER_BLOCKED=PASS");

assert.equal(
  verifyWalletSignature({
    challenge, signature,
    now: Date.parse(challenge.expiresAt),
  }),
  false,
);

console.log("EXPIRED_CHALLENGE_BLOCKED=PASS");

for (const mutation of [
  { membershipId: "mem_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
  { walletAddress: attacker.address },
  { chainId: 84532 },
  { origin: "https://other.example.org" },
  { nonce: crypto.randomUUID() },
]) {
  assert.equal(
    verifyWalletSignature({
      challenge: { ...challenge, ...mutation },
      signature,
      now: now + 1000,
    }),
    false,
  );
}

console.log("CHALLENGE_TAMPERING_BLOCKED=PASS");

const second = createWalletChallenge({
  membershipId,
  walletAddress: owner.address,
  origin: "https://founding.example.org",
  chainId: 8453,
  now,
});

assert.notEqual(second.nonce, challenge.nonce);

console.log("NONCE_UNIQUENESS=PASS");

console.log("NFT_WALLET_CRYPTO_TEST=PASS");
console.log("WALLET_OWNERSHIP_NOT_PERSISTED=YES");
console.log("NO MINT AUTHORIZED.");
