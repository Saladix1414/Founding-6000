import { WhitepaperFounderIntro } from "./WhitepaperFounderIntro";
import {
  WHITEPAPER_BRAND,
  WHITEPAPER_ORIGIN_LAYER,
  WHITEPAPER_VERSION,
  whitepaperSections,
  type WhitepaperLanguage,
} from "./whitepaperContent";
import "./whitepaperFounding.css";

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

    const documentPanel = document.querySelector<HTMLElement>("#project-whitepaper-panel .project-whitepaper__document");
    if (!element || !documentPanel) return;
    documentPanel.scrollTo({
      top: documentPanel.scrollTop + element.getBoundingClientRect().top - documentPanel.getBoundingClientRect().top - 16,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
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
          <strong>Whitepaper · Founding 6000</strong>
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
            <option value="founder-benefits">{language === "es" ? "Beneficios fundadores" : "Founder benefits"}</option>
            <option value="founder-reserves">{language === "es" ? "Reservas por tanda" : "Reserves by batch"}</option>
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

          <button type="button" onClick={() => scrollToSection("founder-benefits")}><span>+</span><strong>{language === "es" ? "Tus beneficios" : "Your benefits"}</strong></button>
          <button type="button" onClick={() => scrollToSection("founder-reserves")}><span>%</span><strong>{language === "es" ? "Reservas por tanda" : "Reserves by batch"}</strong></button>
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
                  {text(section.label)}
                </strong>
              </button>
            ),
          )}
        </nav>

        <div className="project-whitepaper__document">
          <WhitepaperFounderIntro language={language} />

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
                      {text(section.label)}
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
            <span>ORIGINX FOUNDATION</span>

            <h3>
              {language === "es"
                ? "Tu pieza. Tu acceso. Tu próximo proyecto."
                : "Your collectible. Your access. Your next project."}
            </h3>

            <p>
              {language === 'es' ? 'Creación · Comercio · IA · Juegos' : 'Creation · Commerce · AI · Games'}
            </p>

            <div className="project-whitepaper__originx">
              <small>
                MEMBERSHIP NFT
              </small>

              <strong>
                {WHITEPAPER_ORIGIN_LAYER}
              </strong>

              <span>
                {language === "es"
                  ? "Colección · Acceso transferible · Reserva prevista"
                  : "Collectible · Transferable access · Planned reserve"}
              </span>
            </div>
          </section>

          <footer className="project-whitepaper__footer">
            <span>
              {WHITEPAPER_BRAND}
            </span>

            <span>
              {language === "es"
                ? "Resumen del modelo · " + WHITEPAPER_VERSION
                : "Model overview · " + WHITEPAPER_VERSION}
            </span>
          </footer>
        </div>
      </div>
    </aside>
  );
}
