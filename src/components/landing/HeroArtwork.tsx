type Props = {
  language: "es" | "en";
};

export default function HeroArtwork({ language }: Props) {
  return (
    <figure className="ox-hero-artwork">
      <img
        className="ox-hero-artwork-image"
        src="/landing/arcade-pop/hero-cards.png"
        width={1254}
        height={1254}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        alt={
          language === "es"
            ? "Ilustración promocional: dragón azul y dorado en una tarjeta RARE, con tarjetas EPIC y LEGENDARY detrás."
            : "Promotional illustration: a blue and gold dragon on a RARE card, with EPIC and LEGENDARY cards behind it."
        }
      />
      <div className="ox-art-brand" aria-hidden="true">
        <strong>ORIGIN<span>X</span></strong>
        <small>FOUNDATION</small>
      </div>
      <div className="ox-art-serial" aria-hidden="true">
        <strong>#0001</strong>
        <span>RARE</span>
      </div>
      <span className="ox-art-tier ox-art-tier-epic" aria-hidden="true">EPIC</span>
      <span className="ox-art-tier ox-art-tier-legendary" aria-hidden="true">
        LEGENDARY
      </span>
      <figcaption className="ox-art-caption">
        {language === "es"
          ? "Arte promocional · no acredita emisión onchain"
          : "Promotional artwork · not evidence of onchain issuance"}
      </figcaption>
    </figure>
  );
}
