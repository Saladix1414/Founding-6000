import { useEffect, useRef, useState } from 'react';
import { brainArtwork, brainGames, projectScreens } from './projectShowcaseData';
import '../../styles/originx-project-showcase.css';

type Preview = {image: string; title: string};
export default function ProjectShowcase({language}: {language: 'es' | 'en'}) {
  const es = language === 'es';
  const [preview, setPreview] = useState<Preview | null>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (preview && viewer.current && !viewer.current.open) viewer.current.showModal();
  }, [preview]);
  const closePreview = () => {viewer.current?.close(); setPreview(null);};
  return (
    <div className="ox-project-showcase">
      <header>
        <p className="ox-showcase-eyebrow">{es ? 'CONOCÉ LOS ESPACIOS' : 'EXPLORE THE WORKSPACES'}</p>
        <h3>{es ? 'De la idea a tu próximo proyecto.' : 'From an idea to your next project.'}</h3>
        <p>{es ? 'Creación web, comercio, IA y experiencias de juego en un mismo ecosistema. Tocá una imagen para verla completa.' : 'Website creation, commerce, AI and games in one ecosystem. Select an image to see it in full.'}</p>
      </header>
      <div className="ox-project-screens">
        {projectScreens.map((screen, index) => (
          <figure key={screen.id} className={index === 0 ? 'ox-project-screen-featured' : undefined}>
            <button type="button" onClick={() => setPreview(screen)} aria-label={(es ? 'Ampliar ' : 'Enlarge ') + screen.title} aria-haspopup="dialog">
              <img src={screen.image} alt={screen.title + (es ? ' · vista de la interfaz' : ' · interface preview')} loading="lazy" decoding="async" width={screen.width} height={screen.height} />
              <span>{es ? 'Ampliar imagen ↗' : 'Enlarge image ↗'}</span>
            </button>
            <figcaption><h4>{screen.title}</h4><p>{es ? screen.es : screen.en}</p></figcaption>
          </figure>
        ))}
      </div>
      <p className="ox-project-preview-note">{es ? 'Imágenes de presentación aportadas por el proyecto. Muestran interfaces y dirección visual; las funciones, conexiones y publicación dependen del estado de cada herramienta. Trading Islands muestra una simulación; IA Forge requiere configurar su runtime.' : 'Presentation images supplied by the project show interfaces and visual direction. Features, integrations and publishing depend on each tool’s status. Trading Islands shows a simulation; IA Forge requires runtime configuration.'}</p>
      <section className="ox-project-brain" aria-labelledby="ox-project-brain-title">
        <header><p className="ox-showcase-eyebrow">NEURAL ARCADE</p><h3 id="ox-project-brain-title">Brain Boost · {es ? 'Jugá, explorá y desafiá tus habilidades.' : 'Play, explore and challenge your skills.'}</h3><p>{es ? 'Experiencias recreativas de memoria, lógica, orientación y atención, junto a la acción de Neon Arena.' : 'Recreational memory, logic, spatial and attention experiences alongside Neon Arena action.'}</p></header>
        <div className="ox-project-brain-art">
          {brainArtwork.map(art => <figure key={art.title}><button type="button" onClick={() => setPreview(art)} aria-label={(es ? 'Ampliar arte de ' : 'Enlarge artwork for ') + art.title} aria-haspopup="dialog"><img src={art.image} alt={art.title + (es ? ' · carta del juego' : ' · game card')} loading="lazy" decoding="async" width="640" height="640" /></button><figcaption>{art.title} · {es ? 'arte del juego' : 'game artwork'}</figcaption></figure>)}
        </div>
        <ul className="ox-project-game-list">{brainGames.map(game => <li key={game.title}><strong>{game.title}</strong><span>{es ? game.es : game.en}</span></li>)}</ul>
        <p className="ox-project-preview-note">{es ? 'Juegos presentes en la versión de desarrollo. Disponibilidad y acceso según la versión habilitada. Daily Neural Run y Neural Boss permanecen en el roadmap.' : 'Games present in the development version. Availability and access depend on the enabled version. Daily Neural Run and Neural Boss remain on the roadmap.'}</p>
      </section>
      <dialog ref={viewer} className="ox-membership-dialog ox-project-image-viewer" aria-labelledby="ox-project-image-title" onClose={() => setPreview(null)} onClick={event => {if (event.target === event.currentTarget) closePreview();}}>
        <div className="ox-membership-dialog-bar"><span id="ox-project-image-title">{preview?.title}</span><button type="button" autoFocus onClick={closePreview}>{es ? 'Cerrar' : 'Close'} ×</button></div>
        {preview && <img src={preview.image} alt={preview.title} />}
      </dialog>
    </div>
  );
}
