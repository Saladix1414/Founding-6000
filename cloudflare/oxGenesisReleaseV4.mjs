/*
 * OriginX Founding 6000 — #0001 asset certificate, PREPARATION ONLY.
 * An asset certificate is not settlement, inventory allocation, mint evidence,
 * treasury accounting, NFT ownership, or authorization to sell.
 */
import { createHash } from 'node:crypto';

export const GENESIS_RELEASE_CERTIFICATE_VERSION = 'OX-GENESIS-ASSET-CERTIFICATE-4';
export const GENESIS_ORIGIN = 'https://founding-6000-prelaunch.digitalboostlaunch.workers.dev';
const HASH = /^[a-f0-9]{64}$/;
const HEADER = [137,80,78,71,13,10,26,10];
const fail = code => { throw new Error('OX_GENESIS_' + code); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const bytesLike = value => value instanceof Uint8Array && value.length > 0;
const bytes32 = (bytes, at) => ((bytes[at] * 2**24) + (bytes[at+1] << 16) + (bytes[at+2] << 8) + bytes[at+3]) >>> 0;
function verifyPng(imageBytes) {
  if (!bytesLike(imageBytes) || imageBytes.length < 33 || HEADER.some((v,i) => imageBytes[i] !== v) ||
      String.fromCharCode(...imageBytes.slice(12,16)) !== 'IHDR' ||
      bytes32(imageBytes, 8) !== 13 || bytes32(imageBytes,16) !== 2048 || bytes32(imageBytes,20) !== 2048) fail('IMAGE_NOT_CANONICAL_2048_PNG');
}
function canonicalUrl(url, expected) {
  if (typeof url !== 'string' || url !== GENESIS_ORIGIN + expected) fail('URL_NOT_CANONICAL');
}
function traits(attributes, traitType, expected) {
  if (!Array.isArray(attributes) || attributes.filter(a => a?.trait_type === traitType && a.value === expected).length !== 1) fail('ATTRIBUTES_CONFLICT');
}
export function certifyGenesisArtifacts({ metadataBytes, imageBytes, glyphBytes }) {
  if (!bytesLike(metadataBytes) || !bytesLike(glyphBytes)) fail('ARTIFACT_BYTES_REQUIRED');
  verifyPng(imageBytes);
  let metadata;
  try { metadata = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(metadataBytes)); }
  catch { fail('METADATA_JSON_INVALID'); }
  const ox = metadata?.originx;
  if (metadata?.name !== 'Azhurak — The Primordial Witness' ||
      ox?.tokenId !== 1 || ox?.serial !== '#0001' || ox?.tier !== 'RARE' ||
      ox?.displayName !== metadata.name || ox?.publicMetadataVersion !== 'OX-ERC721-PUBLIC-METADATA-1' ||
      ox?.visual?.approved !== true || ox?.authority?.metadataIsMintAuthority !== false ||
      ox?.authority?.metadataIsGovernanceAuthority !== false) fail('METADATA_IDENTITY_CONFLICT');
  traits(metadata.attributes, 'Founding Serial', '#0001');
  traits(metadata.attributes, 'Tier', 'RARE');
  const mediaHash = ox.visual.mediaHash;
  const dnaHash = ox.identity?.dnaHash;
  const bundleHash = ox.identity?.bundleHash;
  const akashicHash = ox.identity?.akashicLatestEventHash;
  if (![mediaHash,dnaHash,bundleHash,akashicHash,ox.identity?.internalMetadataHash].every(h=>typeof h==='string' && HASH.test(h))) fail('METADATA_HASH_INVALID');
  if (digest(imageBytes) !== mediaHash) fail('IMAGE_HASH_MISMATCH');
  const glyphHash = digest(glyphBytes);
  const imagePath = `/nft/rare/0001/image-${mediaHash}.png`;
  const glyphPath = `/nft/rare/0001/glyph-${glyphHash}.svg`;
  canonicalUrl(metadata.image, imagePath);
  canonicalUrl(ox.glyph, glyphPath);
  canonicalUrl(metadata.external_url, '/nft/rare/0001');
  const metadataHash = digest(metadataBytes);
  const certificate = {
    version: GENESIS_RELEASE_CERTIFICATE_VERSION,
    tier: 'RARE', serialNumber: 1, serial: '#0001',
    name: metadata.name, metadataPath: '/nft/metadata/1.json',
    metadataHash, imagePath, mediaHash, glyphPath, glyphHash,
    dnaHash, bundleHash, akashicLatestEventHash: akashicHash,
    manifestStatus: 'ARTIFACTS_HASH_VERIFIED',
    inventoryTable: null, // Legacy table explicitly excludes #0001.
    allowedForFuturePolicyReview: true,
    saleApproved: false, releaseApproved: false, inventoryAllocated: false,
    paymentAuthenticated: false, mintApproved: false,
    onchainOwnerVerified: false, redemptionAuthorized: false,
  };
  return Object.freeze({...certificate, certificateHash: digest(JSON.stringify(certificate))});
}

/* Verify the existing Base ERC-721 *source intent*, not an on-chain deployment. */
export function assessGenesisMintSource({ mintPlanSource, contractSource }) {
  if (typeof mintPlanSource !== 'string' || typeof contractSource !== 'string') fail('MINT_SOURCE_REQUIRED');
  const planAllowsOne = /row\.serialNumber\s*<\s*1\b/.test(mintPlanSource) &&
    /row\.serialNumber\s*>\s*MAX_SUPPLY/.test(mintPlanSource);
  const contractAllowsOne = /tokenId\s*==\s*0/.test(contractSource) &&
    /tokenId\s*>\s*MAX_SUPPLY/.test(contractSource) &&
    /_safeMint\s*\(/.test(contractSource);
  return Object.freeze({sourceAllowsToken0001:planAllowsOne && contractAllowsOne,
    planAllowsOne,contractAllowsOne, deployedContractVerified:false,
    contractMintedToken0001:false, mintAuthority:false});
}
