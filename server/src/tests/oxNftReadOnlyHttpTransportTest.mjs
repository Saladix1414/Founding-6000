import assert from "node:assert/strict";

import {
  createNftReadOnlyHttpTransport,
} from "../../../cloudflare/nftMintReadOnlyHttpTransport.mjs";

/*
 * Fully simulated fetch.
 * No real network, RPC endpoint or secrets.
 */

const ENDPOINT = "https://rpc.example.org/v1";

const options = {
  endpoint: ENDPOINT,
  allowedHostnames: ["rpc.example.org"],
  timeoutMs: 250,
  maxResponseBytes: 1024,
};

function response(payload, init = {}) {
  return new Response(
    JSON.stringify(payload),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
      ...init,
    },
  );
}

function validPayload(id, result = "0x14a34") {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function transport(fetchImpl) {
  return createNftReadOnlyHttpTransport({
    ...options,
    fetchImpl,
  });
}

let checks = 0;

function pass(name) {
  checks++;
  console.log(name + "=PASS");
}

async function rejected(name, fetchImpl) {
  const rpc = transport(fetchImpl);

  await assert.rejects(
    rpc.send("eth_chainId", []),
    /OX_NFT_RPC_TRANSPORT_UNAVAILABLE/,
    name,
  );

  pass(name);
}

function configRejected(name, overrides) {
  assert.throws(
    () => createNftReadOnlyHttpTransport({
      ...options,
      fetchImpl: async () => {
        throw Error("NETWORK_MUST_NOT_RUN");
      },
      ...overrides,
    }),
    /OX_NFT_RPC_TRANSPORT_UNAVAILABLE/,
    name,
  );

  pass(name);
}

/* 1. Valid JSON-RPC round trip */

let requests = 0;

const valid = transport(async (url, init) => {
  requests++;

  assert.equal(url, ENDPOINT);
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "error");
  assert.equal(init.credentials, "omit");
  assert.equal(init.cache, "no-store");

  const request = JSON.parse(init.body);

  assert.equal(request.jsonrpc, "2.0");
  assert.equal(request.method, "eth_chainId");
  assert.deepEqual(request.params, []);
  assert.equal(typeof request.id, "number");

  return response(validPayload(request.id));
});

assert.equal(
  await valid.send("eth_chainId", []),
  "0x14a34",
);

assert.equal(requests, 1);
pass("VALID_JSON_RPC_RESPONSE");

/* 2. Forbidden write methods */

for (const method of [
  "eth_sendTransaction",
  "eth_sendRawTransaction",
  "personal_sign",
  "eth_sign",
  "wallet_sendCalls",
]) {
  await assert.rejects(
    valid.send(method, []),
    /OX_NFT_RPC_TRANSPORT_UNAVAILABLE/,
  );
}

assert.equal(requests, 1);
pass("WRITE_METHODS_BLOCKED_BEFORE_FETCH");

/* 3. Invalid parameter shape */

await assert.rejects(
  valid.send("eth_chainId", {}),
  /OX_NFT_RPC_TRANSPORT_UNAVAILABLE/,
);

assert.equal(requests, 1);
pass("INVALID_PARAMS_BLOCKED");

/* 4. Unexpected HTTP error */

await rejected(
  "HTTP_500",
  async () => new Response(
    "Internal error",
    { status: 500 },
  ),
);

/* 5. Redirect, without following it */

await rejected(
  "HTTP_REDIRECT_REJECTED",
  async (_url, init) => {
    assert.equal(init.redirect, "error");

    return new Response(null, {
      status: 302,
      headers: {
        location: "https://evil.example.org/",
      },
    });
  },
);

/* 6. Malformed JSON */

await rejected(
  "INVALID_JSON_REJECTED",
  async () => new Response(
    '{"jsonrpc":',
    { status: 200 },
  ),
);

/* 7. Invalid UTF-8 */

await rejected(
  "INVALID_UTF8_REJECTED",
  async () => new Response(
    new Uint8Array([0xff, 0xfe]),
    { status: 200 },
  ),
);

/* 8. Invalid JSON-RPC version */

await rejected(
  "WRONG_JSON_RPC_VERSION",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response({
      jsonrpc: "1.0",
      id,
      result: "0x14a34",
    });
  },
);

/* 9. Forged request ID */

await rejected(
  "FORGED_RESPONSE_ID",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response(
      validPayload(id + 1),
    );
  },
);

/* 10. Incorrect ID type */

await rejected(
  "STRING_RESPONSE_ID",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response(
      validPayload(String(id)),
    );
  },
);

/* 11. RPC error response */

await rejected(
  "RPC_ERROR_OBJECT_REJECTED",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: "Untrusted node error",
      },
    });
  },
);

/* 12. Missing result */

await rejected(
  "MISSING_RESULT_REJECTED",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response({
      jsonrpc: "2.0",
      id,
    });
  },
);

/* 13. JSON array instead of object */

await rejected(
  "BATCH_RESPONSE_REJECTED",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response([
      validPayload(id),
    ]);
  },
);

/* 14. Missing response stream */

await rejected(
  "MISSING_BODY_STREAM",
  async () => ({
    ok: true,
    body: null,
    headers: new Headers(),
  }),
);

/* 15. Content-Length over limit */

await rejected(
  "CONTENT_LENGTH_TOO_LARGE",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response(
      validPayload(id),
      {
        headers: {
          "content-length": "2048",
        },
      },
    );
  },
);

/* 16. Actual body exceeds size limit */

await rejected(
  "STREAM_EXCEEDS_SIZE_LIMIT",
  async () => new Response(
    new Uint8Array(2048),
    { status: 200 },
  ),
);

/* 17. Invalid Content-Length */

await rejected(
  "MALFORMED_CONTENT_LENGTH",
  async (_url, init) => {
    const { id } = JSON.parse(init.body);

    return response(
      validPayload(id),
      {
        headers: {
          "content-length": "invalid",
        },
      },
    );
  },
);

/* 18. Fetch rejects */

await rejected(
  "FETCH_NETWORK_FAILURE",
  async () => {
    throw Error("SIMULATED_NETWORK_FAILURE");
  },
);

/* 19. Timeout */

let aborted = false;

await rejected(
  "HTTP_TIMEOUT",
  (_url, init) => new Promise(
    (_resolve, reject) => {
      const abort = () => {
        aborted = true;
        reject(Error("ABORTED"));
      };

      if (init.signal.aborted) {
        abort();
      } else {
        init.signal.addEventListener(
          "abort",
          abort,
          { once: true },
        );
      }
    },
  ),
);

assert.equal(aborted, true);
pass("TIMEOUT_SIGNAL_CONFIRMED");

/* 20. No approval for insecure HTTP */

configRejected(
  "HTTP_ENDPOINT_BLOCKED",
  {
    endpoint: "http://rpc.example.org/v1",
  },
);

/* 21. Unapproved hostname */

configRejected(
  "UNAPPROVED_HOST_BLOCKED",
  {
    endpoint: "https://evil.example.org/",
  },
);

/* 22. URL-embedded credentials */

configRejected(
  "EMBEDDED_CREDENTIALS_BLOCKED",
  {
    endpoint: "https://user:secret@rpc.example.org/",
  },
);

/* 23. URL query secrets */

configRejected(
  "QUERY_CREDENTIALS_BLOCKED",
  {
    endpoint: "https://rpc.example.org/?key=secret",
  },
);

/* 24. Localhost */

configRejected(
  "LOCALHOST_BLOCKED",
  {
    endpoint: "https://localhost/",
    allowedHostnames: ["localhost"],
  },
);

/* 25. Nonstandard port */

configRejected(
  "NONSTANDARD_PORT_BLOCKED",
  {
    endpoint: "https://rpc.example.org:8545/",
  },
);

/* 26. Invalid timeout */

configRejected(
  "INVALID_TIMEOUT_BLOCKED",
  {
    timeoutMs: 0,
  },
);

/* 27. Invalid size cap */

configRejected(
  "INVALID_RESPONSE_LIMIT_BLOCKED",
  {
    maxResponseBytes: 0,
  },
);

/* 28. Missing hostname allowlist */

configRejected(
  "MISSING_HOST_ALLOWLIST_BLOCKED",
  {
    allowedHostnames: [],
  },
);

assert.equal(
  Object.isFrozen(valid),
  true,
);

console.log("HTTP_SECURITY_CHECKS=" + checks);
console.log("HTTP_ADVERSARIAL_SUITE=PASS");
console.log("LIVE_NETWORK_REQUESTS=NONE");
console.log("REAL_RPC_ENDPOINT=NONE");
console.log("TRANSACTIONS_SIGNED=NO");
console.log("TRANSACTIONS_SUBMITTED=NO");
console.log("OX_NFT_MINT_LIFECYCLE_PART_5D_2_TEST=PASS");
