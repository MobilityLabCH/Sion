import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';
import ZoneMap from '../components/ZoneMap.tsx';
import KPICard from '../components/KPICard.tsx';
import CategoryPill from '../components/CategoryPill.tsx';

export default function Dashboard() {
  const { results, scenario, isSimulating } = useApp();
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero */}
      <div className="animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="section-title">
              Tableau de bord
            </h1>
            <p className="text-ink-500 mt-1 text-sm">
              Simulateur de tarification mobilité — Sion (Valais)
            </p>
          </div>
          <button
            onClick={() => navigate('/scenario')}
            className="btn-primary flex-shrink-0"
          >
            <span>+</span> Nouveau scénario
          </button>
        </div>
      </div>

      {/* Layout: Map + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 animate-fade-up animate-fade-up-delay-1">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-ink-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm text-ink">Carte des zones — Sion</h2>
                <p className="text-xs text-ink-400 mt-0.5">
                  {results
                    ? 'Colorée selon potentiel de bascule modale (Vert / Orange / Rouge)'
                    : 'Simulez un scénario pour voir les résultats par zone'}
                </p>
              </div>
              {results && (
                <button
                  onClick={() => navigate('/resultats')}
                  className="btn-ghost text-xs"
                >
                  Voir détail →
                </button>
              )}
            </div>
            <ZoneMap zoneResults={results?.zoneResults} height="380px" />
          </div>
        </div>

        {/* Right: KPIs + last scenario */}
        <div className="space-y-4 animate-fade-up animate-fade-up-delay-2">
          {results ? (
            <>
              <KPICard
                label="Shift global estimé"
                value={(results.globalShiftIndex * 100).toFixed(0)}
                unit="%"
                color={results.globalShiftIndex > 0.3 ? 'green' : results.globalShiftIndex > 0.15 ? 'orange' : 'red'}
                description="Part de trajets voiture susceptible de basculer vers des alternatives"
              />

              <div className="card p-5">
                <div className="label-sm mb-3">Zones par catégorie</div>
                <div className="space-y-2.5">
                  {(['vert', 'orange', 'rouge'] as const).map(cat => {
                    const zones = results.zoneResults.filter(z => z.category === cat);
                    if (zones.length === 0) return null;
                    return (
                      <div key={cat} className="flex items-center justify-between">
                        <CategoryPill category={cat} />
                        <div className="text-right">
                          <span className="text-sm font-semibold text-ink">{zones.length}</span>
                          <span className="text-xs text-ink-400 ml-1">zone{zones.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {results.equityFlags.length > 0 && (
                <div className="card p-4 border-red-200 bg-red-50">
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">⚠</span>
                    <div>
                      <div className="text-sm font-semibold text-red-700">Risques équité</div>
                      <div className="text-xs text-red-600 mt-1 space-y-0.5">
                        {results.equityFlags.map(f => (
                          <div key={f}>• {f}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="card p-4">
                <div className="label-sm mb-2">Dernier scénario</div>
                <div className="text-sm font-medium text-ink">{scenario.name || 'Sans nom'}</div>
                <div className="text-xs text-ink-400 mt-1 space-y-0.5">
                  <div>Centre pointe: {scenario.centrePeakPriceCHFh} CHF/h</div>
                  <div>Centre creux: {scenario.centreOffpeakPriceCHFh} CHF/h</div>
                  <div>Rabais TP: {scenario.tpOffpeakDiscountPct}%</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => navigate('/scenario')} className="btn-ghost text-xs px-3 py-1.5">
                    Modifier
                  </button>
                  <button onClick={() => navigate('/resultats')} className="btn-secondary text-xs px-3 py-1.5">
                    Résultats →
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto">
                <span className="text-2xl">◈</span>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Aucune simulation</h3>
                <p className="text-sm text-ink-500 mt-1">
                  Configurez et lancez votre premier scénario pour visualiser les résultats.
                </p>
              </div>
              <button
                onClick={() => navigate('/scenario')}
                className="btn-primary w-full justify-center"
                disabled={isSimulating}
              >
                {isSimulating ? 'Simulation...' : '+ Nouveau scénario'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {results && (
        <div className="card p-6 animate-fade-up animate-fade-up-delay-3">
          <div className="label-sm mb-2">Synthèse</div>
          <p className="text-sm text-ink-700 leading-relaxed">{results.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => navigate('/resultats')} className="btn-secondary text-xs">
              Résultats détaillés →
            </button>
            <button onClick={() => navigate('/personas')} className="btn-ghost text-xs">
              Impact personas →
            </button>
            <button onClick={() => navigate('/actions')} className="btn-ghost text-xs">
              Plan d'actions →
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card p-5 animate-fade-up animate-fade-up-delay-4">
        <div className="label-sm mb-4">Légende méthodologique</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0 mt-1" />
            <div>
              <div className="text-sm font-medium text-ink">Vert — Fort potentiel</div>
              <div className="text-xs text-ink-500">Élasticité ≥ 60/100. Conditions favorables à la bascule modale.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0 mt-1" />
            <div>
              <div className="text-sm font-medium text-ink">Orange — Potentiel modéré</div>
              <div className="text-xs text-ink-500">Élasticité 35–59/100. Nécessite mesures complémentaires.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0 mt-1" />
            <div>
              <div className="text-sm font-medium text-ink">Rouge — Faible potentiel</div>
              <div className="text-xs text-ink-500">Élasticité &lt; 35/100. Dépendance auto structurelle forte.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
