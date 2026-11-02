export type WhitepaperLanguage = 'en' | 'es';
export type LocalizedText = {en: string; es: string};
export type WhitepaperCard = {title: string; text: LocalizedText};
export type WhitepaperSection = {
  id: string; number: string; label: LocalizedText; title: LocalizedText; summary: LocalizedText;
  paragraphs?: LocalizedText[]; bullets?: LocalizedText[]; flow?: string[]; cards?: WhitepaperCard[];
};
export const WHITEPAPER_BRAND = 'OriginX Foundation';
export const WHITEPAPER_ORIGIN_LAYER = 'Founding 6000';
export const WHITEPAPER_VERSION = '02.11.2026';
const t = (es: string, en: string): LocalizedText => ({es, en});

export const whitepaperSections: WhitepaperSection[] = [
  {
    id:'manifesto', number:'00', label:t('VISIÓN', 'VISION'),
    title:t('Tu idea merece un ecosistema.', 'Your idea deserves an ecosystem.'),
    summary:t('OriginX Foundation conecta creación web, comercio, inteligencia artificial y experiencias interactivas. Su objetivo: ayudarte a crear, operar y desarrollar tu próximo proyecto desde espacios especializados que trabajan sobre una base común.', 'OriginX Foundation connects website creation, commerce, artificial intelligence and interactive experiences. Its goal: help you build, operate and develop your next project through specialized workspaces sharing a common foundation.'),
    paragraphs:[t('DigitalBoost Studio es el entorno de desarrollo de estas herramientas. Founding 6000 es la colección de membresías que acompaña su etapa fundadora: una pieza digital, acceso previsto y un modelo de reservas definido.', 'DigitalBoost Studio is the development environment for these tools. Founding 6000 is the membership collection accompanying the founding stage: a digital collectible, planned access and a defined reserve model.')],
  },
  {
    id:'membership', number:'01', label:t('MEMBRESÍA', 'MEMBERSHIP'),
    title:t('Una pieza única. Un lugar para crear.', 'A unique collectible. A place to build.'),
    summary:t('6.000 números únicos, tres categorías y 12 meses de acceso a la web de tiendas y desarrollo desde la activación válida. Al transferir el NFT, el titular válido recibe el tiempo restante con el mismo vencimiento.', '6,000 unique serials, three categories and 12 months of access to the stores and development website from valid activation. When the NFT transfers, the valid holder receives the remaining term with the same expiry.'),
    cards:[
      {title:'RARE · 50 USDT',text:t('#0001–#1000 · 1.000 piezas. #0001 Azhurak queda reservado: 999 ventas previstas.', '#0001–#1000 · 1,000 collectibles. #0001 Azhurak remains reserved: 999 planned sales.')},
      {title:'EPIC · 70 USDT',text:t('#1001–#3000 · 2.000 piezas y 2.000 ventas previstas.', '#1001–#3000 · 2,000 collectibles and 2,000 planned sales.')},
      {title:'LEGENDARY · 90 USDT',text:t('#3001–#6000 · 3.000 piezas y 3.000 ventas previstas.', '#3001–#6000 · 3,000 collectibles and 3,000 planned sales.')},
    ],
    paragraphs:[t('Pago, asignación, entrega del NFT y activación del acceso son etapas distintas. La transferencia no inicia otros 12 meses. El acceso depende de las funciones habilitadas y de los límites del plan; la renovación aún no tiene precio definido.', 'Payment, allocation, NFT delivery and access activation are separate stages. Transfers do not start another 12 months. Access depends on enabled features and plan limits; renewal pricing has not yet been defined.')],
  },
  {
    id:'ecosystem', number:'02', label:t('HERRAMIENTAS', 'TOOLS'),
    title:t('Creá. Organizá. Automatizá.', 'Build. Organize. Automate.'),
    summary:t('Cada espacio resuelve una parte del proyecto. Las versiones mostradas están en desarrollo; las integraciones y la publicación requieren habilitación y verificación.', 'Each workspace addresses part of your project. The versions shown are under development; integrations and publishing require activation and verification.'),
    cards:[
      {title:'Commerce OS + Store Builder',text:t('Tu operación comercial y tu tienda en un mismo espacio: productos, pedidos, clientes y diseño. Store Builder vive dentro de Commerce OS.', 'Commerce operations and your store in one workspace: products, orders, customers and design. Store Builder belongs inside Commerce OS.')},
      {title:'Web Builder · Sky Workshop',text:t('Diseño de sitios y landing pages con canvas visual, estilos y vista previa responsive. En desarrollo activo.', 'Website and landing-page design with a visual canvas, styles and responsive preview. Under active development.')},
      {title:'IA Forge',text:t('Arquitectura visual para inteligencias, agentes, bots y workflows. La ejecución requiere configurar modelos, proveedores y runtime.', 'Visual architecture for intelligences, agents, bots and workflows. Execution requires configuring models, providers and runtime.')},
      {title:'Trading Islands',text:t('Exploración de mercados, estrategias, carteras y bots. Exchange Harbor muestra una demo local con datos simulados, sin operaciones reales.', 'Market, strategy, portfolio and bot exploration. Exchange Harbor shows a local demo with simulated data and no real trades.')},
      {title:'PULSE',text:t('Orquestación transversal: interpreta objetivos y coordina herramientas con políticas, aprobación, verificación y auditoría.', 'Cross-platform orchestration: interprets goals and coordinates tools through policies, approval, verification and audit.')},
      {title:'Sentinel + Nexus',text:t('Seguridad y conexiones del ecosistema: capacidades planificadas. No se presentan como servicios ya disponibles.', 'Ecosystem security and connectivity: planned capabilities, not services already available.')},
    ],
  },
  {
    id:'brain-boost', number:'03', label:t('BRAIN BOOST', 'BRAIN BOOST'),
    title:t('Un ecosistema que también se juega.', 'An ecosystem you can play, too.'),
    summary:t('Neural Arcade reúne experiencias recreativas de memoria, lógica, atención y orientación, con una identidad visual propia por juego.', 'Neural Arcade brings together recreational memory, logic, attention and spatial experiences, each with its own visual identity.'),
    bullets:[
      t('Memory Matrix, Ocean Echoes y Dragon Relics: secuencias, parejas y descubrimiento.', 'Memory Matrix, Ocean Echoes and Dragon Relics: sequences, pairs and discovery.'),
      t('Logic Reactor y Number Patterns: relaciones lógicas y desafíos numéricos.', 'Logic Reactor and Number Patterns: logical relationships and numerical challenges.'),
      t('Spatial Rift, Vector Routes, Focus Protocol y Signal Hunt: formas, rutas y búsqueda de señales.', 'Spatial Rift, Vector Routes, Focus Protocol and Signal Hunt: shapes, routes and signal searches.'),
      t('Neural Baseline y Neon Arena: recorridos de habilidades y acción 3D contra hordas alienígenas.', 'Neural Baseline and Neon Arena: skill challenges and 3D action against alien hordes.'),
    ],
    paragraphs:[t('Juegos presentes en la versión de desarrollo; el acceso depende de la versión habilitada. Daily Neural Run y Neural Boss siguen en el roadmap.', 'Games present in the development version; access depends on the enabled version. Daily Neural Run and Neural Boss remain on the roadmap.')],
  },
  {
    id:'reserves', number:'04', label:t('25% A RESERVA', '25% TO RESERVES'),
    title:t('Cada venta aporta. El fondo se construye.', 'Every sale contributes. The fund takes shape.'),
    summary:t('El modelo destina el 25% de cada venta inicial verificada a reserva. Con 5.999 ventas a los precios indicados, el ingreso de cierre sería de 459.950 USDT y el aporte total a reserva de 114.987,50 USDT.', 'The model allocates 25% of each verified initial sale to reserves. With 5,999 sales at the stated prices, closing revenue would be 459,950 USDT and the total reserve contribution 114,987.50 USDT.'),
    cards:[
      {title:'RARE · 12.487,50 USDT',text:t('Aporte de las 999 ventas RARE. Reserva acumulada tras esta tanda: 12.487,50 USDT.', 'Contribution from 999 RARE sales. Cumulative reserve after this batch: 12,487.50 USDT.')},
      {title:'EPIC · 35.000 USDT',text:t('Aporte de las 2.000 ventas EPIC. Reserva acumulada tras esta tanda: 47.487,50 USDT.', 'Contribution from 2,000 EPIC sales. Cumulative reserve after this batch: 47,487.50 USDT.')},
      {title:'LEGENDARY · 67.500 USDT',text:t('Aporte de las 3.000 ventas LEGENDARY. Reserva acumulada al cierre: 114.987,50 USDT.', 'Contribution from 3,000 LEGENDARY sales. Cumulative closing reserve: 114,987.50 USDT.')},
    ],
    paragraphs:[t('El reparto previsto V3 asigna 30.000 USDT a RARE, 33.995 a EPIC y 50.992,50 a LEGENDARY. Sobre los suministros máximos de 1.000 / 2.000 / 3.000 piezas, representa 30 / 16,9975 / 16,9975 USDT por NFT. Las tarjetas redondean los dos últimos a 17,00 USDT.', 'The planned V3 allocation assigns 30,000 USDT to RARE, 33,995 to EPIC and 50,992.50 to LEGENDARY. Across maximum supplies of 1,000 / 2,000 / 3,000 collectibles, this represents 30 / 16.9975 / 16.9975 USDT per NFT. Cards round the latter two to 17.00 USDT.'),t('Son cálculos de cierre, no fondos ya acreditados ni beneficio neto del comprador. El 75% restante queda fuera de la reserva, antes de gastos, impuestos y obligaciones. Los costes operativos todavía no están definidos.', 'These are closing calculations, not credited funds or buyer net profit. The remaining 75% stays outside reserves before expenses, taxes and obligations. Operating costs have not yet been defined.')],
  },
  {
    id:'investment', number:'05', label:t('CRECIMIENTO', 'GROWTH'),
    title:t('Dos vías propuestas para ampliar la reserva.', 'Two proposed ways to grow reserves.'),
    summary:t('Durante las ventas se prevé mantener la reserva líquida. Tras el cierre y la habilitación de la estrategia, el análisis a 12 meses combina una inversión limitada con posibles aportes del negocio.', 'During sales, reserves are intended to remain liquid. After closing and strategy activation, the 12-month analysis combines limited investment with potential business contributions.'),
    cards:[
      {title:'90% líquido · hasta 10% invertido',text:t('La propuesta limita la parte invertida, sin préstamos, apalancamiento ni puentes. Proveedor y ejecución siguen pendientes de aprobación.', 'The proposal caps the invested portion, without borrowing, leverage or bridges. Provider selection and execution still require approval.')},
      {title:'15% del beneficio neto del negocio',text:t('Aporte propuesto sobre beneficios futuros realizados de suscripciones y servicios. El 85% permanece en el negocio; no es un cobro adicional al miembro.', 'Proposed contribution from future realized net profit from subscriptions and services. 85% remains with the business; this is not an additional member charge.')},
    ],
    paragraphs:[t('Ejemplo, no previsión: un 4% neto anual supuesto sobre el 10% de 114.987,50 USDT añadiría 459,95 USDT al fondo en un año. No es un 4% sobre toda la reserva. No hay proveedor aprobado ni rendimiento confirmado; la inversión puede perder valor.', 'Example, not a forecast: an assumed 4% net annual return on 10% of 114,987.50 USDT would add 459.95 USDT to the fund over one year. This is not 4% on the entire reserve. No provider is approved and no return is confirmed; investments can lose value.'),t('Los aportes del negocio dependen de beneficios reales y de aprobar la política. Los 12 meses incluidos no se cuentan como nuevas renovaciones. No se han definido precios de renovación ni un presupuesto que confirme rentabilidad.', 'Business contributions depend on actual profit and policy approval. The included 12 months are not counted as new renewals. Neither renewal pricing nor a budget confirming profitability has been defined.')],
  },
  {
    id:'redemption', number:'06', label:t('RESCATE', 'REDEMPTION'),
    title:t('Un futuro rescate desde tu wallet.', 'Future redemption from your wallet.'),
    summary:t('El mecanismo previsto permitiría cobrar la parte de reserva correspondiente y quemar el NFT en una misma operación, o revertir todo si falla. Hoy la quema y el rescate permanecen deshabilitados.', 'The planned mechanism would pay the corresponding reserve share and burn the NFT in the same operation, or revert everything on failure. Burning and redemption are currently disabled.'),
    bullets:[t('Completar las ventas y verificar la cobertura de los 6.000 números, incluido el reservado.', 'Complete sales and verify coverage of all 6,000 serials, including the reserved collectible.'),t('Verificar fondos, elegibilidad, reparto y divisor efectivo antes de habilitar cobros.', 'Verify funds, eligibility, allocation and the effective denominator before enabling payouts.'),t('Implementar y verificar el pago y la quema atómicos. Finalizar las ventas no los activa automáticamente.', 'Implement and verify atomic payment and burning. Completing sales does not activate them automatically.')],
    paragraphs:[t('El importe de rescate no es una ganancia adicional al precio de compra ni una cotización de reventa. El resultado del comprador también depende de su coste de compra, comisiones e impuestos personales.', 'The redemption amount is not additional profit on top of the purchase price or a resale quote. Buyer outcomes also depend on purchase cost, fees and personal taxes.')],
  },
  {
    id:'roadmap', number:'07', label:t('HOJA DE RUTA', 'ROADMAP'),
    title:t('Avanzar con hitos verificables.', 'Progress through verifiable milestones.'),
    summary:t('El desarrollo avanza por entregas: una función se considera disponible cuando su ejecución y su resultado se verifican.', 'Development progresses through deliveries: a feature is considered available when its execution and result are verified.'),
    bullets:[t('Consolidar los espacios de comercio, creación web, IA y juegos, con sus límites de acceso.', 'Consolidate commerce, website creation, AI and game workspaces with their access limits.'),t('Completar y verificar la entrega del NFT y la activación de membresía para producción.', 'Complete and verify production NFT delivery and membership activation.'),t('Publicar movimientos de reserva con evidencia y actualización tras cada venta verificada.', 'Publish evidence-backed reserve movements updated after each verified sale.'),t('Validar el presupuesto, la política de aportes, la estrategia de inversión y el mecanismo de rescate antes de activarlos.', 'Validate the budget, contribution policy, investment strategy and redemption mechanism before activation.')],
  },
  {
    id:'pulse', number:'08', label:t('CONFIANZA', 'TRUST'),
    title:t('Una visión ambiciosa. Reglas claras.', 'An ambitious vision. Clear rules.'),
    summary:t('PULSE coordina el trabajo; las políticas y aprobaciones controlan la ejecución. Los datos reales, las demos y las estimaciones se identifican por separado.', 'PULSE coordinates work; policies and approvals control execution. Real data, demos and estimates are identified separately.'),
    paragraphs:[t('El NFT no otorga acciones de la empresa, gobernanza ni rentabilidad garantizada. La disponibilidad de herramientas, fondos y rescates se confirma con evidencia, no con una imagen o un cálculo del simulador.', 'The NFT grants no company equity, governance or guaranteed return. Tool availability, funds and redemption are confirmed through evidence, not an image or simulator calculation.')],
    flow:['USER','PULSE','POLICY','APPROVAL','EXECUTOR','VERIFY','AUDIT'],
  },
];
