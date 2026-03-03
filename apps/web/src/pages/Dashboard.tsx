/**
 * Dashboard.tsx — Layout 3 colonnes
 * Gauche : paramètres scénario (simplifié — sans mesures alternatives)
 * Centre : carte OD + zones + parkings
 * Droite : KPIs + sources
 */
import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';
import ZoneMap from '../components/ZoneMap';
import KPICard from '../components/KPICard';
import CategoryPill from '../components/CategoryPill';
import SliderField from '../components/SliderField';
import type { Scenario, DayType, Objective } from '../types';
import ODPanel from '../components/ODPanel';
import { BASELINE_SCENARIO } from '../types';

// ─── Constantes ─────────────────────────────────────────────────────────────

const SEV = {
  fluide:  { dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50 border-green-200',  label: 'Fluide'  },
  modéré:  { dot: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  label: 'Modéré'  },
  dense:   { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'Dense'  },
  bloqué:  { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50 border-red-200',       label: 'Bloqué' },
} as const;

const DAY_OPTS: { value: DayType; label: string; sub?: string }[] = [
  { value: 'weekday',  label: 'Lun–Jeu' },
  { value: 'friday',   label: 'Vendredi', sub: '⚡ gratuit dès 17h' },
  { value: 'saturday', label: 'Samedi',   sub: '⚡ gratuit (actuel)' },
  { value: 'sunday',   label: 'Dimanche' },
];

const OBJ_OPTS: { value: Objective; label: string; icon: string }[] = [
  { value: 'attractivity',       label: 'Attractivité centre',     icon: '🏙' },
  { value: 'reduce-peak-car',    label: 'Réduire voiture pointe',  icon: '🚗' },
  { value: 'protect-short-stay', label: 'Protéger commerces',      icon: '🛍' },
  { value: 'equity-access',      label: 'Équité & accessibilité',  icon: '⚖️' },
  { value: 'revenue',            label: 'Recettes parking',        icon: '💰' },
];

// Scénarios types — tous basés sur des mesures réelles sion.ch
const PRESETS = [
  {
    icon: '📍', label: 'Situation actuelle',
    sub: 'Gratuit ven.17h + sam.',
    s: BASELINE_SCENARIO,
  },
  {
    icon: '💶', label: 'Sans gratuité',
    sub: 'Tarif normal 7j/7',
    s: { ...BASELINE_SCENARIO, enableFreeBus: false, dayType: 'weekday' as DayType,
         centrePeakPriceCHFh: 3.0, centreOffpeakPriceCHFh: 1.5,
         name: 'Sans aucune gratuité — référence' },
  },
  {
    icon: '🚌', label: 'Bus gratuits seuls',
    sub: 'Parking payant + bus offert',
    s: { ...BASELINE_SCENARIO, enableFreeBus: true, centrePeakPriceCHFh: 3.0,
         centreOffpeakPriceCHFh: 1.5, name: 'Bus gratuits · parking payant' },
  },
  {
    icon: '⚡', label: 'Tarification dynamique',
    sub: 'Heure creuse −50%',
    s: { ...BASELINE_SCENARIO, enableFreeBus: false, dayType: 'weekday' as DayType,
         centrePeakPriceCHFh: 4.5, centreOffpeakPriceCHFh: 1.0,
         progressiveSlopeFactor: 1.5, name: 'Tarification dynamique' },
  },
];

// ─── Composant Δ-badge ────────────────────────────────────────────────────────
function Delta({ val, unit = '%', invertColor = false }: { val: number; unit?: string; invertColor?: boolean }) {
  const pos = invertColor ? val < 0 : val > 0;
  const neutral = Math.abs(val) < 0.5;
  const cls = neutral ? 'text-ink-400' : pos ? 'text-green-600' : 'text-red-600';
  return <span className={`font-mono text-xs font-semibold ${cls}`}>{val > 0 ? '+' : ''}{val.toFixed(1)}{unit}</span>;
}

// ─── Sources de données ───────────────────────────────────────────────────────
function DataSourcesPanel() {
  return (
    <div className="rounded-xl border border-ink-100 overflow-hidden">
      <div className="bg-ink-50 px-3 py-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Sources de données</span>
      </div>
      <div className="divide-y divide-ink-50 text-xs">
        {[
          {
            icon: '🅿️', label: 'Parkings Planta + Scex',
            src: 'sion.ch/stationnement',
            date: '2025', lic: 'OGD-CH',
            conf: 95, confLabel: '✓ RÉEL',
            confColor: 'text-green-700 bg-green-50',
            note: 'Capacités, tarifs, règles gratuité officielles'
          },
          {
            icon: '🗺', label: 'Zones géographiques',
            src: 'OpenStreetMap · MobilityLab',
            date: '2025', lic: 'ODbL',
            conf: 80, confLabel: '✓ RÉEL',
            confColor: 'text-green-700 bg-green-50',
            note: 'Périmètres approximatifs — à affiner avec SIG Sion'
          },
          {
            icon: '↗', label: 'Flux OD (origine→dest.)',
            src: 'ARE Microrecensement mobilité 2015',
            date: '2015', lic: 'OGD-CH',
            conf: 60, confLabel: '⚠ ESTIMÉ',
            confColor: 'text-amber-700 bg-amber-50',
            note: 'Volumes relatifs · données 2015 · calibration locale requise'
          },
          {
            icon: '🚌', label: 'Bus urbains Sion',
            src: 'CarPostal · lignes 1–9',
            date: '2025', lic: 'GTFS-CH',
            conf: 85, confLabel: '✓ RÉEL',
            confColor: 'text-green-700 bg-green-50',
            note: 'Fréquences, tarifs, arrêts géolocalisés'
          },
          {
            icon: '🚗', label: 'Trafic live',
            src: 'TomTom Traffic Flow v4',
            date: 'Temps réel', lic: 'Commercial',
            conf: 90, confLabel: '✓ LIVE',
            confColor: 'text-blue-700 bg-blue-50',
            note: 'Vitesse + congestion Grand-Pont (proxy Worker)'
          },
          {
            icon: '🧮', label: 'Modèle comportemental',
            src: 'Logit multinomial (RUM) · ETH IVT',
            date: '2025', lic: 'Open source',
            conf: 45, confLabel: '⚠ ESTIMÉ',
            confColor: 'text-amber-700 bg-amber-50',
            note: 'θ=0.6 · VOT ARE 2020 · calibration données réelles requise'
          },
        ].map(d => (
          <div key={d.label} className="px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span>{d.icon}</span>
                <span className="font-medium text-ink">{d.label}</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${d.confColor}`}>
                {d.confLabel}
              </span>
            </div>
            <div className="mt-0.5 text-ink-400 text-[10px] pl-5">
              {d.src} · {d.date} · {d.lic}
            </div>
            <div className="mt-0.5 text-ink-500 text-[10px] pl-5 italic">{d.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const {
    scenario, updateScenario, setScenario,
    results, baselineResults,
    isSimulating, runSimulation, runBaselineSimulation,
    trafficData, isLoadingTraffic, fetchTraffic,
    compareMode, setCompareMode,
    simulationSource, apiOnline,
  } = useApp() as any;
  const navigate = useNavigate();
  const [rightTab, setRightTab] = useState<'kpi' | 'od' | 'sources'>('kpi');

  // Init: fetch trafic + baseline
  useEffect(() => {
    fetchTraffic();
    const iv = setInterval(fetchTraffic, 120_000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (!baselineResults) runBaselineSimulation?.();
  }, []);

  const handleSimulate = useCallback(async () => {
    await runSimulation();
  }, [runSimulation]);

  const sev = trafficData?.connected ? (trafficData.severity ?? 'fluide') as keyof typeof SEV : null;
  const sevCfg = sev ? SEV[sev] : null;

  const shift = results ? results.globalShiftIndex * 100 : null;
  const bShift = baselineResults ? baselineResults.globalShiftIndex * 100 : null;
  const shiftDelta = shift !== null && bShift !== null ? shift - bShift : null;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>

      {/* ── Barre statut ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-ink-50 px-4 py-1.5 flex items-center gap-3 text-xs flex-shrink-0 flex-wrap">
        <span className="font-semibold text-ink">Outil d'aide à la décision · Mobilité Sion</span>
        <span className="text-ink-200">|</span>
        {isLoadingTraffic ? (
          <span className="text-ink-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse"/>Trafic…</span>
        ) : trafficData?.connected && sevCfg ? (
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium ${sevCfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sevCfg.dot} animate-pulse`}/>
            <span className={sevCfg.text}>Trafic Sion · {sevCfg.label} · {trafficData.currentSpeed} km/h</span>
          </span>
        ) : (
          <button onClick={fetchTraffic} className="text-ink-400 hover:text-ink underline">Trafic TomTom · Réessayer</button>
        )}
        <span className="ml-auto flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 font-mono">✓ RÉEL</span>
          <span className="text-ink-400">parkings officiels 2025</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-mono">⚠ ESTIMÉ</span>
          <span className="text-ink-400">comportements (modèle)</span>
          {simulationSource === 'local' && (
            <span className="px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700 font-mono" title="Worker inaccessible — simulation dans le navigateur">⚡ LOCAL</span>
          )}
        </span>
      </div>

      {/* ── Layout 3 colonnes ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Colonne gauche : Paramètres ───────────────────────────── */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-ink-100 overflow-y-auto flex flex-col text-xs">

          {/* Presets */}
          <div className="p-3 border-b border-ink-50">
            <div className="label-sm mb-2">Scénarios</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map(p => (
                <button key={p.label}
                  onClick={() => setScenario({ ...p.s })}
                  className={`text-left p-2 rounded-lg border transition-all ${
                    scenario.name === p.s.name
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-ink-200 hover:border-red-200 hover:bg-red-50 text-ink'
                  }`}
                >
                  <div className="text-lg mb-0.5">{p.icon}</div>
                  <div className="font-semibold leading-tight text-[11px]">{p.label}</div>
                  <div className="text-ink-400 mt-0.5 text-[10px]">{p.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Jour & heure */}
          <div className="p-3 border-b border-ink-50">
            <div className="label-sm mb-2">Jour & fenêtre horaire</div>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {DAY_OPTS.map(d => (
                <button key={d.value}
                  onClick={() => updateScenario({ dayType: d.value })}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    scenario.dayType === d.value
                      ? 'border-red-300 bg-red-50 text-red-700 font-semibold'
                      : 'border-ink-200 text-ink hover:border-red-200'
                  }`}
                >
                  <div>{d.label}</div>
                  {d.sub && <div className="text-[9px] text-amber-600">{d.sub}</div>}
                </button>
              ))}
            </div>
            <div className="space-y-1 text-ink-500">
              <div className="flex items-center justify-between">
                <span>Début</span>
                <div className="flex items-center gap-1">
                  <input type="range" min={0} max={23} value={scenario.startHour}
                    onChange={e => updateScenario({ startHour: +e.target.value })}
                    className="w-20 slider-track"/>
                  <span className="font-mono w-7 text-right">{scenario.startHour}h</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Fin</span>
                <div className="flex items-center gap-1">
                  <input type="range" min={1} max={24} value={scenario.endHour}
                    onChange={e => updateScenario({ endHour: +e.target.value })}
                    className="w-20 slider-track"/>
                  <span className="font-mono w-7 text-right">{scenario.endHour}h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Objectif */}
          <div className="p-3 border-b border-ink-50">
            <div className="label-sm mb-2">Objectif politique</div>
            <div className="space-y-1">
              {OBJ_OPTS.map(o => (
                <button key={o.value}
                  onClick={() => updateScenario({ objective: o.value as Objective })}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                    scenario.objective === o.value ? 'bg-red-600 text-white' : 'text-ink hover:bg-ink-50'
                  }`}
                >
                  <span>{o.icon}</span><span>{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tarifs parking */}
          <div className="p-3 border-b border-ink-50 space-y-3">
            <div className="label-sm">Tarifs parking</div>
            <SliderField label="Centre — Pointe" value={scenario.centrePeakPriceCHFh}
              min={0} max={6} step={0.5} unit=" CHF/h"
              onChange={v => updateScenario({ centrePeakPriceCHFh: v })}
              referenceValue={3.0} referenceLabel="actuel"/>
            <SliderField label="Centre — Creux" value={scenario.centreOffpeakPriceCHFh}
              min={0} max={4} step={0.5} unit=" CHF/h"
              onChange={v => updateScenario({ centreOffpeakPriceCHFh: v })}
              referenceValue={1.5} referenceLabel="actuel"/>
            <SliderField label="P+R / Périphérie" value={scenario.peripheriePeakPriceCHFh}
              min={0} max={3} step={0.25} unit=" CHF/h"
              onChange={v => updateScenario({ peripheriePeakPriceCHFh: v })}
              referenceValue={0} referenceLabel="gratuit"/>
          </div>

          {/* Bus gratuits */}
          <div className="p-3 border-b border-ink-50">
            <div className="label-sm mb-2">Bus urbains (lignes 1–9)</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => updateScenario({ enableFreeBus: !scenario.enableFreeBus })}
                className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 cursor-pointer ${
                  scenario.enableFreeBus ? 'bg-green-500' : 'bg-ink-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${scenario.enableFreeBus ? 'translate-x-4' : ''}`}/>
              </div>
              <div>
                <div className="text-ink font-medium">Bus gratuits</div>
                <div className="text-ink-400 text-[10px]">Mesure actuelle ven. dès 17h + sam.</div>
              </div>
            </label>
            <div className="mt-1.5 text-[10px] text-ink-400 bg-ink-50 rounded-lg p-2">
              Source: Arrêté Conseil Communal Sion 2023<br/>
              Coût estimé: ~180 k CHF/an (CarPostal)
            </div>
          </div>

          {/* Bouton */}
          <div className="p-3 mt-auto">
            <button onClick={handleSimulate} disabled={isSimulating}
              className="btn-primary w-full justify-center disabled:opacity-50 text-xs">
              {isSimulating
                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>Calcul…</>
                : '▷ Simuler'}
            </button>
            <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
              <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} className="rounded"/>
              <span className="text-ink-400 text-[10px]">Comparer vs baseline actuel</span>
            </label>
          </div>
        </div>

        {/* ── Carte centrale ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-ink-50">
          <div className="px-3 py-2 bg-white border-b border-ink-100 flex items-center justify-between flex-shrink-0">
            <div className="text-xs">
              <span className="font-semibold text-ink">{scenario.name}</span>
              <span className="text-ink-400 ml-2">
                {scenario.dayType} · {scenario.startHour}h–{scenario.endHour}h
                {scenario.enableFreeBus ? ' · 🚌 Bus gratuits' : ''}
              </span>
            </div>
            {results && (
              <button onClick={() => navigate('/resultats')} className="btn-ghost text-xs py-1">
                Détail →
              </button>
            )}
          </div>
          <div className="flex-1 relative">
            <ZoneMap
              zoneResults={results?.zoneResults}
              height="100%"
              className="absolute inset-0 rounded-none"
              showODFlows={true}
              scenarioPeakPrice={scenario.centrePeakPriceCHFh}
              dayType={scenario.dayType}
            />
            {!results && !isSimulating && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 backdrop-blur rounded-xl p-6 text-center shadow-lg max-w-xs">
                  <div className="text-3xl mb-3">◈</div>
                  <div className="font-semibold text-ink text-sm">Aucune simulation</div>
                  <div className="text-xs text-ink-500 mt-1">Configurez le scénario et cliquez sur Simuler</div>
                </div>
              </div>
            )}
            {isSimulating && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl p-6 shadow-lg text-center">
                  <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
                  <div className="text-sm font-semibold text-ink">Simulation en cours…</div>
                  <div className="text-xs text-ink-400 mt-1">Calcul logit sur 8 zones · 12 personas</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Colonne droite ────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 bg-white border-l border-ink-100 flex flex-col">
          {/* Onglets droite */}
          <div className="flex border-b border-ink-100 flex-shrink-0">
            {([
              { id: 'kpi',     label: 'KPIs',    icon: '◉' },
              { id: 'od',      label: 'OD',      icon: '↗' },
              { id: 'sources', label: 'Sources', icon: '📋' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setRightTab(t.id)}
                className={`flex-1 text-xs py-2 border-b-2 transition-all ${
                  rightTab === t.id ? 'border-red-600 text-red-700 font-semibold bg-red-50' : 'border-transparent text-ink-500 hover:bg-ink-50'
                }`}>
                <span className="mr-1">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

          {rightTab === 'kpi' && results ? (
            <>
              {/* KPI shift global */}
              <div className={`rounded-xl p-3 border ${
                results.globalShiftIndex * 100 > 25 ? 'bg-green-50 border-green-200' :
                results.globalShiftIndex * 100 > 12 ? 'bg-amber-50 border-amber-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="text-[10px] text-ink-500 mb-0.5">Report modal estimé ⚠</div>
                <div className="text-3xl font-bold font-mono text-ink">
                  {(results.globalShiftIndex * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-ink-500">voiture → autres modes</div>
                {compareMode && shiftDelta !== null && (
                  <div className="mt-1.5 pt-1.5 border-t border-ink-200 text-[10px] flex items-center gap-1">
                    <span className="text-ink-400">vs baseline :</span>
                    <Delta val={shiftDelta}/>
                  </div>
                )}
              </div>

              {/* KPIs grille 2×2 */}
              <div className="grid grid-cols-2 gap-2">
                <KPICard label="Zones fort potentiel"
                  value={results.zoneResults.filter((z: any) => z.category === 'vert').length}
                  unit={`/${results.zoneResults.length}`} color="green"/>
                <KPICard label="Risques équité"
                  value={results.equityFlags.length}
                  color={results.equityFlags.length > 0 ? 'red' : 'green'}/>
                {results.estimatedRevenueLossCHFyear !== undefined && (
                  <KPICard label="Impact recettes/an ⚠"
                    value={Math.abs(Math.round(results.estimatedRevenueLossCHFyear / 1000))}
                    unit="k CHF" color={results.estimatedRevenueLossCHFyear < -5000 ? 'red' : 'default'}/>
                )}
                {results.co2SavedTonnesYear !== undefined && (
                  <KPICard label="CO₂ évité ⚠"
                    value={results.co2SavedTonnesYear} unit=" t/an" color="green"/>
                )}
              </div>

              {/* Comparaison vs baseline */}
              {compareMode && baselineResults && (
                <div className="rounded-xl border border-ink-200 overflow-hidden">
                  <div className="bg-ink-50 px-3 py-1.5 text-[10px] font-semibold text-ink-500 uppercase tracking-wide">
                    Δ vs baseline (situation actuelle)
                  </div>
                  <div className="divide-y divide-ink-50">
                    {results.zoneResults.map((z: any) => {
                      const b = baselineResults.zoneResults.find((bz: any) => bz.zoneId === z.zoneId);
                      if (!b) return null;
                      const d = (z.shiftIndex - b.shiftIndex) * 100;
                      return (
                        <div key={z.zoneId} className="flex items-center justify-between px-3 py-1.5 text-xs">
                          <span className="text-ink">{z.label}</span>
                          <div className="flex items-center gap-1.5">
                            <CategoryPill category={z.category}/>
                            <Delta val={d}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Zones détail */}
              <div className="rounded-xl border border-ink-100 overflow-hidden">
                <div className="bg-ink-50 px-3 py-1.5 text-[10px] font-semibold text-ink-500 uppercase tracking-wide">Zones</div>
                <div className="divide-y divide-ink-50">
                  {results.zoneResults.map((z: any) => (
                    <div key={z.zoneId} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <div className="text-xs text-ink">{z.label}</div>
                        {z.avgParkingCostCHF !== undefined && (
                          <div className="text-[10px] text-ink-400">{z.avgParkingCostCHF} CHF/h · {z.occupancyPct ?? '—'}% occ.</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CategoryPill category={z.category}/>
                        <span className="text-[10px] font-mono text-ink-400">{(z.shiftIndex * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Équité */}
              {results.equityFlags.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="text-xs font-semibold text-red-700 mb-1">⚠ Risques équité</div>
                  {results.equityFlags.map((f: string) => (
                    <div key={f} className="text-xs text-red-600">• {f}</div>
                  ))}
                </div>
              )}

              {/* Note méthodologique */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800">
                <div className="font-semibold mb-1">⚠ Résultats indicatifs</div>
                Les chiffres (%, CHF) sont des ordres de grandeur issus du modèle logit.
                Calibration sur données réelles (comptages) requise avant décision politique.
                <div className="mt-1 text-amber-600">Modèle : RUM logit multinomial · θ=0.6 · VOT ARE 2020</div>
              </div>

              {/* Actions */}
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
              <div className="text-3xl mb-3">◈</div>
              <div className="text-sm font-medium text-ink">Aucune simulation</div>
              <div className="text-xs text-ink-500 mt-1">Configurez et lancez</div>
            </div>
          )}

          {/* OD Tab */}
          {rightTab === 'od' && (
            <div className="-mx-3 -mt-3 flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
              <ODPanel scenario={scenario} zoneResults={results?.zoneResults}/>
            </div>
          )}

          {/* Sources Tab */}
          {rightTab === 'sources' && <DataSourcesPanel/>}
          </div>
        </div>
      </div>
    </div>
  );
}
