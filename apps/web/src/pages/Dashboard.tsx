/**
 * Dashboard.tsx — Outil de décision Parking · Ville de Sion
 * Design: décideur municipal, levier unique = tarification parking
 *
 * Chemin : apps/web/src/pages/Dashboard.tsx
 */

import { useCallback } from 'react';
import { useApp } from '../hooks/store';
import ZoneMap from '../components/ZoneMap';
import type { Scenario } from '../types';
import { BASELINE_SCENARIO } from '../types';

// ─── Parkings réels de Sion (sion.ch) ────────────────────────────────────────

const PARKINGS = [
  {
    group: 'Centre-ville',
    color: '#ef4444',
    field: 'centrePeakPriceCHFh' as keyof Scenario,
    items: [
      { name: 'Parking Planta',    places: 562,  icon: '🅿️' },
      { name: 'Parking Scex',      places: 658,  icon: '🅿️' },
      { name: 'Parking de la Cible', places: 204, icon: '🅿️' },
    ],
    totalPlaces: 1424,
    baselineCHFh: 3.0,
    note: '1ère heure gratuite · gratuit ven.17h → sam.24h',
    maxCHFh: 8,
    lever: true,
  },
  {
    group: 'Gare CFF',
    color: '#f97316',
    field: null, // mapped to centreOffpeakPriceCHFh as proxy
    items: [
      { name: 'Parking Gare CFF', places: 300, icon: '🚉' },
    ],
    totalPlaces: 300,
    baselineCHFh: 2.0,
    note: 'Tarif estimé · ~CHF 2/h',
    maxCHFh: 6,
    lever: false,
  },
  {
    group: 'Périphérie payante',
    color: '#3b82f6',
    field: null,
    items: [
      { name: 'Parking Nord',         places: 282, icon: '🅿️' },
      { name: 'Parking Roches-Brunes', places: 300, icon: '🅿️' },
      { name: 'Parking St-Guérin',    places: 66,  icon: '🅿️' },
    ],
    totalPlaces: 648,
    baselineCHFh: 1.5,
    note: 'Tarif préférentiel estimé · ~CHF 1.50/h',
    maxCHFh: 4,
    lever: false,
  },
  {
    group: 'P+R Gratuits',
    color: '#22c55e',
    field: 'peripheriePeakPriceCHFh' as keyof Scenario,
    items: [
      { name: 'P+R Potences (Sion-Ouest)', places: 450, icon: '🚌' },
      { name: 'P+R Stade / Échutes',       places: 460, icon: '🚌' },
    ],
    totalPlaces: 910,
    baselineCHFh: 0,
    note: 'BS 11 → centre toutes les 10 min · connexion directe',
    maxCHFh: 0,
    lever: false,
  },
  {
    group: 'Zone Industrielle',
    color: '#ec4899',
    field: null,
    items: [
      { name: 'Parkings privés entreprises', places: 1200, icon: '🏭' },
    ],
    totalPlaces: 1200,
    baselineCHFh: 0,
    note: 'Gratuit employés · levier nécessite mesure employeur',
    maxCHFh: 0,
    lever: false,
  },
];

// ─── Barème couleur par prix ───────────────────────────────────────────────

function priceColor(chf: number): string {
  if (chf === 0)  return '#22c55e';
  if (chf <= 1.5) return '#f59e0b';
  if (chf <= 3)   return '#f97316';
  return '#ef4444';
}

// ─── Composant slider parking ─────────────────────────────────────────────

function ParkingSlider({
  value, onChange, max, baseline, color,
}: { value: number; onChange: (v: number) => void; max: number; baseline: number; color: string }) {
  const steps = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
  const validSteps = steps.filter(s => s <= max);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range" min={0} max={max} step={0.5} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: color, height: 4 }}
      />
      <div style={{ width: 72, textAlign: 'right' }}>
        <span style={{
          fontSize: 16, fontWeight: 900,
          color: value === baseline ? '#6b7280' : value > baseline ? '#ef4444' : '#22c55e',
        }}>
          {value === 0 ? 'Gratuit' : `CHF ${value.toFixed(1)}/h`}
        </span>
        {value !== baseline && (
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
            base: CHF {baseline.toFixed(1)}/h
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ icon, label, value, sub, color = '#374151', bg = '#f8fafc' }: {
  icon: string; label: string; value: string; sub?: string; color?: string; bg?: string;
}) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '12px 16px', flex: 1 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    scenario, updateScenario,
    results, baselineResults,
    isSimulating, runSimulation,
    trafficData,
  } = useApp();

  const centreCHFh = scenario.centrePeakPriceCHFh ?? 3.0;
  const prCHFh     = scenario.peripheriePeakPriceCHFh ?? 0.0;

  const baseline = BASELINE_SCENARIO;

  // Calcul delta modal (diff vs baseline)
  const baselineCar  = baselineResults?.modeSplit?.car  ?? 62;
  const scenarioCar  = results?.modeSplit?.car  ?? baselineCar;
  const deltaModal   = scenarioCar - baselineCar;

  // Recettes estimées (simplifiées)
  const baselineRev  = baselineResults?.parkingRevenueCHFday  ?? 0;
  const scenarioRev  = results?.parkingRevenueCHFday  ?? 0;
  const deltaRev     = scenarioRev - baselineRev;

  const hasResults = results !== null;
  const changed = centreCHFh !== baseline.centrePeakPriceCHFh ||
                  prCHFh     !== baseline.peripheriePeakPriceCHFh;

  // Trafic en-tête
  const sev = trafficData?.severity ?? 'fluide';
  const speed = trafficData?.currentSpeed ?? 17;
  const sevColor = sev === 'fluide' ? '#16a34a' : sev === 'modéré' ? '#d97706' : sev === 'dense' ? '#ea580c' : '#dc2626';

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: "'DM Sans','Inter',sans-serif", background: '#f8fafc' }}>

      {/* ── PANNEAU GAUCHE : Parkings ─────────────────────────────────────── */}
      <div style={{ width: 300, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* En-tête trafic */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: sevColor }}>Trafic Sion · {sev} · {speed} km/h</span>
        </div>

        {/* Titre */}
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 2 }}>
            Tarification des parkings
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
            Ajustez le prix des parkings publics.<br/>
            Les P+R et parkings privés ne sont pas des leviers directs.
          </div>
        </div>

        {/* Liste parkings scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {PARKINGS.map(pg => (
            <div key={pg.group} style={{ marginBottom: 14 }}>
              {/* Groupe header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: pg.color, flexShrink: 0 }} />
                <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                  {pg.group}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
                  {pg.totalPlaces.toLocaleString('fr-CH')} pl.
                </div>
              </div>

              {/* Parkings individuels */}
              {pg.items.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 18 }}>
                  <span style={{ fontSize: 12 }}>{item.icon}</span>
                  <div style={{ fontSize: 11, color: '#374151', flex: 1 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{item.places} pl.</div>
                </div>
              ))}

              {/* Slider si levier disponible */}
              {pg.lever && pg.field ? (
                <div style={{ paddingLeft: 18, marginTop: 8 }}>
                  <ParkingSlider
                    value={scenario[pg.field] as number ?? pg.baselineCHFh}
                    onChange={v => updateScenario({ [pg.field as string]: v, [`${pg.field as string}`.replace('Peak','Offpeak')]: v })}
                    max={pg.maxCHFh}
                    baseline={pg.baselineCHFh}
                    color={pg.color}
                  />
                </div>
              ) : (
                <div style={{ paddingLeft: 18, marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2 }}>
                      <div style={{ width: pg.baselineCHFh === 0 ? '0%' : `${(pg.baselineCHFh / 8) * 100}%`, height: '100%', background: pg.color, borderRadius: 2, opacity: 0.4 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', width: 72, textAlign: 'right' }}>
                      {pg.baselineCHFh === 0 ? 'Gratuit' : `~CHF ${pg.baselineCHFh}/h`}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: '#c4b5fd', marginTop: 3 }}>⚠ Pas de levier direct</div>
                </div>
              )}

              <div style={{ fontSize: 9, color: '#d1d5db', paddingLeft: 18, marginTop: 4 }}>{pg.note}</div>
            </div>
          ))}

          {/* Résumé changements */}
          {changed && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Modifications en cours</div>
              {centreCHFh !== baseline.centrePeakPriceCHFh && (
                <div style={{ fontSize: 11, color: '#92400e', marginBottom: 3 }}>
                  Centre-ville : {baseline.centrePeakPriceCHFh} → <strong>{centreCHFh === 0 ? 'Gratuit' : `CHF ${centreCHFh}/h`}</strong>
                </div>
              )}
              {prCHFh !== baseline.peripheriePeakPriceCHFh && (
                <div style={{ fontSize: 11, color: '#92400e' }}>
                  P+R : {baseline.peripheriePeakPriceCHFh} → <strong>{prCHFh === 0 ? 'Gratuit' : `CHF ${prCHFh}/h`}</strong>
                </div>
              )}
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
              background: isSimulating ? '#e5e7eb' : changed ? '#2563eb' : '#6b7280',
              color: 'white', fontSize: 14, fontWeight: 800, cursor: isSimulating ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {isSimulating ? '⏳ Simulation…' : changed ? '▶ Simuler' : '▶ Simuler (baseline)'}
          </button>
          {!changed && (
            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>
              Ajustez un tarif pour simuler un scénario
            </div>
          )}
        </div>
      </div>

      {/* ── CENTRE : Carte ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Barre titre */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
            Carte des zones et parkings · Sion
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {[
              { label: 'Centre', color: '#ef4444' },
              { label: 'Gare', color: '#f97316' },
              { label: 'Zone Industrielle', color: '#ec4899' },
              { label: 'P+R', color: '#22c55e' },
            ].map(z => (
              <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color }} />
                {z.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <ZoneMap scenario={scenario} results={results} />
        </div>
      </div>

      {/* ── DROITE : Résultats ────────────────────────────────────────────── */}
      <div style={{ width: 280, background: 'white', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>Résultats de simulation</div>
          {!hasResults && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Lancez une simulation →</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

          {hasResults && results ? (
            <>
              {/* KPIs principaux */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>
                  Impact estimé vs baseline
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <KPI
                    icon="🚗" label="Voiture"
                    value={`${scenarioCar.toFixed(0)}%`}
                    sub={deltaModal < -0.5 ? `▼ ${Math.abs(deltaModal).toFixed(1)} pts` : deltaModal > 0.5 ? `▲ +${deltaModal.toFixed(1)} pts` : '= stable'}
                    color={deltaModal < -1 ? '#16a34a' : deltaModal > 1 ? '#dc2626' : '#374151'}
                    bg={deltaModal < -1 ? '#f0fdf4' : deltaModal > 1 ? '#fef2f2' : '#f8fafc'}
                  />
                  <KPI
                    icon="🚌" label="TP"
                    value={`${(results.modeSplit?.tp ?? 0).toFixed(0)}%`}
                    sub={hasResults ? '+' + ((results.modeSplit?.tp ?? 0) - (baselineResults?.modeSplit?.tp ?? 28)).toFixed(1) + ' pts' : ''}
                    color="#2563eb" bg="#eff6ff"
                  />
                </div>

                {/* Report modal */}
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600, marginBottom: 4 }}>Report modal estimé</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#15803d', lineHeight: 1 }}>
                    {Math.abs(deltaModal).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 10, color: '#16a34a', marginTop: 3 }}>
                    voiture → transports publics
                  </div>
                </div>

                {/* Recettes */}
                {(scenarioRev !== 0 || baselineRev !== 0) && (
                  <div style={{ background: '#fafafa', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#374151', fontWeight: 600, marginBottom: 4 }}>💰 Recettes parking</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: deltaRev >= 0 ? '#15803d' : '#dc2626' }}>
                      {deltaRev >= 0 ? '+' : ''}CHF {deltaRev.toFixed(0)}/jour
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                      vs situation actuelle
                    </div>
                  </div>
                )}
              </div>

              {/* Impact par zone */}
              {results.zoneResults && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>
                    Par zone
                  </div>
                  {Object.entries(results.zoneResults).map(([zoneId, z]: [string, any]) => {
                    const switchPct = z?.switchPct ?? 0;
                    const potential = switchPct >= 60 ? 'Fort' : switchPct >= 35 ? 'Modéré' : 'Faible';
                    const potColor  = switchPct >= 60 ? '#22c55e' : switchPct >= 35 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={zoneId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{z?.label ?? zoneId}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>{z?.priceCHFh?.toFixed(1) ?? '—'} CHF/h · {(z?.occupancyRate * 100)?.toFixed(0) ?? 0}% occ.</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: potColor, background: `${potColor}18`, padding: '2px 6px', borderRadius: 6 }}>
                            {potential}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Avertissement */}
              <div style={{ padding: '8px 10px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10, color: '#92400e', lineHeight: 1.5 }}>
                  ⚠ Résultats indicatifs · Modèle logit RUM · Calibration sur données locales requise avant décision
                </div>
              </div>
            </>
          ) : (
            /* État vide */
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Configurez et simulez
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
                Ajustez le tarif des parkings du centre-ville et cliquez sur <strong>Simuler</strong>
              </div>

              {/* Rappel tarifs actuels */}
              <div style={{ marginTop: 20, textAlign: 'left' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>
                  Situation actuelle
                </div>
                {[
                  { label: 'Planta + Scex + Cible', price: 'CHF 3.00/h', note: '1h gratuite', color: '#ef4444' },
                  { label: 'Gare CFF', price: '~CHF 2.00/h', note: 'estimé', color: '#f97316' },
                  { label: 'Nord / Roches-Brunes', price: '~CHF 1.50/h', note: 'préférentiel', color: '#3b82f6' },
                  { label: 'P+R Potences + Stade', price: 'GRATUIT', note: 'BS 11 → centre', color: '#22c55e' },
                  { label: 'Zone Industrielle', price: 'GRATUIT', note: 'privé', color: '#ec4899' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 10, color: '#374151' }}>{item.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: item.price === 'GRATUIT' ? '#22c55e' : '#374151' }}>{item.price}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mention source */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', fontSize: 9, color: '#d1d5db', lineHeight: 1.5 }}>
          Sources: sion.ch PDFs 2024-2025 · ARE Microrecensement 2015 · MobilityLab
        </div>
      </div>
    </div>
  );
}
