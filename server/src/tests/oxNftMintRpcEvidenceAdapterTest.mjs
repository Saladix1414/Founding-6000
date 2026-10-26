import assert from "node:assert/strict";
import {
  Interface,
  Wallet,
  ZeroAddress,
  id,
} from "ethers";

import {
  verifyBaseSepoliaMintRpcEvidence,
} from "../../../cloudflare/nftMintRpcEvidenceAdapter.mjs";

/*
 * All responses are local simulation data.
 * No network connection, real NFT or real RPC.
 */

const abi = new Interface([
  "function mint(address to,uint256 tokenId)",
  "function ownerOf(uint256) view returns(address)",
  "function hasRole(bytes32,address) view returns(bool)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
]);

const contract = Wallet.createRandom().address;
const wallet = Wallet.createRandom().address;
const minter = Wallet.createRandom().address;
const attacker = Wallet.createRandom().address;

const hash = "0x" + "a".repeat(64);
const blockHash = "0x" + "b".repeat(64);
const otherHash = "0x" + "c".repeat(64);
const role = id("MINTER_ROLE");

const transfer = abi.encodeEventLog(
  "Transfer",
  [ZeroAddress, wallet, 6000n],
);

function baseline() {
  return {
    chain: "0x14a34",
    latest: "0x66",
    tx: {
      hash,
      blockHash,
      blockNumber: "0x64",
      chainId: "0x14a34",
      from: minter,
      to: contract,
      input: abi.encodeFunctionData(
        "mint", [wallet, 6000n],
      ),
      value: "0x0",
    },
    receipt: {
      transactionHash: hash,
      blockHash,
      blockNumber: "0x64",
      from: minter,
      to: contract,
      status: "0x1",
      logs: [{
        address: contract,
        topics: transfer.topics,
        data: transfer.data,
      }],
    },
    block: {
      number: "0x64",
      hash: blockHash,
    },
    code: "0x60006000",
    owner: wallet,
    hasRole: true,
    reorganize: false,
  };
}

const expectedMethods = new Set([
  "eth_chainId",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_call",
]);

function mock(settings = {}) {
  const state = {
    ...baseline(),
    ...settings,
  };

  const calls = [];
  let blockReads = 0;

  const rpc = {
    async send(method, params) {
      assert.ok(
        expectedMethods.has(method),
        "UNEXPECTED_RPC_METHOD:" + method,
      );

      calls.push({ method, params });

      switch (method) {
        case "eth_chainId":
          return state.chain;

        case "eth_getTransactionByHash":
          assert.equal(params[0], hash);
          return state.tx;

        case "eth_getTransactionReceipt":
          assert.equal(params[0], hash);
          return state.receipt;

        case "eth_blockNumber":
          return state.latest;

        case "eth_getBlockByNumber":
          assert.equal(params[0], "0x64");
          assert.equal(params[1], false);
          blockReads++;
          return (
            state.reorganize && blockReads > 1
              ? { ...state.block, hash: otherHash }
              : state.block
          );

        case "eth_getCode":
          assert.equal(params[0], contract);
          assert.deepEqual(params[1], {
            blockHash,
            requireCanonical: true,
          });
          return state.code;

        case "eth_call": {
          const [call, pinned] = params;

          assert.equal(call.to, contract);
          assert.deepEqual(pinned, {
            blockHash,
            requireCanonical: true,
          });

          const parsed = abi.parseTransaction({
            data: call.data,
          });

          if (parsed.name === "ownerOf") {
            assert.equal(parsed.args[0], 6000n);
            return abi.encodeFunctionResult(
              "ownerOf",
              [state.owner],
            );
          }

          if (parsed.name === "hasRole") {
            assert.equal(parsed.args[0], role);
            assert.equal(parsed.args[1], minter);

            return abi.encodeFunctionResult(
              "hasRole",
              [state.hasRole],
            );
          }

          throw new Error("UNEXPECTED_CONTRACT_CALL");
        }

        default:
          throw new Error("RPC_NOT_ALLOWED");
      }
    },
  };

  return { rpc, calls };
}

const input = {
  contractAddress: contract,
  transactionHash: hash,
  recipient: wallet,
  tokenId: 6000,
  minConfirmations: 3,
};

const good = mock();

const evidence = await verifyBaseSepoliaMintRpcEvidence({
  ...input,
  rpc: good.rpc,
});

assert.equal(evidence.rpcChecksPassed, true);
assert.equal(
  evidence.rpcSourceIndependentlyVerified,
  false,
);
assert.equal(evidence.minterRoleAtReceiptBlock, true);
assert.equal(evidence.ownerAtReceiptBlock, wallet);
assert.equal(evidence.confirmations, 3);
assert.equal(evidence.transactionSubmitted, false);
assert.equal(evidence.entitlementActivated, false);
assert.equal(evidence.mintAuthority, false);

assert.equal(
  good.calls.filter(
    c => c.method === "eth_getBlockByNumber",
  ).length,
  2,
);

assert.equal(
  good.calls.filter(
    c => c.method === "eth_call",
  ).length,
  2,
);

console.log("VALID_READ_ONLY_RPC_EVIDENCE=PASS");
console.log("BLOCK_HASH_PINNING=PASS");

let attacks = 0;

async function reject(name, changes, inputChanges = {}) {
  const { rpc } = mock(changes);

  await assert.rejects(
    verifyBaseSepoliaMintRpcEvidence({
      ...input,
      ...inputChanges,
      rpc,
    }),
    /NFT_MINT_RPC_EVIDENCE_UNAVAILABLE|NFT_MINT_RECEIPT_EVIDENCE_UNAVAILABLE/,
    name,
  );

  attacks++;
  console.log(name + "=PASS");
}

await reject("WRONG_CHAIN", {
  chain: "0x2105",
});

await reject("WRONG_TX_CHAIN", {
  tx: {
    ...baseline().tx,
    chainId: "0x2105",
  },
});

await reject("MISSING_TRANSACTION", {
  tx: null,
});

await reject("MISSING_RECEIPT", {
  receipt: null,
});

await reject("FAILED_TRANSACTION", {
  receipt: {
    ...baseline().receipt,
    status: "0x0",
  },
});

await reject("RECEIPT_HASH_MISMATCH", {
  receipt: {
    ...baseline().receipt,
    transactionHash: otherHash,
  },
});

await reject("TRANSACTION_BLOCK_MISMATCH", {
  tx: {
    ...baseline().tx,
    blockHash: otherHash,
  },
});

await reject("BLOCK_CANONICALITY_MISMATCH", {
  block: {
    number: "0x64",
    hash: otherHash,
  },
});

await reject("CHAIN_REORGANIZATION", {
  reorganize: true,
});

await reject("INSUFFICIENT_CONFIRMATIONS", {
  latest: "0x65",
});

await reject("EMPTY_CONTRACT_CODE", {
  code: "0x",
});

await reject("WRONG_OWNER", {
  owner: attacker,
});

await reject("MINTER_ROLE_REVOKED", {
  hasRole: false,
});

await reject("WRONG_RECIPIENT", {}, {
  recipient: attacker,
});

await reject("WRONG_TOKEN", {}, {
  tokenId: 5999,
});

await reject("INVALID_TOKEN_ZERO", {}, {
  tokenId: 0,
});

await reject("INVALID_TOKEN_OVER_SUPPLY", {}, {
  tokenId: 6001,
});

await reject("INVALID_TRANSACTION_HASH", {}, {
  transactionHash: "invalid",
});

await reject("DIFFERENT_CONFIGURED_CONTRACT", {}, {
  contractAddress: attacker,
});

await reject("MISSING_TRANSFER_EVENT", {
  receipt: {
    ...baseline().receipt,
    logs: [],
  },
});

await reject("DUPLICATE_TRANSFER_EVENT", {
  receipt: {
    ...baseline().receipt,
    logs: [
      ...baseline().receipt.logs,
      ...baseline().receipt.logs,
    ],
  },
});

const noTransport = {
  ...input,
  rpc: null,
};

await assert.rejects(
  verifyBaseSepoliaMintRpcEvidence(noTransport),
  /NFT_MINT_RPC_EVIDENCE_UNAVAILABLE/,
);

attacks++;
console.log("MISSING_RPC_TRANSPORT=PASS");

assert.equal(attacks, 22);

console.log("RPC_ADVERSARIAL_CASES=22");
console.log("RPC_ATTACKS_BLOCKED=PASS");
console.log("READ_ONLY_METHODS=VERIFIED");
console.log("NETWORK_REQUESTS=NONE");
console.log("TRANSACTIONS_SIGNED=NO");
console.log("TRANSACTIONS_SENT=NO");
console.log("DATABASE_WRITES=NONE");

console.log("OX_NFT_MINT_LIFECYCLE_PART_5B_2=PASS");
