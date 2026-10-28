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
              ? "Una política de reserva definida y recursos separados para impulsar el desarrollo del ecosistema."
              : "A defined reserve policy and separate resources to support ecosystem development."}
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
            ? "Este recorrido explica conceptos, no una transferencia de la reserva al desarrollo. Los fondos protegidos y los recursos operativos se mantienen separados."
            : "This path explains concepts, not a transfer from reserves to development. Protected funds and operating resources remain separate."}
        </p>

        <div className="ox-economy-layout">
          <div className="ox-economy-simulator">
            <div className="ox-economy-simulator-title">
              <h3>{es ? "Explorá la distribución" : "Explore the allocation"}</h3>
              <span>{es ? "EJEMPLO TEÓRICO" : "THEORETICAL EXAMPLE"}</span>
            </div>

            <fieldset className="ox-economy-selector">
              <legend>{es ? "Elegí un tier" : "Choose a tier"}</legend>
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
                  ? "El importe fuera de reserva es anterior a gastos, impuestos y otras obligaciones. No equivale a capital disponible ni a beneficio."
                  : "The amount outside reserve is before expenses, taxes and other obligations. It does not equal available capital or profit."}
              </p>

              <h4>{es ? "Cómo se distribuye el aporte a reserva" : "How the reserve contribution is allocated"}</h4>
              <table className="ox-economy-table">
                <caption className="ox-economy-sr-only">
                  {es ? "Distribución entre subreservas por tier" : "Allocation among tier subreserves"}
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

          <aside className="ox-economy-explanation">
            <div className="ox-economy-policy">
              <span className="ox-economy-policy-number">25%</span>
              <h3>{es ? "Una reserva con reglas." : "A reserve with rules."}</h3>
              <p>
                {es
                  ? "La política destina el 25% de cada venta primaria verificada a la reserva. Su distribución interna depende del tier vendido."
                  : "The policy allocates 25% of each verified primary sale to reserves. Its internal distribution depends on the tier sold."}
              </p>
            </div>

            <div className="ox-economy-data">
              <h3>{es ? "Datos reales" : "Actual data"}</h3>
              <p>
                {es
                  ? "Esta sección todavía no está conectada a datos verificados de tesorería. Los valores del simulador no representan reservas depositadas, ventas ni fondos disponibles."
                  : "This section is not yet connected to verified treasury data. Simulator values do not represent deposited reserves, sales or available funds."}
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
