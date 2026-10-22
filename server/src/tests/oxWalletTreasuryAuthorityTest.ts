import assert from "node:assert/strict";

import {
  WALLET_TREASURY_AUTHORITY_VERSION,
  assertWalletAuthorityState,
  validateWalletAuthorityState,
  type WalletAuthorityState,
} from "../web3/walletTreasuryAuthority.js";

const distinctState: WalletAuthorityState = {
  assignments: [
    {
      role: "PAYMENT_RECEIVER",
      address:
        "0x1111111111111111111111111111111111111111",
    },
    {
      role: "OPERATING_TREASURY",
      address:
        "0x2222222222222222222222222222222222222222",
    },
    {
      role: "RESERVE_VAULT",
      address:
        "0x3333333333333333333333333333333333333333",
    },
    {
      role: "NFT_MINTER",
      address:
        "0x4444444444444444444444444444444444444444",
    },
    {
      role: "ADMIN",
      address:
        "0x5555555555555555555555555555555555555555",
    },
  ],

  nftMintEnabled: false,
  reserveSweepEnabled: false,
  treasuryActionAuthorized: false,
  mainnetMintAuthorized: false,
};

assert.equal(
  WALLET_TREASURY_AUTHORITY_VERSION,
  "OX-WALLET-TREASURY-AUTHORITY-1",
);

assert.doesNotThrow(
  () =>
    assertWalletAuthorityState(
      distinctState,
    ),
);

const collisionState: WalletAuthorityState = {
  ...distinctState,
  assignments:
    distinctState.assignments.map(
      (entry) => {
        if (
          entry.role === "NFT_MINTER"
        ) {
          return {
            ...entry,
            address:
              "0x3333333333333333333333333333333333333333",
          };
        }

        return entry;
      },
    ),
};

const collision =
  validateWalletAuthorityState(
    collisionState,
  );

assert.equal(
  collision.valid,
  false,
);

assert.ok(
  collision.blockingReasons.includes(
    "ROLE_COLLISION:RESERVE_VAULT:NFT_MINTER",
  ),
);

const unsafeFlags =
  validateWalletAuthorityState({
    ...distinctState,
    nftMintEnabled: true,
    reserveSweepEnabled: true,
    treasuryActionAuthorized: true,
    mainnetMintAuthorized: true,
  });

assert.equal(
  unsafeFlags.valid,
  false,
);

assert.ok(
  unsafeFlags.blockingReasons.includes(
    "NFT_MINT_MUST_REMAIN_DISABLED",
  ),
);

assert.ok(
  unsafeFlags.blockingReasons.includes(
    "RESERVE_SWEEP_MUST_REMAIN_DISABLED",
  ),
);

assert.ok(
  unsafeFlags.blockingReasons.includes(
    "TREASURY_ACTION_MUST_REMAIN_UNAUTHORIZED",
  ),
);

assert.ok(
  unsafeFlags.blockingReasons.includes(
    "MAINNET_MINT_MUST_REMAIN_UNAUTHORIZED",
  ),
);

const nullAssignments: WalletAuthorityState = {
  assignments: [
    {
      role: "PAYMENT_RECEIVER",
      address: null,
    },
    {
      role: "OPERATING_TREASURY",
      address: null,
    },
    {
      role: "RESERVE_VAULT",
      address: null,
    },
    {
      role: "NFT_MINTER",
      address: null,
    },
    {
      role: "ADMIN",
      address: null,
    },
  ],

  nftMintEnabled: false,
  reserveSweepEnabled: false,
  treasuryActionAuthorized: false,
  mainnetMintAuthorized: false,
};

assert.doesNotThrow(
  () =>
    assertWalletAuthorityState(
      nullAssignments,
    ),
);

console.log(
  "OX_WALLET_TREASURY_AUTHORITY_TEST=PASS",
);

console.log(
  "ROLE_SEPARATION=ENFORCED",
);

console.log(
  "UNASSIGNED_ADDRESSES_ALLOWED=YES",
);

console.log(
  "NFT_MINT_ENABLED=false",
);

console.log(
  "RESERVE_SWEEP_ENABLED=false",
);

console.log(
  "TREASURY_ACTION_AUTHORIZED=false",
);

console.log(
  "MAINNET_MINT_AUTHORIZED=false",
);
