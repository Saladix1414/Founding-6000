import "../../styles/originx-collection.css";

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
              {es ? "Tres tiers." : "Three tiers."}{" "}
              <span>
                {es ? "Una colección fundadora." : "One founding collection."}
              </span>
            </h2>
            <p className="ox-collection-description">
              {es
                ? "Seriales únicos del #0001 al #6000. Conocé la distribución de la colección y sus precios primarios de referencia."
                : "Unique serials from #0001 to #6000. Explore the collection distribution and its reference primary prices."}
            </p>
          </div>

          <div className="ox-collection-supply">
            <strong>6.000</strong>
            <span>{es ? "NFT · suministro máximo" : "NFTs · maximum supply"}</span>
          </div>
        </header>

        <div className="ox-collection-grid">
          {phases.map(phase => {
            const tier = publicTier(phase.name);
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
                      <dt>{es ? "NFTs en este tier" : "NFTs in this tier"}</dt>
                      <dd>{phase.capacity.toLocaleString(locale)}</dd>
                    </div>
                    <div>
                      <dt>{es ? "Acceso desde activación" : "Access from activation"}</dt>
                      <dd>{es ? "12 meses" : "12 months"}</dd>
                    </div>
                    <div>
                      <dt>{es ? "Transferibilidad" : "Transferability"}</dt>
                      <dd>{es ? "Sí" : "Yes"}</dd>
                    </div>
                  </dl>

                  <details className="ox-tier-details">
                    <summary>{es ? "Ver detalles" : "View details"}</summary>
                    <p>
                      {es
                        ? "El serial identifica la pieza dentro de Founding 6000. El período de acceso comienza con una activación válida."
                        : "The serial identifies the piece within Founding 6000. The access term begins upon valid activation."}
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
              ? "Los precios son de referencia. La disponibilidad y la asignación de serial se confirman en el flujo habilitado; esta galería no reserva un tier."
              : "Prices are for reference. Availability and serial allocation are confirmed through the enabled flow; this gallery does not reserve a tier."}
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
