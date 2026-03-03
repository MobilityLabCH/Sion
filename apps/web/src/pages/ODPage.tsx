/**
 * ODPage.tsx — Page dédiée Flux OD
 * Charge ODSimulator en pleine page (100vh - 48px header).
 * Chemin : apps/web/src/pages/ODPage.tsx
 *
 * FIX: @ts-ignore supprimé — ODSimulator est maintenant .tsx (TypeScript valide)
 * ACTION REQUISE: supprimer apps/web/src/components/ODSimulator.jsx du repo
 */

import ODSimulator from '../components/ODSimulator';

export default function ODPage() {
  return (
    <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      <ODSimulator />
    </div>
  );
}
