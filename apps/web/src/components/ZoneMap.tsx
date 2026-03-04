/**
 * ZoneMap.tsx — Carte parkings & zones · Sion Mobility
 * VERSION DÉFINITIVE
 *
 * Chemin : apps/web/src/components/ZoneMap.tsx
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { ZoneResult, Scenario } from '../types';

interface ZoneMapProps {
  zoneResults?: ZoneResult[];
  height?: string;
  className?: string;
  scenario?: Scenario;
  dayType?: string;
}

// ─── Zones réelles de Sion ────────────────────────────────────────────────────

const ZONES = [
  {
    id: 'centre',
    label: 'Centre-ville',
    description: 'Noyau historique · Planta + Scex + Cible · 1424 places',
    color: '#ef4444',
    coords: [[
      [7.3520, 46.2300], [7.3530, 46.2285], [7.3560, 46.2275],
      [7.3630, 46.2278], [7.3680, 46.2285], [7.3690, 46.2305],
      [7.3680, 46.2345], [7.3650, 46.2360], [7.3600, 46.2365],
      [7.3555, 46.2360], [7.3520, 46.2340], [7.3510, 46.2320],
      [7.3520, 46.2300],
    ]],
  },
  {
    id: 'gare',
    label: 'Gare CFF',
    description: 'Pôle multimodal · Parking Gare ~300 pl.',
    color: '#f97316',
    coords: [[
      [7.3480, 46.2255], [7.3520, 46.2250], [7.3570, 46.2255],
      [7.3590, 46.2270], [7.3570, 46.2285], [7.3520, 46.2290],
      [7.3480, 46.2280], [7.3465, 46.2268], [7.3480, 46.2255],
    ]],
  },
  {
    id: 'nord',
    label: 'Quartiers Nord',
    description: 'Parking Nord 282 pl. · Zone résidentielle',
    color: '#3b82f6',
    coords: [[
      [7.3520, 46.2365], [7.3600, 46.2365], [7.3680, 46.2360],
      [7.3720, 46.2380], [7.3700, 46.2430], [7.3640, 46.2450],
      [7.3560, 46.2455], [7.3490, 46.2420], [7.3480, 46.2380],
      [7.3500, 46.2365], [7.3520, 46.2365],
    ]],
  },
  {
    id: 'est',
    label: 'Sion-Est',
    description: 'Roches-Brunes 300 pl. · Zone résidentielle Est',
    color: '#eab308',
    coords: [[
      [7.3690, 46.2285], [7.3750, 46.2280], [7.3820, 46.2285],
      [7.3860, 46.2310], [7.3840, 46.2360], [7.3780, 46.2380],
      [7.3700, 46.2375], [7.3680, 46.2345], [7.3690, 46.2305],
      [7.3690, 46.2285],
    ]],
  },
  {
    id: 'emploi',
    label: 'Zone Industrielle',
    description: 'Ronquoz · CERM · HES-SO · ~1200 pl. privées gratuites',
    color: '#ec4899',
    coords: [[
      [7.3280, 46.2170], [7.3380, 46.2165], [7.3500, 46.2170],
      [7.3530, 46.2195], [7.3520, 46.2225], [7.3460, 46.2240],
      [7.3380, 46.2245], [7.3300, 46.2235], [7.3265, 46.2215],
      [7.3280, 46.2170],
    ]],
  },
  {
    id: 'peripherie',
    label: 'P+R Périphérie',
    description: 'P+R Potences 450 pl. + P+R Stade 460 pl. — gratuits, BS11',
    color: '#14b8a6',
    coords: [[
      [7.3180, 46.2200], [7.3330, 46.2200], [7.3340, 46.2260],
      [7.3320, 46.2300], [7.3290, 46.2320], [7.3200, 46.2310],
      [7.3170, 46.2260], [7.3180, 46.2200],
    ]],
  },
] as const;

// ─── Parkings officiels Sion ──────────────────────────────────────────────────

type ParkingType = 'centre' | 'gare' | 'pericentre' | 'pr';

interface Parking {
  id: string;
  name: string;
  shortName: string;
  coords: [number, number];
  capacity: number;
  priceCHFh: number;
  priceNote: string;
  freeNote: string;
  walkMin: number;
  type: ParkingType;
  source: string;
}

const PARKINGS: Parking[] = [
  {
    id: 'planta', name: 'Parking de la Planta', shortName: 'Planta',
    coords: [7.3598, 46.2325], capacity: 562, priceCHFh: 3.0,
    priceNote: '1ère heure gratuite · CHF 3/h dès h2',
    freeNote: 'Gratuit ven. 17h → sam. 24h',
    walkMin: 3, type: 'centre', source: 'sion.ch PDF 15.07.2024',
  },
  {
    id: 'scex', name: 'Parking du Scex', shortName: 'Scex',
    coords: [7.3628, 46.2298], capacity: 658, priceCHFh: 3.0,
    priceNote: '1ère heure gratuite · CHF 3/h dès h2',
    freeNote: 'Gratuit ven. 17h → sam. 24h',
    walkMin: 4, type: 'centre', source: 'sion.ch PDF 11.08.2025',
  },
  {
    id: 'cible', name: 'Parking de la Cible', shortName: 'Cible',
    coords: [7.3562, 46.2342], capacity: 204, priceCHFh: 3.0,
    priceNote: '~CHF 3/h (estimé par analogie)',
    freeNote: 'Gratuit ven. 17h → sam. 24h (présumé)',
    walkMin: 5, type: 'centre', source: 'sion.ch estimé · conf. 0.70',
  },
  {
    id: 'gare', name: 'Parking Gare CFF', shortName: 'Gare',
    coords: [7.3521, 46.2278], capacity: 300, priceCHFh: 2.0,
    priceNote: '~CHF 2/h (tarif estimé)',
    freeNote: 'Gratuit samedi (présumé)',
    walkMin: 10, type: 'gare', source: 'CFF · sion.ch estimé',
  },
  {
    id: 'nord', name: 'Parking Nord', shortName: 'Nord',
    coords: [7.3572, 46.2420], capacity: 282, priceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (tarif préférentiel estimé)',
    freeNote: '', walkMin: 15, type: 'pericentre',
    source: 'sion.ch carte mobilité · conf. 0.60',
  },
  {
    id: 'roches', name: 'Parking Roches-Brunes', shortName: 'Roches',
    coords: [7.3745, 46.2318], capacity: 300, priceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (tarif préférentiel estimé)',
    freeNote: '', walkMin: 20, type: 'pericentre',
    source: 'sion.ch carte mobilité · conf. 0.60',
  },
  {
    id: 'pr-potences', name: 'P+R Potences', shortName: 'P+R Potences',
    coords: [7.3240, 46.2268], capacity: 450, priceCHFh: 0,
    priceNote: 'GRATUIT',
    freeNote: 'BS 11 → centre toutes les 10 min',
    walkMin: 0, type: 'pr', source: 'sion.ch · CarPostal 2025 · conf. 0.95',
  },
  {
    id: 'pr-stade', name: 'P+R Stade / Échutes', shortName: 'P+R Stade',
    coords: [7.3840, 46.2330], capacity: 460, priceCHFh: 0,
    priceNote: 'GRATUIT',
    freeNote: 'BS 11 → centre toutes les 10 min',
    walkMin: 0, type: 'pr', source: 'sion.ch · CarPostal 2025 · conf. 0.95',
  },
];

const MARKER_BG: Record<ParkingType, string> = {
  centre:     '#2563eb',
  gare:       '#f97316',
  pericentre: '#6366f1',
  pr:         '#16a34a',
};

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ZoneMap({
  zoneResults,
  height = '100%',
  className = '',
  scenario,
  dayType,
}: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markersRef   = useRef<maplibregl.Marker[]>([]);
  const [mapReady,     setMapReady]     = useState(false);
  const [showParkings, setShowParkings] = useState(true);

  // ── Init carte ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [7.355, 46.231],
      zoom: 12.8,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Zones ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Nettoyage
    ZONES.forEach(z => {
      ['fill', 'outline', 'label'].forEach(t => {
        if (map.getLayer(`z-${t}-${z.id}`)) map.removeLayer(`z-${t}-${z.id}`);
      });
      if (map.getSource(`z-${z.id}`))     map.removeSource(`z-${z.id}`);
      if (map.getSource(`z-lbl-${z.id}`)) map.removeSource(`z-lbl-${z.id}`);
    });

    const isWeekend = dayType === 'friday' || dayType === 'saturday';
    const centrePrice = scenario?.centrePeakPriceCHFh ?? 3.0;

    ZONES.forEach(z => {
      const res = zoneResults?.find(r => r.zoneId === z.id);
      const cat = res?.category;
      const fillColor = cat === 'vert' ? '#22c55e'
        : cat === 'orange' ? '#f59e0b'
        : cat === 'rouge'  ? '#ef4444'
        : z.color;

      // Source polygone
      map.addSource(`z-${z.id}`, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { zoneId: z.id, label: z.label },
          geometry: { type: 'Polygon', coordinates: z.coords as unknown as [number, number][][] },
        },
      });

      map.addLayer({
        id: `z-fill-${z.id}`, type: 'fill', source: `z-${z.id}`,
        paint: { 'fill-color': fillColor, 'fill-opacity': res ? 0.28 : 0.10 },
      });
      map.addLayer({
        id: `z-outline-${z.id}`, type: 'line', source: `z-${z.id}`,
        paint: { 'line-color': z.color, 'line-width': 1.8, 'line-opacity': 0.75 },
      });

      // Centroïd pour le label
      const pts = (z.coords[0] as unknown as [number, number][]).slice(0, -1);
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const labelText = res
        ? `${z.label}\n${Math.round(res.shiftIndex * 100)}%`
        : z.label;

      map.addSource(`z-lbl-${z.id}`, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { text: labelText },
          geometry: { type: 'Point', coordinates: [cx, cy] },
        },
      });
      map.addLayer({
        id: `z-label-${z.id}`, type: 'symbol', source: `z-lbl-${z.id}`,
        layout: {
          'text-field': ['get', 'text'],
          'text-size': 10,
          'text-font': ['Open Sans Regular'],
          'text-anchor': 'center',
          'text-line-height': 1.3,
        },
        paint: { 'text-color': '#1e1e2e', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });

      // Popup au clic sur la zone
      map.on('click', `z-fill-${z.id}`, e => {
        new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:'DM Sans',sans-serif;padding:4px 0">
              <div style="font-weight:800;font-size:14px;color:#111827;margin-bottom:3px">${z.label}</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:10px;line-height:1.4">${z.description}</div>
              ${res ? `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                  <div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center">
                    <div style="font-weight:800;font-size:20px;color:${cat === 'vert' ? '#22c55e' : cat === 'orange' ? '#f59e0b' : '#ef4444'}">${res.elasticityScore}</div>
                    <div style="color:#9ca3af;font-size:9px;margin-top:2px">Élasticité /100</div>
                  </div>
                  <div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center">
                    <div style="font-weight:800;font-size:20px;color:#111827">${Math.round(res.shiftIndex * 100)}%</div>
                    <div style="color:#9ca3af;font-size:9px;margin-top:2px">Report modal</div>
                  </div>
                  ${res.occupancyPct !== undefined ? `
                  <div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center">
                    <div style="font-weight:800;font-size:20px;color:${(res.occupancyPct ?? 0) > 85 ? '#ef4444' : '#111827'}">${res.occupancyPct}%</div>
                    <div style="color:#9ca3af;font-size:9px;margin-top:2px">Occupation</div>
                  </div>` : ''}
                  ${res.avgParkingCostCHF !== undefined ? `
                  <div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center">
                    <div style="font-weight:800;font-size:20px;color:#111827">${res.avgParkingCostCHF} CHF</div>
                    <div style="color:#9ca3af;font-size:9px;margin-top:2px">Coût moyen</div>
                  </div>` : ''}
                </div>
                ${res.equityFlag ? `<div style="margin-top:7px;font-size:10px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:6px">⚠ ${res.equityReason ?? 'Risque équité détecté'}</div>` : ''}
              ` : `<div style="font-size:11px;color:#9ca3af;font-style:italic">Simulez un scénario pour voir les résultats.</div>`}
              ${z.id === 'centre' ? `
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:10px;color:#374151">
                  💰 Tarif actuel : <strong>${isWeekend ? 'GRATUIT ⚡' : `CHF ${centrePrice.toFixed(1)}/h`}</strong>
                </div>` : ''}
            </div>
          `).addTo(map);
      });
      map.on('mouseenter', `z-fill-${z.id}`, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', `z-fill-${z.id}`, () => { map.getCanvas().style.cursor = ''; });
    });
  }, [mapReady, zoneResults, dayType, scenario?.centrePeakPriceCHFh]);

  // ── Marqueurs parkings ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (!showParkings) return;

    const isWeekend = dayType === 'friday' || dayType === 'saturday';
    const centrePrice = scenario?.centrePeakPriceCHFh ?? 3.0;

    PARKINGS.forEach(pk => {
      const effectivePrice = (isWeekend && pk.type === 'centre') ? 0 : pk.priceCHFh;
      const priceDisplay   = effectivePrice === 0 ? 'GRATUIT' : `CHF ${effectivePrice.toFixed(1)}/h`;
      const bgColor = pk.type === 'pr'
        ? '#16a34a'
        : effectivePrice === 0
          ? '#22c55e'
          : pk.type === 'centre' && centrePrice > 3.5
            ? '#dc2626'
            : MARKER_BG[pk.type];

      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
      el.innerHTML = `
        <div style="background:${bgColor};color:#fff;font-weight:800;font-size:10px;
          min-width:28px;height:28px;border-radius:8px;display:flex;align-items:center;
          justify-content:center;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);
          padding:0 6px;white-space:nowrap;gap:3px;">
          <span>🅿</span><span>${pk.shortName}</span>
        </div>
        <div style="width:2px;height:5px;background:${bgColor};"></div>
      `;

      const popup = new maplibregl.Popup({ offset: 30, maxWidth: '240px', closeButton: true })
        .setHTML(`
          <div style="font-family:'DM Sans',sans-serif;padding:3px 0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
              <div style="width:10px;height:10px;border-radius:3px;background:${bgColor};flex-shrink:0"></div>
              <div style="font-weight:800;font-size:13px;color:#111827">${pk.name}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px">
              <div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center">
                <div style="font-weight:800;font-size:20px;color:#111827">${pk.capacity}</div>
                <div style="color:#9ca3af;font-size:9px;margin-top:1px">places</div>
              </div>
              <div style="background:${pk.priceCHFh === 0 ? '#f0fdf4' : '#eff6ff'};border-radius:8px;padding:7px;text-align:center">
                <div style="font-weight:800;font-size:${effectivePrice === 0 ? '12' : '17'}px;color:${effectivePrice === 0 ? '#16a34a' : '#2563eb'};line-height:1.2">
                  ${isWeekend && pk.type === 'centre' ? '<span style="color:#d97706;font-size:12px">GRATUIT ⚡</span>' : priceDisplay}
                </div>
                <div style="color:#9ca3af;font-size:9px;margin-top:1px">tarif pointe</div>
              </div>
            </div>
            <div style="font-size:10px;color:#374151;margin-bottom:4px">📋 ${pk.priceNote}</div>
            ${pk.freeNote ? `<div style="font-size:10px;background:#f0fdf4;color:#15803d;padding:4px 8px;border-radius:6px;margin-bottom:4px">✓ ${pk.freeNote}</div>` : ''}
            ${pk.walkMin > 0 ? `<div style="font-size:10px;color:#6b7280;margin-bottom:4px">🚶 ${pk.walkMin} min à pied du centre</div>` : ''}
            <div style="font-size:9px;color:#d1d5db;border-top:1px solid #f1f5f9;padding-top:4px;margin-top:4px">
              Source: ${pk.source}
            </div>
          </div>
        `);

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(pk.coords)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [mapReady, showParkings, dayType, scenario?.centrePeakPriceCHFh]);

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className={`relative flex flex-col ${className}`} style={{ height }}>

      <div ref={containerRef} className="flex-1 overflow-hidden" style={{ minHeight: 0 }} />

      {/* Toggle parkings */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
        <button
          onClick={() => setShowParkings(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid',
            borderColor: showParkings ? '#2563eb' : '#e5e7eb',
            background:  showParkings ? '#2563eb' : 'white',
            color:       showParkings ? 'white'   : '#6b7280',
            boxShadow: '0 1px 4px rgba(0,0,0,.1)',
          }}
        >
          🅿 Parkings
        </button>
      </div>

      {/* Légende parkings */}
      {showParkings && (
        <div style={{
          position: 'absolute', bottom: 30, left: 12, zIndex: 10,
          background: 'rgba(255,255,255,.96)', borderRadius: 12,
          padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', minWidth: 205,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Parkings Sion
          </div>
          {([
            ['#2563eb', 'Centre (1424 pl.)',       'CHF 3/h · 1h gratuite'],
            ['#f97316', 'Gare CFF (~300 pl.)',      '~CHF 2/h'],
            ['#6366f1', 'Périphérie payante (582 pl.)', '~CHF 1.50/h'],
            ['#16a34a', 'P+R gratuits (910 pl.)',   'BS 11 → centre'],
          ] as [string, string, string][]).map(([color, label, sub]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>{sub}</div>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2, fontSize: 9, color: '#d1d5db' }}>
            Cliquez sur un marqueur pour les détails
          </div>
        </div>
      )}

      {/* Légende bascule modale (si résultats disponibles) */}
      {zoneResults && zoneResults.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 30, right: 12, zIndex: 10,
          background: 'rgba(255,255,255,.96)', borderRadius: 12,
          padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Potentiel bascule
          </div>
          {([
            ['vert',   'Fort (≥60)',     '#22c55e'],
            ['orange', 'Modéré (35–59)', '#f59e0b'],
            ['rouge',  'Faible (<35)',   '#ef4444'],
          ] as [string, string, string][]).map(([, label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
              <span style={{ color: '#374151' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
