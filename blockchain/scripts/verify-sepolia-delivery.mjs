import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from 'ethers';
import { verifyBaseSepoliaSponsoredMintRpcEvidence } from '../../cloudflare/nftMintRpcEvidenceAdapter.mjs';
import { createNftReadOnlyHttpTransport } from '../../cloudflare/nftMintReadOnlyHttpTransport.mjs';

// A fixed testnet observation profile, not production payment or delivery authority.
// No private keys, arbitrary RPC URLs, HTTP route, signer or database connection.
const profile=Object.freeze({
  chainId:84532,
  contractAddress:'0xb3f012e92cfd051f4f18ff19831afad5732c1ebd',
  transactionHash:'0x7a83efe52e5707cd49b2ab2a19a105de3855ede0830a3e97b45708f420f653a1',
  recipient:'0x001911220a9ce3b4063ccaece36863428a27c24e',
  expectedMinter:'0x4d0efb268b6dddff3c043f3d8c0f6410447e1f2f',
  tokenId:2,
  expectedRuntimeSha256:'9ed5125194af51175a650209fe49221c6e176e2e33b03af56765eb37569e3d9c',
});
if(process.argv.slice(2).some(x=>x!=='--save')||process.argv.slice(2).length>1)
  throw Error('Usage: node blockchain/scripts/verify-sepolia-delivery.mjs [--save]');
const rpc=createNftReadOnlyHttpTransport({
  endpoint:'https://sepolia.base.org',allowedHostnames:['sepolia.base.org'],
  timeoutMs:15000,
  fetchImpl:(url,options)=>fetch(url,{...options,headers:{...options.headers,
    'User-Agent':'OriginX-Testnet-Delivery-Verification/1.0'}}),
});
const evidence=await verifyBaseSepoliaSponsoredMintRpcEvidence({...profile,rpc});
// Confirm current ownership as a separate observation from pinned receipt-block ownership.
const owner=await rpc.send('eth_call',[{to:profile.contractAddress,
  data:'0x6352211e'+BigInt(profile.tokenId).toString(16).padStart(64,'0')},'latest']);
if(!/^0x[0-9a-fA-F]{64}$/.test(owner)||'0x'+owner.slice(-40).toLowerCase()!==profile.recipient)
  throw Error('CURRENT_OWNER_MISMATCH');
const report={schema:'OX-TESTNET-DELIVERY-OBSERVATION-1',observedAt:new Date().toISOString(),
  profile,evidence,currentOwner:profile.recipient,publicSaleAuthorized:false,
  productionDeliveryRecorded:false,orderLinked:false,membershipActivated:false};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--save')) {
  const artifact=readFileSync('blockchain/artifacts/originx-founding-access-v1/OriginXFoundingAccess.runtime-bytecode.txt','utf8').trim();
  if(sha256(artifact).slice(2)!==profile.expectedRuntimeSha256)
    throw Error('LOCAL_ARTIFACT_MISMATCH');
  const folder=resolve('docs/nft/evidence');mkdirSync(folder,{recursive:true});
  const destination=resolve(folder,'base-sepolia-token-0002.json');
  writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('Evidence saved: '+destination);
}
console.log('TESTNET_DELIVERY_RPC_EVIDENCE=PASS');
console.log('PUBLIC_SALE_ACTIVATION=UNCHANGED');
