import { useEffect, useState } from "react";
import "../../styles/originx-membership.css";

type Props = { language: "es" | "en" };

export default function FoundingMembership({ language }: Props) {
  const es = language === "es";
  const [compactBenefits, setCompactBenefits] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 599px)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 599px)");
    const update = () => setCompactBenefits(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);


  const benefits = [
    {
      number: "02",
      theme: "lavender",
      title: "Founding Member",
      description: es
        ? "Reconocimiento permanente como uno de los primeros 6.000 miembros verificados de OriginX Foundation."
        : "Permanent recognition as one of the first 6,000 verified members of OriginX Foundation.",
      note: es
        ? "El reconocimiento no equivale a acceso perpetuo."
        : "Recognition does not mean perpetual access.",
    },
    {
      number: "03",
      theme: "sky",
      title: es ? "Acceso beta prioritario" : "Priority beta access",
      description: es
        ? "Oportunidades anticipadas para acceder a funciones elegibles del producto a medida que estén disponibles."
        : "Earlier opportunities to access eligible product capabilities as they become available.",
      note: es
        ? "Sujeto a disponibilidad de cada programa."
        : "Subject to each program's availability.",
    },
    {
      number: "04",
      theme: "peach",
      title: es ? "Feedback de producto" : "Product feedback",
      description: es
        ? "Oportunidades para ayudar a orientar decisiones de producto mediante programas estructurados de feedback Founding."
        : "Opportunities to help shape product decisions through structured Founding feedback programs.",
      note: null,
    },
    {
      number: "05",
      theme: "green",
      title: es ? "Ecosistema conectado" : "Connected ecosystem",
      description: es
        ? "El reconocimiento Founding podrá reflejarse más adelante en experiencias elegibles del ecosistema y espacios de comunidad."
        : "Founding recognition may later appear across eligible ecosystem experiences and community spaces.",
      note: es
        ? "Una posibilidad futura, no una función ya entregada."
        : "A future possibility, not an already delivered feature.",
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
            {es ? "Identidad, acceso" : "Identity, access"}{" "}
            <span>{es ? "y comunidad." : "and community."}</span>
          </h2>
          <p>
            {es
              ? "Una identidad coleccionable y una membresía diseñada para acompañar tu participación en OriginX Foundation."
              : "A collectible identity and a membership designed to support your participation in OriginX Foundation."}
          </p>
        </header>

        <div className="ox-membership-grid">
          <article className="ox-membership-feature">
            <div className="ox-membership-feature-top">
              <span>01</span>
              <span>{es ? "ACCESO PRINCIPAL" : "CORE ACCESS"}</span>
            </div>

            <div className="ox-membership-duration" aria-hidden="true">
              <strong>12</strong>
              <span>{es ? "MESES" : "MONTHS"}</span>
            </div>

            <h3>{es ? "12 meses de Focus Founding Access" : "12 months of Focus Founding Access"}</h3>
            <p>
              {es
                ? "Cada membresía verificada está diseñada para incluir 12 meses desde la activación válida de la cuenta Founding Access."
                : "Each verified membership is designed to include 12 months from valid activation of the Founding Access account."}
            </p>

            <a className="ox-membership-feature-link" href="#ox-membership-lifecycle">
              {es ? "Cómo comienza tu acceso" : "How your access begins"}
              <span aria-hidden="true">↓</span>
            </a>
          </article>

          <div className="ox-membership-benefits">
            {benefits.map(benefit => (
              <details
                key={benefit.number}
                open={!compactBenefits}
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
              {es ? "Founding Focus no significa infraestructura ilimitada." : "Founding Focus does not mean unlimited infrastructure."}
            </h3>
            <p>
              {es
                ? "Pueden aplicar límites de DBX, uso razonable, inferencia de IA, cómputo, almacenamiento, hosting, runtime, Sentinel y otras restricciones técnicas o legales."
                : "DBX allowance, fair-use, AI inference, compute, storage, hosting, runtime, Sentinel and other technical or legal limits may apply."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
