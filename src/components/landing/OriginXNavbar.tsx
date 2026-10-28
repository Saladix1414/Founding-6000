import { useEffect, useRef } from "react";
import "../../styles/originx-navbar.css";

type Language = "es" | "en";

type Props = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  ctaLabel: string;
  onCheckout: () => void;
  onEconomy: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
};

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 6.5h14M5 17.5h14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

export default function OriginXNavbar({
  language,
  onLanguageChange,
  ctaLabel,
  onCheckout,
  onEconomy,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: Props) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const es = language === "es";

  useEffect(() => {
    if (!menuOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseMenu();
        menuButton.current?.focus();
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 1200) onCloseMenu();
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
    };
  }, [menuOpen, onCloseMenu]);

  const openEconomy = () => {
    onCloseMenu();
    onEconomy();
  };

  const openCheckout = () => {
    onCloseMenu();
    onCheckout();
  };

  const links = (
    <>
      <a className="ox-nav-home" href="#top" onClick={onCloseMenu}>
        {es ? "Inicio" : "Home"}
      </a>
      <a href="#phases" onClick={onCloseMenu}>
        {es ? "Colección" : "Collection"}
      </a>
      <button
        type="button"
        onClick={openEconomy}
        aria-label={es ? "Economía: abrir whitepaper" : "Economy: open whitepaper"}
      >
        {es ? "Economía" : "Economy"}
      </button>
      <a href="#product" onClick={onCloseMenu}>
        {es ? "Proyecto" : "Project"}
      </a>
      <a href="#faq" onClick={onCloseMenu}>FAQ</a>
    </>
  );

  return (
    <header className="ox-landing ox-navbar">
      <div className="ox-navbar-inner">
        <a
          className="ox-brand"
          href="#top"
          aria-label="OriginX Foundation — Founding 6000"
          onClick={onCloseMenu}
        >
          <span className="ox-brand-word" aria-hidden="true">
            ORIGIN<span>X</span>
          </span>
          <span className="ox-brand-foundation" aria-hidden="true">
            FOUNDATION
          </span>
        </a>

        <nav
          className="ox-nav-desktop"
          aria-label={es ? "Navegación principal" : "Primary navigation"}
        >
          {links}
        </nav>

        <div className="ox-navbar-actions">
          <label className="ox-language">
            <span className="ox-navbar-sr-only">
              {es ? "Idioma" : "Language"}
            </span>
            <GlobeIcon />
            <select
              value={language}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "es" || value === "en") {
                  onLanguageChange(value);
                }
              }}
            >
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
          </label>

          <button
            className="ox-nav-cta ox-nav-cta-desktop"
            type="button"
            onClick={openCheckout}
          >
            <span>{ctaLabel}</span>
            <ArrowIcon />
          </button>

          <button
            ref={menuButton}
            className="ox-menu-toggle"
            type="button"
            aria-label={
              es
                ? menuOpen ? "Cerrar menú" : "Abrir menú"
                : menuOpen ? "Close menu" : "Open menu"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={onToggleMenu}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {menuOpen
                ? <path d="m6 6 12 12M6 18 18 6" />
                : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      <nav
        id="mobile-navigation"
        className="ox-nav-mobile"
        hidden={!menuOpen}
        aria-label={es ? "Navegación móvil" : "Mobile navigation"}
      >
        <div className="ox-nav-mobile-links">{links}</div>
        <button
          className="ox-nav-cta"
          type="button"
          onClick={openCheckout}
        >
          <span>{ctaLabel}</span>
          <ArrowIcon />
        </button>
      </nav>
    </header>
  );
}
