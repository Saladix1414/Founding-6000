import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import UsdtPaymentPanel from "./components/UsdtPaymentPanel";
import "./App.css";

const TARGET_DATE = new Date("2027-01-05T00:00:00-03:00");

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
  const [countdown, setCountdown] =
    useState<Countdown>(getCountdown);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [checkoutOpen, setCheckoutOpen] =
    useState(false);

  const [checkoutStep, setCheckoutStep] =
    useState<CheckoutStep>("email");

  const [email, setEmail] =
    useState("");

  const [emailError, setEmailError] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

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
    setPaymentMethod(null);
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);

    window.setTimeout(() => {
      previousFocusRef.current?.focus();
    }, 0);
  };

  const submitEmail = () => {
    const normalizedEmail = email.trim();

    const validEmail =
      /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(
        normalizedEmail,
      );

    if (!validEmail) {
      setEmailError(
        "Enter a valid email address to continue.",
      );
      return;
    }

    setEmail(normalizedEmail);
    setEmailError("");
    setCheckoutStep("confirm");
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
            aria-label="Primary navigation"
          >
            <a href="#campaign">Campaign</a>
            <a href="#phases">Phases</a>
            <a href="#benefits">Benefits</a>
            <a href="#product">Product</a>
            <a href="#faq">FAQ</a>
          </nav>

          <button
            className="db-button db-button--primary campaign-nav__cta"
            type="button"
            onClick={openCheckout}
          >
            Purchase Now
          </button>

          <button
            className="mobile-menu-button"
            type="button"
            aria-label={
              mobileMenuOpen
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
            aria-label="Mobile navigation"
          >
            <div className="db-container mobile-nav__inner">
              <a href="#campaign" onClick={closeMenu}>
                Campaign
              </a>

              <a href="#phases" onClick={closeMenu}>
                Phases
              </a>

              <a href="#benefits" onClick={closeMenu}>
                Benefits
              </a>

              <a href="#product" onClick={closeMenu}>
                Product
              </a>

              <a href="#faq" onClick={closeMenu}>
                FAQ
              </a>

              <button
                type="button"
                className="db-button db-button--primary"
                onClick={openCheckout}
              >
                Purchase Now
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

          <div className="db-container campaign-hero__grid">
            <div className="campaign-hero__content">
              <div className="campaign-kicker">
                <span className="campaign-kicker__dot" />
                DIGITALBOOST ORIGIN
                <span className="campaign-kicker__divider">
                  /
                </span>
                PRE-LAUNCH
              </div>

              <h1 className="campaign-hero__title">
                FOUNDING
                <span>6000</span>
              </h1>

              <p className="campaign-hero__headline">
                Become part of the first 6,000.
              </p>

              <p className="campaign-hero__description">
                12 months of Focus Founding Access
                plus permanent Founding Member status
                when your membership is verified and
                activated.
              </p>

              <div className="campaign-hero__meta">
                <div>
                  <span>Current phase</span>
                  <strong>Genesis</strong>
                </div>

                <div>
                  <span>Reference price</span>
                  <strong>US$50</strong>
                </div>

                <div>
                  <span>Genesis range</span>
                  <strong>#0001–#1000</strong>
                </div>
              </div>

              <div className="campaign-hero__actions">
                <button
                  className="db-button db-button--primary campaign-hero__primary"
                  type="button"
                  onClick={openCheckout}
                >
                  Purchase Now
                  <span aria-hidden="true">→</span>
                </button>

                <a
                  className="db-button db-button--secondary"
                  href="#phases"
                >
                  Explore the campaign
                </a>
              </div>

              <p className="campaign-hero__disclosure">
                Product pre-order / reservation.
                Founding 6000 is not an investment,
                equity offering, security or revenue-share
                program.
              </p>
            </div>

            <aside className="launch-panel">
              <div className="launch-panel__top">
                <div>
                  <span className="launch-panel__eyebrow">
                    TARGET LAUNCH
                  </span>

                  <strong>JAN 05 · 2027</strong>
                </div>

                <span className="launch-panel__status">
                  Target
                </span>
              </div>

              {countdown.reached ? (
                <div className="launch-window">
                  <span>Launch window reached</span>

                  <p>
                    Follow DigitalBoost Origin updates for
                    current product availability.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="countdown"
                    aria-label="Countdown to target launch"
                  >
                    <CountdownUnit
                      value={countdown.days}
                      label="Days"
                    />

                    <CountdownUnit
                      value={countdown.hours}
                      label="Hours"
                    />

                    <CountdownUnit
                      value={countdown.minutes}
                      label="Min"
                    />

                    <CountdownUnit
                      value={countdown.seconds}
                      label="Sec"
                    />
                  </div>

                  <p className="launch-panel__note">
                    This is a target launch date, not a
                    guaranteed delivery date.
                  </p>
                </>
              )}

              <div className="launch-panel__line" />

              <div className="launch-panel__phase">
                <div>
                  <span>ACTIVE PHASE</span>
                  <strong>01 · Genesis</strong>
                </div>

                <span>1,000 max</span>
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
                    GLOBAL CAMPAIGN
                  </span>

                  <h2>
                    Founding membership allocation
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
                  Campaign structure
                </div>

                <h2 className="db-title">
                  Three phases. One founding cohort.
                </h2>

                <p className="db-copy">
                  Only one phase is active at a time.
                  Each phase has a fixed capacity and
                  reference price.
                </p>
              </div>

              <div className="section-heading__total">
                <span>Total capacity</span>
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
                        Active
                      </span>
                    ) : (
                      <span className="phase-card__future">
                        Upcoming
                      </span>
                    )}
                  </div>

                  <div className="phase-card__body">
                    <span className="phase-card__label">
                      Phase {phase.number}
                    </span>

                    <h3>{phase.name}</h3>

                    <div className="phase-card__price">
                      <small>Reference</small>
                      <strong>US${phase.price}</strong>
                    </div>

                    <dl className="phase-card__details">
                      <div>
                        <dt>Capacity</dt>
                        <dd>
                          {phase.capacity.toLocaleString()}
                        </dd>
                      </div>

                      <div>
                        <dt>Serial range</dt>
                        <dd>{phase.range}</dd>
                      </div>

                      <div>
                        <dt>Status</dt>
                        <dd>{phase.status}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="phase-card__bottom">
                    {phase.active
                      ? "Current campaign phase"
                      : "Opens after prior phase allocation"}
                  </div>
                </article>
              ))}
            </div>

            <div className="capacity-note">
              <span aria-hidden="true">i</span>

              <p>
                Maximum mathematical gross receipts across
                all 6,000 memberships are US$460,000.
                This represents campaign capacity
                mathematics only — not a forecast,
                current revenue or guaranteed sales.
              </p>
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
                  Founding access
                </div>

                <h2 className="db-title">
                  More than early access.
                </h2>

                <p className="db-copy">
                  Every verified Founding 6000 membership is
                  designed to include 12 months of Focus
                  Founding Access beginning when the user's
                  Founding Access account is activated.
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
                    CORE ACCESS
                  </span>

                  <h3>
                    12 months of Focus
                  </h3>

                  <p>
                    Founding Access begins on account
                    activation — not automatically on the
                    purchase date.
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
                  Permanent recognition as one of the first
                  6,000 verified DigitalBoost Origin
                  members.
                </p>
              </article>

              <article className="benefit-card">
                <span className="benefit-card__index">
                  03
                </span>

                <h3>
                  Priority beta access
                </h3>

                <p>
                  Earlier opportunities to access eligible
                  product capabilities as they become
                  available.
                </p>
              </article>

              <article className="benefit-card">
                <span className="benefit-card__index">
                  04
                </span>

                <h3>
                  Product feedback
                </h3>

                <p>
                  Opportunities to help shape product
                  decisions through structured founding
                  feedback programs.
                </p>
              </article>

              <article className="benefit-card">
                <span className="benefit-card__index">
                  05
                </span>

                <h3>
                  Connected ecosystem
                </h3>

                <p>
                  Founding recognition may later surface
                  across eligible DigitalBoost experiences
                  and community spaces.
                </p>
              </article>
            </div>

            <div className="access-boundary">
              <span className="access-boundary__icon">
                ∞
              </span>

              <div>
                <strong>
                  Founding Focus does not mean unlimited
                  infrastructure.
                </strong>

                <p>
                  DBX allowance, fair-use, AI inference,
                  compute, storage, hosting, runtime,
                  Sentinel and other technical or legal
                  limits may apply.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="genesis-section">
          <div className="db-container genesis-layout">
            <div className="genesis-visual">
              <span className="genesis-visual__eyebrow">
                FIRST 1,000
              </span>

              <strong className="genesis-visual__number">
                #0001
                <span>—</span>
                #1000
              </strong>

              <div className="genesis-visual__line" />

              <span className="genesis-visual__footer">
                Genesis distinction
              </span>
            </div>

            <div className="genesis-copy">
              <div className="db-eyebrow">
                Genesis Member
              </div>

              <h2 className="db-title">
                The first thousand carry a distinct mark.
              </h2>

              <p className="db-copy">
                The first 1,000 verified memberships receive
                Genesis Member distinction in addition to
                Founding Member status.
              </p>

              <div className="genesis-points">
                <div>
                  <span>01</span>

                  <p>
                    Permanent Genesis distinction attached to
                    the founding membership record.
                  </p>
                </div>

                <div>
                  <span>02</span>

                  <p>
                    Potential future recognition across
                    profile, Nexus and community surfaces.
                  </p>
                </div>

                <div>
                  <span>03</span>

                  <p>
                    Genesis status does not imply equity,
                    company founder status, governance or
                    financial rights.
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
                  Product truth
                </div>

                <h2 className="db-title">
                  Building the DigitalBoost ecosystem.
                </h2>

                <p className="db-copy">
                  Founding 6000 is a pre-launch campaign.
                  Product maturity is shown explicitly so
                  planned capabilities are not represented
                  as already available.
                </p>
              </div>

              <span className="truth-badge">
                CURRENT STATE
              </span>
            </div>

            <div className="product-grid">
              <article className="product-card">
                <div className="product-card__top">
                  <span>01</span>
                  <span className="product-status product-status--active">
                    Functional / In development
                  </span>
                </div>

                <h3>Commerce OS</h3>

                <p>
                  Commerce workflows and operational
                  foundations currently under active
                  development.
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
                  Visual website creation environment being
                  developed as part of DigitalBoost Studio.
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>03</span>
                  <span className="product-status product-status--building">
                    In development
                  </span>
                </div>

                <h3>PULSE</h3>

                <p>
                  Commerce orchestration capability currently
                  belonging inside Commerce OS.
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>04</span>
                  <span className="product-status product-status--active">
                    Advanced / In development
                  </span>
                </div>

                <h3>Trading Islands</h3>

                <p>
                  Advanced trading, automation, bot and
                  digital asset systems under active
                  development.
                </p>
              </article>

              <article className="product-card">
                <div className="product-card__top">
                  <span>05</span>
                  <span className="product-status product-status--building">
                    Foundation / In development
                  </span>
                </div>

                <h3>AI Forge</h3>

                <p>
                  Foundation for AI creation, agents,
                  automation, tools and deployable
                  intelligence.
                </p>
              </article>

              <article className="product-card product-card--planned">
                <div className="product-card__top">
                  <span>06</span>
                  <span className="product-status">
                    Planned
                  </span>
                </div>

                <h3>Sentinel</h3>

                <p>
                  Planned DigitalBoost capability. It is not
                  currently represented as available.
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
                  Planned ecosystem surface for future
                  connected DigitalBoost experiences.
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
                  How it works
                </div>

                <h2 className="db-title">
                  From interest to verified membership.
                </h2>
              </div>

              <p className="db-copy">
                Payment and membership state will become
                authoritative only after the secure backend
                is implemented.
              </p>
            </div>

            <div className="workflow">
              <div className="workflow-step">
                <span>01</span>
                <strong>Purchase Now</strong>
                <p>
                  Begin the Founding 6000 reservation flow.
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>02</span>
                <strong>Email</strong>
                <p>
                  Register a valid contact email first.
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>03</span>
                <strong>Confirm</strong>
                <p>
                  Review phase, reference price and terms.
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>04</span>
                <strong>Payment</strong>
                <p>
                  Choose an available supported payment rail.
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>05</span>
                <strong>Verify</strong>
                <p>
                  Server or blockchain verification confirms
                  settlement.
                </p>
              </div>

              <div className="workflow-arrow">
                →
              </div>

              <div className="workflow-step">
                <span>06</span>
                <strong>Membership</strong>
                <p>
                  Verified settlement creates the canonical
                  membership.
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
                Clear before you commit.
              </h2>

              <p className="db-copy">
                Important information about the pre-sale,
                access period, product status and campaign.
              </p>
            </div>

            <div className="faq-list">
              <details>
                <summary>
                  What exactly am I purchasing?
                </summary>

                <p>
                  A DigitalBoost Origin Founding 6000 product
                  pre-order / reservation intended to provide
                  12 months of Focus Founding Access after
                  account activation, subject to the final
                  published terms and technical limits.
                </p>
              </details>

              <details>
                <summary>
                  Is Founding 6000 an investment?
                </summary>

                <p>
                  No. It is not equity, a security, company
                  ownership, revenue sharing, financial return
                  or corporate governance.
                </p>
              </details>

              <details>
                <summary>
                  When do my 12 months begin?
                </summary>

                <p>
                  The 12-month Founding Access period begins
                  when your Founding Access account is
                  activated, not automatically on purchase
                  date.
                </p>
              </details>

              <details>
                <summary>
                  Is January 5, 2027 guaranteed?
                </summary>

                <p>
                  No. January 5, 2027 is the current target
                  launch date. It is explicitly not presented
                  as a guaranteed delivery date.
                </p>
              </details>

              <details>
                <summary>
                  Does Focus include unlimited usage?
                </summary>

                <p>
                  No. DBX allowance, fair-use, compute,
                  infrastructure, AI inference, storage,
                  hosting, bot/runtime and other technical or
                  legal limits may apply.
                </p>
              </details>

              <details>
                <summary>
                  Which payment methods are planned?
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
                  What happens if the product is delayed?
                </summary>

                <p>
                  Delay handling, refund, cancellation and
                  delivery terms must be finalized and
                  published before real payments are enabled.
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
                  Be part of the first 6,000.
                </h2>

                <p>
                  Genesis is the first campaign phase with a
                  reference price of US$50 and a maximum
                  capacity of 1,000 verified memberships.
                </p>

                <div className="purchase-panel__meta">
                  <div>
                    <span>Phase</span>
                    <strong>Genesis</strong>
                  </div>

                  <div>
                    <span>Reference</span>
                    <strong>US$50</strong>
                  </div>

                  <div>
                    <span>Capacity</span>
                    <strong>1,000</strong>
                  </div>
                </div>

                <button
                  className="db-button db-button--primary purchase-panel__button"
                  type="button"
                  onClick={openCheckout}
                >
                  Purchase Now
                  <span aria-hidden="true">→</span>
                </button>

                <span className="purchase-panel__note">
                  Checkout currently runs in prototype mode.
                  No real payment, reservation or membership
                  is created at this stage.
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
              Founding 6000 · Pre-order / reservation program.
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
              Terms
            </a>

            <a
              href="/legal/privacy.html"
              target="_blank"
              rel="noreferrer"
            >
              Privacy
            </a>

            <a
              href="/legal/refunds.html"
              target="_blank"
              rel="noreferrer"
            >
              Refunds
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
                  FOUNDING 6000 · PROTOTYPE
                </span>

                <strong id="checkout-title">
                  Purchase reservation
                </strong>
              </div>

              <button
                className="checkout-close"
                type="button"
                aria-label="Close checkout"
                onClick={closeCheckout}
              >
                ×
              </button>
            </header>

            <p
              id="checkout-prototype-note"
              className="sr-only"
            >
              This is a frontend checkout prototype.
              No real payment, reservation or membership
              is created.
            </p>

            <div className="checkout-progress">
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
                    STEP 01 / 04
                  </span>

                  <h2>
                    Start with your email.
                  </h2>

                  <p>
                    Email is required before beginning a
                    Founding 6000 reservation. It will later
                    be used for reservation contact,
                    confirmation, launch notifications and
                    account activation.
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
                      Email is a contact identifier for this
                      prototype. It is not canonical user
                      identity and does not prove payment.
                    </p>
                  </div>

                  <button
                    className="db-button db-button--primary checkout-main-button"
                    type="button"
                    onClick={submitEmail}
                  >
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}

              {checkoutStep === "confirm" && (
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

              {checkoutStep === "method" && (
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

              {checkoutStep === "details" && (
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
                    PROTOTYPE COMPLETE
                  </span>

                  <h2>
                    The checkout UX works.
                  </h2>

                  <p>
                    No payment was made and no Founding 6000
                    membership was created. This screen only
                    confirms that the F3 frontend prototype
                    flow has been completed.
                  </p>

                  <div className="checkout-summary">
                    <div>
                      <span>Email</span>
                      <strong>{email}</strong>
                    </div>

                    <div>
                      <span>Payment method</span>
                      <strong>
                        {paymentMethodLabel()}
                      </strong>
                    </div>

                    <div>
                      <span>Payment state</span>
                      <strong>NOT PROCESSED</strong>
                    </div>
                  </div>

                  <div className="checkout-actions">
                    <button
                      className="db-button db-button--secondary"
                      type="button"
                      onClick={resetCheckout}
                    >
                      Restart prototype
                    </button>

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
                Frontend prototype
              </span>

              <span>
                Payment authority: disabled
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
