import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMainnetDeployment, probeCdpPaymaster } from '../../cloudflare/nftMainnetLaunchPreparation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
try {
  const flags = process.argv.slice(2);
  if (flags.some(f => !['--save', '--probe-sepolia', '--probe-mainnet'].includes(f)) ||
      new Set(flags).size !== flags.length ||
      (flags.includes('--probe-mainnet') && flags.includes('--probe-sepolia'))) {
    throw new Error('OX_LAUNCH_INVALID_ARGUMENTS');
  }
  const creation = fs.readFileSync(path.join(root, 'blockchain/artifacts/originx-founding-access-v1/OriginXFoundingAccess.creation-bytecode.txt'), 'utf8').trim();
  const plan = prepareMainnetDeployment(creation);
  console.log('MAINNET_ARTIFACT_AND_CONSTRUCTOR=PASS');
  console.log(JSON.stringify({ profile: plan.profile, initCodeSha256: plan.initCodeSha256, funding: plan.funding, pending: plan.pending }, null, 2));
  if (flags.includes('--probe-sepolia') || flags.includes('--probe-mainnet')) {
    const chainId = flags.includes('--probe-mainnet') ? 8453 : 84532;
    const result = await probeCdpPaymaster({ endpoint: process.env.OX_CDP_PAYMASTER_URL, chainId });
    console.log(JSON.stringify(result, null, 2));
    console.log('PAYMASTER_CONNECTIVITY_ONLY=PASS');
  }
  if (flags.includes('--save')) {
    const destination = path.join(root, 'docs/nft/evidence/base-mainnet-launch-plan.json');
    const data = JSON.stringify(plan, null, 2) + '\n';
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    try { fs.writeFileSync(destination, data, { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if (error.code !== 'EEXIST' || fs.readFileSync(destination, 'utf8') !== data) throw new Error('OX_LAUNCH_PLAN_CONFLICT');
    }
    console.log('LAUNCH_PLAN_SAVED=PASS');
  }
  console.log('TRANSACTIONS_SENT=NO');
  console.log('PUBLIC_SALE_ACTIVATION=UNCHANGED');
} catch (error) {
  // Never echo provider errors: they may contain the API key in the URL.
  const known = error instanceof Error && /^OX_[A-Z_]+$/.test(error.message);
  console.error(known ? error.message : 'OX_LAUNCH_PREPARATION_FAILED');
  process.exitCode = 1;
}
