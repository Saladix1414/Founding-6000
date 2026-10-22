# OX-NFT-25 — OriginX Founding Access Contract

Contract:

`OriginXFoundingAccess`

## Collection

Name:

`OriginX Founding 6000`

Symbol:

`OXF6000`

Maximum supply:

`6000`

Canonical token range:

`1..6000`

The on-chain token ID equals the canonical Founding serial.

## Authority

The contract uses OpenZeppelin AccessControl.

### DEFAULT_ADMIN_ROLE

Administrative authority.

Responsibilities include:

- pause / unpause;
- temporary base URI migration;
- final base URI freeze;
- role administration.

### MINTER_ROLE

Mint authority only.

The constructor rejects:

`ADMIN == MINTER`

Admin does not automatically receive MINTER_ROLE.

Minter does not automatically receive DEFAULT_ADMIN_ROLE.

## Mint

Minting requires:

`MINTER_ROLE`

and:

`whenNotPaused`

Valid token IDs:

`1 <= tokenId <= 6000`

Duplicate token IDs are rejected.

## Metadata

Public marketplace metadata follows:

`<baseURI><tokenId>.json`

Example during the provisional infrastructure stage:

`https://founding-6000-prelaunch.digitalboostlaunch.workers.dev/nft/metadata/1.json`

The base URI may migrate before final freeze.

## Base URI freeze

Before freeze:

`setBaseURI(...)`

is available only to ADMIN.

After:

`freezeBaseURI()`

the metadata base URI can no longer be changed.

The freeze is intentionally irreversible.

This allows OriginX to migrate from the provisional workers.dev
origin to a future canonical domain before permanently fixing the
metadata origin.

## Pause behavior

Pause blocks:

- minting;
- NFT transfers.

Unpause restores authorized operations.

This provides an emergency contract-level safety mechanism.

## Transferable access

The ERC-721 itself remains transferable.

Application access state is maintained separately from ownership
and must preserve activation/expiry semantics across transfers.

`NFT OWNERSHIP != IDENTITY`

`NFT OWNERSHIP != GOVERNANCE AUTHORITY`

## Royalties

ERC-2981 is not included in this contract version.

Royalty policy remains a separate product/economic decision and
must not be silently introduced into the final contract.

## Current authorization state

`BASE_SEPOLIA_DEPLOYMENT_AUTHORIZED=false`

`MAINNET_DEPLOYMENT_AUTHORIZED=false`

`NFT_MINT_AUTHORIZED=false`

No real blockchain deployment is authorized by this document.
