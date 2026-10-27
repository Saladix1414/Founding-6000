import assert from "node:assert/strict";

import {
  getNftBaseSepoliaRpcPolicy,
} from "../../../cloudflare/nftMintRpcProviderPolicy.mjs";

import {
  createNftBaseSepoliaMockRpc,
} from "../../../cloudflare/nftMintRpcPolicyIntegration.mjs";

const policy = getNftBaseSepoliaRpcPolicy();

const config = {
  network: policy.network,
  chainId: policy.chainId,
  providerId: policy.providerId,
  endpoint: policy.endpoint,
  mode: "mock",
};

let requests = 0;

const fetchMock = async (url, options) => {
  requests++;

  assert.equal(url, "https://sepolia.base.org/");
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "error");
  assert.equal(options.credentials, "omit");
  assert.equal(options.cache, "no-store");

  const request = JSON.parse(options.body);

  assert.equal(request.jsonrpc, "2.0");
  assert.equal(request.method, "eth_chainId");
  assert.deepEqual(request.params, []);

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      result: "0x14a34",
    }),
    { status: 200 },
  );
};

const rpc = createNftBaseSepoliaMockRpc({
  config,
  mockFetch: fetchMock,
});

assert.equal(rpc.mode, "mock");
assert.equal(rpc.chainId, 84532);
assert.equal(rpc.liveRpcEnabled, false);
assert.equal(rpc.mintAuthority, false);
assert.equal(rpc.entitlementAuthority, false);
assert.equal(Object.isFrozen(rpc), true);

const chain = await rpc.send("eth_chainId", []);

assert.equal(chain, "0x14a34");
assert.equal(requests, 1);

console.log("MOCK_CHAIN_ID=PASS");
console.log("CANONICAL_ENDPOINT=PASS");

let rejected = 0;

function reject(name, candidate) {
  assert.throws(
    () => createNftBaseSepoliaMockRpc({
      config: candidate,
      mockFetch: fetchMock,
    }),
    /OX_NFT_RPC_POLICY_INTEGRATION_REJECTED/,
    name,
  );

  rejected++;
  console.log(name + "=PASS");
}

reject("LIVE_MODE_BLOCKED", {
  ...config,
  mode: "live",
});

reject("PRODUCTION_MODE_BLOCKED", {
  ...config,
  mode: "production",
});

reject("DISABLED_MODE_CANNOT_CREATE_TRANSPORT", {
  ...config,
  mode: "disabled",
});

reject("MAINNET_NETWORK_BLOCKED", {
  ...config,
  network: "base-mainnet",
});

reject("MAINNET_CHAIN_BLOCKED", {
  ...config,
  chainId: 8453,
});

reject("MAINNET_ENDPOINT_BLOCKED", {
  ...config,
  endpoint: "https://mainnet.base.org",
});

reject("UNAPPROVED_PROVIDER_BLOCKED", {
  ...config,
  providerId: "arbitrary-rpc",
});

reject("ARBITRARY_ENDPOINT_BLOCKED", {
  ...config,
  endpoint: "https://rpc.example.org",
});

reject("LOCALHOST_ENDPOINT_BLOCKED", {
  ...config,
  endpoint: "https://localhost",
});

reject("INSECURE_ENDPOINT_BLOCKED", {
  ...config,
  endpoint: "http://sepolia.base.org",
});

reject("URL_CREDENTIALS_BLOCKED", {
  ...config,
  endpoint: "https://user:pass@sepolia.base.org",
});

reject("QUERY_SECRET_BLOCKED", {
  ...config,
  endpoint: "https://sepolia.base.org/?key=secret",
});

reject("EXTRA_AUTHORITY_BLOCKED", {
  ...config,
  mintAuthority: true,
});

reject("EXTRA_ENDPOINT_OVERRIDE_BLOCKED", {
  ...config,
  fallbackEndpoint: "https://evil.example.org",
});

reject("MISSING_MODE_BLOCKED", {
  ...config,
  mode: undefined,
});

reject("STRING_CHAIN_BLOCKED", {
  ...config,
  chainId: "84532",
});

reject("NULL_CONFIG_BLOCKED", null);
reject("ARRAY_CONFIG_BLOCKED", []);
reject("EMPTY_CONFIG_BLOCKED", {});

assert.throws(
  () => createNftBaseSepoliaMockRpc({
    config,
  }),
  /OX_NFT_RPC_POLICY_INTEGRATION_REJECTED/,
);

rejected++;
console.log("MISSING_MOCK_FETCH_BLOCKED=PASS");

await assert.rejects(
  rpc.send("eth_sendTransaction", []),
  /OX_NFT_RPC_TRANSPORT_UNAVAILABLE/,
);

await assert.rejects(
  rpc.send("eth_sendRawTransaction", []),
  /OX_NFT_RPC_TRANSPORT_UNAVAILABLE/,
);

await assert.rejects(
  rpc.send("personal_sign", []),
  /OX_NFT_RPC_TRANSPORT_UNAVAILABLE/,
);

assert.equal(requests, 1);

console.log("WRITE_METHODS_BLOCKED=PASS");

assert.equal(rejected, 20);

console.log("POLICY_INTEGRATION_ATTACKS=20");
console.log("UNAPPROVED_ENDPOINTS=BLOCKED");
console.log("LIVE_RPC_MODE=BLOCKED");
console.log("NETWORK_REQUESTS=MOCK_ONLY");
console.log("NO_SIGNER=PASS");
console.log("NO_MINT_AUTHORITY=PASS");
console.log(
  "OX_NFT_MINT_LIFECYCLE_PART_5F_2_TEST=PASS"
);
