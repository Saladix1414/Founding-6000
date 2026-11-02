import "../../styles/originx-collection.css";
import "../../styles/originx-tier-popover.css";
import { positionTierPopover } from "./tierPopoverPosition";
import {fullCloseV3} from "../../../shared/foundingReservePolicyV3.mjs";

type CollectionPhase = {
  number: string;
  name: string;
  capacity: number;
  price: number;
  range: string;
};

type Props = {
  language: "es" | "en";
  phases: readonly CollectionPhase[];
  ctaLabel: string;
  onCheckout: () => void;
};

function publicTier(name: string) {
  return name === "GENESIS" ? "LEGENDARY" : name;
}

function Crown() {
  return (
    <svg viewBox="0 0 40 32" fill="none" aria-hidden="true">
      <path d="m5 8 8 7 7-12 7 12 8-7-4 18H9L5 8Z" />
      <path d="M10 30h20" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="20" cy="3" r="2" />
      <circle cx="35" cy="6" r="2" />
    </svg>
  );
}

export default function FoundingCollection({
  language,
  phases,
  ctaLabel,
  onCheckout,
}: Props) {
  const es = language === "es";
  const locale = es ? "es-AR" : "en-US";
  const closingReserves = fullCloseV3();
  const money = (minor: bigint) => new Intl.NumberFormat(locale, {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(minor)/1_000_000) + ' USDT';

  return (
    <section
      id="phases"
      className="ox-landing ox-collection"
      aria-labelledby="ox-collection-title"
    >
      <div className="ox-collection-inner">
        <header className="ox-collection-heading">
          <div>
            <p className="ox-collection-eyebrow">FOUNDING 6000</p>
            <h2 id="ox-collection-title">
              {es ? "Tres categorías." : "Three categories."}{" "}
              <span>
                {es ? "Una colección." : "One collection."}
              </span>
            </h2>
            <p className="ox-collection-description">
              {es
                ? "RARE, EPIC y LEGENDARY: cada pieza tiene un número único, del #0001 al #6000. Compará cantidades y precios de referencia."
                : "RARE, EPIC and LEGENDARY: each collectible has a unique number, from #0001 to #6000. Compare quantities and reference prices."}
            </p>
          </div>

          <div className="ox-collection-supply">
            <strong>{(6000).toLocaleString(locale)}</strong>
            <span>{es ? "NFT · suministro máximo" : "NFTs · maximum supply"}</span>
          </div>
        </header>

        <div className="ox-collection-grid">
          {phases.map(phase => {
            const tier = publicTier(phase.name);
            const closing = closingReserves.find(unit => unit.tier === tier);
            const plannedPayout = closing?.perNft ?? null;
            const theme = tier === "RARE"
              ? "rare"
              : tier === "EPIC" ? "epic" : "legendary";

            return (
              <article
                className={"ox-tier-card ox-tier-card--" + theme}
                key={phase.number}
              >
                <div className="ox-tier-banner">
                  <div className="ox-tier-topline">
                    <span>{phase.number}</span>
                    <span>FOUNDING 6000</span>
                  </div>

                  <div className="ox-tier-emblem"><Crown /></div>
                  <h3>{tier}</h3>
                  <p className="ox-tier-serial">{phase.range}</p>
                </div>

                <div className="ox-tier-body">
                  <p className="ox-tier-price-label">
                    {es ? "Precio primario de referencia" : "Reference primary price"}
                  </p>

                  <p className="ox-tier-price">
                    <strong>{phase.price.toLocaleString(locale)}</strong>
                    <span>USDT</span>
                  </p>

                  <dl className="ox-tier-facts">
                    <div>
                      <dt>{es ? "NFTs en esta categoría" : "NFTs in this category"}</dt>
                      <dd>{phase.capacity.toLocaleString(locale)}</dd>
                    </div>
                    <div>
                      <dt>{es ? "Web de tiendas y desarrollo" : "Stores and development website"}</dt>
                      <dd>{es ? "12 meses" : "12 months"}</dd>
                    </div>
                    <div className="ox-tier-gain">
                      <dt>{es ? "Ganancias de cobro previsto" : "Expected payout benefit"}</dt>
                      <dd>{plannedPayout === null ? (es ? "No disponible" : "Unavailable") : money(plannedPayout)}</dd>
                    </div>
                    <div>
                      <dt>{es ? "Se puede transferir" : "Transferable"}</dt>
                      <dd>{es ? "Sí" : "Yes"}</dd>
                    </div>
                  </dl>

                  <p className="ox-tier-gain-note">{es ? 'Cobro previsto de tu reserva al cerrar las ventas y habilitar la quema. No es beneficio neto frente a la compra; costes e impuestos personales no incluidos.' : 'Share of the reserve expected to be paid through burning after sales close and redemption is enabled. Not net profit versus purchase price; personal costs and taxes excluded.'}</p>
                  <div className="ox-tier-details ox-tier-popover-trigger">
                    <button type="button" popoverTarget={"ox-tier-details-" + phase.number} aria-label={(es ? "Ver detalles de " : "View details for ") + tier} onClick={event => {
                      const panel = document.getElementById("ox-tier-details-" + phase.number);
                      if (panel) Object.assign(panel.style, positionTierPopover(event.currentTarget.getBoundingClientRect(), window.innerWidth, window.innerHeight));
                    }}>{es ? "Ver detalles" : "View details"} <span aria-hidden="true">▾</span></button>
                    <div id={"ox-tier-details-" + phase.number} popover="auto" className="ox-tier-popover-panel" aria-label={(es ? "Detalles de " : "Details for ") + tier}>
                    <div className="ox-tier-popover-heading"><strong>{tier}</strong><button type="button" popoverTarget={"ox-tier-details-" + phase.number} popoverTargetAction="hide" aria-label={es ? "Cerrar detalles" : "Close details"}>×</button></div>
                    <ul className="ox-tier-benefits-brief">
                      <li><strong>{es ? 'Creá tu próximo proyecto.' : 'Build your next project.'}</strong> {es ? 'Una pieza única y 12 meses de acceso a la web de tiendas y desarrollo desde la activación válida.' : 'A unique collectible and 12 months of access to the stores and development website from valid activation.'}</li>
                      <li><strong>{es ? 'Acceso transferible.' : 'Transferable access.'}</strong> {es ? 'Si transferís el NFT, pasa el tiempo restante; no reinicia el plazo.' : 'Transferring the NFT passes on the remaining access without restarting the term.'}</li>
                      <li><strong>{es ? 'Una reserva para tu NFT.' : 'A reserve for your NFT.'}</strong> {es ? 'El 25% de cada venta inicial se destina a reserva. Tu cobro previsto al cierre: ' : '25% of each initial sale is allocated to reserves. Your expected payout at closing: '}{plannedPayout === null ? (es ? 'por verificar' : 'to be verified') : money(plannedPayout)}{es ? ', sin sumar inversiones ni aportes futuros. La quema se prevé tras finalizar las ventas y habilitar el rescate.' : ', excluding future investment returns and contributions. Burning is planned after sales close and redemption is enabled.'}</li>
                      <li><strong>{es ? 'El negocio puede impulsar la reserva.' : 'The business could grow the reserve.'}</strong> {es ? 'El plan propone aportar el 15% del beneficio neto futuro de suscripciones y servicios e invertir hasta el 10% de la reserva tras el cierre. Su objetivo es ampliar el fondo; depende de resultados reales y de habilitar el plan.' : 'The plan proposes adding 15% of future net profit from subscriptions and services and investing up to 10% of reserves after closing. It aims to grow the fund, subject to actual results and plan activation.'}</li>
                    </ul>
                    <a href="#ox-business-reserve-scenario">{es ? 'Conocé el plan y explorá sus escenarios →' : 'Explore the plan and its scenarios →'}</a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="ox-collection-footer">
          <p>
            {es
              ? "Precios de referencia de venta inicial. Esta vista no reserva NFTs. La disponibilidad y el número asignado se confirman en la compra, cuando esté habilitada."
              : "Reference prices for the initial sale. This view does not reserve NFTs. Availability and your assigned number are confirmed at checkout, when enabled."}
          </p>
          <button
            className="ox-collection-cta"
            type="button"
            onClick={onCheckout}
          >
            {ctaLabel}<span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
    </section>
  );
}
