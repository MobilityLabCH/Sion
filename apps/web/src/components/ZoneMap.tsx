/**
 * ZoneMap.tsx - Carte interactive parkings et zones Sion
 * VERSION COMPLETE : clic parking pour modifier prix, zones reelles
 * Chemin : apps/web/src/components/ZoneMap.tsx
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ZoneResult } from '../types';
import type { Scenario } from '../types';

interface ZoneMapProps {
  zoneResults?: ZoneResult[];
  height?: string;
  className?: string;
  scenario?: Scenario;
  onParkingPriceChange?: (parkingId: string, newPrice: number) => void;
}

// ─── Zones de Sion (polygones ajustes sur geographie reelle) ─────────────────

const ZONES = [
  {
    id: 'centre', label: 'Centre-ville', color: '#ef4444',
    description: 'Noyau historique -- Planta + Scex + Cible -- 1424 places',
    coords: [[
      [7.3520, 46.2300], [7.3530, 46.2285], [7.3560, 46.2275],
      [7.3630, 46.2278], [7.3680, 46.2285], [7.3690, 46.2305],
      [7.3680, 46.2345], [7.3650, 46.2360], [7.3600, 46.2365],
      [7.3555, 46.2360], [7.3520, 46.2340], [7.3510, 46.2320],
      [7.3520, 46.2300],
    ]],
  },
  {
    id: 'gare', label: 'Gare CFF', color: '#f97316',
    description: 'Pole multimodal -- Parking Gare ~300 pl.',
    coords: [[
      [7.3480, 46.2255], [7.3520, 46.2250], [7.3570, 46.2255],
      [7.3590, 46.2270], [7.3570, 46.2285], [7.3520, 46.2290],
      [7.3480, 46.2280], [7.3465, 46.2268], [7.3480, 46.2255],
    ]],
  },
  {
    id: 'nord', label: 'Quartiers Nord', color: '#3b82f6',
    description: 'Parking Nord 282 pl. -- Zone residentielle',
    coords: [[
      [7.3520, 46.2365], [7.3600, 46.2365], [7.3680, 46.2360],
      [7.3720, 46.2380], [7.3700, 46.2430], [7.3640, 46.2450],
      [7.3560, 46.2455], [7.3490, 46.2420], [7.3480, 46.2380],
      [7.3500, 46.2365], [7.3520, 46.2365],
    ]],
  },
  {
    id: 'est', label: 'Sion-Est', color: '#eab308',
    description: 'Roches-Brunes 300 pl. -- Zone residentielle Est',
    coords: [[
      [7.3690, 46.2285], [7.3750, 46.2280], [7.3820, 46.2285],
      [7.3860, 46.2310], [7.3840, 46.2360], [7.3780, 46.2380],
      [7.3700, 46.2375], [7.3680, 46.2345], [7.3690, 46.2305],
      [7.3690, 46.2285],
    ]],
  },
  {
    id: 'emploi', label: 'Zone Industrielle', color: '#ec4899',
    description: 'Ronquoz -- CERM -- HES-SO -- ~1200 pl. privees gratuites',
    coords: [[
      [7.3280, 46.2170], [7.3380, 46.2165], [7.3500, 46.2170],
      [7.3530, 46.2195], [7.3520, 46.2225], [7.3460, 46.2240],
      [7.3380, 46.2245], [7.3300, 46.2235], [7.3265, 46.2215],
      [7.3280, 46.2170],
    ]],
  },
  {
    id: 'peripherie', label: 'P+R Peripherie', color: '#14b8a6',
    description: 'P+R Potences 450 pl. + P+R Stade 460 pl. -- gratuits BS11',
    coords: [[
      [7.3180, 46.2200], [7.3330, 46.2200], [7.3340, 46.2260],
      [7.3320, 46.2300], [7.3290, 46.2320], [7.3200, 46.2310],
      [7.3170, 46.2260], [7.3180, 46.2200],
    ]],
  },
] as const;

// ─── Parkings avec coordonnees GPS precises ───────────────────────────────────

type ParkingType = 'centre' | 'gare' | 'pericentre' | 'pr';

interface ParkingDef {
  id: string;
  name: string;
  shortName: string;
  coords: [number, number];
  capacity: number;
  basePriceCHFh: number;
  priceNote: string;
  freeNote: string;
  walkMin: number;
  type: ParkingType;
  editable: boolean;
  maxOccupancyPct: number;
  source: string;
}

const PARKINGS: ParkingDef[] = [
  {
    id: 'planta', name: 'Parking de la Planta', shortName: 'Planta',
    coords: [7.3598, 46.2325], capacity: 562, basePriceCHFh: 3.0,
    priceNote: '1h gratuite -- CHF 3/h apres',
    freeNote: 'Gratuit ven.17h - sam.24h',
    walkMin: 3, type: 'centre', editable: true, maxOccupancyPct: 82,
    source: 'sion.ch PDF 15.07.2024',
  },
  {
    id: 'scex', name: 'Parking du Scex', shortName: 'Scex',
    coords: [7.3628, 46.2298], capacity: 658, basePriceCHFh: 3.0,
    priceNote: '1h gratuite -- CHF 3/h apres',
    freeNote: 'Gratuit ven.17h - sam.24h',
    walkMin: 4, type: 'centre', editable: true, maxOccupancyPct: 88,
    source: 'sion.ch PDF 11.08.2025',
  },
  {
    id: 'cible', name: 'Parking de la Cible', shortName: 'Cible',
    coords: [7.3562, 46.2342], capacity: 204, basePriceCHFh: 3.0,
    priceNote: '~CHF 3/h (estime)',
    freeNote: 'Gratuit ven.17h - sam.24h (presume)',
    walkMin: 5, type: 'centre', editable: true, maxOccupancyPct: 75,
    source: 'sion.ch estime conf.0.70',
  },
  {
    id: 'gare', name: 'Parking Gare CFF', shortName: 'Gare CFF',
    coords: [7.3521, 46.2278], capacity: 300, basePriceCHFh: 2.0,
    priceNote: '~CHF 2/h (estime)',
    freeNote: 'Gratuit samedi (presume)',
    walkMin: 10, type: 'gare', editable: false, maxOccupancyPct: 70,
    source: 'CFF -- sion.ch estime',
  },
  {
    id: 'nord', name: 'Parking Nord', shortName: 'Nord',
    coords: [7.3572, 46.2420], capacity: 282, basePriceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (estime)',
    freeNote: '',
    walkMin: 15, type: 'pericentre', editable: false, maxOccupancyPct: 60,
    source: 'sion.ch carte mobilite conf.0.60',
  },
  {
    id: 'roches', name: 'Parking Roches-Brunes', shortName: 'Roches',
    coords: [7.3745, 46.2318], capacity: 300, basePriceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (estime)',
    freeNote: '',
    walkMin: 20, type: 'pericentre', editable: false, maxOccupancyPct: 55,
    source: 'sion.ch carte mobilite conf.0.60',
  },
  {
    id: 'pr-potences', name: 'P+R Potences', shortName: 'P+R Potences',
    coords: [7.3240, 46.2268], capacity: 450, basePriceCHFh: 0,
    priceNote: 'GRATUIT',
    freeNote: 'BS 11 toutes les 10 min',
    walkMin: 0, type: 'pr', editable: true, maxOccupancyPct: 35,
    source: 'sion.ch -- CarPostal 2025',
  },
  {
    id: 'pr-stade', name: 'P+R Stade / Echutes', shortName: 'P+R Stade',
    coords: [7.3840, 46.2330], capacity: 460, basePriceCHFh: 0,
    priceNote: 'GRATUIT',
    freeNote: 'BS 11 toutes les 10 min',
    walkMin: 0, type: 'pr', editable: true, maxOccupancyPct: 28,
    source: 'sion.ch -- CarPostal 2025',
  },
];

const MARKER_BG: Record<ParkingType, string> = {
  centre:     '#2563eb',
  gare:       '#f97316',
  pericentre: '#6366f1',
  pr:         '#16a34a',
};

// ─── Panel edition parking ────────────────────────────────────────────────────

function ParkingEditPanel({ pk, scenarioPrice, onClose, onApply }: {
  pk: ParkingDef;
  scenarioPrice: number;
  onClose: () => void;
  onApply: (price: number) => void;
}) {
  const [price, setPrice] = useState(scenarioPrice);
  const col = MARKER_BG[pk.type];
  const occ = Math.max(0, pk.maxOccupancyPct - Math.round((price - pk.basePriceCHFh) * 8));

  return (
    <div style={{ position: 'absolute', top: 60, right: 12, zIndex: 20, width: 270, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '1.5px solid #e5e7eb', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: col }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{pk.name}</span>
        </div>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: 6, width: 24, height: 24, fontSize: 12, fontWeight: 700, color: '#6b7280' }}>X</button>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111827' }}>{pk.capacity}</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>places totales</div>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: occ > 80 ? '#dc2626' : '#111827' }}>{occ}%</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>occupation estimee</div>
          </div>
        </div>

        {pk.editable ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 10 }}>
              Modifier le tarif
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#374151' }}>Tarif horaire (h2+)</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: price === 0 ? '#16a34a' : '#2563eb' }}>
                {price === 0 ? 'GRATUIT' : 'CHF ' + price.toFixed(1) + '/h'}
              </span>
            </div>
            <input
              type="range" min={0} max={8} step={0.5} value={price}
              onChange={e => setPrice(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: col, marginBottom: 8 }}
            />
            <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 12 }}>
              Baseline : CHF {pk.basePriceCHFh.toFixed(1)}/h -- {pk.priceNote}
            </div>
            {pk.freeNote ? (
              <div style={{ fontSize: 10, background: '#f0fdf4', color: '#15803d', padding: '4px 8px', borderRadius: 6, marginBottom: 12 }}>
                {pk.freeNote}
              </div>
            ) : null}
            <button
              onClick={() => onApply(price)}
              style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: col, color: 'white', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              Appliquer et simuler
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '6px 10px', borderRadius: 8, marginBottom: 8 }}>
              Pas de levier direct -- Tarif gere par {pk.type === 'gare' ? 'CFF' : 'gestionnaire prive'}
            </div>
            <div style={{ fontSize: 10, color: '#374151' }}>Tarif actuel : <strong>{pk.priceNote}</strong></div>
            {pk.walkMin > 0 ? <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>A pied du centre : {pk.walkMin} min</div> : null}
          </>
        )}

        <div style={{ fontSize: 9, color: '#d1d5db', borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 8 }}>
          Source : {pk.source}
        </div>
      </div>
    </div>
  );
}

// ─── Composant ZoneMap ────────────────────────────────────────────────────────

export default function ZoneMap({
  zoneResults,
  height = '100%',
  className = '',
  scenario,
  onParkingPriceChange,
}: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markersRef   = useRef<maplibregl.Marker[]>([]);
  const [mapReady,     setMapReady]     = useState(false);
  const [showParkings, setShowParkings] = useState(true);
  const [editParking,  setEditParking]  = useState<ParkingDef | null>(null);

  // ── Init carte ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '(c) OpenStreetMap' } },
        layers:  [{ id: 'osm', type: 'raster', source: 'osm' }],
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

  // ── Zones ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    ZONES.forEach(z => {
      ['fill', 'outline', 'label'].forEach(t => {
        if (map.getLayer('z-' + t + '-' + z.id)) map.removeLayer('z-' + t + '-' + z.id);
      });
      if (map.getSource('z-' + z.id))     map.removeSource('z-' + z.id);
      if (map.getSource('zlbl-' + z.id))  map.removeSource('zlbl-' + z.id);
    });

    ZONES.forEach(z => {
      const res = zoneResults?.find(r => r.zoneId === z.id);
      const cat = res?.category;
      const fillColor = cat === 'vert' ? '#22c55e' : cat === 'orange' ? '#f59e0b' : cat === 'rouge' ? '#ef4444' : z.color;

      map.addSource('z-' + z.id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { zoneId: z.id, label: z.label },
          geometry: { type: 'Polygon', coordinates: z.coords as unknown as [number, number][][] },
        },
      });
      map.addLayer({ id: 'z-fill-' + z.id,    type: 'fill',   source: 'z-' + z.id, paint: { 'fill-color': fillColor, 'fill-opacity': res ? 0.28 : 0.10 } });
      map.addLayer({ id: 'z-outline-' + z.id, type: 'line',   source: 'z-' + z.id, paint: { 'line-color': z.color, 'line-width': 1.8, 'line-opacity': 0.75 } });

      const pts = (z.coords[0] as unknown as [number, number][]).slice(0, -1);
      const cx  = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy  = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const labelText = res ? z.label + '\n' + Math.round(res.shiftIndex * 100) + '%' : z.label;

      map.addSource('zlbl-' + z.id, { type: 'geojson', data: { type: 'Feature', properties: { text: labelText }, geometry: { type: 'Point', coordinates: [cx, cy] } } });
      map.addLayer({ id: 'z-label-' + z.id, type: 'symbol', source: 'zlbl-' + z.id, layout: { 'text-field': ['get', 'text'], 'text-size': 10, 'text-font': ['Open Sans Regular'], 'text-anchor': 'center', 'text-line-height': 1.3 }, paint: { 'text-color': '#1e1e2e', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });

      map.on('click', 'z-fill-' + z.id, e => {
        const centrePrice = scenario?.centrePeakPriceCHFh ?? 3.0;
        new maplibregl.Popup({ closeButton: true, maxWidth: '250px' })
          .setLngLat(e.lngLat)
          .setHTML(
            '<div style="font-family:sans-serif;padding:4px 0">' +
            '<div style="font-weight:800;font-size:14px;color:#111827;margin-bottom:3px">' + z.label + '</div>' +
            '<div style="font-size:11px;color:#6b7280;margin-bottom:8px">' + z.description + '</div>' +
            (res
              ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
                '<div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center"><div style="font-weight:900;font-size:20px;color:' + (cat === 'vert' ? '#22c55e' : cat === 'orange' ? '#f59e0b' : '#ef4444') + '">' + res.elasticityScore + '</div><div style="color:#9ca3af;font-size:9px">Elasticite /100</div></div>' +
                '<div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center"><div style="font-weight:900;font-size:20px;color:#111827">' + Math.round(res.shiftIndex * 100) + '%</div><div style="color:#9ca3af;font-size:9px">Report modal</div></div>' +
                '</div>' +
                (res.equityFlag ? '<div style="margin-top:7px;font-size:10px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:6px">Risque equite : ' + (res.equityReason ?? '') + '</div>' : '')
              : '<div style="font-size:11px;color:#9ca3af">Simulez pour voir les resultats.</div>'
            ) +
            (z.id === 'centre' ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:10px;color:#374151">Tarif actuel : CHF ' + centrePrice.toFixed(1) + '/h</div>' : '') +
            '</div>'
          ).addTo(map);
      });
      map.on('mouseenter', 'z-fill-' + z.id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'z-fill-' + z.id, () => { map.getCanvas().style.cursor = ''; });
    });
  }, [mapReady, zoneResults, scenario?.centrePeakPriceCHFh]);

  // ── Marqueurs parkings ───────────────────────────────────────────────────────
  const buildMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (!showParkings) return;

    const centrePrix = scenario?.centrePeakPriceCHFh ?? 3.0;
    const prPrix     = scenario?.peripheriePeakPriceCHFh ?? 0;

    PARKINGS.forEach(pk => {
      const effectivePrice = pk.type === 'centre' ? centrePrix : pk.type === 'pr' ? prPrix : pk.basePriceCHFh;
      const bgColor = pk.type === 'pr'
        ? (prPrix > 0 ? '#d97706' : '#16a34a')
        : pk.type === 'centre'
          ? (centrePrix > pk.basePriceCHFh + 0.1 ? '#dc2626' : centrePrix < pk.basePriceCHFh - 0.1 ? '#22c55e' : '#2563eb')
          : MARKER_BG[pk.type];

      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
      el.innerHTML =
        '<div style="background:' + bgColor + ';color:#fff;font-weight:800;font-size:10px;' +
        'min-width:28px;height:28px;border-radius:8px;display:flex;align-items:center;' +
        'justify-content:center;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);' +
        'padding:0 6px;white-space:nowrap;gap:3px;">' +
        (pk.editable ? '&#9998; ' : '') + pk.shortName +
        '</div>' +
        '<div style="width:2px;height:5px;background:' + bgColor + ';"></div>';

      el.addEventListener('click', e => {
        e.stopPropagation();
        setEditParking(prev => prev?.id === pk.id ? null : pk);
      });

      el.addEventListener('mouseenter', () => { el.firstElementChild && ((el.firstElementChild as HTMLElement).style.transform = 'scale(1.1)'); });
      el.addEventListener('mouseleave', () => { el.firstElementChild && ((el.firstElementChild as HTMLElement).style.transform = 'scale(1)'); });

      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(pk.coords).addTo(map)
      );
    });
  }, [mapReady, showParkings, scenario?.centrePeakPriceCHFh, scenario?.peripheriePeakPriceCHFh]);

  useEffect(() => { buildMarkers(); }, [buildMarkers]);

  // ─── Rendu ──────────────────────────────────────────────────────────────────

  const centrePrix = scenario?.centrePeakPriceCHFh ?? 3.0;
  const prPrix     = scenario?.peripheriePeakPriceCHFh ?? 0;

  const selectedParkingPrice = editParking
    ? (editParking.type === 'centre' ? centrePrix : editParking.type === 'pr' ? prPrix : editParking.basePriceCHFh)
    : 0;

  return (
    <div className={'relative flex flex-col ' + className} style={{ height, position: 'relative' }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', height: '100%' }} />

      {/* Toggle parkings */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
        <button
          onClick={() => setShowParkings(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: showParkings ? '#2563eb' : '#e5e7eb', background: showParkings ? '#2563eb' : 'white', color: showParkings ? 'white' : '#6b7280', boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}
        >
          P Parkings {showParkings && editParking === null ? '(clic pour modifier)' : ''}
        </button>
      </div>

      {/* Panel edition parking */}
      {editParking && (
        <ParkingEditPanel
          pk={editParking}
          scenarioPrice={selectedParkingPrice}
          onClose={() => setEditParking(null)}
          onApply={price => {
            if (onParkingPriceChange) onParkingPriceChange(editParking.id, price);
            setEditParking(null);
          }}
        />
      )}

      {/* Legende parkings */}
      {showParkings && !editParking && (
        <div style={{ position: 'absolute', bottom: 30, left: 12, zIndex: 10, background: 'rgba(255,255,255,.96)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
            Parkings Sion
          </div>
          {[
            { color: '#2563eb', label: 'Centre (1424 pl.)',    sub: 'CHF ' + centrePrix.toFixed(1) + '/h (simule)' },
            { color: '#f97316', label: 'Gare CFF (~300 pl.)',  sub: '~CHF 2.00/h' },
            { color: '#6366f1', label: 'Pericentre (582 pl.)', sub: '~CHF 1.50/h' },
            { color: '#16a34a', label: 'P+R (910 pl.)',        sub: prPrix > 0 ? 'CHF ' + prPrix.toFixed(1) + '/h' : 'GRATUIT' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>{item.sub}</div>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2, fontSize: 9, color: '#9ca3af' }}>
            Cliquer sur un marqueur pour modifier
          </div>
        </div>
      )}

      {/* Legende bascule */}
      {zoneResults && zoneResults.length > 0 && (
        <div style={{ position: 'absolute', bottom: 30, right: 12, zIndex: 10, background: 'rgba(255,255,255,.96)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
            Potentiel bascule
          </div>
          {[
            { label: 'Fort (60%+)',   color: '#22c55e' },
            { label: 'Moyen (35-59%)', color: '#f59e0b' },
            { label: 'Faible (-35%)', color: '#ef4444' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
              <span style={{ color: '#374151' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
