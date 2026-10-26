import assert from "node:assert/strict";
import {
  Interface,
  Wallet,
  ZeroAddress,
} from "ethers";

import {
  verifyNftMintReceiptEvidence,
} from "../../../cloudflare/nftMintReceiptEvidence.mjs";

const abi = new Interface([
  "function mint(address to,uint256 tokenId)",
  "function transferFrom(address from,address to,uint256 tokenId)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
]);

const contract = Wallet.createRandom().address;
const wallet = Wallet.createRandom().address;
const attacker = Wallet.createRandom().address;

const hash = "0x" + "a".repeat(64);

function event(from, to, tokenId = 6000n) {
  const encoded = abi.encodeEventLog(
    "Transfer",
    [from, to, tokenId],
  );

  return {
    address: contract,
    topics: encoded.topics,
    data: encoded.data,
  };
}

const valid = {
  chainId: 84532,
  contractAddress: contract,
  recipient: wallet,
  tokenId: 6000,
  transaction: {
    hash,
    to: contract,
    chainId: 84532,
    value: 0n,
    data: abi.encodeFunctionData(
      "mint",
      [wallet, 6000n],
    ),
  },
  receipt: {
    transactionHash: hash,
    to: contract,
    status: 1,
    blockNumber: 100,
    logs: [
      event(ZeroAddress, wallet),
    ],
  },
  ownerAddress: wallet,
  latestBlockNumber: 102,
  minConfirmations: 3,
};

let rejectedCount = 0;

function reject(name, changes) {
  assert.throws(
    () => verifyNftMintReceiptEvidence({
      ...valid,
      ...changes,
    }),
    /NFT_MINT_RECEIPT_EVIDENCE_UNAVAILABLE/,
    name,
  );

  rejectedCount++;
  console.log(name + "=PASS");
}

const evidence = verifyNftMintReceiptEvidence(valid);

assert.equal(evidence.evidenceConsistent, true);
assert.equal(evidence.independentlyAuthenticated, false);
assert.equal(evidence.chainId, 84532);
assert.equal(evidence.tokenId, 6000);
assert.equal(evidence.recipient, wallet);
assert.equal(evidence.confirmations, 3);
assert.equal(evidence.mintAuthority, false);
assert.equal(evidence.transactionSubmitted, false);
assert.equal(evidence.entitlementActivated, false);
assert.equal(
  evidence.status,
  "EVIDENCE_CONSISTENT_ONLY",
);
assert.equal(Object.isFrozen(evidence), true);

console.log("VALID_RECEIPT_EVIDENCE=PASS");

reject("WRONG_NETWORK", {
  chainId: 8453,
});

reject("WRONG_TRANSACTION_NETWORK", {
  transaction: {
    ...valid.transaction,
    chainId: 8453,
  },
});

reject("WRONG_CONTRACT", {
  contractAddress: attacker,
});

reject("WRONG_TRANSACTION_TARGET", {
  transaction: {
    ...valid.transaction,
    to: attacker,
  },
});

reject("WRONG_RECEIPT_TARGET", {
  receipt: {
    ...valid.receipt,
    to: attacker,
  },
});

reject("FAILED_TRANSACTION", {
  receipt: {
    ...valid.receipt,
    status: 0,
  },
});

reject("HASH_MISMATCH", {
  receipt: {
    ...valid.receipt,
    transactionHash: "0x" + "b".repeat(64),
  },
});

reject("INVALID_HASH", {
  transaction: {
    ...valid.transaction,
    hash: "invalid",
  },
});

reject("INSUFFICIENT_CONFIRMATIONS", {
  latestBlockNumber: 101,
});

reject("FUTURE_RECEIPT_BLOCK", {
  latestBlockNumber: 99,
});

reject("WRONG_OWNER", {
  ownerAddress: attacker,
});

reject("TOKEN_ZERO", {
  tokenId: 0,
});

reject("TOKEN_OVER_SUPPLY", {
  tokenId: 6001,
});

reject("TOKEN_SUBSTITUTION", {
  tokenId: 5999,
});

reject("RECIPIENT_SUBSTITUTION", {
  recipient: attacker,
});

reject("CALLDATA_SUBSTITUTION", {
  transaction: {
    ...valid.transaction,
    data: abi.encodeFunctionData(
      "mint",
      [attacker, 6000n],
    ),
  },
});

reject("WRONG_FUNCTION", {
  transaction: {
    ...valid.transaction,
    data: abi.encodeFunctionData(
      "transferFrom",
      [attacker, wallet, 6000n],
    ),
  },
});

reject("MISSING_MINT_EVENT", {
  receipt: {
    ...valid.receipt,
    logs: [],
  },
});

reject("SECONDARY_TRANSFER_NOT_MINT", {
  receipt: {
    ...valid.receipt,
    logs: [
      event(attacker, wallet),
    ],
  },
});

reject("FAKE_EVENT_CONTRACT", {
  receipt: {
    ...valid.receipt,
    logs: [
      {
        ...event(ZeroAddress, wallet),
        address: attacker,
      },
    ],
  },
});

reject("DUPLICATE_MINT_EVENT", {
  receipt: {
    ...valid.receipt,
    logs: [
      event(ZeroAddress, wallet),
      event(ZeroAddress, wallet),
    ],
  },
});

reject("NONZERO_NATIVE_VALUE", {
  transaction: {
    ...valid.transaction,
    value: 1n,
  },
});

assert.equal(rejectedCount, 22);

const repeated = verifyNftMintReceiptEvidence(valid);

assert.deepEqual(repeated, evidence);

console.log("DETERMINISTIC_EVIDENCE=PASS");
console.log("ADVERSARIAL_CASES=22");
console.log("ALL_ATTACKS_REJECTED=PASS");

console.log("EVIDENCE_AUTHENTICATED=NO");
console.log("RPC_CALLS=NONE");
console.log("DATABASE_WRITES=NONE");
console.log("MINT_AUTHORITY=NONE");
console.log("ENTITLEMENT_ACTIVATED=NO");
console.log("REAL_MINT=NO");

console.log(
  "OX_NFT_MINT_LIFECYCLE_PART_4B=PASS"
);
