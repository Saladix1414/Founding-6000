import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getEconomicOperationsView,
  type EconomicOperationsView,
} from "../lib/foundingApi";

type Language =
  | "en"
  | "es";

type Props = {
  language:
    Language;
};

function formatUsdtMinor(
  value:
    string | null,
) {
  if (
    value === null
  ) {
    return "—";
  }

  const minor =
    BigInt(
      value,
    );

  const whole =
    minor /
    1_000_000n;

  const fraction =
    (
      minor %
      1_000_000n
    )
      .toString()
      .padStart(
        6,
        "0",
      )
      .replace(
        /0+$/,
        "",
      );

  return fraction
    ? `${whole}.${fraction} USDT`
    : `${whole} USDT`;
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

function formatDate(
  value:
    string | null,
  language:
    Language,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    language === "es"
      ? "es-AR"
      : "en-US",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  ).format(
    date,
  );
}

function shortenHash(
  value:
    string | null,
) {
  if (!value) {
    return "—";
  }

  if (
    value.length <=
    22
  ) {
    return value;
  }

  return `${value.slice(
    0,
    10,
  )}…${value.slice(
    -8,
  )}`;
}

function integrityLabel(
  state:
    EconomicOperationsView[
      "integrity"
    ][
      "state"
    ],

  language:
    Language,
) {
  const labels = {
    OK: {
      en:
        "Verified",
      es:
        "Verificado",
    },

    WARNING: {
      en:
        "Warning",
      es:
        "Advertencia",
    },

    CRITICAL: {
      en:
        "Critical",
      es:
        "Crítico",
    },

    STALE: {
      en:
        "Stale",
      es:
        "Desactualizado",
    },

    NOT_SEEN: {
      en:
        "Not yet observed",
      es:
        "Aún sin observación",
    },
  } as const;

  return labels[
    state
  ][
    language
  ];
}

function incidentLabel(
  view:
    EconomicOperationsView,

  language:
    Language,
) {
  if (
    view.incident.state ===
    "NONE"
  ) {
    return language ===
      "es"
      ? "Sin incidentes registrados"
      : "No recorded incidents";
  }

  if (
    view.incident.state ===
    "RESOLVED"
  ) {
    return language ===
      "es"
      ? "Último incidente resuelto"
      : "Latest incident resolved";
  }

  return language ===
    "es"
    ? "Incidente abierto"
    : "Open incident";
}

function eventLabel(
  eventType:
    "OPENED" |
    "OBSERVED" |
    "RESOLVED",

  language:
    Language,
) {
  if (
    eventType ===
    "OPENED"
  ) {
    return language ===
      "es"
      ? "Abierto"
      : "Opened";
  }

  if (
    eventType ===
    "OBSERVED"
  ) {
    return language ===
      "es"
      ? "Observado"
      : "Observed";
  }

  return language ===
    "es"
    ? "Resuelto"
    : "Resolved";
}

export function EconomicOperationsPanel({
  language,
}: Props) {
  const [
    operations,
    setOperations,
  ] =
    useState<
      EconomicOperationsView |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const load =
    useCallback(
      async (
        manual:
          boolean,
      ) => {
        if (
          manual
        ) {
          setRefreshing(
            true,
          );
        }

        setError(
          null,
        );

        try {
          const result =
            await getEconomicOperationsView();

          setOperations(
            result.operations,
          );
        } catch {
          setError(
            language === "es"
              ? "La vista económica pública no está disponible temporalmente."
              : "The public economic view is temporarily unavailable.",
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [
        language,
      ],
    );

  useEffect(() => {
    let active =
      true;

    async function initialLoad() {
      try {
        const result =
          await getEconomicOperationsView();

        if (
          !active
        ) {
          return;
        }

        setOperations(
          result.operations,
        );

        setError(
          null,
        );
      } catch {
        if (
          !active
        ) {
          return;
        }

        setError(
          language === "es"
            ? "La vista económica pública no está disponible temporalmente."
            : "The public economic view is temporarily unavailable.",
        );
      } finally {
        if (
          active
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    void initialLoad();

    const interval =
      window.setInterval(
        () => {
          if (
            active
          ) {
            void load(
              false,
            );
          }
        },
        60_000,
      );

    return () => {
      active =
        false;

      window.clearInterval(
        interval,
      );
    };
  }, [
    language,
    load,
  ]);

  if (
    loading
  ) {
    return (
      <section
        className="economic-operations"
        aria-busy="true"
        aria-label={
          language === "es"
            ? "Transparencia económica"
            : "Economic transparency"
        }
      >
        <div className="db-container">
          <div className="economic-operations__loading">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="economic-operations"
      id="economic-transparency"
      aria-labelledby="economic-operations-title"
    >
      <div className="db-container economic-operations__inner">
        <header className="economic-operations__header">
          <div>
            <span className="economic-operations__eyebrow">
              ORIGINX · ECONOMIC TRANSPARENCY
            </span>

            <h2
              id="economic-operations-title"
            >
              {language === "es"
                ? "Integridad económica verificable"
                : "Verifiable economic integrity"}
            </h2>

            <p>
              {language === "es"
                ? "Estado público y de solo lectura de la reserva, conciliación e incidentes económicos."
                : "Public, read-only status for reserve, reconciliation and economic incidents."}
            </p>
          </div>

          <button
            type="button"
            className="economic-operations__refresh"
            disabled={
              refreshing
            }
            onClick={() => {
              void load(
                true,
              );
            }}
          >
            {refreshing
              ? language === "es"
                ? "Actualizando…"
                : "Refreshing…"
              : language === "es"
                ? "Actualizar"
                : "Refresh"}
          </button>
        </header>

        {error && (
          <div
            className="economic-operations__notice"
            role="status"
          >
            {error}
          </div>
        )}

        {operations && (
          <>
            <div className="economic-operations__status-grid">
              <article className="economic-operations-card">
                <span className="economic-operations-card__label">
                  {language === "es"
                    ? "Integridad"
                    : "Integrity"}
                </span>

                <div
                  className={[
                    "economic-operations-badge",
                    `is-${operations.integrity.state.toLowerCase()}`,
                  ].join(
                    " ",
                  )}
                >
                  <span
                    className="economic-operations-badge__dot"
                    aria-hidden="true"
                  />

                  <strong>
                    {integrityLabel(
                      operations
                        .integrity
                        .state,
                      language,
                    )}
                  </strong>
                </div>

                <small>
                  {language === "es"
                    ? "Última conciliación"
                    : "Last reconciliation"}
                </small>

                <strong className="economic-operations-card__value">
                  {formatDate(
                    operations
                      .integrity
                      .reconciledAt,
                    language,
                  )}
                </strong>
              </article>

              <article className="economic-operations-card">
                <span className="economic-operations-card__label">
                  Proof of Reserve
                </span>

                <strong className="economic-operations-card__hero">
                  {operations
                    .proofOfReserve
                    .available
                    ? formatCoverage(
                        operations
                          .proofOfReserve
                          .coverageBps,
                      )
                    : "—"}
                </strong>

                <small>
                  {operations
                    .proofOfReserve
                    .available
                    ? operations
                        .proofOfReserve
                        .fullyCovered
                      ? language === "es"
                        ? "Cobertura completa"
                        : "Fully covered"
                      : language === "es"
                        ? "Cobertura incompleta"
                        : "Coverage incomplete"
                    : language === "es"
                      ? "Sin snapshot disponible"
                      : "No snapshot available"}
                </small>
              </article>

              <article className="economic-operations-card">
                <span className="economic-operations-card__label">
                  {language === "es"
                    ? "Incidentes"
                    : "Incidents"}
                </span>

                <strong className="economic-operations-card__hero economic-operations-card__hero--small">
                  {incidentLabel(
                    operations,
                    language,
                  )}
                </strong>

                <small>
                  {operations
                    .incident
                    .severity
                    ? `${language === "es"
                        ? "Severidad"
                        : "Severity"} · ${operations.incident.severity}`
                    : language === "es"
                      ? "Sin severidad activa"
                      : "No active severity"}
                </small>
              </article>
            </div>

            <div className="economic-operations__detail-grid">
              <article className="economic-operations__reserve">
                <header>
                  <div>
                    <span>
                      PROOF OF RESERVE
                    </span>

                    <h3>
                      {language === "es"
                        ? "Cobertura de reserva"
                        : "Reserve coverage"}
                    </h3>
                  </div>

                  <span
                    className={[
                      "economic-operations__proof-state",
                      operations
                        .proofOfReserve
                        .fullyCovered
                        ? "is-covered"
                        : "is-uncovered",
                    ].join(
                      " ",
                    )}
                  >
                    {operations
                      .proofOfReserve
                      .available
                      ? operations
                          .proofOfReserve
                          .fullyCovered
                        ? "VERIFIED"
                        : "NOT FULLY COVERED"
                      : "UNAVAILABLE"}
                  </span>
                </header>

                <div className="economic-operations__reserve-grid">
                  <div>
                    <span>
                      {language === "es"
                        ? "Obligación"
                        : "Liability"}
                    </span>

                    <strong>
                      {formatUsdtMinor(
                        operations
                          .proofOfReserve
                          .totalLiabilityMinor,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {language === "es"
                        ? "Saldo observado"
                        : "Observed balance"}
                    </span>

                    <strong>
                      {formatUsdtMinor(
                        operations
                          .proofOfReserve
                          .onchainBalanceMinor,
                      )}
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
                        operations
                          .proofOfReserve
                          .coverageBps,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="economic-operations__meta">
                  <div>
                    <span>
                      Snapshot
                    </span>

                    <code>
                      {shortenHash(
                        operations
                          .proofOfReserve
                          .snapshotHash,
                      )}
                    </code>
                  </div>

                  <div>
                    <span>
                      {language === "es"
                        ? "Capturado"
                        : "Captured"}
                    </span>

                    <strong>
                      {formatDate(
                        operations
                          .proofOfReserve
                          .capturedAt,
                        language,
                      )}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="economic-operations__integrity">
                <header>
                  <div>
                    <span>
                      RECONCILIATION
                    </span>

                    <h3>
                      {language === "es"
                        ? "Conciliación económica"
                        : "Economic reconciliation"}
                    </h3>
                  </div>
                </header>

                <div className="economic-operations__integrity-stats">
                  <div>
                    <strong>
                      {operations
                        .integrity
                        .criticalFailures}
                    </strong>

                    <span>
                      {language === "es"
                        ? "fallas críticas"
                        : "critical failures"}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {operations
                        .integrity
                        .warnings}
                    </strong>

                    <span>
                      {language === "es"
                        ? "advertencias"
                        : "warnings"}
                    </span>
                  </div>
                </div>

                <div className="economic-operations__meta">
                  <div>
                    <span>
                      Report
                    </span>

                    <code>
                      {shortenHash(
                        operations
                          .integrity
                          .reportHash,
                      )}
                    </code>
                  </div>

                  <div>
                    <span>
                      NAV Policy
                    </span>

                    <strong>
                      {operations
                        .navPolicy
                        .version ??
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Supply Basis
                    </span>

                    <strong>
                      {operations
                        .navPolicy
                        .supplyBasis ??
                        "—"}
                    </strong>
                  </div>
                </div>
              </article>
            </div>

            <article className="economic-operations__timeline">
              <header>
                <div>
                  <span>
                    INCIDENT HISTORY
                  </span>

                  <h3>
                    {language === "es"
                      ? "Historial de integridad"
                      : "Integrity history"}
                  </h3>
                </div>

                <small>
                  {language === "es"
                    ? "Últimos 12 eventos · datos sanitizados"
                    : "Last 12 events · sanitized data"}
                </small>
              </header>

              {operations
                .incidentTimeline
                .length ===
              0 ? (
                <div className="economic-operations__empty">
                  {language === "es"
                    ? "Todavía no existen incidentes económicos registrados."
                    : "No economic integrity incidents have been recorded yet."}
                </div>
              ) : (
                <div className="economic-operations__timeline-list">
                  {operations
                    .incidentTimeline
                    .map(
                      (
                        event,
                        index,
                      ) => (
                        <div
                          className="economic-operations-event"
                          key={`${event.createdAt}-${event.eventType}-${index}`}
                        >
                          <span
                            className={[
                              "economic-operations-event__marker",
                              `is-${event.integrityState.toLowerCase()}`,
                            ].join(
                              " ",
                            )}
                            aria-hidden="true"
                          />

                          <div className="economic-operations-event__body">
                            <div>
                              <strong>
                                {eventLabel(
                                  event.eventType,
                                  language,
                                )}
                              </strong>

                              {event.severity && (
                                <span>
                                  {event.severity}
                                </span>
                              )}
                            </div>

                            <small>
                              {formatDate(
                                event.createdAt,
                                language,
                              )}
                            </small>
                          </div>

                          <code>
                            {shortenHash(
                              event.reportHash,
                            )}
                          </code>
                        </div>
                      ),
                    )}
                </div>
              )}
            </article>

            <footer className="economic-operations__disclaimer">
              <span>
                READ ONLY
              </span>

              <p>
                {language === "es"
                  ? "Esta vista informa estado operativo y económico. No concede autoridad sobre reservas, pagos, wallets, gobernanza ni ejecución blockchain."
                  : "This view reports operational and economic state. It grants no authority over reserves, payments, wallets, governance or blockchain execution."}
              </p>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}

export default EconomicOperationsPanel;
