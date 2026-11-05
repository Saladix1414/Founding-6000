import { simulateBatchClose } from '../components/landing/economySimulation';
import type { WhitepaperLanguage } from './whitepaperContent';

const benefits = [
  ['01', 'Herramientas para tus proyectos', 'Tools for your projects', '12 meses de acceso desde la activación válida. Commerce OS y Store Builder para tu tienda online, Web Builder para sitios web, IA Forge para agentes y bots, y Trading Islands para explorar mercados y estrategias en simulación.', '12 months of access from valid activation. Commerce OS and Store Builder for online stores, Web Builder for websites, IA Forge for agents and bots, and Trading Islands for simulated markets and strategies.'],
  ['02', 'Brain Boost Gamez', 'Brain Boost Gamez', 'Juegos de navegador con desafíos de memoria, lógica y atención. Descubrí las experiencias y acompañá sus próximas incorporaciones.', 'Browser games with memory, logic and attention challenges. Discover the experiences and follow upcoming additions.'],
  ['03', 'Tu NFT de membresía', 'Your membership NFT', 'Vos te suscribís y nosotros gestionamos el minteo en Base y la entrega a la cuenta suscriptora. Una pieza digital única que acompaña tu acceso. Al transferirla, se conserva el tiempo restante.', 'You subscribe and we manage minting on Base and delivery to the subscriber account. A unique digital collectible accompanies your access. Transfers preserve the remaining membership term.'],
  ['04', 'Reconocimiento como fundador', 'Founder recognition', 'Los primeros 6.000 suscriptores recibirán distintivos de fundador en su perfil y en el foro Nexus, donde podrán compartir proyectos y participar en la comunidad.', 'The first 6,000 subscribers will receive founder badges on their profiles and in the Nexus forum, where they can share projects and participate in the community.'],
  ['05', 'Participación en las decisiones', 'A voice in decisions', 'Planeamos someter las inversiones a votación comunitaria en Nexus. Cada propuesta explicará el destino, el importe, los plazos y los riesgos antes de votar.', 'Investment proposals are planned to go to a community vote in Nexus. Each proposal will explain its purpose, amount, timing and risks before voting.'],
];

export function WhitepaperFounderIntro({ language }: { language: WhitepaperLanguage }) {
  const es = language === 'es';
  const text = (spanish: string, english: string) => es ? spanish : english;
  const money = (amount: bigint) => new Intl.NumberFormat(es ? 'es-AR' : 'en-US').format(Number(amount) / 1e6) + ' USDT';
  return (
    <div className="atlas-intro">
      <section className="atlas-hero">
        <div className="atlas-hero__copy">
          <p className="atlas-kicker">{text('PRIMEROS 6.000 SUSCRIPTORES', 'FIRST 6,000 SUBSCRIBERS')}</p>
          <h2>{text('Tu lugar en el comienzo de OriginX.', 'Your place at the beginning of OriginX.')}</h2>
          <p>{text('Creá sitios web, desarrollá tiendas online, explorá la IA y compartí tus proyectos en Nexus. Conocé los beneficios de la membresía fundadora.', 'Build websites and online stores, explore AI and share your projects in Nexus. Discover the founder membership benefits.')}</p>
          <div className="atlas-tags"><span>{text('12 meses de acceso', '12 months of access')}</span><span>{text('NFT transferible', 'Transferable NFT')}</span><span>{text('Comunidad fundadora', 'Founding community')}</span></div>
        </div>
        <figure><img src="/whitepaper/atlas-membership.webp" alt={text('Ilustración de un dragón turquesa y una credencial de membresía', 'Illustration of a turquoise dragon and a membership pass')} width="1200" height="800" /><figcaption>{text('Arte conceptual de la membresía', 'Membership concept artwork')}</figcaption></figure>
      </section>
      <section id="whitepaper-founder-benefits" className="atlas-benefits">
        <p className="atlas-kicker">{text('TU MEMBRESÍA FUNDADORA', 'YOUR FOUNDER MEMBERSHIP')}</p>
        <h3>{text('Herramientas. Juegos. Tu comunidad.', 'Tools. Games. Your community.')}</h3>
        <div className="atlas-benefits__grid">{benefits.map(([number, titleEs, titleEn, copyEs, copyEn]) => <article key={number}><span className="atlas-number">{number}</span><div><h4>{text(titleEs, titleEn)}</h4><p>{text(copyEs, copyEn)}</p></div></article>)}</div>
        <p className="atlas-note">{text('Acceso según funciones habilitadas, condiciones y límites de cada herramienta. Los distintivos y las votaciones forman parte de las funciones previstas.', 'Access follows enabled features, terms and tool limits. Badges and voting are planned features.')}</p>
      </section>
      <section id="whitepaper-founder-reserves" className="atlas-reserves">
        <p className="atlas-kicker">{text('RESERVA COMUNITARIA', 'COMMUNITY RESERVE')}</p>
        <h3>{text('Un fondo que acompaña al proyecto.', 'A fund that supports the project.')}</h3>
        <p>{text('El modelo contempla asignar el 50% de cada venta inicial verificada a la reserva comunitaria. El rescate previsto mediante quema del NFT toma como referencia inicial ese aporte, sujeto a habilitación, elegibilidad y fondos disponibles.', 'The model allocates 50% of each verified initial sale to community reserves. Planned redemption through NFT burning uses that contribution as an initial reference, subject to activation, eligibility and available funds.')}</p>
        <p>{text('También podés conservar tu NFT y acompañar el desarrollo del fondo. Planeamos destinar inicialmente el 10% de las reservas a inversiones votadas por la comunidad, con el objetivo de hacer crecer el fondo. Los resultados pueden generar ganancias o pérdidas.', 'You can also retain your NFT and follow the fund’s development. We initially plan to allocate 10% of reserves to community-voted investments with the goal of growing the fund. Results may produce gains or losses.')}</p>
        <h4>{text('Reservas al completar cada tanda', 'Reserves after each completed batch')}</h4>
        <div className="atlas-table-scroll" role="region" aria-label={text('Proyecciones acumuladas por tanda, desplazamiento horizontal', 'Cumulative batch projections, scroll horizontally')} tabIndex={0}>
          <table><caption>{text('Proyección acumulada · Ventas completas a precios iniciales', 'Cumulative projection · Full sales at initial prices')}</caption><thead><tr>{[text('Tanda', 'Batch'), text('Suscripciones', 'Subscriptions'), text('Ventas', 'Sales'), text('Reserva 50%', '50% reserve'), text('Inversión 10%', '10% investment'), text('Sin invertir', 'Uninvested')].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{[1, 2, 3].map(count => { const projection = simulateBatchClose(count); const investment = projection.reserve / 10n; return <tr key={count}><th scope="row">{projection.stages.map(stage => stage.tier).join(' + ')}</th><td>{new Intl.NumberFormat(es ? 'es-AR' : 'en-US').format(projection.stages.reduce((sum, stage) => sum + stage.quantity, 0))}</td><td>{money(projection.sales)}</td><td>{money(projection.reserve)}</td><td>{money(investment)}</td><td>{money(projection.reserve - investment)}</td></tr>; })}</tbody>
          </table>
        </div>
        <p className="atlas-note">{text('Escenarios acumulados antes de rescates, gastos y resultados de inversión. El capital invertido forma parte de la reserva total. El escenario de 6.000 ventas incluye el NFT #0001, actualmente reservado.', 'Cumulative scenarios before redemptions, expenses and investment results. Invested capital remains part of total reserves. The 6,000-sale scenario includes NFT #0001, currently reserved.')}</p>
        <p>{text('Planeamos aumentar progresivamente el porcentaje de inversión a medida que el fondo reciba aportes de la web principal y resultados de las inversiones. Cada cambio se presentará a la comunidad con el importe comprometido y el saldo disponible. Las reglas se publicarán antes de activar el mecanismo.', 'We plan to progressively increase the investment allocation as the fund receives main-website contributions and investment results. Each change will be presented to the community with its committed amount and available balance. Rules will be published before activation.')}</p>
      </section>
      <section className="atlas-universe">
        <p className="atlas-kicker">ORIGINX FOUNDATION</p><h3>{text('Tu idea merece un ecosistema.', 'Your idea deserves an ecosystem.')}</h3>
        <p>{text('Conectamos desarrollo web, comercio electrónico, inteligencia artificial y juegos de navegador. Encontrá herramientas para llevar tus ideas a la práctica y compartí el recorrido con otras personas.', 'We connect web development, ecommerce, artificial intelligence and browser games. Find tools to put your ideas into practice and share the journey with others.')}</p>
        <div className="atlas-modules">{[['Web Builder', '/project-showcase/web-builder.jpg'], ['Commerce OS', '/project-showcase/commerce-os.jpg'], ['IA Forge', '/project-showcase/ia-forge.jpg']].map(([name, image]) => <figure key={name}><img src={image} alt="" loading="lazy" width="320" height="200"/><figcaption>{name}</figcaption></figure>)}</div>
      </section>
      <section className="atlas-progress"><p className="atlas-kicker">{text('DESARROLLO EN MARCHA', 'DEVELOPMENT IN PROGRESS')}</p><h3>{text('Un proyecto que ya está tomando forma.', 'A project already taking shape.')}</h3><div className="atlas-progress__value"><strong>70%</strong><p>{text('de desarrollo preparado en la web principal', 'development progress on the main website')}</p></div><progress max={100} value={70} aria-label={text('Avance de desarrollo informado por el equipo', 'Development progress reported by the team')}>70%</progress><p className="atlas-note">{text('Avance informado por el equipo. Seguimos completando funciones, integrando módulos y validando experiencias para el lanzamiento completo.', 'Progress reported by the team. Feature completion, module integration and experience validation continue ahead of the full launch.')}</p></section>
    </div>
  );
}
