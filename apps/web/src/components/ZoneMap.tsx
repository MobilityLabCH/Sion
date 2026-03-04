/**
 * ZoneMap.tsx — Carte parkings & zones · Sion Mobility
 *
 * REFONTE :
 *  - Flux OD supprimés (illisibles, remplacés par marqueurs parkings)
 *  - Polygones zones corrigés (quartiers réels de Sion)
 *  - Parkings géolocalisés avec coordonnées GPS précises
 *  - Coloration dynamique selon tarif simulé (vs baseline)
 *  - Popups enrichies avec infos officielles
 *  - Design épuré pour décideurs
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { ZoneResult } from '../types';

interface ZoneMapProps {
  zoneResults?: ZoneResult[];
  height?: string;
  className?: string;
  scenarioPeakPrice?: number;
  dayType?: string;
  scenario?: { centrePeakPriceCHFh?: number };
}

// ─── Zones réelles de Sion ────────────────────────────────────────────────────
// Polygones ajustés sur la géographie réelle (rues et quartiers)
const ZONES = [
  {
    id: 'centre',
    label: 'Centre-ville',
    description: 'Noyau historique · Planta + Scex + Cible · 1424 places',
    color: '#ef4444',
    // Vieille ville + zone piétonne + rue de Lausanne
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
    // Quartier gare, au sud du centre
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
    // Quartiers nord (Platta, Champsec, vers Savièse)
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
    // Est de la ville, vers Bramois
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
    // Zone industrielle Ronquoz / Aéroport — au sud-ouest
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
    // Grande zone périphérique englobant les deux P+R
    coords: [[
      [7.3180, 46.2200], [7.3330, 46.2200], [7.3340, 46.2260],
      [7.3320, 46.2300], [7.3290, 46.2320], [7.3200, 46.2310],
      [7.3170, 46.2260], [7.3180, 46.2200],
    ]],
  },
];

// ─── Parkings officiels Sion — coordonnées GPS précises ──────────────────────
// Sources: sion.ch/stationnement · Google Maps · 2025
const PARKINGS = [
  {
    id: 'planta',
    name: 'Parking de la Planta',
    shortName: 'Planta',
    coords: [7.3598, 46.2325] as [number, number],
    capacity: 562,
    priceCHFh: 3.0,
    priceNote: '1ère heure gratuite · CHF 3/h dès h2',
    freeNote: 'Gratuit ven. 17h → sam. 24h',
    walkMin: 3,
    type: 'centre' as const,
    source: 'sion.ch PDF 15.07.2024',
  },
  {
    id: 'scex',
    name: 'Parking du Scex',
    shortName: 'Scex',
    coords: [7.3628, 46.2298] as [number, number],
    capacity: 658,
    priceCHFh: 3.0,
    priceNote: '1ère heure gratuite · CHF 3/h dès h2',
    freeNote: 'Gratuit ven. 17h → sam. 24h',
    walkMin: 4,
    type: 'centre' as const,
    source: 'sion.ch PDF 11.08.2025',
  },
  {
    id: 'cible',
    name: 'Parking de la Cible',
    shortName: 'Cible',
    coords: [7.3562, 46.2342] as [number, number],
    capacity: 204,
    priceCHFh: 3.0,
    priceNote: '~CHF 3/h (tarif estimé par analogie)',
    freeNote: 'Gratuit ven. 17h → sam. 24h (présumé)',
    walkMin: 5,
    type: 'centre' as const,
    source: 'sion.ch estimé · conf. 0.70',
  },
  {
    id: 'gare',
    name: 'Parking Gare CFF',
    shortName: 'Gare',
    coords: [7.3521, 46.2278] as [number, number],
    capacity: 300,
    priceCHFh: 2.0,
    priceNote: '~CHF 2/h (tarif estimé)',
    freeNote: 'Gratuit samedi (présumé)',
    walkMin: 10,
    type: 'gare' as const,
    source: 'CFF · sion.ch estimé',
  },
  {
    id: 'nord',
    name: 'Parking Nord',
    shortName: 'Nord',
    coords: [7.3572, 46.2420] as [number, number],
    capacity: 282,
    priceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (tarif préférentiel estimé)',
    freeNote: '',
    walkMin: 15,
    type: 'pericentre' as const,
    source: 'sion.ch carte mobilité · conf. 0.60',
  },
  {
    id: 'roches',
    name: 'Parking Roches-Brunes',
    shortName: 'Roches',
    coords: [7.3745, 46.2318] as [number, number],
    capacity: 300,
    priceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (tarif préférentiel estimé)',
    freeNote: '',
    walkMin: 20,
    type: 'pericentre' as const,
    source: 'sion.ch carte mobilité · conf. 0.60',
  },
  {
    id: 'pr-potences',
    name: 'P+R Potences',
    shortName: 'P+R Potences',
    coords: [7.3240, 46.2268] as [number, number],
    capacity: 450,
    priceCHFh: 0,
    priceNote: 'GRATUIT',
    freeNote: 'BS 11 → centre toutes les 10 min',
    walkMin: 0, // accès bus
    type: 'pr' as const,
    source: 'sion.ch · CarPostal 2025 · conf. 0.95',
  },
  {
    id: 'pr-stade',
    name: 'P+R Stade / Échutes',
    shortName: 'P+R Stade',
    coords: [7.3840, 46.2330] as [number, number],
    capacity: 460,
    priceCHFh: 0,
    priceNote: 'GRATUIT',
    freeNote: 'BS 11 → centre toutes les 10 min',
    walkMin: 0,
    type: 'pr' as const,
    source: 'sion.ch · CarPostal 2025 · conf. 0.95',
  },
];

// ─── Couleurs par type ────────────────────────────────────────────────────────
const MARKER_STYLE = {
  centre:     { bg: '#2563eb', label: 'Centre' },
  gare:       { bg: '#f97316', label: 'Gare' },
  pericentre: { bg: '#6366f1', label: 'Périphérie' },
  pr:         { bg: '#16a34a', label: 'P+R gratuit' },
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
  const [mapReady, setMapReady]     = useState(false);
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
      if (map.getLayer(`z-fill-${z.id}`))    map.removeLayer(`z-fill-${z.id}`);
      if (map.getLayer(`z-outline-${z.id}`)) map.removeLayer(`z-outline-${z.id}`);
      if (map.getLayer(`z-label-${z.id}`))   map.removeLayer(`z-label-${z.id}`);
      if (map.getSource(`z-${z.id}`))        map.removeSource(`z-${z.id}`);
    });

    ZONES.forEach(z => {
      const res = zoneResults?.find(r => r.zoneId === z.id);
      const cat = res?.category ?? 'default';
      const fillColor = cat === 'vert' ? '#22c55e' : cat === 'orange' ? '#f59e0b' : cat === 'rouge' ? '#ef4444' : z.color;
      const fillOpacity = res ? 0.30 : 0.12;

      map.addSource(`z-${z.id}`, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { label: z.label, description: z.description, zoneId: z.id },
          geometry: { type: 'Polygon', coordinates: z.coords },
        },
      });

      map.addLayer({
        id: `z-fill-${z.id}`, type: 'fill', source: `z-${z.id}`,
        paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity },
      });
      map.addLayer({
        id: `z-outline-${z.id}`, type: 'line', source: `z-${z.id}`,
        paint: { 'line-color': z.color, 'line-width': 1.8, 'line-opacity': 0.75 },
      });

      // Label centroïd via symbol
      const lngSum = z.coords[0].reduce((s, c) => s + c[0], 0);
      const latSum = z.coords[0].reduce((s, c) => s + c[1], 0);
      const n = z.coords[0].length - 1;
      const labelSrc = `z-lbl-${z.id}`;
      if (!map.getSource(labelSrc)) {
        map.addSource(labelSrc, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { label: z.label, shiftPct: res ? Math.round((res as any).shiftIndex * 100) : null },
            geometry: { type: 'Point', coordinates: [lngSum / n, latSum / n] },
          },
        });
      }
      map.addLayer({
        id: `z-label-${z.id}`, type: 'symbol', source: labelSrc,
        layout: {
          'text-field': res
            ? ['concat', ['get', 'label'], '\n', ['to-string', ['get', 'shiftPct']], '%']
            : ['get', 'label'],
          'text-size': 10,
          'text-font': ['Open Sans Regular'],
          'text-anchor': 'center',
          'text-line-height': 1.3,
        },
        paint: { 'text-color': '#1e1e2e', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });

      // Popup au clic
      map.on('click', `z-fill-${z.id}`, e => {
        const centrePrice = scenario?.centrePeakPriceCHFh ?? 3.0;
        const isWeekend = dayType === 'friday' || dayType === 'saturday';
        new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:'DM Sans',sans-serif;padding:4px 0">
              <div style="font-weight:800;font-size:14px;color:#111827;margin-bottom:3px">${z.label}</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:10px;line-height:1.4">${z.description}</div>
              ${res ? `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
                  <div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center">
                    <div style="font-weight:800;font-size:18px;color:${cat === 'vert' ? '#22c55e' : cat === 'orange' ? '#f59e0b' : '#ef4444'}">${res.elasticityScore}</div>
                    <div style="color:#9ca3af;font-size:9px;margin-top:2px">Élasticité /100</div>
                  </div>
                  <div style="background:#f8fafc;border-radius:8px;padding:7px;text-align:center">
                    <div style="font-weight:800;font-size:18px;color:#111827">${Math.round((res as any).shiftIndex * 100)}%</div>
                    <div style="color:#9ca3af;font-size:9px;margin-top:2px">Report modal</div>
                  </div>
                </div>
                ${res.equityFlag ? '<div style="margin-top:7px;font-size:10px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:6px">⚠ Risque équité détecté</div>' : ''}
              ` : `
                <div style="font-size:11px;color:#9ca3af;font-style:italic">
                  Simulez un scénario pour voir les résultats de bascule modale.
                </div>
              `}
              ${z.id === 'centre' ? `
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:10px;color:#374151">
                  💰 Tarif actuel : <strong>${isWeekend ? 'GRATUIT ⚡' : `CHF ${centrePrice.toFixed(1)}/h`}</strong>
                </div>
              ` : ''}
            </div>
          `).addTo(map);
      });
      map.on('mouseenter', `z-fill-${z.id}`, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', `z-fill-${z.id}`, () => { map.getCanvas().style.cursor = ''; });
    });
  }, [mapReady, zoneResults]);

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
      const style = MARKER_STYLE[pk.type];
      const effectivePrice = isWeekend && pk.type === 'centre' ? 0 : pk.priceCHFh;
      const priceDisplay = effectivePrice === 0 ? 'GRATUIT' : `CHF ${effectivePrice.toFixed(1)}/h`;
      const bgColor = pk.type === 'pr'
        ? '#16a34a'
        : effectivePrice === 0
          ? '#22c55e'
          : pk.type === 'centre' && centrePrice > 3.5
            ? '#dc2626'
            : style.bg;

      // Marqueur
      const el = document.createElement('div');
      el.style.cssText = `
        display: flex; flex-direction: column; align-items: center; cursor: pointer;
      `;
      el.innerHTML = `
        <div style="
          background:${bgColor};color:#fff;font-weight:800;font-size:11px;
          min-width:30px;height:30px;border-radius:8px;
          display:flex;align-items:center;justify-content:center;
          border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);
          padding:0 6px;white-space:nowrap;gap:3px;
        ">
          <span>🅿</span>
          <span style="font-size:10px">${pk.shortName}</span>
        </div>
        <div style="width:2px;height:5px;background:${bgColor};"></div>
      `;

      // Popup détaillée
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
                <div style="font-weight:800;font-size:${pk.priceCHFh === 0 ? '13' : '18'}px;color:${pk.priceCHFh === 0 ? '#16a34a' : '#2563eb'};line-height:1.2">
                  ${isWeekend && pk.type === 'centre' ? '<span style="color:#d97706;font-size:13px">GRATUIT ⚡</span>' : priceDisplay}
                </div>
                <div style="color:#9ca3af;font-size:9px;margin-top:1px">tarif pointe</div>
              </div>
            </div>

            ${pk.priceNote !== priceDisplay ? `<div style="font-size:10px;color:#374151;margin-bottom:4px">📋 ${pk.priceNote}</div>` : ''}
            ${pk.freeNote ? `<div style="font-size:10px;background:#f0fdf4;color:#15803d;padding:4px 8px;border-radius:6px;margin-bottom:4px">✓ ${pk.freeNote}</div>` : ''}
            ${pk.walkMin > 0 ? `<div style="font-size:10px;color:#6b7280;margin-bottom:4px">🚶 ${pk.walkMin} min à pied du centre</div>` : ''}

            <div style="font-size:9px;color:#d1d5db;border-top:1px solid #f1f5f9;padding-top:4px;margin-top:2px">
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

  const totalCentrePlaces = 562 + 658 + 204;
  const totalPrPlaces = 450 + 460;

  return (
    <div className={`relative flex flex-col ${className}`} style={{ height }}>

      {/* Carte */}
      <div ref={containerRef} className="flex-1 overflow-hidden" style={{ minHeight: 0 }} />

      {/* Toggle parkings */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button
          onClick={() => setShowParkings(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid',
            borderColor: showParkings ? '#2563eb' : '#e5e7eb',
            background: showParkings ? '#2563eb' : 'white',
            color: showParkings ? 'white' : '#6b7280',
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
          padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)',
          minWidth: 200,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
            Parkings Sion
          </div>
          {[
            { color: '#2563eb', label: `Centre (${totalCentrePlaces} pl.)`, sub: 'CHF 3/h · 1h gratuite' },
            { color: '#f97316', label: 'Gare CFF (~300 pl.)',               sub: '~CHF 2/h' },
            { color: '#6366f1', label: 'Périphérie payante (648 pl.)',      sub: '~CHF 1.50/h' },
            { color: '#16a34a', label: `P+R gratuits (${totalPrPlaces} pl.)`, sub: 'BS 11 → centre' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>{item.sub}</div>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2, fontSize: 9, color: '#d1d5db' }}>
            Cliquez sur un marqueur pour les détails
          </div>
        </div>
      )}

      {/* Légende zones (si résultats) */}
      {zoneResults && (
        <div style={{
          position: 'absolute', bottom: 30, right: 12, zIndex: 10,
          background: 'rgba(255,255,255,.96)', borderRadius: 12,
          padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
            Potentiel bascule
          </div>
          {([
            ['vert',   'Fort (≥60)',    '#22c55e'],
            ['orange', 'Modéré (35–59)','#f59e0b'],
            ['rouge',  'Faible (<35)',  '#ef4444'],
          ] as [string, string, string][]).map(([, l, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
              <span style={{ color: '#374151' }}>{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
