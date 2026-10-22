# OX-NFT-23 — Publication Storage Policy

Version: OX-NFT-PUBLICATION-GATE-1

Scope:

- RARE #0001 through #1000
- self-host-first
- Cloudflare Static Assets
- content-addressed immutable files

## Publication prerequisites

An NFT package MUST NOT be published unless all of the following agree:

1. tokenId
2. serial
3. tier
4. DNA identity
5. identity bundle
6. Resonance Glyph
7. Akashic provenance
8. canonical render
9. render QC
10. public metadata

The canonical render must have:

- render-qc record
- finalStatus = APPROVED
- SHA-256 equal to QC mediaHash
- SHA-256 equal to metadata mediaHash
- SHA-256 equal to the Akashic VISUAL_MANIFESTED mediaHash

Missing or mismatched evidence MUST fail closed.

## Content-addressed layout

When approved:

public/nft/rare/NNNN/

contains:

- image-<sha256>.png
- glyph-<sha256>.svg
- metadata-<canonicalMetadataHash>.json
- provenance-<manifestHash>.json

Content-addressed files MUST NOT be silently overwritten with different
bytes under the same hash-derived path.

## Hash domains

A semantic/canonical OriginX hash is not necessarily the same as the
SHA-256 of the pretty-printed JSON file.

Examples:

- dnaHash
- bundleHash
- metadataHash
- latestEventHash

are domain hashes calculated according to their own canonical rules.

Binary assets such as the canonical PNG and Glyph SVG use direct file
SHA-256 verification.

## Authority boundaries

PUBLICATION != MINT AUTHORITY

METADATA != OWNERSHIP AUTHORITY

IMAGE != SOURCE OF TRUTH

HASH != APPROVAL

QC APPROVAL != MAINNET APPROVAL

TESTNET != MAINNET APPROVAL

RESERVE != NFT STORAGE

PUBLICATION DOES NOT AUTHORIZE A BLOCKCHAIN TRANSACTION
