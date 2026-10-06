import {
  WHITEPAPER_BRAND,
  WHITEPAPER_ORIGIN_LAYER,
  whitepaperSections,
  type WhitepaperLanguage,
} from "./whitepaperContent";

type DigitalBoostWhitepaperProps = {
  language: WhitepaperLanguage;
  onClose: () => void;
};

export function DigitalBoostWhitepaper({
  language,
  onClose,
}: DigitalBoostWhitepaperProps) {
  const text = (
    value: {
      en: string;
      es: string;
    },
  ) => value[language];

  const scrollToSection = (
    sectionId: string,
  ) => {
    const element =
      document.getElementById(
        `whitepaper-${sectionId}`,
      );

    element?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <aside
      id="project-whitepaper-panel"
      className="project-whitepaper"
      aria-label={
        language === "es"
          ? `Whitepaper de ${WHITEPAPER_BRAND}`
          : `${WHITEPAPER_BRAND} Whitepaper`
      }
    >
      <header className="project-whitepaper__header">
        <div className="project-whitepaper__identity">
          <span className="project-whitepaper__eyebrow">
            DIGITAL BUSINESS OPERATING SYSTEM
          </span>

          <strong>
            {WHITEPAPER_BRAND}
          </strong>

          <p>
            {language === "es"
              ? "Whitepaper del ecosistema"
              : "Ecosystem Whitepaper"}
          </p>
        </div>

        <button
          type="button"
          className="project-whitepaper__close"
          aria-label={
            language === "es"
              ? "Cerrar whitepaper"
              : "Close whitepaper"
          }
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="project-whitepaper__meta">
        <span>FOUNDING 6000</span>
        <span>CANONICAL EDITION</span>
        <span>2026</span>
      </div>

      <div className="project-whitepaper__layout">
        <nav
          className="project-whitepaper__nav"
          aria-label={
            language === "es"
              ? "Capítulos del whitepaper"
              : "Whitepaper chapters"
          }
        >
          <div className="project-whitepaper__nav-title">
            {language === "es"
              ? "CONTENIDO"
              : "CONTENTS"}
          </div>

          {whitepaperSections.map(
            (section) => (
              <button
                type="button"
                key={section.id}
                onClick={() =>
                  scrollToSection(
                    section.id,
                  )
                }
              >
                <span>
                  {section.number}
                </span>

                <strong>
                  {section.label}
                </strong>
              </button>
            ),
          )}
        </nav>

        <div className="project-whitepaper__document">
          <section className="project-whitepaper__cover">
            <span className="project-whitepaper__cover-kicker">
              DIGITALBOOST
            </span>

            <h2>
              {WHITEPAPER_BRAND}
            </h2>

            <p className="project-whitepaper__cover-subtitle">
              Digital Business Operating System
            </p>

            <div className="project-whitepaper__cover-line" />

            <p className="project-whitepaper__cover-description">
              {language === "es"
                ? "Un ecosistema digital para crear, operar, automatizar, conectar, analizar, proteger y hacer evolucionar negocios y productos digitales desde un mismo entorno."
                : "A digital ecosystem for creating, operating, automating, connecting, analyzing, protecting and evolving digital businesses and products from a unified environment."}
            </p>

            <div className="project-whitepaper__cover-map">
              <span>COMMERCE OS</span>
              <span>WEB BUILDER</span>
              <span>AI FORGE</span>
              <span>TRADING ISLANDS</span>
              <span>SENTINEL</span>
              <span>NEXUS</span>
            </div>

            <div className="project-whitepaper__pulse">
              <small>
                TRANSVERSAL INTELLIGENCE
              </small>

              <strong>PULSE</strong>

              <span>
                {language === "es"
                  ? "Comprender · Orquestar · Evolucionar"
                  : "Understand · Orchestrate · Evolve"}
              </span>
            </div>
          </section>

          {whitepaperSections.map(
            (section) => (
              <article
                id={`whitepaper-${section.id}`}
                className="project-whitepaper__section"
                key={section.id}
              >
                <header className="project-whitepaper__section-header">
                  <span>
                    {section.number}
                  </span>

                  <div>
                    <small>
                      {section.label}
                    </small>

                    <h3>
                      {text(
                        section.title,
                      )}
                    </h3>
                  </div>
                </header>

                <p className="project-whitepaper__lead">
                  {text(
                    section.summary,
                  )}
                </p>

                {section.paragraphs?.map(
                  (
                    paragraph,
                    index,
                  ) => (
                    <p
                      className="project-whitepaper__paragraph"
                      key={`${section.id}-paragraph-${index}`}
                    >
                      {text(
                        paragraph,
                      )}
                    </p>
                  ),
                )}

                {section.cards &&
                  section.cards.length >
                    0 && (
                    <div className="project-whitepaper__cards">
                      {section.cards.map(
                        (card) => (
                          <div
                            className="project-whitepaper__card"
                            key={`${section.id}-${card.title}`}
                          >
                            <strong>
                              {card.title}
                            </strong>

                            <p>
                              {text(
                                card.text,
                              )}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                {section.bullets &&
                  section.bullets.length >
                    0 && (
                    <ul className="project-whitepaper__bullets">
                      {section.bullets.map(
                        (
                          bullet,
                          index,
                        ) => (
                          <li
                            key={`${section.id}-bullet-${index}`}
                          >
                            {text(
                              bullet,
                            )}
                          </li>
                        ),
                      )}
                    </ul>
                  )}

                {section.flow &&
                  section.flow.length >
                    0 && (
                    <div className="project-whitepaper__flow">
                      {section.flow.map(
                        (
                          item,
                          index,
                        ) => (
                          <div
                            className="project-whitepaper__flow-item"
                            key={`${section.id}-${item}`}
                          >
                            <span>
                              {item}
                            </span>

                            {index <
                              section.flow!
                                .length -
                                1 && (
                              <b
                                aria-hidden="true"
                              >
                                →
                              </b>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
              </article>
            ),
          )}

          <section className="project-whitepaper__closing">
            <span>DIGITALBOOST</span>

            <h3>
              {language === "es"
                ? "Un ecosistema. Múltiples capacidades."
                : "One ecosystem. Multiple capabilities."}
            </h3>

            <p>
              CREATE → OPERATE → INTELLIGENCE →
              CONNECT → TRADE → SECURE →
              MEASURE → EVOLVE
            </p>

            <div className="project-whitepaper__originx">
              <small>
                DIGITAL ASSETS
              </small>

              <strong>
                {WHITEPAPER_ORIGIN_LAYER}
              </strong>

              <span>
                {language === "es"
                  ? "Identidad · Procedencia · Historia"
                  : "Identity · Provenance · History"}
              </span>
            </div>
          </section>

          <footer className="project-whitepaper__footer">
            <span>
              {WHITEPAPER_BRAND}
            </span>

            <span>
              {language === "es"
                ? "Documento conceptual vivo"
                : "Living conceptual document"}
            </span>
          </footer>
        </div>
      </div>
    </aside>
  );
}
