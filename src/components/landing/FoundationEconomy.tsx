import { useState } from "react";
import {
  SIMULATION_TIERS,
  simulateReferenceSale,
  simulateBatchClose,
  simulateInvestmentScenario,
  parseScenarioCosts,
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
  const [completedBatches, setCompletedBatches] = useState(3);
  const [costInput, setCostInput] = useState('');
  const [annualRateBps, setAnnualRateBps] = useState(0);
  const [years, setYears] = useState(1);
  let costs: bigint | null = null;
  let costInvalid = false;
  try { costs = parseScenarioCosts(costInput); } catch { costInvalid = true; }
  const closing = simulateBatchClose(completedBatches, costs);
  const investment = simulateInvestmentScenario(closing.reserve, annualRateBps, years);

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

        <div className="ox-economy-scheme ox-economy-projection">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? 'Resultados netos de la venta por tandas hasta finalizar' : 'Net sale results by batch through completion'}</h3>
            <span>{es ? '25% FIJO · CIERRE PROYECTADO' : 'FIXED 25% · PROJECTED CLOSE'}</span>
          </div>
          <p className="ox-economy-small">{es
            ? 'Calculá el aporte fijo a reserva al completar cada tanda a precios de referencia. #0001 Azhurak permanece reservado: 999 ventas RARE y 5.999 ventas al completar las tres tandas.'
            : 'Calculate the fixed reserve contribution as each batch completes at reference prices. #0001 Azhurak remains reserved: 999 RARE sales and 5,999 sales across all three batches.'}</p>
          <label className="ox-economy-field" htmlFor="ox-closing-batches">
            <span>{es ? 'Escenario de cierre' : 'Closing scenario'}</span>
            <select id="ox-closing-batches" value={completedBatches} onChange={event => setCompletedBatches(Number(event.target.value))}>
              <option value={1}>{es ? 'Al finalizar RARE' : 'After RARE'}</option>
              <option value={2}>{es ? 'Al finalizar RARE + EPIC' : 'After RARE + EPIC'}</option>
              <option value={3}>{es ? 'Al finalizar toda la colección' : 'After the full collection'}</option>
            </select>
          </label>
          <div className="ox-economy-rules-scroll" role="region" aria-label={es ? 'Resultados por tanda' : 'Batch results'} tabIndex={0}>
            <table className="ox-economy-table">
              <caption>{es ? 'Importes calculados si se completan las ventas indicadas; no son cobros ya verificados.' : 'Calculated amounts if the selected sales complete; not already verified receipts.'}</caption>
              <thead><tr><th scope="col">{es ? 'Tanda' : 'Batch'}</th><th scope="col">{es ? 'Ventas' : 'Sales'}</th><th scope="col">{es ? 'Ingreso' : 'Revenue'}</th><th scope="col">25% → {es ? 'reserva' : 'reserve'}</th><th scope="col">{es ? 'Reserva acumulada' : 'Cumulative reserve'}</th></tr></thead>
              <tbody>{closing.stages.map(stage => <tr key={stage.tier}><th scope="row">{stage.tier}</th><td>{stage.quantity}</td><td>{money(stage.revenue)}</td><td>{money(stage.contribution)}</td><td>{money(stage.cumulativeReserve)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
            <div><span>{es ? 'Ingresos del escenario' : 'Scenario revenue'}</span><strong>{money(closing.sales)}</strong></div>
            <div><span>{es ? 'Aporte fijo a reserva' : 'Fixed reserve contribution'}</span><strong>{money(closing.reserve)}</strong></div>
            <div><span>{es ? 'Fuera de reserva, antes de costes' : 'Outside reserve, before costs'}</span><strong>{money(closing.outsideReserve)}</strong></div>
          </div>
          <label className="ox-economy-field" htmlFor="ox-scenario-costs">
            <span>{es ? 'Costes totales del escenario (USDT, opcional)' : 'Total scenario costs (USDT, optional)'}</span>
            <input id="ox-scenario-costs" type="text" inputMode="decimal" maxLength={12} value={costInput} onChange={event => setCostInput(event.target.value)} placeholder={es ? 'Pendientes de definir' : 'Not defined yet'} aria-invalid={costInvalid} aria-describedby="ox-cost-explanation" />
          </label>
          <p id="ox-cost-explanation" className="ox-economy-small">{costInvalid
            ? (es ? 'Ingresá un importe positivo con hasta dos decimales.' : 'Enter a positive amount with up to two decimal places.')
            : (es ? 'Sin costes definidos, el beneficio neto operativo queda pendiente. El 25% corresponde al aporte a reserva.' : 'Without defined costs, operating net profit remains pending. The 25% is the reserve contribution.')}</p>
          <div className="ox-economy-sale" aria-live="polite"><span>{es ? 'Neto operativo estimado tras la reserva y los costes ingresados' : 'Estimated operating net after reserves and entered costs'}</span><strong>{!costInvalid && closing.operatingNet !== null ? money(closing.operatingNet) : (es ? 'Pendiente' : 'Pending')}</strong></div>
        </div>

        <div className="ox-economy-scheme ox-economy-projection">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? 'Estimado del resultado de inversiones tras finalizar la venta' : 'Estimated investment results after the sale closes'}</h3>
            <span>{es ? 'ESCENARIO SELECCIONADO' : 'SELECTED SCENARIO'}</span>
          </div>
          <p className="ox-economy-small">{es ? 'Explorá la evolución de la reserva del cierre seleccionado. Este escenario supone invertir el 100% de esa reserva después de las ventas, con capitalización anual y la variación neta elegida; admite resultados positivos o negativos.' : 'Explore the reserve after the selected closing stage. This scenario assumes investing 100% of that reserve after sales, with annual compounding and the chosen net change; results may be positive or negative.'}</p>
          <div className="ox-economy-projection-controls">
            <label className="ox-economy-field" htmlFor="ox-investment-rate"><span>{es ? 'Variación neta anual supuesta' : 'Assumed annual net change'}</span><select id="ox-investment-rate" value={annualRateBps} onChange={event => setAnnualRateBps(Number(event.target.value))}>{[-2000,-1000,0,500,1000,2000].map(rate => <option key={rate} value={rate}>{rate > 0 ? '+' : ''}{rate / 100}%</option>)}</select></label>
            <label className="ox-economy-field" htmlFor="ox-investment-years"><span>{es ? 'Plazo desde el cierre' : 'Time after closing'}</span><select id="ox-investment-years" value={years} onChange={event => setYears(Number(event.target.value))}>{[1,2,3,4,5].map(year => <option key={year} value={year}>{year} {es ? (year === 1 ? 'año' : 'años') : (year === 1 ? 'year' : 'years')}</option>)}</select></label>
          </div>
          <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
            <div><span>{es ? 'Reserva de partida' : 'Opening reserve'}</span><strong>{money(investment.openingReserve)}</strong></div>
            <div><span>{es ? 'Resultado neto estimado de inversión' : 'Estimated net investment result'}</span><strong>{money(investment.netChange)}</strong></div>
            <div><span>{es ? 'Reserva final del escenario' : 'Scenario closing reserve'}</span><strong>{money(investment.closingReserve)}</strong></div>
          </div>
          <div className="ox-economy-rules-scroll" role="region" aria-label={es ? 'Evolución por categoría' : 'Evolution by category'} tabIndex={0}>
            <table className="ox-economy-table"><caption>{es ? 'Reserva media por unidad de categoría, calculada sobre el suministro máximo (1.000 / 2.000 / 3.000). No es una cotización de reventa ni una ganancia personal confirmada.' : 'Average reserve per category unit, based on maximum supply (1,000 / 2,000 / 3,000). Not a resale quote or confirmed personal profit.'}</caption>
              <thead><tr><th scope="col">{es ? 'Categoría' : 'Category'}</th><th scope="col">{es ? 'Tras las ventas' : 'After sales'}</th><th scope="col">{es ? 'Tras el escenario de inversión' : 'After the investment scenario'}</th></tr></thead>
              <tbody>{closing.units.map(unit => <tr key={unit.tier}><th scope="row">{unit.tier}</th><td>{money(unit.averageReserve)}</td><td>{money(simulateInvestmentScenario(unit.reserve,annualRateBps,years).closingReserve / BigInt(unit.denominator))}</td></tr>)}</tbody>
            </table>
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
