# Prepared RARE release #0002–#0101

100 native 1254px arcade images, 100 public metadata records, 100 extended
Akashic records, 100 deterministic Resonance Glyphs and a hashed release manifest.
#0001 Azhurak and all existing history prefixes are preserved.

Visual DNA describes the actual PNG layers. Legacy gothic identity DNA is retained
as an identity reference, not falsely represented as the visible arcade traits.
No artificial upscaling, fabricated mint, payment or activation event is recorded.
The new Akashic events record image manifestation and prepared metadata, not a sale.

Public prepared assets: public/nft/releases/rare-0002-0101/
ERC721-compatible metadata aliases: public/nft/metadata/2.json through 101.json.
Canonical append-oriented records: originx/identity/output/akashic/0002.json through 0101.json.

## Inventory integration

CommerceCore retains ownership of order, settlement, serial allocation,
membership and mint-job creation. nft_release_assets only associates prepared
art and its hashes with one order, and references the existing allocation ledger.
A RESERVED asset cannot be reserved by a second order. Its serial is fixed
before payment, and finalization is in the existing settlement transaction.
Replayed settlement returns the existing result without another allocation.

Activation is default-off. FoundingCore uses this registry only when the
server-side ARCADE_RARE_RELEASE_ENABLED flag equals "true". The shipped release
has approvedForSale=false, so even enabling that flag alone cannot open it.
The four existing production payment gates remain unchanged.
This package does not modify Cloudflare environment variables, submit
transactions, deploy contracts, publish the Worker, or send email.

## Verification

    python3 originx/storage/verify_rare_release.py
    python3 originx/identity/akashic/tests/test_akashic.py
    node server/src/tests/oxRareReleaseInventoryTest.mjs
    node server/src/tests/p6bSettlementAuthorityTest.mjs

The new SQLite test exercises 100 outstanding orders, reverse-order settlement,
replay, sold-out rejection at 100, immutable hashes and a delivery failure that
rolls the entire settlement back. These are local tests, not a live purchase.

## Remaining before sales activation

- Review actual art and prepared metadata; mark approval only from real evidence.
- Reconcile any historical production allocations before enabling this registry.
- Abandoned reservations are deliberately retained. A verified cancellation /
  reconciliation procedure is needed; no automatic timeout releases a token
  while a late crypto transfer might still settle.
- Connect production delivery signer, custody and deployed contract, verify a
  real testnet mint and ownership/transfer reconciliation.
- Verify production payment, email, legal and infrastructure readiness using
  the project's existing activation checklist and perform a controlled canary.
- Run the full project build and Worker runtime/bundle checks in the full repo.
- Explicit production activation; publishing files alone is not sale activation.

The existing canonical gothic publication gate is not marked passed by this
arcade preparation package. Native arcade art needs its own reviewed visual
profile before it can be treated as an approved canonical render by that gate.
