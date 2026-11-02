import { useEffect, useRef } from 'react';
import FoundingJourney from './FoundingJourney';
import ProjectShowcase from './ProjectShowcase';
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
                    ? "CREÁ · VENDÉ · EXPLORÁ"
                    : "BUILD · SELL · EXPLORE"}
                </div>

                <h2 className="db-title">
                  {language === "es"
                    ? "Tu próximo proyecto empieza en OriginX Foundation."
                    : "Your next project starts at OriginX Foundation."}
                </h2>

                <p className="db-copy">
                  {language === "es"
                    ? "Un ecosistema para emprendedores, desarrolladores y creadores: tiendas online, diseño web, inteligencia artificial y juegos de Brain Boost. Conocé sus espacios y el estado de cada herramienta."
                    : "An ecosystem for entrepreneurs, developers and creators: online stores, web design, artificial intelligence and Brain Boost games. Explore its workspaces and each tool’s status."}
                </p>
              </div>

              <span className="truth-badge">
                {language === "es"
                  ? "ESTADO ACTUAL"
                  : "CURRENT STATE"}
              </span>
            </div>

            <ProjectShowcase language={language} />

            <h3 className="ox-project-status-heading">{es ? "Herramientas y estado de desarrollo" : "Tools and development status"}</h3>
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
                    ? "Organizá productos, pedidos y clientes. Store Builder forma parte de Commerce OS para diseñar tu tienda dentro del mismo espacio. En desarrollo activo."
                    : "Organize products, orders and customers. Store Builder is part of Commerce OS, letting you design your store in the same workspace. Under active development."}
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
                    ? "Diseñá sitios y landing pages con un canvas visual, estilos y vista previa responsive. Sky Workshop reúne las herramientas de edición en un espacio de desarrollo."
                    : "Design sites and landing pages with a visual canvas, styles and responsive preview. Sky Workshop brings editing tools into one development workspace."}
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
                    ? "Orquestación transversal de tareas y automatizaciones, con verificación y aprobación antes de ejecutar cambios. Incluye flujos del área comercial."
                    : "Cross-platform task and automation orchestration, with verification and approval before executing changes. Includes commerce workflows."}
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>04</span>
                  <span className="product-status product-status--active">
                    {language === "es"
                      ? "Demo local / En desarrollo"
                      : "Local demo / In development"}
                  </span>
                </div>

                <h3>Trading Islands</h3>

                <p>
                  {language === "es"
                    ? "Explorá mercados, carteras y bots en Exchange Harbor. La vista mostrada usa datos simulados y paper trading; no representa operaciones ni beneficios reales."
                    : "Explore markets, portfolios and bots in Exchange Harbor. The view shown uses simulated data and paper trading; it does not represent real trades or profits."}
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
                    ? "Prepará inteligencias, agentes, bots y workflows con una arquitectura visual. La ejecución requiere configurar modelos, proveedores y runtime; el espacio mostrado está en desarrollo."
                    : "Prepare intelligences, agents, bots and workflows with a visual architecture. Execution requires configuring models, providers and runtime; the workspace shown is under development."}
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
                    ? "Seguridad y supervisión previstas para el ecosistema. Se mantiene como capacidad planificada; no se ofrece como servicio disponible."
                    : "Planned ecosystem security and oversight. Remains a planned capability and is not offered as an available service."}
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
                    ? "Conexión prevista entre experiencias y espacios de la comunidad OriginX. Su alcance y disponibilidad se definirán durante el desarrollo."
                    : "Planned connections between OriginX experiences and community spaces. Scope and availability will be defined during development."}
                </p>
              </article>
              <article className="product-card">
                <div className="product-card__top"><span>08</span><span className="product-status product-status--active">{es ? 'Versión de desarrollo' : 'Development version'}</span></div>
                <h3>Brain Boost · Neural Arcade</h3>
                <p>{es ? 'Juegos de memoria, lógica, atención y orientación, más Neon Arena: Virus Survivor. Una propuesta recreativa con identidad visual propia por experiencia.' : 'Memory, logic, attention and spatial games, plus Neon Arena: Virus Survivor. Recreational experiences with their own visual identities.'}</p>
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
