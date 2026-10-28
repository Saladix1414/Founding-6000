import "../../styles/originx-commercial-cards.css";

type Props = {
  language: "es" | "en";
  onEconomy: () => void;
};

type IconKind = "nft" | "economy" | "ecosystem";

function PillarIcon({ kind }: { kind: IconKind }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {kind === "nft" ? (
        <path d="M5 2h3v3h8V2h3v3h2v4h3v9h-3v4h-4v-3h2v-3H5v3h2v3H3v-4H0V9h3V5h2V2Zm1 7v4h3V9H6Zm9 0v4h3V9h-3Z" />
      ) : kind === "economy" ? (
        <>
          <rect x="2" y="14" width="5" height="8" rx="1" />
          <rect x="9" y="8" width="5" height="14" rx="1" />
          <rect x="16" y="2" width="5" height="20" rx="1" />
        </>
      ) : (
        <path d="m2 21 8-18 5 10 3-6 6 14H2Zm8-12-2 5 2-1 2 1-2-5Z" />
      )}
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

const imageSizes = {
  "epic-dragon.png": {
    "width": 1254,
    "height": 1254
  },
  "economy-emblem.png": {
    "width": 1254,
    "height": 1254
  },
  "ecosystem-island.png": {
    "width": 1254,
    "height": 1254
  }
};

export default function CommercialCards({ language, onEconomy }: Props) {
  const es = language === "es";

  const cards = [
    {
      key: "nft",
      number: "01",
      title: es ? "TU PIEZA" : "YOUR COLLECTIBLE",
      description: es
        ? "Arte generativo, número único y un NFT transferible."
        : "Generative art, a unique number and a transferable NFT.",
      image: "epic-dragon.png",
      href: "#phases",
      action: es ? "Ver colección" : "View collection",
    },
    {
      key: "economy",
      number: "02",
      title: es ? "REGLAS CLARAS" : "CLEAR RULES",
      description: es
        ? "Cómo funciona la reserva y cómo se separan los fondos."
        : "How the reserve works and how funds are kept separate.",
      image: "economy-emblem.png",
      href: null,
      action: es ? "Ver economía" : "View economy",
    },
    {
      key: "ecosystem",
      number: "03",
      title: es ? "LO QUE VIENE" : "WHAT’S AHEAD",
      description: es
        ? "Los productos de OriginX y su estado de desarrollo."
        : "OriginX products and their development status.",
      image: "ecosystem-island.png",
      href: "#product",
      action: es ? "Ver proyecto" : "View project",
    },
  ] as const;

  return (
    <section
      className="ox-landing ox-commercial-section"
      aria-label={es ? "Colección, economía y ecosistema" : "Collection, economy and ecosystem"}
    >
      <div className="ox-commercial-grid">
        {cards.map(card => (
          <article
            key={card.key}
            className={"ox-commercial-card ox-commercial-card--" + card.key}
          >
            <div className="ox-commercial-content">
              <div className="ox-commercial-kicker" aria-hidden="true">
                <span>{card.number}</span>
                <PillarIcon kind={card.key} />
              </div>

              <h2>{card.title}</h2>
              <p>{card.description}</p>

              {card.href ? (
                <a
                  className="ox-commercial-action"
                  href={card.href}
                  aria-label={card.action}
                >
                  <span>{card.action}</span>
                  <Arrow />
                </a>
              ) : (
                <button
                  className="ox-commercial-action"
                  type="button"
                  onClick={onEconomy}
                  aria-label={card.action}
                >
                  <span>{card.action}</span>
                  <Arrow />
                </button>
              )}
            </div>

            <img
              className="ox-commercial-art"
              src={"/landing/arcade-pop/" + card.image}
              width={imageSizes[card.image].width}
              height={imageSizes[card.image].height}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </article>
        ))}
      </div>
    </section>
  );
}
