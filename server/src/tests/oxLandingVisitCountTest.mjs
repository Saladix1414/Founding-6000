import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { url: "data:text/javascript,export class DurableObject {}", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { default: worker, FoundingCore } = await import("../../../cloudflare/worker.mjs");
hook.deregister();

const db = new DatabaseSync(":memory:");
const storage = {
  sql: {
    exec(statement, ...bindings) {
      const query = db.prepare(statement);
      if (query.columns().length) return { toArray: () => query.all(...bindings) };
      if (bindings.length) query.run(...bindings);
      else db.exec(statement);
    },
  },
};

let core = new FoundingCore({ storage }, {});
const env = {
  ASSETS: {
    fetch(request) {
      const missing = new URL(request.url).searchParams.has("missing");
      return new Response("<html></html>", {
        status: missing ? 404 : 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  },
  FOUNDING_CORE: {
    idFromName: name => name,
    get: () => ({ fetch: (url, options) => core.fetch(new Request(url, options)) }),
  },
};
const pending = [];
const ctx = { waitUntil: promise => pending.push(promise) };
const request = (path, options) => worker.fetch(new Request("https://founding.test" + path, options), env, ctx);
const visits = async () => {
  const response = await request("/api/visits");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  return (await response.json()).total;
};

assert.equal(await visits(), 0);
const navigation = { headers: { "Sec-Fetch-Dest": "document" } };
await Promise.all(Array.from({ length: 25 }, () => request("/", navigation)));
await request("/?campaign=founding", { headers: { Accept: "text/html" } });
await request("/", { ...navigation, method: "HEAD" });
await request("/?missing", navigation);
await request("/whitepaper", navigation);
await request("/assets/logo.svg");
await request("/", { headers: { "Sec-Fetch-Dest": "empty", Accept: "text/html" } });
await request("/", { headers: { ...navigation.headers, "Sec-Purpose": "prefetch;prerender" } });
assert.equal((await request("/api/visits", { method: "POST" })).status, 405);
await Promise.all(pending);
assert.equal(pending.length, 26);
assert.equal(await visits(), 26);
assert.equal(await visits(), 26);

core = new FoundingCore({ storage }, {});
assert.equal(await visits(), 26);
env.FOUNDING_CORE.get = () => { throw new Error("offline"); };
assert.equal((await request("/api/visits")).status, 503);
assert.equal((await request("/", navigation)).status, 200);
await Promise.all(pending);
db.close();
console.log("LANDING_VISITS_PERSIST_AND_COUNT_ONLY_SUCCESSFUL_DOCUMENT_LOADS=PASS");
