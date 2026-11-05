# Founding purchase receipts — Gmail

Base reviewed: deploy/cloudflare-d4 at 33d42ae4e97815eae9d5c2d1fb33f0add6f18f6f.

New verified settlements atomically enqueue ADMIN and BUYER receipts. Replaying a
settlement does not create another receipt. Historical orders are not backfilled.
Payments, access activation and NFT delivery remain distinct. Receipts do not
claim that minting or wallet delivery has completed.

Cloudflare Cron wakes the canonical Durable Object every five minutes and drains
at most ten due messages. A missing or disabled mail configuration makes no
network calls. Only the object binding can reach the drain; no public mail route
is registered. A drain failure never changes an already confirmed payment.

## Configuration

Keep GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN as encrypted
Cloudflare secrets. Never add them to wrangler.jsonc, source control or logs.
The OAuth grant must belong to originxfounding@gmail.com and include gmail.send.
Both sender and administrative recipient are fixed to that address.

The shipped vars are PURCHASE_EMAIL_ENABLED=false and PURCHASE_EMAIL_MODE=test.
To test after deployment, set enabled=true, mode=test, and
PURCHASE_EMAIL_TEST_ID=originx-mail-test-001. The next cron run queues ONE explicit
PRUEBA message to the administrator. Changing the test ID opts into another test.
Live purchase receipts remain queued in test mode. Inspect PURCHASE_MAIL_STATUS
in Cloudflare Observability; counts contain no addresses, bodies or credentials.
SENT means Gmail accepted and returned a message ID, not guaranteed inbox delivery.
Verify the test arrives in the mailbox (including spam) before enabling live mode.

To enable receipts for new confirmed purchases, set PURCHASE_EMAIL_MODE=live
and keep PURCHASE_EMAIL_ENABLED=true. Remove the test ID. Synchronize the
non-secret flags with wrangler.jsonc before later deploys; secrets stay outside it.
Verify the Cloudflare cron trigger exists. Gmail personal sending limits apply;
there are two separate messages per purchase. Check OAuth publishing state under
Google Auth Platform > Audience. External grants issued in Testing for gmail.send
expire after seven days; do not rely on those for unattended production.

## Recovery and limitations

PENDING retries use five-minute exponential backoff, capped at one hour, with
six attempts maximum. Token 400/401 errors mark FAILED/GMAIL_AUTH_REAUTHORIZE.
Repair OAuth before explicitly requeueing rejected receipts. Gmail 401/429 sends
are definite rejections and can retry. Other send failures, malformed success
responses and interrupted SENDING leases become UNCERTAIN; investigate before
manual resend. Message-ID is for correlation, not Gmail deduplication.
No automatic recovery endpoint is exposed in this version. FAILED and UNCERTAIN
need an operator recovery step after checking Gmail/provider evidence.

CLAIMED leases can recover safely because no send was started. An in-memory drain
promise prevents concurrent drains on a live object; durable leases survive a
restart. Configuration changes must not change the canonical object's name.

Tests use in-memory SQLite, mocked Google HTTPS responses and Node stand-ins for
Cloudflare bindings. They cover settlement replay and rollback, MIME, flags,
rate-limit backoff, retry caps, auth failures, uncertain sends, lease recovery,
self-test isolation and cron-to-object routing. A live Cloudflare/Gmail test and
frontend build remain deployment checks, not claims from these unit tests.

Commands:
  node server/src/tests/purchaseMailTest.mjs
  node server/src/tests/p6aCloudflareCommerceCoreTest.mjs
  node server/src/tests/p6bSettlementAuthorityTest.mjs
  npm run build

Reference documentation:
https://developers.google.com/workspace/gmail/api/guides/sending
https://developers.google.com/identity/protocols/oauth2
https://support.google.com/mail/answer/22839
