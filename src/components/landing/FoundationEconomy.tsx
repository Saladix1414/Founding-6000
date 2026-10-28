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

  const steps = es
    ? ["Membresía", "Reserva", "Desarrollo", "Ecosistema"]
    : ["Membership", "Reserve", "Development", "Ecosystem"];

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
            {es ? "Una economía" : "An economy"}{" "}
            <span>{es ? "que se puede entender." : "you can understand."}</span>
          </h2>
          <p>
            {es
              ? "Conocé qué parte de cada venta inicial se destina a la reserva y cómo se distribuye."
              : "See what share of each initial sale goes to the reserve and how it is allocated."}
          </p>
        </header>

        <ol className="ox-economy-path">
          {steps.map((step, index) => (
            <li key={step}>
              <span aria-hidden="true">0{index + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>

        <p className="ox-economy-path-note">
          {es
            ? "Estos conceptos no representan un recorrido del dinero. La reserva protegida y los recursos operativos se mantienen separados."
            : "These concepts do not show a flow of money. Protected reserves and operating resources remain separate."}
        </p>

        <div className="ox-economy-layout">
          <details className="ox-economy-disclosure">
            <summary className="ox-economy-disclosure-summary">
              <span className="ox-economy-disclosure-copy">
                <span className="ox-economy-disclosure-title">
                  {es
                    ? "Probá un ejemplo"
                    : "Try an example"}
                </span>
                <span className="ox-economy-disclosure-note">
                  {es
                    ? "Ejemplo teórico · RARE / EPIC / LEGENDARY"
                    : "Theoretical example · RARE / EPIC / LEGENDARY"}
                </span>
              </span>
              <span className="ox-economy-disclosure-icon" aria-hidden="true" />
            </summary>
            <div className="ox-economy-simulator">
              <fieldset className="ox-economy-selector">
              <legend>{es ? "Elegí una categoría" : "Choose a category"}</legend>
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

            <div className="ox-economy-result" aria-live="polite" aria-atomic="true">
              <p className="ox-economy-price">
                <span>{es ? "Precio primario de referencia" : "Reference primary price"}</span>
                <strong>{money(result.price)}</strong>
              </p>

              <div className="ox-economy-bar" aria-hidden="true">
                <span>25%</span><span>75%</span>
              </div>

              <dl className="ox-economy-split">
                <div>
                  <dt>{es ? "Aporte teórico a reserva · 25%" : "Theoretical reserve contribution · 25%"}</dt>
                  <dd>{money(result.reserve)}</dd>
                </div>
                <div>
                  <dt>{es ? "Bruto fuera de reserva · 75%" : "Gross outside reserve · 75%"}</dt>
                  <dd>{money(result.outsideReserve)}</dd>
                </div>
              </dl>

              <p className="ox-economy-small">
                {es
                  ? "Del importe fuera de reserva aún deben descontarse gastos, impuestos y otras obligaciones. No es beneficio ni dinero libre para gastar."
                  : "Expenses, taxes and other obligations still need to be deducted from the amount outside reserve. It is not profit or money freely available to spend."}
              </p>

              <h4>{es ? "Cómo se distribuye el aporte a reserva" : "How the reserve contribution is allocated"}</h4>
              <table className="ox-economy-table">
                <caption className="ox-economy-sr-only">
                  {es ? "Distribución entre subreservas por categoría" : "Allocation among category subreserves"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{es ? "Subreserva" : "Subreserve"}</th>
                    <th scope="col">%</th>
                    <th scope="col">{es ? "Importe" : "Amount"}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allocations.map(item => (
                    <tr key={item.tier}>
                      <th scope="row">{item.tier}</th>
                      <td>{Number(item.weightBps) / 100}%</td>
                      <td>{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </details>

          <aside className="ox-economy-explanation">
            <div className="ox-economy-policy">
              <span className="ox-economy-policy-number">25%</span>
              <h3>{es ? "Una reserva con reglas." : "A reserve with rules."}</h3>
              <p>
                {es
                  ? "La política destina a la reserva el 25% de cada venta inicial verificada. Ese aporte se reparte entre subreservas según la categoría vendida."
                  : "The policy allocates 25% of each verified initial sale to the reserve. That contribution is split among subreserves according to the category sold."}
              </p>
            </div>

            <div className="ox-economy-data">
              <h3>{es ? "Ejemplo y datos reales" : "Example and actual data"}</h3>
              <p>
                {es
                  ? "Este simulador muestra un ejemplo teórico. No consulta la tesorería ni muestra reservas depositadas, ventas reales o fondos disponibles."
                  : "This simulator shows a theoretical example. It does not query the treasury or show deposited reserves, actual sales or available funds."}
              </p>

              <a
                className="ox-economy-transparency-link"
                href="#economic-transparency"
              >
                {es
                  ? "Ver transparencia y reservas"
                  : "View transparency and reserves"}
                <span aria-hidden="true">→</span>
              </a>
            </div>

            <p className="ox-economy-small">
              {es
                ? "La distribución entre subreservas no representa dividendos individuales, un derecho de rescate ni rendimientos garantizados."
                : "Allocation among subreserves does not represent individual dividends, redemption rights or guaranteed returns."}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
