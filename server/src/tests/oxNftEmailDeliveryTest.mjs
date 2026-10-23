import assert from "node:assert/strict";
import {
  sendBuyerVerificationEmail,
} from "../../../cloudflare/nftEmailDelivery.mjs";

const input = {
  apiKey: "re_test_placeholder_not_real",
  from: "verify@example.org",
  to: "buyer@example.org",
  code: "a".repeat(32),
  challengeId: "11111111-2222-4333-8444-555555555555",
};

let calls = 0;

const accepted = await sendBuyerVerificationEmail({
  ...input,
  fetcher: async (url, options) => {
    calls++;

    assert.equal(
      url, "https://api.resend.com/emails"
    );
    assert.equal(options.method, "POST");
    assert.equal(
      options.headers["Idempotency-Key"],
      `originx-buyer-${input.challengeId}`,
    );

    const body = JSON.parse(options.body);

    assert.deepEqual(body.to, [input.to]);
    assert.ok(body.text.includes(input.code));
    assert.ok(body.text.includes("30 minutos"));

    return Response.json({
      id: "test-email-001",
    });
  },
});

assert.equal(accepted.accepted, true);
assert.equal(calls, 1);
console.log("EMAIL_PROVIDER_ACCEPTED=PASS");

await assert.rejects(
  sendBuyerVerificationEmail({
    ...input,
    apiKey: "",
    fetcher: async () => {
      throw new Error("NETWORK_MUST_NOT_RUN");
    },
  }),
  /NFT_EMAIL_NOT_CONFIGURED/,
);

console.log("MISSING_SECRET_FAIL_CLOSED=PASS");

await assert.rejects(
  sendBuyerVerificationEmail({
    ...input,
    fetcher: async () =>
      new Response("provider secret details", {
        status: 429,
      }),
  }),
  /NFT_EMAIL_DELIVERY_FAILED/,
);

console.log("PROVIDER_ERROR_REDACTED=PASS");

await assert.rejects(
  sendBuyerVerificationEmail({
    ...input,
    fetcher: async () => {
      throw new Error("sensitive provider details");
    },
  }),
  /NFT_EMAIL_DELIVERY_UNAVAILABLE/,
);

console.log("NETWORK_ERROR_REDACTED=PASS");

await assert.rejects(
  sendBuyerVerificationEmail({
    ...input,
    code: "invalid",
    fetcher: async () => {
      throw new Error("SHOULD_NOT_SEND");
    },
  }),
  /NFT_EMAIL_INVALID_REQUEST/,
);

console.log("INVALID_CODE_BLOCKED=PASS");
console.log("NFT_EMAIL_DELIVERY_TEST=PASS");
console.log("REAL_EMAIL_SENT=NO");
