/*
 * Sidecar candidate registry for NFT #0001. Not the live nft_release_assets
 * table. This registry NEVER reserves, allocates or permits minting/sales.
 */
import {createHash} from 'node:crypto';
import {GENESIS_RELEASE_CERTIFICATE_VERSION} from './oxGenesisReleaseV4.mjs';
const HASH=/^[a-f0-9]{64}$/;
const fail=code=>{throw new Error('OX_GENESIS_CANDIDATE_'+code);};
const sha=x=>createHash('sha256').update(x).digest('hex');
function sqlStorage(storage) {
  if (!storage?.sql?.exec || typeof storage.transactionSync!=='function')fail('STORAGE_UNAVAILABLE');
}
function verifiedCertificate(c) {
  if (!c || c.version!==GENESIS_RELEASE_CERTIFICATE_VERSION || c.serialNumber!==1 || c.serial!=='#0001' ||
      c.tier!=='RARE' || c.metadataPath!=='/nft/metadata/1.json' ||
      c.manifestStatus!=='ARTIFACTS_HASH_VERIFIED' || c.inventoryTable!==null ||
      c.saleApproved!==false || c.releaseApproved!==false || c.inventoryAllocated!==false ||
      c.paymentAuthenticated!==false || c.mintApproved!==false ||
      ![c.metadataHash,c.mediaHash,c.glyphHash,c.certificateHash].every(x=>typeof x==='string' && HASH.test(x)))fail('CERTIFICATE_INVALID');
  const {certificateHash,...body}=c;
  if(sha(JSON.stringify(body))!==certificateHash)fail('CERTIFICATE_MISMATCH');
}
export function initializeGenesisCandidateSchema(storage) {
  sqlStorage(storage);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ox_genesis_asset_candidates_v4 (
      serial_number INTEGER PRIMARY KEY CHECK(serial_number = 1),
      certificate_hash TEXT NOT NULL UNIQUE,
      metadata_hash TEXT NOT NULL,
      media_hash TEXT NOT NULL,
      glyph_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status = 'PREPARED_NOT_FOR_SALE'),
      created_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS ox_genesis_candidate_immutable_update
      BEFORE UPDATE ON ox_genesis_asset_candidates_v4 BEGIN
      SELECT RAISE(ABORT,'OX_GENESIS_CANDIDATE_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ox_genesis_candidate_immutable_delete
      BEFORE DELETE ON ox_genesis_asset_candidates_v4 BEGIN
      SELECT RAISE(ABORT,'OX_GENESIS_CANDIDATE_IMMUTABLE'); END;
  `);
}
export function recordGenesisCandidate({storage,certificate,now=Date.now()}) {
  sqlStorage(storage);verifiedCertificate(certificate);
  if(!Number.isSafeInteger(now) || now<0 || now>8640000000000000)fail('TIME_INVALID');
  return storage.transactionSync(()=>{
    const old=storage.sql.exec('SELECT * FROM ox_genesis_asset_candidates_v4 WHERE serial_number=1').toArray();
    if(old.length){
      if(old.length!==1 || old[0].certificate_hash!==certificate.certificateHash ||
          old[0].metadata_hash!==certificate.metadataHash || old[0].media_hash!==certificate.mediaHash ||
          old[0].glyph_hash!==certificate.glyphHash || old[0].status!=='PREPARED_NOT_FOR_SALE')fail('CONFLICT');
      return Object.freeze({serialNumber:1,status:'PREPARED_NOT_FOR_SALE',idempotentReplay:true,
        saleAuthorized:false,mintAuthorized:false});
    }
    storage.sql.exec(`INSERT INTO ox_genesis_asset_candidates_v4
      (serial_number,certificate_hash,metadata_hash,media_hash,glyph_hash,status,created_at)
      VALUES (1,?,?,?,?,'PREPARED_NOT_FOR_SALE',?)`,certificate.certificateHash,
      certificate.metadataHash,certificate.mediaHash,certificate.glyphHash,new Date(now).toISOString());
    return Object.freeze({serialNumber:1,status:'PREPARED_NOT_FOR_SALE',idempotentReplay:false,
      saleAuthorized:false,mintAuthorized:false});
  });
}
