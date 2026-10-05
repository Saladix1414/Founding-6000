import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createFoundingOrder,
  createUsdtAttempt,
  submitUsdtTxHash,
  type UsdtPaymentAttempt,
} from "../lib/foundingApi";

type Props = {
  email: string;
};

type SetupState =
  | "idle"
  | "loading"
  | "ready"
  | "error";

function formatNetwork(
  network: string,
) {
  if (
    network ===
    "ethereum-mainnet"
  ) {
    return "Ethereum Mainnet";
  }

  return network;
}

export default function UsdtPaymentPanel({
  email,
}: Props) {
  const initialized =
    useRef(false);

  const [
    setupState,
    setSetupState,
  ] =
    useState<SetupState>(
      "idle",
    );

  const [
    attempt,
    setAttempt,
  ] =
    useState<
      UsdtPaymentAttempt |
      null
    >(null);

  const [
    txHash,
    setTxHash,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  useEffect(() => {
    if (
      initialized.current
    ) {
      return;
    }

    initialized.current =
      true;

    async function initialize() {
      setSetupState(
        "loading",
      );

      setError(null);

      try {
        const orderResult =
          await createFoundingOrder(
            email,
          );

        const attemptResult =
          await createUsdtAttempt(
            orderResult.order.publicId,
          );

        setAttempt(
          attemptResult.attempt,
        );

        setSetupState(
          "ready",
        );
      } catch (cause) {
        setSetupState(
          "error",
        );

        setError(
          cause instanceof Error
            ? cause.message
            : "CHECKOUT_SETUP_FAILED",
        );
      }
    }

    void initialize();
  }, [email]);

  async function copyWallet() {
    if (!attempt) {
      return;
    }

    try {
      await navigator.clipboard
        .writeText(
          attempt.receiverAddress,
        );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        1800,
      );
    } catch {
      setError(
        "No pudimos copiar automáticamente. Mantén presionada la dirección para copiarla.",
      );
    }
  }

  async function submitEvidence() {
    if (!attempt) {
      return;
    }

    const normalized =
      txHash.trim();

    if (
      !/^0x[a-fA-F0-9]{64}$/.test(
        normalized,
      )
    ) {
      setError(
        "El hash debe comenzar con 0x y contener 64 caracteres hexadecimales.",
      );

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result =
        await submitUsdtTxHash(
          attempt.publicId,
          normalized,
        );

      setAttempt(
        result.attempt,
      );

      setTxHash(
        normalized,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "TX_SUBMISSION_FAILED",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (
    setupState ===
    "loading" ||
    setupState ===
    "idle"
  ) {
    return (
      <div className="usdt-payment-panel">
        <div className="usdt-loading">
          <span
            className="usdt-spinner"
            aria-hidden="true"
          />

          <div>
            <strong>
              Preparing secure
              USDT instructions
            </strong>

            <p>
              Creating your
              payment attempt…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    setupState ===
      "error" ||
    !attempt
  ) {
    return (
      <div className="usdt-payment-panel">
        <div
          className="usdt-notice usdt-notice-error"
          role="alert"
        >
          <strong>
            Could not prepare
            USDT checkout
          </strong>

          <p>
            {error ??
              "Unknown setup error"}
          </p>

          <p>
            No payment was
            processed.
          </p>
        </div>
      </div>
    );
  }

  const submitted =
    attempt.status ===
    "SUBMITTED";

  return (
    <div className="usdt-payment-panel">
      <div className="usdt-panel-head">
        <div>
          <span className="usdt-kicker">
            USDT · ERC-20
          </span>

          <h4>
            Send on Ethereum
            Mainnet
          </h4>
        </div>

        <span
          className={`usdt-status ${
            submitted
              ? "is-submitted"
              : ""
          }`}
        >
          {submitted
            ? "Submitted"
            : "Awaiting transfer"}
        </span>
      </div>

      <div className="usdt-amount-card">
        <span>
          Amount due
        </span>

        <strong>
          {Number(
            attempt.expectedAmountUsdt,
          ).toFixed(6)}
          {" "}
          USDT
        </strong>

        <small>
          Network fee is not
          included.
        </small>
      </div>

      <div className="usdt-payment-grid">
        <div className="usdt-field">
          <span>
            Network
          </span>

          <strong>
            {formatNetwork(
              attempt.network,
            )}
          </strong>
        </div>

        <div className="usdt-field">
          <span>
            Chain ID
          </span>

          <strong>
            {attempt.chainId}
          </strong>
        </div>

        <div className="usdt-field">
          <span>
            Token
          </span>

          <strong>
            USDT
          </strong>
        </div>

        <div className="usdt-field">
          <span>
            Standard
          </span>

          <strong>
            ERC-20
          </strong>
        </div>
      </div>

      <div className="usdt-address-block">
        <span>
          Send only to this
          Ethereum address
        </span>

        <code>
          {attempt.receiverAddress}
        </code>

        <button
          type="button"
          className="usdt-copy-button"
          onClick={
            copyWallet
          }
        >
          {copied
            ? "Copied ✓"
            : "Copy wallet"}
        </button>
      </div>

      <div className="usdt-token-contract">
        <span>
          USDT contract
        </span>

        <code>
          {attempt.tokenContract}
        </code>
      </div>

      <div className="usdt-notice">
        <strong>
          Ethereum gas
        </strong>

        <p>
          The sender needs ETH
          to pay the Ethereum
          network fee. Gas is
          separate from the
          USDT amount above.
        </p>
      </div>

      <div className="usdt-notice usdt-notice-warning">
        <strong>
          Ethereum Mainnet only
        </strong>

        <p>
          Do not send through
          Polygon, Base,
          Arbitrum, BNB Chain
          or any other network.
        </p>
      </div>

      {!submitted ? (
        <div className="usdt-tx-section">
          <label
            htmlFor="usdt-tx-hash"
          >
            Transaction hash
          </label>

          <p>
            After sending USDT,
            paste the Ethereum
            transaction hash
            here.
          </p>

          <input
            id="usdt-tx-hash"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x..."
            value={txHash}
            onChange={(event) => {
              setTxHash(
                event.target.value,
              );

              setError(null);
            }}
          />

          {error && (
            <div
              className="usdt-inline-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            className="db-button db-button-primary usdt-submit-button"
            disabled={
              submitting
            }
            onClick={
              submitEvidence
            }
          >
            {submitting
              ? "Submitting…"
              : "Submit transaction hash"}
          </button>
        </div>
      ) : (
        <div className="usdt-submitted-card">
          <span className="usdt-submitted-mark">
            ✓
          </span>

          <div>
            <strong>
              Transaction
              evidence received
            </strong>

            <p>
              Your transaction
              has not been
              confirmed as a
              payment yet.
            </p>

            <code>
              {attempt.txHash}
            </code>
          </div>
        </div>
      )}

      <div className="usdt-legal-links">
        <span>
          By continuing, you can review:
        </span>

        <div className="usdt-legal-link-row">
          <a
            href="/legal/terms.html"
            target="_blank"
            rel="noreferrer"
          >
            Terms
          </a>

          <a
            href="/legal/privacy.html"
            target="_blank"
            rel="noreferrer"
          >
            Privacy
          </a>

          <a
            href="/legal/refunds.html"
            target="_blank"
            rel="noreferrer"
          >
            Refunds
          </a>
        </div>
      </div>

      <div className="usdt-authority-note">
        <strong>
          Verification required
        </strong>

        <p>
          Submitting a
          transaction hash does
          not create a
          membership, mark the
          order as paid, or
          reserve inventory.
          Server-side Ethereum
          verification is
          required first.
        </p>
      </div>
    </div>
  );
}
