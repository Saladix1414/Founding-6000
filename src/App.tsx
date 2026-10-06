import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import UsdtPaymentPanel from "./components/UsdtPaymentPanel";

import {
  registerPrelaunchEmail,
} from "./lib/foundingApi";

import "./App.css";

const TARGET_DATE = new Date("2027-01-05T00:00:00-03:00");

const PUBLIC_CHECKOUT_ENABLED =
  import.meta.env
    .VITE_PUBLIC_CHECKOUT_ENABLED ===
  "true";

type Language =
  | "en"
  | "es";

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  reached: boolean;
};

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
    name: "Genesis",
    capacity: 1000,
    price: 50,
    range: "#0001–#1000",
    status: "Genesis Member",
    active: true,
  },
  {
    number: "02",
    name: "Early Access",
    capacity: 2000,
    price: 70,
    range: "#1001–#3000",
    status: "Founding Member",
  },
  {
    number: "03",
    name: "Founding Access",
    capacity: 3000,
    price: 90,
    range: "#3001–#6000",
    status: "Founding Member",
  },
];

function getCountdown(): Countdown {
  const now = Date.now();
  const difference = TARGET_DATE.getTime() - now;

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      reached: true,
    };
  }

  const days = Math.floor(difference / 86_400_000);

  const hours = Math.floor(
    (difference % 86_400_000) / 3_600_000,
  );

  const minutes = Math.floor(
    (difference % 3_600_000) / 60_000,
  );

  const seconds = Math.floor(
    (difference % 60_000) / 1000,
  );

  return {
    days,
    hours,
    minutes,
    seconds,
    reached: false,
  };
}

function CountdownUnit({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="countdown-unit">
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
    </div>
  );
}

function App() {
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

  const [countdown, setCountdown] =
    useState<Countdown>(getCountdown);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [galleryOpen, setGalleryOpen] =
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

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      "founding6000-language",
      language,
    );

    document.documentElement.lang =
      language;
  }, [language]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const sold = 0;
  const total = 6000;

  const progress = useMemo(
    () => Math.min(100, (sold / total) * 100),
    [sold],
  );

  const primaryCtaLabel =
    PUBLIC_CHECKOUT_ENABLED
      ? language === "es"
        ? "Comprar ahora"
        : "Purchase Now"
      : language === "es"
        ? "Unirme al prelaunch"
        : "Join Prelaunch";

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
      !PUBLIC_CHECKOUT_ENABLED
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
  };

  const paymentMethodLabel = () => {
    if (paymentMethod === "mercado-pago") {
      return "Mercado Pago";
    }

    if (paymentMethod === "naranja-x") {
      return "Naranja X";
    }

    if (paymentMethod === "usdt") {
      return "USDT";
    }

    return "";
  };

  return (
    <div className="campaign">
      <header className="campaign-nav">
        <div className="db-container campaign-nav__inner">
          <a
            href="#top"
            className="campaign-brand"
            aria-label="DigitalBoost Origin Founding 6000"
            onClick={closeMenu}
          >
            <span
              className="campaign-brand__mark"
              aria-hidden="true"
            >
              D
            </span>

            <span className="campaign-brand__text">
              <strong>DigitalBoost Origin</strong>
              <small>Founding 6000</small>
            </span>
          </a>

          <nav
            className="campaign-nav__desktop"
            aria-label={
              language === "es"
                ? "Navegación principal"
                : "Primary navigation"
            }
          >
            <a href="#campaign">
              {language === "es" ? "Campaña" : "Campaign"}
            </a>
            <a href="#phases">
              {language === "es" ? "Fases" : "Phases"}
            </a>
            <a href="#benefits">
              {language === "es" ? "Beneficios" : "Benefits"}
            </a>
            <a href="#product">
              {language === "es" ? "Producto" : "Product"}
            </a>
            <a href="#faq">FAQ</a>
          </nav>

          <div
            className="language-switcher language-switcher--desktop"
            role="group"
            aria-label="Language"
          >
            <button
              type="button"
              className={
                language === "en"
                  ? "language-switcher__button is-active"
                  : "language-switcher__button"
              }
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>

            <span aria-hidden="true">
              /
            </span>

            <button
              type="button"
              className={
                language === "es"
                  ? "language-switcher__button is-active"
                  : "language-switcher__button"
              }
              aria-pressed={language === "es"}
              onClick={() => setLanguage("es")}
            >
              ES
            </button>
          </div>

          <button
            className="db-button db-button--primary campaign-nav__cta"
            type="button"
            onClick={openCheckout}
          >
            {primaryCtaLabel}
          </button>

          <button
            className="mobile-menu-button"
            type="button"
            aria-label={
              language === "es"
                ? mobileMenuOpen
                  ? "Cerrar menú de navegación"
                  : "Abrir menú de navegación"
                : mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() =>
              setMobileMenuOpen((current) => !current)
            }
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-nav"
            aria-label={
              language === "es"
                ? "Navegación móvil"
                : "Mobile navigation"
            }
          >
            <div className="db-container mobile-nav__inner">
              <a href="#campaign" onClick={closeMenu}>
                {language === "es" ? "Campaña" : "Campaign"}
              </a>

              <a href="#phases" onClick={closeMenu}>
                {language === "es" ? "Fases" : "Phases"}
              </a>

              <a href="#benefits" onClick={closeMenu}>
                {language === "es" ? "Beneficios" : "Benefits"}
              </a>

              <a href="#product" onClick={closeMenu}>
                {language === "es" ? "Producto" : "Product"}
              </a>

              <a href="#faq" onClick={closeMenu}>
                FAQ
              </a>

              <div
                className="language-switcher language-switcher--mobile"
                role="group"
                aria-label="Language"
              >
                <button
                  type="button"
                  className={
                    language === "en"
                      ? "language-switcher__button is-active"
                      : "language-switcher__button"
                  }
                  aria-pressed={language === "en"}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>

                <span aria-hidden="true">
                  /
                </span>

                <button
                  type="button"
                  className={
                    language === "es"
                      ? "language-switcher__button is-active"
                      : "language-switcher__button"
                  }
                  aria-pressed={language === "es"}
                  onClick={() => setLanguage("es")}
                >
                  ES
                </button>
              </div>

              <button
                type="button"
                className="db-button db-button--primary"
                onClick={openCheckout}
              >
                {primaryCtaLabel}
              </button>
            </div>
          </nav>
        )}
      </header>

      <main id="top">
        <section
          className="campaign-hero"
          id="campaign"
        >
          <div className="campaign-hero__signal" />

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
                  onClick={() =>
                    setGalleryOpen(
                      (current) => !current,
                    )
                  }
                >
                  <span
                    className="project-dock__icon"
                    aria-hidden="true"
                  >
                    ▦
                  </span>

                  <span>
                    {language === "es"
                      ? "GALERÍA"
                      : "GALLERY"}
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
                      ? "Galería del proyecto"
                      : "Project gallery"
                  }
                >
                  <header className="project-gallery-panel__header">
                    <div>
                      <span>
                        DIGITALBOOST
                      </span>

                      <strong>
                        {language === "es"
                          ? "Galería del proyecto"
                          : "Project Gallery"}
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
                      onClick={() =>
                        setGalleryOpen(false)
                      }
                    >
                      ×
                    </button>
                  </header>

                  <p className="project-gallery-panel__intro">
                    {language === "es"
                      ? "Una vista rápida de las principales áreas que forman el ecosistema DigitalBoost."
                      : "A quick view of the core areas that make up the DigitalBoost ecosystem."}
                  </p>

                  <div className="project-gallery-grid">
                    {[
                      [
                        "Commerce OS",
                        "/project-gallery/commerce-os.svg",
                      ],
                      [
                        "Web Builder",
                        "/project-gallery/web-builder.svg",
                      ],
                      [
                        "AI Forge",
                        "/project-gallery/ai-forge.svg",
                      ],
                      [
                        "Trading Islands",
                        "/project-gallery/trading-islands.svg",
                      ],
                      [
                        "Store Builder",
                        "/project-gallery/store-builder.svg",
                      ],
                      [
                        "DigitalBoost Origin",
                        "/project-gallery/digitalboost-origin.svg",
                      ],
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
                </aside>
              )}
            </div>
          </div>

          <div className="db-container campaign-hero__grid">
            <div className="campaign-hero__content">
              <div className="campaign-kicker">
                <span className="campaign-kicker__dot" />
                DIGITALBOOST ORIGIN
                <span className="campaign-kicker__divider">
                  /
                </span>
                {language === "es"
                  ? "PRELANZAMIENTO"
                  : "PRE-LAUNCH"}
              </div>

              <h1 className="campaign-hero__title">
                FOUNDING
                <span>6000</span>
              </h1>

              <p className="campaign-hero__headline">
                {language === "es"
                  ? "Formá parte de los primeros 6.000."
                  : "Become part of the first 6,000."}
              </p>

              <p className="campaign-hero__description">
                {language === "es"
                  ? "12 meses de Focus Founding Access más estatus permanente de Founding Member cuando tu membresía sea verificada y activada."
                  : "12 months of Focus Founding Access plus permanent Founding Member status when your membership is verified and activated."}
              </p>

              <div className="campaign-hero__meta">
                <div>
                  <span>
                    {language === "es"
                      ? "Fase actual"
                      : "Current phase"}
                  </span>
                  <strong>Genesis</strong>
                </div>

                <div>
                  <span>
                    {language === "es"
                      ? "Precio de referencia"
                      : "Reference price"}
                  </span>
                  <strong>US$50</strong>
                </div>

                <div>
                  <span>
                    {language === "es"
                      ? "Rango Genesis"
                      : "Genesis range"}
                  </span>
                  <strong>#0001–#1000</strong>
                </div>
              </div>

              <div className="campaign-hero__actions">
                <button
                  className="db-button db-button--primary campaign-hero__primary"
                  type="button"
                  onClick={openCheckout}
                >
                  {primaryCtaLabel}
                  <span aria-hidden="true">→</span>
                </button>

                <a
                  className="db-button db-button--secondary"
                  href="#phases"
                >
                  {language === "es"
                    ? "Explorar la campaña"
                    : "Explore the campaign"}
                </a>
              </div>

              <p className="campaign-hero__disclosure">
                {language === "es"
                  ? "Preorden / reserva de producto. Founding 6000 no es una inversión, oferta de capital, valor financiero ni programa de participación en ingresos."
                  : "Product pre-order / reservation. Founding 6000 is not an investment, equity offering, security or revenue-share program."}
              </p>
            </div>

            <aside className="launch-panel">
              <div className="launch-panel__top">
                <div>
                  <span className="launch-panel__eyebrow">
                    {language === "es"
                      ? "LANZAMIENTO OBJETIVO"
                      : "TARGET LAUNCH"}
                  </span>

                  <strong>JAN 05 · 2027</strong>
                </div>

                <span className="launch-panel__status">
                  {language === "es"
                    ? "Objetivo"
                    : "Target"}
                </span>
              </div>

              {countdown.reached ? (
                <div className="launch-window">
                  <span>
                    {language === "es"
                      ? "Ventana de lanzamiento alcanzada"
                      : "Launch window reached"}
                  </span>

                  <p>
                    {language === "es"
                      ? "Seguí las novedades de DigitalBoost Origin para conocer la disponibilidad actual del producto."
                      : "Follow DigitalBoost Origin updates for current product availability."}
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="countdown"
                    aria-label={
                      language === "es"
                        ? "Cuenta regresiva al lanzamiento objetivo"
                        : "Countdown to target launch"
                    }
                  >
                    <CountdownUnit
                      value={countdown.days}
                      label={language === "es" ? "Días" : "Days"}
                    />

                    <CountdownUnit
                      value={countdown.hours}
                      label={language === "es" ? "Horas" : "Hours"}
                    />

                    <CountdownUnit
                      value={countdown.minutes}
                      label={language === "es" ? "Min" : "Min"}
                    />

                    <CountdownUnit
                      value={countdown.seconds}
                      label={language === "es" ? "Seg" : "Sec"}
                    />
                  </div>

                  <p className="launch-panel__note">
                    {language === "es"
                      ? "Esta es una fecha objetivo de lanzamiento, no una fecha de entrega garantizada."
                      : "This is a target launch date, not a guaranteed delivery date."}
                  </p>
                </>
              )}

              <div className="launch-panel__line" />

              <div className="launch-panel__phase">
                <div>
                  <span>
                    {language === "es"
                      ? "FASE ACTIVA"
                      : "ACTIVE PHASE"}
                  </span>
                  <strong>01 · Genesis</strong>
                </div>

                <span>
                  {language === "es"
                    ? "máx. 1.000"
                    : "1,000 max"}
                </span>
              </div>
            </aside>
          </div>
        </section>

        <section className="campaign-progress-section">
          <div className="db-container">
            <div className="campaign-progress">
              <div className="campaign-progress__header">
                <div>
                  <span className="campaign-progress__eyebrow">
                    {language === "es"
                      ? "CAMPAÑA GLOBAL"
                      : "GLOBAL CAMPAIGN"}
                  </span>

                  <h2>
                    {language === "es"
                      ? "Asignación de membresías Founding"
                      : "Founding membership allocation"}
                  </h2>
                </div>

                <div className="campaign-progress__number">
                  <strong>{sold.toLocaleString()}</strong>
                  <span>/ {total.toLocaleString()}</span>
                </div>
              </div>

              <div
                className="campaign-progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={sold}
                aria-label="Founding 6000 memberships allocated"
              >
                <div
                  className="campaign-progress__fill"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <div className="campaign-progress__footer">
                <span>
                  Initial prototype state: 0 verified
                  memberships
                </span>

                <span>
                  Production counters will be
                  server-authoritative
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="db-section phase-section"
          id="phases"
        >
          <div className="db-container">
            <div className="section-heading">
              <div>
                <div className="db-eyebrow">
                  {language === "es"
                    ? "Estructura de campaña"
                    : "Campaign structure"}
                </div>

                <h2 className="db-title">
                  {language === "es"
                    ? "Tres fases. Una sola cohorte fundadora."
                    : "Three phases. One founding cohort."}
                </h2>

                <p className="db-copy">
                  {language === "es"
                    ? "Solo una fase está activa a la vez. Cada fase tiene una capacidad fija y un precio de referencia."
                    : "Only one phase is active at a time. Each phase has a fixed capacity and reference price."}
                </p>
              </div>

              <div className="section-heading__total">
                <span>
                  {language === "es"
                    ? "Capacidad total"
                    : "Total capacity"}
                </span>
                <strong>6,000</strong>
              </div>
            </div>

            <div className="phase-grid">
              {phases.map((phase) => (
                <article
                  className={
                    phase.active
                      ? "phase-card phase-card--active"
                      : "phase-card"
                  }
                  key={phase.number}
                >
                  <div className="phase-card__top">
                    <span className="phase-card__number">
                      {phase.number}
                    </span>

                    {phase.active ? (
                      <span className="phase-card__active">
                        {language === "es"
                          ? "Activa"
                          : "Active"}
                      </span>
                    ) : (
                      <span className="phase-card__future">
                        {language === "es"
                          ? "Próxima"
                          : "Upcoming"}
                      </span>
                    )}
                  </div>

                  <div className="phase-card__body">
                    <span className="phase-card__label">
                      {language === "es"
                        ? `Fase ${phase.number}`
                        : `Phase ${phase.number}`}
                    </span>

                    <h3>{phase.name}</h3>

                    <div className="phase-card__price">
                      <small>
                        {language === "es"
                          ? "Referencia"
                          : "Reference"}
                      </small>
                      <strong>US${phase.price}</strong>
                    </div>

                    <dl className="phase-card__details">
                      <div>
                        <dt>
                          {language === "es"
                            ? "Capacidad"
                            : "Capacity"}
                        </dt>
                        <dd>
                          {phase.capacity.toLocaleString()}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {language === "es"
                            ? "Rango de serie"
                            : "Serial range"}
                        </dt>
                        <dd>{phase.range}</dd>
                      </div>

                      <div>
                        <dt>
                          {language === "es"
                            ? "Estado"
                            : "Status"}
                        </dt>
                        <dd>{phase.status}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="phase-card__bottom">
                    {phase.active
                      ? language === "es"
                        ? "Fase actual de la campaña"
                        : "Current campaign phase"
                      : language === "es"
                        ? "Abre después de completar la fase anterior"
                        : "Opens after prior phase allocation"}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="db-section benefits-section"
          id="benefits"
        >
          <div className="db-container">
            <div className="section-heading section-heading--wide">
              <div>
                <div className="db-eyebrow">
                  {language === "es"
                    ? "Acceso Founding"
                    : "Founding access"}
                </div>

                <h2 className="db-title">
                  {language === "es"
                    ? "Más que acceso anticipado."
                    : "More than early access."}
                </h2>

                <p className="db-copy">
                  {language === "es"
                    ? "Cada membresía verificada de Founding 6000 está diseñada para incluir 12 meses de Focus Founding Access desde la activación de la cuenta Founding Access del usuario."
                    : "Every verified Founding 6000 membership is designed to include 12 months of Focus Founding Access beginning when the user's Founding Access account is activated."}
                </p>
              </div>
            </div>

            <div className="benefits-grid">
              <article className="benefit-card benefit-card--feature">
                <span className="benefit-card__index">
                  01
                </span>

                <div>
                  <span className="benefit-card__eyebrow">
                    {language === "es"
                      ? "ACCESO PRINCIPAL"
                      : "CORE ACCESS"}
                  </span>

                  <h3>
                    {language === "es"
                      ? "12 meses de Focus"
                      : "12 months of Focus"}
                  </h3>

                  <p>
                    {language === "es"
                      ? "Founding Access comienza con la activación de la cuenta, no automáticamente en la fecha de compra."
                      : "Founding Access begins on account activation — not automatically on the purchase date."}
                  </p>
                </div>

                <span className="benefit-card__signal">
                  12 MONTHS
                </span>
              </article>

              <article className="benefit-card">
                <span className="benefit-card__index">
                  02
                </span>

                <h3>
                  Founding Member
                </h3>

                <p>
                  {language === "es"
                    ? "Reconocimiento permanente como uno de los primeros 6.000 miembros verificados de DigitalBoost Origin."
                    : "Permanent recognition as one of the first 6,000 verified DigitalBoost Origin members."}
                </p>
              </article>

              <article className="benefit-card">
                <span className="benefit-card__index">
                  03
                </span>

                <h3>
                  {language === "es"
                    ? "Acceso beta prioritario"
                    : "Priority beta access"}
                </h3>

                <p>
                  {language === "es"
                    ? "Oportunidades anticipadas para acceder a funciones elegibles del producto a medida que estén disponibles."
                    : "Earlier opportunities to access eligible product capabilities as they become available."}
                </p>
              </article>

              <article className="benefit-card">
                <span className="benefit-card__index">
                  04
                </span>

                <h3>
                  {language === "es"
                    ? "Feedback de producto"
                    : "Product feedback"}
                </h3>

                <p>
                  {language === "es"
                    ? "Oportunidades para ayudar a orientar decisiones de producto mediante programas estructurados de feedback Founding."
                    : "Opportunities to help shape product decisions through structured founding feedback programs."}
                </p>
              </article>

              <article className="benefit-card">
                <span className="benefit-card__index">
                  05
                </span>

                <h3>
                  {language === "es"
                    ? "Ecosistema conectado"
                    : "Connected ecosystem"}
                </h3>

                <p>
                  {language === "es"
                    ? "El reconocimiento Founding podrá reflejarse más adelante en experiencias elegibles de DigitalBoost y espacios de comunidad."
                    : "Founding recognition may later surface across eligible DigitalBoost experiences and community spaces."}
                </p>
              </article>
            </div>

            <div className="access-boundary">
              <span className="access-boundary__icon">
                ∞
              </span>

              <div>
                <strong>
                  {language === "es"
                    ? "Founding Focus no significa infraestructura ilimitada."
                    : "Founding Focus does not mean unlimited infrastructure."}
                </strong>

                <p>
                  {language === "es"
                    ? "Pueden aplicar límites de DBX, uso razonable, inferencia de IA, cómputo, almacenamiento, hosting, runtime, Sentinel y otras restricciones técnicas o legales."
                    : "DBX allowance, fair-use, AI inference, compute, storage, hosting, runtime, Sentinel and other technical or legal limits may apply."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="genesis-section">
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
          className="db-section product-section"
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
                    ? "Construyendo el ecosistema DigitalBoost."
                    : "Building the DigitalBoost ecosystem."}
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
                  <span className="product-status product-status--active">
                    Functional / In development
                  </span>
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
                    ? "Sistemas avanzados de trading, automatización, bots y activos digitales en desarrollo activo."
                    : "Advanced trading, automation, bot and digital asset systems under active development."}
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
                    ? "Base para creación de IA, agentes, automatización, herramientas e inteligencia desplegable."
                    : "Foundation for AI creation, agents, automation, tools and deployable intelligence."}
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
                    ? "Capacidad planificada de DigitalBoost. Actualmente no se presenta como disponible."
                    : "Planned DigitalBoost capability. It is not currently represented as available."}
                </p>
              </article>

              <article className="product-card product-card--planned">
                <div className="product-card__top">
                  <span>07</span>
                  <span className="product-status">
                    Planned
                  </span>
                </div>

                <h3>Nexus</h3>

                <p>
                  {language === "es"
                    ? "Superficie de ecosistema planificada para futuras experiencias conectadas de DigitalBoost."
                    : "Planned ecosystem surface for future connected DigitalBoost experiences."}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="db-section workflow-section">
          <div className="db-container">
            <div className="workflow-heading">
              <div>
                <div className="db-eyebrow">
                  {language === "es"
                    ? "Cómo funciona"
                    : "How it works"}
                </div>

                <h2 className="db-title">
                  {language === "es"
                    ? "Del interés a la membresía verificada."
                    : "From interest to verified membership."}
                </h2>
              </div>

              <p className="db-copy">
                {language === "es"
                  ? "El estado del pago y de la membresía solo es autoritativo después de la verificación y liquidación del lado del servidor."
                  : "Payment and membership state is authoritative only after server-side verification and settlement."}
              </p>
            </div>

            <div className="workflow">
              <div className="workflow-step">
                <span>01</span>
                <strong>{primaryCtaLabel}</strong>
                <p>
                  {language === "es"
                    ? "Iniciá el flujo de reserva de Founding 6000."
                    : "Begin the Founding 6000 reservation flow."}
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>02</span>
                <strong>Email</strong>
                <p>
                  {language === "es"
                    ? "Registrá primero un email de contacto válido."
                    : "Register a valid contact email first."}
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>03</span>
                <strong>
                  {language === "es"
                    ? "Confirmar"
                    : "Confirm"}
                </strong>
                <p>
                  {language === "es"
                    ? "Revisá la fase, el precio de referencia y los términos."
                    : "Review phase, reference price and terms."}
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>04</span>
                <strong>
                  {language === "es"
                    ? "Pago"
                    : "Payment"}
                </strong>
                <p>
                  {language === "es"
                    ? "Elegí un medio de pago compatible y disponible."
                    : "Choose an available supported payment rail."}
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>05</span>
                <strong>
                  {language === "es"
                    ? "Verificar"
                    : "Verify"}
                </strong>
                <p>
                  {language === "es"
                    ? "La verificación del servidor o blockchain confirma la liquidación."
                    : "Server or blockchain verification confirms settlement."}
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>06</span>
                <strong>Membership</strong>
                <p>
                  {language === "es"
                    ? "La liquidación verificada crea la membresía canónica."
                    : "Verified settlement creates the canonical membership."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="db-section faq-section"
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
                  ? "Información importante sobre la preventa, el período de acceso, el estado del producto y la campaña."
                  : "Important information about the pre-sale, access period, product status and campaign."}
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
                    ? "Una preorden / reserva de producto DigitalBoost Origin Founding 6000 destinada a brindar 12 meses de Focus Founding Access después de la activación de la cuenta, sujeta a los términos finales publicados y a límites técnicos."
                    : "A DigitalBoost Origin Founding 6000 product pre-order / reservation intended to provide 12 months of Focus Founding Access after account activation, subject to the final published terms and technical limits."}
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
                    ? "El período de 12 meses de Founding Access comienza cuando se activa tu cuenta Founding Access, no automáticamente en la fecha de compra."
                    : "The 12-month Founding Access period begins when your Founding Access account is activated, not automatically on purchase date."}
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
                    ? "No. El 5 de enero de 2027 es la fecha objetivo actual de lanzamiento. No se presenta como una fecha de entrega garantizada."
                    : "No. January 5, 2027 is the current target launch date. It is explicitly not presented as a guaranteed delivery date."}
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
                    ? "¿Qué métodos de pago están planificados?"
                    : "Which payment methods are planned?"}
                </summary>

                <p>
                  The current plan includes ARS payment through
                  Mercado Pago, Naranja X only if an official
                  suitable integration is verified, and USDT
                  on one explicitly selected blockchain
                  network. Real payments are not enabled yet.
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

        <section
          className="purchase-section"
          id="purchase"
        >
          <div className="db-container">
            <div className="purchase-panel">
              <div className="purchase-panel__glow" />

              <div className="purchase-panel__content">
                <div className="db-eyebrow">
                  Founding 6000
                </div>

                <h2>
                  {language === "es"
                    ? "Formá parte de los primeros 6.000."
                    : "Be part of the first 6,000."}
                </h2>

                <p>
                  {language === "es"
                    ? "Genesis es la primera fase de la campaña, con un precio de referencia de US$50 y una capacidad máxima de 1.000 membresías verificadas."
                    : "Genesis is the first campaign phase with a reference price of US$50 and a maximum capacity of 1,000 verified memberships."}
                </p>

                <div className="purchase-panel__meta">
                  <div>
                    <span>
                      {language === "es" ? "Fase" : "Phase"}
                    </span>
                    <strong>Genesis</strong>
                  </div>

                  <div>
                    <span>
                      {language === "es"
                        ? "Referencia"
                        : "Reference"}
                    </span>
                    <strong>US$50</strong>
                  </div>

                  <div>
                    <span>
                      {language === "es"
                        ? "Capacidad"
                        : "Capacity"}
                    </span>
                    <strong>1,000</strong>
                  </div>
                </div>

                <button
                  className="db-button db-button--primary purchase-panel__button"
                  type="button"
                  onClick={openCheckout}
                >
                  {primaryCtaLabel}
                  <span aria-hidden="true">→</span>
                </button>

                <span className="purchase-panel__note">
                  {PUBLIC_CHECKOUT_ENABLED
                    ? (
                      <>
                        Checkout availability is controlled by
                        server-side readiness and payment
                        authority.
                      </>
                    )
                    : (
                      <>
                        {language === "es"
                          ? "Las reservas públicas todavía no están abiertas. Unite a las novedades del prelanzamiento sin crear una orden ni un pago."
                          : "Public reservations are not open yet. Join prelaunch updates without creating an order or payment."}
                      </>
                    )}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="founding-footer">
        <div className="db-container founding-footer-inner">
          <div>
            <strong>DigitalBoost Origin</strong>
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
          className="checkout-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCheckout();
            }
          }}
        >
          <section
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            aria-describedby="checkout-prototype-note"
          >
            <header className="checkout-header">
              <div>
                <span className="checkout-header__eyebrow">
                  {PUBLIC_CHECKOUT_ENABLED
                    ? language === "es"
                      ? "FOUNDING 6000 · COMPRA"
                      : "FOUNDING 6000 · CHECKOUT"
                    : language === "es"
                      ? "FOUNDING 6000 · PRELANZAMIENTO"
                      : "FOUNDING 6000 · PRELAUNCH"}
                </span>

                <strong id="checkout-title">
                  {PUBLIC_CHECKOUT_ENABLED
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
              {PUBLIC_CHECKOUT_ENABLED
                ? language === "es"
                  ? "Proceso de compra de Founding 6000."
                  : "Founding 6000 checkout."
                : language === "es"
                  ? "Las reservas públicas y los pagos todavía no están habilitados."
                  : "Public reservations and payments are not open yet."}
            </p>

            <div
              className={
                PUBLIC_CHECKOUT_ENABLED
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
                    {PUBLIC_CHECKOUT_ENABLED
                      ? "STEP 01 / 04"
                      : "PRELAUNCH ACCESS"}
                  </span>

                  <h2>
                    {PUBLIC_CHECKOUT_ENABLED
                      ? "Start with your email."
                      : "Be notified when reservations open."}
                  </h2>

                  <p>
                    {PUBLIC_CHECKOUT_ENABLED
                      ? (
                        <>
                          Email is required before beginning a
                          Founding 6000 reservation. It will be
                          used for reservation contact,
                          confirmation, launch notifications and
                          account activation.
                        </>
                      )
                      : (
                        <>
                          Register your email for Founding 6000
                          launch updates. This does not create a
                          reservation, membership or payment
                          obligation.
                        </>
                      )}
                  </p>

                  <label className="checkout-field">
                    <span>Email address</span>

                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="you@example.com"
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
                      {PUBLIC_CHECKOUT_ENABLED
                        ? (
                          <>
                            Email is a contact identifier. It is
                            not canonical user identity and does
                            not prove payment.
                          </>
                        )
                        : (
                          <>
                            Email registration records interest
                            only. Inventory and Founding serials
                            are not reserved during prelaunch.
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
                      ? "Registering…"
                      : PUBLIC_CHECKOUT_ENABLED
                        ? "Continue"
                        : "Join launch updates"}

                    <span aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>
              )}

              {PUBLIC_CHECKOUT_ENABLED && checkoutStep === "confirm" && (
                <div className="checkout-step">
                  <span className="checkout-step__number">
                    STEP 02 / 04
                  </span>

                  <h2>
                    Confirm your reservation details.
                  </h2>

                  <p>
                    Review the active campaign phase and
                    pre-sale conditions before choosing a
                    payment method.
                  </p>

                  <div className="checkout-summary">
                    <div>
                      <span>Email</span>
                      <strong>{email}</strong>
                    </div>

                    <div>
                      <span>Phase</span>
                      <strong>Genesis</strong>
                    </div>

                    <div>
                      <span>Membership</span>
                      <strong>Genesis Member</strong>
                    </div>

                    <div>
                      <span>Reference price</span>
                      <strong>US$50</strong>
                    </div>

                    <div>
                      <span>Access</span>
                      <strong>
                        12 months Focus Founding Access
                      </strong>
                    </div>
                  </div>

                  <div className="checkout-disclosure">
                    <strong>
                      Pre-sale disclosure
                    </strong>

                    <p>
                      Founding 6000 is a product pre-order /
                      reservation. It is not equity,
                      investment, company ownership, a
                      security or revenue-sharing program.
                      January 5, 2027 is a target launch date,
                      not a guaranteed delivery date.
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
                      Back
                    </button>

                    <button
                      className="db-button db-button--primary"
                      type="button"
                      onClick={() =>
                        setCheckoutStep("method")
                      }
                    >
                      I understand · Continue
                    </button>
                  </div>
                </div>
              )}

              {PUBLIC_CHECKOUT_ENABLED && checkoutStep === "method" && (
                <div className="checkout-step">
                  <span className="checkout-step__number">
                    STEP 03 / 04
                  </span>

                  <h2>
                    Choose a payment method.
                  </h2>

                  <p>
                    These payment methods are visual
                    prototypes only. No provider session,
                    blockchain payment or charge is created.
                  </p>

                  <div className="payment-methods">
                    <button
                      className="payment-method"
                      type="button"
                      onClick={() =>
                        choosePaymentMethod(
                          "mercado-pago",
                        )
                      }
                    >
                      <span className="payment-method__icon">
                        MP
                      </span>

                      <span className="payment-method__copy">
                        <strong>Mercado Pago</strong>
                        <small>
                          Planned ARS payment
                        </small>
                      </span>

                      <span
                        className="payment-method__arrow"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </button>

                    <button
                      className="payment-method"
                      type="button"
                      onClick={() =>
                        choosePaymentMethod(
                          "naranja-x",
                        )
                      }
                    >
                      <span className="payment-method__icon">
                        NX
                      </span>

                      <span className="payment-method__copy">
                        <strong>Naranja X</strong>
                        <small>
                          Pending official integration
                          verification
                        </small>
                      </span>

                      <span
                        className="payment-method__arrow"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </button>

                    <button
                      className="payment-method"
                      type="button"
                      onClick={() =>
                        choosePaymentMethod("usdt")
                      }
                    >
                      <span className="payment-method__icon">
                        ₮
                      </span>

                      <span className="payment-method__copy">
                        <strong>USDT</strong>
                        <small>
                          Network not selected yet
                        </small>
                      </span>

                      <span
                        className="payment-method__arrow"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </button>
                  </div>

                  <button
                    className="checkout-back-link"
                    type="button"
                    onClick={() =>
                      setCheckoutStep("confirm")
                    }
                  >
                    ← Back to reservation
                  </button>
                </div>
              )}

              {PUBLIC_CHECKOUT_ENABLED && checkoutStep === "details" && (
                <div className="checkout-step">
                  <span className="checkout-step__number">
                    STEP 04 / 04
                  </span>

                  <h2>
                    {paymentMethodLabel()}
                  </h2>

                  {paymentMethod === "mercado-pago" && (
                    <>
                      <p>
                        The production flow will convert the
                        US$50 reference price into an
                        auditable ARS quote with a defined FX
                        source and expiration.
                      </p>

                      <div className="prototype-payment-card">
                        <span>REFERENCE PRICE</span>
                        <strong>US$50</strong>

                        <div>
                          <span>ARS quote</span>
                          <strong>
                            Not generated in prototype
                          </strong>
                        </div>

                        <div>
                          <span>Provider</span>
                          <strong>Mercado Pago</strong>
                        </div>
                      </div>
                    </>
                  )}

                  {paymentMethod === "naranja-x" && (
                    <>
                      <p>
                        Naranja X remains conditional until
                        its official merchant integration
                        capabilities are researched and
                        verified.
                      </p>

                      <div className="prototype-payment-card">
                        <span>INTEGRATION STATUS</span>
                        <strong>
                          Research required
                        </strong>

                        <div>
                          <span>Real checkout</span>
                          <strong>Disabled</strong>
                        </div>

                        <div>
                          <span>Payment authority</span>
                          <strong>
                            Not configured
                          </strong>
                        </div>
                      </div>
                    </>
                  )}

                  {paymentMethod === "usdt" && (
                    <>
                      <p>
                        Production USDT payment requires one
                        explicit network, official token
                        contract verification, destination
                        wallet validation and server-side
                        transaction verification.
                      </p>

                      <div className="prototype-payment-card">
                        <span>USDT PAYMENT</span>
                        <strong>
                          Network not selected
                        </strong>

                        <div>
                          <span>Wallet</span>
                          <strong>
                            Not published
                          </strong>
                        </div>

                        <div>
                          <span>Token contract</span>
                          <strong>
                            Not configured
                          </strong>
                        </div>
                      </div>
                    </>
                  )}

                  {paymentMethod === "usdt" && (
                  <UsdtPaymentPanel
                    email={email}
                  />
                )}

                <div className="checkout-warning">
                    <strong>
                      Prototype only
                    </strong>

                    <p>
                      This button will not charge you,
                      redirect to a provider or verify a
                      blockchain transaction.
                    </p>
                  </div>

                  <div className="checkout-actions">
                    <button
                      className="db-button db-button--secondary"
                      type="button"
                      onClick={() =>
                        setCheckoutStep("method")
                      }
                    >
                      Change method
                    </button>

                    <button
                      className="db-button db-button--primary"
                      type="button"
                      onClick={() =>
                        setCheckoutStep("complete")
                      }
                    >
                      Complete prototype
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === "complete" && (
                <div className="checkout-step checkout-complete">
                  <span className="checkout-complete__mark">
                    ✓
                  </span>

                  <span className="checkout-step__number">
                    {PUBLIC_CHECKOUT_ENABLED
                      ? "CHECKOUT FLOW COMPLETE"
                      : "PRELAUNCH REGISTERED"}
                  </span>

                  <h2>
                    {PUBLIC_CHECKOUT_ENABLED
                      ? "Checkout flow complete."
                      : "You’re on the Founding 6000 prelaunch list."}
                  </h2>

                  {PUBLIC_CHECKOUT_ENABLED ? (
                    <p>
                      The checkout interface completed its
                      current flow. Payment and membership
                      authority remain server-side.
                    </p>
                  ) : (
                    <p>
                      We registered your email for launch
                      updates. No order, payment, membership,
                      inventory allocation or Founding serial
                      was created.
                    </p>
                  )}

                  <div className="checkout-summary">
                    <div>
                      <span>Email</span>
                      <strong>{email}</strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>
                        {PUBLIC_CHECKOUT_ENABLED
                          ? "CHECKOUT FLOW"
                          : "PRELAUNCH ONLY"}
                      </strong>
                    </div>

                    <div>
                      <span>Payment state</span>
                      <strong>
                        NOT PROCESSED
                      </strong>
                    </div>
                  </div>

                  <div className="checkout-actions">
                    {PUBLIC_CHECKOUT_ENABLED && (
                      <button
                        className="db-button db-button--secondary"
                        type="button"
                        onClick={resetCheckout}
                      >
                        Restart checkout
                      </button>
                    )}

                    <button
                      className="db-button db-button--primary"
                      type="button"
                      onClick={closeCheckout}
                    >
                      Return to campaign
                    </button>
                  </div>
                </div>
              )}
            </div>

            <footer className="checkout-footer">
              <span>
                {PUBLIC_CHECKOUT_ENABLED
                  ? "Checkout"
                  : "Prelaunch registration"}
              </span>

              <span>
                {PUBLIC_CHECKOUT_ENABLED
                  ? "Server-side payment authority"
                  : "Reservations and payments closed"}
              </span>
            </footer>
          </section>
        </div>
      )}

      <footer className="campaign-footer">
        <div className="db-container campaign-footer__inner">
          <div className="campaign-footer__brand">
            <strong>DigitalBoost Origin</strong>
            <span>Founding 6000</span>
          </div>

          <div className="campaign-footer__meta">
            <span>Pre-launch campaign</span>
            <span>Target launch · Jan 05, 2027</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
