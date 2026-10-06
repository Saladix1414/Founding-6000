export type WhitepaperLanguage =
  | "en"
  | "es";

export type LocalizedText = {
  en: string;
  es: string;
};

export type WhitepaperCard = {
  title: string;
  text: LocalizedText;
};

export type WhitepaperSection = {
  id: string;
  number: string;
  label: string;
  title: LocalizedText;
  summary: LocalizedText;
  paragraphs?: LocalizedText[];
  bullets?: LocalizedText[];
  flow?: string[];
  cards?: WhitepaperCard[];
};

export const WHITEPAPER_BRAND =
  "DigitalBoost Origin";

export const WHITEPAPER_ORIGIN_LAYER =
  "DigitalBoost OriginX";

export const whitepaperSections:
  WhitepaperSection[] = [
  {
    id: "manifesto",
    number: "00",
    label: "MANIFESTO",
    title: {
      en: "A Digital Business Operating System",
      es: "Un sistema operativo para negocios digitales",
    },
    summary: {
      en: "DigitalBoost Origin is conceived as an integrated digital operating environment for creating, operating, automating, connecting, analyzing, protecting and evolving digital businesses and products.",
      es: "DigitalBoost Origin se concibe como un entorno operativo digital integrado para crear, operar, automatizar, conectar, analizar, proteger y hacer evolucionar negocios y productos digitales.",
    },
    paragraphs: [
      {
        en: "The project is not based on the idea of accumulating unrelated tools. Its central thesis is that specialized systems become substantially more useful when they share identity, data, infrastructure, intelligence, economics, observability and orchestration.",
        es: "El proyecto no parte de la idea de acumular herramientas aisladas. Su tesis central es que los sistemas especializados adquieren mucho más valor cuando comparten identidad, datos, infraestructura, inteligencia, economía, observabilidad y orquestación.",
      },
      {
        en: "Each island focuses on a specific domain. PULSE exists above those domains as the transversal intelligence capable of understanding context, intent and objectives, and coordinating the capabilities required to pursue them.",
        es: "Cada isla se especializa en un dominio concreto. PULSE existe por encima de esos dominios como la inteligencia transversal capaz de comprender contexto, intención y objetivos, y coordinar las capacidades necesarias para perseguirlos.",
      },
    ],
    flow: [
      "CREATE",
      "OPERATE",
      "INTELLIGENCE",
      "CONNECT",
      "TRADE",
      "SECURE",
      "MEASURE",
      "EVOLVE",
    ],
  },

  {
    id: "ecosystem",
    number: "01",
    label: "ECOSYSTEM",
    title: {
      en: "Specialists connected by a common foundation",
      es: "Especialistas conectados por una base común",
    },
    summary: {
      en: "The ecosystem is organized around six major specialized areas, with PULSE operating as its transversal brain.",
      es: "El ecosistema se organiza alrededor de seis grandes áreas especializadas, con PULSE funcionando como su cerebro transversal.",
    },
    cards: [
      {
        title: "Commerce OS",
        text: {
          en: "Operate products, customers, orders, inventory, payments, marketing and commercial intelligence.",
          es: "Operar productos, clientes, pedidos, inventario, pagos, marketing e inteligencia comercial.",
        },
      },
      {
        title: "Web Builder",
        text: {
          en: "Build complete digital experiences through visual development, AI, data and code.",
          es: "Construir experiencias digitales completas mediante desarrollo visual, IA, datos y código.",
        },
      },
      {
        title: "AI Forge",
        text: {
          en: "Build intelligent systems from models, agents, knowledge, tools, memory, skills and workflows.",
          es: "Construir sistemas inteligentes a partir de modelos, agentes, conocimiento, herramientas, memoria, skills y workflows.",
        },
      },
      {
        title: "Trading Islands",
        text: {
          en: "Analyze markets, design strategies, simulate execution, operate bots and create digital assets.",
          es: "Analizar mercados, diseñar estrategias, simular ejecución, operar bots y crear activos digitales.",
        },
      },
      {
        title: "Sentinel",
        text: {
          en: "Study cybersecurity through authorized assessment, pentesting, ethical hacking, red team, hardening and remediation.",
          es: "Trabajar ciberseguridad mediante assessment autorizado, pentesting, hacking ético, red team, hardening y remediación.",
        },
      },
      {
        title: "Nexus",
        text: {
          en: "Connect DigitalBoost with APIs, SaaS, data platforms, communication systems and external infrastructure.",
          es: "Conectar DigitalBoost con APIs, SaaS, plataformas de datos, sistemas de comunicación e infraestructura externa.",
        },
      },
    ],
  },

  {
    id: "pulse",
    number: "02",
    label: "PULSE",
    title: {
      en: "The transversal brain",
      es: "El cerebro transversal",
    },
    summary: {
      en: "PULSE is the intelligence, context, coordination and orchestration system of DigitalBoost Origin.",
      es: "PULSE es el sistema de inteligencia, contexto, coordinación y orquestación de DigitalBoost Origin.",
    },
    paragraphs: [
      {
        en: "PULSE does not represent a business activity of its own and does not replace the islands. It interprets what the user is trying to achieve and determines which capabilities, resources and systems may be relevant.",
        es: "PULSE no representa una actividad empresarial propia y no reemplaza a las islas. Interpreta qué intenta conseguir el usuario y determina qué capacidades, recursos y sistemas pueden resultar relevantes.",
      },
      {
        en: "Its conceptual domain includes context, intent, goals, planning, policies, governance, approvals, missions, execution, verification, evidence, audit, memory, learning and next action.",
        es: "Su dominio conceptual incluye contexto, intención, objetivos, planificación, políticas, gobernanza, aprobaciones, misiones, ejecución, verificación, evidencia, auditoría, memoria, aprendizaje y siguiente acción.",
      },
    ],
    flow: [
      "INTENT",
      "CONTEXT",
      "PLAN",
      "COORDINATE",
      "EXECUTE",
      "VERIFY",
      "LEARN",
    ],
  },

  {
    id: "commerce",
    number: "03",
    label: "COMMERCE OS",
    title: {
      en: "The commercial operating system",
      es: "El sistema operativo comercial",
    },
    summary: {
      en: "Commerce OS is the business core where commercial operations live.",
      es: "Commerce OS es el núcleo empresarial donde vive la operación comercial.",
    },
    paragraphs: [
      {
        en: "Its purpose extends beyond building an online store. Commerce OS models the commercial reality of a business: what it sells, who buys, what inventory exists, how orders progress, how customers behave and how commercial decisions are measured.",
        es: "Su propósito va más allá de construir una tienda online. Commerce OS modela la realidad comercial de un negocio: qué vende, quién compra, qué inventario existe, cómo avanzan los pedidos, cómo se comportan los clientes y cómo se miden las decisiones comerciales.",
      },
    ],
    cards: [
      {
        title: "Catalog",
        text: {
          en: "Products, variants, categories, attributes, pricing, media, stock, suppliers and commercial metadata.",
          es: "Productos, variantes, categorías, atributos, precios, media, stock, proveedores y metadata comercial.",
        },
      },
      {
        title: "Customers",
        text: {
          en: "Profiles, lifecycle, history, behavior, segments, preferences and commercial context.",
          es: "Perfiles, lifecycle, historial, comportamiento, segmentos, preferencias y contexto comercial.",
        },
      },
      {
        title: "Orders",
        text: {
          en: "Cart, checkout, payment, order, fulfillment, delivery and post-sale operations.",
          es: "Carrito, checkout, pago, pedido, fulfillment, entrega y operación postventa.",
        },
      },
      {
        title: "Inventory",
        text: {
          en: "Stock, reservations, movements, locations, alerts and synchronization.",
          es: "Stock, reservas, movimientos, ubicaciones, alertas y sincronización.",
        },
      },
      {
        title: "Marketing",
        text: {
          en: "Campaigns, promotions, segmentation, lifecycle automation and growth analysis.",
          es: "Campañas, promociones, segmentación, automatización de lifecycle y análisis de crecimiento.",
        },
      },
      {
        title: "Analytics",
        text: {
          en: "Sales, conversion, customers, retention, products, inventory, revenue and campaign performance.",
          es: "Ventas, conversión, clientes, retención, productos, inventario, revenue y rendimiento de campañas.",
        },
      },
    ],
    flow: [
      "PRODUCT",
      "CART",
      "CHECKOUT",
      "PAYMENT",
      "ORDER",
      "FULFILLMENT",
      "DELIVERY",
      "POST-SALE",
    ],
  },

  {
    id: "store-builder",
    number: "04",
    label: "STORE BUILDER",
    title: {
      en: "The visual commerce layer",
      es: "La capa visual de comercio",
    },
    summary: {
      en: "Store Builder is part of Commerce OS. It transforms commerce data and operations into a customer-facing shopping experience.",
      es: "Store Builder forma parte de Commerce OS. Transforma los datos y operaciones comerciales en una experiencia de compra orientada al cliente.",
    },
    paragraphs: [
      {
        en: "Its domain includes storefronts, product pages, categories, navigation, carts, checkout, promotions, responsive behavior, design and personalization.",
        es: "Su dominio incluye storefronts, páginas de producto, categorías, navegación, carrito, checkout, promociones, responsive, diseño y personalización.",
      },
      {
        en: "The fundamental distinction is simple: Web Builder builds websites and digital experiences. Store Builder builds commerce experiences whose source of truth comes from Commerce OS.",
        es: "La diferencia fundamental es simple: Web Builder construye sitios y experiencias digitales. Store Builder construye experiencias comerciales cuya fuente de verdad proviene de Commerce OS.",
      },
    ],
    flow: [
      "COMMERCE DATA",
      "STOREFRONT",
      "SHOPPING EXPERIENCE",
      "CHECKOUT",
      "CUSTOMER",
      "ANALYTICS",
    ],
  },

  {
    id: "web-builder",
    number: "05",
    label: "WEB BUILDER",
    title: {
      en: "Build the web",
      es: "Construir la web",
    },
    summary: {
      en: "Web Builder is the AI-native visual web development environment of DigitalBoost Origin.",
      es: "Web Builder es el entorno AI-native de desarrollo web visual de DigitalBoost Origin.",
    },
    paragraphs: [
      {
        en: "The objective is not to generate isolated landing pages, but to cover the complete lifecycle of a modern web product: intent, architecture, design system, visual construction, data, integrations, responsive behavior, discoverability, publishing and continuous improvement.",
        es: "El objetivo no es generar landing pages aisladas, sino cubrir el ciclo completo de un producto web moderno: intención, arquitectura, design system, construcción visual, datos, integraciones, responsive, descubribilidad, publicación y mejora continua.",
      },
    ],
    cards: [
      {
        title: "AI Creation",
        text: {
          en: "Translate natural-language intent into briefs, pages, sections, components, content and visual systems.",
          es: "Traducir intención en lenguaje natural en briefs, páginas, secciones, componentes, contenido y sistemas visuales.",
        },
      },
      {
        title: "Design System",
        text: {
          en: "Colors, typography, spacing, grids, components, layouts, responsive rules and motion.",
          es: "Colores, tipografía, spacing, grids, componentes, layouts, reglas responsive y motion.",
        },
      },
      {
        title: "Canvas",
        text: {
          en: "A visual environment for selecting, editing, moving and refining the actual digital experience.",
          es: "Un entorno visual para seleccionar, editar, mover y refinar la experiencia digital real.",
        },
      },
      {
        title: "Data",
        text: {
          en: "CMS, databases, APIs, Commerce OS, forms, analytics and external services.",
          es: "CMS, bases de datos, APIs, Commerce OS, formularios, analytics y servicios externos.",
        },
      },
      {
        title: "Discovery",
        text: {
          en: "SEO, AEO and GEO as complementary strategies for search engines, answer engines and generative discovery.",
          es: "SEO, AEO y GEO como estrategias complementarias para buscadores, motores de respuesta y descubrimiento generativo.",
        },
      },
    ],
    flow: [
      "IDEA",
      "BRIEF",
      "STRUCTURE",
      "DESIGN",
      "BUILD",
      "DATA",
      "DISCOVERY",
      "RESPONSIVE",
      "PUBLISH",
      "IMPROVE",
    ],
  },

  {
    id: "ai-forge",
    number: "06",
    label: "AI FORGE",
    title: {
      en: "Build intelligence",
      es: "Construir inteligencia",
    },
    summary: {
      en: "AI Forge is the environment where intelligent systems are assembled, evaluated and operated.",
      es: "AI Forge es el entorno donde se construyen, evalúan y operan sistemas inteligentes.",
    },
    paragraphs: [
      {
        en: "Its purpose is broader than providing access to language models. AI Forge combines models with agents, knowledge, memory, tools, reusable skills, workflows, evaluation and deployment.",
        es: "Su propósito es más amplio que ofrecer acceso a modelos de lenguaje. AI Forge combina modelos con agentes, conocimiento, memoria, herramientas, skills reutilizables, workflows, evaluación y deployment.",
      },
      {
        en: "DigitalBoost may favor open, local or self-hosted models when that improves control, economics, privacy or operational flexibility, while retaining routing and fallback capabilities across different model providers.",
        es: "DigitalBoost puede favorecer modelos abiertos, locales o self-hosted cuando eso mejore control, economía, privacidad o flexibilidad operativa, manteniendo capacidades de routing y fallback entre diferentes proveedores.",
      },
    ],
    cards: [
      {
        title: "Models",
        text: {
          en: "Open, local, self-hosted and external models with routing, fallback and inference infrastructure.",
          es: "Modelos abiertos, locales, self-hosted y externos con routing, fallback e infraestructura de inferencia.",
        },
      },
      {
        title: "Agents",
        text: {
          en: "Identity, objectives, instructions, tools, memory, knowledge, skills, policies and runtime.",
          es: "Identidad, objetivos, instrucciones, herramientas, memoria, conocimiento, skills, políticas y runtime.",
        },
      },
      {
        title: "Knowledge",
        text: {
          en: "Documents, procedures, business information, datasets and retrievable context.",
          es: "Documentos, procedimientos, información empresarial, datasets y contexto recuperable.",
        },
      },
      {
        title: "Tools",
        text: {
          en: "APIs, databases, internal services, MCP, automation and specialized capabilities.",
          es: "APIs, bases de datos, servicios internos, MCP, automatización y capacidades especializadas.",
        },
      },
      {
        title: "Workflows",
        text: {
          en: "Structured multi-step execution combining agents, data, validation, actions and notifications.",
          es: "Ejecución estructurada de múltiples pasos combinando agentes, datos, validación, acciones y notificaciones.",
        },
      },
      {
        title: "Evaluation",
        text: {
          en: "Quality, precision, consistency, latency, cost, tool usage, regressions, failures and safety.",
          es: "Calidad, precisión, consistencia, latencia, coste, uso de herramientas, regresiones, fallos y seguridad.",
        },
      },
    ],
  },

  {
    id: "trading-islands",
    number: "07",
    label: "TRADING ISLANDS",
    title: {
      en: "Analyze. Strategize. Create. Operate.",
      es: "Analizar. Diseñar. Crear. Operar.",
    },
    summary: {
      en: "Trading Islands combines market intelligence, strategy research, simulation, automation and digital assets.",
      es: "Trading Islands combina inteligencia de mercado, investigación de estrategias, simulación, automatización y activos digitales.",
    },
    paragraphs: [
      {
        en: "The trading side begins with normalized market data and progresses through professional analysis, indicators, structured strategy design, backtesting, paper trading, risk control and bot operation.",
        es: "La parte de trading comienza con market data normalizada y avanza mediante análisis profesional, indicadores, diseño estructurado de estrategias, backtesting, paper trading, control de riesgo y operación de bots.",
      },
      {
        en: "Artificial intelligence may assist in translating a trading thesis into a structured strategy, but it does not transform historical simulations into guarantees of future profitability.",
        es: "La inteligencia artificial puede ayudar a traducir una tesis de trading en una estrategia estructurada, pero no convierte simulaciones históricas en garantías de rentabilidad futura.",
      },
    ],
    cards: [
      {
        title: "Trading Terminal",
        text: {
          en: "Charts, watchlists, indicators, timeframes, signals, positions, portfolios and market context.",
          es: "Charts, watchlists, indicadores, timeframes, señales, posiciones, portfolios y contexto de mercado.",
        },
      },
      {
        title: "Strategy Builder",
        text: {
          en: "Markets, timeframes, indicators, entries, exits, stops, targets, sizing and risk rules.",
          es: "Mercados, timeframes, indicadores, entradas, salidas, stops, targets, sizing y reglas de riesgo.",
        },
      },
      {
        title: "Backtesting",
        text: {
          en: "Historical research with returns, drawdown, win rate, profit factor, exposure and equity analysis.",
          es: "Investigación histórica con retorno, drawdown, win rate, profit factor, exposición y análisis de equity.",
        },
      },
      {
        title: "Paper Trading",
        text: {
          en: "Operational simulation including fills, fees, slippage, positions and approximate latency.",
          es: "Simulación operativa incluyendo fills, fees, slippage, posiciones y latencia aproximada.",
        },
      },
      {
        title: "Risk Engine",
        text: {
          en: "Exposure, position limits, daily loss, leverage, drawdown, stops and emergency controls.",
          es: "Exposición, límites de posición, pérdida diaria, leverage, drawdown, stops y controles de emergencia.",
        },
      },
      {
        title: "Bot Forge",
        text: {
          en: "Transform structured strategies into testable and monitorable automated systems.",
          es: "Transformar estrategias estructuradas en sistemas automatizados testeables y monitorizables.",
        },
      },
    ],
    flow: [
      "MARKET DATA",
      "ANALYSIS",
      "STRATEGY",
      "BACKTEST",
      "PAPER",
      "RISK",
      "BOT",
      "MONITOR",
    ],
  },

  {
    id: "nft-forge",
    number: "08",
    label: "NFT FORGE",
    title: {
      en: "Digital assets with identity and history",
      es: "Activos digitales con identidad e historia",
    },
    summary: {
      en: "NFT Forge is the digital-asset creation environment inside Trading Islands.",
      es: "NFT Forge es el entorno de creación de activos digitales dentro de Trading Islands.",
    },
    paragraphs: [
      {
        en: "Its conceptual pipeline covers asset creation, metadata, traits, collections, verification and minting. The objective is to treat the digital asset as more than a media file by preserving identity, context and provenance.",
        es: "Su pipeline conceptual cubre creación del activo, metadata, traits, colecciones, verificación y minting. El objetivo es tratar el activo digital como algo más que un archivo multimedia preservando identidad, contexto y procedencia.",
      },
      {
        en: "DigitalBoost OriginX is the provenance and creative-identity layer of NFT Forge. It can combine NFT DNA, Forge Certificate, creation timeline, provenance, dynamic metadata, Origin Signature and Origin Master.",
        es: "DigitalBoost OriginX es la capa de procedencia e identidad creativa de NFT Forge. Puede combinar NFT DNA, Forge Certificate, timeline de creación, provenance, metadata dinámica, Origin Signature y Origin Master.",
      },
    ],
    cards: [
      {
        title: "NFT DNA",
        text: {
          en: "Creator, collection, traits, media hash, creation time, Forge configuration and version.",
          es: "Creador, colección, traits, media hash, tiempo de creación, configuración de Forge y versión.",
        },
      },
      {
        title: "OriginX",
        text: {
          en: "A structured representation of how a digital creation originated and evolved.",
          es: "Una representación estructurada de cómo se originó y evolucionó una creación digital.",
        },
      },
      {
        title: "Forge Modes",
        text: {
          en: "Classic, Generative, Living, Story, Immersive, Signature and Master creation modes.",
          es: "Modos de creación Classic, Generative, Living, Story, Immersive, Signature y Master.",
        },
      },
      {
        title: "Marketplace",
        text: {
          en: "Collections, creators, listings, offers, sales, activity and rich asset identity.",
          es: "Colecciones, creadores, listings, ofertas, ventas, actividad e identidad enriquecida del activo.",
        },
      },
    ],
    flow: [
      "CREATE",
      "ASSET",
      "METADATA",
      "TRAITS",
      "COLLECTION",
      "ORIGINX",
      "VERIFY",
      "MINT",
    ],
  },

  {
    id: "sentinel",
    number: "09",
    label: "SENTINEL",
    title: {
      en: "Think like an attacker. Build like a defender.",
      es: "Pensar como un atacante. Construir como un defensor.",
    },
    summary: {
      en: "Sentinel is the cybersecurity island of DigitalBoost Origin, focused on authorized security assessment, pentesting, ethical hacking, red team, hardening, remediation and continuous security understanding.",
      es: "Sentinel es la isla de ciberseguridad de DigitalBoost Origin, enfocada en assessment autorizado, pentesting, hacking ético, red team, hardening, remediación y comprensión continua de la seguridad.",
    },
    paragraphs: [
      {
        en: "Sentinel approaches cybersecurity as a lifecycle rather than a scanner. The goal is to understand attack surfaces, discover weaknesses, validate real exposure within authorized scope, measure impact, remediate findings and verify that corrective actions actually worked.",
        es: "Sentinel aborda la ciberseguridad como un ciclo de vida y no como un scanner. El objetivo es comprender superficies de ataque, descubrir debilidades, validar exposición real dentro de un alcance autorizado, medir impacto, remediar findings y verificar que las correcciones realmente funcionaron.",
      },
      {
        en: "Its methodology can draw from professional frameworks such as OWASP WSTG, NIST SP 800-115 and MITRE ATT&CK to provide structured terminology for testing and adversary behavior.",
        es: "Su metodología puede apoyarse en marcos profesionales como OWASP WSTG, NIST SP 800-115 y MITRE ATT&CK para disponer de un lenguaje estructurado de testing y comportamiento adversario.",
      },
    ],
    cards: [
      {
        title: "Pentesting",
        text: {
          en: "Controlled offensive assessment of web applications, APIs, networks, infrastructure, cloud and identities.",
          es: "Evaluación ofensiva controlada de aplicaciones web, APIs, redes, infraestructura, cloud e identidades.",
        },
      },
      {
        title: "Vulnerability Assessment",
        text: {
          en: "Discover, classify and prioritize weaknesses while separating detection from validated exploitability and impact.",
          es: "Descubrir, clasificar y priorizar debilidades diferenciando detección de explotabilidad validada e impacto.",
        },
      },
      {
        title: "Red Team",
        text: {
          en: "Study broader adversary paths, behaviors and possible chains of compromise within authorized environments.",
          es: "Estudiar rutas adversarias, comportamientos y posibles cadenas de compromiso dentro de entornos autorizados.",
        },
      },
      {
        title: "Hardening",
        text: {
          en: "Reduce attack surface through stronger configuration, privilege control, segmentation, secrets management and defensive controls.",
          es: "Reducir superficie de ataque mediante configuración segura, control de privilegios, segmentación, gestión de secretos y controles defensivos.",
        },
      },
      {
        title: "Findings",
        text: {
          en: "Represent vulnerabilities as managed objects containing evidence, severity, confidence, impact, remediation and retest history.",
          es: "Representar vulnerabilidades como objetos gestionables con evidencia, severidad, confianza, impacto, remediación e historial de retest.",
        },
      },
      {
        title: "Security AI",
        text: {
          en: "Correlate findings, analyze logs and configurations, study code, build threat models and assist remediation and reporting.",
          es: "Correlacionar findings, analizar logs y configuraciones, estudiar código, construir threat models y asistir remediación y reporting.",
        },
      },
    ],
    flow: [
      "ATTACK SURFACE",
      "ASSESS",
      "DISCOVER",
      "VALIDATE",
      "FINDINGS",
      "REMEDIATE",
      "RETEST",
      "POSTURE",
    ],
  },

  {
    id: "nexus",
    number: "10",
    label: "NEXUS",
    title: {
      en: "Connect everything",
      es: "Conectar todo",
    },
    summary: {
      en: "Nexus is the connectivity layer responsible for linking DigitalBoost Origin with external systems.",
      es: "Nexus es la capa de conectividad responsable de vincular DigitalBoost Origin con sistemas externos.",
    },
    paragraphs: [
      {
        en: "Instead of treating every integration as isolated custom code, Nexus turns connectivity into a reusable ecosystem capability.",
        es: "En lugar de tratar cada integración como código personalizado aislado, Nexus convierte la conectividad en una capacidad reutilizable del ecosistema.",
      },
      {
        en: "Its domain includes APIs, SaaS, payment providers, CRMs, ERPs, social networks, databases, cloud services, communication platforms, private APIs, MCP, webhooks and event synchronization.",
        es: "Su dominio incluye APIs, SaaS, proveedores de pago, CRMs, ERPs, redes sociales, bases de datos, servicios cloud, plataformas de comunicación, APIs privadas, MCP, webhooks y sincronización de eventos.",
      },
    ],
    cards: [
      {
        title: "Connectors",
        text: {
          en: "Structured integrations with systems such as Stripe, Shopify, Telegram, Meta, Google, CRM platforms and private services.",
          es: "Integraciones estructuradas con sistemas como Stripe, Shopify, Telegram, Meta, Google, plataformas CRM y servicios privados.",
        },
      },
      {
        title: "Gateway",
        text: {
          en: "Common handling of authentication, requests, responses, retries, rate limits, transformations and errors.",
          es: "Manejo común de autenticación, requests, responses, retries, rate limits, transformaciones y errores.",
        },
      },
      {
        title: "Events",
        text: {
          en: "Translate external webhooks and signals into internal events usable by the rest of DigitalBoost.",
          es: "Traducir webhooks y señales externas en eventos internos utilizables por el resto de DigitalBoost.",
        },
      },
      {
        title: "Synchronization",
        text: {
          en: "Keep customer, product and operational data aligned between DigitalBoost and external platforms.",
          es: "Mantener alineados datos de clientes, productos y operaciones entre DigitalBoost y plataformas externas.",
        },
      },
    ],
  },

  {
    id: "shared-core",
    number: "11",
    label: "SHARED CORE",
    title: {
      en: "The common foundation",
      es: "La base común",
    },
    summary: {
      en: "The islands share a common operational foundation instead of rebuilding identity, economics, storage, measurement and audit independently.",
      es: "Las islas comparten una base operacional común en lugar de reconstruir identidad, economía, almacenamiento, medición y auditoría de forma independiente.",
    },
    cards: [
      {
        title: "Identity",
        text: {
          en: "Users, accounts, organizations, tenants, roles, permissions, authentication and sessions.",
          es: "Usuarios, cuentas, organizaciones, tenants, roles, permisos, autenticación y sesiones.",
        },
      },
      {
        title: "DBX",
        text: {
          en: "An internal utility unit for measuring consumption of selected capabilities and resources.",
          es: "Una unidad interna de utilidad para representar consumo de determinadas capacidades y recursos.",
        },
      },
      {
        title: "Billing",
        text: {
          en: "Plans define access and capacity; DBX represents consumption and utility.",
          es: "Los planes definen acceso y capacidad; DBX representa consumo y utilidad.",
        },
      },
      {
        title: "Telemetry",
        text: {
          en: "Measure CPU, GPU, tokens, duration, storage, network, RPC and other operational costs.",
          es: "Medir CPU, GPU, tokens, duración, almacenamiento, red, RPC y otros costes operativos.",
        },
      },
      {
        title: "Observability",
        text: {
          en: "Logs, metrics, traces, health, alerts, performance and service visibility.",
          es: "Logs, métricas, traces, health, alertas, performance y visibilidad de servicios.",
        },
      },
      {
        title: "Storage",
        text: {
          en: "Structured databases, temporary state, caches, queues and object storage.",
          es: "Bases estructuradas, estado temporal, caches, queues y object storage.",
        },
      },
      {
        title: "Infrastructure",
        text: {
          en: "Compute, containers, databases, storage, CDN, workers, networking, GPUs and backups.",
          es: "Compute, containers, bases de datos, storage, CDN, workers, networking, GPUs y backups.",
        },
      },
      {
        title: "Audit",
        text: {
          en: "Historical evidence of who acted, what happened, when it happened, on which resource and with what result.",
          es: "Evidencia histórica de quién actuó, qué ocurrió, cuándo, sobre qué recurso y con qué resultado.",
        },
      },
    ],
  },

  {
    id: "journeys",
    number: "12",
    label: "ECOSYSTEM JOURNEYS",
    title: {
      en: "The value appears when the islands work together",
      es: "El valor aparece cuando las islas trabajan juntas",
    },
    summary: {
      en: "DigitalBoost Origin is designed around complete journeys that cross product boundaries.",
      es: "DigitalBoost Origin está diseñado alrededor de recorridos completos que atraviesan los límites entre productos.",
    },
    cards: [
      {
        title: "Launch a brand",
        text: {
          en: "Commerce OS manages products and customers; Store Builder creates the shop; Web Builder creates the brand experience; AI Forge creates intelligent automation; Nexus connects external services; Sentinel evaluates security; PULSE coordinates the journey.",
          es: "Commerce OS gestiona productos y clientes; Store Builder crea la tienda; Web Builder crea la experiencia de marca; AI Forge crea automatización inteligente; Nexus conecta servicios externos; Sentinel evalúa seguridad; PULSE coordina el recorrido.",
        },
      },
      {
        title: "Build a trading system",
        text: {
          en: "Trading Terminal explores the market; Strategy Builder formalizes a thesis; AI Forge can assist its construction; Backtesting studies history; Paper Trading simulates execution; Risk controls exposure; Bot Forge operationalizes the strategy.",
          es: "Trading Terminal explora el mercado; Strategy Builder formaliza una tesis; AI Forge puede asistir su construcción; Backtesting estudia el histórico; Paper Trading simula ejecución; Risk controla exposición; Bot Forge operacionaliza la estrategia.",
        },
      },
      {
        title: "Strengthen security",
        text: {
          en: "Sentinel discovers the attack surface, assesses architecture, identifies and validates weaknesses, creates findings, supports remediation, performs retesting and maintains an evolving security posture.",
          es: "Sentinel descubre la superficie de ataque, evalúa arquitectura, identifica y valida debilidades, crea findings, acompaña remediación, realiza retesting y mantiene una postura de seguridad evolutiva.",
        },
      },
    ],
  },

  {
    id: "vision",
    number: "13",
    label: "UNIFIED VISION",
    title: {
      en: "One ecosystem, many specialized capabilities",
      es: "Un ecosistema, múltiples capacidades especializadas",
    },
    summary: {
      en: "The ambition of DigitalBoost Origin is not that every island becomes impressive in isolation. Its real value is the system that emerges when specialized capabilities can share context and work together.",
      es: "La ambición de DigitalBoost Origin no es que cada isla resulte impresionante por separado. Su verdadero valor está en el sistema que emerge cuando capacidades especializadas pueden compartir contexto y trabajar juntas.",
    },
    paragraphs: [
      {
        en: "Commerce operates the business. Web Builder creates its digital presence. AI Forge constructs intelligence. Trading Islands analyzes markets and creates digital assets. Sentinel evaluates and strengthens security. Nexus connects the ecosystem with the outside world. PULSE understands context and coordinates those capabilities.",
        es: "Commerce opera el negocio. Web Builder crea su presencia digital. AI Forge construye inteligencia. Trading Islands analiza mercados y crea activos digitales. Sentinel evalúa y fortalece seguridad. Nexus conecta el ecosistema con el exterior. PULSE comprende el contexto y coordina esas capacidades.",
      },
      {
        en: "Identity, DBX, Billing, Telemetry, Observability, Storage, Infrastructure and Audit provide the common substrate required for the ecosystem to behave as one operating environment rather than a collection of unrelated applications.",
        es: "Identity, DBX, Billing, Telemetry, Observability, Storage, Infrastructure y Audit proporcionan el sustrato común necesario para que el ecosistema se comporte como un único entorno operativo y no como una colección de aplicaciones desconectadas.",
      },
    ],
    flow: [
      "CREATE",
      "OPERATE",
      "INTELLIGENCE",
      "CONNECT",
      "TRADE",
      "SECURE",
      "MEASURE",
      "EVOLVE",
    ],
  },
];
