import {
  useEffect,
  useState,
} from "react";

import {
  getTokenEconomy,
  type TokenEconomy,
} from "../lib/foundingApi";

import NftEconomyTimeline from "./NftEconomyTimeline";

type Language =
  | "en"
  | "es";

type Props = {
  tokenId:
    number;

  language:
    Language;
};

function formatSerial(
  value:
    number,
) {
  return `#${String(
    value,
  ).padStart(
    4,
    "0",
  )}`;
}

function formatPercentFromBps(
  value:
    string | null,
) {
  if (
    value === null
  ) {
    return "—";
  }

  const bps =
    BigInt(
      value,
    );

  const negative =
    bps < 0n;

  const absolute =
    negative
      ? -bps
      : bps;

  const whole =
    absolute /
    100n;

  const fraction =
    (
      absolute %
      100n
    )
      .toString()
      .padStart(
        2,
        "0",
      );

  return `${
    negative
      ? "-"
      : "+"
  }${whole}.${fraction}%`;
}

function formatCoverage(
  value:
    string | null,
) {
  if (
    value === null
  ) {
    return "—";
  }

  const bps =
    BigInt(
      value,
    );

  const whole =
    bps /
    100n;

  const fraction =
    (
      bps %
      100n
    )
      .toString()
      .padStart(
        2,
        "0",
      );

  return `${whole}.${fraction}%`;
}

function shortenHash(
  value:
    string | null,
) {
  if (!value) {
    return "—";
  }

  if (
    value.length <= 24
  ) {
    return value;
  }

  return `${value.slice(
    0,
    14,
  )}…${value.slice(
    -10,
  )}`;
}

function proofLabel(
  economy:
    TokenEconomy,

  language:
    Language,
) {
  if (
    economy
      .proofOfReserve
      .status ===
    "VERIFIED"
  ) {
    return language ===
      "es"
      ? "Verificado"
      : "Verified";
  }

  if (
    economy
      .proofOfReserve
      .status ===
    "NOT_FULLY_COVERED"
  ) {
    return language ===
      "es"
      ? "Cobertura incompleta"
      : "Coverage incomplete";
  }

  return language ===
    "es"
    ? "Sin snapshot"
    : "No snapshot";
}

export function NftEconomyPanel({
  tokenId,
  language,
}: Props) {
  const [
    economy,
    setEconomy,
  ] =
    useState<
      TokenEconomy |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      setLoading(
        true,
      );

      setError(
        null,
      );

      try {
        const result =
          await getTokenEconomy(
            tokenId,
          );

        if (
          cancelled
        ) {
          return;
        }

        setEconomy(
          result.economy,
        );
      } catch {
        if (
          cancelled
        ) {
          return;
        }

        setEconomy(
          null,
        );

        setError(
          language === "es"
            ? "La información económica todavía no está disponible para este token."
            : "Economic information is not yet available for this token.",
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, [
    tokenId,
    language,
  ]);

  if (
    loading
  ) {
    return (
      <section
        className="nft-economy-panel nft-economy-panel--loading"
        aria-busy="true"
      >
        <div className="nft-economy-panel__loading-line" />
        <div className="nft-economy-panel__loading-grid" />
      </section>
    );
  }

  if (
    error ||
    !economy
  ) {
    return (
      <section className="nft-economy-panel nft-economy-panel--unavailable">
        <div>
          <span className="nft-economy-panel__eyebrow">
            ECONOMY
          </span>

          <strong>
            {language === "es"
              ? "Economía aún no disponible"
              : "Economy not yet available"}
          </strong>

          <p>
            {error}
          </p>
        </div>
      </section>
    );
  }

  const current =
    economy.current;

  const proof =
    economy
      .proofOfReserve;

  const growthLabel =
    current
      ? formatPercentFromBps(
          current.growthBps,
        )
      : "—";

  const growthPositive =
    current
      ?.growthBps !==
        null &&
    current
      ?.growthBps !==
        undefined &&
    BigInt(
      current.growthBps,
    ) > 0n;

  const growthNegative =
    current
      ?.growthBps !==
        null &&
    current
      ?.growthBps !==
        undefined &&
    BigInt(
      current.growthBps,
    ) < 0n;

  return (
    <section
      className="nft-economy-panel"
      aria-label={
        language === "es"
          ? `Economía del token ${formatSerial(tokenId)}`
          : `Token ${formatSerial(tokenId)} economy`
      }
    >
      <header className="nft-economy-panel__header">
        <div>
          <span className="nft-economy-panel__eyebrow">
            ORIGINX · ECONOMY
          </span>

          <h3>
            {economy.collectionTier}
            {" "}
            {formatSerial(
              economy.serialNumber,
            )}
          </h3>

          <p>
            {language === "es"
              ? "Estado económico verificable del token"
              : "Verifiable token economic state"}
          </p>
        </div>

        <div
          className={[
            "nft-economy-panel__proof",
            proof.status ===
              "VERIFIED"
              ? "is-verified"
              : proof.status ===
                  "NOT_FULLY_COVERED"
                ? "is-warning"
                : "is-unavailable",
          ].join(" ")}
        >
          <span className="nft-economy-panel__proof-dot" />

          <span>
            {language === "es"
              ? "Proof of Reserve"
              : "Proof of Reserve"}
          </span>

          <strong>
            {proofLabel(
              economy,
              language,
            )}
          </strong>
        </div>
      </header>

      <div className="nft-economy-panel__primary-grid">
        <article className="nft-economy-metric">
          <span>
            {language === "es"
              ? "Adquisición original"
              : "Original acquisition"}
          </span>

          <strong>
            {economy
              .acquisition
              .amountUsdt}
            {" "}
            <small>USDT</small>
          </strong>
        </article>

        <article className="nft-economy-metric">
          <span>
            {language === "es"
              ? "Aporte total a reserva"
              : "Reserve contribution"}
          </span>

          <strong>
            {economy
              .reserveContribution
              .totalUsdt}
            {" "}
            <small>USDT</small>
          </strong>

          <small>
            {(
              economy
                .reserveContribution
                .reserveBps /
              100
            ).toFixed(
              2,
            )}
            %
          </small>
        </article>

        <article className="nft-economy-metric">
          <span>
            {language === "es"
              ? "NAV actual"
              : "Current NAV"}
          </span>

          <strong>
            {current
              ?.navUsdt ??
              "—"}
            {current
              ?.navUsdt
              ? " "
              : ""}
            {current
              ?.navUsdt && (
                <small>
                  USDT
                </small>
              )}
          </strong>
        </article>

        <article className="nft-economy-metric">
          <span>
            {language === "es"
              ? "Evolución del NAV"
              : "NAV evolution"}
          </span>

          <strong
            className={
              growthPositive
                ? "is-positive"
                : growthNegative
                  ? "is-negative"
                  : undefined
            }
          >
            {growthLabel}
          </strong>

          <small>
            {language === "es"
              ? "vs. base económica del tier"
              : "vs. tier economic baseline"}
          </small>
        </article>
      </div>

      <div className="nft-economy-panel__reserve">
        <div className="nft-economy-panel__reserve-head">
          <div>
            <span>
              {language === "es"
                ? "Reserva del tier"
                : "Tier reserve"}
            </span>

            <strong>
              {current
                ?.reserveBalanceUsdt ??
                "—"}
              {current
                ?.reserveBalanceUsdt
                ? " USDT"
                : ""}
            </strong>
          </div>

          <div>
            <span>
              {language === "es"
                ? "Supply emitido"
                : "Issued supply"}
            </span>

            <strong>
              {current
                ?.issuedSupply ??
                "—"}
              {" / "}
              {economy
                .tierPolicy
                .supply}
            </strong>
          </div>

          <div>
            <span>
              {language === "es"
                ? "Cobertura"
                : "Coverage"}
            </span>

            <strong>
              {formatCoverage(
                proof.coverageBps,
              )}
            </strong>
          </div>
        </div>

        <div className="nft-economy-panel__bar">
          <span
            style={{
              width:
                proof.coverageBps
                  ? `${Math.min(
                      100,
                      Number(
                        BigInt(
                          proof.coverageBps,
                        ),
                      ) /
                        100,
                    )}%`
                  : "0%",
            }}
          />
        </div>
      </div>

      <div className="nft-economy-panel__details">
        <div>
          <span>
            {language === "es"
              ? "Base económica del tier"
              : "Tier economic baseline"}
          </span>

          <strong>
            {economy
              .tierBaseAllocation
              .amountUsdt}
            {" USDT"}
          </strong>
        </div>

        <div>
          <span>
            {language === "es"
              ? "Snapshot"
              : "Snapshot"}
          </span>

          <strong
            title={
              proof.snapshotHash ??
              undefined
            }
          >
            {shortenHash(
              proof.snapshotHash,
            )}
          </strong>
        </div>

        <div>
          <span>
            {language === "es"
              ? "Reserve Vault"
              : "Reserve Vault"}
          </span>

          <strong
            title={
              proof.vaultAddress ??
              undefined
            }
          >
            {shortenHash(
              proof.vaultAddress,
            )}
          </strong>
        </div>

        <div>
          <span>
            {language === "es"
              ? "Red"
              : "Network"}
          </span>

          <strong>
            {proof.network ??
              "—"}
          </strong>
        </div>
      </div>

      <NftEconomyTimeline
        tokenId={
          tokenId
        }
        language={
          language
        }
      />

      <footer className="nft-economy-panel__footer">
        <span>
          {language === "es"
            ? "El NAV representa el respaldo económico calculado por el sistema de reserva. No representa precio de mercado."
            : "NAV represents economic backing calculated from the reserve system. It does not represent market price."}
        </span>

        <span>
          {economy.viewVersion}
        </span>
      </footer>
    </section>
  );
}

export default NftEconomyPanel;
