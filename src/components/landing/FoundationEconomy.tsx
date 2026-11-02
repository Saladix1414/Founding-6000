import { useState } from "react";
import {
  SIMULATION_TIERS,
  simulateReferenceSale,
  simulateBatchClose,
  parseScenarioCosts,
  simulateHolderExit,
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
  const [holderTier, setHolderTier] = useState<SimulationTier>('RARE');
  let costs: bigint | null = null;
  let costInvalid = false;
  try { costs = parseScenarioCosts(costInput); } catch { costInvalid = true; }
  const closing = simulateBatchClose(completedBatches, costs);
  const perNftAtClose = simulateHolderExit(holderTier, 0, 1);
  const perNftAfterInvestment = simulateHolderExit(holderTier, annualRateBps, years);

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
            {es ? "Tu NFT," : "Your NFT,"}{" "}
            <span>{es ? "una reserva y un futuro rescate." : "a reserve and a future redemption."}</span>
          </h2>
          <p>
            {es
              ? "El 25% de cada venta inicial verificada se destina a reserva. El objetivo del modelo es permitirte rescatar tu NFT desde la web, quemándolo a cambio del importe que le corresponda según la política de su categoría, una vez completada la venta y habilitado el mecanismo."
              : "25% of each verified initial sale is allocated to reserves. The model aims to let you redeem your NFT on this website, burning it in exchange for the amount assigned by its category policy, once sales close and the mechanism is enabled."}
          </p>
          <p className="ox-economy-small">{es
            ? 'Política prevista: acumular y preservar los aportes de reserva durante la venta, sin rescates ni retiros de ese capital hasta la habilitación de la quema. La protección efectiva de los fondos y el rescate aún requieren implementación y verificación.'
            : 'Planned policy: accumulate and preserve reserve contributions during sales, with no redemptions or withdrawals of that principal before burn activation. Effective fund protection and redemption still require implementation and verification.'}</p>
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
          <p className="ox-economy-small">{es ? 'Elegí tu categoría y compará cuánto pagás por un NFT, la reserva que representa una unidad al finalizar toda la colección y cómo cambiaría ese importe con la inversión seleccionada. Todos los importes destacados de este bloque son por un NFT, no por toda la reserva.' : 'Choose your category and compare the price of one NFT, its modeled reserve amount at full collection close, and how that amount would change under your selected investment scenario. Every highlighted amount in this section is per NFT, not the total reserve.'}</p>
          <fieldset className="ox-economy-selector">
            <legend>{es ? '¿Qué NFT querés comparar?' : 'Which NFT would you like to compare?'}</legend>
            <div>{SIMULATION_TIERS.map(value => <label key={value}><input type="radio" name="ox-holder-tier" value={value} checked={holderTier === value} onChange={() => setHolderTier(value)} /><span>{value}</span></label>)}</div>
          </fieldset>
          <div className="ox-economy-projection-controls">
            <label className="ox-economy-field" htmlFor="ox-investment-rate"><span>{es ? 'Variación neta anual supuesta' : 'Assumed annual net change'}</span><select id="ox-investment-rate" value={annualRateBps} onChange={event => setAnnualRateBps(Number(event.target.value))}>{[-2000,-1000,0,500,1000,2000].map(rate => <option key={rate} value={rate}>{rate > 0 ? '+' : ''}{rate / 100}%</option>)}</select></label>
            <label className="ox-economy-field" htmlFor="ox-investment-years"><span>{es ? 'Plazo desde el cierre' : 'Time after closing'}</span><select id="ox-investment-years" value={years} onChange={event => setYears(Number(event.target.value))}>{[1,2,3,4,5].map(year => <option key={year} value={year}>{year} {es ? (year === 1 ? 'año' : 'años') : (year === 1 ? 'year' : 'years')}</option>)}</select></label>
          </div>
          <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
            <div><span>{es ? 'Precio de compra de 1 NFT' : 'Purchase price of 1 NFT'} · {holderTier}</span><strong>{money(perNftAtClose.price)}</strong></div>
            <div><span>{es ? 'Reserva por NFT al finalizar la colección' : 'Reserve per NFT at full collection close'} · {holderTier}</span><strong>{money(perNftAtClose.modeledRedemption)}</strong></div>
            <div><span>{es ? 'Por NFT tras la inversión simulada' : 'Per NFT after simulated investment'} · {holderTier}</span><strong>{money(perNftAfterInvestment.modeledRedemption)}</strong></div>
          </div>
          <p className="ox-economy-small" aria-live="polite">{es
            ? 'Para 1 NFT ' + holderTier + ': ' + money(perNftAtClose.price) + ' de compra → ' + money(perNftAtClose.modeledRedemption) + ' según reserva al cierre → ' + money(perNftAfterInvestment.modeledRedemption) + ' tras ' + years + (years === 1 ? ' año' : ' años') + ' con una variación anual del ' + (annualRateBps / 100) + '%.'
            : 'For 1 ' + holderTier + ' NFT: ' + money(perNftAtClose.price) + ' purchase → ' + money(perNftAtClose.modeledRedemption) + ' modeled reserve at close → ' + money(perNftAfterInvestment.modeledRedemption) + ' after ' + years + (years === 1 ? ' year' : ' years') + ' at ' + (annualRateBps / 100) + '% annual change.'}</p>
          <div className="ox-economy-sale" aria-live="polite"><span>{es ? 'Ganancia / pérdida de 1 NFT frente al precio de compra, antes de costes' : 'Gain / loss on 1 NFT versus purchase price, before costs'}</span><strong>{perNftAfterInvestment.differenceBeforeFees > 0n ? '+' : ''}{money(perNftAfterInvestment.differenceBeforeFees)}</strong></div>
          <p className="ox-economy-small">{es ? 'El cuadro celeste corresponde siempre al cierre completo: 5.999 ventas y #0001 reservado. El verde supone invertir el 100% de la subreserva de esa categoría después del cierre, sin rescates intermedios y con capitalización anual. Una tasa del 0% mantiene el importe; una tasa negativa lo reduce. Las comisiones e impuestos del rescate están pendientes: el beneficio neto después de esos costes todavía no se puede calcular.' : 'The blue card always uses full collection close: 5,999 sales and reserved #0001. The green card assumes investing 100% of that category reserve after closing, without interim redemptions and with annual compounding. A 0% rate leaves the amount unchanged; a negative rate reduces it. Redemption fees and taxes remain undefined: net profit after those costs cannot yet be calculated.'}</p>
          <div className="ox-economy-rules-scroll" role="region" aria-label={es ? 'Evolución por categoría' : 'Evolution by category'} tabIndex={0}>
            <table className="ox-economy-table"><caption>{es ? 'Reserva media por unidad de categoría, calculada sobre el suministro máximo (1.000 / 2.000 / 3.000). No es una cotización de reventa ni una ganancia personal confirmada.' : 'Average reserve per category unit, based on maximum supply (1,000 / 2,000 / 3,000). Not a resale quote or confirmed personal profit.'}</caption>
              <thead><tr><th scope="col">{es ? '1 NFT de categoría' : '1 NFT in category'}</th><th scope="col">{es ? 'Precio de compra' : 'Purchase price'}</th><th scope="col">{es ? 'Reserva por NFT al cierre completo' : 'Reserve per NFT at full close'}</th><th scope="col">{es ? 'Por NFT tras inversión' : 'Per NFT after investment'}</th></tr></thead>
              <tbody>{SIMULATION_TIERS.map(value => {
                const atClose = simulateHolderExit(value, 0, 1);
                const afterInvestment = simulateHolderExit(value, annualRateBps, years);
                return <tr key={value}><th scope="row">{value}</th><td>{money(atClose.price)}</td><td>{money(atClose.modeledRedemption)}</td><td>{money(afterInvestment.modeledRedemption)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </div>

        <div className="ox-economy-scheme ox-economy-projection">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? 'Qué recibirías al rescatar tu NFT' : 'What you would receive by redeeming your NFT'}</h3>
            <span>{es ? 'SIMULACIÓN · RESCATE NO HABILITADO' : 'SIMULATION · REDEMPTION DISABLED'}</span>
          </div>
          <p className="ox-economy-small">{es
            ? 'El recorrido previsto es: finalizar la venta de la colección → verificar las reservas disponibles → habilitar el rescate → solicitarlo desde tu wallet → cobrar y quemar el NFT en una misma operación, o revertir todo si falla. No se debe quemar primero y esperar un pago posterior.'
            : 'Planned flow: complete collection sales → verify available reserves → enable redemption → request from your wallet → receive payment and burn the NFT in one operation, or revert everything on failure. Burning first and waiting for later payment is not the intended flow.'}</p>
          <p className="ox-economy-small">{es
            ? 'Cierre previsto: 5.999 ventas y #0001 Azhurak reservado, cubriendo los 6.000 números. Esta simulación usa el cierre completo y los mismos controles de inversión de arriba, aunque el selector por tandas muestre un cierre parcial. La elegibilidad de #0001 y el divisor efectivo para rescates deberán aprobarse antes de activar el cobro.'
            : 'Planned close: 5,999 sales and reserved #0001 Azhurak, covering all 6,000 serials. This simulation uses the full close and the investment controls above, even when the batch selector shows a partial close. Eligibility of #0001 and the effective redemption denominator must be approved before payout activation.'}</p>
          <div className="ox-economy-rules-scroll" role="region" tabIndex={0} aria-label={es ? 'Simulación de rescate por NFT' : 'Redemption simulation per NFT'}>
            <table className="ox-economy-table">
              <caption>{es ? 'Modelo ilustrativo: reserva de cada categoría dividida entre su suministro máximo. Diferencia antes de comisiones e impuestos; no es un importe disponible para cobrar.' : 'Illustrative model: each category reserve divided by maximum supply. Difference before fees and taxes; not an available payout quote.'}</caption>
              <thead><tr><th scope="col">{es ? 'Categoría' : 'Category'}</th><th scope="col">{es ? 'Compra de referencia' : 'Reference purchase'}</th><th scope="col">{es ? 'Rescate simulado' : 'Modeled redemption'}</th><th scope="col">{es ? 'Ganancia / pérdida antes de costes' : 'Gain / loss before costs'}</th></tr></thead>
              <tbody>{SIMULATION_TIERS.map(value => {
                const exit = simulateHolderExit(value, annualRateBps, years);
                return <tr key={value}><th scope="row">{value}</th><td>{money(exit.price)}</td><td>{money(exit.modeledRedemption)}</td><td>{exit.differenceBeforeFees > 0n ? '+' : ''}{money(exit.differenceBeforeFees)}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <p className="ox-economy-small">{es
            ? 'Un mayor saldo de reserva puede aumentar el importe del modelo. La ganancia del comprador depende de que el rescate supere su precio de compra y los costes. Los resultados de inversiones pueden ser positivos o negativos; el 25% fijo es un aporte, no una rentabilidad garantizada.'
            : 'A larger reserve can increase the modeled amount. Buyer profit depends on redemption exceeding purchase price and costs. Investment results can be positive or negative; the fixed 25% is a contribution, not a guaranteed return.'}</p>
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
            ? "El rescate mediante quema es el mecanismo previsto para después del cierre. Hoy permanece deshabilitado; los ejemplos no constituyen saldos cobrables ni ganancias garantizadas."
            : "Burn-based redemption is the intended mechanism after closing. It remains disabled today; these examples are not payable balances or guaranteed profits."}
        </p>
      </div>
    </section>
  );
}
