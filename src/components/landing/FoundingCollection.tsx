import "../../styles/originx-collection.css";
import {fullCloseV3, simulateManagedReserveScenario} from "../../../shared/foundingReservePolicyV3.mjs";

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
            const netGain = closing ? simulateManagedReserveScenario(closing.reserve,400,1).netChange / BigInt(closing.supply) : null;
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
                      <dt>{es ? "Ganancias" : "Gains"}</dt>
                      <dd>{netGain === null ? (es ? "No disponible" : "Unavailable") : money(netGain)}</dd>
                    </div>
                    <div>
                      <dt>{es ? "Se puede transferir" : "Transferable"}</dt>
                      <dd>{es ? "Sí" : "Yes"}</dd>
                    </div>
                  </dl>

                  <p className="ox-tier-gain-note">{es ? 'Estimación de inversión a 1 año sobre la reserva; no es beneficio frente a la compra. Ver supuestos en detalles.' : 'One-year investment estimate on the reserve; not profit versus purchase price. See assumptions in details.'}</p>
                  <details className="ox-tier-details">
                    <summary>{es ? "Ver detalles" : "View details"}</summary>
                    <p>{es ? 'Ganancias: incremento neto estimado de inversión sobre la reserva a un año. Los costes de la estrategia se suponen descontados; los costes e impuestos personales no están incluidos. Se excluyen los aportes futuros del negocio. El supuesto utilizado se explica en el simulador. No es un rendimiento sobre el precio de compra ni una ganancia garantizada. Inversión y rescate aún no habilitados.' : 'Gains: estimated net investment increase on the reserve over one year. Strategy costs are assumed deducted; personal costs and taxes are excluded. Future business contributions are excluded. The assumption is explained in the simulator. Not a return on the purchase price or a guaranteed gain. Investment and redemption are not yet enabled.'}</p>
                    <a href="#ox-investment-gain-per-nft">{es ? 'Ver cálculo y escenarios' : 'View calculation and scenarios'}</a>
                    <p>
                      {es
                        ? "Cada número identifica una pieza de Founding 6000. Los 12 meses de acceso a la web de tiendas y desarrollo comienzan con la activación válida."
                        : "Each number identifies a Founding 6000 collectible. The 12-month access term to the stores and development website begins upon valid activation."}
                    </p>
                    <p>
                      {es
                        ? "La transferencia conserva el tiempo de acceso restante; no inicia otros 12 meses."
                        : "A transfer preserves the remaining access term; it does not start another 12 months."}
                    </p>
                  </details>
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
