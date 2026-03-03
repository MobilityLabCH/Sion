/**
 * ODPage.tsx — Page dédiée Flux OD
 * Charge ODSimulator en pleine page (100vh - 48px header).
 * Chemin : apps/web/src/pages/ODPage.tsx
 */

// ODSimulator est un .jsx — allowJs:true dans tsconfig.json
// @ts-ignore — fichier JSX sans déclaration TypeScript
import ODSimulator from '../components/ODSimulator';

export default function ODPage() {
  return (
    <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      <ODSimulator />
    </div>
  );
}
