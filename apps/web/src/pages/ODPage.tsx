/**
 * ODPage.tsx — Page dédiée Flux OD
 * 
 * Charge ODSimulator en pleine page (100vh - 48px header).
 * ODSimulator est un composant autonome avec sa propre carte
 * MapLibre, ses données officielles et sa logique de simulation.
 * 
 * Chemin : apps/web/src/pages/ODPage.tsx
 */
import ODSimulator from '../components/ODSimulator';

export default function ODPage() {
  return (
    <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      <ODSimulator />
    </div>
  );
}
