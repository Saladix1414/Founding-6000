# OX-NFT-25 — Protected Admin Transfer

Status: IMPLEMENTED LOCALLY — NOT DEPLOYED

## Authority

- One active DEFAULT_ADMIN_ROLE address.
- ADMIN and MINTER must remain separated.
- ADMIN may be a founder-controlled Safe.
- No external human authority is required.

## Transfer protocol

1. Current ADMIN proposes a nonzero address.
2. Proposed address must not hold MINTER_ROLE.
3. Start a security delay (proposed: 48 hours).
4. ADMIN may cancel while transfer is pending.
5. Only proposed address may accept.
6. Acceptance is blocked before the deadline.
7. Acceptance atomically replaces old ADMIN.
8. Final admin count remains exactly one.

## Security restrictions

- Direct ADMIN grantRole must be blocked.
- Direct removal of last ADMIN must be blocked.
- Unauthorized proposals must revert.
- Unauthorized cancellation must revert.
- Wrong-wallet acceptance must revert.
- Replaced or cancelled proposals must not execute.
- Transfer cannot be bypassed through other roles.
- No mint, payment or treasury authority is implied.

## Recovery boundaries

- Contract cannot recover lost private keys.
- Safe signer recovery is separate from NFT roles.
- No arbitrary administrator recovery function.
- No backend, AI or bot administrative authority.

## Verification gates

- Local negative tests before implementation.
- Positive transfer and cancellation tests.
- Deadline boundary tests.
- ADMIN/MINTER separation tests.
- Existing lifecycle and full-supply regression.
- New versioned ABI, bytecode and hashes.
- Explicit authorization before deployment.
