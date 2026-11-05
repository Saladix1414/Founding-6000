/* Founding 6000 — private purchase monitoring V8. READ ONLY.
 * NO public Worker route, no side effects on purchase/settlement/mint/mail.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export const PURCHASE_MONITOR_VERSION = 'OX-PURCHASE-MONITOR-8';
const REQUIRED = Object.freeze(['founding_orders','payment_attempts','payment_settlements',
  'inventory_allocations','founding_memberships','nft_mint_jobs']);
const STATUSES = Object.freeze(['CREATED','PAID','CANCELLED']);
const MINT_STATUSES = Object.freeze(['AWAITING_WALLET','READY','MINTING','SUBMITTED',
  'CONFIRMED','RETRYABLE_ERROR','FAILED']);
const MAIL_STATUSES = Object.freeze(['PENDING','SENDING','SENT','FAILED','UNCERTAIN']);
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
function fail() { throw new Error('OX_PURCHASE_MONITOR_V8_UNAVAILABLE'); }
function query(storage, sql, ...args) {
  if (!storage?.sql?.exec) fail();
  try { const result=storage.sql.exec(sql,...args).toArray(); if (!Array.isArray(result)) fail(); return result; }
  catch { fail(); }
}
function count(storage,sql,...args) {
  const results=query(storage,sql,...args);
  if (results.length!==1 || !Number.isSafeInteger(Number(results[0]?.n)) || Number(results[0].n)<0) fail();
  return Number(results[0].n);
}
function byStatus(storage, table, allowed) {
  const rows=query(storage,`SELECT status,COUNT(*) AS n FROM ${table} GROUP BY status`);
  const out=Object.fromEntries(allowed.map(k=>[k,0]));
  for(const row of rows) {
    if (!Object.hasOwn(out,row.status) || !Number.isSafeInteger(Number(row.n)) || Number(row.n)<0) fail();
    out[row.status]=Number(row.n);
  }
  return Object.freeze(out);
}
function hasTable(names,n) {return names.has(n);}
/** One consistent SQLite read transaction is expected from the caller; this function never writes. */
export function readPurchaseMonitorV8(storage) {
  const names=new Set(query(storage,"SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name));
  const missing=REQUIRED.filter(n=>!hasTable(names,n));
  if(missing.length) return Object.freeze({schema:PURCHASE_MONITOR_VERSION,status:'SCHEMA_INCOMPLETE',missingTables:missing,
    counts:null,anomalies:null,source:'LOCAL_DURABLE_OBJECT_SQLITE',independentChainProof:false,
    mailDeliveryGuaranteed:false,settlementMutationAuthorized:false,checkoutModified:false,
    treasuryVerified:false,mintAuthorized:false});
  const orders=byStatus(storage,'founding_orders',STATUSES);
  const mint=byStatus(storage,'nft_mint_jobs',MINT_STATUSES);
  const attempts=byStatus(storage,'payment_attempts',['AWAITING_TRANSFER','SUBMITTED','VERIFYING','VERIFIED','REJECTED','EXPIRED']);
  const settled=count(storage,'SELECT COUNT(*) AS n FROM payment_settlements');
  const assigned=count(storage,'SELECT COUNT(*) AS n FROM inventory_allocations');
  const memberships=count(storage,'SELECT COUNT(*) AS n FROM founding_memberships');
  const mailTable=hasTable(names,'purchase_mail_outbox')? 'purchase_mail_outbox' :
    hasTable(names,'founding_purchase_mail')?'founding_purchase_mail':null;
  // Only status aggregates. Do not depend on a guessed email outbox schema.
  const anomalies=Object.freeze({
    paidWithoutCompleteDeliveryChain:count(storage,`SELECT COUNT(*) AS n FROM founding_orders o WHERE o.status='PAID' AND (
      (SELECT COUNT(*) FROM payment_settlements s WHERE s.order_id=o.id)<>1 OR
      (SELECT COUNT(*) FROM inventory_allocations a WHERE a.order_id=o.id)<>1 OR
      (SELECT COUNT(*) FROM founding_memberships m WHERE m.order_id=o.id)<>1 OR
      (SELECT COUNT(*) FROM nft_mint_jobs j WHERE j.order_id=o.id)<>1)`),
    inconsistentSettlements:count(storage,`SELECT COUNT(*) AS n FROM payment_settlements s
      LEFT JOIN founding_orders o ON o.id=s.order_id
      LEFT JOIN payment_attempts p ON p.id=s.payment_attempt_id
      WHERE o.id IS NULL OR o.status<>'PAID' OR p.id IS NULL OR p.order_id<>s.order_id
        OR p.status<>'VERIFIED' OR lower(p.tx_hash)<>lower(s.external_reference)
        OR s.chain_id<>1 OR s.network<>'ethereum-mainnet' OR s.confirmations<12
        OR lower(s.token_contract)<>? OR lower(p.token_contract)<>?
        OR lower(s.receiver_address)<>lower(p.receiver_address)
        OR s.amount_minor<>p.expected_amount_minor OR s.amount_minor<>o.reference_price_usd*1000000`,USDT,USDT),
    orphanOrMismatchedAllocations:count(storage,`SELECT COUNT(*) AS n FROM inventory_allocations a
      LEFT JOIN founding_orders o ON o.id=a.order_id
      LEFT JOIN payment_settlements s ON s.order_id=a.order_id
      LEFT JOIN founding_memberships m ON m.order_id=a.order_id AND m.serial_number=a.serial_number
      LEFT JOIN nft_mint_jobs j ON j.order_id=a.order_id AND j.serial_number=a.serial_number
      WHERE o.id IS NULL OR o.status<>'PAID' OR s.id IS NULL OR
       lower(a.settlement_reference)<>lower(s.external_reference) OR m.id IS NULL OR j.id IS NULL`),
  });
  const counts=Object.freeze({orders,mintJobs:mint,paymentAttempts:attempts,
    paymentSettlements:settled,serialAllocations:assigned,memberships,
    genesisSerial0001Allocated:count(storage,'SELECT COUNT(*) AS n FROM inventory_allocations WHERE serial_number=1'),
    emailOutboxSchemaDetected:mailTable!==null,emailOutboxCountsVerified:false});
  const safe={schema:PURCHASE_MONITOR_VERSION,status:Object.values(anomalies).some(Boolean)?'REVIEW_REQUIRED':'LOCAL_RECORDS_CONSISTENT',
    missingTables:[],counts,anomalies,source:'LOCAL_DURABLE_OBJECT_SQLITE',
    independentChainProof:false,mailDeliveryGuaranteed:false,settlementMutationAuthorized:false,
    checkoutModified:false,treasuryVerified:false,mintAuthorized:false};
  return Object.freeze({...safe,reportHash:createHash('sha256').update(JSON.stringify(safe)).digest('hex')});
}

/** This is an additional internal-only boundary; it is NOT a public Worker endpoint. */
export function authorizePurchaseMonitorV8(request,env) {
  if (request?.method!=='GET' || new URL(request.url).pathname!=='/internal/ops/purchase-status-v8') return false;
  if(env?.OX_PURCHASE_MONITOR_V8_ENABLED!=='true') return false;
  const secret=env?.OX_PURCHASE_MONITOR_V8_KEY;
  const provided=request.headers.get('x-ox-monitor-key');
  if(typeof secret!=='string'||secret.length<32||secret.length>256||
     typeof provided!=='string'||provided.length!==secret.length) return false;
  const actual=new TextEncoder().encode(provided), expected=new TextEncoder().encode(secret);
  return timingSafeEqual(actual,expected);
}
export function handlePurchaseMonitorV8({request,env,storage}) {
  if(!authorizePurchaseMonitorV8(request,env)) return Response.json({error:'NOT_FOUND'},{status:404,
    headers:{'Cache-Control':'no-store'}});
  try {return Response.json(readPurchaseMonitorV8(storage),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
  catch {return Response.json({error:'MONITOR_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
