/**
 * Dashboard.tsx -- Simulateur de tarification parking · Sion
 * VERSION SIMPLIFIEE : un seul levier clair = le prix du parking
 *
 * Chemin : apps/web/src/pages/Dashboard.tsx
 */

import { useApp } from '../hooks/store';
import ZoneMap from '../components/ZoneMap';
import type { Scenario } from '../types';
import { BASELINE_SCENARIO } from '../types';

// ─── Parkings de Sion (source : sion.ch) ─────────────────────────────────────

const PARKINGS_CENTRE = [
  { name: 'Planta',  places: 562,  note: '1h gratuite -- CHF 3/h apres' },
  { name: 'Scex',    places: 658,  note: '1h gratuite -- CHF 3/h apres' },
  { name: 'Cible',   places: 204,  note: 'Tarif estime par analogie' },
];

const PARKINGS_OTHER = [
  { name: 'Gare CFF',         places: 300,  price: '~2.00 CHF/h',   note: 'Tarif estime', lever: false },
  { name: 'Parking Nord',     places: 282,  price: '~1.50 CHF/h',   note: 'Tarif preferentiel estime', lever: false },
  { name: 'Roches-Brunes',    places: 300,  price: '~1.50 CHF/h',   note: 'Tarif preferentiel estime', lever: false },
  { name: 'P+R Potences',     places: 450,  price: 'GRATUIT',        note: 'BS 11 -> centre 10 min', lever: false },
  { name: 'P+R Stade',        places: 460,  price: 'GRATUIT',        note: 'BS 11 -> centre 10 min', lever: false },
  { name: 'Zone Industrielle', places: 1200, price: 'GRATUIT',       note: 'Prive employes -- pas de levier direct', lever: false },
];

// ─── Composant slider ─────────────────────────────────────────────────────────

function PriceSlider({
  value, onChange, max, baseline,
}: {
  value: number; onChange: (v: number) => void; max: number; baseline: number;
}) {
  const isChanged = value !== baseline;
  const col = isChanged ? (value > baseline ? '#dc2626' : '#16a34a') : '#6b7280';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range" min={0} max={max} step={0.5} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#2563eb', height: 4 }}
      />
      <div style={{ width: 80, textAlign: 'right' }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: col }}>
          {value === 0 ? 'GRATUIT' : 'CHF ' + value.toFixed(1) + '/h'}
        </span>
        {isChanged && (
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
            base : CHF {baseline.toFixed(1)}/h
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    scenario, updateScenario,
    results, baselineResults,
    isSimulating, runSimulation,
    trafficData,
  } = useApp();

  const centrePrix = scenario.centrePeakPriceCHFh ?? 3.0;

  const baseline     = BASELINE_SCENARIO;
  const changed      = centrePrix !== baseline.centrePeakPriceCHFh;

  const baselineCar  = baselineResults?.modeSplit?.car  ?? 62;
  const scenarioCar  = results?.modeSplit?.car ?? baselineCar;
  const deltaModal   = Math.round((scenarioCar - baselineCar) * 10) / 10;

  const hasResults   = results !== null;

  const sev       = trafficData?.severity ?? 'fluide';
  const speed     = trafficData?.currentSpeed ?? 17;
  const sevColor  = sev === 'fluide' ? '#16a34a' : sev === 'modere' ? '#d97706' : sev === 'dense' ? '#ea580c' : '#dc2626';

  const handleCentrePrice = (v: number) => {
    updateScenario({ centrePeakPriceCHFh: v, centreOffpeakPriceCHFh: v });
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: "'DM Sans','Inter',sans-serif", background: '#f8fafc' }}>

      {/* ── GAUCHE : Parkings + levier ──────────────────────────────────────── */}
      <div style={{ width: 300, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Trafic */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: sevColor }}>
            Trafic Sion -- {sev} -- {speed} km/h
          </span>
        </div>

        {/* Titre */}
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Tarification des parkings</div>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
            Le prix des parkings du centre-ville est le principal levier actionnable par la Ville de Sion.
          </div>
        </div>

        {/* Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

          {/* LEVIER PRINCIPAL : Centre-ville */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#eff6ff', borderRadius: 12, border: '1.5px solid #bfdbfe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: '#2563eb', flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '.04em' }}>
                Centre-ville -- LEVIER DIRECT
              </div>
            </div>
            {PARKINGS_CENTRE.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, paddingLeft: 18 }}>
                <span style={{ fontSize: 12 }}>🅿️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: '#93c5fd' }}>{p.places} pl. -- {p.note}</div>
                </div>
              </div>
            ))}
            <div style={{ paddingLeft: 18, marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#1e40af', fontWeight: 700, marginBottom: 6 }}>
                1 424 places totales -- Ajustez le tarif :
              </div>
              <PriceSlider
                value={centrePrix}
                onChange={handleCentrePrice}
                max={8}
                baseline={baseline.centrePeakPriceCHFh}
              />
            </div>
            <div style={{ paddingLeft: 18, marginTop: 6, fontSize: 9, color: '#93c5fd' }}>
              Gratuit ven. 17h - sam. 24h (situation actuelle maintenue)
            </div>
          </div>

          {/* Autres parkings -- lecture seule */}
          <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
            Autres parkings (pas de levier direct)
          </div>
          {PARKINGS_OTHER.map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, padding: '6px 10px', background: '#f9fafb', borderRadius: 8 }}>
              <span style={{ fontSize: 12 }}>{p.places >= 400 ? '🚌' : '🅿️'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{p.name}</div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>{p.places} pl. -- {p.note}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.price === 'GRATUIT' ? '#16a34a' : '#6b7280' }}>
                {p.price}
              </div>
            </div>
          ))}

          {/* Recap changement */}
          {changed && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Modification</div>
              <div style={{ fontSize: 11, color: '#92400e' }}>
                Centre : CHF {baseline.centrePeakPriceCHFh.toFixed(1)}/h
                {' -> '}
                <strong>{centrePrix === 0 ? 'GRATUIT' : 'CHF ' + centrePrix.toFixed(1) + '/h'}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Bouton simuler */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
          <button
            onClick={runSimulation}
            disabled={isSimulating}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: isSimulating ? '#e5e7eb' : '#2563eb',
              color: 'white', fontSize: 14, fontWeight: 800,
              cursor: isSimulating ? 'not-allowed' : 'pointer',
            }}
          >
            {isSimulating ? 'Simulation...' : '▶ Simuler ce tarif'}
          </button>
          {!changed && (
            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>
              Ajustez le tarif pour simuler
            </div>
          )}
        </div>
      </div>

      {/* ── CENTRE : Carte ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Zones et parkings -- Sion</div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' as const }}>
            {[
              { label: 'Centre-ville', color: '#ef4444' },
              { label: 'Gare CFF', color: '#f97316' },
              { label: 'Zone Industrielle', color: '#ec4899' },
              { label: 'P+R gratuits', color: '#14b8a6' },
            ].map(z => (
              <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color }} />
                {z.label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <ZoneMap
            scenario={scenario}
            zoneResults={results?.zoneResults}
          />
        </div>
      </div>

      {/* ── DROITE : Resultats ──────────────────────────────────────────────── */}
      <div style={{ width: 270, background: 'white', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>Resultats</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {hasResults && results ? (
            <>
              {/* Report modal */}
              <div style={{ background: deltaModal < -0.5 ? '#f0fdf4' : '#f8fafc', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1.5px solid ' + (deltaModal < -0.5 ? '#86efac' : '#e5e7eb') }}>
                <div style={{ fontSize: 11, color: deltaModal < -0.5 ? '#15803d' : '#374151', fontWeight: 600, marginBottom: 4 }}>
                  Report modal estime
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: deltaModal < -0.5 ? '#15803d' : deltaModal > 0.5 ? '#dc2626' : '#374151', lineHeight: 1 }}>
                  {Math.abs(deltaModal).toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  {deltaModal < 0 ? 'transfert voiture -> TP' : deltaModal > 0 ? 'augmentation voiture' : 'pas de changement'}
                </div>
              </div>

              {/* Part modale */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, background: '#fef2f2', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 2 }}>🚗 Voiture</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                    {scenarioCar.toFixed(0)}%
                  </div>
                </div>
                <div style={{ flex: 1, background: '#eff6ff', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, marginBottom: 2 }}>🚌 TP</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>
                    {(results.modeSplit?.tp ?? 0).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Zones */}
              {results.zoneResults && results.zoneResults.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 8 }}>
                    Par zone
                  </div>
                  {results.zoneResults.map((z) => {
                    const pct = Math.round(z.shiftIndex * 100);
                    const col = z.category === 'vert' ? '#22c55e' : z.category === 'orange' ? '#f59e0b' : '#ef4444';
                    const lbl = z.category === 'vert' ? 'Fort' : z.category === 'orange' ? 'Moyen' : 'Faible';
                    return (
                      <div key={z.zoneId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{z.label}</div>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>
                            Elasticite {z.elasticityScore}/100
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' as const }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: col, background: col + '18', padding: '2px 6px', borderRadius: 6 }}>
                            {lbl} -- {pct}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ padding: '8px 10px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10, color: '#92400e', lineHeight: 1.5 }}>
                  Resultats indicatifs -- Modele logit RUM -- Calibration requise avant decision politique
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Situation actuelle
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6, marginBottom: 20 }}>
                Ajustez le tarif du parking centre-ville et cliquez sur Simuler
              </div>
              {[
                { label: 'Planta + Scex + Cible', price: 'CHF 3.00/h', col: '#2563eb' },
                { label: 'Gare CFF', price: '~CHF 2.00/h', col: '#f97316' },
                { label: 'P+R Potences + Stade', price: 'GRATUIT', col: '#16a34a' },
                { label: 'Zone Industrielle', price: 'GRATUIT', col: '#ec4899' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textAlign: 'left' as const }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: item.col, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 10, color: '#374151' }}>{item.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: item.price === 'GRATUIT' ? '#16a34a' : '#374151' }}>
                    {item.price}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', fontSize: 9, color: '#d1d5db', lineHeight: 1.5 }}>
          Sources : sion.ch 2024-2025 -- ARE Microrecensement 2015 -- MobilityLab
        </div>
      </div>
    </div>
  );
}
