import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store.ts';
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

export default function ScenarioBuilder() {
  const { scenario, updateScenario, runSimulation, isSimulating } = useApp();
  const navigate = useNavigate();

  const handleSimulate = async () => {
    await runSimulation();
    navigate('/resultats');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="animate-fade-up mb-8">
        <h1 className="section-title">Configurateur de scénario</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Ajustez les paramètres et simulez l'impact sur la mobilité sédunoise.
        </p>
      </div>

      {/* Nom du scénario */}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parking Centre */}
        <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-1">
          <div>
            <h2 className="font-semibold text-ink mb-0.5">Parking Centre & Gare</h2>
            <p className="text-xs text-ink-400">Zones à forte demande, fort levier de report</p>
          </div>

          <SliderField
            label="Tarif pointe"
            value={scenario.centrePeakPriceCHFh}
            min={0}
            max={8}
            step={0.5}
            unit=" CHF/h"
            hint="Lun–Ven 7h–9h et 17h–19h"
            onChange={v => updateScenario({ centrePeakPriceCHFh: v })}
          />

          <SliderField
            label="Tarif creux"
            value={scenario.centreOffpeakPriceCHFh}
            min={0}
            max={5}
            step={0.5}
            unit=" CHF/h"
            hint="Hors pointe + weekends"
            onChange={v => updateScenario({ centreOffpeakPriceCHFh: v })}
          />

          <SliderField
            label="Pente pricing progressif"
            value={scenario.progressiveSlopeFactor}
            min={1}
            max={3}
            step={0.25}
            hint="Facteur de majoration après la 1ère heure. 1x = linéaire."
            formatValue={v => `×${v.toFixed(2)}`}
            onChange={v => updateScenario({ progressiveSlopeFactor: v })}
          />
        </div>

        {/* Parking Périphérie + TP */}
        <div className="card p-6 space-y-6 animate-fade-up animate-fade-up-delay-2">
          <div>
            <h2 className="font-semibold text-ink mb-0.5">Périphérie & Transports Publics</h2>
            <p className="text-xs text-ink-400">Levier P+R et attractivité TP</p>
          </div>

          <SliderField
            label="Parking périphérie — pointe"
            value={scenario.peripheriePeakPriceCHFh}
            min={0}
            max={3}
            step={0.25}
            unit=" CHF/h"
            hint="Zones résidentielles et P+R potentiels"
            onChange={v => updateScenario({ peripheriePeakPriceCHFh: v })}
          />

          <SliderField
            label="Parking périphérie — creux"
            value={scenario.peripherieOffpeakPriceCHFh}
            min={0}
            max={2}
            step={0.25}
            unit=" CHF/h"
            onChange={v => updateScenario({ peripherieOffpeakPriceCHFh: v })}
          />

          <SliderField
            label="Rabais TP hors-pointe"
            value={scenario.tpOffpeakDiscountPct}
            min={0}
            max={50}
            step={5}
            unit="%"
            hint="Réduction sur le titre de transport en dehors des heures de pointe"
            onChange={v => updateScenario({ tpOffpeakDiscountPct: v })}
          />
        </div>

        {/* Mesures complémentaires */}
        <div className="card p-6 space-y-5 animate-fade-up animate-fade-up-delay-3">
          <div>
            <h2 className="font-semibold text-ink mb-0.5">Mesures complémentaires</h2>
            <p className="text-xs text-ink-400">Alternatives à la voiture individuelle</p>
          </div>

          <ToggleField
            label="Covoiturage"
            description="Activation d'une offre de matching covoiturage. Réduit la part voiture pour les personas à horaires flexibles."
            value={scenario.enableCovoiturage}
            onChange={v => updateScenario({ enableCovoiturage: v })}
            badge="Mesure soft"
          />

          <div className="border-t border-ink-100" />

          <ToggleField
            label="Transport à la demande (TAD)"
            description="Rabattement vers arrêts TP. Améliore l'accès pour zones mal desservies."
            value={scenario.enableTAD}
            onChange={v => updateScenario({ enableTAD: v })}
            badge="Rabattement"
          />

          <div className="border-t border-ink-100" />

          <ToggleField
            label="Taxi-bons"
            description="Bons de réduction taxi pour soignants, seniors, horaires atypiques. Mesure d'équité ciblée."
            value={scenario.enableTaxiBons}
            onChange={v => updateScenario({ enableTaxiBons: v })}
            badge="Équité"
          />
        </div>

        {/* Objectif */}
        <div className="card p-6 animate-fade-up animate-fade-up-delay-4">
          <div className="mb-4">
            <h2 className="font-semibold text-ink mb-0.5">Objectif principal</h2>
            <p className="text-xs text-ink-400">Oriente l'interprétation des résultats</p>
          </div>
          <div className="space-y-3">
            {OBJECTIVES.map(obj => (
              <label
                key={obj.value}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  scenario.objective === obj.value
                    ? 'border-accent bg-accent-50'
                    : 'border-ink-100 hover:border-ink-200 hover:bg-ink-50'
                }`}
              >
                <input
                  type="radio"
                  name="objective"
                  value={obj.value}
                  checked={scenario.objective === obj.value}
                  onChange={() => updateScenario({ objective: obj.value as Scenario['objective'] })}
                  className="mt-0.5 accent-accent"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span>{obj.icon}</span>
                    <span className="text-sm font-medium text-ink">{obj.label}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">{obj.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 card p-6 animate-fade-up">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-ink">Prêt à simuler ?</h3>
            <p className="text-xs text-ink-400 mt-0.5">
              Le moteur déterministe calcule coûts, élasticités et mode split pour 8 zones et 12 personas.
            </p>
          </div>
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="btn-primary px-8 py-3 text-base"
          >
            {isSimulating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Simulation en cours...
              </span>
            ) : '▷ Simuler'}
          </button>
        </div>
      </div>
    </div>
  );
}
