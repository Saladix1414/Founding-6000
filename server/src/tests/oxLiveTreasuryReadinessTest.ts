import assert from "node:assert/strict";

import {
  ALLOWED_LIVE_RPC_METHODS,
  assertReadOnlyRpcMethod,
  readLiveTreasuryReadiness,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "../web3/liveTreasuryReadiness.js";

const minter =
  "0x4444444444444444444444444444444444444444";

const calls: JsonRpcRequest[] = [];

async function mockTransport(
  request: JsonRpcRequest,
): Promise<JsonRpcResponse> {
  calls.push(request);

  if (
    request.method ===
    "eth_gasPrice"
  ) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: "0x3b9aca00"
    };
  }

  if (
    request.method ===
    "eth_getBalance"
  ) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result:
        "0xf77dd79000000"
    };
  }

  throw new Error(
    "UNEXPECTED_METHOD",
  );
}

const result =
  await readLiveTreasuryReadiness({
    minterAddress:
      minter,

    transport:
      mockTransport,
  });

assert.deepEqual(
  ALLOWED_LIVE_RPC_METHODS,
  [
    "eth_gasPrice",
    "eth_getBalance",
  ],
);

assert.equal(
  calls.length,
  2,
);

assert.equal(
  calls[0]?.method,
  "eth_gasPrice",
);

assert.equal(
  calls[1]?.method,
  "eth_getBalance",
);

assert.deepEqual(
  calls[1]?.params,
  [
    minter,
    "latest",
  ],
);

assert.equal(
  result.networkObservation
    .gasPriceWei,
  1_000_000_000n,
);

assert.equal(
  result.readiness
    .requiredBalanceWei,
  69_666_271_000_000_000n,
);

assert.equal(
  result.authority
    .fundingAuthorized,
  false,
);

assert.equal(
  result.authority
    .mintAuthorized,
  false,
);

assert.equal(
  result.authority
    .mainnetAuthorized,
  false,
);

assert.equal(
  result.authority
    .transactionSubmissionSupported,
  false,
);

assert.throws(
  () =>
    assertReadOnlyRpcMethod(
      "eth_sendTransaction",
    ),
  /RPC_METHOD_NOT_ALLOWED/,
);

assert.throws(
  () =>
    assertReadOnlyRpcMethod(
      "eth_sendRawTransaction",
    ),
  /RPC_METHOD_NOT_ALLOWED/,
);

assert.throws(
  () =>
    assertReadOnlyRpcMethod(
      "personal_sign",
    ),
  /RPC_METHOD_NOT_ALLOWED/,
);

await assert.rejects(
  () =>
    readLiveTreasuryReadiness({
      minterAddress:
        "0xINVALID",

      transport:
        mockTransport,
    }),
  /INVALID_MINTER_ADDRESS/,
);

console.log(
  "OX_LIVE_TREASURY_READINESS_TEST=PASS",
);

console.log(
  "RPC_METHOD_ETH_GAS_PRICE=ALLOWED",
);

console.log(
  "RPC_METHOD_ETH_GET_BALANCE=ALLOWED",
);

console.log(
  "RPC_WRITES_ALLOWED=NO",
);

console.log(
  "SIGNING_ALLOWED=NO",
);

console.log(
  "FUNDING_AUTHORIZED=false",
);

console.log(
  "MINT_AUTHORIZED=false",
);

console.log(
  "MAINNET_AUTHORIZED=false",
);
