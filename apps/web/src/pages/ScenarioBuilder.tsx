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
    description: 'Tarification favorable aux visites courtes; décourage le stationnement longue durée',
  },
  {
    value: 'equity-access',
    label: 'Équité & accessibilité',
    icon: '⚖️',
    description: 'Minimiser l\'impact sur les personas à revenus modestes et dépendants de la voiture',
  },
] as const;

// Reference data: current real tariffs in Sion (2024-2025)
// Source: sion.ch/stationnement, CFF SBB, CarPostal Valais
const REFERENCE = {
  parking: [
    { name: 'P. Platta (couvert)', zone: 'centre', price: '2.50 CHF/h', cap: '~450 places' },
    { name: 'P. du Midi (couvert)', zone: 'centre', price: '2.00 CHF/h', cap: '~300 places' },
    { name: 'P. Gare CFF (couvert)', zone: 'gare', price: '2.00 CHF/h', cap: '~120 places' },
    { name: 'P. Supersaxo (centre)', zone: 'centre', price: '2.50 CHF/h', cap: '~100 places' },
    { name: 'Voirie centre-ville', zone: 'centre', price: '1.00–2.00 CHF/h', cap: 'zones bleues' },
    { name: 'Park+Ride périphérie', zone: 'périphérie', price: '0–0.50 CHF/j', cap: '>1500 places' },
  ],
  tp: [
    { name: 'Bus urbain Sion (lignes 1-9)', freq: '10–15 min pointe', price: '3.20 CHF/trajet' },
    { name: 'CarPostal régional', freq: '30–60 min', price: '3.80–6.50 CHF' },
    { name: 'CFF Sion ↔ Sierre/Martigny', freq: '15–30 min', price: '3.40–4.60 CHF' },
    { name: 'TAD Valais (taxibus)', freq: 'Sur réservation', price: '2.50 + 0.35/km' },
  ],
};

// Preset scenarios for quick start
const PRESETS = [
  {
    name: 'Scénario de base Sion',
    description: 'Proche des tarifs actuels (2024)',
    icon: '📍',
    values: { centrePeakPriceCHFh: 2.5, centreOffpeakPriceCHFh: 1.5, peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0, tpOffpeakDiscountPct: 0, progressiveSlopeFactor: 1.0 },
  },
  {
    name: 'Hausse modérée centre',
    description: '+40% en pointe, rabais TP creux',
    icon: '📈',
    values: { centrePeakPriceCHFh: 3.5, centreOffpeakPriceCHFh: 1.5, peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0, tpOffpeakDiscountPct: 20, progressiveSlopeFactor: 1.2 },
  },
  {
    name: 'Tarification dynamique forte',
    description: 'Différentiel pointe/creux maximal',
    icon: '⚡',
    values: { centrePeakPriceCHFh: 4.5, centreOffpeakPriceCHFh: 1.0, peripheriePeakPriceCHFh: 0.5, peripherieOffpeakPriceCHFh: 0, tpOffpeakDiscountPct: 35, progressiveSlopeFactor: 1.5 },
  },
  {
    name: 'Équité maximale',
    description: 'Hausses limitées + mesures compensatoires',
    icon: '⚖️',
    values: { centrePeakPriceCHFh: 3.0, centreOffpeakPriceCHFh: 2.0, peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0, tpOffpeakDiscountPct: 30, progressiveSlopeFactor: 1.1 },
  },
];

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="animate-fade-up mb-8">
        <h1 className="section-title">Configurateur de scénario</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Ajustez les paramètres et simulez l'impact sur la mobilité sédunoise.
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
                <p className="text-xs text-ink-400 mt-0.5">Platta, Midi, Supersaxo, voirie</p>
                <div className="mt-2 text-xs bg-ink-50 rounded-lg px-3 py-2 text-ink-500">
                  Tarifs actuels: <span className="font-medium text-ink">1.00–2.50 CHF/h</span>
                </div>
              </div>
              <SliderField
                label="Heure de pointe (7h–9h, 16h–18h)"
                value={scenario.centrePeakPriceCHFh}
                min={0} max={6} step={0.5}
                unit=" CHF/h"
                onChange={v => updateScenario({ centrePeakPriceCHFh: v })}
                referenceValue={2.5}
                referenceLabel="actuel"
              />
              <SliderField
                label="Heure creuse"
                value={scenario.centreOffpeakPriceCHFh}
                min={0} max={4} step={0.5}
                unit=" CHF/h"
                onChange={v => updateScenario({ centreOffpeakPriceCHFh: v })}
                referenceValue={1.5}
                referenceLabel="actuel"
              />
            </div>

            {/* Parking Périphérie */}
            <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-1">
              <div>
                <h2 className="font-semibold text-ink text-sm">🅿 Parking périphérie / gare</h2>
                <p className="text-xs text-ink-400 mt-0.5">P+R, parkings de zone, gare CFF</p>
                <div className="mt-2 text-xs bg-ink-50 rounded-lg px-3 py-2 text-ink-500">
                  Tarifs actuels P+R: <span className="font-medium text-ink">0–0.50 CHF/j</span>
                </div>
              </div>
              <SliderField
                label="Heure de pointe"
                value={scenario.peripheriePeakPriceCHFh}
                min={0} max={3} step={0.25}
                unit=" CHF/h"
                onChange={v => updateScenario({ peripheriePeakPriceCHFh: v })}
                referenceValue={0}
                referenceLabel="gratuit"
              />
              <SliderField
                label="Heure creuse"
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
                <p className="text-xs text-ink-400 mt-0.5">Bus CarPostal, lignes urbaines Sion</p>
                <div className="mt-2 text-xs bg-ink-50 rounded-lg px-3 py-2 text-ink-500">
                  Tarif actuel: <span className="font-medium text-ink">3.20 CHF/trajet</span>
                </div>
              </div>
              <SliderField
                label="Rabais heure creuse TP"
                value={scenario.tpOffpeakDiscountPct}
                min={0} max={50} step={5}
                unit="%"
                onChange={v => updateScenario({ tpOffpeakDiscountPct: v })}
                referenceValue={0}
                referenceLabel="actuel"
              />
            </div>

            {/* Progressive pricing */}
            <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-2">
              <div>
                <h2 className="font-semibold text-ink text-sm">📈 Tarification progressive</h2>
                <p className="text-xs text-ink-400 mt-0.5">Majoration longue durée</p>
                <div className="mt-2 text-xs bg-ink-50 rounded-lg px-3 py-2 text-ink-500">
                  Actuellement: <span className="font-medium text-ink">tarif linéaire</span>
                </div>
              </div>
              <SliderField
                label="Multiplicateur longue durée (>1h)"
                value={scenario.progressiveSlopeFactor}
                min={1} max={3} step={0.1}
                unit="×"
                onChange={v => updateScenario({ progressiveSlopeFactor: v })}
                referenceValue={1}
                referenceLabel="linéaire"
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
                description="Transport à la demande (taxibus) inter-zones"
                value={scenario.enableTAD}
                onChange={v => updateScenario({ enableTAD: v })}
                icon="🚕"
              />
              <ToggleField
                label="Taxibons"
                description="Subventions taxi pour personnes à mobilité réduite"
                value={scenario.enableTaxiBons}
                onChange={v => updateScenario({ enableTaxiBons: v })}
                icon="🎫"
              />
            </div>
          </div>

          {/* Objectif */}
          <div className="card p-6 animate-fade-up animate-fade-up-delay-3">
            <h2 className="font-semibold text-ink text-sm mb-1">🎯 Objectif principal</h2>
            <p className="text-xs text-ink-400 mb-4">L'objectif oriente l'interprétation des résultats</p>
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

        {/* Right: Reference data */}
        <div className="space-y-4 animate-fade-up animate-fade-up-delay-2">
          {/* Scenario summary */}
          <div className="card p-5">
            <div className="label-sm mb-3">Résumé du scénario</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-500">Centre pointe</span>
                <span className={`font-semibold font-mono ${scenario.centrePeakPriceCHFh > 2.5 ? 'text-accent' : 'text-ink'}`}>
                  {scenario.centrePeakPriceCHFh.toFixed(2)} CHF/h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Centre creux</span>
                <span className="font-semibold font-mono text-ink">{scenario.centreOffpeakPriceCHFh.toFixed(2)} CHF/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Différentiel</span>
                <span className={`font-semibold font-mono ${scenario.centrePeakPriceCHFh > scenario.centreOffpeakPriceCHFh ? 'text-green-600' : 'text-ink-400'}`}>
                  ×{(scenario.centrePeakPriceCHFh / Math.max(0.1, scenario.centreOffpeakPriceCHFh)).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Périphérie pointe</span>
                <span className="font-semibold font-mono text-ink">{scenario.peripheriePeakPriceCHFh.toFixed(2)} CHF/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Rabais TP creux</span>
                <span className={`font-semibold font-mono ${scenario.tpOffpeakDiscountPct > 0 ? 'text-green-600' : 'text-ink-400'}`}>
                  {scenario.tpOffpeakDiscountPct}%
                </span>
              </div>
              {scenario.progressiveSlopeFactor > 1 && (
                <div className="flex justify-between">
                  <span className="text-ink-500">Progressivité</span>
                  <span className="font-semibold font-mono text-orange-600">×{scenario.progressiveSlopeFactor.toFixed(1)}</span>
                </div>
              )}
              <div className="flex gap-1 flex-wrap mt-1">
                {scenario.enableCovoiturage && <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">covoiturage</span>}
                {scenario.enableTAD && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">TAD</span>}
                {scenario.enableTaxiBons && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">taxibons</span>}
              </div>
            </div>
          </div>

          {/* Reference parking */}
          <div className="card p-5">
            <div className="label-sm mb-3">📍 Tarifs parkings Sion (2024)</div>
            <div className="space-y-2">
              {REFERENCE.parking.map(p => (
                <div key={p.name} className="text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-ink font-medium">{p.name}</span>
                    <span className="font-mono font-semibold text-ink ml-2 flex-shrink-0">{p.price}</span>
                  </div>
                  <div className="text-ink-400">{p.cap}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-ink-300 italic">Source: sion.ch · CFF SBB</div>
          </div>

          {/* Reference TP */}
          <div className="card p-5">
            <div className="label-sm mb-3">🚌 Offre TP Sion (2024)</div>
            <div className="space-y-2">
              {REFERENCE.tp.map(t => (
                <div key={t.name} className="text-xs">
                  <div className="font-medium text-ink">{t.name}</div>
                  <div className="flex justify-between text-ink-400">
                    <span>{t.freq}</span>
                    <span className="font-mono text-ink ml-2">{t.price}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-ink-300 italic">Source: CarPostal · CFF · Ville de Sion</div>
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="mt-8 flex items-center justify-between animate-fade-up animate-fade-up-delay-4">
        <div className="text-xs text-ink-400">
          Simulation sur {8} zones · {12} personas · moteur déterministe
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
            <>
              ▷ Lancer la simulation
            </>
          )}
        </button>
      </div>
    </div>
  );
}
