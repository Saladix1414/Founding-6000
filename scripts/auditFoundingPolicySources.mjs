#!/usr/bin/env node
/*
 * Read-only audit of policy compatibility. It does not change sale eligibility,
 * mint jobs, registry tables, contracts, money, or NFT #0001 metadata.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const PATHS = Object.freeze([
  'cloudflare/oxReservePolicyV4Draft.mjs',
  'src/components/landing/economySimulation.ts',
  'cloudflare/rareReleaseInventory.mjs',
  'cloudflare/nftPaidDeliveryIntent.mjs',
  'cloudflare/nftPostSaleRedemptionPreparation.mjs',
  'docs/nft/OX-RESERVE-V2-AND-INVESTMENT-PLAN.md',
  'docs/nft/OX-RESERVE-V3-RARE-30.md',
]);
const hash = s => createHash('sha256').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex');
export function analyzeFoundingPolicySources(readSource) {
  if (typeof readSource !== 'function') throw new Error('OX_SOURCE_READER_REQUIRED');
  const contents = new Map();
  for (const p of PATHS) {
    let src = null;
    try { src = readSource(p); } catch { /* missing file is a blocker, not an assumed old rule */ }
    contents.set(p, typeof src === 'string' ? src : null);
  }
  const v4 = contents.get(PATHS[0]);
  const simulation = contents.get(PATHS[1]);
  const rare = contents.get(PATHS[2]);
  const paidDelivery = contents.get(PATHS[3]);
  const redemption = contents.get(PATHS[4]);
  const checks = [
    { id:'DRAFT_50_PERCENT', pass: v4 !== null && /saleReserveNumerator:\s*50\b/.test(v4), required:true },
    { id:'DRAFT_NO_RESERVED_TOKENS', pass: v4 !== null && /reservedSerials:\s*Object\.freeze\(\[\]\)/.test(v4), required:true },
    { id:'UI_50_PERCENT', pass: simulation !== null && /const reserve\s*=\s*price\s*\/\s*2n\s*;/.test(simulation), required:true },
    // These are compatibility flags, not authorization to enable a release.
    { id:'RARE_RELEASE_ACCEPTS_0001', pass: rare !== null &&
      !/item\.tokenId\s*<\s*2\b/.test(rare) &&
      !/serial_number\s+INTEGER\s+PRIMARY\s+KEY\s+CHECK\(serial_number BETWEEN 2 AND 1000\)/.test(rare), required:true },
    { id:'PAID_DELIVERY_ACCEPTS_0001', pass: paidDelivery !== null &&
      !/plan\.tokenId\s*<\s*2\b/.test(paidDelivery) &&
      !/serial_number\s+INTEGER\s+NOT\s+NULL\s+UNIQUE\s+CHECK\(serial_number BETWEEN 2 AND 1000\)/.test(paidDelivery), required:true },
    { id:'POST_SALE_NO_RESERVED_0001', pass: redemption !== null &&
      !/reservedSerial:\s*1\b/.test(redemption) &&
      !/reserved\.size\s*!==\s*1/.test(redemption), required:true },
    { id:'LEGACY_V2_DOCUMENT_RETAINED_FOR_AUDIT', pass: contents.get(PATHS[5]) !== null, required:false },
    { id:'LEGACY_V3_DOCUMENT_RETAINED_FOR_AUDIT', pass: contents.get(PATHS[6]) !== null, required:false },
  ];
  const sourceFingerprints = PATHS.map(p => ({path:p,sha256:contents.get(p)===null?null:hash(contents.get(p))}));
  const stable = {
    schema: 'OX-ECONOMIC-POLICY-SOURCES-3',
    target: '50_PERCENT_NO_RESERVED_6000',
    checks,
    sourceFingerprints,
    sourceCompatible: checks.filter(c=>c.required).every(c=>c.pass),
    serverLegacyLedgerReconciled: false,
    productionCutoverApproved: false,
    reserveWriteAuthorized: false,
    investmentAuthorized: false,
    redemptionAuthorized: false,
    status:'BLOCKED_PENDING_EVIDENCE_AND_POLICY_APPROVAL',
  };
  return Object.freeze({...stable, reportHash:hash(stable)});
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const root = resolve(process.cwd());
  const report = analyzeFoundingPolicySources(p=>readFileSync(resolve(root,p),'utf8'));
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  } else {
    process.stdout.write('\nORIGINX — POLICY V4 CUTOVER / READ-ONLY\n');
    for(const c of report.checks) {
      process.stdout.write((c.pass?'[PASS] ':'[BLOCKED] ') + c.id + (c.required?' (required)':' (historic)') + '\n');
    }
    process.stdout.write('Audit sha256: '+report.reportHash+'\n');
    process.stdout.write('NO activa ventas, ledger V4, reservas ni rescates.\n');
  }
  if (process.argv.includes('--enforce') && !report.sourceCompatible) process.exitCode=2;
}
