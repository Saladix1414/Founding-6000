#!/usr/bin/env node
/** Offline, read-only operator CLI. No network, secrets or Cloudflare operations. */
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {auditLaunchSourceV7,auditLaunchStorageV7,buildLaunchReadinessV7} from '../cloudflare/oxLaunchPreflightV7.mjs';

export function launchPreflightCli({argv,root,output=process.stdout.write.bind(process.stdout)}){
  let path=null, json=false;
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--json')json=true;
    else if(arg==='--sqlite'){
      if(path!==null || !argv[i+1] || argv[i+1].startsWith('--'))throw new Error('OX_V7_SQLITE_PATH_REQUIRED');
      path=resolve(argv[++i]);
    } else if(arg==='--help') {
      output('Usage: node scripts/oxLaunchPreflightV7.mjs [--sqlite /path/local-backup.sqlite] [--json]\n');
      return 0;
    }else throw new Error('OX_V7_UNKNOWN_ARGUMENT');
  }
  const source=auditLaunchSourceV7(p=>readFileSync(join(root,p),'utf8'));
  let backup=null;
  if(path!==null){
    const st=lstatSync(path);
    if(!st.isFile() || st.isSymbolicLink())throw new Error('OX_V7_SQLITE_COPY_MUST_BE_REGULAR_FILE');
    const db=new DatabaseSync(path,{readOnly:true});
    try{
      const isReadonly=db.prepare('PRAGMA query_only').get()?.query_only;
      if(isReadonly!==0 && isReadonly!==1)throw new Error('OX_V7_SQLITE_PRAGMA_INVALID');
      // SQLite opened readOnly:true; query_only further forbids any mutation.
      db.exec('PRAGMA query_only=ON');
      const store={sql:{exec(q,...params){return {toArray:()=>db.prepare(q).all(...params)};}}};
      backup=auditLaunchStorageV7(store);
    }finally{db.close();}
  }
  const report=buildLaunchReadinessV7({sourceAudit:source,storageAudit:backup});
  if(json)output(JSON.stringify({report,sourceAudit:source,backupAudit:backup},null,2)+'\n');
  else{
    output(`ORIGINX ${report.schema} | ${report.status}\n`);
    output(`Fuente: ${source.reportHash}\n`);
    output(`SQLite local: ${backup?backup.reportHash:'NO SUMINISTRADA'}\n`);
    for(const c of source.checks)output(`[${c.status}] ${c.id}\n`);
    if(backup){for(const c of backup.checks)output(`[${c.status}] ${c.id}\n`);for(const a of backup.anomalies)output(`[INCIDENCIA] ${a.code}: ${a.count}\n`);}
    output(`FINAL: ${report.status} / hash ${report.reportHash}\n`);
    output('No verifica RPC live, no envía pagos, no activa mint ni reserva ni rescate.\n');
    output('Los cobros existentes quedan intactos; este informe NO es una barrera de checkout.\n');
  }
  return 0; // Advisory ONLY: never gate existing payments or checkout.
}

if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  try{process.exitCode=launchPreflightCli({argv:process.argv.slice(2),root:resolve(process.cwd())});}
  catch(e){process.stderr.write(`Launch preflight rechazado: ${e.message}\n`);process.exitCode=1;}
}
