import "../../styles/originx-membership.css";
import "../../styles/originx-tier-popover.css";

type Props = { language: "es" | "en" };

export default function FoundingMembership({ language }: Props) {
  const es = language === "es";
  const benefits = [
    {
      number: "02",
      theme: "green",
      title: es ? "Suscripción transferible con tu NFT" : "Subscription transferable with your NFT",
      description: es
        ? "El acceso restante acompaña al NFT cuando se transfiere a otro titular válido. Podés ceder el tiempo que todavía quede de tu membresía, sujeto a la verificación de titularidad."
        : "Remaining access follows the NFT when transferred to another valid holder. You can pass on the unused portion of your membership, subject to ownership verification.",
      note: es
        ? "Se conserva el vencimiento original: transferir no genera otros 12 meses ni duplica el acceso."
        : "The original expiry is preserved: a transfer does not create another 12 months or duplicate access.",
    },
    {
      number: "03",
      theme: "lavender",
      title: "Founding Member",
      description: es
        ? "Reconocimiento permanente para las primeras 6.000 membresías verificadas. Las primeras 1.000 reciben además la distinción Genesis Member."
        : "Permanent recognition for the first 6,000 verified memberships. The first 1,000 also receive the Genesis Member distinction.",
      note: es
        ? "El reconocimiento no equivale a acceso perpetuo."
        : "Recognition does not mean perpetual access.",
    },
    {
      number: "04",
      theme: "sky",
      title: es ? "Acceso beta prioritario" : "Priority beta access",
      description: es
        ? "Oportunidades para probar antes determinadas funciones, a medida que estén disponibles."
        : "Opportunities to try selected features early as they become available.",
      note: es
        ? "Sujeto a disponibilidad de cada programa."
        : "Subject to each program's availability.",
    },
    {
      number: "05",
      theme: "peach",
      title: es ? "Participación y comunidad" : "Participation and community",
      description: es
        ? "Podés compartir ideas en los programas Founding. Más adelante, tu distinción podría aparecer en perfiles, Nexus y otros espacios de la comunidad."
        : "Share ideas through Founding programs. Your distinction could later appear on profiles, Nexus and other community spaces.",
      note: es ? "Las integraciones de reconocimiento siguen previstas." : "Recognition integrations are planned.",
    },
  ];

  const lifecycle = [
    {
      number: "01",
      title: es ? "Membresía verificada" : "Verified membership",
      description: es
        ? "Pago, asignación y elegibilidad se verifican por separado. Comprar no inicia automáticamente el período de acceso."
        : "Payment, allocation and eligibility are verified separately. Purchasing does not automatically start the access term.",
    },
    {
      number: "02",
      title: es ? "Activación válida" : "Valid activation",
      description: es
        ? "Los 12 meses comienzan al activar válidamente Founding Access, según la política vigente."
        : "The 12 months begin upon valid Founding Access activation under the applicable policy.",
    },
    {
      number: "03",
      title: es ? "Transferencia del NFT" : "NFT transfer",
      description: es
        ? "El titular válido recibe el acceso restante asociado al NFT. La transferencia no reinicia la duración."
        : "The valid holder receives the remaining access associated with the NFT. A transfer does not restart the term.",
    },
  ];

  return (
    <section
      id="benefits"
      className="ox-landing ox-membership"
      aria-labelledby="ox-membership-title"
    >
      <div className="ox-membership-inner">
        <header className="ox-membership-heading">
          <p className="ox-membership-eyebrow">
            {es ? "TU MEMBRESÍA FOUNDING" : "YOUR FOUNDING MEMBERSHIP"}
          </p>
          <h2 id="ox-membership-title">
            {es ? "Tu suscripción," : "Your subscription,"}{" "}
            <span>{es ? "conectada a tu NFT." : "connected to your NFT."}</span>
          </h2>
          <p>
            {es
              ? "Una pieza de colección, 12 meses de acceso desde la activación y reconocimiento en la comunidad Founding."
              : "A collectible, 12 months of access from activation, and recognition in the Founding community."}
          </p>
        </header>

        <div className="ox-membership-grid">
          <article className="ox-membership-feature">
            <div className="ox-membership-feature-top">
              <span>01</span>
              <span>{es ? "ACCESO PRINCIPAL" : "CORE ACCESS"}</span>
            </div>

            <h3>{es ? "12 meses de acceso a la web de tiendas y desarrollo" : "12 months of access to the stores and development website"}</h3>
            <p>
              {es
                ? "La membresía verificada está diseñada para incluir este acceso. Los 12 meses empiezan con la activación válida de tu cuenta Founding Access, no con la compra."
                : "Verified membership is designed to include this access. The 12 months start upon valid activation of your Founding Access account, not at purchase."}
            </p>


            <div className="ox-main-web-benefits">
              <h4>{es ? "Qué podés usar cuando esté disponible" : "What you can use as it becomes available"}</h4>
              <ul className="ox-membership-tools">
                <li><strong>Commerce OS</strong> {es ? "Tiendas online, gestión de productos y ventas, y herramientas de comercio descentralizado." : "Online stores, product and sales management, and decentralized commerce tools."}</li>
                <li><strong>Web Builder</strong> {es ? "Diseño y desarrollo de páginas web." : "Website design and development."}</li>
                <li><strong>IA Forge · PULSE</strong> {es ? "Creá asistentes y bots de IA con IA Forge. Usá PULSE para flujos de Commerce OS." : "Build AI assistants and bots with IA Forge. Use PULSE for Commerce OS workflows."}</li>
                <li><strong>Trading Islands</strong> {es ? "Herramientas previstas para desarrollar bots de trading." : "Planned tools for building trading bots."}</li>
                <li><strong>Brain Boost</strong> {es ? "Acceso a juegos del ecosistema." : "Access to games in the ecosystem."}</li>
                <li><strong>{es ? "Marketing y crecimiento" : "Marketing and growth"}</strong> {es ? "Herramientas de marketing, SEO y analítica." : "Marketing, SEO and analytics tools."}</li>
              </ul>
              <small>{es ? "Herramientas previstas para el ecosistema; el acceso depende de su disponibilidad, habilitación y límites del plan." : "Planned ecosystem tools; access depends on availability, activation and plan limits."}</small>
            </div>

            <p className="ox-membership-collectible">{es ? "Tu NFT incluye una pieza única con metadata, ADN visual, glifo de resonancia y registro akáshico." : "Your NFT includes a unique collectible with metadata, visual DNA, a resonance glyph and an Akashic record."}</p>

            <a className="ox-membership-feature-link" href="#ox-membership-lifecycle">
              {es ? "Cómo comienza tu acceso" : "How your access begins"}
              <span aria-hidden="true">↓</span>
            </a>
          </article>

          <div className="ox-membership-benefits">
            {benefits.map(benefit => (
              <details
                key={benefit.number}
                className={"ox-membership-benefit ox-membership-benefit--" + benefit.theme}
              >
                <summary className="ox-membership-benefit-summary">
                  <span className="ox-membership-index" aria-hidden="true">
                    {benefit.number}
                  </span>
                  <h3>{benefit.title}</h3>
                  <span className="ox-membership-benefit-toggle" aria-hidden="true" />
                </summary>
                <div className="ox-membership-benefit-description">
                  <p>{benefit.description}</p>
                  {benefit.note && <small>{benefit.note}</small>}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="ox-membership-lifecycle" id="ox-membership-lifecycle">
          <h3>{es ? "Tu acceso, paso a paso." : "Your access, step by step."}</h3>
          <ol>
            {lifecycle.map(step => (
              <li key={step.number}>
                <span aria-hidden="true">{step.number}</span>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>

        <details className="ox-membership-example">
          <summary>
            {es ? "Ejemplo: ¿qué pasa si transfiero el NFT?" : "Example: what happens if I transfer the NFT?"}
          </summary>
          <div>
            <p>
              {es
                ? "Si se activaron 12 meses y la transferencia ocurre después de aproximadamente 4 meses, el nuevo titular recibe aproximadamente 8 meses restantes."
                : "If 12 months were activated and the transfer happens after approximately 4 months, the new holder receives approximately 8 months remaining."}
            </p>
            <p>
              {es
                ? "La fecha de vencimiento se conserva. El plazo exacto depende de las fechas registradas y de la verificación de titularidad; este ejemplo no confirma una operación real."
                : "The expiry date is preserved. The exact remaining term depends on recorded dates and ownership verification; this example does not confirm an actual operation."}
            </p>
          </div>
        </details>

        <aside className="ox-membership-boundary">
          <span className="ox-membership-boundary-icon" aria-hidden="true">i</span>
          <div>
            <h3>
              {es ? "El acceso tiene límites de uso." : "Access has usage limits."}
            </h3>
            <p>
              {es
                ? "Pueden aplicar límites de DBX, uso razonable, inferencia de IA, cómputo, almacenamiento, hosting, runtime, Sentinel y otras restricciones técnicas o legales."
                : "DBX allowance, fair-use, AI inference, compute, storage, hosting, runtime, Sentinel and other technical or legal limits may apply."}
            </p>
          </div>
        </aside>
        <div className="ox-membership-example">
          <div style={{paddingTop:18}}>
            <h3>{es ? "Cómo funciona la reserva comunitaria" : "How community reserves work"}</h3>
            <p>{es ? "El modelo destina el 50% de las ventas iniciales verificadas a la reserva comunitaria. El análisis contempla además aportar un 15% del beneficio neto futuro del negocio, si se obtiene y se aprueba esa política. El rescate futuro tiene reglas propias y la compra no lo activa. Ese aporte adicional no es un cargo extra ni una distribución automática." : "The model allocates 50% of verified initial sales to community reserves. The analysis also considers contributing 15% of future net business profit, if earned and that policy is approved. Future redemption has separate rules and purchase does not activate it. This additional contribution is neither an extra charge nor an automatic distribution."}</p>
            <a className="ox-membership-feature-link" href="#ox-business-reserve-scenario">{es ? "Explorar los escenarios de crecimiento de reservas" : "Explore reserve growth scenarios"}<span aria-hidden="true">↑</span></a>
          </div>
        </div>
      </div>
    </section>
  );
}
