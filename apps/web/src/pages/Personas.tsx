import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store.ts';

const MODE_COLORS: Record<string, string> = {
  'Voiture': 'bg-red-50 text-red-700 border-red-200',
  'TP': 'bg-green-50 text-green-700 border-green-200',
  'Covoiturage': 'bg-blue-50 text-blue-700 border-blue-200',
  'TAD': 'bg-purple-50 text-purple-700 border-purple-200',
  'Taxi-bons': 'bg-orange-50 text-orange-700 border-orange-200',
};

const INCOME_LABELS: Record<string, string> = {
  faible: 'Revenu modeste',
  moyen: 'Revenu moyen',
  élevé: 'Revenu élevé',
};

export default function Personas() {
  const { results, scenario } = useApp();
  const navigate = useNavigate();

  if (!results) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="card p-10 max-w-md mx-auto">
          <div className="text-4xl mb-4">◑</div>
          <h2 className="section-title mb-2">Aucun résultat</h2>
          <p className="text-ink-500 text-sm mb-6">Simulez d'abord un scénario pour voir l'impact par persona.</p>
          <button onClick={() => navigate('/scenario')} className="btn-primary mx-auto">
            Configurer un scénario →
          </button>
        </div>
      </div>
    );
  }

  const equityCount = results.personaResults.filter(p => p.equityFlag).length;
  const modeShifted = results.personaResults.filter(p => p.preferredMode !== p.preferredModeBefore).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="animate-fade-up flex items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Impact par persona</h1>
          <p className="text-ink-500 mt-1 text-sm">
            12 profils types représentant les usagers de la mobilité sédunoise
          </p>
        </div>
        <button onClick={() => navigate('/actions')} className="btn-primary">
          Plan d'actions →
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 animate-fade-up animate-fade-up-delay-1">
        <div className="card px-4 py-2.5 flex items-center gap-2">
          <span className="text-lg font-display font-medium text-ink">{modeShifted}</span>
          <span className="text-xs text-ink-500">persona(s) avec bascule modale</span>
        </div>
        <div className={`card px-4 py-2.5 flex items-center gap-2 ${equityCount > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <span className={`text-lg font-display font-medium ${equityCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {equityCount}
          </span>
          <span className={`text-xs ${equityCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            risque{equityCount !== 1 ? 's' : ''} équité détecté{equityCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Persona grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {results.personaResults.map((persona, idx) => {
          const delta = persona.costDeltaCHF;
          const modeChanged = persona.preferredMode !== persona.preferredModeBefore;

          return (
            <div
              key={persona.personaId}
              className={`card p-5 animate-fade-up ${persona.equityFlag ? 'border-red-200' : ''}`}
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{persona.emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-ink">{persona.label}</div>
                    <div className="text-xs text-ink-400">
                      {persona.tags.slice(0, 2).join(' · ')}
                    </div>
                  </div>
                </div>
                {persona.equityFlag && (
                  <span className="text-red-500 text-xs font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex-shrink-0">
                    ⚠ Équité
                  </span>
                )}
              </div>

              {/* Cost comparison */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-ink-50 rounded-xl">
                <div className="text-center flex-1">
                  <div className="text-xs text-ink-400 mb-1">Avant</div>
                  <div className="font-mono font-semibold text-ink">{persona.beforeCostCHF} CHF</div>
                </div>
                <div className="text-ink-300">→</div>
                <div className="text-center flex-1">
                  <div className="text-xs text-ink-400 mb-1">Après</div>
                  <div className={`font-mono font-semibold ${delta > 0.5 ? 'text-red-600' : delta < -0.5 ? 'text-green-600' : 'text-ink'}`}>
                    {persona.afterCostCHF} CHF
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-xs text-ink-400 mb-1">Delta</div>
                  <div className={`font-mono font-semibold text-sm ${delta > 0.5 ? 'text-red-600' : delta < -0.5 ? 'text-green-600' : 'text-ink-400'}`}>
                    {delta > 0 ? '+' : ''}{delta} CHF
                  </div>
                </div>
              </div>

              {/* Mode shift */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${MODE_COLORS[persona.preferredModeBefore] || 'bg-ink-50 text-ink border-ink-200'}`}>
                  {persona.preferredModeBefore}
                </span>
                {modeChanged ? (
                  <>
                    <span className="text-ink-300 text-xs">→</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${MODE_COLORS[persona.preferredMode] || 'bg-ink-50 text-ink border-ink-200'}`}>
                      {persona.preferredMode}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-ink-400">mode stable</span>
                )}
              </div>

              {/* Explanation bullets */}
              <ul className="space-y-1.5">
                {persona.explanation.map((bullet, i) => (
                  <li key={i} className="text-xs text-ink-600 flex gap-2">
                    <span className="text-ink-300 flex-shrink-0">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Equity warning */}
      {equityCount > 0 && (
        <div className="card p-6 border-red-200 bg-red-50 animate-fade-up">
          <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
            <span>⚠</span> Profils à risque équité
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.personaResults.filter(p => p.equityFlag).map(p => (
              <div key={p.personaId} className="flex items-start gap-2 text-sm text-red-600">
                <span>{p.emoji}</span>
                <div>
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-red-500">
                    +{p.costDeltaCHF} CHF/trajet · peu d'alternatives accessibles
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-500 mt-3">
            Recommandation: activation des taxi-bons et/ou du TAD pour ces profils, ou exemptions tarifaires ciblées.
          </p>
        </div>
      )}
    </div>
  );
}
