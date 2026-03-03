import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';
import ZoneMap from '../components/ZoneMap.tsx';
import KPICard from '../components/KPICard.tsx';
import CategoryPill from '../components/CategoryPill.tsx';
import SliderField from '../components/SliderField.tsx';
import ToggleField from '../components/ToggleField.tsx';
import type { Scenario, DayType, Objective } from '../types';
import { BASELINE_SCENARIO } from '../types';

const SEV = {
  fluide:  { color: 'text-green-600',  bg: 'bg-green-50  border-green-200',  dot: 'bg-green-500',  label: 'Fluide' },
  modéré:  { color: 'text-amber-600',  bg: 'bg-amber-50  border-amber-200',  dot: 'bg-amber-500',  label: 'Modéré' },
  dense:   { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', label: 'Dense' },
  bloqué:  { color: 'text-red-600',    bg: 'bg-red-50    border-red-200',    dot: 'bg-red-500',    label: 'Bloqué' },
} as const;

const DAY_OPTIONS: { value: DayType; label: string; note?: string }[] = [
  { value: 'weekday', label: 'Lun–Jeu', note: 'normal' },
  { value: 'friday',  label: 'Vendredi', note: '⚡ gratuit dès 17h' },
  { value: 'saturday',label: 'Samedi',   note: '⚡ gratuit (actuel)' },
  { value: 'sunday',  label: 'Dimanche' },
];

const OBJECTIVES: { value: Objective; label: string; icon: string }[] = [
  { value: 'reduce-peak-car',    label: 'Réduire voiture pointe', icon: '🚗' },
  { value: 'protect-short-stay', label: 'Protéger commerces',     icon: '🛍' },
  { value: 'equity-access',      label: 'Équité & accès',         icon: '⚖️' },
  { value: 'attractivity',       label: 'Attractivité centre',    icon: '🏙' },
  { value: 'revenue',            label: 'Recettes parking',       icon: '💰' },
];

const BASELINE_PRESETS = [
  { label: 'Gratuité vendredi/samedi', note: 'Mesure actuelle 2025', scenario: BASELINE_SCENARIO, icon: '📍' },
  { label: 'Tarifs normaux', note: 'Sans aucune gratuité', icon: '💶',
    scenario: { ...BASELINE_SCENARIO, enableFreeBus: false, dayType: 'weekday' as DayType,
      centrePeakPriceCHFh: 3.0, centreOffpeakPriceCHFh: 1.5,
      name: 'Sans gratuité — tarifs normaux' } },
  { label: 'Bus gratuits seulement', note: 'Parking payant + bus offert', icon: '🚌',
    scenario: { ...BASELINE_SCENARIO, enableFreeBus: true, centrePeakPriceCHFh: 3.0,
      name: 'Bus gratuits, parking payant' } },
  { label: 'Tarification dynamique', note: 'Prix selon saturation', icon: '⚡',
    scenario: { ...BASELINE_SCENARIO, centrePeakPriceCHFh: 4.5, centreOffpeakPriceCHFh: 1.0,
      progressiveSlopeFactor: 1.5, enableFreeBus: false, dayType: 'weekday' as DayType,
      name: 'Tarification dynamique forte' } },
];

function DeltaBadge({ val, unit = '%', invert = false }: { val: number; unit?: string; invert?: boolean }) {
  const good = invert ? val < 0 : val > 0;
  const color = Math.abs(val) < 0.5 ? 'text-ink-400' : good ? 'text-green-600' : 'text-red-600';
  const sign = val > 0 ? '+' : '';
  return <span className={`text-xs font-mono font-semibold ${color}`}>{sign}{val.toFixed(1)}{unit}</span>;
}

export default function Dashboard() {
  const {
    scenario, updateScenario, setScenario,
    results, baselineResults, isSimulating,
    runSimulation, runBaselineSimulation,
    trafficData, isLoadingTraffic, fetchTraffic,
    compareMode, setCompareMode,
  } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTraffic();
    const iv = setInterval(fetchTraffic, 120_000);
    return () => clearInterval(iv);
  }, []);

  // Lancer aussi le baseline au premier chargement
  useEffect(() => {
    if (!baselineResults) runBaselineSimulation();
  }, []);

  const handleSimulate = useCallback(async () => {
    await runSimulation();
  }, [runSimulation]);

  const applyPreset = (s: Scenario) => {
    setScenario({ ...s });
  };

  const sev = trafficData?.connected ? (trafficData.severity ?? 'fluide') : null;
  const sevCfg = sev ? SEV[sev] : null;

  const shift = results ? (results.globalShiftIndex * 100) : null;
  const bShift = baselineResults ? (baselineResults.globalShiftIndex * 100) : null;
  const shiftDelta = shift !== null && bShift !== null ? shift - bShift : null;

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      {/* ── HEADER STATUT ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-ink-100 px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
        <span className="font-semibold text-ink">Sion Mobility · Outil d'aide à la décision</span>
        <span className="text-ink-300">|</span>

        {/* TomTom badge */}
        {isLoadingTraffic ? (
          <span className="text-ink-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse" /> Trafic…
          </span>
        ) : trafficData?.connected ? (
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium ${sevCfg?.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sevCfg?.dot} animate-pulse`} />
            <span className={sevCfg?.color}>Trafic {sevCfg?.label} · {trafficData.currentSpeed} km/h</span>
          </span>
        ) : (
          <button onClick={fetchTraffic} className="text-ink-400 hover:text-ink underline">
            TomTom non connecté · Réessayer
          </button>
        )}

        {/* Badge données */}
        <span className="ml-auto flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 font-mono">✓ RÉEL</span>
          <span className="text-ink-300">parkings officiels sion.ch 2025</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-mono">⚠ ESTIMÉ</span>
          <span className="text-ink-300">comportements (modèle logit)</span>
        </span>
      </div>

      {/* ── LAYOUT 3 COLONNES ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 100px)' }}>

        {/* ── COL GAUCHE : Paramètres ───────────────────────────────── */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-ink-100 overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-ink-50">
            <div className="label-sm mb-3">Scénarios types</div>
            <div className="grid grid-cols-2 gap-1.5">
              {BASELINE_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.scenario)}
                  className={`text-left p-2 rounded-lg border text-xs transition-all ${
                    scenario.name === p.scenario.name
                      ? 'border-accent bg-accent-50 text-accent'
                      : 'border-ink-200 hover:border-accent-300 hover:bg-accent-50 text-ink'
                  }`}
                >
                  <div className="text-base mb-0.5">{p.icon}</div>
                  <div className="font-semibold leading-tight">{p.label}</div>
                  <div className="text-ink-400 mt-0.5 text-[10px]">{p.note}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fenêtre temporelle */}
          <div className="p-4 border-b border-ink-50">
            <div className="label-sm mb-2">Jour & heure</div>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => updateScenario({ dayType: d.value })}
                  className={`text-xs p-1.5 rounded-lg border text-center transition-all ${
                    scenario.dayType === d.value
                      ? 'border-accent bg-accent-50 text-accent font-semibold'
                      : 'border-ink-200 text-ink hover:border-accent-300'
                  }`}
                >
                  <div>{d.label}</div>
                  {d.note && <div className="text-[9px] text-amber-600">{d.note}</div>}
                </button>
              ))}
            </div>
            <div className="space-y-1 text-xs text-ink-500">
              <div className="flex items-center justify-between">
                <span>Début</span>
                <div className="flex items-center gap-1">
                  <input type="range" min={0} max={23} value={scenario.startHour}
                    onChange={e => updateScenario({ startHour: +e.target.value })}
                    className="w-24 slider-track" />
                  <span className="font-mono w-8 text-right">{scenario.startHour}h</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Fin</span>
                <div className="flex items-center gap-1">
                  <input type="range" min={0} max={24} value={scenario.endHour}
                    onChange={e => updateScenario({ endHour: +e.target.value })}
                    className="w-24 slider-track" />
                  <span className="font-mono w-8 text-right">{scenario.endHour}h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Objectif */}
          <div className="p-4 border-b border-ink-50">
            <div className="label-sm mb-2">Objectif politique</div>
            <div className="space-y-1">
              {OBJECTIVES.map(o => (
                <button
                  key={o.value}
                  onClick={() => updateScenario({ objective: o.value as Objective })}
                  className={`w-full text-left text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                    scenario.objective === o.value
                      ? 'bg-accent text-white'
                      : 'text-ink hover:bg-ink-50'
                  }`}
                >
                  <span>{o.icon}</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tarifs */}
          <div className="p-4 border-b border-ink-50 space-y-4">
            <div className="label-sm">Tarifs parking</div>
            <SliderField
              label="Centre — Pointe" value={scenario.centrePeakPriceCHFh}
              min={0} max={6} step={0.5} unit=" CHF/h"
              onChange={v => updateScenario({ centrePeakPriceCHFh: v })}
              referenceValue={3.0} referenceLabel="actuel"
            />
            <SliderField
              label="Centre — Creux" value={scenario.centreOffpeakPriceCHFh}
              min={0} max={4} step={0.5} unit=" CHF/h"
              onChange={v => updateScenario({ centreOffpeakPriceCHFh: v })}
              referenceValue={1.5} referenceLabel="actuel"
            />
            <SliderField
              label="P+R / Périphérie" value={scenario.peripheriePeakPriceCHFh}
              min={0} max={3} step={0.25} unit=" CHF/h"
              onChange={v => updateScenario({ peripheriePeakPriceCHFh: v })}
              referenceValue={0} referenceLabel="gratuit"
            />
          </div>

          {/* Alternatives */}
          <div className="p-4 space-y-3">
            <div className="label-sm">Alternatives & mesures</div>
            <ToggleField label="Bus gratuits" description="Vendredi soir + samedi (mesure actuelle)" value={scenario.enableFreeBus} onChange={v => updateScenario({ enableFreeBus: v })} icon="🚌" />
            <ToggleField label="Covoiturage" description="Stimuler offre Sion-Région" value={scenario.enableCovoiturage} onChange={v => updateScenario({ enableCovoiturage: v })} icon="🚗" />
            <ToggleField label="TAD Valais" description="Taxibus inter-zones" value={scenario.enableTAD} onChange={v => updateScenario({ enableTAD: v })} icon="🚕" />
            <ToggleField label="Taxi-bons" description="PMR & revenus modestes" value={scenario.enableTaxiBons} onChange={v => updateScenario({ enableTaxiBons: v })} icon="🎫" />
          </div>

          {/* Bouton simuler */}
          <div className="p-4 mt-auto border-t border-ink-100">
            <button
              onClick={handleSimulate}
              disabled={isSimulating}
              className="btn-primary w-full justify-center disabled:opacity-50"
            >
              {isSimulating ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Calcul…</>
              ) : '▷ Simuler ce scénario'}
            </button>
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-ink-400 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compareMode}
                  onChange={e => setCompareMode(e.target.checked)}
                  className="rounded"
                />
                Comparer vs baseline
              </label>
            </div>
          </div>
        </div>

        {/* ── CARTE CENTRALE ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-3 bg-white border-b border-ink-100 flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm text-ink">Carte des zones — Sion</span>
              <span className="ml-2 text-xs text-ink-400">
                {results
                  ? `${scenario.name} · ${scenario.dayType} ${scenario.startHour}h–${scenario.endHour}h`
                  : 'Simulez un scénario pour colorer la carte'}
              </span>
            </div>
            {results && (
              <button onClick={() => navigate('/resultats')} className="btn-ghost text-xs">
                Détail complet →
              </button>
            )}
          </div>
          <div className="flex-1 relative">
            <ZoneMap
              zoneResults={results?.zoneResults}
              height="100%"
              className="absolute inset-0 rounded-none"
            />
            {!results && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 backdrop-blur rounded-xl p-6 text-center shadow-lg max-w-xs">
                  <div className="text-4xl mb-3">◈</div>
                  <div className="font-semibold text-ink">Aucune simulation</div>
                  <div className="text-xs text-ink-500 mt-1">Configurez le scénario à gauche et cliquez sur Simuler</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── COL DROITE : KPIs ─────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-ink-100 overflow-y-auto p-4 space-y-4">

          {/* Titre scénario actif */}
          <div>
            <div className="label-sm mb-1">Scénario actif</div>
            <div className="text-sm font-semibold text-ink leading-tight">{scenario.name}</div>
            <div className="text-xs text-ink-400 mt-0.5">
              {scenario.dayType} · {scenario.startHour}h–{scenario.endHour}h
              {scenario.enableFreeBus ? ' · Bus gratuits ✓' : ''}
            </div>
          </div>

          {results ? (
            <>
              {/* KPI principal */}
              <div className={`rounded-xl p-4 border ${
                (results.globalShiftIndex * 100) > 30
                  ? 'bg-green-50 border-green-200'
                  : (results.globalShiftIndex * 100) > 15
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="text-xs text-ink-500 mb-1">Report modal global</div>
                <div className="text-3xl font-bold font-mono text-ink">
                  {(results.globalShiftIndex * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-ink-500 mt-0.5">voiture → alternatives</div>
                {compareMode && shiftDelta !== null && (
                  <div className="mt-2 pt-2 border-t border-ink-200">
                    <span className="text-xs text-ink-400">vs baseline : </span>
                    <DeltaBadge val={shiftDelta} />
                  </div>
                )}
              </div>

              {/* KPIs grille */}
              <div className="grid grid-cols-2 gap-2">
                <KPICard
                  label="Zones fort potentiel"
                  value={results.zoneResults.filter(z => z.category === 'vert').length}
                  unit={`/${results.zoneResults.length}`}
                  color="green"
                />
                <KPICard
                  label="Risques équité"
                  value={results.equityFlags.length}
                  color={results.equityFlags.length > 0 ? 'red' : 'green'}
                />
                {results.estimatedRevenueLossCHFyear !== undefined && (
                  <KPICard
                    label="Perte recettes/an"
                    value={Math.abs(results.estimatedRevenueLossCHFyear / 1000).toFixed(0)}
                    unit="k CHF"
                    color={results.estimatedRevenueLossCHFyear < 0 ? 'red' : 'green'}
                  />
                )}
                {results.co2SavedTonnesYear !== undefined && (
                  <KPICard
                    label="CO₂ évité/an"
                    value={results.co2SavedTonnesYear}
                    unit=" t"
                    color="green"
                  />
                )}
              </div>

              {/* Comparaison baseline côte-à-côte */}
              {compareMode && baselineResults && (
                <div className="rounded-xl border border-ink-200 overflow-hidden">
                  <div className="bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wide">
                    Comparaison vs baseline
                  </div>
                  <div className="divide-y divide-ink-50">
                    {results.zoneResults.map(z => {
                      const b = baselineResults.zoneResults.find(bz => bz.zoneId === z.zoneId);
                      if (!b) return null;
                      const delta = (z.shiftIndex - b.shiftIndex) * 100;
                      return (
                        <div key={z.zoneId} className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-xs text-ink">{z.label}</span>
                          <div className="flex items-center gap-1.5">
                            <CategoryPill category={z.category} />
                            <DeltaBadge val={delta} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Zones */}
              <div className="rounded-xl border border-ink-100 overflow-hidden">
                <div className="bg-ink-50 px-3 py-1.5 label-sm">Zones</div>
                <div className="divide-y divide-ink-50">
                  {results.zoneResults.map(z => (
                    <div key={z.zoneId} className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-ink">{z.label}</span>
                      <div className="flex items-center gap-1.5">
                        <CategoryPill category={z.category} />
                        <span className="text-xs font-mono text-ink-400">{(z.shiftIndex * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertes équité */}
              {results.equityFlags.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="text-xs font-semibold text-red-700 mb-1">⚠ Risques équité</div>
                  {results.equityFlags.map(f => (
                    <div key={f} className="text-xs text-red-600">• {f}</div>
                  ))}
                </div>
              )}

              {/* Actions rapides */}
              <div className="space-y-1.5">
                <button onClick={() => navigate('/resultats')} className="btn-secondary w-full text-xs justify-center">
                  Résultats détaillés
                </button>
                <button onClick={() => navigate('/personas')} className="btn-ghost w-full text-xs justify-center">
                  Impact par persona
                </button>
                <button onClick={() => navigate('/actions')} className="btn-ghost w-full text-xs justify-center">
                  Plan d'actions
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-ink-400">
              <div className="text-4xl mb-3">◈</div>
              <div className="text-sm">Lancez une simulation pour voir les KPIs</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
