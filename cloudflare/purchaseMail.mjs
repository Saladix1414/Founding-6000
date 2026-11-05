// Purchase receipts are independent from NFT verification codes and minting.
export const FOUNDING_MAILBOX = "originxfounding@gmail.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const MAX_ATTEMPTS = 6;
const LEASE_MS = 120000;
const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

export function initializePurchaseMail(storage) {
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS purchase_mail_outbox (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('ADMIN','BUYER')),
      recipient TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK(status IN ('PENDING','CLAIMED','SENDING','SENT','FAILED','UNCERTAIN')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL,
      lease_until INTEGER,
      provider_id TEXT,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      sent_at INTEGER,
      UNIQUE(order_id,kind)
    );
    CREATE INDEX IF NOT EXISTS purchase_mail_due
      ON purchase_mail_outbox(status,next_attempt_at);
  `);
}

// Caller MUST already be inside the settlement transaction. No nested transaction,
// remote calls, credentials or delivery work are allowed here.
export function enqueuePurchaseMail(storage, orderId, now = Date.now()) {
  const row = storage.sql.exec(`
    SELECT o.public_id AS orderPublicId, o.email AS email,
      p.amount_minor AS amountMinor, p.external_reference AS txHash,
      p.verified_at AS verifiedAt, a.serial_number AS serialNumber,
      m.public_id AS membershipPublicId
    FROM founding_orders o
    JOIN payment_settlements p ON p.order_id = o.id
    JOIN inventory_allocations a ON a.order_id = o.id
    JOIN founding_memberships m ON m.order_id = o.id
    WHERE o.id = ? AND o.status = 'PAID'
  `, orderId).toArray()[0];
  if (!row || !EMAIL.test(row.email)) throw new Error('PURCHASE_MAIL_INVALID_ORDER');
  const payload = JSON.stringify(row);
  for (const [kind, recipient] of [['ADMIN', FOUNDING_MAILBOX], ['BUYER', row.email]]) {
    storage.sql.exec(`
      INSERT INTO purchase_mail_outbox
        (id,order_id,kind,recipient,payload_json,next_attempt_at,created_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(order_id,kind) DO NOTHING
    `, crypto.randomUUID(), orderId, kind, recipient, payload, now, now);
  }
}

// Explicit opt-in diagnostic: one email to the administrator, never a purchase.
export function enqueuePurchaseMailSelfTest(storage, env, now = Date.now()) {
  const testId = env.PURCHASE_EMAIL_TEST_ID;
  if (typeof testId !== 'string' || !/^[a-z0-9-]{8,64}$/.test(testId)) return;
  storage.sql.exec(`INSERT INTO purchase_mail_outbox
    (id,order_id,kind,recipient,payload_json,next_attempt_at,created_at)
    VALUES (?,?, 'ADMIN', ?, ?, ?, ?) ON CONFLICT(order_id,kind) DO NOTHING`,
    crypto.randomUUID(), `mail-selftest:${testId}`, FOUNDING_MAILBOX,
    JSON.stringify({ test: true, testId }), now, now);
}

export function purchaseMailSummary(storage) {
  return storage.sql.exec('SELECT status,COUNT(*) AS count FROM purchase_mail_outbox GROUP BY status').toArray();
}

export function renderPurchaseMail(kind, payload) {
  if (payload.test === true) return {
    subject: 'PRUEBA — OriginX Founding Mail',
    text: `Prueba de conexión de correo OriginX.\nIdentificador: ${payload.testId}\nEste mensaje no corresponde a una compra ni confirma ningún pago.`,
  };

  const amount = BigInt(payload.amountMinor);
  const usdt = `${amount / 1000000n}.${(amount % 1000000n).toString().padStart(6, '0')}`;
  const details = [
    `Pedido: ${payload.orderPublicId}`,
    `Importe confirmado: ${usdt} USDT`,
    'Red del pago: Ethereum Mainnet',
    `Transacción: ${payload.txHash}`,
    `Fecha de verificación: ${payload.verifiedAt}`,
    `Número Founding: #${String(payload.serialNumber).padStart(4, '0')}`,
    `Membresía: ${payload.membershipPublicId}`,
  ];
  const buyer = kind === 'BUYER';
  return {
    subject: buyer ? `OriginX — Pago confirmado · ${payload.orderPublicId}`
      : `Founding 6000 — Nueva compra · ${payload.orderPublicId}`,
    text: [buyer ? 'Gracias por formar parte de Founding 6000.' : 'Se confirmó una nueva compra de Founding 6000.',
      '', ...details, '',
      ...(buyer ? [] : [`Comprador: ${payload.email}`, '']),
      'La compra quedó registrada. La membresía está pendiente de activación; este pago no inicia por sí solo sus 12 meses de acceso.',
      'La entrega del NFT sigue un proceso separado. Este correo no acredita su emisión ni su entrega a una wallet.',
      '', 'Consultas: ' + FOUNDING_MAILBOX,
      'https://founding-6000-prelaunch.digitalboostlaunch.workers.dev/',
    ].join('\n'),
  };
}

function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function encodePurchaseMime(job) {
  if (!EMAIL.test(job.recipient)) throw new Error('MAIL_RECIPIENT_INVALID');
  const { subject, text } = renderPurchaseMail(job.kind, JSON.parse(job.payload_json));
  const body = base64(text).match(/.{1,76}/g).join('\r\n');
  const mime = [
    `From: OriginX Founding <${FOUNDING_MAILBOX}>`,
    `To: ${job.recipient}`, `Reply-To: ${FOUNDING_MAILBOX}`,
    `Subject: ${Array.from(subject).reduce((chunks, char, i) => { if (i % 20 === 0) chunks.push(''); chunks[chunks.length - 1] += char; return chunks; }, []).map(chunk => `=?UTF-8?B?${base64(chunk)}?=`).join('\r\n ')}`,
    `Message-ID: <${job.id}@founding-6000-prelaunch.digitalboostlaunch.workers.dev>`,
    `Date: ${new Date(job.created_at).toUTCString()}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', body,
  ].join('\r\n');
  // Message-ID is an audit identifier, NOT a Gmail idempotency guarantee.
  return base64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function purchaseMailConfigured(env) {
  return ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']
    .every(key => typeof env[key] === 'string' && env[key].trim().length > 0);
}

export async function deliverPurchaseMail(storage, env, { fetcher = fetch, now = Date.now(), limit = 10 } = {}) {
  if (env.PURCHASE_EMAIL_ENABLED !== 'true') return { enabled: false };
  if (!purchaseMailConfigured(env)) return { enabled: true, configured: false };
  // CLAIMED means no send was attempted. SENDING is uncertain after a crash.
  storage.transactionSync(() => {
    storage.sql.exec(`UPDATE purchase_mail_outbox SET status='UNCERTAIN',last_error='SEND_INTERRUPTED',lease_until=NULL
      WHERE status='SENDING' AND lease_until <= ?`, now);
    storage.sql.exec(`UPDATE purchase_mail_outbox SET status=CASE WHEN attempts >= ? THEN 'FAILED' ELSE 'PENDING' END,
      last_error='CLAIM_INTERRUPTED',lease_until=NULL WHERE status='CLAIMED' AND lease_until <= ?`, MAX_ATTEMPTS, now);
  });
  const jobs = storage.transactionSync(() => {
    const rows = storage.sql.exec(`SELECT * FROM purchase_mail_outbox WHERE status='PENDING'
      AND attempts < ? AND next_attempt_at <= ?
      AND (? = 1 OR order_id LIKE 'mail-selftest:%')
      ORDER BY created_at,id LIMIT ?`, MAX_ATTEMPTS, now, env.PURCHASE_EMAIL_MODE === 'live' ? 1 : 0, Math.min(10, Math.max(1, limit))).toArray();
    for (const row of rows) storage.sql.exec(`UPDATE purchase_mail_outbox SET status='CLAIMED',attempts=attempts+1,lease_until=? WHERE id=?`, now + LEASE_MS, row.id);
    return rows;
  });
  const results = [];
  for (const job of jobs) {
    let sending = false;
    let failure = 'TOKEN_UNAVAILABLE';
    let retryable = true;
    try {
      const tokenResponse = await fetcher(TOKEN_URL, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID,
          client_secret: env.GMAIL_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN,
          grant_type: 'refresh_token' }).toString(),
      });
      if (!tokenResponse.ok) {
        if (tokenResponse.status === 400 || tokenResponse.status === 401) {
          failure = 'GMAIL_AUTH_REAUTHORIZE'; retryable = false;
        }
        throw new Error('TOKEN_REJECTED');
      }
      const token = await tokenResponse.json();
      if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('TOKEN_INVALID');
      const raw = encodePurchaseMime(job);
      storage.sql.exec(`UPDATE purchase_mail_outbox SET status='SENDING',lease_until=? WHERE id=? AND status='CLAIMED'`, Date.now() + LEASE_MS, job.id);
      sending = true;
      const response = await fetcher(SEND_URL, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (!response.ok) {
        // 401/429 are definite rejections. Other responses are not retried blindly.
        if (response.status === 401 || response.status === 429) {
          sending = false; failure = response.status === 429 ? 'GMAIL_RATE_LIMIT' : 'GMAIL_SEND_AUTH';
        } else if (response.status >= 400 && response.status < 500) {
          sending = false; retryable = false; failure = 'GMAIL_SEND_REJECTED';
        }
        throw new Error('SEND_FAILED');
      }
      const result = await response.json();
      if (typeof result.id !== 'string' || !result.id) throw new Error('SEND_UNCERTAIN');
      storage.sql.exec(`UPDATE purchase_mail_outbox SET status='SENT',provider_id=?,sent_at=?,lease_until=NULL,last_error=NULL WHERE id=?`, result.id, Date.now(), job.id);
      results.push({ id: job.id, status: 'SENT' });
    } catch {
      const status = sending ? 'UNCERTAIN' : (!retryable || job.attempts + 1 >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING');
      const delay = Math.min(3600000, 300000 * 2 ** job.attempts);
      storage.sql.exec(`UPDATE purchase_mail_outbox SET status=?,next_attempt_at=?,lease_until=NULL,last_error=? WHERE id=?`,
        status, now + delay, sending ? 'GMAIL_SEND_UNCERTAIN' : failure, job.id);
      results.push({ id: job.id, status });
    }
  }
  // No recipient, body, provider response or credential is returned/logged.
  return { enabled: true, configured: true, results };
}
