/**
 * ODSimulator.tsx — Outil décisionnel Origines → Destinations · Sion Mobility
 * Chemin final : apps/web/src/components/ODSimulator.tsx
 *
 * FIXES v7 (build-breaking errors corrigés):
 *  1. Ce fichier REMPLACE ODSimulator.jsx — TypeScript dans .jsx = refusé par tsc
 *     → Supprimer apps/web/src/components/ODSimulator.jsx du repo
 *  2. PR_NODES typé explicitement avec busTimeToCentreMin (était undefined → TS error)
 *  3. arcRef: sources et layers trackés séparément (nettoyage idempotent)
 *  4. fetchData() typé pour éviter implicit any
 *  5. ODPage.tsx: @ts-ignore supprimé (voir ODPage_fixed.tsx)
 *
 * AMÉLIORATIONS v7:
 *  - Arcs bezier courbes sur la carte
 *  - Barres de coût proportionnelles avec détail
 *  - Compteur captifs/compétitifs flottant
 *  - Filtre texte communes
 *  - Économies annuelles (A/R × 220 jours)
 *  - Hover effects sur la liste
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

interface CostBreakdown {
  park: number;
  carKm: number;
  carTime: number;
  carTotal: number;
  tpTicket: number;
  tpWait: number;
  tpTime: number;
  tpTotal: number;
  prTotal: number | null;
}

type DayType     = 'weekday' | 'friday' | 'saturday';
type DurationH   = 1 | 2 | 4;
type Destination = 'centre' | 'gare' | 'emploi';
type CaptivityCls = 'competitive' | 'moderate' | 'captive';

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

// FIX: PR_NODES entièrement typé — plus d'erreur "Property 'busTimeToCentreMin' does not exist"
const PR_NODES: Record<string, {
  label: string;
  coords: [number, number];
  cap: number;
  busTimeToCentreMin: number;  // ← était manquant dans la v6
  busLine: string;
}> = {
  potences: { label: 'P+R Potences', coords: [7.3318, 46.2282], cap: 450, busTimeToCentreMin: 12, busLine: 'BS 11' },
  stade:    { label: 'P+R Stade',    coords: [7.3888, 46.2282], cap: 460, busTimeToCentreMin: 10, busLine: 'BS 11' },
};

const CAPTIVITY_COLORS: Record<CaptivityCls, string> = {
  competitive: '#22c55e',
  moderate:    '#f59e0b',
  captive:     '#ef4444',
};

const CAPTIVITY_BG: Record<CaptivityCls, string> = {
  competitive: '#f0fdf4',
  moderate:    '#fffbeb',
  captive:     '#fef2f2',
};

const CAPTIVITY_TEXT: Record<CaptivityCls, string> = {
  competitive: '#15803d',
  moderate:    '#b45309',
  captive:     '#dc2626',
};

const CAPTIVITY_LABEL: Record<CaptivityCls, string> = {
  competitive: '🟢 TP compétitif',
  moderate:    '🟡 TP moyen',
  captive:     '🔴 Captif voiture',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Barème officiel Planta/Scex — sion.ch 2024-2025 */
function parkingCost(durationH: DurationH, day: DayType): number {
  if (day === 'friday' || day === 'saturday') return 0;  // gratuit ven.17h → sam.24h
  if (durationH <= 1) return 0;                           // 1ère heure gratuite
  return (durationH - 1) * 3.0;                           // CHF 3/h dès h2
}

function captivityRatio(o: Origin): number {
  return o.tpTimeMin / o.carTimeMin;
}

function captivityClass(ratio: number): CaptivityCls {
  if (ratio < 1.2) return 'competitive';
  if (ratio < 1.6) return 'moderate';
  return 'captive';
}

/** Arc bezier quadratique entre deux coordonnées (courbure latérale) */
function bezierArc(
  from: [number, number],
  to: [number, number],
  steps = 40,
): [number, number][] {
  const dx   = to[0] - from[0];
  const dy   = to[1] - from[1];
  const cx   = (from[0] + to[0]) / 2 - dy * 0.25;
  const cy   = (from[1] + to[1]) / 2 + dx * 0.25;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * cx + t * t * to[0],
      (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * cy + t * t * to[1],
    ]);
  }
  return pts;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ODSimulator() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const markersRef    = useRef<maplibregl.Marker[]>([]);
  // FIX: sources et layers trackés séparément pour nettoyage propre
  const arcSrcsRef    = useRef<string[]>([]);
  const arcLyrsRef    = useRef<string[]>([]);

  const [origins,  setOrigins]  = useState<Origin[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [search,   setSearch]   = useState('');

  const [selected, setSelected] = useState<Origin | null>(null);
  const [dest,     setDest]     = useState<Destination>('centre');
  const [duration, setDuration] = useState<DurationH>(2);
  const [day,      setDay]      = useState<DayType>('weekday');
  const [halfFare, setHalfFare] = useState(false);

  // ─── Fetch data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchData()
      .then((data: { origins?: Origin[] }) => {
        setOrigins(data.origins ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ─── Init MapLibre (npm, sans CDN bloqué) ───────────────────────────────────

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
        zoom: 10.5,
        attributionControl: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.on('load',  () => setMapReady(true));
      map.on('error', () => setMapError(true));
      mapRef.current = map;
    } catch {
      setMapError(true);
    }
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // ─── Marqueurs ──────────────────────────────────────────────────────────────

  const addMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !origins.length) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Origines (cercles colorés par captivité)
    origins.forEach(origin => {
      const ratio = captivityRatio(origin);
      const cls   = captivityClass(ratio);
      const color = CAPTIVITY_COLORS[cls];
      const isSel = selected?.id === origin.id;

      const el = document.createElement('div');
      el.style.cssText = `
        width:38px;height:38px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        font-size:15px;transition:transform .15s,box-shadow .15s;
        transform:${isSel ? 'scale(1.3)' : 'scale(1)'};
      `;
      el.textContent = origin.emoji;
      el.title = `${origin.label} — ×${ratio.toFixed(2)}`;
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.25)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = isSel ? 'scale(1.3)' : 'scale(1)'; });
      el.addEventListener('click', () => setSelected(o => o?.id === origin.id ? null : origin));
      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(origin.coords).addTo(map)
      );
    });

    // Destinations
    (['centre', 'gare', 'emploi'] as Destination[]).forEach(d => {
      const el = document.createElement('div');
      el.style.cssText = `
        width:34px;height:34px;border-radius:8px;
        background:#1e3a5f;border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;font-size:16px;
      `;
      el.textContent = d === 'centre' ? '🏛' : d === 'gare' ? '🚉' : '🏭';
      el.title = DEST_LABELS[d];
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(DEST_COORDS[d]).addTo(map);
    });

    // P+R
    Object.values(PR_NODES).forEach(pr => {
      const el = document.createElement('div');
      el.style.cssText = `
        padding:3px 8px;border-radius:12px;
        background:#16a34a;border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.3);
        font-size:10px;font-weight:700;color:white;white-space:nowrap;
      `;
      el.textContent = `P+R ${pr.cap}pl.`;
      el.title = pr.label;
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(pr.coords).addTo(map);
    });
  }, [origins, selected?.id]);

  useEffect(() => { if (mapReady && origins.length) addMarkers(); }, [mapReady, addMarkers]);

  // ─── Arcs courbes (bezier) ──────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // FIX: nettoyage séparé layers puis sources (ordre obligatoire pour MapLibre)
    arcLyrsRef.current.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
    arcSrcsRef.current.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
    arcLyrsRef.current = [];
    arcSrcsRef.current = [];

    if (!selected) return;
    const dCoord = DEST_COORDS[dest];

    const addArc = (
      srcId: string, lyrId: string,
      from: [number, number], to: [number, number],
      paint: maplibregl.LinePaint,
    ) => {
      map.addSource(srcId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: bezierArc(from, to) }, properties: {} },
      });
      map.addLayer({ id: lyrId, type: 'line', source: srcId, paint });
      arcSrcsRef.current.push(srcId);
      arcLyrsRef.current.push(lyrId);
    };

    // Arc voiture (bleu)
    addArc('src-car', 'lyr-car', selected.coords, dCoord,
      { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.85 });

    // Arc P+R (vert pointillé → plein)
    if (selected.prPotential && selected.prId) {
      const pr = PR_NODES[selected.prId];
      if (pr) {
        addArc('src-pr1', 'lyr-pr1', selected.coords, pr.coords,
          { 'line-color': '#16a34a', 'line-width': 2.5, 'line-opacity': 0.8, 'line-dasharray': [5, 3] });
        addArc('src-pr2', 'lyr-pr2', pr.coords, dCoord,
          { 'line-color': '#16a34a', 'line-width': 3, 'line-opacity': 0.9 });
      }
    }

    map.fitBounds(
      new maplibregl.LngLatBounds(selected.coords, dCoord),
      { padding: 110, maxZoom: 13, duration: 700 },
    );
  }, [selected, dest, mapReady]);

  // ─── Calcul des coûts ────────────────────────────────────────────────────────

  const costs: CostBreakdown | null = selected ? (() => {
    const VOT  = 22;  // CHF/h valeur du temps
    const park = parkingCost(duration, day);
    const carKm   = (selected.carTimeMin / 60) * 40 * 0.18;
    const carTime = (selected.carTimeMin / 60) * VOT;
    const carTotal = park + carTime + carKm + 1.2;

    const freqMin  = day === 'weekday' ? selected.tpFreqPeakMin : selected.tpFreqOffpeakMin;
    const tpTicket = selected.tpTicketCHF * (halfFare ? 0.5 : 1);
    const tpWait   = (freqMin / 2 / 60) * VOT;
    const tpTime   = (selected.tpTimeMin / 60) * VOT;
    const tpTotal  = tpTicket + tpWait + tpTime;

    let prTotal: number | null = null;
    if (selected.prPotential && selected.prId) {
      const pr = PR_NODES[selected.prId];
      // FIX: pr.busTimeToCentreMin existe maintenant dans le type PR_NODES
      if (pr) {
        const prDriveMin = selected.carTimeMin * 0.4;
        const prTime = ((prDriveMin + pr.busTimeToCentreMin + 5) / 60) * VOT;
        const prKm   = (prDriveMin / 60) * 40 * 0.18;
        prTotal = 2.20 + prTime + prKm;
      }
    }
    return { park, carKm, carTime, carTotal, tpTicket, tpWait, tpTime, tpTotal, prTotal };
  })() : null;

  const ratio = selected ? captivityRatio(selected) : null;
  const cls   = ratio != null ? captivityClass(ratio) : null;

  const filteredOrigins = [...origins]
    .filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => captivityRatio(b) - captivityRatio(a));

  // ─── Style helpers ───────────────────────────────────────────────────────────

  const tabBtn = (active: boolean, activeColor: string): React.CSSProperties => ({
    flex: 1, padding: '5px 3px', borderRadius: 7, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', border: '1.5px solid',
    borderColor: active ? activeColor : '#e5e7eb',
    background: active ? `${activeColor}18` : 'white',
    color: active ? activeColor : '#6b7280',
    transition: 'all 0.15s',
  });

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: "'DM Sans','Inter',sans-serif" }}>

      {/* ────── CARTE ────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {mapError ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', gap: 16,
          }}>
            <div style={{ fontSize: 48 }}>🗺️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>Carte indisponible</div>
            <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
              Réseau filtré · utilisez le panneau<br/>de droite pour l'analyse de captivité
            </div>
          </div>
        ) : (
          <div ref={containerRef} style={{ height: '100%' }} />
        )}

        {/* Compteur flottant */}
        {!mapError && origins.length > 0 && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            background: 'rgba(255,255,255,.95)', borderRadius: 12, padding: '8px 14px',
            boxShadow: '0 2px 12px rgba(0,0,0,.1)', display: 'flex', gap: 16,
          }}>
            {(['captive', 'moderate', 'competitive'] as CaptivityCls[]).map(c => (
              <div key={c} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: CAPTIVITY_COLORS[c] }}>
                  {origins.filter(o => captivityClass(captivityRatio(o)) === c).length}
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                  {c === 'captive' ? 'Captifs' : c === 'moderate' ? 'Moyens' : 'OK TP'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Légende */}
        {!mapError && (
          <div style={{
            position: 'absolute', bottom: 36, left: 12, zIndex: 10,
            background: 'rgba(255,255,255,.95)', borderRadius: 14, padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,.1)', minWidth: 175,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Captivité voiture
            </div>
            {(['competitive', 'moderate', 'captive'] as CaptivityCls[]).map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAPTIVITY_COLORS[c], flexShrink: 0 }} />
                <span style={{ color: '#374151', fontWeight: 500 }}>{CAPTIVITY_LABEL[c]}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 4 }}>
                <div style={{ width: 20, height: 3, background: '#3b82f6', borderRadius: 2 }} />
                <span style={{ color: '#374151' }}>Voiture</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <div style={{ width: 20, height: 0, border: '2px dashed #16a34a' }} />
                <span style={{ color: '#374151' }}>Via P+R</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ────── PANNEAU DROIT ────── */}
      <div style={{
        width: 390, background: 'white', borderLeft: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '-4px 0 24px rgba(0,0,0,.04)',
      }}>

        {/* Contrôles */}
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12, letterSpacing: '-.01em' }}>
            Accessibilité depuis les communes
          </div>

          <div style={{ marginBottom: 10 }}>
            <Label>Destination</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['centre', 'gare', 'emploi'] as Destination[]).map(d => (
                <button key={d} onClick={() => setDest(d)} style={tabBtn(dest === d, '#2563eb')}>
                  {d === 'centre' ? '🏛 Centre' : d === 'gare' ? '🚉 Gare' : '🏭 Emploi'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <Label>Durée</Label>
              <div style={{ display: 'flex', gap: 4 }}>
                {([1, 2, 4] as DurationH[]).map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={tabBtn(duration === d, '#7c3aed')}>{d}h</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1.6 }}>
              <Label>Jour</Label>
              <div style={{ display: 'flex', gap: 4 }}>
                {([['weekday','Lun–J'],['friday','Ven ⚡'],['saturday','Sam ⚡']] as [DayType,string][]).map(([d,l]) => (
                  <button key={d} onClick={() => setDay(d)} style={tabBtn(day === d, '#d97706')}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
            <input type="checkbox" checked={halfFare} onChange={e => setHalfFare(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#2563eb' }} />
            <span>Demi-tarif CFF</span>
            {(day === 'friday' || day === 'saturday') && (
              <span style={{ marginLeft: 'auto', fontSize: 10, background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                Parking gratuit ⚡
              </span>
            )}
          </label>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {selected && costs && cls && ratio != null ? (
            /* ── Détail commune sélectionnée ── */
            <div style={{ padding: '16px 18px' }}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', letterSpacing: '-.01em' }}>
                    {selected.emoji} {selected.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    → {DEST_LABELS[dest]} · {selected.population.toLocaleString('fr-CH')} hab.
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#6b7280', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>
                  ✕
                </button>
              </div>

              {/* Badge captivité */}
              <div style={{
                padding: '10px 14px', borderRadius: 12, marginBottom: 14,
                background: CAPTIVITY_BG[cls], border: `1.5px solid ${CAPTIVITY_COLORS[cls]}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: CAPTIVITY_TEXT[cls] }}>
                  {CAPTIVITY_LABEL[cls]}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: CAPTIVITY_COLORS[cls], lineHeight: 1 }}>
                    ×{ratio.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 9, color: CAPTIVITY_TEXT[cls], opacity: 0.7, marginTop: 1 }}>TP / voiture</div>
                </div>
              </div>

              {/* Temps côte à côte */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { icon: '🚗', label: 'Voiture', min: selected.carTimeMin, color: '#3b82f6', bg: '#eff6ff' },
                  { icon: '🚌', label: selected.tpLine, min: selected.tpTimeMin, color: '#16a34a', bg: '#f0fdf4' },
                ].map(it => (
                  <div key={it.label} style={{
                    flex: 1, background: it.bg, borderRadius: 12, padding: '10px 0', textAlign: 'center',
                    border: `1px solid ${it.color}20`,
                  }}>
                    <div style={{ fontSize: 11, color: it.color, fontWeight: 600, marginBottom: 3 }}>{it.icon} {it.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: it.color, lineHeight: 1 }}>{it.min}</div>
                    <div style={{ fontSize: 10, color: it.color, opacity: 0.7, marginTop: 2 }}>min</div>
                  </div>
                ))}
              </div>

              {/* Fréquence */}
              <div style={{
                fontSize: 12, color: '#374151', marginBottom: 14,
                padding: '8px 12px', background: '#f8fafc', borderRadius: 8,
              }}>
                🕐 <strong>{selected.tpLine}</strong> — toutes les{' '}
                <strong>{day === 'weekday' ? selected.tpFreqPeakMin : selected.tpFreqOffpeakMin} min</strong>
                {' · '}zone {selected.tpZone === 99 ? 'CFF' : selected.tpZone} :
                <strong> CHF {(selected.tpTicketCHF * (halfFare ? 0.5 : 1)).toFixed(2)}</strong>
              </div>

              {/* Coûts avec barres */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Coût généralisé — {duration}h
                  {(day === 'friday' || day === 'saturday') && <span style={{ color: '#d97706' }}> · parking gratuit</span>}
                </div>

                <CostBar icon="🚗" label="Voiture" total={costs.carTotal}
                  maxVal={Math.max(costs.carTotal, costs.tpTotal)} color="#3b82f6" bg="#eff6ff" border="#bfdbfe"
                  items={[
                    { label: 'Parking', val: costs.park },
                    { label: 'Temps', val: costs.carTime },
                    { label: 'Distance', val: costs.carKm },
                    { label: 'Friction', val: 1.2 },
                  ]} />

                <CostBar icon="🚌" label="TP direct" total={costs.tpTotal}
                  maxVal={Math.max(costs.carTotal, costs.tpTotal)} color="#16a34a" bg="#f0fdf4" border="#bbf7d0"
                  items={[
                    { label: 'Billet', val: costs.tpTicket },
                    { label: 'Trajet', val: costs.tpTime },
                    { label: 'Attente', val: costs.tpWait },
                  ]} />

                {costs.prTotal != null && selected.prNote && (
                  <CostBar icon="🅿️" label="Via P+R" total={costs.prTotal}
                    maxVal={Math.max(costs.carTotal, costs.tpTotal)} color="#065f46" bg="#ecfdf5" border="#a7f3d0"
                    note={selected.prNote}
                    items={[
                      { label: 'Billet BS 11', val: 2.20 },
                      { label: 'Temps total', val: costs.prTotal - 2.20 - (selected.carTimeMin * 0.4 / 60) * 40 * 0.18 },
                      { label: 'km P+R', val: (selected.carTimeMin * 0.4 / 60) * 40 * 0.18 },
                    ]} />
                )}
              </div>

              {/* Économies annuelles */}
              {costs.tpTotal < costs.carTotal && (
                <div style={{
                  padding: '12px 14px', borderRadius: 12, marginBottom: 14,
                  background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
                  border: '1.5px solid #86efac',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
                    💡 Économie potentielle vs voiture
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d' }}>
                        CHF {(costs.carTotal - costs.tpTotal).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: '#16a34a' }}>par trajet</div>
                    </div>
                    <div style={{ width: 1, background: '#86efac', alignSelf: 'stretch' }} />
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d' }}>
                        CHF {((costs.carTotal - costs.tpTotal) * 2 * 220).toFixed(0)}
                      </div>
                      <div style={{ fontSize: 10, color: '#16a34a' }}>par an (A/R × 220 jours)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Flux */}
              <div style={{
                padding: '10px 14px', background: '#f8fafc', borderRadius: 10,
                display: 'flex', gap: 14, alignItems: 'center', fontSize: 12,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
                    ~{selected.demand[dest].toLocaleString('fr-CH')}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>voyages/jour</div>
                </div>
                <div style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch' }} />
                <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
                  📊 Flux vers {DEST_LABELS[dest]}<br/>
                  ARE Microrecensement 2015 · MobilityLab
                </div>
              </div>
            </div>

          ) : (
            /* ── Liste des communes ── */
            <div style={{ padding: '12px 16px' }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Filtrer par commune…"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
                  border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151',
                  outline: 'none', boxSizing: 'border-box', marginBottom: 12,
                }}
              />

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>Chargement…
                </div>
              ) : filteredOrigins.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af', fontSize: 12 }}>
                  Aucune commune trouvée.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {filteredOrigins.length} communes · captifs en premier
                  </div>
                  {filteredOrigins.map(origin => {
                    const r   = captivityRatio(origin);
                    const c   = captivityClass(r);
                    const col = CAPTIVITY_COLORS[c];
                    return (
                      <button key={origin.id} onClick={() => setSelected(origin)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', borderRadius: 10, marginBottom: 5,
                          border: '1.5px solid #e5e7eb', background: 'white',
                          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                        }}
                        onMouseEnter={e => {
                          const t = e.currentTarget as HTMLButtonElement;
                          t.style.borderColor = col; t.style.background = CAPTIVITY_BG[c]; t.style.transform = 'translateX(2px)';
                        }}
                        onMouseLeave={e => {
                          const t = e.currentTarget as HTMLButtonElement;
                          t.style.borderColor = '#e5e7eb'; t.style.background = 'white'; t.style.transform = 'translateX(0)';
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                        <span style={{ fontSize: 17 }}>{origin.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{origin.label}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                            🚗 {origin.carTimeMin} min · 🚌 {origin.tpTimeMin} min · {origin.tpLine}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: col }}>×{r.toFixed(2)}</div>
                          <div style={{ fontSize: 9, color: '#c4b5fd' }}>ratio</div>
                        </div>
                        {origin.prPotential && (
                          <div style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 8, fontWeight: 800, flexShrink: 0 }}>
                            P+R
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <div style={{ fontSize: 10, color: '#e5e7eb', textAlign: 'center', marginTop: 8 }}>
                    ↑ Cliquez pour l'analyse détaillée
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

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {children}
    </div>
  );
}

interface CostBarProps {
  icon: string;
  label: string;
  total: number;
  maxVal: number;
  color: string;
  bg: string;
  border: string;
  note?: string;
  items: { label: string; val: number }[];
}

function CostBar({ icon, label, total, maxVal, color, bg, border, note, items }: CostBarProps) {
  const pct = Math.min((total / (maxVal * 1.1)) * 100, 100);
  return (
    <div style={{ borderRadius: 12, border: `1.5px solid ${border}`, background: bg, padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{icon} {label}</span>
        <span style={{ fontSize: 18, fontWeight: 900, color }}>CHF {total.toFixed(2)}</span>
      </div>
      {/* Barre proportionnelle */}
      <div style={{ height: 5, background: `${color}20`, borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {items.filter(i => i.val > 0.005).map(i => (
          <span key={i.label} style={{ fontSize: 10, color, opacity: 0.85 }}>
            {i.label}: CHF {i.val.toFixed(2)}
          </span>
        ))}
      </div>
      {note && <div style={{ fontSize: 10, color, opacity: 0.7, marginTop: 4 }}>{note}</div>}
    </div>
  );
}
