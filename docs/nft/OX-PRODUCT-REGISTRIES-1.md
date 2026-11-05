# OriginX Founding 6000 — Membership, Reserve & Redemption registries V1

**Status:** SCHEMA_AND_INTERNAL_SERVICES_PREPARED / NOT_ACTIVATED_IN_PRODUCTION.
**Target:** `deploy/cloudflare-d4`, Cloudflare Durable Object SQLite (`FoundingCore`).
**Scope:** data structures, protected internal operations, SQLite tests, no public routes, no blockchain transactions.

## 1. Membership registry

Tables:
- `ox_membership_access`: one serial (1..6000) / one verified membership / one settlement. Records activation time, original expiry, last **observed** owner and last observed block/log index.
- `ox_membership_access_events`: append-only registration, activation and transfer observations.

Functions:
- `registerSettledMembership`: requires matching `founding_memberships` + paid order + inventory allocation + verified USDT attempt + settlement on Ethereum mainnet with >=12 confirmations, correct USDT contract, matching receiver and payment amount. No activation.
- `activateVerifiedMembership`: 12 calendar months from verified activation, not payment; updates existing membership and registry atomically, requires independent trusted authorization and proof verifier for minted Base NFT and current owner.
- `observeVerifiedOwnershipTransfer`: requires fresh, verified Base ownership proof; **does not restart expiry** or create a second access entitlement.
- `membershipAccessSnapshot`: cached observation only. This is **not** proof of the current owner. Product login and access control must verify live/appropriately finalized on-chain ownership (or signed attestations with a safe freshness policy) and enforce expiry.

## 2. Reserve accounting

Tables:
- `ox_reserve_movements`: immutable, deduplicated event with policy ID, network, USDT amount (integer minor units; 6 decimals), reference, evidence hash, optional serial.
- `ox_reserve_lines`: double-entry journal; immutable. Each movement balances to zero. No floating-point currency math.

Kinds:

| Kind | Debit / credit movement in internal ledger |
| --- | --- |
| ACCRUAL | expected reserve receivable increases, **not** liquid custody |
| FUNDING | receivable decreases, verified liquid custody increases |
| INVESTMENT | liquid custody decreases, investment account increases |
| DIVESTMENT | investment decreases, liquid increases |
| GAIN | verified liquid gain increases |
| LOSS | verified investment loss decreases invested balance |
| REDEMPTION | liquid **Base** custody decreases only after separate atomic payout/burn verification |

Balance checks prevent negative receivable, liquid and invested accounts (liquid/invested are network-specific). Accrual and custody are intentionally distinct. `reserveBalances` returns Ethereum and Base separately; it always reports `custodyVerifiedAtRead=false` because a fresh RPC treasury reconciliation has not been implemented. `reserveMovementHistory` provides bounded internal operational history; it is not public API.

**CRITICAL:** There is no installed production verifier for treasury custody, investment actions or policy authorization. `authorize` and `verifyEvidence` callbacks are required and fail closed when absent. The test suite uses deliberately permissive fake callbacks **only against an isolated in-memory database**, never in the Worker. A deployed service MUST provide trusted, audited verifiers with policy-version approval and on-chain or bank-custody reconciliation. The 50% reserve contribution, up to 10% community-voted investment and 15% of later net services are commercial-policy proposals, **not automated ledger percentages**. They require an explicitly approved version, a cutover/reconciliation of historical entries, and evidence-based posting; no retroactive rewrite.

## 3. Redemption registry

Table:
- `ox_redemption_requests`: unique idempotency request key; one active/settled request per serial, status (`POLICY_PENDING`, `CANCELLED`, `SETTLED`), evidence hash, optional settlement policy/amount and same-chain tx hash.

Functions:
- `prepareRedemptionRequest`: requires active membership register and proof of **current** Base owner. Merely records `POLICY_PENDING`. Does not authorize a payment, burn or reserve debit.
- `recordVerifiedAtomicRedemption`: **reconciliation only**, after an external trusted verifier has authenticated an already completed atomic Base-chain payment and burn in the same transaction under an approved policy. It debits Base liquid journal, settles the request and marks access `REDEEMED` in one SQLite transaction. No signer, wallet secret, operator UI or executor provided.
- `redemptionSnapshot`: limited internal read-only status.

**Never burn the NFT first and pay later.** The existing checkout receives USDT on Ethereum mainnet, while the NFT is planned on Base (`chainId=8453`). These are different chains: atomic payout+burn cannot be assumed without verified same-chain liquidity, an audited executor/contract and reconciled custody. A prior sale, complete supply, or a `POLICY_PENDING` record does not authorize redemption.

### Draft commercial preview (not authoritative)

`oxReservePolicyV4Draft.mjs` models 50% of each sale, 15% of future verified net service profit, 10% maximum invested and 90% minimum liquid, **with all 6,000 serials available (including #0001)**. It uses integer minor units and reports fractional-unit remainders, but it deliberately does not post journal entries or authorize investments. Distribution of reserve amounts by tier / beneficiary remains a separate versioned rule requiring approval.

## 4. Legacy policy discrepancy — blocking release

Historical modules/docs from the audited branch still use 25% reserves and reserve serial `#0001`. The product decisions discussed most recently are 50% reserves and **no** NFT reserved. This patch purposely does NOT rewrite existing reserve history, source files, NFT metadata, release allocations or the old redemption preparation. Therefore the existing commercial policy and economics must be reconciled and versioned before automatic reserve entries and any redemption activation. No guarantee of returns, payout amount, available liquidity or capital protection is created by these records. Legal, financial and consumer disclosures must be validated before launch.

## 5. Integration and limitations

`cloudflare/foundingCore.mjs` calls `initializeFoundingProductRegistries(state.storage)` **after** the existing CommerceCore schema initialization. Each `CREATE TABLE`, index and trigger is idempotent. Existing checkout endpoints, keys, prices, mint policies, metadata, Cloudflare Worker routes and contracts are unchanged.

The installed functions are internal-only and **unwired** to automatic settlement, UI, wallet owner polling and third-party investment jobs. Production requires:
1. Reconcile active reserve policy and `#0001` no-reservation semantics; pin approved policy hashes and effective dates.
2. Introduce and audit trusted evidence verifiers/authorization adapters, token and treasury contract allowlists, retries and event finality rules.
3. Reconcile actual treasury liquidity with Base settlement asset and commission costs; run full historical migration and crash/replay tests.
4. Design, test and audit an atomic, same-chain redemption executor/contract, policy-based amount calculation, nonce/order protections and reentrancy protection.
5. Integrate a private owner-authenticated membership API, public privacy-safe reserve snapshots, appropriate observability and customer communications.

## 6. Validation

Run `node --test tests/oxProductRegistries.test.mjs` (Node 22+ `node:sqlite`; recommended Node 24). Tests exercise replay, insufficient funds, paid-source matching, activation and transfer expiry, proof fail-closed behavior and settlement reconciliation. These are development simulations and are **not** a production security audit.

No `git push` or `wrangler deploy` is performed by the installer.
