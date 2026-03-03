import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';
import SliderField from '../components/SliderField.tsx';
import ToggleField from '../components/ToggleField.tsx';
import type { Scenario } from '../types.ts';

const OBJECTIVES = [
  {
    value: 'reduce-peak-car',
    label: 'Réduire la voiture en pointe',
    icon: '🚗',
    description: 'Maximiser le report modal voiture → TP et alternatives en heure de pointe',
  },
  {
    value: 'protect-short-stay',
    label: 'Protéger la courte durée / commerces',
    icon: '🛍',
    description: 'Tarification favorable aux visites courtes; décourage le stationnement longue durée pendulaire',
  },
  {
    value: 'equity-access',
    label: 'Équité & accessibilité',
    icon: '⚖️',
    description: 'Minimiser l\'impact sur les personas à revenus modestes et dépendants de la voiture',
  },
] as const;

// ─── Données de référence officielles ─────────────────────────────────────
// Sources: sion.ch PDFs Planta (15.07.2024) + Scex (11.08.2025)
//          CarPostal horaires 2025 · isireso-sion.ch · bus-sedunois.ch

const REFERENCE = {
  parking: [
    {
      name: 'Planta (562 pl.) + Scex (658 pl.)',
      zone: 'Centre',
      price: '1h gratuite · puis CHF 3.00/h',
      detail: 'CHF 0.20/h après 11h · gratuit ven.17h–sam.24h',
      source: 'sion.ch PDFs 2024-2025',
      confidence: '✓ officiel',
    },
    {
      name: 'Parking de la Cible',
      zone: 'Centre',
      price: '~CHF 3.00/h',
      detail: '204 places · tarif estimé identique Planta/Scex',
      source: 'sion.ch (estimé)',
      confidence: '⚠ estimé',
    },
    {
      name: 'Nord (282 pl.) · Roches-Brunes (300 pl.) · St-Guérin (66 pl.)',
      zone: 'Périphérie centre',
      price: '~CHF 1.50/h',
      detail: 'Tarif préférentiel visible sur carte sion.ch',
      source: 'sion.ch carte mobilité',
      confidence: '⚠ estimé',
    },
    {
      name: 'P+R Potences (Sion-Ouest)',
      zone: 'Périphérie',
      price: 'GRATUIT',
      detail: '450 places · BS 11 → centre · toutes les 10 min',
      source: 'sion.ch / CarPostal officiel',
      confidence: '✓ officiel',
    },
    {
      name: 'P+R Stade / Échutes (Sion-Est)',
      zone: 'Périphérie',
      price: 'GRATUIT',
      detail: '460 places · BS 11 → centre · toutes les 10 min',
      source: 'sion.ch / CarPostal officiel',
      confidence: '✓ officiel',
    },
  ],
  tp: [
    {
      name: 'Bus Sédunois BS 11-14 (urbain)',
      freq: '10 min pointe · 20 min creux',
      price: 'CHF 2.20 (zone 1)',
      detail: 'Gratuit ven.17h–sam.24h · 100% électrique',
      source: 'bus-sedunois.ch 2025',
    },
    {
      name: 'Châteauneuf-Conthey ↔ Sion',
      freq: '30 min (train) · 20 min (bus 331)',
      price: 'CHF 3.20 (zone 2)',
      detail: 'RegionAlps 8 min · isireso zone 2 depuis déc.2023',
      source: 'RegionAlps / isireso 2025',
    },
    {
      name: 'Savièse / Grimisuat ↔ Sion',
      freq: '30 min pointe · 60 min creux',
      price: 'CHF 4.20 (zone 3)',
      detail: 'Bus 341/342/386 · 22-30 min',
      source: 'CarPostal 2025',
    },
    {
      name: 'Nendaz / Anzère ↔ Sion',
      freq: '30-60 min',
      price: 'CHF 5.20 (zone 4)',
      detail: 'Bus 361/362/351 · 35-45 min',
      source: 'CarPostal 2025',
    },
    {
      name: 'TAD Valais (taxibus)',
      freq: 'Sur réservation',
      price: 'CHF 2.50 base + 0.35/km',
      detail: 'Zones mal desservies · à la demande',
      source: 'CarPostal / Valais 2025',
    },
  ],
};

// ─── Scénarios prédéfinis ──────────────────────────────────────────────────
// NB: baseline = situation actuelle Sion (CHF 3.00/h après 1h gratuite)

const PRESETS = [
  {
    name: 'Situation actuelle Sion',
    description: 'Tarif Planta/Scex officiel (1h gratuite + CHF 3/h)',
    icon: '📍',
    values: {
      centrePeakPriceCHFh: 3.0, centreOffpeakPriceCHFh: 3.0,
      peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0,
      tpOffpeakDiscountPct: 0, progressiveSlopeFactor: 1.0,
    },
  },
  {
    name: 'Différenciation pointe/creux',
    description: 'Hausse en pointe +33% · remise creux · rabais TP',
    icon: '📈',
    values: {
      centrePeakPriceCHFh: 4.0, centreOffpeakPriceCHFh: 2.0,
      peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0,
      tpOffpeakDiscountPct: 20, progressiveSlopeFactor: 1.2,
    },
  },
  {
    name: 'Tarification dynamique forte',
    description: 'Différentiel pointe/creux maximal + alternatives',
    icon: '⚡',
    values: {
      centrePeakPriceCHFh: 5.0, centreOffpeakPriceCHFh: 1.5,
      peripheriePeakPriceCHFh: 0.5, peripherieOffpeakPriceCHFh: 0,
      tpOffpeakDiscountPct: 35, progressiveSlopeFactor: 1.5,
    },
  },
  {
    name: 'Équité maximale',
    description: 'Hausse limitée + mesures compensatoires activées',
    icon: '⚖️',
    values: {
      centrePeakPriceCHFh: 3.5, centreOffpeakPriceCHFh: 2.5,
      peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0,
      tpOffpeakDiscountPct: 30, progressiveSlopeFactor: 1.1,
    },
  },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ScenarioBuilder() {
  const { scenario, updateScenario, runSimulation, isSimulating } = useApp();
  const navigate = useNavigate();

  const handleSimulate = async () => {
    await runSimulation();
    navigate('/resultats');
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    updateScenario({ ...preset.values, name: preset.name });
  };

  // Δ vs baseline actuel
  const deltacentrePeak = scenario.centrePeakPriceCHFh - 3.0;
  const ratePeakOffpeak = scenario.centrePeakPriceCHFh / Math.max(0.1, scenario.centreOffpeakPriceCHFh);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="animate-fade-up mb-8">
        <h1 className="section-title">Configurateur de scénario</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Simulez l'impact sur la mobilité sédunoise.
          Baseline = situation actuelle Sion (1h gratuite · CHF 3.00/h · P+R gratuits).
        </p>
      </div>

      {/* Presets */}
      <div className="mb-6 animate-fade-up animate-fade-up-delay-1">
        <div className="label-sm mb-3">Scénarios prédéfinis</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className={`text-left p-3 rounded-xl border transition-all ${
                scenario.name === preset.name
                  ? 'border-accent bg-accent-50'
                  : 'border-ink-200 bg-white hover:border-accent-300 hover:bg-accent-50'
              }`}
            >
              <div className="text-lg mb-1">{preset.icon}</div>
              <div className={`text-xs font-semibold ${scenario.name === preset.name ? 'text-accent' : 'text-ink'}`}>
                {preset.name}
              </div>
              <div className="text-xs text-ink-400 mt-0.5 leading-tight">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario name */}
      <div className="card p-6 mb-6 animate-fade-up animate-fade-up-delay-1">
        <label className="label-sm mb-2 block">Nom du scénario</label>
        <input
          type="text"
          value={scenario.name || ''}
          onChange={e => updateScenario({ name: e.target.value })}
          placeholder="Ex: Hausse modérée centre + TAD"
          className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Parameters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Parking Centre */}
            <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-1">
              <div>
                <h2 className="font-semibold text-ink text-sm">🏙 Parking centre-ville</h2>
                <p className="text-xs text-ink-400 mt-0.5">Planta (562 pl.) · Scex (658 pl.) · Cible (204 pl.)</p>
                <div className="mt-2 text-xs bg-green-50 rounded-lg px-3 py-2 text-green-800 border border-green-200">
                  <span className="font-semibold">Actuel :</span> 1h gratuite · CHF 3.00/h · gratuit ven.17h–sam.24h
                </div>
              </div>
              <SliderField
                label="Taux horaire — pointe (7h–9h, 16h–18h)"
                value={scenario.centrePeakPriceCHFh}
                min={0} max={8} step={0.5}
                unit=" CHF/h"
                onChange={v => updateScenario({ centrePeakPriceCHFh: v })}
                referenceValue={3.0}
                referenceLabel="actuel"
              />
              <SliderField
                label="Taux horaire — heures creuses"
                value={scenario.centreOffpeakPriceCHFh}
                min={0} max={6} step={0.5}
                unit=" CHF/h"
                onChange={v => updateScenario({ centreOffpeakPriceCHFh: v })}
                referenceValue={3.0}
                referenceLabel="actuel (pas de distinction)"
              />
            </div>

            {/* Parking Périphérie */}
            <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-1">
              <div>
                <h2 className="font-semibold text-ink text-sm">🅿 P+R et périphérie</h2>
                <p className="text-xs text-ink-400 mt-0.5">Potences (450 pl.) · Stade/Échutes (460 pl.)</p>
                <div className="mt-2 text-xs bg-green-50 rounded-lg px-3 py-2 text-green-800 border border-green-200">
                  <span className="font-semibold">Actuel :</span> GRATUIT · BS 11 toutes les 10 min (pointe)
                </div>
              </div>
              <SliderField
                label="Tarif P+R — pointe"
                value={scenario.peripheriePeakPriceCHFh}
                min={0} max={3} step={0.25}
                unit=" CHF/h"
                onChange={v => updateScenario({ peripheriePeakPriceCHFh: v })}
                referenceValue={0}
                referenceLabel="gratuit"
              />
              <SliderField
                label="Tarif P+R — heures creuses"
                value={scenario.peripherieOffpeakPriceCHFh}
                min={0} max={2} step={0.25}
                unit=" CHF/h"
                onChange={v => updateScenario({ peripherieOffpeakPriceCHFh: v })}
                referenceValue={0}
                referenceLabel="gratuit"
              />
            </div>

            {/* TP */}
            <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-2">
              <div>
                <h2 className="font-semibold text-ink text-sm">🚌 Transports publics</h2>
                <p className="text-xs text-ink-400 mt-0.5">Bus Sédunois · CarPostal · RegionAlps</p>
                <div className="mt-2 text-xs bg-ink-50 rounded-lg px-3 py-2 text-ink-600">
                  Zone 1: CHF 2.20 · Zone 2: CHF 3.20 · Zone 3: CHF 4.20 · Zone 4: CHF 5.20
                </div>
              </div>
              <SliderField
                label="Rabais heure creuse TP"
                value={scenario.tpOffpeakDiscountPct}
                min={0} max={50} step={5}
                unit="%"
                onChange={v => updateScenario({ tpOffpeakDiscountPct: v })}
                referenceValue={0}
                referenceLabel="actuel (0%)"
              />
            </div>

            {/* Progressive pricing */}
            <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-2">
              <div>
                <h2 className="font-semibold text-ink text-sm">📈 Progressivité longue durée</h2>
                <p className="text-xs text-ink-400 mt-0.5">Majoration supplémentaire au-delà de 1h</p>
                <div className="mt-2 text-xs bg-ink-50 rounded-lg px-3 py-2 text-ink-600">
                  ×1.0 = barème actuel (1h gratuite + CHF 3/h). ×1.5 = pendulaire paie 50% de plus
                </div>
              </div>
              <SliderField
                label="Multiplicateur longue durée (>1h)"
                value={scenario.progressiveSlopeFactor}
                min={1} max={3} step={0.1}
                unit="×"
                onChange={v => updateScenario({ progressiveSlopeFactor: v })}
                referenceValue={1.0}
                referenceLabel="actuel"
              />
            </div>
          </div>

          {/* Mesures complémentaires */}
          <div className="card p-6 animate-fade-up animate-fade-up-delay-3">
            <h2 className="font-semibold text-ink text-sm mb-1">🛠 Mesures complémentaires</h2>
            <p className="text-xs text-ink-400 mb-4">Activer des alternatives à la voiture individuelle</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ToggleField
                label="Covoiturage"
                description="Stimuler l'offre de covoiturage Sion-Région"
                value={scenario.enableCovoiturage}
                onChange={v => updateScenario({ enableCovoiturage: v })}
                icon="🚗"
              />
              <ToggleField
                label="TAD Valais"
                description="Taxibus inter-zones · CHF 2.50 + 0.35/km"
                value={scenario.enableTAD}
                onChange={v => updateScenario({ enableTAD: v })}
                icon="🚕"
              />
              <ToggleField
                label="Taxibons"
                description="Subvention taxi (CHF 8.—/bon) · seniors, mobilité réduite"
                value={scenario.enableTaxiBons}
                onChange={v => updateScenario({ enableTaxiBons: v })}
                icon="🎫"
              />
            </div>
          </div>

          {/* Objectif */}
          <div className="card p-6 animate-fade-up animate-fade-up-delay-3">
            <h2 className="font-semibold text-ink text-sm mb-1">🎯 Objectif principal</h2>
            <p className="text-xs text-ink-400 mb-4">Oriente l'interprétation des résultats et les recommandations IA</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {OBJECTIVES.map(obj => (
                <button
                  key={obj.value}
                  onClick={() => updateScenario({ objective: obj.value as Scenario['objective'] })}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    scenario.objective === obj.value
                      ? 'border-accent bg-accent-50'
                      : 'border-ink-200 hover:border-accent-300 hover:bg-accent-50'
                  }`}
                >
                  <div className="text-xl mb-2">{obj.icon}</div>
                  <div className={`text-xs font-semibold ${scenario.objective === obj.value ? 'text-accent' : 'text-ink'}`}>
                    {obj.label}
                  </div>
                  <div className="text-xs text-ink-400 mt-1 leading-tight">{obj.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Summary + Reference data */}
        <div className="space-y-4 animate-fade-up animate-fade-up-delay-2">

          {/* Scenario summary */}
          <div className="card p-5">
            <div className="label-sm mb-3">Résumé du scénario</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-500">Centre pointe</span>
                <span className={`font-semibold font-mono ${
                  deltacentrePeak > 0 ? 'text-red-600' : deltacentrePeak < 0 ? 'text-green-600' : 'text-ink'
                }`}>
                  {scenario.centrePeakPriceCHFh.toFixed(2)} CHF/h
                  {deltacentrePeak !== 0 && (
                    <span className="ml-1 text-xs">({deltacentrePeak > 0 ? '+' : ''}{deltacentrePeak.toFixed(2)})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Centre creux</span>
                <span className="font-semibold font-mono text-ink">{scenario.centreOffpeakPriceCHFh.toFixed(2)} CHF/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Différentiel pointe/creux</span>
                <span className={`font-semibold font-mono ${ratePeakOffpeak > 1.2 ? 'text-green-600' : 'text-ink-400'}`}>
                  ×{ratePeakOffpeak.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">P+R pointe</span>
                <span className={`font-semibold font-mono ${scenario.peripheriePeakPriceCHFh > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {scenario.peripheriePeakPriceCHFh === 0 ? 'GRATUIT' : `${scenario.peripheriePeakPriceCHFh.toFixed(2)} CHF/h`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Rabais TP creux</span>
                <span className={`font-semibold font-mono ${scenario.tpOffpeakDiscountPct > 0 ? 'text-green-600' : 'text-ink-400'}`}>
                  {scenario.tpOffpeakDiscountPct}%
                </span>
              </div>
              {scenario.progressiveSlopeFactor > 1.0 && (
                <div className="flex justify-between">
                  <span className="text-ink-500">Progressivité</span>
                  <span className="font-semibold font-mono text-orange-600">×{scenario.progressiveSlopeFactor.toFixed(1)}</span>
                </div>
              )}
              {/* Example cost for a 3.5h pendulaire */}
              <div className="mt-3 pt-3 border-t border-ink-100">
                <div className="text-ink-400 mb-1">Coût exemple — pendulaire 3.5h centre :</div>
                <div className="font-semibold text-ink">
                  CHF {Math.max(0, (3.5 - 1) * scenario.centrePeakPriceCHFh * Math.max(1, scenario.progressiveSlopeFactor)).toFixed(2)}
                  <span className="text-xs font-normal text-ink-400 ml-1">(1h gratuite incluse)</span>
                </div>
                <div className="text-xs text-ink-400 mt-0.5">
                  Actuel : CHF 7.50 · P+R + BS11 : CHF 4.20 (zone 3)
                </div>
              </div>
              <div className="flex gap-1 flex-wrap mt-1">
                {scenario.enableCovoiturage && <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs">covoiturage</span>}
                {scenario.enableTAD         && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs">TAD</span>}
                {scenario.enableTaxiBons    && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs">taxibons</span>}
              </div>
            </div>
          </div>

          {/* Reference parking */}
          <div className="card p-5">
            <div className="label-sm mb-3">📍 Tarifs parkings Sion (officiels)</div>
            <div className="space-y-3">
              {REFERENCE.parking.map(p => (
                <div key={p.name} className="text-xs">
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-ink font-medium leading-tight">{p.name}</span>
                    <span className={`font-semibold flex-shrink-0 ml-2 ${p.price === 'GRATUIT' ? 'text-green-600' : 'text-ink'}`}>
                      {p.price}
                    </span>
                  </div>
                  <div className="text-ink-400 mt-0.5">{p.detail}</div>
                  <div className={`mt-0.5 text-xs ${p.confidence.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>
                    {p.confidence} · {p.source}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reference TP */}
          <div className="card p-5">
            <div className="label-sm mb-3">🚌 TP Sion (isireso 2025)</div>
            <div className="space-y-3">
              {REFERENCE.tp.map(t => (
                <div key={t.name} className="text-xs">
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-medium text-ink leading-tight">{t.name}</span>
                    <span className="font-mono text-ink flex-shrink-0 ml-2">{t.price}</span>
                  </div>
                  <div className="text-ink-400">{t.freq}</div>
                  <div className="text-ink-300 mt-0.5 italic">{t.detail}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-ink-300">Source : isireso-sion.ch · CarPostal · sion.ch/mobilite</div>
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="mt-8 flex items-center justify-between animate-fade-up animate-fade-up-delay-4">
        <div className="text-xs text-ink-400">
          Simulation sur 8 zones · 12 personas · moteur déterministe
          <span className="ml-2 text-ink-300">· baseline = situation actuelle Sion</span>
        </div>
        <button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSimulating ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Simulation en cours…
            </>
          ) : (
            <>▷ Lancer la simulation</>
          )}
        </button>
      </div>
    </div>
  );
}
