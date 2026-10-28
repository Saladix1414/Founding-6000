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
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <aside
      id="project-whitepaper-panel"
      className="project-whitepaper"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={
        language === "es"
          ? `Whitepaper de ${WHITEPAPER_BRAND}`
          : `${WHITEPAPER_BRAND} Whitepaper`
      }
    >
      <header className="project-whitepaper__header">
        <div className="project-whitepaper__identity">
          <span className="project-whitepaper__eyebrow">
            {WHITEPAPER_BRAND}
          </span>
          <strong>Whitepaper</strong>
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



      <div className="project-whitepaper__layout">
        <label className="project-whitepaper__chapter-picker">
          <span>{language === "es" ? "Ir a un capítulo" : "Go to a chapter"}</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const sectionId = event.currentTarget.value;
              if (sectionId) scrollToSection(sectionId);
              event.currentTarget.value = "";
            }}
          >
            <option value="" disabled>
              {language === "es" ? "Elegí un capítulo" : "Choose a chapter"}
            </option>
            {whitepaperSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.number} · {text(section.title)}
              </option>
            ))}
          </select>
        </label>
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
            <h2>
              {language === "es"
                ? "Conocé el ecosistema"
                : "Explore the ecosystem"}
            </h2>
            <p className="project-whitepaper__cover-description">
              {language === "es"
                ? "La visión de DigitalBoost, sus productos y cómo se conectan. Un documento conceptual en evolución."
                : "DigitalBoost’s vision, its products and how they connect. An evolving conceptual document."}
            </p>
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
