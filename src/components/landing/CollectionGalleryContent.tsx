import { useState } from "react";

const artworks = [
  { tier: "RARE", es: "Guardián del océano", en: "Ocean guardian", src: "/nft-gallery/rare-ocean.png" },
  { tier: "RARE", es: "Guardián del bosque", en: "Forest guardian", src: "/nft-gallery/rare-forest.png" },
  { tier: "EPIC", es: "Tormenta amatista", en: "Amethyst storm", src: "/nft-gallery/epic-amethyst.png" },
  { tier: "EPIC", es: "Brasa carmesí", en: "Crimson ember", src: "/nft-gallery/epic-ember.png" },
  { tier: "LEGENDARY", es: "Soberano solar", en: "Solar sovereign", src: "/nft-gallery/legendary-solar.png" },
  { tier: "LEGENDARY", es: "Soberano astral", en: "Astral sovereign", src: "/nft-gallery/legendary-astral.png" },
] as const;

type Props = {
  language: "es" | "en";
  onClose: () => void;
  onPreview: (artwork: { name: string; src: string }) => void;
};

function Magnify() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M7.5 10.5h6M10.5 7.5v6"/></svg>;
}

export default function CollectionGalleryContent({ language, onClose, onPreview }: Props) {
  const [category, setCategory] = useState("all");
  const es = language === "es";
  const text = (spanish: string, english: string) => es ? spanish : english;
  const visible = artworks.filter(artwork => category === "all" || artwork.tier === category);
  return (
    <div className="ox-gallery-content">
      <header className="ox-gallery-header">
        <div><p className="ox-gallery-eyebrow">ORIGINX FOUNDATION <span aria-hidden="true"> / </span> FOUNDING 6000</p><h2>{text("Galería de la colección", "Collection gallery")}</h2></div>
        <button className="ox-gallery-close" type="button" onClick={onClose} aria-label={text("Cerrar galería", "Close gallery")}><span>{text("Cerrar", "Close")}</span><span aria-hidden="true">×</span></button>
      </header>

      <div className="ox-gallery-intro"><p>{text("Seis miradas al universo OriginX.", "Six perspectives on the OriginX universe.")}<span>{text(" Explorá el arte y descubrí los detalles de cada dragón.", " Explore the artwork and discover each dragon’s details.")}</span></p><span className="ox-gallery-concept">{text("ARTE CONCEPTUAL", "CONCEPT ART")}</span></div>

      <div className="ox-gallery-toolbar">
        <div className="ox-gallery-filters" role="group" aria-label={text("Filtrar por categoría", "Filter by category")}>
          {["all", "RARE", "EPIC", "LEGENDARY"].map(tier => <button key={tier} type="button" aria-pressed={category === tier} data-tier={tier.toLowerCase()} onClick={() => setCategory(tier)}>{tier === "all" ? text("Todas", "All") : tier}<span>{tier === "all" ? "06" : "02"}</span></button>)}
        </div>
        <p className="ox-gallery-count" role="status">{visible.length} {text("ilustraciones", "illustrations")}</p>
      </div>

      <div className="ox-gallery-artworks">
        {visible.map(artwork => {
          const title = es ? artwork.es : artwork.en;
          const name = artwork.tier + " · " + title;
          return <button className="ox-gallery-artwork" data-tier={artwork.tier.toLowerCase()} key={artwork.src} type="button" aria-label={text("Ampliar ", "Enlarge ") + name} onClick={() => onPreview({ name, src: artwork.src })}>
            <span className="ox-gallery-artwork__stage"><img src={artwork.src} alt={name} loading="lazy" width="1024" height="1024"/><span className="ox-gallery-artwork__zoom" aria-hidden="true"><Magnify/></span></span>
            <span className="ox-gallery-artwork__caption"><span className="ox-gallery-tier">{artwork.tier}</span><strong>{title}</strong><span className="ox-gallery-artwork__hint">{text("Explorar detalles", "Explore details")}<span aria-hidden="true">↗</span></span></span>
          </button>;
        })}
      </div>

      <details className="ox-gallery-provenance">
        <summary><span><span className="ox-gallery-seal" aria-hidden="true">◇</span>{text("Identidad y trazabilidad", "Identity and provenance")}</span><span className="ox-gallery-provenance__toggle" aria-hidden="true">+</span></summary>
        <p className="ox-gallery-provenance__intro">{text("Conocé qué documenta la identidad digital de una pieza.", "Learn what documents a collectible’s digital identity.")}</p>
        <dl>
          <div><dt>{text("Registro akáshico", "Akashic record")}</dt><dd>{text("Historial digital de eventos de la pieza, desde su origen. Cada evento se enlaza por hash para detectar modificaciones.", "A digital history of the collectible’s events, starting with its origin. Events are linked by hashes to detect changes.")}</dd></div>
          <div><dt>{text("Metadata y ADN visual", "Metadata and visual DNA")}</dt><dd>{text("El número de token, la categoría, los rasgos y la versión de generación documentan la identidad de la pieza. Las huellas digitales permiten verificar sus archivos.", "Token number, category, traits and generation version document the collectible’s identity. Digital fingerprints allow its files to be verified.")}</dd></div>
          <div><dt>{text("Glifo de resonancia", "Resonance glyph")}</dt><dd>{text("Un símbolo visual generado a partir del ADN de la pieza y vinculado a su registro.", "A visual symbol derived from the collectible’s DNA and linked to its record.")}</dd></div>
        </dl>
      </details>
      <footer className="ox-gallery-footer"><span className="ox-gallery-footer__mark" aria-hidden="true">OX</span><p>{text("Representaciones conceptuales de la colección.", "Concept representations of the collection.")}<span>{text(" Arte promocional; no acredita emisión onchain ni disponibilidad de una pieza para la venta.", " Promotional artwork; not proof of onchain issuance or availability of a collectible for sale.")}</span></p></footer>
    </div>
  );
}
