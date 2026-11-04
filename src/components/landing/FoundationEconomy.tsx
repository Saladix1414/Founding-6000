import { useState } from "react";
import {
  SIMULATION_TIERS,
  simulateReferenceSale,
  simulateBatchClose,
  parseScenarioCosts,
  simulateHolderExit,
  simulateCampaignBusinessYear,
  type SimulationTier,
} from "./economySimulation";
import "../../styles/originx-economy.css";

export function scrollToEconomy() {
  document.dispatchEvent(new Event("ox:open-economy"));
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
  const years = 1;
  const [businessMonthlyProfit, setBusinessMonthlyProfit] = useState(5000);
  const businessYears = 1;
  let costs: bigint | null = null;
  let costInvalid = false;
  try { costs = parseScenarioCosts(costInput); } catch { costInvalid = true; }
  const closing = simulateBatchClose(completedBatches, costs);
  const businessCases = [1000,5000,10000].map(value => simulateCampaignBusinessYear(BigInt(value)*1_000_000n,0,businessYears));
  const businessSelected = simulateCampaignBusinessYear(BigInt(businessMonthlyProfit)*1_000_000n,0,businessYears);

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
            <strong className="ox-economy-reserve-lead">{es
              ? "El modelo destina el 50% de cada venta inicial verificada a la reserva comunitaria."
              : "The model allocates 50% of each verified initial sale to community reserves."}</strong>{" "}
            {es
              ? "El objetivo del modelo es permitirte rescatar tu NFT desde la web, quemándolo a cambio del importe que le corresponda según la política de su categoría, una vez completada la venta y habilitado el mecanismo."
              : "The model aims to let you redeem your NFT on this website, burning it in exchange for the amount assigned by its category policy, once sales close and the mechanism is enabled."}
          </p>
          <p className="ox-economy-small ox-economy-marked">{es
            ? 'Política prevista: acumular y preservar los aportes de reserva durante la venta, sin rescates ni retiros de ese capital hasta la habilitación de la quema. La aplicación operativa del nuevo porcentaje, la protección efectiva de los fondos y el rescate requieren implementación y verificación.'
            : 'Planned policy: accumulate and preserve reserve contributions during sales, with no redemptions or withdrawals of that principal before burn activation. Operational activation of the new percentage, effective fund protection and redemption require implementation and verification.'}</p>
        </header>

        <div className="ox-economy-scheme ox-economy-financial-split">
          <div id="ox-economy-split" className="ox-economy-scheme-heading">
            <h3>{es ? "Cómo se reparte cada venta" : "How each sale is split"}</h3>
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

            <div className="ox-economy-allocation-bar" aria-hidden="true">
              <span>50%</span>
              <span>50%</span>
            </div>

            <div className="ox-economy-branches">
              <div className="ox-economy-branch ox-economy-branch--reserve">
                <h4><span className="ox-economy-visually-hidden">50% </span>{es ? "A reserva" : "To reserve"}</h4>
                <strong>{money(result.reserve)}</strong>
                <p>
                  {es
                    ? "Distribución debajo."
                    : "Allocation below."}
                </p>
              </div>

              <div className="ox-economy-branch ox-economy-branch--outside">
                <h4><span className="ox-economy-visually-hidden">50% </span>{es ? "Fuera de reserva" : "Outside reserve"}</h4>
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
                ? "Reserva y operación separadas. El 50% es bruto: no es beneficio ni saldo disponible."
                : "Reserves and operations stay separate. The 50% is gross, not profit or an available balance."}
            </p>

            <div className="ox-economy-reserve-detail">
              <h4>
                {es ? "A qué categoría va la reserva" : "Which category receives the reserve"}
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

        <div className="ox-economy-scheme ox-economy-projection ox-economy-financial-projection">
          <div id="ox-economy-sales" className="ox-economy-scheme-heading">
            <h3>{es ? 'Proyección de ventas por tanda' : 'Sales projection by batch'}</h3>
            <span>{es ? 'MODELO AL 50% · CIERRE PROYECTADO' : '50% MODEL · PROJECTED CLOSE'}</span>
          </div>
          <p className="ox-economy-small">{es
            ? 'La proyección de campaña supone la venta de los 6.000 NFT a los precios de referencia. En el inventario vigente, #0001 Azhurak figura reservado.'
            : 'The campaign projection assumes sales of all 6,000 NFTs at reference prices. In the current inventory, #0001 Azhurak is marked as reserved.'}</p>
          <label className="ox-economy-field" htmlFor="ox-closing-batches">
            <span>{es ? 'Escenario de cierre' : 'Closing scenario'}</span>
            <select id="ox-closing-batches" value={completedBatches} onChange={event => setCompletedBatches(Number(event.target.value))}>
              <option value={1}>{es ? 'Al finalizar RARE' : 'After RARE'}</option>
              <option value={2}>{es ? 'Al finalizar RARE + EPIC' : 'After RARE + EPIC'}</option>
              <option value={3}>{es ? 'Al finalizar toda la colección' : 'After the full collection'}</option>
            </select>
          </label>
          <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
            <div><span>{es ? 'Ingresos del escenario' : 'Scenario revenue'}</span><strong>{money(closing.sales)}</strong></div>
            <div><span>{es ? 'Aporte fijo a reserva' : 'Fixed reserve contribution'}</span><strong>{money(closing.reserve)}</strong></div>
            <div><span>{es ? 'Minteo estimado' : 'Estimated minting'}</span><strong>{money(closing.minting)}</strong></div>
            <div><span>{es ? 'Para financiar la web, antes de otros gastos' : 'For the website, before other expenses'}</span><strong>{money(closing.forWebsite)}</strong></div>
          </div>
          <p className="ox-economy-small">{es
            ? "Para financiar la web: ingresos menos la reserva y el coste estimado de minteo. Todos los importes de este bloque son proyecciones."
            : "Website funding: revenue minus reserves and estimated minting costs. All figures in this section are projections."}</p>
          <details className="ox-economy-explanation">
            <summary>{es ? "Ver detalle por tanda" : "View batch breakdown"}</summary>
            <div className="ox-economy-rules-scroll ox-economy-marked" role="region" aria-label={es ? 'Resultados por tanda' : 'Batch results'} tabIndex={0}>
              <table className="ox-economy-table">
                <caption>{es ? 'Importes calculados si se completan las ventas indicadas; no son cobros ya verificados.' : 'Calculated amounts if the selected sales complete; not already verified receipts.'}</caption>
                <thead><tr><th scope="col">{es ? 'Tanda' : 'Batch'}</th><th scope="col">{es ? 'Ventas' : 'Sales'}</th><th scope="col">{es ? 'Ingreso' : 'Revenue'}</th><th scope="col">50% → {es ? 'reserva' : 'reserve'}</th><th scope="col">{es ? 'Reserva acumulada' : 'Cumulative reserve'}</th></tr></thead>
                <tbody>{closing.stages.map(stage => <tr key={stage.tier}><th scope="row">{stage.tier}</th><td>{stage.quantity}</td><td>{money(stage.revenue)}</td><td>{money(stage.contribution)}</td><td>{money(stage.cumulativeReserve)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
          <details className="ox-economy-explanation">
            <summary>{es ? "Calcular el neto con tus propios costes" : "Calculate net proceeds with your own costs"}</summary>
            <label className="ox-economy-field" htmlFor="ox-scenario-costs">
              <span>{es ? 'Costes totales del escenario (USDT, opcional)' : 'Total scenario costs (USDT, optional)'}</span>
              <input id="ox-scenario-costs" type="text" inputMode="decimal" maxLength={12} value={costInput} onChange={event => setCostInput(event.target.value)} placeholder={es ? 'Pendientes de definir' : 'Not defined yet'} aria-invalid={costInvalid} aria-describedby="ox-cost-explanation" />
            </label>
            <p id="ox-cost-explanation" className="ox-economy-small">{costInvalid
              ? (es ? 'Ingresá un importe positivo con hasta dos decimales.' : 'Enter a positive amount with up to two decimal places.')
              : (es ? 'Sin costes definidos, el beneficio neto operativo queda pendiente. El 50% corresponde al aporte a reserva.' : 'Without defined costs, operating net profit remains pending. The 50% is the reserve contribution.')}</p>
            <div className="ox-economy-sale" aria-live="polite"><span>{es ? 'Neto operativo estimado tras la reserva y los costes ingresados' : 'Estimated operating net after reserves and entered costs'}</span><strong>{!costInvalid && closing.operatingNet !== null ? money(closing.operatingNet) : (es ? 'Pendiente' : 'Pending')}</strong></div>
          </details>
        </div>

        <section className="ox-economy-map" aria-labelledby="ox-economy-map-title">
          <h3 id="ox-economy-map-title">{es ? "Cómo se conecta todo" : "How it fits together"}</h3>
          <ol className="ox-economy-steps">
            <li><strong>{es ? "NFT y acceso" : "NFT and access"}</strong><span>{es ? "Pieza única y 12 meses desde la activación válida." : "A unique collectible and 12 months from valid activation."}</span></li>
            <li><strong>{es ? "Reparto de la venta" : "Sale allocation"}</strong><span>{es ? "50% a reserva y 50% fuera de reserva." : "50% to reserves and 50% outside reserves."}</span></li>
            <li><strong>{es ? "Proyección por tandas" : "Batch projection"}</strong><span>{es ? "Ventas, reserva, minteo y financiación de la web." : "Sales, reserves, minting and website funding."}</span></li>
            <li><strong>{es ? "Escenarios de reserva" : "Reserve scenarios"}</strong><span>{es ? "Posibles aportes del negocio." : "Potential business contributions."}</span></li>
            <li><strong>{es ? "Futuro rescate" : "Future redemption"}</strong><span>{es ? "Simulación. El rescate todavía no está habilitado." : "Simulation. Redemption is not enabled yet."}</span></li>
          </ol>
        </section>

        <div id="ox-economy-access" className="ox-economy-data ox-economy-marked">
          <h3>{es ? 'Qué incluye tu NFT' : 'What your NFT includes'}</h3>
          <ul className="ox-economy-access-list">
            <li>{es ? "Una pieza única y 12 meses de acceso a la web de tiendas y desarrollo desde la activación válida." : "A unique collectible and 12 months of access to the stores and development website from valid activation."}</li>
            <li>{es ? "Si transferís el NFT, el nuevo titular válido recibe el tiempo restante con el mismo vencimiento." : "If you transfer the NFT, the new valid holder receives the remaining access with the same expiry date."}</li>
          </ul>
          <a className="ox-economy-transparency-link" href="#benefits">{es ? 'Conocer los beneficios de la suscripción' : 'Explore subscription benefits'}<span aria-hidden="true">↓</span></a>
        </div>

        <div id="ox-business-reserve-scenario" className="ox-economy-scheme ox-economy-projection ox-economy-lower-card">
          <div className="ox-economy-scheme-heading">
            <h3>{es ? 'Aportes del negocio a la reserva' : 'Business contributions to the reserve'}</h3>
            <span>{es ? 'SUPUESTOS · 1 AÑO' : 'ASSUMPTIONS · 1 YEAR'}</span>
          </div>
          <details className="ox-economy-explanation">
            <summary>{es ? 'De dónde salen los aportes del negocio' : 'Where business contributions come from'}</summary>
            <p className="ox-economy-small">{es ? '50% de cada venta inicial a reserva. Una vez lanzada la web principal de OriginX, el modelo propone sumar a la reserva el 15% del beneficio neto realizado por suscripciones y servicios. Si hay beneficios, el fondo puede crecer. Son escenarios hipotéticos: no beneficios actuales ni aportes ya activados.' : 'Each initial sale allocates 50% to reserves. After the main OriginX website launches, the model proposes adding 15% of realized net profit from subscriptions and services. If the business earns profits, the fund receives additional contributions. These are hypothetical scenarios, not current profits or active contributions.'}</p>
            <p className="ox-economy-small">{es ? 'Un NFT único. 12 meses de acceso desde la activación válida. El tiempo restante es transferible con tu NFT. Explorá el crecimiento potencial de su reserva en 1 año.' : 'A unique NFT. 12 months of access from valid activation. Remaining access transfers with your NFT. Explore its reserve’s potential growth over 1 year.'}</p>
            <p className="ox-economy-small">{es ? 'El 85% restante del beneficio neto queda en el negocio. La renovación y los gastos operativos aún no están definidos: elegís un beneficio neto supuesto, no una facturación. Los 12 meses incluidos con Founding no se cuentan como nuevos cobros mensuales.' : 'The other 85% of net profit stays with the business. Renewal pricing and operating costs are not yet defined: you select assumed net profit, not revenue. The 12 months included with Founding are not counted as new monthly payments.'}</p>
          </details>
          <label className="ox-economy-field" htmlFor="ox-business-profit"><span>{es ? 'Beneficio neto mensual. Panorama especulativo' : 'Monthly net profit. Speculative outlook'}</span>
            <select id="ox-business-profit" value={businessMonthlyProfit} onChange={event => setBusinessMonthlyProfit(Number(event.target.value))}>
              {[1000,5000,10000].map(value => <option key={value} value={value}>{money(BigInt(value)*1_000_000n)} / {es ? 'mes (supuesto)' : 'month (assumption)'}</option>)}
            </select>
          </label>
          <p id="ox-business-years" className="ox-economy-small">{es ? "Plazo del escenario del negocio: 12 meses." : "Business scenario term: 12 months."}</p>
          <div className="ox-economy-projection-metrics" aria-live="polite" aria-atomic="true">
            <div><span>{es ? 'Reserva inicial prevista · 50% de las ventas' : 'Modeled opening reserve · 50% of sales'}</span><strong>{money(businessSelected.openingReserve)}</strong></div>
            <div><span>{es ? 'Aporte del negocio en ' + businessYears*12 + ' meses · 15% del beneficio neto' : 'Business contribution over ' + businessYears*12 + ' months · 15% of net profit'}</span><strong>{money(businessSelected.totalBusinessContribution)}</strong></div>
            <div><span>{es ? 'Reserva total estimada tras ' + businessYears + (businessYears === 1 ? ' año' : ' años') : 'Estimated total reserve after ' + businessYears + (businessYears === 1 ? ' year' : ' years')}</span><strong>{money(businessSelected.closingReserve)}</strong></div>
          </div>
          <p className="ox-economy-small">{es ? 'La proyección suma 12 meses de aportes hipotéticos del negocio a la reserva inicial.' : 'The projection adds 12 months of hypothetical business contributions to the opening reserve.'}</p>
          <details className="ox-economy-explanation">
            <summary>{es ? 'Ver aportes por categoría' : 'View contributions by category'}</summary>
            <div className="ox-economy-rules-scroll" role="region" tabIndex={0} aria-label={es ? 'Reserva por NFT con aportes del negocio' : 'Reserve per NFT with business contributions'}>
              <table className="ox-economy-table"><caption>{es ? 'Importe según reserva por 1 NFT, no beneficio frente al precio de compra. Los aportes futuros del negocio usan pesos por NFT de 1,5 para RARE, 1,2 para EPIC y 1 para LEGENDARY. El cálculo parte de la reserva proyectada al cierre.' : 'Reserve amount per 1 NFT, not profit versus purchase price. Future business contributions use per-NFT weights of 1.5 for RARE, 1.2 for EPIC and 1 for LEGENDARY. The calculation starts from projected closing reserves.'}</caption>
                <thead><tr><th scope="col">{es ? 'Categoría' : 'Category'}</th><th scope="col">{es ? 'Al cierre' : 'At closing'}</th><th scope="col">{es ? 'Crecimiento estimado por NFT en 1 año' : 'Estimated increase over the selected term'}</th><th scope="col">{es ? 'Reserva estimada por NFT al año' : 'Estimated amount at the end of the term'}</th></tr></thead>
                <tbody>{businessSelected.units.map(unit => <tr key={unit.tier}><th scope="row">{unit.tier}</th><td>{money(unit.openingPerNft)}</td><td>{unit.increasePerNft > 0n ? '+' : ''}{money(unit.increasePerNft)}</td><td>{money(unit.closingPerNft)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
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

        <div className="ox-economy-scheme ox-economy-projection ox-economy-lower-card">
          <div id="ox-economy-redemption" className="ox-economy-scheme-heading">
            <h3>{es ? 'Rescate con quema' : 'Burn-based redemption'}</h3>
            <span>{es ? 'SIMULACIÓN · RESCATE NO HABILITADO' : 'SIMULATION · REDEMPTION DISABLED'}</span>
          </div>
          <ol className="ox-economy-steps ox-economy-redemption-steps" aria-label={es ? "Etapas previstas del rescate" : "Planned redemption steps"}>
            <li>{es ? "Finalizar las ventas" : "Complete sales"}</li>
            <li>{es ? "Verificar las reservas disponibles" : "Verify available reserves"}</li>
            <li>{es ? "Habilitar el rescate" : "Enable redemption"}</li>
            <li>{es ? "Solicitar el rescate desde tu wallet" : "Request redemption from your wallet"}</li>
            <li>{es ? "Cobrar y quemar el NFT en una misma operación" : "Receive payment and burn the NFT in one operation"}</li>
          </ol>
          <p className="ox-economy-small">{es
            ? "Si la operación falla, se revierte completa. Evitá quemar el NFT por separado."
            : "If the transaction fails, it reverts in full. Avoid burning the NFT separately."}</p>
          <p className="ox-economy-small">{es
            ? 'Esta simulación usa la proyección de campaña de 6.000 ventas. Las condiciones efectivas de elegibilidad y rescate siguen pendientes.'
            : 'This simulation uses the 6,000-sale campaign projection. Actual eligibility and redemption terms remain pending.'}</p>
          <details className="ox-economy-explanation">
            <summary>{es ? 'Ver simulación por categoría' : 'View simulation by category'}</summary>
            <div className="ox-economy-rules-scroll" role="region" tabIndex={0} aria-label={es ? 'Simulación de rescate por NFT' : 'Redemption simulation per NFT'}>
              <table className="ox-economy-table">
                <caption>{es ? 'Modelo ilustrativo: reserva de cada categoría dividida entre su suministro máximo. Diferencia antes de comisiones e impuestos; no es un importe disponible para cobrar.' : 'Illustrative model: each category reserve divided by maximum supply. Difference before fees and taxes; not an available payout quote.'}</caption>
                <thead><tr><th scope="col">{es ? 'Categoría' : 'Category'}</th><th scope="col">{es ? 'Compra de referencia' : 'Reference purchase'}</th><th scope="col">{es ? 'Rescate simulado' : 'Modeled redemption'}</th><th scope="col">{es ? 'Ganancia / pérdida antes de costes' : 'Gain / loss before costs'}</th></tr></thead>
                <tbody>{SIMULATION_TIERS.map(value => {
                  const exit = simulateHolderExit(value, 0, years);
                  return <tr key={value}><th scope="row">{value}</th><td>{money(exit.price)}</td><td>{money(exit.modeledRedemption)}</td><td>{exit.differenceBeforeFees > 0n ? '+' : ''}{money(exit.differenceBeforeFees)}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </details>
          <p className="ox-economy-small">{es
            ? 'Un mayor saldo de reserva puede aumentar el importe del modelo. La ganancia del comprador depende de que el rescate supere su precio de compra y los costes.'
            : 'A larger reserve can increase the modeled amount. Buyer profit depends on redemption exceeding purchase price and costs.'}</p>
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
