/* Founding 6000 V9: separate admin Worker; read-only relay to V8 Durable Object.
 * Explicitly disabled by default. No checkout/payment/mint/mail writes.
 */
import { timingSafeEqual } from 'node:crypto';
export const ADMIN_V9_VERSION = 'OX-PURCHASE-ADMIN-9';
const INTERNAL = 'https://founding-core.internal/internal/ops/purchase-status-v8';
const EXACT_PATH = '/v1/purchases/status';
const SECURITY_HEADERS = Object.freeze({
  'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
});
function response(value,status){return Response.json(value,{status,headers:SECURITY_HEADERS});}
function equalSecret(actual,expected){
  if(typeof actual!=='string'||typeof expected!=='string'||expected.length<48||expected.length>256||actual.length!==expected.length)return false;
  return timingSafeEqual(new TextEncoder().encode(actual),new TextEncoder().encode(expected));
}
export async function handlePurchaseAdminV9(request,env){
  let url;
  try{url=new URL(request?.url);}catch{return response({error:'NOT_FOUND'},404);}
  if(request.method!=='GET'||url.pathname!==EXACT_PATH||url.search||url.hash)return response({error:'NOT_FOUND'},404);
  if(env?.OX_ADMIN_V9_ENABLED!=='true')return response({error:'NOT_FOUND'},404);
  const header=request.headers.get('Authorization')??'';
  const match=/^Bearer ([A-Za-z0-9_-]{48,256})$/.exec(header);
  if(!match||!equalSecret(match[1],env.OX_ADMIN_V9_READ_KEY))return response({error:'NOT_FOUND'},404);
  if(!env?.FOUNDING_CORE||typeof env.FOUNDING_CORE.idFromName!=='function'||typeof env.FOUNDING_CORE.get!=='function'||
     typeof env.OX_PURCHASE_MONITOR_V8_KEY!=='string'||env.OX_PURCHASE_MONITOR_V8_KEY.length<32||env.OX_PURCHASE_MONITOR_V8_KEY.length>256){
    return response({error:'SERVICE_UNAVAILABLE'},503);
  }
  try{
    const core=env.FOUNDING_CORE.get(env.FOUNDING_CORE.idFromName('canonical-founding-6000'));
    const upstream=await core.fetch(new Request(INTERNAL,{method:'GET',headers:{'x-ox-monitor-key':env.OX_PURCHASE_MONITOR_V8_KEY}}));
    if(!upstream.ok)return response({error:'MONITOR_UNAVAILABLE'},503);
    const raw=await upstream.text();
    if(raw.length>65536)return response({error:'MONITOR_UNAVAILABLE'},503);
    const payload=JSON.parse(raw);
    if(payload?.schema!=='OX-PURCHASE-MONITOR-8'||
       !['LOCAL_RECORDS_CONSISTENT','REVIEW_REQUIRED','SCHEMA_INCOMPLETE'].includes(payload.status)||
       !payload.source||payload.source!=='LOCAL_DURABLE_OBJECT_SQLITE')return response({error:'MONITOR_UNAVAILABLE'},503);
    // Explicit privacy allowlist. Never proxy arbitrary DO properties to public HTTP.
    const safe={schema:ADMIN_V9_VERSION,monitorSchema:payload.schema,
      status:payload.status,counts:payload.counts??null,anomalies:payload.anomalies??null,
      missingTables:payload.missingTables??[],reportHash:payload.reportHash??null,
      independentChainProof:false,transactionWriteAuthorized:false};
    return response(safe,200);
  }catch{return response({error:'MONITOR_UNAVAILABLE'},503);}
}
export default {fetch:handlePurchaseAdminV9};
