# OX-NFT-23 — Public Origin Policy

Version: OX-NFT-PUBLIC-ORIGIN-1

## Current origin

`https://founding-6000-prelaunch.digitalboostlaunch.workers.dev`

Status:

`PROVISIONAL`

The current Cloudflare-hosted origin is a delivery endpoint.
It is not part of the immutable creative identity of an OriginX NFT.

## Stable token path

For token `1`:

`/nft/metadata/1.json`

The full URI is therefore derived from:

`<baseURI>/nft/metadata/<tokenId>.json`

## Content-addressed assets

Canonical image and glyph files include their SHA-256 hashes in
their public filenames.

Changing the delivery domain must not silently change:

- tokenId
- serial
- DNA hash
- bundle hash
- Akashic evidence
- canonical media hash
- glyph hash
- internal OriginX metadata hash

## Migration policy

The public base URL may change before final mainnet freeze.

A migration requires:

1. exact asset replication;
2. SHA-256 verification;
3. HTTPS availability verification;
4. public metadata validation;
5. tokenURI validation;
6. provenance record of the migration.

PUBLIC_ORIGIN_IS_MINT_AUTHORITY=NO

PUBLIC_ORIGIN_IS_GOVERNANCE_AUTHORITY=NO

MAINNET_BASE_URI_FROZEN=NO
