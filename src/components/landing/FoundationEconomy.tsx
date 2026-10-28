import { useState } from "react";
import {
  SIMULATION_TIERS,
  simulateReferenceSale,
  type SimulationTier,
} from "./economySimulation";
import "../../styles/originx-economy.css";

export function scrollToEconomy() {
  const heading = document.getElementById("ox-economy-title");
  const section = document.getElementById("economia");
  if (!heading || !section) return;

  heading.focus({ preventScroll: true });
  section.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto" : "smooth",
    block: "start",
  });
}

export default function FoundationEconomy({
  language,
}: {
  language: "es" | "en";
}) {
  const es = language === "es";
  const [tier, setTier] = useState<SimulationTier>("RARE");
  const result = simulateReferenceSale(tier);

  const money = (minor: bigint) =>
    new Intl.NumberFormat(es ? "es-AR" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(minor) / 1_000_000) + " USDT";

  return (
    <section
      id="economia"
      className="ox-landing ox-economy"
      aria-labelledby="ox-economy-title"
    >
      <div className="ox-economy-inner">
        <header className="ox-economy-heading">
          <p className="ox-economy-eyebrow">ORIGINX FOUNDATION</p>
          <h2 id="ox-economy-title" tabIndex={-1}>
            {es ? "Cada venta," : "Every sale,"}{" "}
            <span>{es ? "una distribución clara." : "a clear allocation."}</span>
          </h2>
          <p>
            {es
              ? "La política destina el 25% de cada venta inicial verificada a reserva. El 75% restante queda fuera de ella."
              : "The policy allocates 25% of each verified initial sale to reserves. The remaining 75% stays outside the reserve."}
          </p>
        </header>

        <div className="ox-economy-scheme">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? "Seguí el reparto" : "Follow the allocation"}</h3>
            <span>{es ? "EJEMPLO TEÓRICO" : "THEORETICAL EXAMPLE"}</span>
          </div>

          <fieldset className="ox-economy-selector">
            <legend>
              {es ? "Elegí la categoría de la venta" : "Choose the sale category"}
            </legend>
            <div>
              {SIMULATION_TIERS.map(value => (
                <label key={value}>
                  <input
                    type="radio"
                    name="ox-economy-tier"
                    value={value}
                    checked={tier === value}
                    onChange={() => setTier(value)}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div aria-live="polite" aria-atomic="true">
            <div className="ox-economy-sale">
              <span>
                {es ? "Venta inicial de referencia" : "Reference initial sale"} · {tier}
              </span>
              <strong>{money(result.price)}</strong>
            </div>

            <div className="ox-economy-direction" aria-hidden="true">↓</div>

            <div className="ox-economy-branches">
              <div className="ox-economy-branch ox-economy-branch--reserve">
                <span className="ox-economy-branch-percent">25%</span>
                <h4>{es ? "A reserva" : "To reserve"}</h4>
                <strong>{money(result.reserve)}</strong>
                <p>
                  {es
                    ? "Distribución debajo."
                    : "Allocation below."}
                </p>
              </div>

              <div className="ox-economy-branch ox-economy-branch--outside">
                <span className="ox-economy-branch-percent">75%</span>
                <h4>{es ? "Fuera de reserva" : "Outside reserve"}</h4>
                <strong>{money(result.outsideReserve)}</strong>
                <p>
                  {es
                    ? "Antes de gastos, impuestos y obligaciones."
                    : "Before expenses, taxes and obligations."}
                </p>
              </div>
            </div>

            <p className="ox-economy-small ox-economy-separation">
              {es
                ? "Reserva y operación separadas. El 75% es bruto: no es beneficio ni saldo disponible."
                : "Reserves and operations stay separate. The 75% is gross, not profit or an available balance."}
            </p>

            <div className="ox-economy-reserve-detail">
              <h4>
                {es ? "Dentro del 25% de reserva" : "Inside the 25% reserve"}
              </h4>
              <p className="ox-economy-small">
                {es
                  ? "Reparto de " + money(result.reserve) + ". Porcentajes sobre la reserva, no sobre la venta."
                  : "Allocation of " + money(result.reserve) + ". Percentages apply to the reserve, not the sale."}
              </p>

              <dl className="ox-economy-allocation-list">
                {result.allocations.map(item => (
                  <div key={item.tier}>
                    <dt>{item.tier}</dt>
                    <dd>
                      <span>{Number(item.weightBps) / 100}%</span>
                      <strong>{money(item.amount)}</strong>
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="ox-economy-reserve-total">
                <span>{es ? "Total a reserva" : "Total to reserve"}</span>
                <strong>{money(result.reserve)}</strong>
              </p>
            </div>
          </div>
        </div>

        <details className="ox-economy-rules">
          <summary>
            {es ? "Comparar las reglas de las tres categorías" : "Compare all three category rules"}
          </summary>
          <div className="ox-economy-rules-scroll">
            <table className="ox-economy-table">
              <caption>
                {es
                  ? "Porcentaje del aporte a reserva destinado a cada subreserva"
                  : "Percentage of the reserve contribution allocated to each subreserve"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{es ? "Venta" : "Sale"}</th>
                  {SIMULATION_TIERS.map(value => (
                    <th scope="col" key={value}>{value}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIMULATION_TIERS.map(value => (
                  <tr key={value}>
                    <th scope="row">{value}</th>
                    {simulateReferenceSale(value).allocations.map(item => (
                      <td key={item.tier}>{Number(item.weightBps) / 100}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <div className="ox-economy-data ox-economy-data-summary">
          <h3>{es ? "El ejemplo no es el saldo real" : "The example is not the actual balance"}</h3>
          <p>
            {es
              ? "Este cálculo explica la política. No consulta la tesorería ni acredita ventas, reservas depositadas o fondos disponibles."
              : "This calculation explains the policy. It does not query the treasury or establish sales, deposited reserves or available funds."}
          </p>
          <a
            className="ox-economy-transparency-link"
            href="#economic-transparency"
          >
            {es ? "Ver transparencia y reservas" : "View transparency and reserves"}
            <span aria-hidden="true">→</span>
          </a>
        </div>

        <p className="ox-economy-small">
          {es
            ? "La distribución entre subreservas no representa dividendos individuales, un derecho de rescate ni rendimientos garantizados."
            : "Allocation among subreserves does not represent individual dividends, redemption rights or guaranteed returns."}
        </p>
      </div>
    </section>
  );
}
