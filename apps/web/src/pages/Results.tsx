import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store.ts';
import ZoneMap from '../components/ZoneMap.tsx';
import KPICard from '../components/KPICard.tsx';
import CategoryPill from '../components/CategoryPill.tsx';

export default function Results() {
  const { results, insights, isLoadingInsights, loadInsights, scenario } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (results && !insights && !isLoadingInsights) {
      loadInsights();
    }
  }, [results]);

  if (!results) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="card p-10 max-w-md mx-auto">
          <div className="text-4xl mb-4">◉</div>
          <h2 className="section-title mb-2">Aucun résultat</h2>
          <p className="text-ink-500 text-sm mb-6">Lancez d'abord une simulation depuis le configurateur.</p>
          <button onClick={() => navigate('/scenario')} className="btn-primary mx-auto">
            Configurer un scénario →
          </button>
        </div>
      </div>
    );
  }

  const greenCount = results.zoneResults.filter(z => z.category === 'vert').length;
  const redCount = results.zoneResults.filter(z => z.category === 'rouge').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="animate-fade-up flex items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Résultats de simulation</h1>
          <p className="text-ink-500 mt-1 text-sm">
            {scenario.name || 'Scénario'} · {new Date(results.timestamp).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/personas')} className="btn-secondary">
            Personas →
          </button>
          <button onClick={() => navigate('/actions')} className="btn-primary">
            Plan d'actions →
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up animate-fade-up-delay-1">
        <KPICard
          label="Shift global"
          value={(results.globalShiftIndex * 100).toFixed(0)}
          unit="%"
          color={results.globalShiftIndex > 0.3 ? 'green' : results.globalShiftIndex > 0.15 ? 'orange' : 'red'}
          description="Voiture → alternatives"
        />
        <KPICard
          label="Zones fort potentiel"
          value={greenCount}
          unit={` / ${results.zoneResults.length}`}
          color="green"
        />
        <KPICard
          label="Zones faible potentiel"
          value={redCount}
          unit={` / ${results.zoneResults.length}`}
          color={redCount > 2 ? 'red' : 'default'}
        />
        <KPICard
          label="Risques équité"
          value={results.equityFlags.length}
          color={results.equityFlags.length > 0 ? 'red' : 'green'}
          description="Profils potentiellement pénalisés"
        />
      </div>

      {/* Map + zone table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-0 overflow-hidden animate-fade-up animate-fade-up-delay-2">
          <div className="p-4 border-b border-ink-100">
            <h2 className="font-semibold text-sm">Carte — Potentiel de bascule modale</h2>
          </div>
          <ZoneMap zoneResults={results.zoneResults} height="400px" />
        </div>

        <div className="card overflow-hidden animate-fade-up animate-fade-up-delay-2">
          <div className="p-4 border-b border-ink-100">
            <h2 className="font-semibold text-sm">Détail par zone</h2>
          </div>
          <div className="divide-y divide-ink-50">
            {results.zoneResults.map(zone => (
              <div key={zone.zoneId} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="font-medium text-sm text-ink">{zone.label}</div>
                    {zone.estimatedThreshold && (
                      <div className="text-xs text-ink-400 mt-0.5">
                        Seuil bascule estimé: ~{zone.estimatedThreshold.toFixed(1)} CHF/h
                      </div>
                    )}
                  </div>
                  <CategoryPill category={zone.category} />
                </div>

                {/* Mode split bar */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-ink-400 w-20 flex-shrink-0">Voiture</span>
                    <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all"
                        style={{ width: `${(zone.modeSplit.car * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-ink-600 w-8 text-right">{(zone.modeSplit.car * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-ink-400 w-20 flex-shrink-0">TP</span>
                    <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all"
                        style={{ width: `${(zone.modeSplit.tp * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-ink-600 w-8 text-right">{(zone.modeSplit.tp * 100).toFixed(0)}%</span>
                  </div>
                  {zone.modeSplit.covoiturage > 0.01 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ink-400 w-20 flex-shrink-0">Covoit.</span>
                      <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all"
                          style={{ width: `${(zone.modeSplit.covoiturage * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <span className="text-ink-600 w-8 text-right">{(zone.modeSplit.covoiturage * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-ink-500">
                  <span>Élasticité: <strong className="text-ink">{zone.elasticityScore}/100</strong></span>
                  <span>Shift: <strong className="text-ink">{(zone.shiftIndex * 100).toFixed(0)}%</strong></span>
                  {zone.equityFlag && (
                    <span className="text-red-600 font-medium">⚠ Équité</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Synthèse décisionnelle */}
        <div className="card p-6 animate-fade-up animate-fade-up-delay-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">Synthèse décisionnelle</h2>
            {isLoadingInsights && (
              <span className="text-xs text-ink-400 flex items-center gap-1">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Génération IA...
              </span>
            )}
          </div>
          {insights ? (
            <ul className="space-y-3">
              {insights.summaryBullets.map((bullet, i) => (
                <li key={i} className="flex gap-3 text-sm text-ink-700">
                  <span className="text-accent font-bold flex-shrink-0 mt-0.5">→</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : isLoadingInsights ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-4 bg-ink-100 rounded animate-pulse" style={{ width: `${70 + i * 8}%` }} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Risques & mitigations */}
        <div className="card p-6 animate-fade-up animate-fade-up-delay-3">
          <h2 className="font-semibold text-ink mb-4">Risques & mitigations</h2>
          {insights ? (
            <div className="space-y-4">
              {insights.risks.map((item, i) => (
                <div key={i} className="border-l-2 border-amber-300 pl-3">
                  <div className="text-sm font-medium text-ink">{item.risk}</div>
                  <div className="text-xs text-ink-500 mt-1">↳ {item.mitigation}</div>
                </div>
              ))}
            </div>
          ) : isLoadingInsights ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 bg-ink-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-ink-50 rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Hypotheses */}
      <div className="card p-5 animate-fade-up">
        <details>
          <summary className="label-sm cursor-pointer select-none">
            Hypothèses du modèle (développer)
          </summary>
          <ul className="mt-3 space-y-1">
            {results.hypotheses.map((h, i) => (
              <li key={i} className="text-xs text-ink-500 flex gap-2">
                <span className="text-ink-300">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
