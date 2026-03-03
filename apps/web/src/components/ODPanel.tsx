/**
 * ODPanel.tsx — Carte Origine-Destination interactive
 *
 * MODE 1 (Démonstration) : 1 usager, AVANT/APRÈS
 *   - Sélectionner zone d'origine + profil
 *   - Voir la décision probable + explication
 *   - Comparaison visuelle baseline vs scénario
 *   → Pédagogie et débat politique
 *
 * MODE 2 (Agrégé) : heatmap de pression + flux par zones
 *   - Redistribution globale des usagers
 *   - Tableau récapitulatif
 */
import { useState, useMemo } from 'react';
import type { Scenario, SimulationResults, ZoneResult } from '../types';

// ─── Données TP embarquées ────────────────────────────────────────────────────
const TP_DATA: Record<string, { time: number; freq: number; fare: number; access: number; note: string }> = {
  centre:     { time: 0,  freq: 10, fare: 3.20, access: 0.90, note: 'Bus urbains lignes 1–4 · 10 min' },
  gare:       { time: 8,  freq: 8,  fare: 3.20, access: 0.95, note: 'Hub CFF + bus · 8 min pointe' },
  est:        { time: 14, freq: 18, fare: 3.20, access: 0.65, note: 'Ligne 2 · Uvrier · 18 min creux' },
  ouest:      { time: 18, freq: 22, fare: 3.20, access: 0.55, note: 'Châteauneuf · 22 min creux' },
  nord:       { time: 22, freq: 25, fare: 3.20, access: 0.45, note: 'Savièse / Bramois · 25 min creux' },
  sud:        { time: 16, freq: 20, fare: 3.20, access: 0.50, note: 'Zone ind. · desserte limitée' },
  emploi:     { time: 20, freq: 30, fare: 3.80, access: 0.25, note: 'CERM / HES-SO · peu desservi' },
  peripherie: { time: 35, freq: 45, fare: 4.20, access: 0.20, note: 'Nendaz / Ayent · TP peu attractif' },
};

const ZONE_DIST_KM: Record<string, number> = {
  centre: 0.3, gare: 0.8, est: 2.2, ouest: 2.5, nord: 3.5, sud: 2.8, emploi: 4.2, peripherie: 6.0,
};

const ZONES = [
  { id: 'peripherie', label: 'Périphérie (Nendaz, Ayent…)',  emoji: '🏔' },
  { id: 'nord',       label: 'Nord (Savièse, Bramois)',       emoji: '⬆' },
  { id: 'est',        label: 'Est (Uvrier)',                  emoji: '➡' },
  { id: 'ouest',      label: "Ouest (Châteauneuf)",           emoji: '⬅' },
  { id: 'sud',        label: 'Sud (zone industrielle)',       emoji: '⬇' },
  { id: 'gare',       label: 'Gare CFF',                     emoji: '🚉' },
  { id: 'centre',     label: 'Centre-ville',                  emoji: '🏙' },
];

const PROFILES = [
  { id: 'pendulaire', label: 'Pendulaire quotidien',  emoji: '👔', vot: 28, carDep: 0.78, tpAffinity: 0.35, schedRig: 0.85, income: 'moyen',  dur: 'long'  as const },
  { id: 'visiteur',   label: 'Visiteur / Commerces',  emoji: '🛍', vot: 22, carDep: 0.55, tpAffinity: 0.45, schedRig: 0.50, income: 'moyen',  dur: 'short' as const },
  { id: 'senior',     label: 'Senior dépendant auto', emoji: '👴', vot: 15, carDep: 0.88, tpAffinity: 0.18, schedRig: 0.70, income: 'faible', dur: 'short' as const },
  { id: 'etudiant',   label: 'Étudiant / TP',         emoji: '🎒', vot: 8,  carDep: 0.10, tpAffinity: 0.90, schedRig: 0.45, income: 'faible', dur: 'short' as const },
  { id: 'soignant',   label: 'Soignant hôpital',      emoji: '🏥', vot: 35, carDep: 0.92, tpAffinity: 0.12, schedRig: 0.95, income: 'moyen',  dur: 'short' as const },
  { id: 'retraite',   label: 'Retraité actif',         emoji: '🧓', vot: 18, carDep: 0.62, tpAffinity: 0.48, schedRig: 0.38, income: 'moyen',  dur: 'short' as const },
];

// ─── Modèle de coût simplifié (logit) ────────────────────────────────────────
const TEMP = 0.6;
const SHORT_H = 1.0, LONG_H = 3.5;

function softmax(costs: number[]): number[] {
  const utils = costs.map(c => -c / TEMP);
  const max = Math.max(...utils);
  const exps = utils.map(u => Math.exp(u - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

function computeCosts(zoneId: string, profile: typeof PROFILES[0], scenario: Scenario, isBaseline: boolean) {
  const tp = TP_DATA[zoneId] || TP_DATA.peripherie;
  const dist = ZONE_DIST_KM[zoneId] || 3.0;
  const durationH = profile.dur === 'short' ? SHORT_H : LONG_H;
  const dayType = (scenario as any).dayType ?? 'weekday';
  const startH = (scenario as any).startHour ?? 8;

  // ── Coût voiture ──
  let parkPrice: number;
  if (isBaseline) {
    // Règles officielles Sion 2025
    if ((dayType === 'friday' && startH >= 17) || dayType === 'saturday') parkPrice = 0;
    else parkPrice = 3.0;
  } else {
    parkPrice = (zoneId === 'centre' || zoneId === 'gare')
      ? scenario.centrePeakPriceCHFh
      : scenario.peripheriePeakPriceCHFh;
    if (scenario.progressiveSlopeFactor > 1 && profile.dur === 'long') {
      parkPrice = parkPrice * 1 + (durationH - 1) * parkPrice * scenario.progressiveSlopeFactor;
    } else {
      parkPrice = parkPrice * durationH;
    }
  }
  const walkMin = Math.round(200 / 80);  // ~2.5 min marche depuis parking centre
  const driveCost = (profile.vot / 60) * (dist * 2.5) + 0.18 * dist;
  const walkCost = (profile.vot / 60) * walkMin;
  const carTotal = parkPrice + driveCost + walkCost;

  // ── Coût TP ──
  const freeBus = (scenario as any).enableFreeBus &&
    ((dayType === 'friday' && startH >= 17) || dayType === 'saturday');
  const tpFare = freeBus ? 0 : tp.fare * (1 - scenario.tpOffpeakDiscountPct / 100);
  const tpWait = (profile.vot / 60) * (tp.freq / 2);
  const tpTime = (profile.vot / 60) * tp.time;
  const tpTotal = profile.tpAffinity > 0.05 ? (tpFare + tpWait + tpTime) : 9999;

  const costs = [carTotal, tpTotal, 9999]; // voiture, TP, autre
  const probs = softmax(costs);
  const idx = probs.indexOf(Math.max(...probs));

  return {
    carCost: Math.round(carTotal * 100) / 100,
    tpCost: tpTotal < 9999 ? Math.round(tpTotal * 100) / 100 : null,
    parkPrice: isBaseline ? (((dayType === 'friday' && startH >= 17) || dayType === 'saturday') ? 0 : 3.0 * durationH) : parkPrice,
    probs,
    mode: idx === 0 ? 'Voiture' : idx === 1 ? 'Transport public' : 'Autre',
    modeIcon: idx === 0 ? '🚗' : idx === 1 ? '🚌' : '🚶',
    modeColor: idx === 0 ? 'text-red-600' : idx === 1 ? 'text-green-600' : 'text-blue-600',
    modeBg: idx === 0 ? 'bg-red-50 border-red-200' : idx === 1 ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200',
  };
}

function computeExplanation(before: ReturnType<typeof computeCosts>, after: ReturnType<typeof computeCosts>, profile: typeof PROFILES[0], zoneId: string, scenario: Scenario): string[] {
  const lines: string[] = [];
  const dayType = (scenario as any).dayType ?? 'weekday';
  const startH = (scenario as any).startHour ?? 8;

  const parkDelta = after.parkPrice - before.parkPrice;
  if (parkDelta < -0.1) {
    lines.push(`💚 Parking moins cher : ${before.parkPrice.toFixed(2)} CHF → ${after.parkPrice.toFixed(2)} CHF (−${Math.abs(parkDelta).toFixed(2)} CHF)`);
  } else if (parkDelta > 0.1) {
    lines.push(`🔴 Parking plus cher : ${before.parkPrice.toFixed(2)} CHF → ${after.parkPrice.toFixed(2)} CHF (+${parkDelta.toFixed(2)} CHF)`);
  } else {
    lines.push(`✓ Coût parking inchangé : ${before.parkPrice.toFixed(2)} CHF`);
  }

  if ((scenario as any).enableFreeBus && ((dayType === 'friday' && startH >= 17) || dayType === 'saturday')) {
    lines.push(`🚌 Bus gratuits actifs — coût TP : ${after.tpCost?.toFixed(2) ?? '—'} CHF (vs ${before.tpCost?.toFixed(2) ?? '—'} CHF baseline)`);
  }

  if (before.mode !== after.mode) {
    lines.push(`→ Bascule modale probable : ${before.modeIcon} ${before.mode} → ${after.modeIcon} ${after.mode}`);
    if (after.mode === 'Transport public') {
      const tp = TP_DATA[zoneId];
      lines.push(`   Bus depuis votre zone : ~${tp.time} min, fréquence ${tp.freq} min. ${tp.note}.`);
    }
  } else {
    lines.push(`→ Mode dominant stable : ${after.modeIcon} ${after.mode}`);
  }

  if (profile.income === 'faible' && after.carCost > before.carCost * 1.15) {
    lines.push(`⚠ Risque équité : profil à revenu modeste, hausse de coût significative.`);
  }

  return lines;
}

// ─── Composant Mode 2 : heatmap agrégée ──────────────────────────────────────
function AggregatedFlows({ zoneResults }: { zoneResults?: ZoneResult[] }) {
  if (!zoneResults) {
    return (
      <div className="text-center py-8 text-ink-400">
        <div className="text-2xl mb-2">◉</div>
        <div className="text-sm">Simulez un scénario pour voir les flux agrégés</div>
      </div>
    );
  }

  const OD_PAIRS = [
    { from: 'Périphérie', to: 'Centre-ville', vol: 0.92, personas: ['Pendulaires', 'Visiteurs', 'Retraités'] },
    { from: 'Nord',       to: 'Centre-ville', vol: 0.72, personas: ['Savièse', 'Bramois'] },
    { from: 'Est',        to: 'Centre-ville', vol: 0.58, personas: ['Uvrier', 'Résidentiel Est'] },
    { from: 'Ouest',      to: 'Centre-ville', vol: 0.50, personas: ['Châteauneuf', 'Résidentiel Ouest'] },
    { from: 'Sud',        to: 'Centre-ville', vol: 0.38, personas: ['Zone industrielle'] },
    { from: 'Gare',       to: 'Centre-ville', vol: 0.60, personas: ['Arrivées CFF'] },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs text-ink-500 bg-amber-50 border border-amber-200 rounded-lg p-2">
        ⚠ Volumes relatifs estimés · Source : ARE Microrecensement mobilité 2015 · Estimation MobilityLab
      </div>

      {/* Flux OD tableau */}
      <div className="rounded-xl border border-ink-100 overflow-hidden">
        <div className="bg-ink-50 px-3 py-2 text-[10px] font-semibold text-ink-500 uppercase tracking-wide">
          Flux dominants → Centre-ville
        </div>
        <div className="divide-y divide-ink-50">
          {OD_PAIRS.map(p => {
            const zoneId = p.from.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const mapped: Record<string, string> = { peripherie: 'peripherie', nord: 'nord', est: 'est', ouest: 'ouest', sud: 'sud', gare: 'gare' };
            const zr = zoneResults.find(z => z.zoneId === (mapped[zoneId] ?? zoneId));
            const shift = zr ? zr.shiftIndex * 100 : 0;
            const barW = Math.round(p.vol * 100);
            return (
              <div key={p.from} className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-ink">{p.from}</span>
                    <span className="text-ink-300">→</span>
                    <span className="text-ink-600">Centre</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {zr && <span className={`text-[10px] font-mono ${zr.category === 'vert' ? 'text-green-600' : zr.category === 'orange' ? 'text-amber-600' : 'text-red-600'}`}>
                      {shift.toFixed(0)}% shift
                    </span>}
                  </div>
                </div>
                {/* Barre de volume */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${barW}%`,
                      background: zr?.category === 'vert' ? '#22c55e' : zr?.category === 'orange' ? '#f59e0b' : '#ef4444',
                    }}/>
                  </div>
                  <span className="text-[10px] text-ink-400 w-8 text-right">{barW}%</span>
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">{p.personas.join(' · ')}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Redistribution modale */}
      <div className="rounded-xl border border-ink-100 overflow-hidden">
        <div className="bg-ink-50 px-3 py-2 text-[10px] font-semibold text-ink-500 uppercase tracking-wide">
          Redistribution modale par zone
        </div>
        <div className="divide-y divide-ink-50">
          {zoneResults.map(z => (
            <div key={z.zoneId} className="px-3 py-2">
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-medium text-ink">{z.label}</span>
                <span className={`text-[10px] font-semibold ${z.category === 'vert' ? 'text-green-600' : z.category === 'orange' ? 'text-amber-600' : 'text-red-600'}`}>
                  {(z.shiftIndex * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex rounded-full overflow-hidden h-2">
                <div className="bg-red-400" style={{ width: `${z.modeSplit.car * 100}%` }} title={`Voiture: ${(z.modeSplit.car*100).toFixed(0)}%`}/>
                <div className="bg-green-400" style={{ width: `${z.modeSplit.tp * 100}%` }} title={`TP: ${(z.modeSplit.tp*100).toFixed(0)}%`}/>
                <div className="bg-blue-300" style={{ width: `${(z.modeSplit.covoiturage + z.modeSplit.tad) * 100}%` }}/>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-ink-400">
                <span>🚗 {(z.modeSplit.car*100).toFixed(0)}%</span>
                <span>🚌 {(z.modeSplit.tp*100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
interface ODPanelProps {
  scenario: Scenario;
  zoneResults?: ZoneResult[];
}

export default function ODPanel({ scenario, zoneResults }: ODPanelProps) {
  const [mode, setMode] = useState<'demo' | 'aggregate'>('demo');
  const [selectedZone, setSelectedZone] = useState('peripherie');
  const [selectedProfile, setSelectedProfile] = useState('pendulaire');

  const profile = PROFILES.find(p => p.id === selectedProfile) || PROFILES[0];
  const tp = TP_DATA[selectedZone] || TP_DATA.peripherie;

  // Calcul avant/après
  const BASELINE: Scenario = {
    ...scenario,
    centrePeakPriceCHFh: 3.0,
    centreOffpeakPriceCHFh: 1.5,
    peripheriePeakPriceCHFh: 0,
    peripherieOffpeakPriceCHFh: 0,
    progressiveSlopeFactor: 1.0,
    enableFreeBus: true,
  } as any;

  const before = useMemo(() => computeCosts(selectedZone, profile, BASELINE, true), [selectedZone, selectedProfile, scenario]);
  const after  = useMemo(() => computeCosts(selectedZone, profile, scenario, false),  [selectedZone, selectedProfile, scenario]);
  const explanation = useMemo(() => computeExplanation(before, after, profile, selectedZone, scenario), [before, after]);

  const changed = before.mode !== after.mode;
  const dayType = (scenario as any).dayType ?? 'weekday';
  const startH  = (scenario as any).startHour ?? 8;
  const freeBusActive = (scenario as any).enableFreeBus && ((dayType === 'friday' && startH >= 17) || dayType === 'saturday');

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-ink-100 flex-shrink-0">
        {[
          { id: 'demo', label: '👤 Démonstration (1 usager)', title: 'Pédagogie politique' },
          { id: 'aggregate', label: '◉ Flux agrégés', title: 'Vue globale' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setMode(t.id as any)}
            className={`flex-1 text-xs py-2 px-3 border-b-2 transition-all ${
              mode === t.id
                ? 'border-red-600 text-red-700 font-semibold bg-red-50'
                : 'border-transparent text-ink-500 hover:text-ink hover:bg-ink-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {mode === 'demo' ? (
          <>
            {/* Sélection zone d'origine */}
            <div>
              <div className="label-sm mb-2">Origine — zone de départ</div>
              <div className="grid grid-cols-2 gap-1">
                {ZONES.map(z => (
                  <button key={z.id}
                    onClick={() => setSelectedZone(z.id)}
                    className={`text-left px-2 py-1.5 rounded-lg border text-xs transition-all ${
                      selectedZone === z.id
                        ? 'border-red-300 bg-red-50 text-red-700 font-semibold'
                        : 'border-ink-200 text-ink hover:border-red-200'
                    }`}
                  >
                    <span className="mr-1">{z.emoji}</span>{z.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sélection profil */}
            <div>
              <div className="label-sm mb-2">Profil de l'usager</div>
              <div className="grid grid-cols-2 gap-1">
                {PROFILES.map(p => (
                  <button key={p.id}
                    onClick={() => setSelectedProfile(p.id)}
                    className={`text-left px-2 py-1.5 rounded-lg border text-xs transition-all ${
                      selectedProfile === p.id
                        ? 'border-red-300 bg-red-50 text-red-700 font-semibold'
                        : 'border-ink-200 text-ink hover:border-red-200'
                    }`}
                  >
                    <span className="mr-1">{p.emoji}</span>{p.label}
                    <div className="text-[9px] text-ink-400 mt-0.5">VOT {p.vot} CHF/h · {p.income}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Destination toujours = Centre-ville */}
            <div className="text-[10px] text-ink-400 bg-ink-50 rounded-lg px-3 py-1.5">
              🏙 Destination : <strong>Centre-ville</strong> (Planta / Scex / voirie)
            </div>

            {/* Résultat AVANT / APRÈS */}
            <div className={`rounded-xl border-2 p-1 ${changed ? 'border-amber-300 bg-amber-50' : 'border-ink-100 bg-white'}`}>
              <div className="grid grid-cols-2 gap-1">
                {/* AVANT */}
                <div className="rounded-lg bg-white border border-ink-100 p-3">
                  <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-2">Situation actuelle</div>
                  <div className={`text-2xl font-bold mb-1 ${before.modeColor}`}>{before.modeIcon}</div>
                  <div className={`text-xs font-semibold ${before.modeColor}`}>{before.mode}</div>
                  <div className="mt-2 space-y-0.5 text-[10px] text-ink-500">
                    <div>Parking: <span className="font-mono font-semibold text-ink">{before.parkPrice.toFixed(2)} CHF</span></div>
                    <div>Coût total: <span className="font-mono font-semibold text-ink">{before.carCost.toFixed(2)} CHF</span></div>
                    {before.tpCost !== null && (
                      <div>TP: <span className="font-mono text-green-700">{before.tpCost.toFixed(2)} CHF</span></div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {[['🚗', before.probs[0]], ['🚌', before.probs[1]]].map(([ic, pr]) => (
                      <span key={ic as string} className="text-[9px] bg-ink-50 rounded px-1 py-0.5">
                        {ic as string} {((pr as number) * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>

                {/* APRÈS */}
                <div className={`rounded-lg border p-3 ${after.modeBg}`}>
                  <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-2">Avec ce scénario</div>
                  <div className={`text-2xl font-bold mb-1 ${after.modeColor}`}>{after.modeIcon}</div>
                  <div className={`text-xs font-semibold ${after.modeColor}`}>{after.mode}</div>
                  <div className="mt-2 space-y-0.5 text-[10px] text-ink-500">
                    <div>Parking: <span className="font-mono font-semibold text-ink">{after.parkPrice.toFixed(2)} CHF</span></div>
                    <div>Coût total: <span className="font-mono font-semibold text-ink">{after.carCost.toFixed(2)} CHF</span></div>
                    {after.tpCost !== null && (
                      <div>TP: <span className={`font-mono font-semibold ${freeBusActive ? 'text-green-600' : 'text-ink'}`}>
                        {freeBusActive ? '0.00 CHF 🎉' : `${after.tpCost.toFixed(2)} CHF`}
                      </span></div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {[['🚗', after.probs[0]], ['🚌', after.probs[1]]].map(([ic, pr]) => (
                      <span key={ic as string} className="text-[9px] bg-white/60 rounded px-1 py-0.5">
                        {ic as string} {((pr as number) * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Badge changement */}
              {changed && (
                <div className="mt-2 mx-1 bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-800 text-center">
                  ⚡ Bascule modale probable : {before.modeIcon} → {after.modeIcon}
                </div>
              )}
            </div>

            {/* Explication */}
            <div className="rounded-xl border border-ink-100 bg-white p-3">
              <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide mb-2">Pourquoi ce changement ?</div>
              <div className="space-y-1.5">
                {explanation.map((l, i) => (
                  <div key={i} className="text-xs text-ink-700 leading-snug">{l}</div>
                ))}
              </div>
            </div>

            {/* Accès TP depuis cette zone */}
            <div className="rounded-xl border border-ink-100 bg-ink-50 p-3">
              <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide mb-2">
                🚌 Offre TP depuis {ZONES.find(z => z.id === selectedZone)?.label}
              </div>
              <div className="text-xs text-ink-600 space-y-1">
                <div>Temps trajet : <span className="font-semibold">{tp.time} min</span></div>
                <div>Fréquence pointe : <span className="font-semibold">toutes les {tp.freq} min</span></div>
                <div>Tarif : <span className={`font-semibold ${freeBusActive ? 'text-green-600 line-through' : 'text-ink'}`}>{tp.fare.toFixed(2)} CHF</span>{freeBusActive && <span className="ml-1 text-green-600 font-semibold">0.00 CHF 🎉</span>}</div>
                <div className="text-ink-400 text-[10px] italic">{tp.note}</div>
              </div>
              <div className="mt-2 text-[9px] text-ink-400">
                Accessibilité TP (0–1) : {tp.access.toFixed(2)} — {tp.access > 0.7 ? '✓ Bonne' : tp.access > 0.4 ? '⚠ Limitée' : '✗ Faible'}
              </div>
              <div className="mt-1 text-[9px] text-ink-300">Source: CarPostal · Lignes urbaines Sion 2025 · GTFS</div>
            </div>
          </>
        ) : (
          <AggregatedFlows zoneResults={zoneResults}/>
        )}
      </div>
    </div>
  );
}
