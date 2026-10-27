/*
 * OriginX — Read-only JSON-RPC HTTP Transport.
 *
 * No default endpoint.
 * No credentials or signer.
 * No connection on construction.
 * No database or entitlement authority.
 *
 * Trusted operators must explicitly provide
 * an approved HTTPS hostname.
 */

const METHODS = new Set([
  "eth_chainId",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_call",
]);

function fail() {
  throw new Error("OX_NFT_RPC_TRANSPORT_UNAVAILABLE");
}

function validHostname(hostname) {
  return (
    typeof hostname === "string" &&
    hostname.length <= 253 &&
    hostname.length > 0 &&
    /^[a-z0-9.-]+$/.test(hostname) &&
    !hostname.startsWith(".") &&
    !hostname.endsWith(".") &&
    !hostname.includes("..") &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(hostname) &&
    hostname !== "localhost" &&
    !hostname.endsWith(".localhost")
  );
}

export function createNftReadOnlyHttpTransport({
  endpoint,
  allowedHostnames,
  timeoutMs = 5000,
  maxResponseBytes = 262144,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (
    typeof endpoint !== "string" ||
    !Array.isArray(allowedHostnames) ||
    allowedHostnames.length === 0 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 15000 ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1024 ||
    maxResponseBytes > 1048576 ||
    typeof fetchImpl !== "function"
  ) {
    fail();
  }

  let url;

  try {
    url = new URL(endpoint);

    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      (url.port !== "" && url.port !== "443") ||
      !validHostname(url.hostname)
    ) {
      fail();
    }

    const approved = allowedHostnames.map(
      hostname => {
        if (
          typeof hostname !== "string" ||
          !validHostname(hostname) ||
          hostname !== hostname.toLowerCase()
        ) {
          fail();
        }

        return hostname;
      },
    );

    if (!approved.includes(url.hostname)) {
      fail();
    }
  } catch {
    fail();
  }

  let nextId = 0;

  async function send(method, params) {
    if (
      !METHODS.has(method) ||
      !Array.isArray(params)
    ) {
      fail();
    }

    let serialized;

    try {
      serialized = JSON.stringify(params);

      if (
        typeof serialized !== "string" ||
        serialized.length > 16384
      ) {
        fail();
      }
    } catch {
      fail();
    }

    const id = ++nextId;

    if (!Number.isSafeInteger(id)) fail();

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      timeoutMs,
    );

    try {
      const response = await fetchImpl(
        url.href,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "accept": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method,
            params: JSON.parse(serialized),
            id,
          }),
          signal: controller.signal,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
        },
      );

      if (
        !response ||
        response.ok !== true ||
        !response.body ||
        typeof response.body.getReader !== "function"
      ) {
        fail();
      }

      const header = response.headers?.get(
        "content-length",
      );

      if (header !== null && header !== undefined) {
        if (
          !/^\d+$/.test(header) ||
          Number(header) > maxResponseBytes
        ) {
          fail();
        }
      }

      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          if (!(value instanceof Uint8Array)) {
            fail();
          }

          total += value.byteLength;

          if (total > maxResponseBytes) {
            fail();
          }

          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const bytes = new Uint8Array(total);
      let position = 0;

      for (const chunk of chunks) {
        bytes.set(chunk, position);
        position += chunk.byteLength;
      }

      const payload = JSON.parse(
        new TextDecoder(
          "utf-8",
          { fatal: true },
        ).decode(bytes),
      );

      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        payload.jsonrpc !== "2.0" ||
        payload.id !== id ||
        Object.hasOwn(payload, "error") ||
        !Object.hasOwn(payload, "result")
      ) {
        fail();
      }

      return payload.result;
    } catch {
      fail();
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({ send });
}
