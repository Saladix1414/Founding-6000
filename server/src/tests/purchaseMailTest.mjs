import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { CommerceCore } from '../../../cloudflare/commerceCore.mjs';
import { deliverPurchaseMail, encodePurchaseMime, initializePurchaseMail, enqueuePurchaseMailSelfTest } from '../../../cloudflare/purchaseMail.mjs';

function harness() {
  const db = new DatabaseSync(':memory:');
  const storage = {
    sql: { exec(query, ...args) {
      if (!args.length && query.trim().split(';').filter(x => x.trim()).length > 1) {
        db.exec(query); return { toArray: () => [] };
      }
      const stmt = db.prepare(query);
      const rows = /^\s*(SELECT|WITH|PRAGMA)/i.test(query) ? stmt.all(...args) : (stmt.run(...args), []);
      return { toArray: () => rows };
    } },
    transactionSync(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  db.exec(`CREATE TABLE audit_events(id TEXT PRIMARY KEY,event_type TEXT,entity_type TEXT,entity_id TEXT,payload_json TEXT,created_at TEXT)`);
  const commerce = new CommerceCore(storage); commerce.initializeSchema();
  const order = commerce.createOrder({ email: 'buyer@example.com', idempotencyKey: 'mail-order-test' }).order;
  const attempt = commerce.createUsdtAttempt({ orderPublicId: order.publicId, idempotencyKey: 'mail-attempt-test' }).attempt;
  const txHash = '0x' + 'a'.repeat(64);
  commerce.submitUsdtHash({ paymentAttemptPublicId: attempt.publicId, txHash });
  const settle = () => commerce.settleVerifiedUsdt({ paymentAttemptPublicId: attempt.publicId,
    transfer: { txHash, chainId: 1, tokenContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      senderAddress: '0x' + '1'.repeat(40), receiverAddress: attempt.receiverAddress,
      amountMinor: String(attempt.expectedAmountMinor), blockNumber: 123456, transactionIndex: 2, confirmations: 12 } });
  return { db, storage, commerce, settle };
}
const env = { PURCHASE_EMAIL_ENABLED: 'true', PURCHASE_EMAIL_MODE: 'live', GMAIL_CLIENT_ID: 'test-id', GMAIL_CLIENT_SECRET: 'test-secret', GMAIL_REFRESH_TOKEN: 'test-refresh' };
const rows = h => h.db.prepare('SELECT * FROM purchase_mail_outbox ORDER BY kind').all();
const mock = (send) => async (url, options) => url.includes('oauth2.googleapis.com')
  ? Response.json({ access_token: 'mock-token' }) : send(options);
const clock = () => Date.now() + 1000;

{
  const h = harness();
  assert.equal(rows(h).length, 0);
  h.settle(); h.settle();
  assert.equal(rows(h).length, 2);
  assert.deepEqual(rows(h).map(x => x.kind), ['ADMIN', 'BUYER']);
  assert.equal(rows(h)[0].recipient, 'originxfounding@gmail.com');
  assert.equal(rows(h)[1].recipient, 'buyer@example.com');
  initializePurchaseMail(h.storage);
  assert.equal(rows(h).length, 2);
  let sent = 0;
  const fetcher = mock(async options => {
    assert.equal(options.headers.Authorization, 'Bearer mock-token');
    const raw = JSON.parse(options.body).raw;
    const mime = Buffer.from(raw, 'base64url').toString('utf8');
    assert.match(mime, /Content-Type: text\/plain; charset=UTF-8/);
    const text = Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
    assert.match(text, /pendiente de activación/);
    assert.match(text, /no acredita su emisión/);
    return Response.json({ id: `message-${++sent}` });
  });
  await deliverPurchaseMail(h.storage, env, { fetcher, now: clock() });
  await deliverPurchaseMail(h.storage, env, { fetcher, now: clock() });
  assert.equal(sent, 2); assert.ok(rows(h).every(x => x.status === 'SENT'));
  assert.throws(() => encodePurchaseMime({ ...rows(h)[0], recipient: 'a@example.com\r\nBcc: bad@example.com' }));
  console.log('TWO_RECEIPTS_ATOMIC_REPLAY_MIME=PASS'); h.db.close();
}
{
  const h = harness();
  h.db.exec(`CREATE TRIGGER fail_mail BEFORE INSERT ON purchase_mail_outbox WHEN NEW.kind='BUYER' BEGIN SELECT RAISE(ABORT,'mail_test'); END`);
  assert.throws(h.settle);
  assert.equal(rows(h).length, 0);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM payment_settlements').get().n, 0);
  assert.equal(h.db.prepare('SELECT status FROM founding_orders').get().status, 'CREATED');
  console.log('MAIL_AND_PAYMENT_ROLLBACK=PASS'); h.db.close();
}
{
  const h = harness(); h.settle(); let calls = 0;
  const fetcher = async () => { calls++; throw new Error('mock-secret-must-not-leak'); };
  assert.deepEqual(await deliverPurchaseMail(h.storage, {}, { fetcher }), { enabled: false });
  assert.equal((await deliverPurchaseMail(h.storage, { PURCHASE_EMAIL_ENABLED: 'true' }, { fetcher })).configured, false);
  assert.equal(calls, 0); assert.ok(rows(h).every(x => x.attempts === 0));
  const now = clock();
  await deliverPurchaseMail(h.storage, env, { fetcher: mock(async () => new Response('', { status: 429 })), now });
  assert.ok(rows(h).every(x => x.status === 'PENDING' && x.attempts === 1));
  const counts = rows(h).map(x => x.attempts);
  await deliverPurchaseMail(h.storage, env, { fetcher, now: now + 1 });
  assert.deepEqual(rows(h).map(x => x.attempts), counts);
  await deliverPurchaseMail(h.storage, env, { fetcher: mock(async () => Response.json({ id: 'retried' })), now: now + 300001 });
  assert.ok(rows(h).every(x => x.status === 'SENT'));
  console.log('DISABLED_MISSING_CONFIG_RATE_LIMIT_BACKOFF=PASS'); h.db.close();
}
{
  const h = harness(); h.settle();
  const now = clock(); let sends = 0;
  const fetcher = mock(async () => { sends++; throw new Error('uncertain-network'); });
  await deliverPurchaseMail(h.storage, env, { fetcher, now });
  await deliverPurchaseMail(h.storage, env, { fetcher, now: now + 999999 });
  assert.equal(sends, 2); assert.ok(rows(h).every(x => x.status === 'UNCERTAIN'));
  console.log('UNCERTAIN_DELIVERY_NO_BLIND_RETRY=PASS'); h.db.close();
}
{
  const h = harness(); h.settle();
  await deliverPurchaseMail(h.storage, env, { fetcher: async () => Response.json({ error: 'invalid_grant' }, { status: 400 }), now: clock() });
  assert.ok(rows(h).every(x => x.status === 'FAILED' && x.last_error === 'GMAIL_AUTH_REAUTHORIZE'));
  assert.equal(h.db.prepare('SELECT status FROM founding_orders').get().status, 'PAID');
  console.log('AUTH_FAILURE_KEEPS_PAYMENT=PASS'); h.db.close();
}
{
  const h = harness(); h.settle(); const now = clock();
  h.db.exec(`UPDATE purchase_mail_outbox SET status='SENDING',lease_until=0 WHERE kind='ADMIN';
    UPDATE purchase_mail_outbox SET status='CLAIMED',attempts=1,lease_until=0 WHERE kind='BUYER'`);
  let sent = 0;
  await deliverPurchaseMail(h.storage, env, { fetcher: mock(async () => { sent++; return Response.json({ id: 'recovered' }); }), now });
  assert.equal(sent, 1); assert.equal(rows(h)[0].status, 'UNCERTAIN'); assert.equal(rows(h)[1].status, 'SENT');
  console.log('CRASH_RECOVERY_LEASES=PASS'); h.db.close();
}
{
  const h = harness(); h.settle(); const now = clock();
  h.db.exec(`UPDATE purchase_mail_outbox SET attempts=5`);
  await deliverPurchaseMail(h.storage, env, { fetcher: async () => new Response('', { status: 503 }), now });
  assert.ok(rows(h).every(x => x.status === 'FAILED' && x.attempts === 6));
  console.log('BOUNDED_RETRIES=PASS'); h.db.close();
}

{
  const h = harness(); h.settle();
  const testEnv = { ...env, PURCHASE_EMAIL_MODE: 'test', PURCHASE_EMAIL_TEST_ID: 'originx-mail-test-001' };
  enqueuePurchaseMailSelfTest(h.storage, testEnv); enqueuePurchaseMailSelfTest(h.storage, testEnv);
  let sent = 0;
  await deliverPurchaseMail(h.storage, testEnv, { fetcher: mock(async options => {
    sent++;
    const mime = Buffer.from(JSON.parse(options.body).raw, 'base64url').toString();
    assert.match(mime, /To: originxfounding@gmail.com/);
    return Response.json({ id: 'selftest-id' });
  }), now: clock() });
  assert.equal(sent, 1);
  assert.equal(rows(h).filter(x => x.status === 'PENDING').length, 2);
  console.log('SELFTEST_ONCE_LIVE_ORDERS_ISOLATED=PASS'); h.db.close();
}

// Runtime integration with Node stand-ins for Cloudflare's binding/base class.
// This exercises our JS routing; it does not replace a workerd deployment test.
{
  const { readFile } = await import('node:fs/promises');
  const base = new URL('../../../cloudflare/', import.meta.url);
  let coreSource = await readFile(new URL('foundingCore.mjs', base), 'utf8');
  coreSource = coreSource.replace('import { DurableObject } from "cloudflare:workers";', 'class DurableObject { constructor() {} }');
  coreSource = coreSource.replace('import { rareArcadeRelease } from "./rareArcadeRelease.mjs";', 'const rareArcadeRelease = null;');
  coreSource = coreSource.replaceAll('"./purchaseMail.mjs"', JSON.stringify(new URL('purchaseMail.mjs', base).href));
  coreSource = coreSource.replaceAll('"./commerceCore.mjs"', JSON.stringify(new URL('commerceCore.mjs', base).href));
  const { FoundingCore } = await import('data:text/javascript;base64,' + Buffer.from(coreSource).toString('base64'));
  let workerSource = await readFile(new URL('worker.mjs', base), 'utf8');
  workerSource = workerSource.replace(/import\s*\{\s*FoundingCore,?\s*\}\s*from "\.\/foundingCore.mjs";/, 'const FoundingCore = class {};');
  workerSource = workerSource.replace(/import\s*\{\s*verifyUsdtOnEthereum,?\s*\}\s*from "\.\/usdtRpcVerifier.mjs";/, 'const verifyUsdtOnEthereum = () => { throw new Error("UNEXPECTED_PAYMENT_CALL"); };');
  const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'));
  const h = harness();
  const runtimeEnv = { ...env, PURCHASE_EMAIL_MODE: 'test', PURCHASE_EMAIL_TEST_ID: 'runtime-test-001' };
  const core = new FoundingCore({ storage: h.storage }, runtimeEnv);
  const calls = []; const tasks = []; let sent = 0;
  runtimeEnv.FOUNDING_CORE = {
    idFromName(name) { assert.equal(name, 'canonical-founding-6000'); return 'canonical'; },
    get() { return { fetch(url, options) { calls.push(url); return core.fetch(new Request(url, options)); } }; },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock(async () => { sent++; return Response.json({ id: 'runtime-message' }); });
  try {
    await worker.scheduled({}, runtimeEnv, { waitUntil(promise) { tasks.push(promise); } });
    await Promise.all(tasks);
    assert.equal(sent, 1);
    assert.equal(calls.length, 1);
    const report = await core.fetch(new Request('https://internal/internal/purchase-mail/drain', { method: 'POST' }));
    assert.equal((await report.json()).counts.find(x => x.status === 'SENT').count, 1);
    assert.equal(sent, 1);
    const response = await worker.fetch(new Request('https://example.com/api/internal/purchase-mail/drain', { method: 'POST' }), runtimeEnv, {});
    assert.equal(response.status, 503);
    assert.equal(calls.length, 1);
    console.log('CRON_DO_INTEGRATION_PRIVATE_ROUTE=PASS');
  } finally { globalThis.fetch = originalFetch; h.db.close(); }
}
