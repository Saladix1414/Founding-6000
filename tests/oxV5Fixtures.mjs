import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {certifyGenesisArtifacts,GENESIS_ORIGIN} from '../cloudflare/oxGenesisReleaseV4.mjs';
import {initializeGenesisCandidateSchema,recordGenesisCandidate} from '../cloudflare/oxGenesisInventoryV4.mjs';

const SHA=x=>createHash('sha256').update(x).digest('hex');
const H='f'.repeat(64);
const cert=()=>{
  const img=Buffer.alloc(40);Buffer.from([137,80,78,71,13,10,26,10]).copy(img,0);
  img.writeUInt32BE(13,8);img.write('IHDR',12);img.writeUInt32BE(2048,16);img.writeUInt32BE(2048,20);
  const glyph=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const mediaHash=SHA(img),glyphHash=SHA(glyph);
  const meta={name:'Azhurak — The Primordial Witness',
    image:`${GENESIS_ORIGIN}/nft/rare/0001/image-${mediaHash}.png`,
    external_url:`${GENESIS_ORIGIN}/nft/rare/0001`,
    attributes:[{trait_type:'Founding Serial',value:'#0001'},{trait_type:'Tier',value:'RARE'}],
    originx:{tokenId:1,serial:'#0001',tier:'RARE',displayName:'Azhurak — The Primordial Witness',
      publicMetadataVersion:'OX-ERC721-PUBLIC-METADATA-1',
      authority:{metadataIsMintAuthority:false,metadataIsGovernanceAuthority:false},
      glyph:`${GENESIS_ORIGIN}/nft/rare/0001/glyph-${glyphHash}.svg`,
      visual:{approved:true,mediaHash},identity:{dnaHash:H,bundleHash:H,akashicLatestEventHash:H,internalMetadataHash:H}}};
  return certifyGenesisArtifacts({metadataBytes:Buffer.from(JSON.stringify(meta)),imageBytes:img,glyphBytes:glyph});
};
export { cert as makeV5TestCertificate };

export function makeV5Storage(){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  const storage={sql:{exec(sql,...params){
    if(!params.length&&!/^\s*(SELECT|WITH|PRAGMA)/i.test(sql)){
      db.exec(sql);return {toArray:()=>[]};
    }
    const stmt=db.prepare(sql);
    if(/^\s*(SELECT|WITH|PRAGMA)/i.test(sql))return {toArray:()=>stmt.all(...params)};
    stmt.run(...params);return {toArray:()=>[]};
  }}, transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}
    catch(e){db.exec('ROLLBACK');throw e;}}};
  db.exec(`CREATE TABLE nft_release_assets (serial_number INTEGER PRIMARY KEY CHECK(serial_number BETWEEN 2 AND 1000),
    batch_id TEXT NOT NULL,metadata_hash TEXT NOT NULL,media_hash TEXT NOT NULL,metadata_path TEXT NOT NULL,
    order_id TEXT UNIQUE,state TEXT NOT NULL CHECK(state IN ('PREPARED','RESERVED','ALLOCATED')));
    CREATE TABLE founding_orders (id TEXT PRIMARY KEY,status TEXT,reference_price_usd INTEGER);
    CREATE TABLE inventory_allocations (order_id TEXT,serial_number INTEGER,settlement_reference TEXT);`);
  const path=n=>`/nft/releases/rare-0002-0101/${String(n).padStart(4,'0')}/metadata-${H}.json`;
  db.prepare('INSERT INTO nft_release_assets VALUES(2,?,?,?,?,?,?)').run('rare-0002-0101',H,H,path(2),null,'PREPARED');
  db.prepare('INSERT INTO nft_release_assets VALUES(3,?,?,?,?,?,?)').run('rare-0002-0101',H,H,path(3),'legacy-order','RESERVED');
  db.exec("INSERT INTO founding_orders VALUES('legacy-order','CREATED',50)");
  initializeGenesisCandidateSchema(storage);
  const certificate=cert();recordGenesisCandidate({storage,certificate});
  return {db,storage,certificate};
}

