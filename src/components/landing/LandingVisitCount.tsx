import { useEffect, useState } from "react";

const REFRESH_MS = 15_000;

export default function LandingVisitCount({ language }: { language: "es" | "en" }) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const lifecycle = new AbortController();
    let refreshing = false;

    async function refresh() {
      if (document.hidden || refreshing) return;
      refreshing = true;
      try {
        const signal = AbortSignal.any([lifecycle.signal, AbortSignal.timeout(8_000)]);
        const response = await fetch("/api/visits", { cache: "no-store", signal });
        if (!response.ok) throw new Error("VISIT_COUNT_UNAVAILABLE");
        const data = await response.json();
        const next = data?.total;
        if (!lifecycle.signal.aborted) {
          setTotal(Number.isSafeInteger(next) && next >= 0 ? next : null);
        }
      } catch {
        if (!lifecycle.signal.aborted) setTotal(null);
      } finally {
        refreshing = false;
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      lifecycle.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  if (total === null) return null;

  const es = language === "es";
  return (
    <div className="ox-visit-count" title={es ? "Se actualiza cada 15 segundos" : "Updates every 15 seconds"}>
      <span className="ox-visit-dot" aria-hidden="true" />
      <strong>{new Intl.NumberFormat(es ? "es-AR" : "en-US").format(total)}</strong>
      <span>{es ? (total === 1 ? "visita acumulada" : "visitas acumuladas") : (total === 1 ? "total visit" : "total visits")}</span>
    </div>
  );
}
