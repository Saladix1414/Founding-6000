import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createFoundingOrder,
  createUsdtAttempt,
  getUsdtPaymentAttempt,
  submitUsdtTxHash,
  type FoundingPaymentResult,
  type UsdtPaymentAttempt,
} from "../lib/foundingApi";

type Language =
  | "en"
  | "es";

type Props = {
  email: string;

  language:
    Language;

  onVerified: (
    result:
      FoundingPaymentResult,
  ) => void;
};

type SetupState =
  | "idle"
  | "loading"
  | "ready"
  | "error";

const SESSION_KEY =
  "founding6000-usdt-attempt";

function formatNetwork(
  network: string,
) {
  return network ===
    "ethereum-mainnet"
    ? "Ethereum Mainnet"
    : network;
}

function saveAttemptToSession(
  email: string,
  publicId: string,
) {
  try {
    window.sessionStorage
      .setItem(
        SESSION_KEY,
        JSON.stringify({
          email:
            email
              .trim()
              .toLowerCase(),

          publicId,
        }),
      );
  } catch {
    // Checkout still works without session recovery.
  }
}

function clearAttemptFromSession() {
  try {
    window.sessionStorage
      .removeItem(
        SESSION_KEY,
      );
  } catch {
    // Best effort.
  }
}

export default function UsdtPaymentPanel({
  email,
  language,
  onVerified,
}: Props) {
  const initialized =
    useRef(false);

  const onVerifiedRef =
    useRef(onVerified);

  const verifiedNotified =
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
    verificationNote,
    setVerificationNote,
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
    onVerifiedRef.current =
      onVerified;
  }, [onVerified]);

  const notifyVerified =
    useCallback((
      result:
        FoundingPaymentResult,
    ) => {
    if (
      verifiedNotified.current
    ) {
      return;
    }

    if (
      !result.paymentVerified ||
      result.verificationStatus !==
        "VERIFIED" ||
      !result.order ||
      !result.allocation ||
      !result.membership
    ) {
      return;
    }

    verifiedNotified.current =
      true;

    onVerifiedRef.current(
      result,
    );
  }, []);

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
        /*
         * Recover an existing payment attempt after a
         * browser refresh in the same tab/session.
         */
        let saved:
          | {
              email:
                string;

              publicId:
                string;
            }
          | null =
          null;

        try {
          const raw =
            window.sessionStorage
              .getItem(
                SESSION_KEY,
              );

          if (raw) {
            saved =
              JSON.parse(raw);
          }
        } catch {
          saved = null;
        }

        if (
          saved &&
          saved.email ===
            email
              .trim()
              .toLowerCase() &&
          /^PAY-USDT-[A-F0-9]{12}$/
            .test(
              saved.publicId,
            )
        ) {
          try {
            const recovered =
              await getUsdtPaymentAttempt(
                saved.publicId,
              );

            setAttempt(
              recovered.attempt,
            );

            if (
              recovered.attempt
                .txHash
            ) {
              setTxHash(
                recovered.attempt
                  .txHash,
              );
            }

            if (
              recovered
                .verificationStatus ===
                "REJECTED" ||
              recovered.attempt
                .status ===
                "REJECTED"
            ) {
              clearAttemptFromSession();
            }

            setSetupState(
              "ready",
            );

            notifyVerified(
              recovered,
            );

            return;
          } catch {
            // Preserve the saved attempt when recovery is uncertain.
            // Do not create another order after a failed lookup.
            throw new Error("PAYMENT_RECOVERY_UNAVAILABLE");
          }
        }

        const orderResult =
          await createFoundingOrder(
            email,
          );

        const attemptResult =
          await createUsdtAttempt(
            orderResult
              .order.publicId,
          );

        setAttempt(
          attemptResult.attempt,
        );

        saveAttemptToSession(
          email,
          attemptResult
            .attempt.publicId,
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
  }, [
    email,
    notifyVerified,
  ]);

  const pollingAttemptPublicId =
    attempt?.publicId ??
    null;

  const pollingAttemptStatus =
    attempt?.status ??
    null;

  /*
   * Polling starts only after a tx hash was submitted.
   *
   * GET is authoritative and drives the server-side
   * Ethereum verification pipeline.
   */
  useEffect(() => {
    const paymentAttemptPublicId =
      pollingAttemptPublicId;

    if (
      !paymentAttemptPublicId ||
      !pollingAttemptStatus ||
      ![
        "SUBMITTED",
        "VERIFYING",
      ].includes(
        pollingAttemptStatus,
      )
    ) {
      return;
    }

    const activePaymentAttemptPublicId:
      string =
      paymentAttemptPublicId;

    let cancelled =
      false;

    let timer:
      number |
      undefined;

    async function poll() {
      try {
        const result =
          await getUsdtPaymentAttempt(
            activePaymentAttemptPublicId,
          );

        if (cancelled) {
          return;
        }

        setAttempt(
          result.attempt,
        );

        if (
          result.paymentVerified &&
          result.verificationStatus ===
            "VERIFIED"
        ) {
          setVerificationNote(
            null,
          );

          notifyVerified(
            result,
          );

          return;
        }

        if (
          result
            .verificationStatus ===
            "REJECTED" ||
          result.attempt
            .status ===
            "REJECTED"
        ) {
          clearAttemptFromSession();

          setError(
            language === "es"
              ? "La transacción no coincide con los requisitos de este pago. No se creó ninguna membresía."
              : "The transaction does not match this payment's requirements. No membership was created.",
          );

          return;
        }

        setVerificationNote(
          language === "es"
            ? "Verificando la transacción en Ethereum. Se requieren 12 confirmaciones."
            : "Verifying the transaction on Ethereum. 12 confirmations are required.",
        );
      } catch {
        if (cancelled) {
          return;
        }

        /*
         * Infrastructure/RPC interruptions do not reject
         * the buyer. Keep polling.
         */
        setVerificationNote(
          language === "es"
            ? "La verificación continúa. Hubo una demora temporal al consultar Ethereum."
            : "Verification is still pending. Ethereum lookup is temporarily delayed.",
        );
      }

      if (!cancelled) {
        timer =
          window.setTimeout(
            poll,
            5000,
          );
      }
    }

    timer =
      window.setTimeout(
        poll,
        1200,
      );

    return () => {
      cancelled =
        true;

      if (
        timer !== undefined
      ) {
        window.clearTimeout(
          timer,
        );
      }
    };
  }, [
    pollingAttemptPublicId,
    pollingAttemptStatus,
    language,
    notifyVerified,
  ]);

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
        language === "es"
          ? "No pudimos copiar automáticamente. Mantené presionada la dirección para copiarla."
          : "We could not copy automatically. Press and hold the address to copy it.",
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
      !/^0x[a-fA-F0-9]{64}$/
        .test(
          normalized,
        )
    ) {
      setError(
        language === "es"
          ? "Pegá el identificador completo de la transacción: 0x seguido de 64 caracteres hexadecimales."
          : "Paste the complete transaction ID: 0x followed by 64 hexadecimal characters.",
      );

      return;
    }

    setSubmitting(true);
    setError(null);
    setVerificationNote(null);

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

      setVerificationNote(
        language === "es"
          ? "Recibimos el identificador. Estamos verificando la transacción en Ethereum."
          : "We received the transaction ID. We are verifying the transaction on Ethereum.",
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
              {language === "es"
                ? "Preparando tu pago en USDT"
                : "Preparing your USDT payment"}
            </strong>

            <p>
              {language === "es"
                ? "Consultando los datos para tu transferencia…"
                : "Getting the details for your transfer…"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    setupState === "error" ||
    !attempt
  ) {
    return (
      <div className="usdt-payment-panel">
        <div
          className="usdt-notice usdt-notice-error"
          role="alert"
        >
          <strong>
            {language === "es"
              ? "No pudimos preparar el pago en USDT"
              : "Could not prepare your USDT payment"}
          </strong>

          <p>
            {error === "PAYMENT_RECOVERY_UNAVAILABLE"
              ? language === "es"
                ? "No pudimos consultar tu intento de pago anterior. Conservamos su referencia y no iniciamos otra orden. Podés cerrar y volver a abrir este formulario para intentar recuperarlo."
                : "We could not retrieve your previous payment attempt. We kept its reference and did not start another order. You can close and reopen this form to try retrieving it again."
              : language === "es"
                ? "No pudimos obtener las instrucciones de pago. No envíes fondos hasta que estén disponibles."
                : "We could not retrieve the payment instructions. Do not send funds until they are available."}
          </p>

          <p>
            {language === "es"
              ? "Si ya enviaste USDT, no repitas la transferencia. Conservá su identificador; este mensaje no confirma ni descarta el pago."
              : "If you already sent USDT, do not send it again. Keep the transaction ID; this message neither confirms nor rules out payment."}
          </p>
        </div>
      </div>
    );
  }

  /* OX expired payment presentation */
  if (attempt.status === "EXPIRED") {
    return (
      <div className="usdt-payment-panel">
        <div
          className="usdt-notice usdt-notice-warning"
          role="alert"
        >
          <strong>
            {language === "es"
              ? "Este intento de pago venció"
              : "This payment attempt has expired"}
          </strong>

          <p>
            {language === "es"
              ? "No uses las instrucciones de este intento para enviar fondos. Ya no admite nuevos identificadores de transacción."
              : "Do not use this attempt’s instructions to send funds. It no longer accepts transaction IDs."}
          </p>

          <p>
            {language === "es"
              ? "Si ya enviaste USDT, no repitas la transferencia. Conservá el comprobante, el identificador de la transacción y esta referencia para solicitar una revisión."
              : "If you already sent USDT, do not send it again. Keep your receipt, transaction ID and this reference to request a review."}
          </p>

          <p>
            {language === "es"
              ? "Este aviso no confirma un pago ni un reembolso."
              : "This notice does not confirm a payment or a refund."}
          </p>
        </div>

        <div className="usdt-field">
          <span>
            {language === "es"
              ? "Referencia del intento"
              : "Payment attempt reference"}
          </span>
          <code style={{ overflowWrap: "anywhere" }}>
            {attempt.publicId}
          </code>
        </div>

        {attempt.txHash && (
          <div className="usdt-field">
            <span>
              {language === "es"
                ? "Identificador registrado"
                : "Recorded transaction ID"}
            </span>
            <code style={{ overflowWrap: "anywhere" }}>
              {attempt.txHash}
            </code>
          </div>
        )}

        <div className="usdt-legal-links">
          <div className="usdt-legal-link-row">
            <a
              href="/legal/terms.html"
              target="_blank"
              rel="noreferrer"
            >
              {language === "es" ? "Términos" : "Terms"}
            </a>
            <a
              href="/legal/refunds.html"
              target="_blank"
              rel="noreferrer"
            >
              {language === "es" ? "Reembolsos" : "Refunds"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel = (() => {
    switch (
      attempt.status
    ) {
      case "SUBMITTED":
        return language === "es"
          ? "Transacción enviada a verificar"
          : "Transaction submitted for verification";

      case "VERIFYING":
        return language === "es"
          ? "Verificando"
          : "Verifying";

      case "VERIFIED":
        return language === "es"
          ? "Verificado"
          : "Verified";

      case "REJECTED":
        return language === "es"
          ? "No verificado"
          : "Not verified";



      default:
        return language === "es"
          ? "Esperando transferencia"
          : "Awaiting transfer";
    }
  })();

  const awaiting =
    attempt.status ===
    "AWAITING_TRANSFER";

  const submitted =
    attempt.status ===
      "SUBMITTED" ||
    attempt.status ===
      "VERIFYING";

  const rejected =
    attempt.status ===
    "REJECTED";

  return (
    <div className="usdt-payment-panel">
      <div className="usdt-panel-head">
        <div>
          <span className="usdt-kicker">
            USDT · ERC-20
          </span>

          <h4>
            {language === "es"
              ? "Enviar por Ethereum Mainnet"
              : "Send on Ethereum Mainnet"}
          </h4>
        </div>

        <span
          className={`usdt-status ${
            attempt.status ===
              "VERIFIED"
              ? "is-verified"
              : attempt.status ===
                    "REJECTED"
                ? "is-rejected"
                : submitted
                  ? "is-submitted"
                  : ""
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="usdt-amount-card">
        <span>
          {language === "es"
            ? "Monto exacto"
            : "Exact amount due"}
        </span>

        <strong>
          {Number(
            attempt.expectedAmountUsdt,
          ).toFixed(6)}
          {" "}
          USDT
        </strong>

        <small>
          {language === "es"
            ? "La comisión de red no está incluida."
            : "The network fee is not included."}
        </small>
      </div>

      <div className="usdt-payment-grid">
        <div className="usdt-field">
          <span>
            {language === "es"
              ? "Red"
              : "Network"}
          </span>

          <strong>
            {formatNetwork(
              attempt.network,
            )}
          </strong>
        </div>

        <div className="usdt-field">
          <span>
            {language === "es" ? "ID de red" : "Chain ID"}
          </span>

          <strong>
            {attempt.chainId}
          </strong>
        </div>

        <div className="usdt-field">
          <span>Token</span>
          <strong>USDT</strong>
        </div>

        <div className="usdt-field">
          <span>
            {language === "es" ? "Estándar" : "Standard"}
          </span>

          <strong>
            ERC-20
          </strong>
        </div>
      </div>

      <div className="usdt-address-block">
        <span>
          {language === "es"
            ? "Enviar únicamente a esta dirección Ethereum"
            : "Send only to this Ethereum address"}
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
            ? language === "es"
              ? "Copiada ✓"
              : "Copied ✓"
            : language === "es"
              ? "Copiar dirección"
              : "Copy address"}
        </button>
      </div>

      <div className="usdt-token-contract">
        <span>
          {language === "es"
            ? "Contrato oficial USDT"
            : "Official USDT contract"}
        </span>

        <code>
          {attempt.tokenContract}
        </code>
      </div>

      <div className="usdt-notice">
        <strong>
          {language === "es" ? "Comisión de red (gas)" : "Network fee (gas)"}
        </strong>

        <p>
          {language === "es"
            ? "La wallet que envía necesita ETH para pagar el gas de Ethereum. El gas es independiente del monto USDT."
            : "The sending wallet needs ETH for Ethereum gas. Gas is separate from the USDT amount."}
        </p>
      </div>

      <div className="usdt-notice usdt-notice-warning">
        <strong>
          {language === "es"
            ? "Solo Ethereum Mainnet"
            : "Ethereum Mainnet only"}
        </strong>

        <p>
          {language === "es"
            ? "No envíes por Polygon, Base, Arbitrum, BNB Chain ni ninguna otra red."
            : "Do not send through Polygon, Base, Arbitrum, BNB Chain or any other network."}
        </p>
      </div>

      {awaiting && (
        <div className="usdt-tx-section">
          <label htmlFor="usdt-tx-hash">
            {language === "es"
              ? "Identificador de transacción (hash)"
              : "Transaction ID (hash)"}
          </label>

          <p>
            {language === "es"
              ? "Después de enviar USDT, copiá el identificador de la transacción desde tu wallet y pegalo aquí. Comienza con 0x."
              : "After sending USDT, copy the transaction ID from your wallet and paste it here. It starts with 0x."}
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
            disabled={submitting}
            onClick={
              submitEvidence
            }
          >
            {submitting
              ? language === "es"
                ? "Enviando…"
                : "Submitting…"
              : language === "es"
                ? "Verificar transacción"
                : "Verify transaction"}
          </button>
        </div>
      )}

      {submitted && (
        <div className="usdt-submitted-card">
          <span className="usdt-submitted-mark">
            …
          </span>

          <div>
            <strong>
              {language === "es"
                ? "Verificación en curso"
                : "Verification in progress"}
            </strong>

            <p>
              {verificationNote ??
                (
                  language === "es"
                    ? "Esperando confirmaciones de Ethereum."
                    : "Waiting for Ethereum confirmations."
                )}
            </p>

            <code>
              {attempt.txHash}
            </code>
          </div>
        </div>
      )}

      {rejected && (
        <div
          className="usdt-notice usdt-notice-error"
          role="alert"
        >
          <strong>
            {language === "es"
              ? "Pago no verificado"
              : "Payment not verified"}
          </strong>

          <p>
            {error ??
              (
                language === "es"
                  ? "La transacción no cumple los requisitos de este pago."
                  : "The transaction does not meet this payment’s requirements."
              )}
          </p>
        </div>
      )}

      <div className="usdt-legal-links">
        <span>
          {language === "es"
            ? "Antes de pagar podés revisar:"
            : "Before paying, review:"}
        </span>

        <div className="usdt-legal-link-row">
          <a
            href="/legal/terms.html"
            target="_blank"
            rel="noreferrer"
          >
            {language === "es"
              ? "Términos"
              : "Terms"}
          </a>

          <a
            href="/legal/privacy.html"
            target="_blank"
            rel="noreferrer"
          >
            {language === "es"
              ? "Privacidad"
              : "Privacy"}
          </a>

          <a
            href="/legal/refunds.html"
            target="_blank"
            rel="noreferrer"
          >
            {language === "es"
              ? "Reembolsos"
              : "Refunds"}
          </a>
        </div>
      </div>

      <div className="usdt-authority-note">
        <strong>
          {language === "es"
            ? "Cuándo se confirma tu pago"
            : "When your payment is confirmed"}
        </strong>

        <p>
          {language === "es"
            ? "Pegar el identificador no confirma el pago. Primero verificamos la transferencia en Ethereum. Solo después se crean tu membresía y tu número Founding."
            : "Submitting the transaction ID does not confirm payment. We first verify the transfer on Ethereum. Only then are your membership and Founding number created."}
        </p>
      </div>
    </div>
  );
}
