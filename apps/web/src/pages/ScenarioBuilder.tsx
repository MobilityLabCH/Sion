/**
 * ScenarioBuilder.tsx  --  Simulateur de tarification · Sion
 *
 * Page de construction de scenario : reference officielle + leviers + synthese
 * Sources : sion.ch PDFs 2024-2025, document zones horodateurs 03.2025
 *
 * Chemin : apps/web/src/pages/ScenarioBuilder.tsx
 */

import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';
import type { Scenario } from '../types';
import { BASELINE_SCENARIO } from '../types';

// ─── Donnees officielles Sion (sources verifiees) ─────────────────────────────

const PARKING_TABLE = [
  {
    name: 'Parking de la Planta',
    type: 'Couvert', zone: 'Centre', places: 552,
    pricePeak: 'CHF 3.00/h', priceOff: 'CHF 3.00/h',
    freeRules: '1h gratuite · gratuit 12h-13h30 · ven.17h-sam.24h · nuits · dim.',
    aboPendulaire: 'CHF 160/mois',
    address: 'Place de la Planta',
    lever: true, editable: true,
    source: 'sion.ch PDF 15.07.2024', confidence: 'Officiel',
  },
  {
    name: 'Parking du Scex',
    type: 'Couvert', zone: 'Centre', places: 449,
    pricePeak: 'CHF 3.00/h', priceOff: 'CHF 3.00/h',
    freeRules: '1h gratuite · gratuit 12h-13h30 · ven.17h-sam.24h · nuits · dim.',
    aboPendulaire: 'CHF 160/mois',
    address: 'Rue du Scex',
    lever: true, editable: true,
    source: 'sion.ch PDF 11.08.2025', confidence: 'Officiel',
  },
  {
    name: 'Parking de la Cible',
    type: 'Couvert', zone: 'Centre', places: 204,
    pricePeak: '~CHF 3.00/h', priceOff: '~CHF 3.00/h',
    freeRules: 'Presume identique Planta/Scex',
    aboPendulaire: 'N/D',
    address: 'Rue de la Porte-Neuve',
    lever: true, editable: true,
    source: 'sion.ch (estime)', confidence: 'Estime',
  },
  {
    name: 'Parking Roches-Brunes',
    type: 'Couvert', zone: 'Pericentre Est', places: 300,
    pricePeak: '~CHF 1.50/h', priceOff: '~CHF 1.50/h',
    freeRules: 'Tarif preferentiel · details a confirmer',
    aboPendulaire: 'N/D',
    address: 'Av. de Tourbillon',
    lever: false, editable: false,
    source: 'scan-park.com · sion.ch', confidence: 'Estime',
  },
  {
    name: 'Parking St-Guerin',
    type: 'Couvert', zone: 'Pericentre', places: 66,
    pricePeak: '~CHF 1.50/h', priceOff: '~CHF 1.50/h',
    freeRules: 'Tarif preferentiel · details a confirmer',
    aboPendulaire: 'N/D',
    address: 'Rue de St-Guerin',
    lever: false, editable: false,
    source: 'sion.ch stationnement', confidence: 'Estime',
  },
  {
    name: 'Parking Gare CFF',
    type: 'Couvert', zone: 'Gare', places: 300,
    pricePeak: '~CHF 2.00/h', priceOff: '~CHF 2.00/h',
    freeRules: 'Tarif CFF (estime)',
    aboPendulaire: 'N/D',
    address: 'Av. de la Gare',
    lever: false, editable: false,
    source: 'CFF / estime', confidence: 'Estime',
  },
  {
    name: 'P+R Potences (Sion-Ouest)',
    type: 'P+R', zone: 'Peripherie Ouest', places: 450,
    pricePeak: 'GRATUIT', priceOff: 'GRATUIT',
    freeRules: 'Gratuit permanence · BS 11 toutes 10 min',
    aboPendulaire: 'N/A',
    address: 'Av. des Echutes',
    lever: true, editable: true,
    source: 'sion.ch · CarPostal 2025', confidence: 'Officiel',
  },
  {
    name: 'P+R Échutes II / Echutes',
    type: 'P+R', zone: 'Peripherie Est', places: 460,
    pricePeak: 'GRATUIT', priceOff: 'GRATUIT',
    freeRules: 'Gratuit permanence · BS 11 toutes 10 min',
    aboPendulaire: 'N/A',
    address: 'Rue des Echutes',
    lever: true, editable: true,
    source: 'sion.ch · CarPostal 2025', confidence: 'Officiel',
  },
  {
    name: 'Parking Hopital / SUVA',
    type: 'Surface', zone: 'Champsec', places: 400,
    pricePeak: 'Prive/Mixte', priceOff: 'Prive/Mixte',
    freeRules: 'Parking visiteurs paye (taux inconnu) + abonnes hopital',
    aboPendulaire: 'N/D',
    address: 'Av. du Grand-Champsec 80-90',
    lever: false, editable: false,
    source: 'hopitalduvalais.ch · estimation', confidence: 'Estime',
  },
  {
    name: 'Zone Industrielle Ronquoz/CERM',
    type: 'Surface', zone: 'Zone Industrielle', places: 1200,
    pricePeak: 'GRATUIT', priceOff: 'GRATUIT',
    freeRules: 'Parking prive employes · pas de levier public direct',
    aboPendulaire: 'N/A',
    address: 'Route de l\'Industrie',
    lever: false, editable: false,
    source: 'Estimation ARE Microrecensement 2015', confidence: 'Estime',
  },
];

// Zones horodateurs (source officielle sion.ch 03.2025)
const HORODATEUR_ZONES = [
  { zone: 'Zone 1', label: 'Hyper-centre', tarif: 'CHF 2.00/h', durMax: '90 min', gratuit: 'dim. + jours feries, 12h-13h30, ven.17h-19h, nuits' },
  { zone: 'Zone 2', label: 'Centre',       tarif: 'CHF 1.50/h', durMax: '5h',     gratuit: 'dim. + jours feries, nuits' },
  { zone: 'Zone 3', label: 'Peripherie',   tarif: 'CHF 1.50/h', durMax: '10h',    gratuit: 'dim. + jours feries, nuits' },
  { zone: 'Zone 4', label: 'Ancien Stand', tarif: 'CHF 1.50/h (30min offertes)', durMax: '5h', gratuit: 'nuits 17h-7h30' },
  { zone: 'Zone 7', label: 'Oscar Bider',  tarif: 'CHF 1.50/h (3h), puis CHF 5/j', durMax: '15 jours', gratuit: 'dim. + 12h-13h30 + nuits' },
  { zone: 'Zone 8', label: 'Blancherie',   tarif: 'CHF 1.50/h (30min offertes)', durMax: '10h', gratuit: 'nuits 19h-7h30' },
];

// Scenarios prédéfinis
const PRESETS: { name: string; emoji: string; desc: string; patch: Partial<Scenario> }[] = [
  {
    name: 'Situation actuelle',
    emoji: '📋',
    desc: 'Baseline Sion 2025 -- Planta/Scex CHF 3/h, 1h gratuite, P+R gratuits',
    patch: {
      centrePeakPriceCHFh:    3.0,
      centreOffpeakPriceCHFh: 3.0,
      peripheriePeakPriceCHFh: 0,
      peripherieOffpeakPriceCHFh: 0,
      progressiveSlopeFactor: 1.0,
      tpOffpeakDiscountPct: 0,
      enableCovoiturage: false, enableTAD: false, enableTaxiBons: false,
      objective: 'reduce-peak-car',
    },
  },
  {
    name: 'Tarification haute',
    emoji: '📈',
    desc: 'CHF 5/h au centre -- incite fortement au report modal',
    patch: {
      centrePeakPriceCHFh: 5.0, centreOffpeakPriceCHFh: 4.0,
      peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0,
      progressiveSlopeFactor: 1.5, tpOffpeakDiscountPct: 20,
      enableCovoiturage: false, enableTAD: false, enableTaxiBons: false,
      objective: 'reduce-peak-car',
    },
  },
  {
    name: 'Gratuite centre',
    emoji: '🆓',
    desc: 'Parking centre gratuit -- maximalise attractivite commerces',
    patch: {
      centrePeakPriceCHFh: 0, centreOffpeakPriceCHFh: 0,
      peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0,
      progressiveSlopeFactor: 1.0, tpOffpeakDiscountPct: 0,
      enableCovoiturage: false, enableTAD: false, enableTaxiBons: false,
      objective: 'attractivity',
    },
  },
  {
    name: 'P+R + TP subventionne',
    emoji: '🚌',
    desc: 'Centre CHF 4/h + P+R gratuit + rabais TP 25% -- favorise alternatives',
    patch: {
      centrePeakPriceCHFh: 4.0, centreOffpeakPriceCHFh: 3.0,
      peripheriePeakPriceCHFh: 0, peripherieOffpeakPriceCHFh: 0,
      progressiveSlopeFactor: 1.2, tpOffpeakDiscountPct: 25,
      enableCovoiturage: true, enableTAD: false, enableTaxiBons: false,
      objective: 'equity-access',
    },
  },
];

// ─── Sous-composant Slider ─────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, baseline, onChange, unit, note }: {
  label: string; value: number; min: number; max: number; step: number;
  baseline: number; onChange: (v: number) => void; unit: string; note?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const bPct = ((baseline - min) / (max - min)) * 100;
  const changed = Math.abs(value - baseline) > 0.01;
  const col = changed ? (value > baseline ? '#dc2626' : '#16a34a') : '#2563eb';

  const fmt = (v: number) => v === 0 ? 'GRATUIT' : (unit === 'CHF' ? 'CHF ' + v.toFixed(1) + '/h' : v.toFixed(0) + unit);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
        <div style={{ textAlign: 'right' as const }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: col }}>{fmt(value)}</span>
          {changed && <div style={{ fontSize: 9, color: '#9ca3af' }}>baseline : {fmt(baseline)}</div>}
        </div>
      </div>
      <div style={{ position: 'relative', height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 4 }}>
        <div style={{ position: 'absolute', left: 0, width: pct + '%', height: '100%', background: col, borderRadius: 3, transition: 'width .15s' }} />
        <div style={{ position: 'absolute', left: 'calc(' + bPct + '% - 1px)', top: -2, width: 3, height: 10, background: '#9ca3af', borderRadius: 1 }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 6 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#d1d5db' }}>
        <span>{fmt(min)}</span>
        {note && <span style={{ color: '#9ca3af', fontStyle: 'italic' as const }}>{note}</span>}
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', border: '1.5px solid', borderColor: value ? '#2563eb' : '#e5e7eb', background: value ? '#eff6ff' : '#fafafa', marginBottom: 8, transition: 'all .15s' }}
    >
      <div style={{ width: 28, height: 16, borderRadius: 8, background: value ? '#2563eb' : '#d1d5db', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'white', transition: 'left .15s' }} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: value ? '#1e40af' : '#374151' }}>{label}</div>
        <div style={{ fontSize: 9, color: '#9ca3af' }}>{desc}</div>
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function ScenarioBuilder() {
  const navigate = useNavigate();
  const { scenario, updateScenario, setScenario, runSimulation, isSimulating } = useApp();

  const base = BASELINE_SCENARIO;
  const changedParams: string[] = [];
  if (scenario.centrePeakPriceCHFh !== base.centrePeakPriceCHFh) changedParams.push('Tarif centre');
  if (scenario.peripheriePeakPriceCHFh !== base.peripheriePeakPriceCHFh) changedParams.push('Tarif P+R');
  if (scenario.progressiveSlopeFactor !== base.progressiveSlopeFactor) changedParams.push('Progressivite');
  if (scenario.tpOffpeakDiscountPct !== base.tpOffpeakDiscountPct) changedParams.push('Rabais TP');
  if (scenario.enableCovoiturage) changedParams.push('Covoiturage');
  if (scenario.enableTAD) changedParams.push('TAD');
  if (scenario.enableTaxiBons) changedParams.push('Taxi-bons');

  const totalCentreCapacity = 552 + 449 + 204;
  const revEstimate = scenario.centrePeakPriceCHFh === 0
    ? 0
    : Math.round(totalCentreCapacity * 4.5 * Math.max(0, 2.5 - 1) * scenario.centrePeakPriceCHFh);

  return (
    <div style={{ fontFamily: "'DM Sans','Inter',sans-serif", background: '#f8fafc', minHeight: '100%', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#111827' }}>
            Constructeur de scenario -- Sion Mobility
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {changedParams.length > 0
              ? 'Modifications : ' + changedParams.join(' · ')
              : 'Situation actuelle (aucune modification)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setScenario({ ...base })}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white', fontSize: 12, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}
          >
            Reinitialiser
          </button>
          <button
            onClick={async () => { await runSimulation(); navigate('/resultats'); }}
            disabled={isSimulating}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: isSimulating ? '#e5e7eb' : '#2563eb', color: 'white', fontSize: 13, fontWeight: 800, cursor: isSimulating ? 'not-allowed' : 'pointer' }}
          >
            {isSimulating ? 'Simulation...' : 'Simuler ce scenario'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 0' }}>

        {/* Scenarios predéfinis */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 10 }}>
            Scenarios predéfinis -- cliquer pour charger
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {PRESETS.map(p => {
              const active = Math.abs((scenario.centrePeakPriceCHFh) - (p.patch.centrePeakPriceCHFh ?? 0)) < 0.01;
              return (
                <button
                  key={p.name}
                  onClick={() => setScenario({ ...base, name: p.name, ...p.patch })}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid', textAlign: 'left' as const, cursor: 'pointer', transition: 'all .15s', borderColor: active ? '#2563eb' : '#e5e7eb', background: active ? '#eff6ff' : 'white' }}
                >
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{p.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: active ? '#1e40af' : '#111827', marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: '#9ca3af', lineHeight: 1.4 }}>{p.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* GAUCHE : Reference + Leviers */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>

            {/* Section leviers */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: '#2563eb' }} />
                Leviers de tarification (actionables par la Ville)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Parking centre */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 12, padding: '4px 8px', background: '#eff6ff', borderRadius: 6, display: 'inline-block' }}>
                    Parking centre-ville (1 424 pl.)
                  </div>
                  <Slider
                    label="Tarif horaire (apres 1h gratuite)"
                    value={scenario.centrePeakPriceCHFh ?? 3.0}
                    min={0} max={8} step={0.5}
                    baseline={base.centrePeakPriceCHFh}
                    onChange={v => updateScenario({ centrePeakPriceCHFh: v, centreOffpeakPriceCHFh: v })}
                    unit="CHF"
                    note="Planta · Scex · Cible"
                  />
                  <Slider
                    label="Progressivite longue duree (>1h)"
                    value={scenario.progressiveSlopeFactor ?? 1.0}
                    min={1.0} max={3.0} step={0.1}
                    baseline={base.progressiveSlopeFactor}
                    onChange={v => updateScenario({ progressiveSlopeFactor: v })}
                    unit="x"
                    note="Majoration apres 2h"
                  />
                  <div style={{ fontSize: 9, color: '#93c5fd', background: '#eff6ff', padding: '5px 8px', borderRadius: 6, lineHeight: 1.5 }}>
                    Gratuites maintenues : 12h-13h30, ven.17h-sam.24h, nuits, dimanches
                  </div>
                </div>

                {/* P+R et TP */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 12, padding: '4px 8px', background: '#f0fdf4', borderRadius: 6, display: 'inline-block' }}>
                    P+R + Transports publics
                  </div>
                  <Slider
                    label="Tarif P+R Potences + Stade (910 pl.)"
                    value={scenario.peripheriePeakPriceCHFh ?? 0}
                    min={0} max={4} step={0.25}
                    baseline={base.peripheriePeakPriceCHFh}
                    onChange={v => updateScenario({ peripheriePeakPriceCHFh: v, peripherieOffpeakPriceCHFh: v })}
                    unit="CHF"
                    note="Baseline = gratuit"
                  />
                  <Slider
                    label="Rabais TP hors-pointe (%)"
                    value={scenario.tpOffpeakDiscountPct ?? 0}
                    min={0} max={50} step={5}
                    baseline={base.tpOffpeakDiscountPct}
                    onChange={v => updateScenario({ tpOffpeakDiscountPct: v })}
                    unit="%"
                    note="Applique hors 7h-9h, 16h-18h"
                  />
                </div>
              </div>

              {/* Mesures complementaires */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 10 }}>
                  Mesures complementaires
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <Toggle
                    label="Covoiturage"
                    desc="Reduction covoitureurs"
                    value={scenario.enableCovoiturage ?? false}
                    onChange={v => updateScenario({ enableCovoiturage: v })}
                  />
                  <Toggle
                    label="TAD Valais"
                    desc="Transport a la demande"
                    value={scenario.enableTAD ?? false}
                    onChange={v => updateScenario({ enableTAD: v })}
                  />
                  <Toggle
                    label="Taxi-bons"
                    desc="Bons pour seniors"
                    value={scenario.enableTaxiBons ?? false}
                    onChange={v => updateScenario({ enableTaxiBons: v })}
                  />
                </div>
              </div>
            </div>

            {/* Tableau des parkings */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                Reference officielle -- Offre de stationnement Sion 2025
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 14 }}>
                Sources : sion.ch stationnement · PDF tarifs 2024-2025 · doc. horodateurs 03.2025
              </div>
              <div style={{ overflowX: 'auto' as const }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Parking', 'Zone', 'Places', 'Tarif pointe', 'Gratuites / notes', 'Source'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left' as const, fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.05em', whiteSpace: 'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PARKING_TABLE.map((p, i) => (
                      <tr key={p.name} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '7px 8px', fontWeight: 700, color: '#111827' }}>
                          {p.name}
                          {p.lever && <span style={{ marginLeft: 5, fontSize: 8, background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>LEVIER</span>}
                        </td>
                        <td style={{ padding: '7px 8px', color: '#6b7280' }}>{p.zone}</td>
                        <td style={{ padding: '7px 8px', fontWeight: 700, color: '#374151', textAlign: 'right' as const }}>{p.places}</td>
                        <td style={{ padding: '7px 8px', color: p.pricePeak === 'GRATUIT' ? '#16a34a' : '#111827', fontWeight: 700 }}>{p.pricePeak}</td>
                        <td style={{ padding: '7px 8px', color: '#9ca3af', maxWidth: 220, overflow: 'hidden' as const }}>{p.freeRules}</td>
                        <td style={{ padding: '7px 8px' }}>
                          <span style={{ fontSize: 9, background: p.confidence === 'Officiel' ? '#f0fdf4' : '#fffbeb', color: p.confidence === 'Officiel' ? '#15803d' : '#92400e', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {p.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 8px', fontWeight: 800, color: '#111827' }}>TOTAL PUBLIC</td>
                      <td />
                      <td style={{ padding: '7px 8px', fontWeight: 900, color: '#2563eb', textAlign: 'right' as const }}>
                        {PARKING_TABLE.filter(p => p.type !== 'Surface' || p.name.includes('P+R')).reduce((s, p) => s + p.places, 0).toLocaleString('fr-CH')}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Zones horodateurs */}
              <div style={{ marginTop: 18, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 10 }}>
                  Zones horodateurs (voirie) -- Source sion.ch 03.2025
                </div>
                <div style={{ overflowX: 'auto' as const }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {['Zone', 'Localisation', 'Tarif', 'Duree max', 'Periodes gratuites'].map(h => (
                          <th key={h} style={{ padding: '5px 8px', textAlign: 'left' as const, fontSize: 8, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HORODATEUR_ZONES.map((z, i) => (
                        <tr key={z.zone} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '5px 8px', fontWeight: 700, color: '#2563eb' }}>{z.zone}</td>
                          <td style={{ padding: '5px 8px', color: '#374151' }}>{z.label}</td>
                          <td style={{ padding: '5px 8px', fontWeight: 700, color: '#111827' }}>{z.tarif}</td>
                          <td style={{ padding: '5px 8px', color: '#6b7280' }}>{z.durMax}</td>
                          <td style={{ padding: '5px 8px', color: '#9ca3af', fontSize: 9 }}>{z.gratuit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* DROITE : Synthese scenario */}
          <div>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', position: 'sticky', top: 76 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 16 }}>
                Synthese du scenario
              </div>

              {/* Nom */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 5 }}>Nom du scenario</div>
                <input
                  value={scenario.name ?? ''}
                  onChange={e => updateScenario({ name: e.target.value })}
                  placeholder="Ex: Tarification pointe 2026"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12, border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', outline: 'none', boxSizing: 'border-box' as const }}
                />
              </div>

              {/* Objectif */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 8 }}>Objectif politique prioritaire</div>
                {[
                  { v: 'reduce-peak-car',    l: 'Reduire voiture en pointe',    i: '🚗', d: 'Maximiser le report modal en heure de pointe' },
                  { v: 'protect-short-stay', l: 'Proteger commerces / courte duree', i: '🛍', d: 'Favoriser visites courtes, decourager pendulaires' },
                  { v: 'equity-access',      l: 'Equite et accessibilite',       i: '⚖', d: 'Limiter l\'impact sur les faibles revenus' },
                  { v: 'revenue',            l: 'Optimiser les recettes',        i: '💰', d: 'Maximiser les recettes de stationnement' },
                ].map(obj => (
                  <button
                    key={obj.v}
                    onClick={() => updateScenario({ objective: obj.v })}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1.5px solid', marginBottom: 5, cursor: 'pointer', textAlign: 'left' as const, transition: 'all .1s', borderColor: scenario.objective === obj.v ? '#2563eb' : '#e5e7eb', background: scenario.objective === obj.v ? '#eff6ff' : 'white' }}
                  >
                    <span style={{ fontSize: 16 }}>{obj.i}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: scenario.objective === obj.v ? '#1e40af' : '#374151' }}>{obj.l}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>{obj.d}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Apercu chiffre */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 10 }}>
                  Apercu recettes centre (estimation)
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: scenario.centrePeakPriceCHFh === 0 ? '#16a34a' : '#d97706' }}>
                    CHF {revEstimate.toLocaleString('fr-CH')}
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>par jour (1 424 pl. x 4.5 rotations x 1.5h facturable)</div>
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>
                    ~ CHF {(revEstimate * 250).toLocaleString('fr-CH')} / an (250 jours ouvrables)
                  </div>
                </div>
                <div style={{ fontSize: 9, color: '#fbbf24', background: '#fffbeb', padding: '5px 8px', borderRadius: 6, border: '1px solid #fde68a' }}>
                  Estimation simplifiee, ne tient pas compte des gratuites et abonnements
                </div>
              </div>

              {/* Recap modifications */}
              {changedParams.length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 8 }}>
                    Modifications vs baseline
                  </div>
                  {[
                    { label: 'Centre', base: base.centrePeakPriceCHFh + ' CHF/h', now: scenario.centrePeakPriceCHFh === 0 ? 'GRATUIT' : scenario.centrePeakPriceCHFh + ' CHF/h', changed: scenario.centrePeakPriceCHFh !== base.centrePeakPriceCHFh },
                    { label: 'P+R', base: base.peripheriePeakPriceCHFh === 0 ? 'GRATUIT' : base.peripheriePeakPriceCHFh + ' CHF/h', now: scenario.peripheriePeakPriceCHFh === 0 ? 'GRATUIT' : scenario.peripheriePeakPriceCHFh + ' CHF/h', changed: scenario.peripheriePeakPriceCHFh !== base.peripheriePeakPriceCHFh },
                    { label: 'Progressivite', base: base.progressiveSlopeFactor + 'x', now: scenario.progressiveSlopeFactor + 'x', changed: scenario.progressiveSlopeFactor !== base.progressiveSlopeFactor },
                    { label: 'Rabais TP', base: base.tpOffpeakDiscountPct + '%', now: (scenario.tpOffpeakDiscountPct ?? 0) + '%', changed: scenario.tpOffpeakDiscountPct !== base.tpOffpeakDiscountPct },
                  ].filter(item => item.changed).map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#374151', marginBottom: 4 }}>
                      <span style={{ color: '#6b7280' }}>{item.label}</span>
                      <span>
                        <span style={{ color: '#9ca3af', textDecoration: 'line-through', marginRight: 6 }}>{item.base}</span>
                        <strong style={{ color: '#111827' }}>{item.now}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={async () => { await runSimulation(); navigate('/resultats'); }}
                disabled={isSimulating}
                style={{ width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 10, border: 'none', background: isSimulating ? '#e5e7eb' : '#2563eb', color: 'white', fontSize: 14, fontWeight: 900, cursor: isSimulating ? 'not-allowed' : 'pointer' }}
              >
                {isSimulating ? 'Simulation en cours...' : 'Simuler ce scenario'}
              </button>

              <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center' as const, marginTop: 8, lineHeight: 1.5 }}>
                Modele logit RUM T=1.5 · ARE Microrecensement 2015 · Calibration terrain recommandee
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
