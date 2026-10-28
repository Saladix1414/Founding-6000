import "../../styles/originx-journey.css";

type Props = {
  language: "es" | "en";
  checkoutEnabled: boolean;
};

export default function FoundingJourney({
  language,
  checkoutEnabled,
}: Props) {
  const es = language === "es";

  const steps = checkoutEnabled
    ? [
        {
          title: es ? "Tu email" : "Your email",
          text: es
            ? "Ingresá un email de contacto válido para comenzar."
            : "Enter a valid contact email to begin.",
        },
        {
          title: es ? "Revisá las condiciones" : "Review the terms",
          text: es
            ? "Consultá el tier, el precio de referencia y las condiciones."
            : "Check the tier, reference price and terms.",
        },
        {
          title: es ? "Elegí cómo pagar" : "Choose how to pay",
          text: es
            ? "Usá uno de los métodos disponibles en el checkout."
            : "Use one of the methods available at checkout.",
        },
        {
          title: es ? "Pago verificado" : "Verified payment",
          text: es
            ? "El sistema verifica el pago antes de confirmar tu asignación y membresía."
            : "The system verifies payment before confirming your allocation and membership.",
        },
      ]
    : [
        {
          title: es ? "Unite al prelaunch" : "Join prelaunch",
          text: es
            ? "Abrí el formulario para recibir novedades de Founding 6000."
            : "Open the form to receive Founding 6000 updates.",
        },
        {
          title: es ? "Dejá tu email" : "Enter your email",
          text: es
            ? "Registrá un email de contacto válido."
            : "Register a valid contact email.",
        },
        {
          title: es ? "Registro confirmado" : "Registration confirmed",
          text: es
            ? "El formulario confirma cuando tu registro se completa correctamente."
            : "The form confirms when your registration completes successfully.",
        },
      ];

  return (
    <section
      className="ox-landing ox-journey"
      aria-labelledby="ox-journey-title"
    >
      <div className="ox-journey__inner">
        <header className="ox-journey__heading">
          <div>
            <p className="ox-journey__eyebrow">
              {es ? "CÓMO FUNCIONA" : "HOW IT WORKS"}
            </p>
            <h2 id="ox-journey-title">
              {checkoutEnabled
                ? es
                  ? "Tu camino a Founding 6000."
                  : "Your path to Founding 6000."
                : es
                  ? "El primer paso es estar cerca."
                  : "Start by staying connected."}
            </h2>
          </div>
          <p className="ox-journey__intro">
            {checkoutEnabled
              ? es
                ? "Conocé cada paso antes de comenzar. La confirmación depende de la verificación del pago."
                : "Understand each step before you begin. Confirmation depends on payment verification."
              : es
                ? "Recibí novedades del lanzamiento. El registro de interés no crea una compra ni una reserva."
                : "Receive launch updates. Registering interest does not create a purchase or reservation."}
          </p>
        </header>

        <ol className={
          checkoutEnabled
            ? "ox-journey__steps ox-journey__steps--four"
            : "ox-journey__steps"
        }>
          {steps.map((step, index) => (
            <li className="ox-journey__step" key={step.title}>
              <span className="ox-journey__number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <p className="ox-journey__boundary">
          {checkoutEnabled
            ? es
              ? "Pago, membresía, entrega del NFT y activación del acceso son etapas distintas. Los 12 meses comienzan con la activación válida."
              : "Payment, membership, NFT delivery and access activation are separate stages. The 12 months begin on valid activation."
            : es
              ? "Registrarte no asigna un serial, no crea una membresía y no inicia los 12 meses de acceso."
              : "Registration does not assign a serial, create a membership or start the 12-month access period."}
        </p>
      </div>
    </section>
  );
}
