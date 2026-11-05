import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePurchaseAdminV9} from '../cloudflare/oxPurchaseAdminV9.mjs';
const key='x'.repeat(56), other='m'.repeat(48);
const url='https://admin.example/v1/purchases/status';
const state={fetches:0,names:[]};
const snapshot={schema:'OX-PURCHASE-MONITOR-8',status:'LOCAL_RECORDS_CONSISTENT',source:'LOCAL_DURABLE_OBJECT_SQLITE',
  counts:{orders:{PAID:3}},anomalies:{paidWithoutCompleteDeliveryChain:0},missingTables:[],reportHash:'a'.repeat(64),email:'should-never-leak'};
const env=()=>({OX_ADMIN_V9_ENABLED:'true',OX_ADMIN_V9_READ_KEY:key,OX_PURCHASE_MONITOR_V8_KEY:other,
 FOUNDING_CORE:{idFromName(n){state.names.push(n);return n;},get(id){return {async fetch(r){state.fetches++;assert.equal(id,'canonical-founding-6000');
   assert.equal(r.headers.get('x-ox-monitor-key'),other);assert.equal(new URL(r.url).pathname,'/internal/ops/purchase-status-v8');return Response.json(snapshot);}}}}});
const request=(token=key,path=url,method='GET')=>new Request(path,{method,headers:{Authorization:`Bearer ${token}`}});
test('V9 disabled by default even for valid credential',async()=>{const e=env();e.OX_ADMIN_V9_ENABLED='false';const before=state.fetches;
 assert.equal((await handlePurchaseAdminV9(request(),e)).status,404);assert.equal(state.fetches,before);});
test('V9 rejects wrong token, altered length, path, query and method before reading DO',async()=>{const e=env(),before=state.fetches;
 for(const r of [request('bad'),request('z'.repeat(56)),request(key,url+'?export=1'),request(key,url+'/other'),request(key,url,'POST')])
 assert.equal((await handlePurchaseAdminV9(r,e)).status,404);
 assert.equal(state.fetches,before);});
test('V9 authorized report uses canonical singleton and strips unapproved fields',async()=>{const r=await handlePurchaseAdminV9(request(),env());assert.equal(r.status,200);
 assert.equal(r.headers.get('cache-control'),'no-store');const obj=await r.json();assert.equal(obj.counts.orders.PAID,3);
 assert.equal(obj.email,undefined);assert.equal(obj.independentChainProof,false);assert.equal(obj.transactionWriteAuthorized,false);});
test('V9 fails closed without independent DO credential or binding',async()=>{const e=env();delete e.OX_PURCHASE_MONITOR_V8_KEY;
 assert.equal((await handlePurchaseAdminV9(request(),e)).status,503);const f=env();delete f.FOUNDING_CORE;
 assert.equal((await handlePurchaseAdminV9(request(),f)).status,503);});
test('V9 refuses invalid upstream or upstream failure without leaking details',async()=>{const e=env();e.FOUNDING_CORE.get=()=>({fetch:async()=>Response.json({secret:'x'},{status:200})});
 assert.equal((await handlePurchaseAdminV9(request(),e)).status,503);
 e.FOUNDING_CORE.get=()=>({fetch:async()=>Response.json({error:'PRIVATE'}, {status:503})});
 const out=await handlePurchaseAdminV9(request(),e);assert.equal(out.status,503);assert.equal(JSON.stringify(await out.json()).includes('PRIVATE'),false);});
test('V9 source configuration binds external DO worker and is separately disabled',async()=>{const {readFileSync}=await import('node:fs');
 const cfg=JSON.parse(readFileSync(new URL('../cloudflare/wrangler.admin-v9.jsonc',import.meta.url)));
 assert.equal(cfg.durable_objects.bindings[0].script_name,'founding-6000-prelaunch');
 assert.equal(cfg.vars.OX_ADMIN_V9_ENABLED,'false');assert.equal(cfg.name,'founding-6000-admin-monitor-v9');
 assert.equal(Object.hasOwn(cfg.vars,'PUBLIC_CHECKOUT_ENABLED'),false);});
