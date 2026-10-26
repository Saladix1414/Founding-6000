import assert from "node:assert/strict";
import {
  Interface, Wallet, ZeroAddress, id,
} from "ethers";
import {
  verifyBaseSepoliaMintRpcEvidence,
} from "../../../cloudflare/nftMintRpcEvidenceAdapter.mjs";

const abi = new Interface([
  "function mint(address,uint256)",
  "function ownerOf(uint256) view returns(address)",
  "function hasRole(bytes32,address) view returns(bool)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
]);

const contract = Wallet.createRandom().address;
const recipient = Wallet.createRandom().address;
const minter = Wallet.createRandom().address;
const txHash = "0x" + "a".repeat(64);
const blockHash = "0x" + "b".repeat(64);
const role = id("MINTER_ROLE");

const ev = abi.encodeEventLog("Transfer", [
  ZeroAddress, recipient, 6000n,
]);

const tx = {
  hash: txHash,
  blockHash,
  blockNumber: "0x64",
  chainId: "0x14a34",
  from: minter,
  to: contract,
  input: abi.encodeFunctionData("mint", [
    recipient, 6000n,
  ]),
  value: "0x0",
};

const receipt = {
  transactionHash: txHash,
  blockHash,
  blockNumber: "0x64",
  from: minter,
  to: contract,
  status: "0x1",
  logs: [{
    address: contract,
    topics: ev.topics,
    data: ev.data,
  }],
};

const methods = [
  "eth_chainId",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_call",
];

function makeRpc(fault = "", occurrence = 1, override) {
  const counts = new Map();

  return {
    async send(method, params) {
      assert.ok(methods.includes(method));

      const n = (counts.get(method) ?? 0) + 1;
      counts.set(method, n);

      if (fault === method && n === occurrence) {
        if (override !== undefined) return override;
        throw new Error("SIMULATED_RPC_FAILURE");
      }

      switch (method) {
        case "eth_chainId":
          return "0x14a34";
        case "eth_getTransactionByHash":
          return tx;
        case "eth_getTransactionReceipt":
          return receipt;
        case "eth_blockNumber":
          return "0x66";
        case "eth_getBlockByNumber":
          assert.deepEqual(params, ["0x64", false]);
          return {number: "0x64", hash: blockHash};
        case "eth_getCode":
          assert.equal(params[0], contract);
          assert.deepEqual(params[1], {
            blockHash, requireCanonical: true,
          });
          return "0x60006000";
        case "eth_call": {
          assert.equal(params[0].to, contract);
          assert.deepEqual(params[1], {
            blockHash, requireCanonical: true,
          });
          const decoded = abi.parseTransaction({
            data: params[0].data,
          });
          if (decoded.name === "ownerOf") {
            assert.equal(decoded.args[0], 6000n);
            return abi.encodeFunctionResult(
              "ownerOf", [recipient],
            );
          }
          assert.equal(decoded.name, "hasRole");
          assert.equal(decoded.args[0], role);
          assert.equal(decoded.args[1], minter);
          return abi.encodeFunctionResult(
            "hasRole", [true],
          );
        }
        default:
          throw new Error("RPC_METHOD_BLOCKED");
      }
    },
  };
}

const input = {
  contractAddress: contract,
  transactionHash: txHash,
  recipient,
  tokenId: 6000,
  minConfirmations: 3,
};

const valid = await verifyBaseSepoliaMintRpcEvidence({
  ...input,
  rpc: makeRpc(),
});

assert.equal(valid.rpcChecksPassed, true);
assert.equal(valid.mintAuthority, false);
assert.equal(valid.entitlementActivated, false);
assert.equal(valid.transactionSubmitted, false);
console.log("VALID_RPC_BASELINE=PASS");

let count = 0;

async function blocked(name, method, occurrence, override) {
  await assert.rejects(
    verifyBaseSepoliaMintRpcEvidence({
      ...input,
      rpc: makeRpc(method, occurrence, override),
    }),
    /NFT_MINT_RPC_EVIDENCE_UNAVAILABLE|NFT_MINT_RECEIPT_EVIDENCE_UNAVAILABLE/,
    name,
  );
  count++;
  console.log(name + "=PASS");
}

for (const method of methods) {
  await blocked(
    "RPC_FAILURE_" + method,
    method, 1,
  );
}

await blocked(
  "SECOND_BLOCK_READ_FAILURE",
  "eth_getBlockByNumber", 2,
);
await blocked(
  "ROLE_READ_FAILURE",
  "eth_call", 2,
);
await blocked(
  "NULL_CHAIN_ID",
  "eth_chainId", 1, null,
);
await blocked(
  "NULL_TRANSACTION",
  "eth_getTransactionByHash", 1, null,
);
await blocked(
  "NULL_RECEIPT",
  "eth_getTransactionReceipt", 1, null,
);
await blocked(
  "INVALID_LATEST_BLOCK",
  "eth_blockNumber", 1, "invalid",
);
await blocked(
  "EMPTY_CONTRACT_CODE",
  "eth_getCode", 1, "0x",
);
await blocked(
  "INVALID_CONTRACT_CALL",
  "eth_call", 1, "0x",
);

assert.equal(count, 15);
console.log("RPC_FAULT_CASES=15");
console.log("RPC_FAIL_CLOSED=PASS");
console.log("REAL_RPC_REQUESTS=NONE");
console.log("REAL_MINT=NO");
console.log("OX_NFT_MINT_LIFECYCLE_PART_5B_3_TEST=PASS");
