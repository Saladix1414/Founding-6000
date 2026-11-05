/**
 * OriginX Founding 6000 — V7 forensic, READ-ONLY launch preflight.
 * No authority callbacks, writes, network, signers, payment/mint/reserve operations.
 * The report cannot authorize NEW Genesis functionality, even if every local test passes.
 * V7 DOES NOT block or alter existing live checkout/payment routes or flags.
 */
import { createHash } from 'node:crypto';

export const LAUNCH_PREFLIGHT_VERSION = 'OX-LAUNCH-PREFLIGHT-7';
export const PREFLIGHT_FILES = Object.freeze([
  'cloudflare/commerceCore.mjs',
  'cloudflare/foundingCore.mjs',
  'cloudflare/worker.mjs',
  'cloudflare/oxGenesisCheckoutV6.mjs',
  'cloudflare/oxPaidGenesisDeliveryV5.mjs',
  'cloudflare/rareArcadeRelease.mjs',
  'cloudflare/nftPaidDeliveryIntent.mjs',
  'cloudflare/nftPostSaleRedemptionPreparation.mjs',
  'cloudflare/oxReservePolicyV4Draft.mjs',
  'cloudflare/nftMainnetLaunchPreparation.mjs',
  'wrangler.jsonc',
]);
const TIER_RANGES = Object.freeze({ RARE:[1,1000], EPIC:[1001,3000], LEGENDARY:[3001,6000] });
const ETH_USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const HASH=/^[a-f0-9]{64}$/i;
const sha = text => createHash('sha256').update(text).digest('hex');
const digest = x => sha(JSON.stringify(x));
const fail = code => {throw new Error('OX_LAUNCH_V7_' + code)};
const check = (id, pass, explanation) => Object.freeze({id, status:pass?'PASS':'BLOCKED', explanation});

/** Reads only supplied source text; NEVER interprets deployment intent as chain evidence. */
export function auditLaunchSourceV7(readFile) {
  if (typeof readFile !== 'function') fail('SOURCE_READER_REQUIRED');
  const source = new Map();
  for (const path of PREFLIGHT_FILES) {
    let text = null;
    try { const v=readFile(path); if(typeof v==='string' && v.length) text=v; } catch {/* missing => blocker */}
    source.set(path,text);
  }
  const contents = path => source.get(path) ?? '';
  let wrangler = null;
  try {wrangler = JSON.parse(contents('wrangler.jsonc'));} catch {/* unknown config => blocker */}
  const mainnet = contents('cloudflare/nftMainnetLaunchPreparation.mjs');
  const draft = contents('cloudflare/oxReservePolicyV4Draft.mjs');
  const release = contents('cloudflare/rareArcadeRelease.mjs');
  const core = contents('cloudflare/commerceCore.mjs');
  const worker = contents('cloudflare/foundingCore.mjs');
  const publicWorker = contents('cloudflare/worker.mjs');
  const checkout = contents('cloudflare/oxGenesisCheckoutV6.mjs');
  const intent = contents('cloudflare/nftPaidDeliveryIntent.mjs');
  const redemption = contents('cloudflare/nftPostSaleRedemptionPreparation.mjs');
  const sourceComplete = [...source.values()].every(x => typeof x==='string' && x.length);
  const vars = wrangler && typeof wrangler.vars==='object' && wrangler.vars!==null ? wrangler.vars : {};
  const paymentFlagNames = ['PUBLIC_CHECKOUT_ENABLED','PAYMENT_READINESS','REAL_PAYMENTS_ENABLED','CLOUDFLARE_USDT_API_ENABLED'];
  const paymentFlags = Object.freeze(Object.fromEntries(paymentFlagNames.map(k=>[k,vars[k]===undefined?'UNSET_IN_FILE':vars[k]])));
  const checks = [
    check('REQUIRED_SOURCE_FILES_PRESENT',sourceComplete,'Todos los archivos del contrato V7 están presentes'),
    check('PAYMENT_FLAGS_TRUE_IN_REPO',paymentFlagNames.every(k=>vars[k]==='true'),'Los cuatro indicadores de pagos existentes están en true en el archivo local; NO se consulta el entorno desplegado'),
    check('PUBLIC_PAYMENT_ROUTES_EXIST_IN_SOURCE',publicWorker.includes('publicUsdtApiEnabled') &&
      publicWorker.includes('/api/payments/usdt/attempts') && publicWorker.includes('/internal/orders'),
      'El código local todavía contiene el enrutamiento de órdenes y pagos USDT; NO prueba disponibilidad remota'),
    check('COMMERCE_HAS_V6_INTERNAL_HOOKS',/genesisCheckout/.test(core) && /simulateGenesisReservationV6/.test(core) && /simulateGenesisAllocationV6/.test(core),'CommerceCore incluye ganchos internos de V6'),
    check('GENESIS_NOT_EXPOSED_IN_WORKER',!/genesisCheckout\s*:/.test(worker) && /new CommerceCore/.test(worker),'FoundingCore no activa V6 desde el Worker'),
    check('GENESIS_RELEASE_NOT_APPROVED',/"approvedForSale"\s*:\s*false\b/.test(release),'El manifiesto real RARE sigue sin autorización de venta'),
    check('GENESIS_V6_REVIEW_ONLY',/INTERNAL_REVIEW_ONLY/.test(checkout) && /salesActivationApproved\s*!==\s*false/.test(checkout),'V6 sólo admite simulación interna'),
    check('V5_GENESIS_INTENT_UNAUTHORIZED',/PREPARED_NOT_AUTHORIZED/.test(contents('cloudflare/oxPaidGenesisDeliveryV5.mjs')) && /mintAuthority\s*:\s*false/.test(contents('cloudflare/oxPaidGenesisDeliveryV5.mjs')),'V5 no autoriza mint'),
    check('DRAFT_50_PERCENT_NO_RESERVATION',/saleReserveNumerator\s*:\s*50\b/.test(draft) && /reservedSerials\s*:\s*Object\.freeze\(\[\]\)/.test(draft),'El borrador V4 contiene el 50% y cero NFT reservados'),
    check('DRAFT_15_10_90',/serviceNetShareNumerator\s*:\s*15\b/.test(draft) && /investmentPortfolioMaxNumerator\s*:\s*10\b/.test(draft) && /liquidPortfolioMinNumerator\s*:\s*90\b/.test(draft),'El borrador incluye 15% servicios, máximo 10% inversión, mínimo 90% líquido'),
    check('LEGACY_0001_SALE_PATH_RECONCILED',!/plan\.tokenId\s*<\s*2\b/.test(intent) && !/BETWEEN 2 AND 1000/.test(intent) && !/reservedSerial\s*:\s*1\b/.test(redemption),'Las rutas legacy deben adaptarse sin mutar los registros históricos'),
    check('MAINNET_CONTRACT_DEPLOYED_INDEPENDENTLY_VERIFIED',false,'Plan de creación de bytecode no prueba despliegue ERC-721, roles ni dirección en Base'),
    check('POLICY_V4_LEGALLY_AND_OPERATIONALLY_APPROVED',false,'El porcentaje V4 sigue como borrador sin corte histórico autorizado'),
    check('ETHEREUM_AND_BASE_TREASURY_CUSTODY_RECONCILED',false,'Falta conciliación independiente de bóvedas, obligaciones y activo de rescate en Base'),
    check('ATOMIC_REDEMPTION_AUDITED',false,'No existe liquidación atómica verificada en Base para pagar y quemar'),
  ];
  const sourceHashes = PREFLIGHT_FILES.map(path=>({path,sha256:source.get(path)===null?null:sha(source.get(path))}));
  const stable = {
    schema:LAUNCH_PREFLIGHT_VERSION,
    section:'STATIC_SOURCE_ONLY',
    sourceHashes,
    checks,
    localWranglerPaymentFlags:paymentFlags,
    runtimeConfigIndependentlyVerified:false,
    mainnetLaunchSourceIsPreparation:/MAINNET_LAUNCH_PROFILE/.test(mainnet) && /publicSalesReady\s*:\s*false/.test(mainnet),
    sourceAssessedAsProductionDeployment:false,
    issueCount:checks.filter(c=>c.status==='BLOCKED').length,
    existingPaymentsModified:false, existingCheckoutBlocked:false,
    newGenesisFeatureReviewRequired:true,
    status:'NEW_FEATURES_REQUIRE_INDEPENDENT_REVIEW',
  };
  return Object.freeze({...stable, reportHash:digest(stable)});
}

function query(storage, sql, ...params) {
  try { const out=storage.sql.exec(sql,...params).toArray(); if(!Array.isArray(out))fail('INVALID_SQL_RESULT');return out; }
  catch(e) { if(String(e?.message??'').startsWith('OX_LAUNCH_V7_'))throw e;fail('QUERY_FAILED'); }
}
const count=(storage,sql,...p)=>{const r=query(storage,sql,...p);if(r.length!==1||!Number.isSafeInteger(Number(r[0]?.n)))fail('COUNT_INVALID');return Number(r[0].n)};
const tables=storage=>new Set(query(storage,"SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name));
/** Reads aggregated, privacy-safe data ONLY from a local SQLite backup or a trusted storage object. */
export function auditLaunchStorageV7(storage) {
  if (!storage?.sql || typeof storage.sql.exec!=='function') fail('STORAGE_REQUIRED');
  const present=tables(storage);
  const essential=['founding_orders','payment_attempts','payment_settlements','inventory_allocations','founding_memberships','nft_mint_jobs'];
  const missing=essential.filter(t=>!present.has(t));
  const counts={ ordersTotal:null,ordersCreated:null,ordersPaid:null,settlements:null,allocations:null,memberships:null,mintJobs:null,legacyRareAssets:null,genesisPaidAllocations:null,ledgerEvents:null };
  const anomalies=[];
  if(missing.length===0){
    counts.ordersTotal=count(storage,'SELECT COUNT(*) AS n FROM founding_orders');
    counts.ordersCreated=count(storage,"SELECT COUNT(*) AS n FROM founding_orders WHERE status='CREATED'");
    counts.ordersPaid=count(storage,"SELECT COUNT(*) AS n FROM founding_orders WHERE status='PAID'");
    counts.settlements=count(storage,'SELECT COUNT(*) AS n FROM payment_settlements');
    counts.allocations=count(storage,'SELECT COUNT(*) AS n FROM inventory_allocations');
    counts.memberships=count(storage,'SELECT COUNT(*) AS n FROM founding_memberships');
    counts.mintJobs=count(storage,'SELECT COUNT(*) AS n FROM nft_mint_jobs');
    if(present.has('nft_release_assets')) counts.legacyRareAssets=count(storage,'SELECT COUNT(*) AS n FROM nft_release_assets');
    counts.genesisPaidAllocations=count(storage,'SELECT COUNT(*) AS n FROM inventory_allocations WHERE serial_number=1');
    // Check EVERY paid order; never infer a settlement from PAID alone.
    const brokenPaid=count(storage,`SELECT COUNT(*) AS n FROM founding_orders o
      WHERE o.status='PAID' AND (
        (SELECT COUNT(*) FROM payment_settlements s WHERE s.order_id=o.id)<>1 OR
        (SELECT COUNT(*) FROM inventory_allocations a WHERE a.order_id=o.id)<>1 OR
        (SELECT COUNT(*) FROM founding_memberships m WHERE m.order_id=o.id)<>1 OR
        (SELECT COUNT(*) FROM nft_mint_jobs j WHERE j.order_id=o.id)<>1)`);
    if(brokenPaid)anomalies.push({code:'PAID_ORDER_CHAIN_INCOMPLETE',count:brokenPaid});
    const invalidSettlement=count(storage,`SELECT COUNT(*) AS n FROM payment_settlements s
      LEFT JOIN founding_orders o ON o.id=s.order_id
      LEFT JOIN payment_attempts a ON a.id=s.payment_attempt_id
      WHERE o.id IS NULL OR o.status<>'PAID' OR a.id IS NULL OR a.status<>'VERIFIED'
        OR a.order_id<>o.id OR lower(a.tx_hash)<>lower(s.external_reference)
        OR s.network<>'ethereum-mainnet' OR s.chain_id<>1 OR a.chain_id<>1
        OR s.confirmations<12 OR lower(s.token_contract)<>?
        OR lower(a.token_contract)<>lower(s.token_contract)
        OR lower(s.receiver_address)<>lower(a.receiver_address)
        OR s.amount_minor<>a.expected_amount_minor
        OR s.amount_minor<>o.reference_price_usd*1000000`,ETH_USDT);
    if(invalidSettlement)anomalies.push({code:'PAYMENT_SETTLEMENT_MISMATCH',count:invalidSettlement});
    const invalidAlloc=count(storage,`SELECT COUNT(*) AS n FROM inventory_allocations a
      LEFT JOIN founding_orders o ON o.id=a.order_id
      LEFT JOIN payment_settlements s ON s.order_id=o.id
      WHERE o.id IS NULL OR o.status<>'PAID' OR s.id IS NULL
        OR lower(a.settlement_reference)<>lower(s.external_reference)`);
    if(invalidAlloc)anomalies.push({code:'ALLOCATIONS_WITHOUT_PAID_SOURCE',count:invalidAlloc});
    const serialMismatch=count(storage,`SELECT COUNT(*) AS n FROM inventory_allocations a
      LEFT JOIN founding_memberships m ON m.order_id=a.order_id AND m.serial_number=a.serial_number
      LEFT JOIN nft_mint_jobs j ON j.order_id=a.order_id AND j.serial_number=a.serial_number
      WHERE m.id IS NULL OR j.id IS NULL`);
    if(serialMismatch)anomalies.push({code:'NFT_ALLOCATION_MEMBERSHIP_MINT_MISMATCH',count:serialMismatch});
    if(counts.genesisPaidAllocations>1)anomalies.push({code:'DUPLICATE_GENESIS_ALLOCATION',count:counts.genesisPaidAllocations});
    if(counts.genesisPaidAllocations>0 && !present.has('ox_genesis_checkout_v6'))anomalies.push({code:'GENESIS_V6_ALLOCATION_UNRECONCILED',count:counts.genesisPaidAllocations});
    if(present.has('ox_genesis_checkout_v6')){
      const gs=query(storage,'SELECT state,order_id,settlement_reference FROM ox_genesis_checkout_v6 WHERE serial_number=1');
      if(gs.length!==1){anomalies.push({code:'GENESIS_V6_STATE_MISSING_OR_AMBIGUOUS',count:gs.length});}
      else {
        const state=gs[0];
        const sold=query(storage,'SELECT order_id,settlement_reference FROM inventory_allocations WHERE serial_number=1');
        if(state.state==='ALLOCATED') {
          if(sold.length!==1 || sold[0].order_id!==state.order_id || String(sold[0].settlement_reference).toLowerCase()!==String(state.settlement_reference).toLowerCase())anomalies.push({code:'GENESIS_V6_PAID_STATE_DRIFT',count:1});
        } else if(sold.length || !['AVAILABLE','RESERVED'].includes(state.state))anomalies.push({code:'GENESIS_V6_STATE_DRIFT',count:1});
      }
    }
    if(present.has('ox_inventory_cutovers_v5')) {
      const stage=query(storage,'SELECT version,status,legacy_row_count,imported_row_count FROM ox_inventory_cutovers_v5');
      const shadow=present.has('ox_release_assets_v5')?count(storage,'SELECT COUNT(*) AS n FROM ox_release_assets_v5'):null;
      if(stage.length!==1 || stage[0].status!=='STAGED_NOT_ACTIVE' || stage[0].version!=='OX-INVENTORY-CUTOVER-5' ||
         shadow===null || stage[0].imported_row_count!==shadow || stage[0].legacy_row_count+1!==shadow)
        anomalies.push({code:'V5_SHADOW_STAGE_INCONSISTENT',count:1});
    }
    if(present.has('ox_reserve_movements'))counts.ledgerEvents=count(storage,'SELECT COUNT(*) AS n FROM ox_reserve_movements');
  }
  const checks=[
    check('REQUIRED_COMMERCE_TABLES',missing.length===0,missing.length?'Faltan tablas del checkout en el respaldo':'Esquema básico presente'),
    check('PAID_ORDER_RELATIONSHIPS_COHERENT',!missing.length && anomalies.length===0,'Comprueba pedidos pagados, settlement, serial, membresía y mint job'),
    check('V5_STAGED_IN_INSPECTED_SQLITE_COPY',present.has('ox_inventory_cutovers_v5') && !anomalies.some(x=>x.code==='V5_SHADOW_STAGE_INCONSISTENT'),'Indica si una copia SQLite contiene staging V5; no afirma estado de Cloudflare'),
    check('V6_GENESIS_INITIALIZED_IN_INSPECTED_SQLITE_COPY',present.has('ox_genesis_checkout_v6') && !anomalies.some(x=>x.code.startsWith('GENESIS_')),'Indica si la copia SQLite contiene V6; no consulta Cloudflare'),
    check('BLOCKCHAIN_SETTLEMENTS_REVERIFIED_AT_READ',false,'El respaldo SQLite contiene evidencia local, no una nueva comprobación del RPC'),
  ];
  const stable={schema:LAUNCH_PREFLIGHT_VERSION,section:'OPTIONAL_LOCAL_SQLITE_COPY',
    tablePresence:Object.freeze(Object.fromEntries([...essential,'nft_release_assets','ox_inventory_cutovers_v5','ox_release_assets_v5','ox_genesis_checkout_v6','ox_reserve_movements'].map(x=>[x,present.has(x)]))),
    missingTables:missing,counts,anomalies,checks,piiIncluded:false,externalRecordsMerged:false,
    productionDatabaseAccessed:false,chainQueried:false,ledgerCustodyIndependentlyVerified:false,
    existingPaymentsModified:false,existingCheckoutBlocked:false,
    issueCount:anomalies.length+missing.length,status:'OBSERVATION_ONLY_NOT_AUTHORIZATION'};
  return Object.freeze({...stable,reportHash:digest(stable)});
}

export function buildLaunchReadinessV7({sourceAudit,storageAudit=null}){
  if(sourceAudit?.schema!==LAUNCH_PREFLIGHT_VERSION || sourceAudit?.section!=='STATIC_SOURCE_ONLY' ||
     !HASH.test(sourceAudit.reportHash??'') || sourceAudit.reportHash!==digest(Object.fromEntries(Object.entries(sourceAudit).filter(([k])=>k!=='reportHash'))))fail('SOURCE_REPORT_INVALID');
  if(storageAudit!==null && (storageAudit?.schema!==LAUNCH_PREFLIGHT_VERSION || storageAudit?.section!=='OPTIONAL_LOCAL_SQLITE_COPY' ||
     !HASH.test(storageAudit.reportHash??'') || storageAudit.reportHash!==digest(Object.fromEntries(Object.entries(storageAudit).filter(([k])=>k!=='reportHash')))))fail('STORAGE_REPORT_INVALID');
  const checks=[...sourceAudit.checks,...(storageAudit?.checks??[])];
  const stable={schema:LAUNCH_PREFLIGHT_VERSION,collection:{size:6000,reserved:0,tiers:TIER_RANGES},
    sourceReportHash:sourceAudit.reportHash,optionalBackupReportHash:storageAudit?.reportHash??null,
    sourceOnly:storageAudit===null,localChecksPassed:checks.filter(x=>x.status==='PASS').length,
    localChecksBlocked:checks.filter(x=>x.status==='BLOCKED').length,
    launchBlockers:[
      'NO_APPROVED_V4_POLICY_AND_HISTORICAL_CUTOVER',
      'NO_INDEPENDENT_MAINNET_ERC721_CONTRACT_AND_ROLE_PROOF',
      'NO_LIVE_ETHEREUM_USDT_SETTLEMENT_AND_TREASURY_RECONCILIATION',
      'NO_APPROVED_LIVE_GENESIS_RELEASE_AND_ORDER_POLICY',
      'NO_INTEGRATION_TEST_ON_SANITIZED_PRODUCTION_DO_BACKUP',
      'NO_BASE_SAME_CHAIN_ATOMIC_PAYOUT_BURN_AUDIT',
    ],
    reportIsApproval:false,genesisNewReleaseActivationAuthorized:false,
    newMintExecutionAuthorized:false,
    newReservePostingAuthorized:false,newInvestmentAuthorized:false,newRedemptionAuthorized:false,
    existingPaymentsModified:false,existingPaymentFlagsChanged:false,
    existingCheckoutBlocked:false,existingPaymentRoutesChanged:false,
    paymentRuntimeStateIndependentlyVerified:false,
    useForReleaseDecision:'ADVISORY_ONLY_NOT_A_PAYMENT_GATE',
    status:'NEW_GENESIS_FEATURES_REQUIRE_REVIEW_EXISTING_PAYMENTS_UNCHANGED'};
  return Object.freeze({...stable,reportHash:digest(stable)});
}
