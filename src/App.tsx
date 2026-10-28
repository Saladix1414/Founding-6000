import FoundingJourney from "./components/landing/FoundingJourney";
import FoundingMembership from "./components/landing/FoundingMembership";
import FoundationEconomy, { scrollToEconomy } from "./components/landing/FoundationEconomy";
import FoundingCollection from "./components/landing/FoundingCollection";
import CommercialCards from "./components/landing/CommercialCards";
import HeroArtwork from "./components/landing/HeroArtwork";
import FoundingHeroCopy from "./components/landing/FoundingHeroCopy";
import OriginXNavbar from "./components/landing/OriginXNavbar";
import { useEffect, useRef, useState } from "react";
import UsdtPaymentPanel from "./components/UsdtPaymentPanel";
import NftEconomyPanel from "./components/NftEconomyPanel";
import EconomicOperationsPanel from "./components/EconomicOperationsPanel";

import {
  registerPrelaunchEmail,
  type FoundingPaymentResult,
} from "./lib/foundingApi";

import "./App.css";
import "./styles/originx-checkout.css";
import "./styles/originx-faq-footer.css";
import "./styles/originx-continuity.css";
import "./styles/originx-hero-background.css";
import "./styles/originx-hero-artwork.css";
import { DigitalBoostWhitepaper } from "./whitepaper/DigitalBoostWhitepaper";



type Language =
  | "en"
  | "es";



type CheckoutStep =
  | "email"
  | "confirm"
  | "method"
  | "details"
  | "complete";

type PaymentMethod =
  | "mercado-pago"
  | "naranja-x"
  | "usdt"
  | null;

type CampaignPhase = {
  number: string;
  name: string;
  capacity: number;
  price: number;
  range: string;
  status: string;
  active?: boolean;
};

const phases: CampaignPhase[] = [
  {
    number: "01",
    name: "RARE",
    capacity: 1000,
    price: 50,
    range: "#0001–#1000",
    status: "OriginX · RARE",
    active: true,
  },
  {
    number: "02",
    name: "EPIC",
    capacity: 2000,
    price: 70,
    range: "#1001–#3000",
    status: "OriginX · EPIC",
  },
  {
    number: "03",
    name: "GENESIS",
    capacity: 3000,
    price: 90,
    range: "#3001–#6000",
    status: "OriginX · GENESIS",
  },
];





function App() {
  const [
    publicCheckoutEnabled,
    setPublicCheckoutEnabled,
  ] = useState(false);

  const [language, setLanguage] =
    useState<Language>(() => {
      const saved =
        window.localStorage.getItem(
          "founding6000-language",
        );

      return saved === "es"
        ? "es"
        : "en";
    });



  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [galleryOpen, setGalleryOpen] =
    useState(false);

  const [whitepaperOpen, setWhitepaperOpen] =
    useState(false);

  const [galleryPreview, setGalleryPreview] =
    useState<{
      name: string;
      src: string;
    } | null>(null);

  const [checkoutOpen, setCheckoutOpen] =
    useState(false);

  const [checkoutStep, setCheckoutStep] =
    useState<CheckoutStep>("email");

  const [email, setEmail] =
    useState("");

  const [emailError, setEmailError] =
    useState("");

  const [
    emailSubmitting,
    setEmailSubmitting,
  ] =
    useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(null);

  const [
    verifiedPurchase,
    setVerifiedPurchase,
  ] =
    useState<
      FoundingPaymentResult |
      null
    >(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveCheckout() {
      try {
        const response =
          await fetch(
            "/api/health",
            {
              headers: {
                Accept:
                  "application/json",
              },
            },
          );

        if (!response.ok) {
          return;
        }

        const health =
          await response.json();

        if (cancelled) {
          return;
        }

        setPublicCheckoutEnabled(
          health?.checkout === "open" &&
          health?.payments === "enabled" &&
          health?.paymentReadiness === true &&
          health?.realPaymentsEnabled === true,
        );
      } catch {
        /*
         * Fail closed.
         */
      }
    }

    void resolveCheckout();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "founding6000-language",
      language,
    );

    document.documentElement.lang =
      language;
  }, [language]);








  const primaryCtaLabel =
    publicCheckoutEnabled
      ? language === "es"
        ? "Comprar ahora"
        : "Purchase Now"
      : language === "es"
        ? "Recibir novedades"
        : "Get launch updates";

  useEffect(() => {
    if (!checkoutOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setCheckoutOpen(false);

        window.setTimeout(() => {
          previousFocusRef.current?.focus();
        }, 0);

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const modal =
        document.querySelector<HTMLElement>(
          ".checkout-modal",
        );

      if (!modal) {
        return;
      }

      const focusable =
        Array.from(
          modal.querySelectorAll<HTMLElement>(
            [
              "button:not([disabled])",
              "input:not([disabled])",
              "a[href]",
              "select:not([disabled])",
              "textarea:not([disabled])",
              '[tabindex]:not([tabindex="-1"])',
            ].join(","),
          ),
        ).filter(
          (element) =>
            element.offsetParent !== null,
        );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last =
        focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [checkoutOpen]);

  useEffect(() => {
    if (!galleryOpen) {
      return;
    }

    const handleGalleryKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        if (galleryPreview) {
          setGalleryPreview(null);
          return;
        }

        setGalleryOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleGalleryKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleGalleryKeyDown,
      );
    };
  }, [galleryOpen, galleryPreview]);

  useEffect(() => {
    if (!whitepaperOpen) return;

    const panel = document.getElementById("project-whitepaper-panel");
    if (!panel) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    panel.querySelector<HTMLButtonElement>(
      ".project-whitepaper__close",
    )?.focus({ preventScroll: true });

    const handleWhitepaperKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setWhitepaperOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(element => element.getClientRects().length > 0);

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const active = document.activeElement;
      if (
        !panel.contains(active) ||
        (event.shiftKey && (active === first || active === panel))
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleWhitepaperKeyDown);

    return () => {
      document.removeEventListener("keydown", handleWhitepaperKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [whitepaperOpen]);

  const closeMenu = () => {
    setMobileMenuOpen(false);
  };

  const openCheckout = () => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    closeMenu();
    setCheckoutOpen(true);
    setCheckoutStep("email");
    setEmailError("");
    setEmailSubmitting(false);
    setPaymentMethod(null);
    setVerifiedPurchase(null);
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);

    window.setTimeout(() => {
      previousFocusRef.current?.focus();
    }, 0);
  };

  const submitEmail = async () => {
    if (emailSubmitting) {
      return;
    }

    const normalizedEmail =
      email.trim();

    const validEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail,
      );

    if (!validEmail) {
      setEmailError(
        language === "es"
          ? "Ingresá un email válido para continuar."
          : "Enter a valid email address to continue.",
      );

      return;
    }

    setEmail(
      normalizedEmail,
    );

    setEmailError("");

    /*
     * Public prelaunch mode:
     *
     * Register interest only.
     * Do not create an order and do not initialize
     * any payment method.
     */
    if (
      !publicCheckoutEnabled
    ) {
      setEmailSubmitting(
        true,
      );

      try {
        await registerPrelaunchEmail(
          normalizedEmail,
        );

        setPaymentMethod(
          null,
        );

        setCheckoutStep(
          "complete",
        );
      } catch {
        setEmailError(
          language === "es"
            ? "No pudimos registrar tu email en este momento. Intentá nuevamente."
            : "We could not register your email right now. Please try again.",
        );
      } finally {
        setEmailSubmitting(
          false,
        );
      }

      return;
    }

    setCheckoutStep(
      "confirm",
    );
  };

  const choosePaymentMethod = (
    method: Exclude<PaymentMethod, null>,
  ) => {
    setPaymentMethod(method);
    setCheckoutStep("details");
  };

  const resetCheckout = () => {
    setCheckoutStep("email");
    setEmail("");
    setEmailError("");
    setEmailSubmitting(false);
    setPaymentMethod(null);
    setVerifiedPurchase(null);
  };



  return (
    <div className="campaign">
      <OriginXNavbar
        language={language}
        onLanguageChange={setLanguage}
        ctaLabel={primaryCtaLabel}
        onCheckout={openCheckout}
        onEconomy={scrollToEconomy}
        menuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen((current) => !current)}
        onCloseMenu={closeMenu}
      />

      {galleryPreview && (
        <div
          className="project-gallery-preview"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setGalleryPreview(null);
            }
          }}
        >
          <div
            className="project-gallery-preview__dialog"
            role="dialog"
            aria-modal="true"
            aria-label={galleryPreview.name}
          >
            <button
              type="button"
              className="project-gallery-preview__close"
              aria-label={
                language === "es"
                  ? "Cerrar imagen"
                  : "Close image"
              }
              onClick={() =>
                setGalleryPreview(null)
              }
            >
              ×
            </button>

            <img
              src={galleryPreview.src}
              alt={galleryPreview.name}
            />

            <strong>
              {galleryPreview.name}
            </strong>
          </div>
        </div>
      )}

      {whitepaperOpen && (
        <div
          className="project-whitepaper-layer"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setWhitepaperOpen(false);
            }
          }}
        >
          <div className="db-container project-whitepaper-layer__inner">
            <DigitalBoostWhitepaper
              language={language}
              onClose={() =>
                setWhitepaperOpen(false)
              }
            />
          </div>
        </div>
      )}

      <main id="top">
        <section
          className="campaign-hero ox-landing ox-hero-stage"
          id="campaign"
        >
          <div className="ox-hero-landscape" aria-hidden="true" />



          <div className="db-container campaign-hero__grid">
            <FoundingHeroCopy
              language={language}
              ctaLabel={primaryCtaLabel}
              onCheckout={openCheckout}
            />

            <HeroArtwork language={language} />
          </div>

          <div className="db-container project-dock">
            <div className="project-dock__rail">
              <div className="project-dock__buttons">
                <button
                  type="button"
                  className={
                    galleryOpen
                      ? "project-dock__button is-active"
                      : "project-dock__button"
                  }
                  aria-expanded={galleryOpen}
                  aria-controls="project-gallery-panel"
                  onClick={() => {
                    setGalleryPreview(null);
                    setWhitepaperOpen(false);
                    setGalleryOpen(current => !current);
                  }}
                >
                  <span
                    className="project-dock__icon"
                    aria-hidden="true"
                  >
                    ▦
                  </span>

                  <span>
                    {language === "es"
                      ? "Ver galería"
                      : "View gallery"}
                  </span>

                  <span
                    className="project-dock__arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    whitepaperOpen
                      ? "project-dock__button is-active"
                      : "project-dock__button"
                  }
                  aria-expanded={whitepaperOpen}
                  aria-controls="project-whitepaper-panel"
                  onClick={() => {
                    setGalleryPreview(null);
                    setGalleryOpen(false);
                    setWhitepaperOpen(
                      (current) => !current,
                    );
                  }}
                >
                  <span
                    className="project-dock__icon"
                    aria-hidden="true"
                  >
                    ◫
                  </span>

                  <span>

                    {language === "es" ? "Leer whitepaper" : "Read whitepaper"}
                  </span>

                  <span
                    className="project-dock__arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
              </div>

              {galleryOpen && (
                <aside
                  id="project-gallery-panel"
                  className="project-gallery-panel"
                  aria-label={
                    language === "es"
                      ? "Galería de la colección"
                      : "Collection gallery"
                  }
                >
                  <header className="project-gallery-panel__header">
                    <div>
                      <span>
                        ORIGINX FOUNDATION
                      </span>

                      <strong>
                        {language === "es"
                          ? "Galería de la colección"
                          : "Collection gallery"}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="project-gallery-panel__close"
                      aria-label={
                        language === "es"
                          ? "Cerrar galería"
                          : "Close gallery"
                      }
                      onClick={() => {
                        setGalleryPreview(null);
                        setGalleryOpen(false);
                      }}
                    >
                      ×
                    </button>
                  </header>

                  <p className="project-gallery-panel__intro">
  {language === "es"
    ? "Seis representaciones conceptuales de nuestra colección. Tocá una imagen para ampliarla. Arte promocional; no acredita emisión onchain."
    : "Six concept representations of our collection. Select an image to enlarge it. Promotional artwork; not proof of onchain issuance."}
</p>

                  <div className="project-gallery-grid">
                    {[
[
  language === "es" ? "RARE · Guardián del océano" : "RARE · Ocean guardian",
  "/nft-gallery/rare-ocean.png",
],
[
  language === "es" ? "RARE · Guardián del bosque" : "RARE · Forest guardian",
  "/nft-gallery/rare-forest.png",
],
[
  language === "es" ? "EPIC · Tormenta amatista" : "EPIC · Amethyst storm",
  "/nft-gallery/epic-amethyst.png",
],
[
  language === "es" ? "EPIC · Brasa carmesí" : "EPIC · Crimson ember",
  "/nft-gallery/epic-ember.png",
],
[
  language === "es" ? "LEGENDARY · Soberano solar" : "LEGENDARY · Solar sovereign",
  "/nft-gallery/legendary-solar.png",
],
[
  language === "es" ? "LEGENDARY · Soberano astral" : "LEGENDARY · Astral sovereign",
  "/nft-gallery/legendary-astral.png",
]
].map(([name, src]) => (
                      <button
                        className="project-gallery-card"
                        key={name}
                        type="button"
                        onClick={() =>
                          setGalleryPreview({
                            name,
                            src,
                          })
                        }
                      >
                        <img
                          src={src}
                          alt={name}
                          loading="lazy"
                        />

                        <span className="project-gallery-card__caption">
                          {name}
                        </span>
                      </button>
                    ))}
                  </div>

                </aside>
              )}
            </div>
          </div>
        </section>
        <CommercialCards
          language={language}
          onEconomy={scrollToEconomy}
        />


        <section
          className="ox-landing ox-allocation-status"
          aria-labelledby="ox-allocation-title"
        >
          <div className="ox-allocation-inner">
            <div>
              <h2 id="ox-allocation-title">
                {language === "es"
                  ? "Asignación de membresías Founding"
                  : "Founding membership allocation"}
              </h2>
              <p>
                {language === "es"
                  ? "Los datos verificados de asignación todavía no están disponibles en esta sección."
                  : "Verified allocation data is not yet available in this section."}
              </p>
            </div>
            <span className="ox-allocation-label">
              {language === "es" ? "Datos no disponibles" : "Data unavailable"}
            </span>
          </div>
        </section>

        <FoundingCollection
          language={language}
          phases={phases}
          ctaLabel={primaryCtaLabel}
          onCheckout={openCheckout}
        />
        <FoundationEconomy language={language} />

        <FoundingMembership language={language} />

        <EconomicOperationsPanel
        language={
          language
        }
      />

        <section className="genesis-section ox-landing ox-genesis">
          <div className="db-container genesis-layout">
            <div className="genesis-visual">
              <span className="genesis-visual__eyebrow">
                {language === "es"
                  ? "PRIMEROS 1.000"
                  : "FIRST 1,000"}
              </span>

              <strong className="genesis-visual__number">
                #0001
                <span>—</span>
                #1000
              </strong>

              <div className="genesis-visual__line" />

              <span className="genesis-visual__footer">
                {language === "es"
                  ? "Distinción Genesis"
                  : "Genesis distinction"}
              </span>
            </div>

            <div className="genesis-copy">
              <div className="db-eyebrow">
                Genesis Member
              </div>

              <h2 className="db-title">
                {language === "es"
                  ? "Los primeros mil llevan una distinción única."
                  : "The first thousand carry a distinct mark."}
              </h2>

              <p className="db-copy">
                {language === "es"
                  ? "Las primeras 1.000 membresías verificadas reciben la distinción Genesis Member además del estatus Founding Member."
                  : "The first 1,000 verified memberships receive Genesis Member distinction in addition to Founding Member status."}
              </p>

              <div className="genesis-points">
                <div>
                  <span>01</span>

                  <p>
                    {language === "es"
                      ? "Distinción Genesis permanente asociada al registro de membresía Founding."
                      : "Permanent Genesis distinction attached to the founding membership record."}
                  </p>
                </div>

                <div>
                  <span>02</span>

                  <p>
                    {language === "es"
                      ? "Posible reconocimiento futuro en perfiles, Nexus y espacios de comunidad."
                      : "Potential future recognition across profile, Nexus and community surfaces."}
                  </p>
                </div>

                <div>
                  <span>03</span>

                  <p>
                    {language === "es"
                      ? "El estatus Genesis no implica participación accionaria, condición de fundador de la empresa, gobernanza ni derechos financieros."
                      : "Genesis status does not imply equity, company founder status, governance or financial rights."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

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
          checkoutEnabled={publicCheckoutEnabled}
        />

        <section
          className="db-section faq-section ox-landing ox-faq"
          id="faq"
        >
          <div className="db-container faq-layout">
            <div className="faq-heading">
              <div className="db-eyebrow">
                FAQ
              </div>

              <h2 className="db-title">
                {language === "es"
                  ? "Todo claro antes de avanzar."
                  : "Clear before you commit."}
              </h2>

              <p className="db-copy">
                {language === "es"
                  ? "Qué incluye la propuesta, cuándo empieza el acceso y cuáles son las condiciones."
                  : "What the offer includes, when access starts and which terms apply."}
              </p>
            </div>

            <div className="faq-list">
              <details>
                <summary>
                  {language === "es"
                    ? "¿Qué estoy comprando exactamente?"
                    : "What exactly am I purchasing?"}
                </summary>

                <p>
                  {language === "es"
                    ? "Una preorden o reserva de Founding 6000, diseñada para incluir 12 meses de Focus Founding Access desde la activación válida de la cuenta. Está sujeta a los términos finales publicados y a límites técnicos. Registrarte para recibir novedades no equivale a comprar."
                    : "A Founding 6000 product pre-order or reservation, designed to include 12 months of Focus Founding Access from valid account activation. Final published terms and technical limits apply. Signing up for updates is not a purchase."}
                </p>
              </details>

              <details>
                <summary>
                  {language === "es"
                    ? "¿Founding 6000 es una inversión?"
                    : "Is Founding 6000 an investment?"}
                </summary>

                <p>
                  {language === "es"
                    ? "No. No representa acciones, valores financieros, propiedad de la empresa, participación en ingresos, retorno financiero ni gobernanza corporativa."
                    : "No. It is not equity, a security, company ownership, revenue sharing, financial return or corporate governance."}
                </p>
              </details>

              <details>
                <summary>
                  {language === "es"
                    ? "¿Cuándo comienzan mis 12 meses?"
                    : "When do my 12 months begin?"}
                </summary>

                <p>
                  {language === "es"
                    ? "Con la activación válida de tu cuenta Founding Access. Comprar o registrarte para recibir novedades no inicia los 12 meses."
                    : "Upon valid activation of your Founding Access account. Purchasing or signing up for updates does not start the 12 months."}
                </p>
              </details>

              <details>
                <summary>
                  {language === "es"
                    ? "¿El 5 de enero de 2027 está garantizado?"
                    : "Is January 5, 2027 guaranteed?"}
                </summary>

                <p>
                  {language === "es"
                    ? "No. El 5 de enero de 2027 es una fecha objetivo de lanzamiento, sujeta a cambios. No es una fecha de entrega garantizada."
                    : "No. January 5, 2027 is a target launch date, subject to change. It is not a guaranteed delivery date."}
                </p>
              </details>

              <details>
                <summary>
                  {language === "es"
                    ? "¿Focus incluye uso ilimitado?"
                    : "Does Focus include unlimited usage?"}
                </summary>

                <p>
                  {language === "es"
                    ? "No. Pueden aplicar límites de DBX, uso razonable, cómputo, infraestructura, inferencia de IA, almacenamiento, hosting, bot/runtime y otras restricciones técnicas o legales."
                    : "No. DBX allowance, fair-use, compute, infrastructure, AI inference, storage, hosting, bot/runtime and other technical or legal limits may apply."}
                </p>
              </details>

              <details>
                <summary>
                  {language === "es"
                    ? "¿Cómo voy a poder pagar?"
                    : "How will I be able to pay?"}
                </summary>

                <p>
                  {publicCheckoutEnabled
                    ? language === "es"
                      ? "El formulario de compra permite elegir USDT en Ethereum Mainnet. Revisá allí la red, el importe y la dirección de destino antes de transferir. Los métodos en pesos todavía no están habilitados."
                      : "Checkout offers USDT on Ethereum Mainnet. Review the network, amount and destination address there before transferring. Peso payment methods are not enabled yet."
                    : language === "es"
                      ? "Las reservas y los pagos todavía no están habilitados en esta página. Podés dejar tu email para recibir novedades de la apertura."
                      : "Reservations and payments are not yet enabled on this page. You can leave your email for updates about opening."}
                </p>

                <p>
                  {language === "es"
                    ? "El plan contempla Mercado Pago para pagos en pesos argentinos. Naranja X depende de que se verifique una integración oficial adecuada. No hay una fecha de disponibilidad confirmada para estos métodos."
                    : "The plan includes Mercado Pago for Argentine peso payments. Naranja X depends on verification of a suitable official integration. Availability dates for these methods are not confirmed."}
                </p>
              </details>

              <details>
                <summary>
                  {language === "es"
                    ? "¿Qué sucede si el producto se retrasa?"
                    : "What happens if the product is delayed?"}
                </summary>

                <p>
                  {language === "es"
                    ? "Las condiciones de retrasos, reembolsos, cancelaciones y entrega deberán estar finalizadas y publicadas antes de habilitar pagos reales."
                    : "Delay handling, refund, cancellation and delivery terms must be finalized and published before real payments are enabled."}
                </p>
              </details>
            </div>
          </div>
        </section>


      </main>

      <footer className="founding-footer ox-landing ox-public-footer">
        <div className="db-container founding-footer-inner">
          <div>
            <strong>OriginX Foundation</strong>
            <p>
              {language === "es"
                ? "Founding 6000 · Programa de preorden / reserva."
                : "Founding 6000 · Pre-order / reservation program."}
            </p>
          </div>

          <nav
            className="footer-legal-links"
            aria-label="Legal"
          >
            <a
              href="/legal/terms.html"
              target="_blank"
              rel="noreferrer"
            >
              {language === "es" ? "Términos" : "Terms"}
            </a>

            <a
              href="/legal/privacy.html"
              target="_blank"
              rel="noreferrer"
            >
              {language === "es" ? "Privacidad" : "Privacy"}
            </a>

            <a
              href="/legal/refunds.html"
              target="_blank"
              rel="noreferrer"
            >
              {language === "es" ? "Reembolsos" : "Refunds"}
            </a>
          </nav>
        </div>
      </footer>


      {checkoutOpen && (
        <div
          className="checkout-overlay ox-checkout-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCheckout();
            }
          }}
        >
          <section
            className="checkout-modal ox-landing ox-checkout"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            aria-describedby="checkout-prototype-note"
          >
            <header className="checkout-header">
              <div>
                <span className="checkout-header__eyebrow">
                  {publicCheckoutEnabled
                    ? language === "es"
                      ? "FOUNDING 6000 · COMPRA"
                      : "FOUNDING 6000 · CHECKOUT"
                    : language === "es"
                      ? "FOUNDING 6000 · PRELANZAMIENTO"
                      : "FOUNDING 6000 · PRELAUNCH"}
                </span>

                <strong id="checkout-title">
                  {publicCheckoutEnabled
                    ? language === "es"
                      ? "Comprar reserva"
                      : "Purchase reservation"
                    : language === "es"
                      ? "Unite a las novedades del lanzamiento"
                      : "Join launch updates"}
                </strong>
              </div>

              <button
                className="checkout-close"
                type="button"
                aria-label={
                  language === "es"
                    ? "Cerrar ventana"
                    : "Close checkout"
                }
                onClick={closeCheckout}
              >
                ×
              </button>
            </header>

            <p
              id="checkout-prototype-note"
              className="sr-only"
            >
              {publicCheckoutEnabled
                ? language === "es"
                  ? "Proceso de compra de Founding 6000."
                  : "Founding 6000 checkout."
                : language === "es"
                  ? "Las reservas públicas y los pagos todavía no están habilitados."
                  : "Public reservations and payments are not open yet."}
            </p>

            <div
              className={
                publicCheckoutEnabled
                  ? "checkout-progress"
                  : "checkout-progress checkout-progress--prelaunch"
              }
            >
              {[
                "email",
                "confirm",
                "method",
                "details",
              ].map((step, index) => {
                const order = [
                  "email",
                  "confirm",
                  "method",
                  "details",
                  "complete",
                ];

                const activeIndex =
                  order.indexOf(checkoutStep);

                return (
                  <span
                    key={step}
                    className={
                      index <= activeIndex
                        ? "checkout-progress__item checkout-progress__item--active"
                        : "checkout-progress__item"
                    }
                  />
                );
              })}
            </div>

            <div className="checkout-body">
              {checkoutStep === "email" && (
                <div className="checkout-step">
                  <span className="checkout-step__number">
                    {publicCheckoutEnabled
                      ? language === "es" ? "PASO 01 / 04" : "STEP 01 / 04"
                      : language === "es" ? "NOVEDADES DEL LANZAMIENTO" : "LAUNCH UPDATES"}
                  </span>

                  <h2>
                    {publicCheckoutEnabled
                      ? language === "es"
                        ? "Empezá con tu email."
                        : "Start with your email."
                      : language === "es"
                        ? "Dejá tu email."
                        : "Leave your email."}
                  </h2>

                  <p>
                    {publicCheckoutEnabled
                      ? (
                        <>
                          {language === "es"
                            ? "Necesitamos tu email para iniciar la reserva y enviarte confirmaciones, novedades del lanzamiento e información de activación."
                            : "We need your email to start the reservation and send confirmations, launch updates and activation information."}
                        </>
                      )
                      : (
                        <>
                          {language === "es"
                            ? "Recibí novedades de Founding 6000 y enterate cuando abran las reservas. Registrarte no crea una reserva, una membresía ni una obligación de pago."
                            : "Get Founding 6000 updates and hear when reservations open. Signing up does not create a reservation, membership or payment obligation."}
                        </>
                      )}
                  </p>

                  <label className="checkout-field">
                    <span>{language === "es" ? "Tu email" : "Your email"}</span>

                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      placeholder={language === "es" ? "tu@email.com" : "you@example.com"}
                      value={email}
                      disabled={emailSubmitting}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setEmailError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          submitEmail();
                        }
                      }}
                    />
                  </label>

                  {emailError && (
                    <p
                      className="checkout-error"
                      role="alert"
                    >
                      {emailError}
                    </p>
                  )}

                  <div className="checkout-info">
                    <span aria-hidden="true">i</span>

                    <p>
                      {publicCheckoutEnabled
                        ? (
                          <>
                            {language === "es"
                              ? "Tu email sirve para contactarte. No verifica tu identidad ni acredita un pago."
                              : "Your email lets us contact you. It does not verify your identity or prove payment."}
                          </>
                        )
                        : (
                          <>
                            {language === "es"
                              ? "Este registro solo expresa tu interés. No guarda un lugar en la colección ni reserva un número de NFT."
                              : "This signup only records your interest. It does not hold a place in the collection or reserve an NFT number."}
                          </>
                        )}
                    </p>
                  </div>

                  <button
                    className="db-button db-button--primary checkout-main-button"
                    type="button"
                    disabled={emailSubmitting}
                    onClick={submitEmail}
                  >
                    {emailSubmitting
                      ? language === "es" ? "Registrando…" : "Registering…"
                      : publicCheckoutEnabled
                        ? language === "es" ? "Continuar" : "Continue"
                        : language === "es" ? "Recibir novedades" : "Get launch updates"}

                    <span aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>
              )}

              {publicCheckoutEnabled && checkoutStep === "confirm" && (
                <div className="checkout-step">
                  <span className="checkout-step__number">
                    {language === "es" ? "PASO 02 / 04" : "STEP 02 / 04"}
                  </span>

                  <h2>
                    {language === "es" ? "Revisá tu reserva." : "Review your reservation."}
                  </h2>

                  <p>
                    {language === "es"
                      ? "Revisá la categoría, el precio y las condiciones antes de elegir cómo pagar."
                      : "Review the category, price and terms before choosing how to pay."}
                  </p>

                  <div className="checkout-summary">
                    <div>
                      <span>Email</span>
                      <strong>{email}</strong>
                    </div>

                    <div>
                      <span>
                        {language === "es"
                          ? "Categoría"
                          : "Category"}
                      </span>
                      <strong>RARE</strong>
                    </div>

                    <div>
                      <span>
                        {language === "es"
                          ? "Números de la categoría"
                          : "Category number range"}
                      </span>
                      <strong>#0001–#1000</strong>
                    </div>

                    <div>
                      <span>
                        {language === "es"
                          ? "Precio de venta inicial"
                          : "Initial sale price"}
                      </span>
                      <strong>50 USDT</strong>
                    </div>

                    <div>
                      <span>{language === "es" ? "Acceso" : "Access"}</span>
                      <strong>
                        {language === "es"
                          ? "12 meses de Focus Founding Access desde la activación válida"
                          : "12 months of Focus Founding Access from valid activation"}
                      </strong>
                    </div>
                  </div>

                  <div className="checkout-disclosure">
                    <strong>
                      {language === "es" ? "Condiciones de preventa" : "Pre-sale terms"}
                    </strong>

                    <p>
                      {language === "es"
                        ? "Founding 6000 es una preorden o reserva de producto. No es una inversión, no otorga acciones ni propiedad de la empresa, no es un valor financiero ni un programa de participación en ingresos. El 5 de enero de 2027 es una fecha objetivo de lanzamiento, no una fecha de entrega garantizada."
                        : "Founding 6000 is a product pre-order or reservation. It is not an investment, equity, company ownership, a security or a revenue-sharing program. January 5, 2027 is a target launch date, not a guaranteed delivery date."}
                    </p>
                  </div>

                  <div className="checkout-actions">
                    <button
                      className="db-button db-button--secondary"
                      type="button"
                      onClick={() =>
                        setCheckoutStep("email")
                      }
                    >
                      {language === "es" ? "Volver" : "Back"}
                    </button>

                    <button
                      className="db-button db-button--primary"
                      type="button"
                      onClick={() =>
                        setCheckoutStep("method")
                      }
                    >
                      {language === "es" ? "Entendido · Continuar" : "I understand · Continue"}
                    </button>
                  </div>
                </div>
              )}

              {publicCheckoutEnabled && checkoutStep === "method" && (
                <div className="checkout-step">
                  <span className="checkout-step__number">
                    {language === "es" ? "PASO 03 / 04" : "STEP 03 / 04"}
                  </span>

                  <h2>
                    {language === "es"
                      ? "Elegí un método de pago."
                      : "Choose a payment method."}
                  </h2>

                  <p>
                    {language === "es"
                      ? "Podés elegir USDT en Ethereum Mainnet. Los métodos en pesos todavía no están habilitados."
                      : "You can choose USDT on Ethereum Mainnet. Peso payment methods are not enabled yet."}
                  </p>

                  <div className="payment-methods">
                    <button
                      className="payment-method payment-method--available"
                      type="button"
                      onClick={() =>
                        choosePaymentMethod(
                          "usdt",
                        )
                      }
                    >
                      <span className="payment-method__icon">
                        ₮
                      </span>

                      <span className="payment-method__copy">
                        <strong>
                          USDT
                        </strong>

                        <small>
                          Ethereum Mainnet · ERC-20
                        </small>
                      </span>

                      <span className="payment-method__badge payment-method__badge--available">
                        {language === "es"
                          ? "DISPONIBLE"
                          : "AVAILABLE"}
                      </span>

                      <span
                        className="payment-method__arrow"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </button>

                    <button
                      className="payment-method payment-method--coming-soon"
                      type="button"
                      disabled
                      aria-disabled="true"
                    >
                      <span className="payment-method__icon">
                        MP
                      </span>

                      <span className="payment-method__copy">
                        <strong>
                          Mercado Pago
                        </strong>

                        <small>
                          {language === "es"
                            ? "Pago en pesos argentinos"
                            : "Argentine peso payment"}
                        </small>
                      </span>

                      <span className="payment-method__badge">
                        {language === "es"
                          ? "NO HABILITADO"
                          : "NOT ENABLED"}
                      </span>
                    </button>

                    <button
                      className="payment-method payment-method--coming-soon"
                      type="button"
                      disabled
                      aria-disabled="true"
                    >
                      <span className="payment-method__icon">
                        NX
                      </span>

                      <span className="payment-method__copy">
                        <strong>
                          Naranja X
                        </strong>

                        <small>
                          {language === "es"
                            ? "Pago en pesos argentinos"
                            : "Argentine peso payment"}
                        </small>
                      </span>

                      <span className="payment-method__badge">
                        {language === "es"
                          ? "NO HABILITADO"
                          : "NOT ENABLED"}
                      </span>
                    </button>
                  </div>

                  <button
                    className="checkout-back-link"
                    type="button"
                    onClick={() =>
                      setCheckoutStep(
                        "confirm",
                      )
                    }
                  >
                    {language === "es"
                      ? "← Volver a la reserva"
                      : "← Back to reservation"}
                  </button>
                </div>
              )}

              {publicCheckoutEnabled && checkoutStep === "details" && (
                <div className="checkout-step">
                  <span className="checkout-step__number">
                    {language === "es" ? "PASO 04 / 04" : "STEP 04 / 04"}
                  </span>

                  <h2>
                    USDT · Ethereum Mainnet
                  </h2>

                  <p>
                    {language === "es"
                      ? "Revisá la red, el contrato de USDT, el importe y la dirección de destino indicados para este pago. Su confirmación depende de la verificación de la transferencia."
                      : "Review the network, USDT contract, amount and destination address shown for this payment. Confirmation depends on transfer verification."}
                  </p>

                  {paymentMethod === "usdt" && (
                    <UsdtPaymentPanel
                      email={email}
                      language={language}
                      onVerified={(
                        result,
                      ) => {
                        setVerifiedPurchase(
                          result,
                        );

                        setCheckoutStep(
                          "complete",
                        );
                      }}
                    />
                  )}

                  <button
                    className="checkout-back-link"
                    type="button"
                    onClick={() =>
                      setCheckoutStep(
                        "method",
                      )
                    }
                  >
                    {language === "es"
                      ? "← Cambiar método"
                      : "← Change method"}
                  </button>
                </div>
              )}

              {checkoutStep === "complete" && (
                <div className="checkout-step checkout-complete">
                  <span className="checkout-complete__mark">
                    ✓
                  </span>

                  <span className="checkout-step__number">
                    {publicCheckoutEnabled
                      ? language === "es"
                        ? "PAGO VERIFICADO"
                        : "PAYMENT VERIFIED"
                      : language === "es"
                        ? "REGISTRO CONFIRMADO"
                        : "SIGNUP CONFIRMED"}
                  </span>

                  <h2>
                    {publicCheckoutEnabled
                      ? language === "es"
                        ? "Tu pago fue verificado en Ethereum."
                        : "Your payment was verified on Ethereum."
                      : language === "es"
                        ? "Ya estás en la lista de novedades."
                        : "You’re on the launch updates list."}
                  </h2>

                  {publicCheckoutEnabled ? (
                    <p>
                      {language === "es"
                        ? "Verificamos tu pago en USDT y registramos tu asignación Founding y tu membresía. La entrega del NFT y la activación del acceso son etapas distintas."
                        : "We verified your USDT payment and recorded your Founding allocation and membership. NFT delivery and access activation are separate stages."}
                    </p>
                  ) : (
                    <p>
                      {language === "es"
                        ? "Registramos tu email para enviarte novedades. No se creó una compra, un pago ni una membresía, y no se reservó un número de NFT."
                        : "We registered your email for updates. No purchase, payment or membership was created, and no NFT number was reserved."}
                    </p>
                  )}

                  <div className="checkout-summary">
                    <div>
                      <span>Email</span>
                      <strong>
                        {email}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {language === "es"
                          ? "Estado"
                          : "Status"}
                      </span>

                      <strong>
                        {publicCheckoutEnabled
                          ? verifiedPurchase
                            ? language === "es" ? "Pagado" : "Paid"
                            : language === "es" ? "Pendiente" : "Pending"
                          : language === "es" ? "Registro de interés" : "Interest registered"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {language === "es"
                          ? "Pago"
                          : "Payment"}
                      </span>

                      <strong>
                        {publicCheckoutEnabled
                          ? verifiedPurchase
                            ? language === "es" ? "USDT · Verificado" : "USDT · Verified"
                            : language === "es" ? "Sin verificar" : "Not verified"
                          : language === "es" ? "No realizado" : "Not processed"}
                      </strong>
                    </div>

                    {publicCheckoutEnabled &&
                      verifiedPurchase
                        ?.allocation && (
                        <div>
                          <span>
                            {language === "es"
                              ? "Número Founding"
                              : "Founding number"}
                          </span>

                          <strong>
                            #{String(
                              verifiedPurchase
                                .allocation
                                .serialNumber,
                            ).padStart(
                              4,
                              "0",
                            )}
                          </strong>
                        </div>
                      )}

                    {publicCheckoutEnabled &&
                      verifiedPurchase
                        ?.allocation && (
                        <div>
                          <span>
                            {language === "es"
                              ? "Categoría"
                              : "Category"}
                          </span>

                          <strong>
                            {verifiedPurchase
                              .allocation
                              .serialNumber <= 1000
                              ? "RARE"
                              : verifiedPurchase
                                  .allocation
                                  .serialNumber <= 3000
                                ? "EPIC"
                                : "LEGENDARY"}
                          </strong>
                        </div>
                      )}

                    {publicCheckoutEnabled &&
                      verifiedPurchase
                        ?.membership && (
                        <div>
                          <span>
                            {language === "es"
                              ? "Acceso"
                              : "Access"}
                          </span>

                          <strong>
                            {language === "es"
                              ? "Activación pendiente"
                              : "Activation pending"}
                          </strong>
                        </div>
                      )}
                  </div>

                  {publicCheckoutEnabled &&
                    verifiedPurchase
                      ?.allocation && (
                      <NftEconomyPanel
                        tokenId={
                          verifiedPurchase
                            .allocation
                            .serialNumber
                        }
                        language={
                          language
                        }
                      />
                    )}

                  <div className="checkout-actions">
                    {publicCheckoutEnabled && (
                      <button
                        className="db-button db-button--secondary"
                        type="button"
                        onClick={
                          resetCheckout
                        }
                      >
                        {language === "es"
                          ? "Nueva compra"
                          : "New purchase"}
                      </button>
                    )}

                    <button
                      className="db-button db-button--primary"
                      type="button"
                      onClick={
                        closeCheckout
                      }
                    >
                      {language === "es"
                        ? "Volver a la campaña"
                        : "Return to campaign"}
                    </button>
                  </div>
                </div>
              )}

            </div>

            <footer className="checkout-footer">
              <span>
                {publicCheckoutEnabled
                  ? language === "es" ? "Compra" : "Checkout"
                  : language === "es" ? "Novedades del lanzamiento" : "Launch updates"}
              </span>

              <span>
                {publicCheckoutEnabled
                  ? language === "es" ? "Pago sujeto a verificación" : "Payment subject to verification"
                  : language === "es" ? "Reservas y pagos aún no habilitados" : "Reservations and payments not yet open"}
              </span>
            </footer>
          </section>
        </div>
      )}



      <div className="ox-landing ox-footer-note">
  <div className="ox-footer-note__inner">
    <span>{language === "es"
      ? "Founding 6000 · Campaña de prelanzamiento"
      : "Founding 6000 · Pre-launch campaign"}</span>
    <span>{language === "es"
      ? "Lanzamiento objetivo · 5 de enero de 2027 · Sujeto a cambios"
      : "Target launch · January 5, 2027 · Subject to change"}</span>
  </div>
</div>
    </div>
  );
}

export default App;
