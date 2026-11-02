import { useState } from "react";
import {
  SIMULATION_TIERS,
  simulateReferenceSale,
  simulateBatchClose,
  parseScenarioCosts,
  simulateHolderExit,
  simulateManagedReserveScenario,
  type SimulationTier,
} from "./economySimulation";
import "../../styles/originx-economy.css";
import { simulateBusinessReserveYear } from '../../../shared/foundingBusinessScenario.mjs';

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
  const [annualRateBps, setAnnualRateBps] = useState(400);
  const years = 1;
  const [holderTier, setHolderTier] = useState<SimulationTier>('RARE');
  const [businessMonthlyProfit, setBusinessMonthlyProfit] = useState(5000);
  const businessYears = 1;
  let costs: bigint | null = null;
  let costInvalid = false;
  try { costs = parseScenarioCosts(costInput); } catch { costInvalid = true; }
  const closing = simulateBatchClose(completedBatches, costs);
  const perNftAtClose = simulateHolderExit(holderTier, 0, 1);
  const perNftAfterInvestment = simulateHolderExit(holderTier, annualRateBps, years);
  const managedFund = simulateManagedReserveScenario(simulateBatchClose(3).reserve, annualRateBps, years);
  const businessCases = [1000,5000,10000].map(value => simulateBusinessReserveYear(BigInt(value)*1_000_000n,400,businessYears));
  const businessSelected = simulateBusinessReserveYear(BigInt(businessMonthlyProfit)*1_000_000n,400,businessYears);

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
                      <span>{new Intl.NumberFormat(es ? 'es-AR' : 'en-US', {maximumFractionDigits:4}).format(Number(item.weightBps) / 100)}%</span>
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

        <div className="ox-economy-data">
          <h3>{es ? 'Tu NFT: acceso, libertad y crecimiento potencial' : 'An NFT, a transferable subscription and a reserve model'}</h3>
          <p>{es ? 'Tu compra reúne una pieza única y 12 meses de acceso a la web de tiendas y desarrollo desde la activación válida. Si transferís el NFT, el nuevo titular válido recibe el tiempo restante, con el mismo vencimiento. El 25% de cada venta inicial verificada se destina a reserva; los escenarios siguientes explican su posible evolución.' : 'Your purchase brings together a unique collectible and 12 months of access to the stores and development website from valid activation. If you transfer the NFT, its new valid holder receives the remaining term with the same expiry. 25% of each verified initial sale goes to reserves; the following scenarios explain their possible evolution.'}</p>
          <a className="ox-economy-transparency-link" href="#benefits">{es ? 'Conocer los beneficios de la suscripción' : 'Explore subscription benefits'}<span aria-hidden="true">↓</span></a>
        </div>

        <div className="ox-economy-scheme ox-economy-projection">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? 'Resultados netos de la venta por tandas hasta finalizar' : 'Net sale results by batch through completion'}</h3>
            <span>{es ? 'REPARTO V3 · CIERRE PROYECTADO' : 'V3 ALLOCATION · PROJECTED CLOSE'}</span>
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
          <p className="ox-economy-small">{es ? 'Al completar la colección: 30 USDT de reserva por RARE y 16,9975 USDT por EPIC o LEGENDARY (17,00 en pantalla). El reparto conserva el fondo total y la prioridad individual de RARE.' : 'At full collection close: 30 USDT of modeled reserve per RARE and 16.9975 USDT per EPIC or LEGENDARY (17.00 displayed). The allocation preserves the total fund and RARE’s individual priority.'}</p>
          <p className="ox-economy-small">{es ? 'Elegí tu categoría y compará cuánto pagás por un NFT, la reserva que representa una unidad al finalizar toda la colección y cómo cambiaría ese importe con la inversión seleccionada. Todos los importes destacados de este bloque son por un NFT, no por toda la reserva.' : 'Choose your category and compare the price of one NFT, its modeled reserve amount at full collection close, and how that amount would change under your selected investment scenario. Every highlighted amount in this section is per NFT, not the total reserve.'}</p>
          <fieldset className="ox-economy-selector">
            <legend>{es ? '¿Qué NFT querés comparar?' : 'Which NFT would you like to compare?'}</legend>
            <div>{SIMULATION_TIERS.map(value => <label key={value}><input type="radio" name="ox-holder-tier" value={value} checked={holderTier === value} onChange={() => setHolderTier(value)} /><span>{value}</span></label>)}</div>
          </fieldset>
          <div className="ox-economy-projection-controls">
            <label className="ox-economy-field" htmlFor="ox-investment-rate"><span>{es ? 'Rendimiento neto anual supuesto de la parte invertida (10%)' : 'Assumed annual net return on invested portion (10%)'}</span><select id="ox-investment-rate" value={annualRateBps} onChange={event => setAnnualRateBps(Number(event.target.value))}>{[-2000,0,200,400,800].map(rate => <option key={rate} value={rate}>{rate > 0 ? '+' : ''}{rate / 100}%</option>)}</select></label>
            <p id="ox-investment-years" className="ox-economy-small">{es ? "Plazo del análisis: 1 año desde el cierre y la habilitación de la estrategia." : "Analysis term: 1 year after closing and strategy activation."}</p>
          </div>
          <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
            <div><span>{es ? 'Precio de compra de 1 NFT' : 'Purchase price of 1 NFT'} · {holderTier}</span><strong>{money(perNftAtClose.price)}</strong></div>
            <div><span>{es ? 'Reserva por NFT al finalizar la colección' : 'Reserve per NFT at full collection close'} · {holderTier}</span><strong>{money(perNftAtClose.modeledRedemption)}</strong></div>
            <div><span>{es ? 'Por NFT tras la inversión simulada' : 'Per NFT after simulated investment'} · {holderTier}</span><strong>{money(perNftAfterInvestment.modeledRedemption)}</strong></div>
          </div>
          <p className="ox-economy-small" aria-live="polite">{es
            ? 'Para 1 NFT ' + holderTier + ': ' + money(perNftAtClose.price) + ' de compra → ' + money(perNftAtClose.modeledRedemption) + ' según reserva al cierre → ' + money(perNftAfterInvestment.modeledRedemption) + ' tras ' + years + (years === 1 ? ' año' : ' años') + ' con un rendimiento anual del ' + (annualRateBps / 100) + '% sobre el 10% invertido.'
            : 'For 1 ' + holderTier + ' NFT: ' + money(perNftAtClose.price) + ' purchase → ' + money(perNftAtClose.modeledRedemption) + ' modeled reserve at close → ' + money(perNftAfterInvestment.modeledRedemption) + ' after ' + years + (years === 1 ? ' year' : ' years') + ' at ' + (annualRateBps / 100) + '% annual return on the invested 10%.'}</p>
          <div className="ox-economy-sale" aria-live="polite"><span>{es ? 'Ganancia / pérdida de 1 NFT frente al precio de compra, antes de costes' : 'Gain / loss on 1 NFT versus purchase price, before costs'}</span><strong>{perNftAfterInvestment.differenceBeforeFees > 0n ? '+' : ''}{money(perNftAfterInvestment.differenceBeforeFees)}</strong></div>
          <details className="ox-economy-explanation">
            <summary>{es ? 'Cómo funciona el plan y qué supone el cálculo' : 'How the plan works and calculation assumptions'}</summary>
          <p className="ox-economy-small">{es ? 'Plan propuesto: 100% líquido durante las ventas. Tras el cierre y la habilitación del rescate, 90% líquido y hasta 10% invertido, con rebalanceo anual en este ejemplo. La tasa elegida se aplica solo a ese 10% y supone descontados los costes de la estrategia; no es una tasa observada ni prometida. No se simulan rescates intermedios. Los costes e impuestos personales de rescate siguen pendientes.' : 'Proposed plan: 100% liquid during sales. After closing and redemption activation, 90% liquid and up to 10% invested, with annual rebalancing in this illustration. The selected rate applies only to that 10% and assumes strategy costs deducted; it is not an observed or promised rate. No interim redemptions are simulated. Personal redemption costs and taxes remain undefined.'}</p>
          <div className="ox-economy-reserve-detail">
            <h4>{es ? 'Magnitud del fondo al completar la colección' : 'Fund size at full collection close'}</h4>
            <p className="ox-economy-small">{es
              ? 'Capital previsto: ' + money(managedFund.openingReserve) + ' · Parte líquida (90%): ' + money(managedFund.openingLiquid) + ' · Máximo invertido inicial (10%): ' + money(managedFund.openingInvested) + '.'
              : 'Modeled principal: ' + money(managedFund.openingReserve) + ' · Liquid portion (90%): ' + money(managedFund.openingLiquid) + ' · Initial invested maximum (10%): ' + money(managedFund.openingInvested) + '.'}</p>
            <p className="ox-economy-small" aria-live="polite">{es
              ? 'Resultado estimado del fondo en el plazo elegido: ' + money(managedFund.netChange) + ' · Capital final simulado: ' + money(managedFund.closingReserve) + '.'
              : 'Estimated fund result over the selected term: ' + money(managedFund.netChange) + ' · Simulated final capital: ' + money(managedFund.closingReserve) + '.'}</p>
            <p className="ox-economy-small">{es ? 'Sin préstamos, apalancamiento ni puentes en la estrategia propuesta. Ningún proveedor ni inversión real está habilitado. El valor de los activos puede bajar y la liquidez puede no estar disponible de inmediato.' : 'No borrowing, leverage or bridges in the proposed strategy. No provider or actual investment is enabled. Asset values can fall and liquidity may not be immediately available.'}</p>
          </div>
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
          </details>
        </div>

        <div id="ox-investment-gain-per-nft" className="ox-economy-scheme ox-economy-projection">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? 'Incremento estimado por NFT con el plan de inversión a 1 año' : 'Estimated increase per NFT under the 1-year investment plan'}</h3>
            <span>{es ? 'INVERSIÓN · SUPUESTO' : 'INVESTMENT · ASSUMPTION'}</span>
          </div>
          <div id="ox-reserve-investment-totals" className="ox-economy-reserve-detail">
            <h4>{es ? 'Resultado total de la reserva del 25% a 1 año' : 'Total one-year result for the 25% reserve'}</h4>
            <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
              <div><span>{es ? 'Reserva inicial · 25% de las ventas' : 'Opening reserve · 25% of sales'}</span><strong>{money(managedFund.openingReserve)}</strong></div>
              <div><span>{es ? 'Resultado neto estimado de inversión · fondo completo' : 'Estimated net investment result · whole fund'}</span><strong>{managedFund.netChange > 0n ? '+' : ''}{money(managedFund.netChange)}</strong></div>
              <div><span>{es ? 'Reserva total estimada tras 1 año' : 'Estimated total reserve after 1 year'}</span><strong>{money(managedFund.closingReserve)}</strong></div>
            </div>
            <details className="ox-economy-explanation"><summary>{es ? 'Qué incluye este total' : 'What this total includes'}</summary>            <p className="ox-economy-small">{es ? 'Capital inicial + resultado de inversión = reserva final. El resultado usa la tasa elegida sobre el 10% invertido; el 90% líquido no genera rendimiento en este ejemplo. Se suponen descontados los costes de la estrategia. No suma los aportes futuros del negocio ni descuenta los impuestos y costes personales. Son estimaciones, no fondos ya cobrados.' : 'Opening principal + investment result = closing reserve. The result uses your selected rate on the invested 10%; the liquid 90% earns no return in this example. Strategy costs are assumed deducted. Future business contributions are excluded, as are personal taxes and costs. These are estimates, not funds already received.'}</p></details>
          </div>
          <p className="ox-economy-small">{es ? 'Tu reserva al cierre + el resultado estimado de inversión = tu reserva al año. Con el supuesto del 4% sobre el 10% invertido, el crecimiento es del 0,4%. Los aportes del negocio van aparte; no es ganancia frente al precio de compra.' : 'Your closing reserve + estimated investment result = your reserve after one year. At an assumed 4% on the invested 10%, modeled growth is 0.4%. Business contributions are separate; this is not profit versus purchase price.'}</p>
          <div className="ox-economy-rules-scroll" role="region" tabIndex={0} aria-label={es ? 'Incremento de inversión por NFT a un año' : 'One-year investment increase per NFT'}>
            <table className="ox-economy-table">
              <caption>{es ? 'Estimaciones calculadas con las reservas V3 al completar la colección. Tasa supuesta, sin proveedor aprobado ni inversión activada; el resultado puede ser negativo. Costes e impuestos personales no incluidos.' : 'Estimates based on V3 reserves at full collection close. Assumed rate, no approved provider or active investment; the result may be negative. Personal costs and taxes excluded.'}</caption>
              <thead><tr><th scope="col">{es ? 'Categoría' : 'Category'}</th><th scope="col">{es ? 'Reserva inicial por NFT' : 'Opening reserve per NFT'}</th><th scope="col">{es ? 'Incremento de inversión en 1 año' : 'Investment increase over 1 year'}</th><th scope="col">{es ? 'Reserva por NFT tras 1 año' : 'Reserve per NFT after 1 year'}</th></tr></thead>
              <tbody>{SIMULATION_TIERS.map(value => {
                const opening = simulateHolderExit(value, 0, 1).modeledRedemption;
                const final = simulateHolderExit(value, annualRateBps, 1).modeledRedemption;
                const gain = final - opening;
                return <tr key={value}><th scope="row">{value}</th><td>{money(opening)}</td><td>{gain > 0n ? '+' : ''}{money(gain)}</td><td>{money(final)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </div>

        <div id="ox-business-reserve-scenario" className="ox-economy-scheme ox-economy-projection">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? 'El negocio crece. Tu reserva puede crecer también.' : 'As the business grows, your reserve could grow too.'}</h3>
            <span>{es ? 'SUPUESTOS · 1 AÑO' : 'ASSUMPTIONS · 1 YEAR'}</span>
          </div>
          <p className="ox-economy-small">{es ? '25% de cada venta inicial a reserva. El modelo propone sumar el 15% del beneficio neto futuro del negocio. Si hay beneficios, el fondo puede crecer. Son escenarios hipotéticos: no beneficios actuales ni aportes ya activados.' : 'Each initial sale allocates 25% to reserves. The model also proposes adding 15% of future net profit from subscriptions and services. If the business earns profits, the fund receives additional contributions. These are hypothetical scenarios, not current profits or active contributions.'}</p>
          <p className="ox-economy-small">{es ? 'Un NFT único. 12 meses de acceso desde la activación válida. El tiempo restante es transferible con tu NFT. Explorá el crecimiento potencial de su reserva en 1 año.' : 'A unique NFT. 12 months of access from valid activation. Remaining access transfers with your NFT. Explore its reserve’s potential growth over 1 year.'}</p>
          <details className="ox-economy-explanation"><summary>{es ? 'De dónde salen los aportes del negocio' : 'Where business contributions come from'}</summary>          <p className="ox-economy-small">{es ? 'El 85% restante del beneficio neto queda en el negocio. La renovación y los gastos operativos aún no están definidos: elegís un beneficio neto supuesto, no una facturación. Los 12 meses incluidos con Founding no se cuentan como nuevos cobros mensuales.' : 'The other 85% of net profit stays with the business. Renewal pricing and operating costs are not yet defined: you select assumed net profit, not revenue. The 12 months included with Founding are not counted as new monthly payments.'}</p></details>
          <label className="ox-economy-field" htmlFor="ox-business-profit"><span>{es ? 'Beneficio neto mensual supuesto del negocio' : 'Assumed monthly net business profit'}</span>
            <select id="ox-business-profit" value={businessMonthlyProfit} onChange={event => setBusinessMonthlyProfit(Number(event.target.value))}>
              {[1000,5000,10000].map(value => <option key={value} value={value}>{money(BigInt(value)*1_000_000n)} / {es ? 'mes (supuesto)' : 'month (assumption)'}</option>)}
            </select>
          </label>
          <p id="ox-business-years" className="ox-economy-small">{es ? "Plazo del escenario del negocio: 12 meses." : "Business scenario term: 12 months."}</p>
          <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
            <div><span>{es ? 'Reserva inicial prevista · 25% de las ventas' : 'Modeled opening reserve · 25% of sales'}</span><strong>{money(businessSelected.openingReserve)}</strong></div>
            <div><span>{es ? 'Aporte del negocio en ' + businessYears*12 + ' meses · 15% del beneficio neto' : 'Business contribution over ' + businessYears*12 + ' months · 15% of net profit'}</span><strong>{money(businessSelected.totalBusinessContribution)}</strong></div>
            <div><span>{es ? 'Reserva total estimada tras ' + businessYears + (businessYears === 1 ? ' año' : ' años') : 'Estimated total reserve after ' + businessYears + (businessYears === 1 ? ' year' : ' years')}</span><strong>{money(businessSelected.closingReserve)}</strong></div>
          </div>
          <details className="ox-economy-explanation"><summary>{es ? 'Supuestos de este escenario a 12 meses' : 'Assumptions for this 12-month scenario'}</summary>          <p className="ox-economy-small">{es ? 'Comparación de ' + businessYears + (businessYears === 1 ? ' año' : ' años') + ' después del cierre y de habilitar la estrategia: 10% invertido, rebalanceado anualmente, al 4% neto anual supuesto aporta ' + money(businessSelected.financialResult) + '. Los nuevos aportes permanecen líquidos, sin rendimiento adicional; no se vuelven a contar las ventas iniciales ni se simulan rescates intermedios. Esta comparación abarca 12 meses y utiliza el supuesto del 4% anual, independientemente del selector de tasa de arriba.' : 'Comparison over ' + businessYears + (businessYears === 1 ? ' year' : ' years') + ' after closing and strategy activation: 10% invested, rebalanced annually, at an assumed 4% net annual return adds ' + money(businessSelected.financialResult) + '. New contributions stay liquid without additional return; initial sales are not counted twice and no interim redemptions are simulated. This comparison covers 12 months and assumes a 4% annual rate, independently of the rate selector above.'}</p></details>
          <div className="ox-economy-rules-scroll" role="region" tabIndex={0} aria-label={es ? 'Reserva por NFT con aportes del negocio' : 'Reserve per NFT with business contributions'}>
            <table className="ox-economy-table"><caption>{es ? 'Importe según reserva por 1 NFT, no beneficio frente al precio de compra. Los aportes futuros del negocio usan pesos por NFT de 1,5 para RARE, 1,2 para EPIC y 1 para LEGENDARY. La reserva de cierre V3 se conserva.' : 'Reserve amount per 1 NFT, not profit versus purchase price. Future business contributions use per-NFT weights of 1.5 for RARE, 1.2 for EPIC and 1 for LEGENDARY. V3 closing reserves are preserved.'}</caption>
              <thead><tr><th scope="col">{es ? 'Categoría' : 'Category'}</th><th scope="col">{es ? 'Al cierre' : 'At closing'}</th><th scope="col">{es ? 'Crecimiento estimado por NFT en 1 año' : 'Estimated increase over the selected term'}</th><th scope="col">{es ? 'Reserva estimada por NFT al año' : 'Estimated amount at the end of the term'}</th></tr></thead>
              <tbody>{businessSelected.units.map(unit => <tr key={unit.tier}><th scope="row">{unit.tier}</th><td>{money(unit.openingPerNft)}</td><td>{unit.increasePerNft > 0n ? '+' : ''}{money(unit.increasePerNft)}</td><td>{money(unit.closingPerNft)}</td></tr>)}</tbody>
            </table>
          </div>
          <details className="ox-economy-rules"><summary>{es ? 'Comparar los tres escenarios del negocio' : 'Compare all three business scenarios'}</summary>
            <div className="ox-economy-rules-scroll" role="region" tabIndex={0} aria-label={es ? 'Comparación de escenarios hipotéticos' : 'Comparison of hypothetical scenarios'}>
              <table className="ox-economy-table"><caption>{es ? 'Cada caso supone beneficios netos realizados durante los ' + businessYears*12 + ' meses. Ninguna cifra es una previsión comercial validada.' : 'Each case assumes realized net profits for all ' + businessYears*12 + ' months. None is a validated business forecast.'}</caption>
                <thead><tr><th scope="col">{es ? 'Beneficio neto supuesto / mes' : 'Assumed net profit / month'}</th><th scope="col">{es ? '15% al fondo en 12 meses' : '15% to the fund over 12 months'}</th><th scope="col">{es ? '85% para el negocio / mes' : '85% for the business / month'}</th><th scope="col">{es ? 'Reserva total al finalizar el plazo' : 'Total reserve at the end of the term'}</th>{SIMULATION_TIERS.map(value => <th scope="col" key={value}>{value} / NFT</th>)}</tr></thead>
                <tbody>{businessCases.map(row => <tr key={row.monthlyProfitMinor.toString()}><th scope="row">{money(row.monthlyProfitMinor)}</th><td>{money(row.totalBusinessContribution)}</td><td>{money(row.monthlyProfitMinor*85n/100n)}</td><td>{money(row.closingReserve)}</td>{row.units.map(unit => <td key={unit.tier}>{money(unit.closingPerNft)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </details>
          <a className="ox-economy-transparency-link" href="#benefits">{es ? 'Ver qué incluye tu suscripción transferible' : 'See what your transferable subscription includes'}<span aria-hidden="true">↓</span></a>
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
                      <td key={item.tier}>{new Intl.NumberFormat(es ? 'es-AR' : 'en-US', {maximumFractionDigits:4}).format(Number(item.weightBps) / 100)}%</td>
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
