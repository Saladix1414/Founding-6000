# DigitalBoost Origin — Founding 6000
## L1-D Production Activation Checklist

Real payments MUST remain disabled until every applicable item below
has been explicitly verified.

Current safe state:

- REAL_PAYMENTS_ENABLED=false
- PAYMENT_READINESS=false

---

## 1. Public production environment

- [ ] Final public domain selected.
- [ ] HTTPS/TLS active.
- [ ] FRONTEND_ORIGIN points to the final public HTTPS origin.
- [ ] Production backend is reachable only through intended infrastructure.
- [ ] CORS allows only the final production frontend origin.
- [ ] TRUST_PROXY configured according to the actual reverse-proxy topology.

## 2. Legal readiness

- [ ] Terms published at a public HTTPS URL.
- [ ] Privacy Policy published at a public HTTPS URL.
- [ ] Refund & Cancellation Policy published at a public HTTPS URL.
- [ ] TERMS_URL configured.
- [ ] PRIVACY_URL configured.
- [ ] REFUND_POLICY_URL configured.
- [ ] Seller identity and support contact verified.
- [ ] Final professional legal review completed before accepting real money.

## 3. Product disclosures

- [ ] Founding 6000 described as pre-order / reservation.
- [ ] No equity, security, investment, revenue share, ownership or governance claims.
- [ ] 12-month access starts at activation, not payment.
- [ ] January 5, 2027 remains labeled as TARGET LAUNCH, not guaranteed.
- [ ] Usage remains subject to DBX, fair-use and technical limits.
- [ ] USD values are clearly reference values where applicable.

## 4. USDT production readiness

- [ ] Ethereum Mainnet / chainId 1 confirmed.
- [ ] Official USDT contract confirmed.
- [ ] 6 decimals confirmed.
- [ ] Receiver wallet independently verified.
- [ ] Required confirmation count confirmed.
- [ ] Private HTTPS production RPC configured.
- [ ] RPC outage/failure procedure documented.
- [ ] USDT verification worker runs automatically.
- [ ] Worker restart/recovery procedure tested.
- [ ] Payment guard remains fail-closed.

## 5. Backend and data

- [ ] Production database topology decided.
- [ ] SQLite deployment constraints reviewed if SQLite remains in use.
- [ ] Persistent volume/storage configured.
- [ ] Database backup process tested.
- [ ] Restore process tested.
- [ ] Schema migration procedure documented.
- [ ] Inventory serial allocation reviewed for future RELEASED-state behavior.
- [ ] Settlement replay protections verified.
- [ ] Admin authority token stored securely.
- [ ] Secrets are not committed to Git.

## 6. Email

- [ ] Real transactional email provider configured.
- [ ] Production does not use LOG_ONLY transport.
- [ ] Sender/domain authentication configured where applicable.
- [ ] Registration email tested.
- [ ] Payment verified email tested.
- [ ] Membership created email tested.
- [ ] Membership activated email tested.
- [ ] Retry/dead-letter behavior reviewed.

## 7. ARS payment rails

- [ ] Mercado Pago production integration completed before exposing it as available.
- [ ] Server-side provider verification implemented.
- [ ] Provider webhook authenticity verified.
- [ ] Payment redirect/frontend success is never treated as authoritative payment.
- [ ] Naranja X shown only if a suitable official production integration is confirmed.

## 8. Operations and monitoring

- [ ] HTTPS health checks configured.
- [ ] Application logs available.
- [ ] Payment verification failures observable.
- [ ] Worker failures observable.
- [ ] Email delivery failures observable.
- [ ] Disk/database capacity monitored.
- [ ] Incident/contact procedure documented.
- [ ] Refund handling procedure documented.

## 9. Security regression

Before production activation, run:

    ./scripts/run-s1-security-suite.sh

Required result:

    S1 SECURITY HARDENING = PASS

Then run:

    npx tsx server/src/scripts/checkPaymentReadiness.ts

Required result:

    PAYMENT_READINESS_STATUS=PASS

## 10. Canary activation

Before opening Founding 6000 publicly:

- [ ] Use a controlled low-risk production canary.
- [ ] Confirm authoritative payment verification.
- [ ] Confirm one settlement only.
- [ ] Confirm one inventory allocation only.
- [ ] Confirm one membership only.
- [ ] Confirm expected emails.
- [ ] Confirm audit events.
- [ ] Confirm refund/support procedure.

Do not perform the canary until legal, infrastructure and payment
readiness have all passed.

---

## Final activation rule

The flags must NOT be changed merely to make a test pass.

Only after every production prerequisite is satisfied:

1. Run the complete S1 security suite.
2. Run payment readiness.
3. Obtain explicit production go/no-go approval.
4. Set PAYMENT_READINESS=true.
5. Re-run readiness and health checks.
6. Only then consider REAL_PAYMENTS_ENABLED=true.
7. Execute controlled canary before public launch.

Until then:

    PAYMENT_READINESS=false
    REAL_PAYMENTS_ENABLED=false
