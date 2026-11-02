import { useEffect, useRef } from 'react';
import FoundingJourney from './FoundingJourney';
import { mountMembershipDialog } from './membershipDialogController';
import '../../styles/originx-membership-dialog.css';
import '../../styles/originx-project-dialog.css';

type Props = {language: 'es' | 'en'; checkoutEnabled: boolean};
export default function FoundingProjectDialog({language, checkoutEnabled}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current) return;
    return mountMembershipDialog(dialog.current, document, {rootId: 'product'});
  }, []);
  const es = language === 'es';
  return (
    <dialog ref={dialog} className="ox-membership-dialog ox-project-dialog" aria-labelledby="ox-project-dialog-title">
      <div className="ox-membership-dialog-bar">
        <span id="ox-project-dialog-title">{es ? 'Proyecto OriginX Foundation' : 'OriginX Foundation project'}</span>
        <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label={es ? 'Cerrar proyecto' : 'Close project'}>
          {es ? 'Cerrar' : 'Close'} <span aria-hidden="true">×</span>
        </button>
      </div>
        <section
          className="db-section product-section ox-landing ox-ecosystem"
          id="product"
        >
          <div className="db-container">
            <div className="section-heading">
              <div>
                <div className="db-eyebrow">
                  {language === "es"
                    ? "Estado real del producto"
                    : "Product truth"}
                </div>

                <h2 className="db-title">
                  {language === "es"
                    ? "Construyendo el ecosistema OriginX Foundation."
                    : "Building the OriginX Foundation ecosystem."}
                </h2>

                <p className="db-copy">
                  {language === "es"
                    ? "Founding 6000 es una campaña de prelanzamiento. La madurez de cada producto se muestra explícitamente para que las capacidades planificadas no se presenten como disponibles."
                    : "Founding 6000 is a pre-launch campaign. Product maturity is shown explicitly so planned capabilities are not represented as already available."}
                </p>
              </div>

              <span className="truth-badge">
                {language === "es"
                  ? "ESTADO ACTUAL"
                  : "CURRENT STATE"}
              </span>
            </div>

            <div className="product-grid">
              <article className="product-card">
                <div className="product-card__top">
                  <span>01</span>
                  <span className="product-status product-status--active">
                    {language === "es"
                      ? "Funcional / En desarrollo"
                      : "Functional / In development"}
                  </span>
                </div>

                <h3>Commerce OS</h3>

                <p>
                  {language === "es"
                    ? "Flujos de comercio y bases operativas actualmente en desarrollo activo."
                    : "Commerce workflows and operational foundations currently under active development."}
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>02</span>
                  <span className="product-status product-status--active">{language === "es" ? "Funcional / En desarrollo" : "Functional / In development"}</span>
                </div>

                <h3>Web Builder</h3>

                <p>
                  {language === "es"
                    ? "Entorno visual de creación de sitios web desarrollado como parte de DigitalBoost Studio."
                    : "Visual website creation environment being developed as part of DigitalBoost Studio."}
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>03</span>
                  <span className="product-status product-status--building">
                    {language === "es"
                      ? "En desarrollo"
                      : "In development"}
                  </span>
                </div>

                <h3>PULSE</h3>

                <p>
                  {language === "es"
                    ? "Capacidad de orquestación comercial que actualmente forma parte de Commerce OS."
                    : "Commerce orchestration capability currently belonging inside Commerce OS."}
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>04</span>
                  <span className="product-status product-status--active">
                    {language === "es"
                      ? "Avanzado / En desarrollo"
                      : "Advanced / In development"}
                  </span>
                </div>

                <h3>Trading Islands</h3>

                <p>
                  {language === "es"
                    ? "Herramientas de trading, bots y automatización para activos digitales. En desarrollo activo."
                    : "Trading tools, bots and automation for digital assets. Under active development."}
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>05</span>
                  <span className="product-status product-status--building">
                    {language === "es"
                      ? "Base / En desarrollo"
                      : "Foundation / In development"}
                  </span>
                </div>

                <h3>AI Forge</h3>

                <p>
                  {language === "es"
                    ? "Una base en desarrollo para crear herramientas de IA, agentes y automatizaciones."
                    : "A foundation under development for building AI tools, agents and automations."}
                </p>
              </article>

              <article className="product-card product-card--planned">
                <div className="product-card__top">
                  <span>06</span>
                  <span className="product-status">
                    {language === "es"
                      ? "Planificado"
                      : "Planned"}
                  </span>
                </div>

                <h3>Sentinel</h3>

                <p>
                  {language === "es"
                    ? "Una capacidad planificada de DigitalBoost. Todavía no está disponible."
                    : "A planned DigitalBoost capability. Not available yet."}
                </p>
              </article>

              <article className="product-card product-card--planned">
                <div className="product-card__top">
                  <span>07</span>
                  <span className="product-status">{language === "es" ? "Planificado" : "Planned"}</span>
                </div>

                <h3>Nexus</h3>

                <p>
                  {language === "es"
                    ? "Un espacio planificado para conectar futuras experiencias de DigitalBoost."
                    : "A planned space to connect future DigitalBoost experiences."}
                </p>
              </article>
            </div>
          </div>
        </section>

        <FoundingJourney
          language={language}
          checkoutEnabled={checkoutEnabled}
        />

    </dialog>
  );
}
