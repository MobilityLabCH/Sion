/**
 * ODSimulator.tsx — Visualisation Origines → Destinations · Sion Mobility
 * Refonte: captivité voiture par commune, MapLibre depuis npm (plus de CDN).
 * Chemin: apps/web/src/components/ODSimulator.tsx
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchData } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Origin {
  id: string;
  label: string;
  emoji: string;
  coords: [number, number];
  population: number;
  carTimeMin: number;
  tpTimeMin: number;
  tpLine: string;
  tpFreqPeakMin: number;
  tpFreqOffpeakMin: number;
  tpTicketCHF: number;
  tpZone: number;
  prPotential: boolean;
  prId?: string;
  prNote?: string;
  demand: { centre: number; gare: number; emploi: number };
}

interface ParkingNode {
  zoneId: string;
  capacity: number;
  basePriceCHFh: number;
}

type DayType = 'weekday' | 'friday' | 'saturday';
type DurationH = 1 | 2 | 4;
type Destination = 'centre' | 'gare' | 'emploi';
type CaptivityClass = 'competitive' | 'moderate' | 'captive';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEST_COORDS: Record<Destination, [number, number]> = {
  centre: [7.3595, 46.2333],
  gare:   [7.3590, 46.2295],
  emploi: [7.3800, 46.2200],
};

const DEST_LABELS: Record<Destination, string> = {
  centre: 'Centre-ville',
  gare:   'Gare CFF',
  emploi: 'Zone Emploi',
};

const PR_NODES = {
  potences: { label: 'P+R Potences', coords: [7.3318, 46.2282] as [number, number], cap: 450 },
  stade:    { label: 'P+R Stade',    coords: [7.3888, 46.2282] as [number, number], cap: 460 },
};

// ─── Helpers coûts ────────────────────────────────────────────────────────────

/** Barème officiel Planta/Scex (source: sion.ch PDFs 2024-2025) */
function parkingCost(durationH: DurationH, day: DayType): number {
  if (day === 'friday' || day === 'saturday') return 0; // gratuit ven.17h → sam.24h
  if (durationH <= 1) return 0;                          // 1ère heure gratuite
  return (durationH - 1) * 3.0;                          // CHF 3/h (h2→h11)
}

function captivityRatio(o: Origin): number {
  return o.tpTimeMin / o.carTimeMin;
}

function captivityClass(ratio: number): CaptivityClass {
  if (ratio < 1.2) return 'competitive';
  if (ratio < 1.6) return 'moderate';
  return 'captive';
}

const CAPTIVITY_COLORS: Record<CaptivityClass, string> = {
  competitive: '#22c55e',
  moderate:    '#f59e0b',
  captive:     '#ef4444',
};

const CAPTIVITY_LABELS: Record<CaptivityClass, string> = {
  competitive: '🟢 TP compétitif',
  moderate:    '🟡 TP moyen',
  captive:     '🔴 Captif voiture',
};

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ODSimulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markersRef   = useRef<maplibregl.Marker[]>([]);
  const arcRef       = useRef<string[]>([]);

  const [origins,  setOrigins]  = useState<Origin[]>([]);
  const [parkings, setParkings] = useState<ParkingNode[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [selected,   setSelected]   = useState<Origin | null>(null);
  const [dest,       setDest]       = useState<Destination>('centre');
  const [duration,   setDuration]   = useState<DurationH>(2);
  const [day,        setDay]        = useState<DayType>('weekday');
  const [halfFare,   setHalfFare]   = useState(false);

  // ─── Fetch data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchData()
      .then((data: any) => {
        setOrigins(data.origins ?? []);
        setParkings(data.parking ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ─── Init MapLibre ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
        },
        center: [7.363, 46.232],
        zoom: 11,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => setMapReady(true));
      map.on('error', () => setMapError(true));

      mapRef.current = map;
    } catch {
      setMapError(true);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Markers ────────────────────────────────────────────────────────────────

  const addMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !origins.length) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Origin markers (colored circles)
    origins.forEach(origin => {
      const ratio = captivityRatio(origin);
      const cls   = captivityClass(ratio);
      const color = CAPTIVITY_COLORS[cls];

      const el = document.createElement('div');
      el.style.cssText = `
        width: 36px; height: 36px; border-radius: 50%;
        background: ${color}; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 14px; transition: transform 0.15s;
      `;
      el.textContent = origin.emoji;
      el.title = `${origin.label} — ratio TP/voiture: ${ratio.toFixed(2)}`;
      el.addEventListener('mouseover', () => { el.style.transform = 'scale(1.2)'; });
      el.addEventListener('mouseout',  () => { el.style.transform = selected?.id === origin.id ? 'scale(1.2)' : 'scale(1)'; });
      el.addEventListener('click',     () => setSelected(o => o?.id === origin.id ? null : origin));

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(origin.coords)
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Destination markers
    (['centre', 'gare', 'emploi'] as Destination[]).forEach(d => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 6px;
        background: #1e3a5f; border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; color: white; font-weight: 700; cursor: default;
      `;
      el.textContent = d === 'centre' ? '🏛' : d === 'gare' ? '🚉' : '🏭';
      new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(DEST_COORDS[d])
        .addTo(map);
    });

    // P+R markers
    Object.entries(PR_NODES).forEach(([id, pr]) => {
      const el = document.createElement('div');
      el.style.cssText = `
        padding: 3px 7px; border-radius: 12px;
        background: #16a34a; border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        font-size: 10px; font-weight: 700; color: white; cursor: default;
        white-space: nowrap;
      `;
      el.textContent = `P+R ${pr.cap}pl.`;
      el.title = pr.label;
      new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(pr.coords)
        .addTo(map);
    });

  }, [origins, selected?.id]);

  useEffect(() => {
    if (mapReady && origins.length) addMarkers();
  }, [mapReady, addMarkers]);

  // ─── Arc origine → destination ───────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove old arc layers
    arcRef.current.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    arcRef.current.forEach(id => {
      if (map.getSource(id)) map.removeSource(id);
    });
    arcRef.current = [];

    if (!selected) return;

    const destCoord = DEST_COORDS[dest];

    // Car arc (blue)
    const carId = 'arc-car';
    map.addSource(carId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [selected.coords, destCoord] },
        properties: {},
      },
    });
    map.addLayer({
      id: carId, type: 'line', source: carId,
      paint: { 'line-color': '#3b82f6', 'line-width': 2.5, 'line-opacity': 0.8 },
    });
    arcRef.current.push(carId, carId);

    // P+R arc (green dashed) if applicable
    if (selected.prPotential && selected.prId) {
      const pr = PR_NODES[selected.prId as keyof typeof PR_NODES];
      if (pr) {
        const prCarId  = 'arc-pr-car';
        const prBusId  = 'arc-pr-bus';
        map.addSource(prCarId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [selected.coords, pr.coords] }, properties: {} },
        });
        map.addLayer({
          id: prCarId, type: 'line', source: prCarId,
          paint: { 'line-color': '#16a34a', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [4, 3] },
        });
        map.addSource(prBusId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [pr.coords, destCoord] }, properties: {} },
        });
        map.addLayer({
          id: prBusId, type: 'line', source: prBusId,
          paint: { 'line-color': '#16a34a', 'line-width': 2.5, 'line-opacity': 0.9 },
        });
        arcRef.current.push(prCarId, prCarId, prBusId, prBusId);
      }
    }

    // Fit map to show origin + destination
    const bounds = new maplibregl.LngLatBounds(selected.coords, destCoord);
    map.fitBounds(bounds, { padding: 100, maxZoom: 13, duration: 600 });

  }, [selected, dest, mapReady]);

  // ─── Calcul coûts ────────────────────────────────────────────────────────────

  const costs = selected ? (() => {
    const VOT = 22; // CHF/h moyen
    const park = parkingCost(duration, day);
    const carKm = (selected.carTimeMin / 60) * 40 * 0.18; // ~40 km/h moyenne
    const carTime = (selected.carTimeMin / 60) * VOT;
    const carTotal = park + carTime + carKm + 1.2; // +friction recherche parking

    const freqMin = day === 'weekday' ? selected.tpFreqPeakMin : selected.tpFreqOffpeakMin;
    const tpTicket = selected.tpTicketCHF * (halfFare ? 0.5 : 1);
    const tpWait = (freqMin / 2 / 60) * VOT;
    const tpTime = (selected.tpTimeMin / 60) * VOT;
    const tpTotal = tpTicket + tpWait + tpTime;

    let prTotal: number | null = null;
    if (selected.prPotential && selected.prId) {
      const pr = PR_NODES[selected.prId as keyof typeof PR_NODES];
      if (pr) {
        const prDriveMin = selected.carTimeMin * 0.4;
        const prBusMin   = pr.busTimeToCentreMin ?? 11;
        const prTime = ((prDriveMin + prBusMin + 5) / 60) * VOT;
        const prKm   = (prDriveMin / 60) * 40 * 0.18;
        prTotal = 0 + 2.20 + prTime + prKm; // parking P+R gratuit + billet zone 1
      }
    }

    return { park, carKm, carTime, carTotal, tpTicket, tpWait, tpTime, tpTotal, prTotal };
  })() : null;

  const ratio  = selected ? captivityRatio(selected) : null;
  const cls    = ratio ? captivityClass(ratio) : null;

  // Sorted origins for list (captives first)
  const sortedOrigins = [...origins].sort((a, b) => captivityRatio(b) - captivityRatio(a));

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Carte ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {mapError ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: 16,
          }}>
            <span style={{ fontSize: 48 }}>⚠️</span>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Carte indisponible</div>
            <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 280 }}>
              Réseau filtré — utilisez le panneau de droite pour l'analyse.
            </div>
          </div>
        ) : (
          <div ref={containerRef} style={{ height: '100%' }} />
        )}

        {/* Légende flottante */}
        {!mapError && (
          <div style={{
            position: 'absolute', bottom: 32, left: 16, zIndex: 10,
            background: 'white', borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)', minWidth: 180,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Captivité voiture
            </div>
            {(['competitive', 'moderate', 'captive'] as CaptivityClass[]).map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: CAPTIVITY_COLORS[c] }} />
                <span style={{ color: '#374151' }}>{CAPTIVITY_LABELS[c]}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 3 }}>
                <div style={{ width: 20, height: 3, background: '#3b82f6', borderRadius: 2 }} />
                <span style={{ color: '#374151' }}>Trajet voiture</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{ width: 20, height: 3, background: '#16a34a', borderRadius: 2, borderTop: '1px dashed #16a34a' }} />
                <span style={{ color: '#374151' }}>Via P+R</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Panneau droit ── */}
      <div style={{
        width: 380, background: 'white', borderLeft: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
            Accessibilité depuis les communes
          </div>

          {/* Destination */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['centre', 'gare', 'emploi'] as Destination[]).map(d => (
              <button key={d} onClick={() => setDest(d)}
                style={{
                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: '1.5px solid',
                  borderColor: dest === d ? '#2563eb' : '#e5e7eb',
                  background: dest === d ? '#eff6ff' : 'white',
                  color: dest === d ? '#2563eb' : '#6b7280',
                }}>
                {d === 'centre' ? '🏛 Centre' : d === 'gare' ? '🚉 Gare' : '🏭 Emploi'}
              </button>
            ))}
          </div>

          {/* Durée + Jour */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>DURÉE</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([1, 2, 4] as DurationH[]).map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      borderColor: duration === d ? '#7c3aed' : '#e5e7eb',
                      background: duration === d ? '#f5f3ff' : 'white',
                      color: duration === d ? '#7c3aed' : '#6b7280',
                    }}>
                    {d}h
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>JOUR</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([['weekday','Lun-J'],['friday','Ven⚡'],['saturday','Sam⚡']] as [DayType,string][]).map(([d, l]) => (
                  <button key={d} onClick={() => setDay(d)}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      borderColor: day === d ? '#d97706' : '#e5e7eb',
                      background: day === d ? '#fffbeb' : 'white',
                      color: day === d ? '#d97706' : '#6b7280',
                    }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Demi-tarif */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
            <input type="checkbox" checked={halfFare} onChange={e => setHalfFare(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
            Demi-tarif CFF (abonnement)
          </label>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ─ Détail origine sélectionnée ─ */}
          {selected && costs && cls && ratio ? (
            <div style={{ padding: '16px 20px' }}>
              {/* Origin header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    {selected.emoji} {selected.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>→ {DEST_LABELS[dest]}</div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, padding: 4 }}>
                  ×
                </button>
              </div>

              {/* Captivity badge */}
              <div style={{
                padding: '8px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
                background: cls === 'competitive' ? '#f0fdf4' : cls === 'moderate' ? '#fffbeb' : '#fef2f2',
                color: cls === 'competitive' ? '#15803d' : cls === 'moderate' ? '#d97706' : '#dc2626',
                border: `1.5px solid ${CAPTIVITY_COLORS[cls]}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{CAPTIVITY_LABELS[cls]}</span>
                <span style={{ fontSize: 11, fontWeight: 400 }}>TP/voiture : ×{ratio.toFixed(2)}</span>
              </div>

              {/* Temps */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { label: '🚗 Voiture', value: `${selected.carTimeMin} min`, sub: selected.tpLine ? '' : '' },
                  { label: '🚌 TP direct', value: `${selected.tpTimeMin} min`, sub: selected.tpLine },
                ].map(item => (
                  <div key={item.label} style={{
                    flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{item.value}</div>
                    {item.sub && <div style={{ fontSize: 10, color: '#9ca3af' }}>{item.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Fréquence TP */}
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                🕐 {selected.tpLine} — toutes les <strong style={{ color: '#374151' }}>
                  {day === 'weekday' ? selected.tpFreqPeakMin : selected.tpFreqOffpeakMin} min
                </strong>
                {' · '}billet isireso zone {selected.tpZone === 99 ? 'CFF' : selected.tpZone} : <strong style={{ color: '#374151' }}>
                  CHF {(selected.tpTicketCHF * (halfFare ? 0.5 : 1)).toFixed(2)}
                </strong>
              </div>

              {/* Coûts */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Coût total estimé — {duration}h
                  {(day === 'friday' || day === 'saturday') && ' · parking gratuit'}
                </div>

                {/* Car */}
                <div style={{
                  borderRadius: 10, border: '1.5px solid #bfdbfe', background: '#eff6ff',
                  padding: '10px 14px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>🚗 Voiture</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>CHF {costs.carTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#3b82f6', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Parking: CHF {costs.park.toFixed(2)}</span>
                    <span>Temps: CHF {costs.carTime.toFixed(2)}</span>
                    <span>Distance: CHF {costs.carKm.toFixed(2)}</span>
                  </div>
                </div>

                {/* TP */}
                <div style={{
                  borderRadius: 10, border: '1.5px solid #bbf7d0', background: '#f0fdf4',
                  padding: '10px 14px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>🚌 TP direct</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>CHF {costs.tpTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Billet: CHF {costs.tpTicket.toFixed(2)}</span>
                    <span>Trajet: CHF {costs.tpTime.toFixed(2)}</span>
                    <span>Attente: CHF {costs.tpWait.toFixed(2)}</span>
                  </div>
                </div>

                {/* P+R */}
                {costs.prTotal !== null && selected.prNote && (
                  <div style={{
                    borderRadius: 10, border: '1.5px solid #a7f3d0', background: '#ecfdf5',
                    padding: '10px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>🅿️ Via P+R</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#065f46' }}>CHF {costs.prTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#047857' }}>{selected.prNote}</div>
                  </div>
                )}

                {/* Économie potentielle */}
                {costs.tpTotal < costs.carTotal && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 8,
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    fontSize: 12, color: '#15803d', fontWeight: 600,
                  }}>
                    💡 Économie si TP : CHF {(costs.carTotal - costs.tpTotal).toFixed(2)}/trajet
                    {' = '}CHF {((costs.carTotal - costs.tpTotal) * 220).toFixed(0)}/an (220 jours)
                  </div>
                )}
              </div>

              {/* Demande */}
              <div style={{ fontSize: 11, color: '#9ca3af', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                📊 Flux estimé vers {DEST_LABELS[dest]} :&nbsp;
                <strong style={{ color: '#374151' }}>
                  ~{selected.demand[dest].toLocaleString('fr-CH')} voyages/jour
                </strong>
                &nbsp;· Pop. commune : {selected.population.toLocaleString('fr-CH')}
              </div>
            </div>

          ) : (
            /* ─ Liste des origines ─ */
            <div style={{ padding: '12px 16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
                  Chargement des données…
                </div>
              ) : sortedOrigins.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
                  Données d'origine non disponibles.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, fontWeight: 600 }}>
                    CLASSEMENT PAR CAPTIVITÉ VOITURE (↑ le plus captif en premier)
                  </div>
                  {sortedOrigins.map(origin => {
                    const r   = captivityRatio(origin);
                    const c   = captivityClass(r);
                    const col = CAPTIVITY_COLORS[c];
                    return (
                      <button key={origin.id} onClick={() => setSelected(origin)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                          border: '1.5px solid #e5e7eb', background: 'white',
                          textAlign: 'left', transition: 'all 0.15s',
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = col; (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: col, flexShrink: 0 }} />
                        <span style={{ fontSize: 18 }}>{origin.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{origin.label}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>
                            🚗 {origin.carTimeMin} min · 🚌 {origin.tpTimeMin} min · {origin.tpLine}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: col }}>×{r.toFixed(2)}</div>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>ratio TP/car</div>
                        </div>
                        {origin.prPotential && (
                          <div style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>
                            P+R
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <div style={{ fontSize: 10, color: '#d1d5db', textAlign: 'center', marginTop: 8 }}>
                    Source: ARE Microrecensement 2015 · Estimation MobilityLab
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
