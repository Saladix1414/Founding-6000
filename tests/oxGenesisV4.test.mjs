import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {certifyGenesisArtifacts, assessGenesisMintSource, GENESIS_ORIGIN} from '../cloudflare/oxGenesisReleaseV4.mjs';
import {assessFullSupplyCoverageV4} from '../cloudflare/oxFullSupplyCoverageV4.mjs';
import {initializeGenesisCandidateSchema,recordGenesisCandidate} from '../cloudflare/oxGenesisInventoryV4.mjs';
import {DatabaseSync} from 'node:sqlite';
const hash = b=>createHash('sha256').update(b).digest('hex');
const PNG=[137,80,78,71,13,10,26,10];
const H='a'.repeat(64);
function fixture() {
  const imageBytes=Buffer.alloc(40); Buffer.from(PNG).copy(imageBytes,0);
  imageBytes.writeUInt32BE(13,8); imageBytes.write('IHDR',12,'ascii');
  imageBytes.writeUInt32BE(2048,16);imageBytes.writeUInt32BE(2048,20);
  const glyphBytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const media=hash(imageBytes),glyph=hash(glyphBytes);
  const obj={
    name:'Azhurak — The Primordial Witness',
    image:`${GENESIS_ORIGIN}/nft/rare/0001/image-${media}.png`,
    external_url:`${GENESIS_ORIGIN}/nft/rare/0001`,
    attributes:[{trait_type:'Founding Serial',value:'#0001'},{trait_type:'Tier',value:'RARE'}],
    originx:{tokenId:1,serial:'#0001',tier:'RARE',displayName:'Azhurak — The Primordial Witness',
      publicMetadataVersion:'OX-ERC721-PUBLIC-METADATA-1',
      authority:{metadataIsGovernanceAuthority:false,metadataIsMintAuthority:false},
      glyph:`${GENESIS_ORIGIN}/nft/rare/0001/glyph-${glyph}.svg`,
      visual:{approved:true,mediaHash:media},
      identity:{dnaHash:H,bundleHash:H,akashicLatestEventHash:H,internalMetadataHash:H}}
  };
  return {obj,imageBytes,glyphBytes};
}
const cert=(f)=>certifyGenesisArtifacts({metadataBytes:Buffer.from(JSON.stringify(f.obj)),imageBytes:f.imageBytes,glyphBytes:f.glyphBytes});
test('Genesis candidate is byte-bound and never authorizes sale or mint',()=>{
  const f=fixture(),c=cert(f);
  assert.equal(c.serialNumber,1);assert.equal(c.serial,'#0001');assert.equal(c.mediaHash,hash(f.imageBytes));
  assert.equal(c.saleApproved,false);assert.equal(c.mintApproved,false);assert.equal(c.inventoryTable,null);
  assert.equal(c.metadataPath,'/nft/metadata/1.json');assert.equal(c.certificateHash.length,64);
  assert.equal(cert(f).certificateHash,c.certificateHash);
});
test('Hash mismatch of image or glyph is rejected',()=>{
  const f=fixture();f.imageBytes[35]^=1;assert.throws(()=>cert(f),/IMAGE_HASH_MISMATCH/);
  const g=fixture();g.glyphBytes[0]^=1;assert.throws(()=>cert(g),/URL_NOT_CANONICAL/);
});
test('Azhurak identity, name, tier, serial and public authority are pinned',()=>{
  const a=fixture();a.obj.originx.tokenId=2;assert.throws(()=>cert(a),/IDENTITY_CONFLICT/);
  const b=fixture();b.obj.originx.authority.metadataIsMintAuthority=true;assert.throws(()=>cert(b),/IDENTITY_CONFLICT/);
  const c=fixture();c.obj.attributes[0].value='#0002';assert.throws(()=>cert(c),/ATTRIBUTES_CONFLICT/);
  const d=fixture();d.obj.name='Other';assert.throws(()=>cert(d),/IDENTITY_CONFLICT/);
});
test('Noncanonical URLs cannot swap the art or redirect the user',()=>{
  const f=fixture();f.obj.image='https://evil.example/nft.png';assert.throws(()=>cert(f),/URL_NOT_CANONICAL/);
  const g=fixture();g.obj.external_url+='?redirect=1';assert.throws(()=>cert(g),/URL_NOT_CANONICAL/);
});
test('Only 2048x2048 PNG canonical art is accepted',()=>{
  const f=fixture();f.imageBytes.writeUInt32BE(1024,20);assert.throws(()=>cert(f),/IMAGE_NOT_CANONICAL/);
  const g=fixture();g.imageBytes[0]=0;assert.throws(()=>cert(g),/IMAGE_NOT_CANONICAL/);
});
test('Mint source capability is not deployment or mint authorization',()=>{
  const plan='if (row.serialNumber < 1 || row.serialNumber > MAX_SUPPLY) unavailable();';
  const contract='if (tokenId == 0 || tokenId > MAX_SUPPLY) revert; _safeMint(to,tokenId);';
  const x=assessGenesisMintSource({mintPlanSource:plan,contractSource:contract});
  assert.equal(x.sourceAllowsToken0001,true);assert.equal(x.deployedContractVerified,false);assert.equal(x.mintAuthority,false);
  assert.equal(assessGenesisMintSource({mintPlanSource:plan.replace('< 1','< 2'),contractSource:contract}).sourceAllowsToken0001,false);
});
test('Full-sale coverage requires exactly all 6000 serials including #0001',()=>{
  const all=Array.from({length:6000},(_,i)=>i+1);
  const full=assessFullSupplyCoverageV4({settledSerials:all,reservedSerials:[]});
  assert.equal(full.saleTarget,6000);assert.equal(full.inputCoverageComplete,true);
  assert.equal(full.token0001CountedAsSale,true);
  assert.deepEqual(full.soldByTier,{RARE:1000,EPIC:2000,LEGENDARY:3000});
  assert.deepEqual(full.missingSerials,[]);assert.equal(full.burnAuthorized,false);
  assert.equal(full.redemptionAuthorized,false);assert.equal(full.settlementEvidenceAuthenticated,false);
});
test('Missing #0001 blocks coverage; V1 5999 coverage is not accepted',()=>{
  const missing=assessFullSupplyCoverageV4({settledSerials:Array.from({length:5999},(_,i)=>i+2)});
  assert.equal(missing.inputCoverageComplete,false);assert.deepEqual(missing.missingSerials,[1]);
  assert.equal(missing.soldByTier.RARE,999);assert.equal(missing.token0001CountedAsSale,false);
});
test('No reserved tokens, no duplicate, no out of range or malformed serial',()=>{
  for(const value of [{settledSerials:[1],reservedSerials:[2]}, {settledSerials:[],reservedSerials:[1]},
    {settledSerials:[1,1]}, {settledSerials:[0]}, {settledSerials:[6001]},
    {settledSerials:[1.2]}, {settledSerials:['1']}, {settledSerials:null}])
    assert.throws(()=>assessFullSupplyCoverageV4(value),/OX_COVERAGE/);
});
test('Sellout never implies redemption, reserve liquidity or authorization',()=>{
  const full=assessFullSupplyCoverageV4({settledSerials:Array.from({length:6000},(_,i)=>i+1)});
  for(const field of ['treasuryCustodyVerified','reservePolicyApproved','investorVoteVerified','payoutAuthorized',
    'burnAuthorized','redemptionAuthorized','transactionSubmitted','guaranteedReturn'])assert.equal(full[field],false);
});

test('Readiness inspector identifies old exclusions without changing them', async()=>{
  const {inspectGenesisV4}=await import('../scripts/inspectGenesisV4.mjs');
  const f=fixture();
  const lookup={
    'public/nft/metadata/1.json':Buffer.from(JSON.stringify(f.obj)),
    'public/nft/rare/0001/image-a4dce9bbbcb6ec183ede3b2e3f512046677b058cbafe248255c2a021fe0ed4d7.png':f.imageBytes,
    'public/nft/rare/0001/glyph-68e636d5cacde87539c9a5614c3a40eea78725e7efa9977189a8cef67f72689f.svg':f.glyphBytes,
    'cloudflare/nftMintExecutionPlan.mjs':Buffer.from('row.serialNumber < 1 || row.serialNumber > MAX_SUPPLY'),
    'blockchain/contracts/OriginXFoundingAccess.sol':Buffer.from('tokenId == 0 || tokenId > MAX_SUPPLY; _safeMint(to,tokenId)'),
    'cloudflare/rareReleaseInventory.mjs':Buffer.from('item.tokenId < 2'),
    'cloudflare/nftPaidDeliveryIntent.mjs':Buffer.from('plan.tokenId < 2'),
    'cloudflare/nftPostSaleRedemptionPreparation.mjs':Buffer.from('reservedSerial: 1'),
  };
  const report=inspectGenesisV4(path=>{
    if(!(path in lookup))throw new Error('MISSING_FIXTURE');
    return lookup[path];
  });
  assert.equal(report.mint.sourceAllowsToken0001,true);
  assert.equal(report.sourceBlockers.legacyInventoryExcludes0001,true);
  assert.equal(report.sourceBlockers.legacyPaidDeliveryExcludes0001,true);
  assert.equal(report.sourceBlockers.legacyRedemptionRequiresReserved0001,true);
  assert.equal(report.noReservedTokens,true);
  assert.equal(report.liveSaleEnabled,false);
  assert.equal(report.readyToDeploy,false);
});

function candidateStorage(){
  const db=new DatabaseSync(':memory:');
  return {db,store:{
    sql:{exec(sql,...args){
      if (!args.length && /CREATE TABLE|CREATE TRIGGER/.test(sql)){db.exec(sql);return {toArray:()=>[]};}
      const q=db.prepare(sql);
      if (/^\s*SELECT/i.test(sql))return {toArray:()=>q.all(...args)};
      q.run(...args);return {toArray:()=>[]};
    }},
    transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}
      catch(e){db.exec('ROLLBACK');throw e;}}
  }};
}
test('Separate #0001 candidate table is idempotent and never a sale inventory allocation',()=>{
  const {db,store}=candidateStorage();
  initializeGenesisCandidateSchema(store);initializeGenesisCandidateSchema(store);
  const c=cert(fixture());
  assert.equal(recordGenesisCandidate({storage:store,certificate:c}).status,'PREPARED_NOT_FOR_SALE');
  const replay=recordGenesisCandidate({storage:store,certificate:c});
  assert.equal(replay.idempotentReplay,true);assert.equal(replay.saleAuthorized,false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ox_genesis_asset_candidates_v4').get().n,1);
  assert.throws(()=>db.exec('DELETE FROM ox_genesis_asset_candidates_v4'),/IMMUTABLE/);
  assert.throws(()=>db.exec("UPDATE ox_genesis_asset_candidates_v4 SET status='PREPARED_NOT_FOR_SALE'"),/IMMUTABLE/);
});
test('Candidate registry rejects contradictory evidence and leaves original untouched',()=>{
  const {db,store}=candidateStorage();initializeGenesisCandidateSchema(store);
  const original=cert(fixture());recordGenesisCandidate({storage:store,certificate:original});
  const forged={...original,mediaHash:'0'.repeat(64)};
  assert.throws(()=>recordGenesisCandidate({storage:store,certificate:forged}),/CERTIFICATE_MISMATCH/);
  const second=fixture();second.imageBytes[34]=1;second.obj.originx.visual.mediaHash=hash(second.imageBytes);
  second.obj.image=`${GENESIS_ORIGIN}/nft/rare/0001/image-${hash(second.imageBytes)}.png`;
  assert.throws(()=>recordGenesisCandidate({storage:store,certificate:cert(second)}),/CONFLICT/);
  assert.equal(db.prepare('SELECT certificate_hash AS hash FROM ox_genesis_asset_candidates_v4').get().hash,original.certificateHash);
});
