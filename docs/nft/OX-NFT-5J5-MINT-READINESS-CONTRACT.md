# OriginX — PHASE 5J.5 Mint Readiness Contract

Status: DESIGN GATE / NO MINT AUTHORITY

## Purpose

Transition one eligible NFT mint job from
AWAITING_WALLET to READY only through a trusted
internal service after fresh SQLite validation.

## Required evidence

1. Order is PAID.
2. Original subscriber email matches the order.
3. Membership is ACTIVATION_PENDING.
4. Serial number belongs to the same mint job.
5. Email claim was consumed by verified wallet proof.
6. Wallet challenge is VERIFIED.
7. Wallet binding is BOUND and chain ID is 8453.
8. Binding event exists and references the same challenge.
9. Mint job is AWAITING_WALLET.
10. Recipient and mint transaction hash are NULL.

## Mandatory implementation properties

- Fail closed by default.
- No public API may activate readiness directly.
- Authorization comes from trusted server context.
- A browser-supplied role or boolean is not authority.
- Revalidate evidence within the write transaction.
- Use a conditional, single-job SQLite UPDATE.
- Set recipient_address to the verified bound wallet.
- Change status only AWAITING_WALLET -> READY.
- Persist an immutable readiness audit event.
- Roll back recipient/status if audit insertion fails.
- Reject attempts to substitute the wallet.
- Reject duplicate transitions and cross-membership requests.
- Never overwrite an existing recipient.
- Never change the original subscriber email.
- Never change membership activation or ownership.
- Never execute blockchain transactions.
- Never construct a transaction signer in this module.
- READY is a queue state, not mint approval.

## Required tests

- Happy path on real SQLite
- Wrong subscriber email rejected
- Missing verified challenge rejected
- Wrong or revoked binding rejected
- Missing binding event rejected
- Serial mismatch rejected
- Existing recipient rejected
- Prior READY job rejected
- Duplicate/concurrent transition: one success
- Audit write failure: full SQLite rollback
- Retry after transient failure
- Existing NFT buyer regressions
- Cloudflare Durable Object isolated E2E
- Production Worker remains unchanged
- Wrangler dry-run without deployment

## Authority separation

EMAIL VERIFICATION != MINT APPROVAL

WALLET SIGNATURE != MINT AUTHORITY

DELIVERY PREFLIGHT != APPROVAL

READY != BLOCKCHAIN TRANSACTION

ON-CHAIN OWNER != ORIGINAL PURCHASER

NO REAL MINT OR FUNDS MOVEMENT IN PHASE 5J.5
