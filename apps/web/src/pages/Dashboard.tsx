/**
 * Dashboard.tsx - Simulateur de tarification parking Sion
 * VERSION COMPLETE : levier parking, KPIs concrets, comparaison, CO2
 * Chemin : apps/web/src/pages/Dashboard.tsx
 */

import { useEffect } from 'react';
import { useApp } from '../hooks/store';
import ZoneMap from '../components/ZoneMap';
import { BASELINE_SCENARIO } from '../types';
import type { Scenario, ZoneResult } from '../types';

// ─── Constantes Sion ─────────────────────────────────────────────────────────

// Source : ARE Microrecensement 2015 adapte Sion 35k hab.
const DAILY_CAR_TRIPS_CENTRE = 11500;
const DAILY_CAR_TRIPS_GARE   = 2800;
const DAILY_CAR_TRIPS_EMPLOI = 4200;
const TOTAL_TRIPS = DAILY_CAR_TRIPS_CENTRE + DAILY_CAR_TRIPS_GARE + DAILY_CAR_TRIPS_EMPLOI;

// Centres-ville : 1424 places, taux turnover 4.5x/jour, 1h gratuite
const CENTRE_PLACES  = 1424;
const TURNOVER_DAILY = 4.5;
const FREE_HOUR_H    = 1.0;
const AVG_STAY_H     = 2.5;

// CO2 moyenne voiture Suisse 2024 (TCS)
const CO2_KG_PER_TRIP = 1.85; // 12 km A/R, 155 g/km

function calcRevenue(priceCHFh: number, isFreeDay: boolean): number {
  if (isFreeDay) return 0;
  const billableH = Math.max(0, AVG_STAY_H - FREE_HOUR_H);
  return Math.round(CENTRE_PLACES * TURNOVER_DAILY * billableH * priceCHFh);
}

function calcKPIs(zoneResults: ZoneResult[], centrePrix: number, basePrix: number, compareMode: boolean) {
  if (!zoneResults || zoneResults.length === 0) return null;

  const avgShift = zoneResults.reduce((s, z) => s + z.shiftIndex, 0) / zoneResults.length;
  const avgShiftBase = compareMode ? 0 : 0;

  const carsReduced    = Math.round(TOTAL_TRIPS * avgShift);
  const tpGain         = Math.round(carsReduced * 0.85); // 85% vont en TP, 15% autre
  const co2Saved       = Math.round(carsReduced * CO2_KG_PER_TRIP);
  const revenueDay     = calcRevenue(centrePrix, false);
  const revenueBase    = calcRevenue(basePrix, false);
  const revenueDelta   = revenueDay - revenueBase;
  const occupancyDelta = Math.round(-avgShift * 18); // pts de taux d'occupation

  return { avgShift, carsReduced, tpGain, co2Saved, revenueDay, revenueDelta, occupancyDelta };
}

// ─── Composant KPI Card ───────────────────────────────────────────────────────

function KPI({ label, value, sub, color, icon, delta }: {
  label: string; value: string; sub?: string; color: string; icon: string; delta?: number;
}) {
  const deltaStr = delta !== undefined
    ? (delta >= 0 ? '+' + delta.toString() : delta.toString())
    : null;
  const deltaColor = delta !== undefined
    ? (delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#9ca3af')
    : '#9ca3af';

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {deltaStr && (
        <div style={{ fontSize: 10, color: deltaColor, fontWeight: 700, marginTop: 2 }}>{deltaStr} vs baseline</div>
      )}
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, lineHeight: 1.4 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: '#d1d5db', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Composant slider prix ────────────────────────────────────────────────────

function PriceSlider({ value, onChange, max, baseline, label }: {
  value: number; onChange: (v: number) => void; max: number; baseline: number; label: string;
}) {
  const changed = value !== baseline;
  const col = changed ? (value > baseline ? '#dc2626' : '#16a34a') : '#6b7280';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: col }}>
          {value === 0 ? 'GRATUIT' : 'CHF ' + value.toFixed(1) + '/h'}
        </span>
      </div>
      <input
        type="range" min={0} max={max} step={0.5} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#2563eb', height: 4 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9ca3af', marginTop: 2 }}>
        <span>GRATUIT</span>
        <span style={{ color: '#6b7280', fontSize: 9 }}>baseline: CHF {baseline.toFixed(1)}/h</span>
        <span>CHF {max}/h</span>
      </div>
    </div>
  );
}

// ─── Composant comparaison scenario ──────────────────────────────────────────

function CompareCol({ label, price, kpis, isBaseline }: {
  label: string;
  price: number;
  kpis: ReturnType<typeof calcKPIs>;
  isBaseline: boolean;
}) {
  const bg = isBaseline ? '#f8fafc' : '#eff6ff';
  const border = isBaseline ? '#e5e7eb' : '#bfdbfe';
  const accent = isBaseline ? '#6b7280' : '#2563eb';

  return (
    <div style={{ flex: 1, background: bg, borderRadius: 12, border: '1.5px solid ' + border, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: accent, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: accent, marginBottom: 10 }}>
        {price === 0 ? 'GRATUIT' : 'CHF ' + price.toFixed(1) + '/h'}
      </div>
      {kpis ? (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 7 }}>
          {[
            { icon: '🚗', label: 'Voitures centre/jour', val: (DAILY_CAR_TRIPS_CENTRE - Math.round(DAILY_CAR_TRIPS_CENTRE * kpis.avgShift)).toString() },
            { icon: '🚌', label: 'Voyageurs TP/jour', val: (Math.round(DAILY_CAR_TRIPS_CENTRE * 0.65) + kpis.tpGain).toString() },
            { icon: '🌱', label: 'CO2 economise/j', val: kpis.co2Saved + ' kg' },
            { icon: '💰', label: 'Recettes parking/j', val: 'CHF ' + kpis.revenueDay.toLocaleString('fr-CH') },
            { icon: '🅿', label: 'Occupation centre', val: Math.max(0, 78 + kpis.occupancyDelta) + '%' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid ' + (isBaseline ? '#f1f5f9' : '#dbeafe') }}>
              <span style={{ fontSize: 11, color: '#374151' }}>{item.icon} {item.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>{item.val}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' as const }}>Simulez pour voir les resultats</div>
      )}
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    scenario, updateScenario,
    results, baselineResults,
    isSimulating,
    runSimulation, runBaselineSimulation,
    compareMode, setCompareMode,
    trafficData,
  } = useApp();

  // Lancer la simulation baseline au demarrage
  useEffect(() => {
    if (!baselineResults) {
      runBaselineSimulation();
    }
  }, []);

  const basePrix   = BASELINE_SCENARIO.centrePeakPriceCHFh;
  const centrePrix = scenario.centrePeakPriceCHFh ?? basePrix;
  const prPrix     = scenario.peripheriePeakPriceCHFh ?? 0;

  const changed    = centrePrix !== basePrix || prPrix !== BASELINE_SCENARIO.peripheriePeakPriceCHFh;
  const hasResults = results !== null;

  const kpis     = hasResults     ? calcKPIs(results.zoneResults,     centrePrix, basePrix, false)  : null;
  const kpisBase = baselineResults ? calcKPIs(baselineResults.zoneResults, basePrix, basePrix, false) : null;

  const sev      = trafficData?.severity ?? 'fluide';
  const speed    = trafficData?.currentSpeed ?? 17;
  const sevColor = sev === 'fluide' ? '#16a34a' : sev === 'mod\u00e9r\u00e9' ? '#d97706' : sev === 'dense' ? '#ea580c' : '#dc2626';

  const handleCentrePrice = (v: number) => {
    updateScenario({ centrePeakPriceCHFh: v, centreOffpeakPriceCHFh: v } as Partial<Scenario>);
  };

  const handlePRPrice = (v: number) => {
    updateScenario({ peripheriePeakPriceCHFh: v, peripherieOffpeakPriceCHFh: v } as Partial<Scenario>);
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: "'DM Sans','Inter',sans-serif", background: '#f8fafc', overflow: 'hidden' }}>

      {/* ── GAUCHE : Leviers ───────────────────────────────────────────────── */}
      <div style={{ width: 310, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>

        {/* Trafic live */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: sevColor }}>
            Trafic Sion : {sev} -- {speed} km/h
          </span>
          <button
            onClick={() => setCompareMode(!compareMode)}
            style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', borderColor: compareMode ? '#2563eb' : '#e5e7eb', background: compareMode ? '#eff6ff' : 'white', color: compareMode ? '#2563eb' : '#6b7280' }}
          >
            Comparer
          </button>
        </div>

        {/* Titre */}
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
            Leviers de tarification
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
            Modifiez les tarifs et simulez l&apos;impact sur la mobilite de Sion.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

          {/* Parking centre-ville -- LEVIER PRINCIPAL */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#eff6ff', borderRadius: 12, border: '1.5px solid #bfdbfe' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 8 }}>
              Centre-ville -- Levier direct
            </div>
            {[
              { name: 'Parking Planta',   places: 562 },
              { name: 'Parking Scex',     places: 658 },
              { name: 'Parking de la Cible', places: 204 },
            ].map(p => (
              <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#3b82f6', marginBottom: 3 }}>
                <span>P {p.name}</span>
                <span style={{ fontWeight: 700 }}>{p.places} pl.</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: 10, marginTop: 8 }}>
              <PriceSlider
                value={centrePrix}
                onChange={handleCentrePrice}
                max={8}
                baseline={basePrix}
                label="Tarif horaire (h2+)"
              />
              <div style={{ fontSize: 9, color: '#93c5fd', marginTop: 4 }}>
                1h gratuite maintenue -- Gratuit ven.17h-sam.24h
              </div>
            </div>
          </div>

          {/* P+R */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f0fdf4', borderRadius: 12, border: '1.5px solid #bbf7d0' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 8 }}>
              P+R Peripherie
            </div>
            {[
              { name: 'P+R Potences (Sion-Ouest)', places: 450 },
              { name: 'P+R Stade / Echutes',       places: 460 },
            ].map(p => (
              <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#16a34a', marginBottom: 3 }}>
                <span>P {p.name}</span>
                <span style={{ fontWeight: 700 }}>{p.places} pl.</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #bbf7d0', paddingTop: 10, marginTop: 8 }}>
              <PriceSlider
                value={prPrix}
                onChange={handlePRPrice}
                max={4}
                baseline={0}
                label="Tarif P+R (baseline = gratuit)"
              />
              <div style={{ fontSize: 9, color: '#86efac', marginTop: 4 }}>
                BS 11 vers le centre toutes les 10 min
              </div>
            </div>
          </div>

          {/* Autres parkings -- lecture seule */}
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 8 }}>
            Autres parkings (pas de levier direct)
          </div>
          {[
            { name: 'Gare CFF',          places: 300,  price: '~CHF 2.00/h',   note: 'CFF -- tarif estime' },
            { name: 'Parking Nord',      places: 282,  price: '~CHF 1.50/h',   note: 'Tarif preferentiel estime' },
            { name: 'Roches-Brunes',     places: 300,  price: '~CHF 1.50/h',   note: 'Tarif preferentiel estime' },
            { name: 'Zone Industrielle', places: 1200, price: 'GRATUIT',        note: 'Prive employes' },
          ].map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, padding: '6px 10px', background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{p.name} -- {p.places} pl.</div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>{p.note}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.price === 'GRATUIT' ? '#16a34a' : '#6b7280' }}>
                {p.price}
              </div>
            </div>
          ))}
        </div>

        {/* Bouton simuler */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
          <button
            onClick={runSimulation}
            disabled={isSimulating}
            style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: isSimulating ? '#e5e7eb' : (changed ? '#2563eb' : '#6b7280'), color: 'white', fontSize: 14, fontWeight: 800, cursor: isSimulating ? 'not-allowed' : 'pointer', transition: 'background .2s' }}
          >
            {isSimulating ? 'Simulation en cours...' : (changed ? 'Simuler ce scenario' : 'Simuler (baseline)')}
          </button>
        </div>
      </div>

      {/* ── CENTRE : Carte ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0 }}>

        {/* KPIs top */}
        {kpis && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
            <KPI
              icon="🚗" label="Voitures en moins/jour au centre" color="#dc2626"
              value={kpis.carsReduced.toString()}
              delta={kpis.carsReduced}
              sub={"sur ~" + TOTAL_TRIPS.toLocaleString('fr-CH') + " trajets/j"}
            />
            <KPI
              icon="🚌" label="Voyageurs TP supplementaires/j" color="#2563eb"
              value={"+" + kpis.tpGain.toString()}
              delta={kpis.tpGain}
            />
            <KPI
              icon="🌱" label="CO2 economise par jour" color="#16a34a"
              value={kpis.co2Saved + " kg"}
              sub={"= " + (kpis.co2Saved / 1000).toFixed(1) + " tCO2/j"}
            />
            <KPI
              icon="💰" label="Recettes parking centre/jour" color="#d97706"
              value={"CHF " + kpis.revenueDay.toLocaleString('fr-CH')}
              delta={kpis.revenueDelta}
              sub={"CHF " + (kpis.revenueDay * 250).toLocaleString('fr-CH') + "/an (250j)"}
            />
          </div>
        )}

        {/* Carte */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <ZoneMap
            scenario={scenario}
            zoneResults={results?.zoneResults}
            onParkingPriceChange={(parkingId, price) => {
              if (parkingId === 'pr-potences' || parkingId === 'pr-stade') {
                handlePRPrice(price);
              } else {
                handleCentrePrice(price);
              }
              setTimeout(() => runSimulation(), 100);
            }}
          />
        </div>

        {/* Avertissement modele */}
        <div style={{ padding: '5px 14px', background: '#fffbeb', borderTop: '1px solid #fde68a', fontSize: 9, color: '#92400e' }}>
          Resultats indicatifs -- Modele logit RUM T=1.5 -- ARE Microrecensement 2015 -- Calibration terrain recommandee avant decision
        </div>
      </div>

      {/* ── DROITE : Resultats ──────────────────────────────────────────────── */}
      <div style={{ width: 280, background: 'white', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>
            {compareMode ? 'Comparaison' : 'Resultats'}
          </div>
          {hasResults && (
            <div style={{ fontSize: 10, background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
              {(results.globalShiftIndex * 100).toFixed(1)}% report modal
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

          {/* Mode comparaison */}
          {compareMode ? (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              <CompareCol
                label="Situation actuelle"
                price={basePrix}
                kpis={kpisBase}
                isBaseline={true}
              />
              <CompareCol
                label="Scenario simule"
                price={centrePrix}
                kpis={kpis}
                isBaseline={false}
              />
            </div>
          ) : hasResults && results ? (
            <>
              {/* Report modal global */}
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1.5px solid #86efac' }}>
                <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600, marginBottom: 4 }}>Report modal global</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#15803d', lineHeight: 1 }}>
                    {(results.globalShiftIndex * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>transfert voiture vers TP</div>
                </div>
                <div style={{ fontSize: 9, color: '#86efac', marginTop: 4 }}>Moyenne ponderee sur {results.zoneResults.length} zones</div>
              </div>

              {/* Indicateurs concrets */}
              <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
                Impacts concrets / jour ouvrable
              </div>
              {kpis && [
                { icon: '🚗', label: 'Voitures en moins au centre', val: kpis.carsReduced.toString(), color: '#dc2626', positive: true },
                { icon: '🚌', label: 'Voyageurs TP supplementaires', val: '+' + kpis.tpGain.toString(), color: '#2563eb', positive: true },
                { icon: '🌱', label: 'CO2 economise', val: kpis.co2Saved + ' kg', color: '#16a34a', positive: true },
                { icon: '💰', label: 'Recettes parking', val: 'CHF ' + kpis.revenueDay.toLocaleString('fr-CH'), color: '#d97706', positive: kpis.revenueDelta >= 0 },
                { icon: '🅿', label: 'Taux occupation centre', val: Math.max(0, 78 + kpis.occupancyDelta) + '%', color: '#6366f1', positive: kpis.occupancyDelta <= 0 },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: item.color + '0a', borderRadius: 8, marginBottom: 5, border: '1px solid ' + item.color + '20' }}>
                  <span style={{ fontSize: 11, color: '#374151' }}>{item.icon} {item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: item.color }}>{item.val}</span>
                </div>
              ))}

              {/* Par zone */}
              <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginTop: 14, marginBottom: 8 }}>
                Par zone
              </div>
              {results.zoneResults.map(z => {
                const pct = Math.round(z.shiftIndex * 100);
                const col = z.category === 'vert' ? '#22c55e' : z.category === 'orange' ? '#f59e0b' : '#ef4444';
                const lbl = z.category === 'vert' ? 'Fort' : z.category === 'orange' ? 'Moyen' : 'Faible';
                return (
                  <div key={z.zoneId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{z.label}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>
                        Elasticite {z.elasticityScore}/100
                        {z.occupancyPct !== undefined ? ' -- Occupation ' + z.occupancyPct + '%' : ''}
                      </div>
                      {z.equityFlag && (
                        <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>
                          Risque equite
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: col, background: col + '18', padding: '2px 6px', borderRadius: 6 }}>
                        {lbl} {pct}%
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Risques equite */}
              {results.equityFlags.length > 0 && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                    Risques equite detectes
                  </div>
                  {results.equityFlags.map(f => (
                    <div key={f} style={{ fontSize: 10, color: '#dc2626', marginBottom: 2 }}>{f}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Situation actuelle</div>
              <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6, marginBottom: 16 }}>
                Ajustez le tarif centre-ville et cliquez Simuler pour voir l&apos;impact.
              </div>
              {[
                { label: 'Planta + Scex + Cible', places: '1 424 pl.', price: 'CHF 3.00/h', col: '#2563eb' },
                { label: 'P+R Potences + Stade',  places: '910 pl.',   price: 'GRATUIT',    col: '#16a34a' },
                { label: 'Gare CFF',              places: '~300 pl.',  price: '~CHF 2.00/h', col: '#f97316' },
                { label: 'Zone Industrielle',     places: '~1 200 pl.', price: 'GRATUIT',   col: '#ec4899' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, textAlign: 'left' as const }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: item.col, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#374151', fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{item.places}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: item.price === 'GRATUIT' ? '#16a34a' : '#374151' }}>
                    {item.price}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', fontSize: 9, color: '#d1d5db', lineHeight: 1.5 }}>
          Sources : sion.ch 2024-2025 -- ARE Microrecensement 2015 -- TCS 2024 -- MobilityLab
        </div>
      </div>
    </div>
  );
}
