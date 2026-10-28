import "../../styles/originx-hero-copy.css";

type Props = {
  language: "es" | "en";
  onEconomy: () => void;
};

function ArcadeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path d="M4 1h2v2h4V1h2v2h2v3h2v6h-2v3h-3v-2h2v-2H3v2h2v2H2v-3H0V6h2V3h2V1ZM4 6v3h2V6H4Zm6 0v3h2V6h-2Z" />
    </svg>
  );
}

function CollectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="13" rx="3" />
      <path d="M7 3h10M8 10h8M8 14h5" />
    </svg>
  );
}

function EconomyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2" y="14" width="5" height="8" rx="1" />
      <rect x="9" y="8" width="5" height="14" rx="1" />
      <rect x="16" y="2" width="5" height="20" rx="1" />
    </svg>
  );
}

export default function FoundingHeroCopy({ language, onEconomy }: Props) {
  const es = language === "es";

  return (
    <div className="ox-hero-copy">
      <div className="ox-hero-intro">
        <p className="ox-hero-eyebrow">
          <ArcadeIcon />
          <span>{es ? "LA COLECCIÓN FUNDADORA" : "THE FOUNDING COLLECTION"}</span>
        </p>

        <h1 className="ox-hero-heading">
          <span className="ox-hero-number">{es ? "6.000" : "6,000"}</span>
          <span className="ox-hero-heading-label">
            {es ? "MEMBRESÍAS NFT" : "NFT MEMBERSHIPS"}
          </span>
        </h1>

        <p className="ox-hero-tagline">
          <span>{es ? "Tu pieza." : "Your collectible."}</span>{" "}
          <span>{es ? "Tu lugar en OriginX." : "Your place in OriginX."}</span>
        </p>

        <p className="ox-hero-description">
          {es
            ? "Founding 6000 reúne 6.000 membresías NFT de OriginX Foundation. Cada membresía está diseñada para incluir una pieza coleccionable y 12 meses de Focus Founding Access desde su activación válida."
            : "Founding 6000 brings together 6,000 OriginX Foundation NFT memberships. Each membership is designed to include a collectible and 12 months of Focus Founding Access from valid activation."}
        </p>
      </div>

      <div className="ox-hero-actions">
        <a className="ox-hero-button ox-hero-button-primary" href="#phases">
          <CollectionIcon />
          <span>{es ? "Explorar la colección" : "Explore the collection"}</span>
          <span aria-hidden="true">→</span>
        </a>

        <button
          className="ox-hero-button ox-hero-button-secondary"
          type="button"
          onClick={onEconomy}
          aria-label={
            es ? "Ver la economía: abrir whitepaper" : "View the economy: open whitepaper"
          }
        >
          <EconomyIcon />
          <span>{es ? "Ver la economía" : "View the economy"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <dl className="ox-hero-stats">
        <div>
          <dt>{es ? "Seriales únicos" : "Unique serials"}</dt>
          <dd>{es ? "6.000" : "6,000"}</dd>
        </div>
        <div>
          <dt>{es ? "Categorías" : "Categories"}</dt>
          <dd>3</dd>
        </div>
        <div>
          <dt>{es ? "De acceso¹" : "Of access¹"}</dt>
          <dd>{es ? "12 MESES" : "12 MONTHS"}</dd>
        </div>
        <div>
          <dt>{es ? "Transferible" : "Transferable"}</dt>
          <dd>NFT <span aria-hidden="true">↔</span></dd>
        </div>
      </dl>

      <details className="ox-hero-conditions">
        <summary>{es ? "Condiciones de membresía" : "Membership terms"}</summary>
        <p>
          {es
            ? "¹ El acceso comienza con la activación válida. Transferir el NFT conserva el plazo restante; no reinicia los 12 meses."
            : "¹ Access begins upon valid activation. Transferring the NFT preserves the remaining term; it does not restart the 12 months."}
        </p>
        <p>
          {es
            ? "Preorden / reserva de producto. Founding 6000 no es una inversión, oferta de capital, valor financiero ni programa de participación en ingresos."
            : "Product pre-order / reservation. Founding 6000 is not an investment, equity offering, security or revenue-share program."}
        </p>
      </details>
    </div>
  );
}
