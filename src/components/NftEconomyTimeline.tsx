import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTokenEconomyHistory,
  type TokenEconomyHistoryItem,
} from "../lib/foundingApi";

type Language =
  | "en"
  | "es";

type Props = {
  tokenId:
    number;

  language:
    Language;
};

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

function formatDate(
  value:
    string,

  language:
    Language,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    language === "es"
      ? "es-AR"
      : "en-US",
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    date,
  );
}

function shortenHash(
  value:
    string,
) {
  if (
    value.length <= 22
  ) {
    return value;
  }

  return `${value.slice(
    0,
    12,
  )}…${value.slice(
    -8,
  )}`;
}

export function NftEconomyTimeline({
  tokenId,
  language,
}: Props) {
  const [
    items,
    setItems,
  ] =
    useState<
      TokenEconomyHistoryItem[]
    >([]);

  const [
    nextCursor,
    setNextCursor,
  ] =
    useState<
      string |
      null
    >(null);

  const [
    hasMore,
    setHasMore,
  ] =
    useState(
      false,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    loadingMore,
    setLoadingMore,
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
    >(null);

  useEffect(() => {
    let cancelled =
      false;

    async function loadInitial() {
      setLoading(
        true,
      );

      setError(
        null,
      );

      try {
        const result =
          await getTokenEconomyHistory({
            tokenId,

            limit:
              12,
          });

        if (
          cancelled
        ) {
          return;
        }

        setItems(
          result.history.items,
        );

        setNextCursor(
          result
            .history
            .pagination
            .nextCursor,
        );

        setHasMore(
          result
            .history
            .pagination
            .hasMore,
        );
      } catch {
        if (
          cancelled
        ) {
          return;
        }

        setError(
          language === "es"
            ? "No pudimos cargar el historial económico."
            : "We could not load the economic history.",
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

    void loadInitial();

    return () => {
      cancelled =
        true;
    };
  }, [
    tokenId,
    language,
  ]);

  const chartItems =
    useMemo(
      () =>
        [...items]
          .reverse()
          .filter(
            (
              item,
            ) =>
              item
                .reserve
                .navMinor !==
              null,
          ),
      [
        items,
      ],
    );

  const chartValues =
    chartItems.map(
      (
        item,
      ) =>
        Number(
          BigInt(
            item
              .reserve
              .navMinor ??
            "0",
          ),
        ),
    );

  const maxValue =
    chartValues.length >
      0
      ? Math.max(
          ...chartValues,
        )
      : 0;

  const minValue =
    chartValues.length >
      0
      ? Math.min(
          ...chartValues,
        )
      : 0;

  const range =
    Math.max(
      1,
      maxValue -
        minValue,
    );

  const chartPoints =
    chartItems.map(
      (
        item,
        index,
      ) => {
        const value =
          Number(
            BigInt(
              item
                .reserve
                .navMinor ??
              "0",
            ),
          );

        const x =
          chartItems.length <=
            1
            ? 50
            : (
                index /
                (
                  chartItems.length -
                  1
                )
              ) *
              100;

        const y =
          88 -
          (
            (
              value -
              minValue
            ) /
            range
          ) *
            72;

        return {
          item,
          x,
          y,
        };
      },
    );

  const polyline =
    chartPoints
      .map(
        (
          point,
        ) =>
          `${point.x},${point.y}`,
      )
      .join(
        " ",
      );

  async function loadMore() {
    if (
      loadingMore ||
      !hasMore ||
      !nextCursor
    ) {
      return;
    }

    setLoadingMore(
      true,
    );

    try {
      const result =
        await getTokenEconomyHistory({
          tokenId,

          limit:
            12,

          cursor:
            nextCursor,
        });

      setItems(
        (
          current,
        ) => {
          const existing =
            new Set(
              current.map(
                (
                  item,
                ) =>
                  item.snapshotHash,
              ),
            );

          const additional =
            result
              .history
              .items
              .filter(
                (
                  item,
                ) =>
                  !existing.has(
                    item.snapshotHash,
                  ),
              );

          return [
            ...current,
            ...additional,
          ];
        },
      );

      setNextCursor(
        result
          .history
          .pagination
          .nextCursor,
      );

      setHasMore(
        result
          .history
          .pagination
          .hasMore,
      );
    } catch {
      setError(
        language === "es"
          ? "No pudimos cargar más snapshots."
          : "We could not load more snapshots.",
      );
    } finally {
      setLoadingMore(
        false,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <section
        className="nft-economy-timeline nft-economy-timeline--loading"
        aria-busy="true"
      >
        <div className="nft-economy-timeline__skeleton" />
      </section>
    );
  }

  if (
    error &&
    items.length ===
      0
  ) {
    return (
      <section className="nft-economy-timeline nft-economy-timeline--empty">
        <span>
          ECONOMY HISTORY
        </span>

        <p>
          {error}
        </p>
      </section>
    );
  }

  if (
    items.length ===
      0
  ) {
    return (
      <section className="nft-economy-timeline nft-economy-timeline--empty">
        <span>
          ECONOMY HISTORY
        </span>

        <p>
          {language === "es"
            ? "Todavía no existen snapshots históricos para este token."
            : "There are no historical snapshots for this token yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="nft-economy-timeline">
      <header className="nft-economy-timeline__header">
        <div>
          <span>
            ORIGINX · NAV HISTORY
          </span>

          <h4>
            {language === "es"
              ? "Evolución económica"
              : "Economic evolution"}
          </h4>

          <p>
            {language === "es"
              ? "Snapshots verificables desde la adquisición del token."
              : "Verifiable snapshots since token acquisition."}
          </p>
        </div>

        <strong>
          {items.length}
          {" "}
          {language === "es"
            ? "snapshots"
            : "snapshots"}
        </strong>
      </header>

      <div className="nft-economy-timeline__chart">
        <div className="nft-economy-timeline__axis">
          <span>
            {maxValue > 0
              ? `${
                  (
                    maxValue /
                    1_000_000
                  ).toFixed(
                    2,
                  )
                } USDT`
              : "—"}
          </span>

          <span>
            {minValue > 0
              ? `${
                  (
                    minValue /
                    1_000_000
                  ).toFixed(
                    2,
                  )
                } USDT`
              : "—"}
          </span>
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            language === "es"
              ? "Historial gráfico del NAV"
              : "NAV history chart"
          }
        >
          <line
            x1="0"
            y1="88"
            x2="100"
            y2="88"
            className="nft-economy-timeline__grid-line"
          />

          <line
            x1="0"
            y1="52"
            x2="100"
            y2="52"
            className="nft-economy-timeline__grid-line"
          />

          <line
            x1="0"
            y1="16"
            x2="100"
            y2="16"
            className="nft-economy-timeline__grid-line"
          />

          {polyline && (
            <polyline
              points={
                polyline
              }
              className="nft-economy-timeline__line"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {chartPoints.map(
            (
              point,
            ) => (
              <circle
                key={
                  point
                    .item
                    .snapshotHash
                }
                cx={
                  point.x
                }
                cy={
                  point.y
                }
                r="1.6"
                className={
                  point
                    .item
                    .proofOfReserve
                    .fullyCovered
                    ? "nft-economy-timeline__point is-verified"
                    : "nft-economy-timeline__point is-warning"
                }
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {
                    point
                      .item
                      .reserve
                      .navUsdt ??
                    "NAV unavailable"
                  }
                  {" USDT · "}
                  {
                    point
                      .item
                      .capturedAt
                  }
                </title>
              </circle>
            ),
          )}
        </svg>
      </div>

      <div className="nft-economy-timeline__legend">
        <span>
          <i className="is-verified" />
          {language === "es"
            ? "Reserva verificada"
            : "Reserve verified"}
        </span>

        <span>
          <i className="is-warning" />
          {language === "es"
            ? "Cobertura incompleta"
            : "Coverage incomplete"}
        </span>
      </div>

      <div className="nft-economy-timeline__list">
        {items.map(
          (
            item,
          ) => (
            <article
              key={
                item.snapshotHash
              }
              className="nft-economy-timeline__item"
            >
              <div className="nft-economy-timeline__date">
                <span
                  className={
                    item
                      .proofOfReserve
                      .fullyCovered
                      ? "is-verified"
                      : "is-warning"
                  }
                />

                <time
                  dateTime={
                    item.capturedAt
                  }
                >
                  {formatDate(
                    item.capturedAt,
                    language,
                  )}
                </time>
              </div>

              <div>
                <span>
                  NAV
                </span>

                <strong>
                  {item
                    .reserve
                    .navUsdt ??
                    "—"}
                  {item
                    .reserve
                    .navUsdt
                    ? " USDT"
                    : ""}
                </strong>
              </div>

              <div>
                <span>
                  {language === "es"
                    ? "Evolución"
                    : "Evolution"}
                </span>

                <strong>
                  {formatPercentFromBps(
                    item
                      .growth
                      .growthBps,
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
                    item
                      .proofOfReserve
                      .coverageBps,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Snapshot
                </span>

                <strong
                  title={
                    item.snapshotHash
                  }
                >
                  {shortenHash(
                    item.snapshotHash,
                  )}
                </strong>
              </div>
            </article>
          ),
        )}
      </div>

      {error && (
        <p
          className="nft-economy-timeline__error"
          role="status"
        >
          {error}
        </p>
      )}

      {hasMore && (
        <button
          type="button"
          className="nft-economy-timeline__more"
          disabled={
            loadingMore
          }
          onClick={() =>
            void loadMore()
          }
        >
          {loadingMore
            ? language === "es"
              ? "Cargando…"
              : "Loading…"
            : language === "es"
              ? "Cargar historial anterior"
              : "Load earlier history"}
        </button>
      )}

      <footer className="nft-economy-timeline__footer">
        {language === "es"
          ? "El gráfico representa NAV histórico derivado de snapshots de reserva. No representa precio de mercado ni rentabilidad garantizada."
          : "The chart represents historical NAV derived from reserve snapshots. It does not represent market price or guaranteed returns."}
      </footer>
    </section>
  );
}

export default NftEconomyTimeline;
