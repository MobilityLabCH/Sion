import { useState } from 'react';
import { useApp } from '../hooks/store';
import { DEFAULT_SCENARIO } from '../types.ts';
import * as api from '../lib/api.ts';
import type { InsightsResponse } from '../types.ts';

type Priority = 'M' | 'S' | 'C' | 'W';
type Effort = 'S' | 'M' | 'L';

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; description: string }> = {
  M: { label: 'Must have', color: 'bg-red-50 text-red-700 border-red-200', description: 'Critique pour le MVP' },
  S: { label: 'Should have', color: 'bg-amber-50 text-amber-700 border-amber-200', description: 'Important, V1.1' },
  C: { label: 'Could have', color: 'bg-blue-50 text-blue-700 border-blue-200', description: 'Valeur ajoutée, V2' },
  W: { label: "Won't have", color: 'bg-ink-50 text-ink-500 border-ink-200', description: 'Hors scope actuel' },
};

const EFFORT_CONFIG: Record<Effort, { label: string; color: string }> = {
  S: { label: 'S <1 sem', color: 'bg-green-50 text-green-700' },
  M: { label: 'M 1-4 sem', color: 'bg-amber-50 text-amber-700' },
  L: { label: 'L >1 mois', color: 'bg-red-50 text-red-700' },
};

export default function Ameliorations() {
  const { results, scenario } = useApp();
  const [improvements, setImprovements] = useState<NonNullable<InsightsResponse['improvements']>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filter, setFilter] = useState<Priority | 'all'>('all');

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      // Use actual results if available, otherwise use a mock scenario
      const demoResults = results || {
        scenarioId: 'demo',
        timestamp: new Date().toISOString(),
        globalShiftIndex: 0.22,
        zoneResults: [],
        personaResults: [],
        equityFlags: [],
        hypotheses: [],
        summary: 'Simulation de démonstration',
      };

      const insightsData = await api.fetchInsights(
        results ? scenario : DEFAULT_SCENARIO,
        demoResults as any,
        true
      );

      if (insightsData.improvements) {
        setImprovements(insightsData.improvements);
      }
      setHasLoaded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = filter === 'all'
    ? improvements
    : improvements.filter(i => i.priority === filter);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="section-title">Améliorations produit</h1>
            <p className="text-ink-500 mt-1 text-sm">
              Cloudflare Workers AI génère des recommandations priorisées (MoSCoW)
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="btn-primary flex-shrink-0"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Génération IA...
              </span>
            ) : (
              <>✦ {hasLoaded ? 'Régénérer' : 'Générer'} les améliorations</>
            )}
          </button>
        </div>
      </div>

      {/* Info card */}
      {!hasLoaded && !isLoading && (
        <div className="card p-8 text-center animate-fade-up animate-fade-up-delay-1">
          <div className="w-14 h-14 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✦</span>
          </div>
          <h3 className="font-semibold text-ink mb-2">Amélioration continue par IA</h3>
          <p className="text-sm text-ink-500 max-w-md mx-auto mb-6">
            Cette page utilise Cloudflare Workers AI pour analyser le produit et proposer
            des améliorations priorisées selon la méthode MoSCoW, avec estimation effort/valeur.
          </p>
          <button onClick={handleGenerate} className="btn-primary mx-auto">
            ✦ Générer les recommandations
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="h-3 bg-ink-100 rounded animate-pulse w-2/3" />
              <div className="h-2 bg-ink-50 rounded animate-pulse w-full" />
              <div className="h-2 bg-ink-50 rounded animate-pulse w-3/4" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-ink-100 rounded-full animate-pulse" />
                <div className="h-5 w-12 bg-ink-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {hasLoaded && improvements.length > 0 && !isLoading && (
        <>
          {/* MoSCoW legend + filter */}
          <div className="card p-4 animate-fade-up">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="label-sm mr-2">Filtrer:</span>
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === 'all' ? 'bg-ink text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}
              >
                Tout ({improvements.length})
              </button>
              {(['M', 'S', 'C', 'W'] as Priority[]).map(p => {
                const count = improvements.filter(i => i.priority === p).length;
                if (count === 0) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setFilter(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      filter === p
                        ? PRIORITY_CONFIG[p].color + ' ring-2 ring-offset-1'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    {PRIORITY_CONFIG[p].label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((item, i) => (
              <div
                key={i}
                className="card p-5 animate-fade-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-sm text-ink leading-tight">{item.title}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_CONFIG[item.priority].color}`}>
                      {item.priority}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-ink-600 leading-relaxed mb-3">{item.value}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-400">{PRIORITY_CONFIG[item.priority].label}</span>
                    <span className="text-ink-200">·</span>
                    <span className="text-xs text-ink-400">{PRIORITY_CONFIG[item.priority].description}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${EFFORT_CONFIG[item.effort]?.color || 'bg-ink-50 text-ink-500'}`}>
                    {EFFORT_CONFIG[item.effort]?.label || item.effort}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="card p-5 bg-ink-900 border-ink-700 text-white animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="text-xl">✦</span>
              <div>
                <div className="font-semibold text-sm">Généré par Cloudflare Workers AI</div>
                <p className="text-xs text-ink-300 mt-0.5">
                  {improvements.filter(i => i.priority === 'M').length} Must · {improvements.filter(i => i.priority === 'S').length} Should · {improvements.filter(i => i.priority === 'C').length} Could · {improvements.filter(i => i.priority === 'W').length} Won't · {improvements.length} suggestions totales
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
