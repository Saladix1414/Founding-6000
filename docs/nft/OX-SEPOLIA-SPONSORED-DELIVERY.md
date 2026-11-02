# Base Sepolia: sponsored mint observation

The existing direct-call validator remains the default. The explicit
`verifyBaseSepoliaSponsoredMintRpcEvidence` export observes a contract mint
inside a sponsored outer transaction. It never records a production delivery,
updates an order, starts a membership, signs, submits or activates a release.

Required evidence: Base Sepolia chain ID, matching transaction/receipt hashes,
outer sender and destination consistency, successful receipt, at least three
confirmations, canonical receipt block (checked twice), EIP-1898 hash-pinned
contract reads, an explicitly configured runtime SHA-256, the configured
minter's role at the receipt block, exactly one Transfer for the specified token
from zero to the intended recipient, and ownership at that block. Removed,
duplicate, conflicting and substituted token events are rejected.

The configured minter's role does not identify the internal caller. The result
explicitly sets `internalCallerIdentified: false` and
`minterRoleAtReceiptBlock: null` for sponsored observations. The observed event
is accepted only with the expected runtime code; it is not inferred from the
outer relayer's address. RPC observations are not cryptographic proofs.

Run:

```sh
node server/src/tests/oxNftSponsoredMintEvidenceTest.mjs
node blockchain/scripts/verify-sepolia-delivery.mjs
```

The CLI uses a fixed Base Sepolia profile and existing bounded read-only HTTP
transport. It deliberately does not enable live mode in the production RPC
policy. `--save` saves a new observation exclusively to
`docs/nft/evidence/base-sepolia-token-0002.json` after also matching the local
runtime artifact. Existing evidence is never overwritten. It independently
checks current ownership in addition to receipt-block ownership.

Observed test profile:

- Contract: `0xb3f012e92cfd051f4f18ff19831afad5732c1ebd`
- Mint transaction: `0x7a83efe52e5707cd49b2ab2a19a105de3855ede0830a3e97b45708f420f653a1`
- Token: 2; recipient: Admin Test.
- Source SHA-256: `8cc68982ba0a53991b348f34b18a0ea2fb15bf3ee635273c1ba907b035c6f0b8`
- Runtime SHA-256: `9ed5125194af51175a650209fe49221c6e176e2e33b03af56765eb37569e3d9c`

This is a manual testnet mint, with no settled-order association. It must never
be imported as a paid order or production sale. Sale allocation and membership
activation remain outside this observation step. Mainnet deployment, operational
mint submission and atomic order-linked confirmation still require integration
and runtime verification. The RARE release stays PREPARED and unapproved.
