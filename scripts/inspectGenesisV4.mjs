#!/usr/bin/env node
/* Reads assets and source code; writes no application state and makes no RPC calls. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { certifyGenesisArtifacts, assessGenesisMintSource } from '../cloudflare/oxGenesisReleaseV4.mjs';
import { assessFullSupplyCoverageV4 } from '../cloudflare/oxFullSupplyCoverageV4.mjs';

export function inspectGenesisV4(read) {
  const cert = certifyGenesisArtifacts({
    metadataBytes:read('public/nft/metadata/1.json'),
    imageBytes:read('public/nft/rare/0001/image-a4dce9bbbcb6ec183ede3b2e3f512046677b058cbafe248255c2a021fe0ed4d7.png'),
    glyphBytes:read('public/nft/rare/0001/glyph-68e636d5cacde87539c9a5614c3a40eea78725e7efa9977189a8cef67f72689f.svg'),
  });
  const mint=assessGenesisMintSource({
    mintPlanSource:new TextDecoder().decode(read('cloudflare/nftMintExecutionPlan.mjs')),
    contractSource:new TextDecoder().decode(read('blockchain/contracts/OriginXFoundingAccess.sol')),
  });
  const legacyPaths={
    inventory:'cloudflare/rareReleaseInventory.mjs',
    paidDelivery:'cloudflare/nftPaidDeliveryIntent.mjs',
    redemption:'cloudflare/nftPostSaleRedemptionPreparation.mjs',
  };
  const source={};
  for(const [name,p] of Object.entries(legacyPaths)) source[name]=new TextDecoder().decode(read(p));
  const blocks={
    legacyInventoryExcludes0001:/item\.tokenId\s*<\s*2\b/.test(source.inventory) || /BETWEEN 2 AND 1000/.test(source.inventory),
    legacyPaidDeliveryExcludes0001:/plan\.tokenId\s*<\s*2\b/.test(source.paidDelivery) || /BETWEEN 2 AND 1000/.test(source.paidDelivery),
    legacyRedemptionRequiresReserved0001:/reservedSerial:\s*1\b/.test(source.redemption) || /AZHURAK_RESERVATION_REQUIRED/.test(source.redemption),
  };
  const coverage=assessFullSupplyCoverageV4({settledSerials:[],reservedSerials:[]});
  return Object.freeze({schema:'OX-GENESIS-V4-READINESS',certificate:cert, mint, sourceBlockers:blocks,
    fullSupplySaleTarget:coverage.saleTarget,noReservedTokens:coverage.reservedCount===0,
    commerceCutoverApproved:false,liveSaleEnabled:false,readyToDeploy:false,
    next:'VERSIONED_INVENTORY_MIGRATION_AND_PAID_DELIVERY_V2_REQUIRED'});
}
if(process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  try {
    const root=resolve(process.cwd());
    const report=inspectGenesisV4(p=>readFileSync(resolve(root,p)));
    if(process.argv.includes('--json')) process.stdout.write(JSON.stringify(report,null,2)+'\n');
    else {
      process.stdout.write('\nORIGINX GENESIS #0001 — READ-ONLY V4\n');
      process.stdout.write('[PASS] Imagen, glifo y metadata: hashes SHA-256 y serial verificados\n');
      process.stdout.write('['+(report.mint.sourceAllowsToken0001?'PASS':'BLOCKED')+'] Fuente de contrato/plan de mint para #0001\n');
      for(const [name,blocked] of Object.entries(report.sourceBlockers)) process.stdout.write('['+(blocked?'BLOCKED':'PASS')+'] '+name+' legacy\n');
      process.stdout.write('[BLOCKED] Autoridad comercial y contrato en Base sin certificar\n');
      process.stdout.write('Asset certificate: '+report.certificate.certificateHash+'\n');
      process.stdout.write('Sin ventas ni mint activados.\n');
    }
    if(process.argv.includes('--enforce-assets') && !report.mint.sourceAllowsToken0001) process.exitCode=2;
  } catch(error) { process.stderr.write(String(error?.message ?? error)+'\n'); process.exitCode=1; }
}
