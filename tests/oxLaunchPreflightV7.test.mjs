import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {
  LAUNCH_PREFLIGHT_VERSION,PREFLIGHT_FILES,auditLaunchSourceV7,
  auditLaunchStorageV7,buildLaunchReadinessV7
} from '../cloudflare/oxLaunchPreflightV7.mjs';
import {launchPreflightCli} from '../scripts/oxLaunchPreflightV7.mjs';
const H='a'.repeat(64),TX='0x'+'1'.repeat(64),TOKEN='0xdac17f958d2ee523a2206206994597c13d831ec7',WALLET='0x'+'2'.repeat(40);
function source(){
  return {
    'cloudflare/commerceCore.mjs':'genesisCheckout simulateGenesisReservationV6 simulateGenesisAllocationV6',
    'cloudflare/foundingCore.mjs':'new CommerceCore(state.storage, {rareRelease: null})',
    'cloudflare/worker.mjs':'function publicUsdtApiEnabled() {} /api/payments/usdt/attempts /internal/orders',
    'cloudflare/oxGenesisCheckoutV6.mjs':"INTERNAL_REVIEW_ONLY if(config.salesActivationApproved !== false)throw Error()",
    'cloudflare/oxPaidGenesisDeliveryV5.mjs':"PREPARED_NOT_AUTHORIZED mintAuthority:false",
    'cloudflare/rareArcadeRelease.mjs':'export const rareArcadeRelease={"approvedForSale":false};',
    'cloudflare/nftPaidDeliveryIntent.mjs':'if(plan.tokenId < 2)throw Error(); CHECK(serial_number BETWEEN 2 AND 1000)',
    'cloudflare/nftPostSaleRedemptionPreparation.mjs':'reservedSerial: 1',
    'cloudflare/oxReservePolicyV4Draft.mjs':'saleReserveNumerator: 50, reservedSerials: Object.freeze([]), serviceNetShareNumerator: 15, investmentPortfolioMaxNumerator: 10, liquidPortfolioMinNumerator: 90',
    'cloudflare/nftMainnetLaunchPreparation.mjs':'MAINNET_LAUNCH_PROFILE publicSalesReady: false',
    'wrangler.jsonc':JSON.stringify({vars:{PUBLIC_CHECKOUT_ENABLED:'true',PAYMENT_READINESS:'true',REAL_PAYMENTS_ENABLED:'true',CLOUDFLARE_USDT_API_ENABLED:'true'}}),
  };
}
const audit=(s=source())=>auditLaunchSourceV7(p=>s[p]);
const statuses=x=>Object.fromEntries(x.checks.map(c=>[c.id,c.status]));
function storage(){
  const db=new DatabaseSync(':memory:');
  const st={sql:{exec(q,...p){return {toArray:()=>db.prepare(q).all(...p)};}}};
  return {db,st};
}
function schema(db){
 db.exec(`CREATE TABLE founding_orders (id TEXT PRIMARY KEY,status TEXT,reference_price_usd INTEGER);
 CREATE TABLE payment_attempts (id TEXT PRIMARY KEY,order_id TEXT,tx_hash TEXT,status TEXT,chain_id INTEGER,token_contract TEXT,receiver_address TEXT,expected_amount_minor INTEGER);
 CREATE TABLE payment_settlements (id TEXT PRIMARY KEY,order_id TEXT,payment_attempt_id TEXT,external_reference TEXT,network TEXT,chain_id INTEGER,token_contract TEXT,receiver_address TEXT,confirmations INTEGER,amount_minor INTEGER);
 CREATE TABLE inventory_allocations (order_id TEXT,serial_number INTEGER,settlement_reference TEXT);
 CREATE TABLE founding_memberships (id TEXT PRIMARY KEY,order_id TEXT,serial_number INTEGER);
 CREATE TABLE nft_mint_jobs (id TEXT PRIMARY KEY,order_id TEXT,serial_number INTEGER);
 CREATE TABLE nft_release_assets (serial_number INTEGER PRIMARY KEY,state TEXT);
 `);
}
function paid(db,serial=2){
  db.prepare("INSERT INTO founding_orders VALUES ('order-1','PAID',50)").run();
  db.prepare("INSERT INTO payment_attempts VALUES ('attempt-1','order-1',?,'VERIFIED',1,?,?,50000000)").run(TX,TOKEN,WALLET);
  db.prepare("INSERT INTO payment_settlements VALUES ('settlement-1','order-1','attempt-1',?,'ethereum-mainnet',1,?,?,12,50000000)").run(TX,TOKEN,WALLET);
  db.prepare('INSERT INTO inventory_allocations VALUES (?,?,?)').run('order-1',serial,TX);
  db.prepare('INSERT INTO founding_memberships VALUES (?,?,?)').run('member-1','order-1',serial);
  db.prepare('INSERT INTO nft_mint_jobs VALUES (?,?,?)').run('job-1','order-1',serial);
  db.prepare("INSERT INTO nft_release_assets VALUES(2,'ALLOCATED')").run();
}
test('file list is exact and bounded; no secrets or network sources',()=>{
 assert.equal(PREFLIGHT_FILES.length,11);
 assert.ok(PREFLIGHT_FILES.every(p=>!p.includes('..') && !p.startsWith('/')));
 assert.equal(LAUNCH_PREFLIGHT_VERSION,'OX-LAUNCH-PREFLIGHT-7');
});
test('intact source reports V6 simulation safe but V4 policy unapproved',()=>{
 const a=audit(),s=statuses(a);
 assert.equal(s.GENESIS_NOT_EXPOSED_IN_WORKER,'PASS');
 assert.equal(s.PAYMENT_FLAGS_TRUE_IN_REPO,'PASS');
 assert.equal(s.PUBLIC_PAYMENT_ROUTES_EXIST_IN_SOURCE,'PASS');
 assert.equal(s.GENESIS_RELEASE_NOT_APPROVED,'PASS');
 assert.equal(s.DRAFT_50_PERCENT_NO_RESERVATION,'PASS');
 assert.equal(s.DRAFT_15_10_90,'PASS');
 assert.equal(s.LEGACY_0001_SALE_PATH_RECONCILED,'BLOCKED');
 assert.equal(s.MAINNET_CONTRACT_DEPLOYED_INDEPENDENTLY_VERIFIED,'BLOCKED');
 assert.equal(a.localWranglerPaymentFlags.REAL_PAYMENTS_ENABLED,'true');
 assert.equal(a.runtimeConfigIndependentlyVerified,false);
});
test('source missing or maliciously changed alerts without changing payment execution',()=>{
 const s=source();delete s['wrangler.jsonc'];
 assert.equal(statuses(audit(s)).REQUIRED_SOURCE_FILES_PRESENT,'BLOCKED');
 const t=source();t['cloudflare/rareArcadeRelease.mjs']='{"approvedForSale":true}';
 assert.equal(statuses(audit(t)).GENESIS_RELEASE_NOT_APPROVED,'BLOCKED');
 const c=source();c['wrangler.jsonc']=JSON.stringify({vars:{PUBLIC_CHECKOUT_ENABLED:'false'}});
 assert.equal(statuses(audit(c)).PAYMENT_FLAGS_TRUE_IN_REPO,'BLOCKED');
 const u=source();u['cloudflare/foundingCore.mjs']='new CommerceCore(x,{genesisCheckout:{}})';
 assert.equal(statuses(audit(u)).GENESIS_NOT_EXPOSED_IN_WORKER,'BLOCKED');
});
test('50% without 15/10/90 is incompatible and not silently accepted',()=>{
 const s=source();s['cloudflare/oxReservePolicyV4Draft.mjs']='saleReserveNumerator: 50 reservedSerials: Object.freeze([])';
 assert.equal(statuses(audit(s)).DRAFT_15_10_90,'BLOCKED');
});
test('source digest reproducible and changes on any file mutation',()=>{
 const a=audit(),b=audit();assert.equal(a.reportHash,b.reportHash);
 const s=source();s['cloudflare/commerceCore.mjs']+=' ';
 assert.notEqual(audit(s).reportHash,a.reportHash);
});
test('empty SQLite memory DB reports missing tables without inventing balances',()=>{
 const f=storage(),a=auditLaunchStorageV7(f.st);
 assert.equal(a.missingTables.length,6);assert.equal(a.counts.ordersPaid,null);
 assert.equal(a.piiIncluded,false);assert.equal(a.chainQueried,false);
 assert.equal(statuses(a).REQUIRED_COMMERCE_TABLES,'BLOCKED');f.db.close();
});
test('paid purchase with matched settlement, NFT and member is coherent but not proof of chain',()=>{
 const f=storage();schema(f.db);paid(f.db);
 const a=auditLaunchStorageV7(f.st);assert.equal(a.anomalies.length,0);
 assert.equal(a.counts.ordersPaid,1);assert.equal(a.counts.genesisPaidAllocations,0);
 assert.equal(statuses(a).PAID_ORDER_RELATIONSHIPS_COHERENT,'PASS');
 assert.equal(statuses(a).BLOCKCHAIN_SETTLEMENTS_REVERIFIED_AT_READ,'BLOCKED');
 assert.equal(JSON.stringify(a).includes('order-1'),false);
 assert.equal(JSON.stringify(a).includes(TX),false);f.db.close();
});
test('paid status without payment/serial/mint is explicitly flagged',()=>{
 const f=storage();schema(f.db);f.db.exec("INSERT INTO founding_orders VALUES ('dangling','PAID',50)");
 const a=auditLaunchStorageV7(f.st);
 assert.ok(a.anomalies.some(x=>x.code==='PAID_ORDER_CHAIN_INCOMPLETE'));f.db.close();
});
test('settlement wrong chain, value, attempt status or contract is rejected',()=>{
 const f=storage();schema(f.db);paid(f.db);
 f.db.exec("UPDATE payment_settlements SET chain_id=8453,amount_minor=1");
 let a=auditLaunchStorageV7(f.st);assert.ok(a.anomalies.some(x=>x.code==='PAYMENT_SETTLEMENT_MISMATCH'));
 f.db.exec("UPDATE payment_settlements SET chain_id=1,amount_minor=50000000");
 f.db.exec("UPDATE payment_attempts SET status='AWAITING_TRANSFER'");
 a=auditLaunchStorageV7(f.st);assert.ok(a.anomalies.some(x=>x.code==='PAYMENT_SETTLEMENT_MISMATCH'));f.db.close();
});
test('an allocation must match a member/mint job and settled tx reference',()=>{
 const f=storage();schema(f.db);paid(f.db);
 f.db.exec("UPDATE inventory_allocations SET settlement_reference='unverified'");
 f.db.exec("UPDATE nft_mint_jobs SET serial_number=50");
 const codes=auditLaunchStorageV7(f.st).anomalies.map(x=>x.code);
 assert.ok(codes.includes('ALLOCATIONS_WITHOUT_PAID_SOURCE'));
 assert.ok(codes.includes('NFT_ALLOCATION_MEMBERSHIP_MINT_MISMATCH'));f.db.close();
});
test('genesis sale cannot exist without synchronized V6 shadow state',()=>{
 const f=storage();schema(f.db);paid(f.db,1);
 const a=auditLaunchStorageV7(f.st);
 assert.ok(a.anomalies.some(x=>x.code==='GENESIS_V6_ALLOCATION_UNRECONCILED'));f.db.close();
});
test('simulated V6 state matches a Genesis allocated order only with exact tx',()=>{
 const f=storage();schema(f.db);paid(f.db,1);
 f.db.exec('CREATE TABLE ox_genesis_checkout_v6(serial_number INTEGER,state TEXT,order_id TEXT,settlement_reference TEXT)');
 f.db.prepare("INSERT INTO ox_genesis_checkout_v6 VALUES(1,'ALLOCATED','order-1',?)").run(TX);
 let a=auditLaunchStorageV7(f.st);
 assert.ok(!a.anomalies.some(x=>x.code.startsWith('GENESIS_')));
 f.db.exec("UPDATE ox_genesis_checkout_v6 SET settlement_reference='0xwrong'");
 a=auditLaunchStorageV7(f.st);assert.ok(a.anomalies.some(x=>x.code==='GENESIS_V6_PAID_STATE_DRIFT'));
 f.db.close();
});
test('V5 shadow requires staged marker and matching row counts',()=>{
 const f=storage();schema(f.db);
 f.db.exec("CREATE TABLE ox_inventory_cutovers_v5(version TEXT,status TEXT,legacy_row_count INTEGER,imported_row_count INTEGER)");
 f.db.exec("CREATE TABLE ox_release_assets_v5(serial_number INTEGER)");
 f.db.exec("INSERT INTO ox_inventory_cutovers_v5 VALUES ('OX-INVENTORY-CUTOVER-5','STAGED_NOT_ACTIVE',2,3)");
 let a=auditLaunchStorageV7(f.st);
 assert.ok(a.anomalies.some(x=>x.code==='V5_SHADOW_STAGE_INCONSISTENT'));
 f.db.exec('INSERT INTO ox_release_assets_v5 VALUES (1),(2),(3)');
 a=auditLaunchStorageV7(f.st);
 assert.equal(statuses(a).V5_STAGED_IN_INSPECTED_SQLITE_COPY,'PASS');f.db.close();
});
test('even coherent local data never authorizes NEW Genesis/mint/reserve/redemption features; live checkout untouched',()=>{
 const f=storage();schema(f.db);paid(f.db);
 const s=audit(),b=auditLaunchStorageV7(f.st),r=buildLaunchReadinessV7({sourceAudit:s,storageAudit:b});
 for(const name of ['reportIsApproval','genesisNewReleaseActivationAuthorized','newMintExecutionAuthorized','newReservePostingAuthorized','newInvestmentAuthorized','newRedemptionAuthorized'])assert.equal(r[name],false);
 assert.equal(r.existingCheckoutBlocked,false);assert.equal(r.existingPaymentFlagsChanged,false);assert.equal(r.existingPaymentRoutesChanged,false);
 assert.equal(r.status,'NEW_GENESIS_FEATURES_REQUIRE_REVIEW_EXISTING_PAYMENTS_UNCHANGED');assert.equal(r.sourceOnly,false);
 assert.equal(r.launchBlockers.length,6);f.db.close();
});
test('forged or changed input audit hashes rejected',()=>{
 const s=audit();assert.throws(()=>buildLaunchReadinessV7({sourceAudit:{...s,checks:[]}}),/SOURCE_REPORT_INVALID/);
 assert.throws(()=>buildLaunchReadinessV7({sourceAudit:{...s,reportHash:H}}),/SOURCE_REPORT_INVALID/);
});
test('CLI can produce privacy-safe report without touching any database',()=>{
 const root=mkdtempSync(join(tmpdir(),'oxlaunch-v7-'));const s=source();
 try{
  for(const [p,v] of Object.entries(s)){mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),v);}
  const out=[];const code=launchPreflightCli({argv:['--json'],root,output:x=>out.push(x)});
  assert.equal(code,0);const x=JSON.parse(out.join(''));
  assert.equal(x.backupAudit,null);assert.equal(x.report.sourceOnly,true);
  assert.equal(x.report.status,'NEW_GENESIS_FEATURES_REQUIRE_REVIEW_EXISTING_PAYMENTS_UNCHANGED');
  assert.throws(()=>launchPreflightCli({argv:['--strict'],root,output:()=>{}}),/UNKNOWN_ARGUMENT/);
  assert.throws(()=>launchPreflightCli({argv:['--sqlite'],root,output:()=>{}}),/SQLITE_PATH_REQUIRED/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('CLI reads an explicit local SQLite copy read-only; never outputs PII',()=>{
 const root=mkdtempSync(join(tmpdir(),'oxlaunch-v7-sqlite-'));const s=source();
 try{
  for(const [p,v] of Object.entries(s)){mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),v);}
  const file=join(root,'backup.sqlite'),db=new DatabaseSync(file);schema(db);paid(db);db.close();
  const out=[];const code=launchPreflightCli({argv:['--sqlite',file,'--json'],root,output:x=>out.push(x)});
  assert.equal(code,0);const text=out.join(''),result=JSON.parse(text);
  assert.equal(result.backupAudit.counts.ordersPaid,1);assert.equal(result.backupAudit.piiIncluded,false);
  assert.equal(text.includes(TX),false);assert.equal(text.includes('order-1'),false);
  const alias=join(root,'alias.sqlite');symlinkSync(file,alias);
  assert.throws(()=>launchPreflightCli({argv:['--sqlite',alias],root,output:()=>{}}),/REGULAR_FILE/);
  const readDb=new DatabaseSync(file,{readOnly:true});
  assert.equal(readDb.prepare('SELECT COUNT(*) AS n FROM payment_settlements').get().n,1);readDb.close();
 }finally{rmSync(root,{recursive:true,force:true});}
});
