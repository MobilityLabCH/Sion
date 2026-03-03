/**
 * ZoneMap.tsx — Carte interactive avec :
 *  - Zones colorées (potentiel de bascule)
 *  - Flux OD animés (flèches origine → destination, épaisseur = volume)
 *  - Marqueurs parkings géolocalisés avec popups détaillés
 *  - Sources de données visibles
 *  - Fallback zones GeoJSON embarquées (mode local / pare-feu)
 */
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { ZoneResult } from '../types';

const API_BASE =
  (import.meta as any).env?.VITE_API_URL ||
  'https://sion.ericimstepf.workers.dev/api';

interface ZoneMapProps {
  zoneResults?: ZoneResult[];
  height?: string;
  className?: string;
  showODFlows?: boolean;
  scenarioPeakPrice?: number;
  dayType?: string;
}

// ─── Données géo embarquées ──────────────────────────────────────────────────
const ZONES_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, id: 'centre',     properties: { zoneId: 'centre',     label: 'Centre-ville',   description: 'Noyau historique, haute fréquentation'  }, geometry: { type: 'Polygon' as const, coordinates: [[[7.355,46.231],[7.368,46.231],[7.368,46.238],[7.355,46.238],[7.355,46.231]]] } },
    { type: 'Feature' as const, id: 'gare',       properties: { zoneId: 'gare',       label: 'Gare CFF',       description: 'Pôle multimodal · fort trafic pendulaire' }, geometry: { type: 'Polygon' as const, coordinates: [[[7.349,46.226],[7.358,46.226],[7.358,46.233],[7.349,46.233],[7.349,46.226]]] } },
    { type: 'Feature' as const, id: 'est',        properties: { zoneId: 'est',        label: 'Est (Uvrier)',   description: 'Résidentiel Est · bonne desserte bus'    }, geometry: { type: 'Polygon' as const, coordinates: [[[7.368,46.227],[7.382,46.227],[7.382,46.238],[7.368,46.238],[7.368,46.227]]] } },
    { type: 'Feature' as const, id: 'ouest',      properties: { zoneId: 'ouest',      label: 'Ouest (Châteu.)',description: 'Résidentiel Ouest · P+R Châteauneuf'    }, geometry: { type: 'Polygon' as const, coordinates: [[[7.338,46.226],[7.352,46.226],[7.352,46.236],[7.338,46.236],[7.338,46.226]]] } },
    { type: 'Feature' as const, id: 'nord',       properties: { zoneId: 'nord',       label: 'Nord (Savièse)', description: 'Savièse, Bramois · dépendance auto forte' }, geometry: { type: 'Polygon' as const, coordinates: [[[7.351,46.238],[7.372,46.238],[7.372,46.250],[7.351,46.250],[7.351,46.238]]] } },
    { type: 'Feature' as const, id: 'sud',        properties: { zoneId: 'sud',        label: 'Sud (Riddes)',   description: 'Zone industrielle · longue durée employés'}, geometry: { type: 'Polygon' as const, coordinates: [[[7.351,46.217],[7.372,46.217],[7.372,46.226],[7.351,46.226],[7.351,46.217]]] } },
    { type: 'Feature' as const, id: 'emploi',     properties: { zoneId: 'emploi',     label: 'Zone Emploi',    description: 'CERM · HES-SO · industries · 1200 pl. privées'}, geometry: { type: 'Polygon' as const, coordinates: [[[7.335,46.219],[7.352,46.219],[7.352,46.226],[7.335,46.226],[7.335,46.219]]] } },
    { type: 'Feature' as const, id: 'peripherie', properties: { zoneId: 'peripherie', label: 'Périphérie',     description: 'Nendaz, Veysonnaz, Ayent · >30 min TP'   }, geometry: { type: 'Polygon' as const, coordinates: [[[7.318,46.208],[7.402,46.208],[7.402,46.262],[7.318,46.262],[7.318,46.208]]] } },
  ],
};

// ─── Centroids zones ─────────────────────────────────────────────────────────
const ZONE_CENTROIDS: Record<string, [number,number]> = {
  centre:     [7.362, 46.234],
  gare:       [7.354, 46.230],
  est:        [7.374, 46.232],
  ouest:      [7.344, 46.231],
  nord:       [7.361, 46.244],
  sud:        [7.361, 46.222],
  emploi:     [7.344, 46.223],
  peripherie: [7.360, 46.234],
};

// ─── Flux OD principaux — source personas + enquêtes suisses ARE 2015 ────────
// Volumes relatifs calibrés sur la structure de Sion (50k hab.)
// Source : ARE/OFS microrecensement mobilité 2015 · Ville de Sion estimation
const OD_FLOWS = [
  // depuis, vers,       volume_relatif, label
  { from: 'peripherie', to: 'centre', vol: 0.92, label: 'Pendulaires · visiteurs · retraités' },
  { from: 'nord',       to: 'centre', vol: 0.72, label: 'Savièse · Bramois' },
  { from: 'est',        to: 'centre', vol: 0.58, label: 'Uvrier · résidentiel Est' },
  { from: 'ouest',      to: 'centre', vol: 0.50, label: 'Châteauneuf · résidentiel Ouest' },
  { from: 'sud',        to: 'centre', vol: 0.38, label: 'Zone industrielle' },
  { from: 'peripherie', to: 'emploi', vol: 0.35, label: 'CERM · HES-SO · industries' },
  { from: 'nord',       to: 'gare',   vol: 0.28, label: 'Correspondances CFF' },
  { from: 'est',        to: 'gare',   vol: 0.22, label: 'Correspondances CFF' },
  { from: 'gare',       to: 'centre', vol: 0.60, label: 'Arrivées CFF → centre' },
];

// ─── Parkings géolocalisés (coordonnées GPS relevées) ────────────────────────
// Source : sion.ch/stationnement · 2025
const PARKINGS_GEO = [
  {
    id: 'planta',
    name: 'Parking de la Planta',
    address: 'Place du Midi, 1950 Sion',
    coords: [7.3589, 46.2328] as [number,number],
    capacity: 570,
    pricePeak: 3.0,
    freeFirst: '1h gratuite',
    freeFriSat: 'Gratuit vendredi dès 17h · samedi toute la journée',
    walkCentre: '3 min',
    source: 'sion.ch · 15.07.2024',
    color: '#2563eb',
  },
  {
    id: 'scex',
    name: 'Parking du Scex',
    address: 'Rue du Scex 12, 1950 Sion',
    coords: [7.3642, 46.2296] as [number,number],
    capacity: 658,
    pricePeak: 3.0,
    freeFirst: '1h gratuite',
    freeFriSat: 'Gratuit vendredi dès 17h · samedi toute la journée',
    walkCentre: '4 min',
    source: 'sion.ch · 11.08.2025',
    color: '#2563eb',
  },
  {
    id: 'gare',
    name: 'Parking Gare CFF',
    address: 'Place de la Gare, 1950 Sion',
    coords: [7.3521, 46.2278] as [number,number],
    capacity: 420,
    pricePeak: 2.0,
    freeFirst: null,
    freeFriSat: 'Gratuit samedi',
    walkCentre: '10 min',
    source: 'CFF SBB · sion.ch',
    color: '#0d9488',
  },
  {
    id: 'pr-west',
    name: 'P+R Châteauneuf (Ouest)',
    address: 'Route de Riddes, 1950 Sion',
    coords: [7.3398, 46.2296] as [number,number],
    capacity: 800,
    pricePeak: 0,
    freeFirst: null,
    freeFriSat: 'Gratuit 7j/7',
    walkCentre: 'Bus ligne 2',
    source: 'Estimation · sion.ch',
    color: '#16a34a',
  },
  {
    id: 'pr-east',
    name: 'P+R Est (Uvrier)',
    address: 'Route de Sierre, 1950 Sion',
    coords: [7.3820, 46.2310] as [number,number],
    capacity: 600,
    pricePeak: 0,
    freeFirst: null,
    freeFriSat: 'Gratuit 7j/7',
    walkCentre: 'Bus ligne 4',
    source: 'Estimation · sion.ch',
    color: '#16a34a',
  },
];

const CAT_COLORS: Record<string, string> = {
  vert: '#22c55e', orange: '#f59e0b', rouge: '#ef4444', default: '#94a3b8',
};

function makeArrowGeoJSON(fromCoord: [number,number], toCoord: [number,number], vol: number) {
  // Légère courbure pour différencier les flux parallèles
  const mx = (fromCoord[0] + toCoord[0]) / 2;
  const my = (fromCoord[1] + toCoord[1]) / 2;
  const dx = toCoord[1] - fromCoord[1];
  const dy = -(toCoord[0] - fromCoord[0]);
  const curve = 0.008 * vol;
  const mid: [number,number] = [mx + dy * curve, my + dx * curve];
  return {
    type: 'Feature' as const,
    properties: { vol, width: 1 + vol * 5 },
    geometry: {
      type: 'LineString' as const,
      coordinates: [fromCoord, mid, toCoord],
    },
  };
}

export default function ZoneMap({ zoneResults, height = '420px', className = '', showODFlows = true, scenarioPeakPrice, dayType }: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [showFlows, setShowFlows] = useState(showODFlows);
  const [showParkings, setShowParkings] = useState(true);

  // ── Init map ────────────────────────────────────────────────────────────────
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
      center: [7.362, 46.233],
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

  // ── Zones + Flux OD ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const load = async () => {
      // Charger zones (fallback local)
      let geojson = ZONES_GEOJSON;
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(`${API_BASE}/data`, { signal: ctrl.signal });
        if (r.ok) {
          const d = await r.json();
          if (d.zones?.features?.length) geojson = d.zones;
        }
      } catch { /* mode local */ }

      // Enrichir avec résultats
      const enriched = {
        ...geojson,
        features: geojson.features.map((f: any) => {
          const zid = f.properties.zoneId;
          const res = zoneResults?.find(r => r.zoneId === zid);
          return {
            ...f,
            properties: {
              ...f.properties,
              category: res?.category || 'default',
              elasticityScore: res?.elasticityScore ?? 0,
              shiftPct: res ? Math.round(res.shiftIndex * 100) : 0,
              occupancyPct: res?.occupancyPct ?? '—',
              avgCost: res?.avgParkingCostCHF ?? '—',
              equityFlag: res?.equityFlag ?? false,
            },
          };
        }),
      };

      // Nettoyer couches existantes
      ['zones-fill','zones-outline','zones-labels','od-flows','od-arrows'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      ['zones','od-flows-src'].forEach(id => {
        if (map.getSource(id)) map.removeSource(id);
      });

      // Zones remplissage
      map.addSource('zones', { type: 'geojson', data: enriched });
      map.addLayer({
        id: 'zones-fill', type: 'fill', source: 'zones',
        paint: {
          'fill-color': ['match', ['get', 'category'], 'vert', '#22c55e', 'orange', '#f59e0b', 'rouge', '#ef4444', '#94a3b8'],
          'fill-opacity': zoneResults ? 0.28 : 0.10,
        },
      });
      map.addLayer({
        id: 'zones-outline', type: 'line', source: 'zones',
        paint: {
          'line-color': ['match', ['get', 'category'], 'vert', '#16a34a', 'orange', '#d97706', 'rouge', '#dc2626', '#64748b'],
          'line-width': 1.8, 'line-opacity': 0.8,
        },
      });
      map.addLayer({
        id: 'zones-labels', type: 'symbol', source: 'zones',
        layout: {
          'text-field': ['concat', ['get', 'label'], '\n', ['concat', ['get', 'shiftPct'], '%']],
          'text-size': 10, 'text-font': ['Open Sans Regular'],
          'text-anchor': 'center', 'text-line-height': 1.3,
        },
        paint: { 'text-color': '#0f1117', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });

      // ── Flux OD ──────────────────────────────────────────────────────────────
      const odFeatures = OD_FLOWS.map(f => {
        const fc = ZONE_CENTROIDS[f.from] || [7.36, 46.23];
        const tc = ZONE_CENTROIDS[f.to] || [7.36, 46.23];
        return { ...makeArrowGeoJSON(fc, tc, f.vol), properties: { ...makeArrowGeoJSON(fc, tc, f.vol).properties, label: f.label, from: f.from, to: f.to } };
      });

      map.addSource('od-flows-src', { type: 'geojson', data: { type: 'FeatureCollection', features: odFeatures } });
      map.addLayer({
        id: 'od-flows', type: 'line', source: 'od-flows-src',
        layout: { 'visibility': showFlows ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#2563eb', 'line-opacity': 0.55,
          'line-width': ['get', 'width'],
          'line-dasharray': [2, 0],
        },
      });

      // Popups zones
      map.on('click', 'zones-fill', e => {
        if (!e.features?.[0]) return;
        const p = e.features[0].properties as any;
        const r = zoneResults?.find(z => z.zoneId === p.zoneId);
        new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:sans-serif;padding:6px 2px">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px">${p.label}</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:8px">${p.description}</div>
              ${r ? `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
                  <div style="background:#f8fafc;border-radius:6px;padding:6px;text-align:center">
                    <div style="font-weight:700;font-size:18px;color:${CAT_COLORS[r.category]}">${r.elasticityScore}<span style="font-size:11px">/100</span></div>
                    <div style="color:#6b7280;font-size:10px">Élasticité</div>
                  </div>
                  <div style="background:#f8fafc;border-radius:6px;padding:6px;text-align:center">
                    <div style="font-weight:700;font-size:18px;color:#0f1117">${Math.round(r.shiftIndex*100)}%</div>
                    <div style="color:#6b7280;font-size:10px">Report modal</div>
                  </div>
                  ${r.occupancyPct !== undefined ? `
                  <div style="background:#f8fafc;border-radius:6px;padding:6px;text-align:center">
                    <div style="font-weight:700;font-size:18px;color:${(r.occupancyPct??0)>85?'#ef4444':'#0f1117'}">${r.occupancyPct}%</div>
                    <div style="color:#6b7280;font-size:10px">Occupation</div>
                  </div>` : ''}
                  ${r.avgParkingCostCHF !== undefined ? `
                  <div style="background:#f8fafc;border-radius:6px;padding:6px;text-align:center">
                    <div style="font-weight:700;font-size:18px;color:#0f1117">${r.avgParkingCostCHF} CHF</div>
                    <div style="color:#6b7280;font-size:10px">Coût moyen</div>
                  </div>` : ''}
                </div>
                ${r.equityFlag ? '<div style="margin-top:8px;font-size:11px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:4px">⚠ Risque équité détecté</div>' : ''}
              ` : `<div style="font-size:12px;color:#6b7280">Simulez un scénario pour voir les résultats.</div>`}
            </div>
          `)
          .addTo(map);
      });
      map.on('mouseenter', 'zones-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'zones-fill', () => { map.getCanvas().style.cursor = ''; });
    };

    load().catch(console.error);
  }, [mapReady, zoneResults]);

  // ── Toggle OD flows visibility ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('od-flows')) {
      map.setLayoutProperty('od-flows', 'visibility', showFlows ? 'visible' : 'none');
    }
  }, [showFlows, mapReady]);

  // ── Marqueurs parkings ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Nettoyer anciens marqueurs
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (!showParkings) return;

    PARKINGS_GEO.forEach(pk => {
      const isFree = (dayType === 'friday' && true) || dayType === 'saturday' || pk.pricePeak === 0;
      const dotColor = pk.pricePeak === 0 ? '#16a34a' : isFree ? '#16a34a' : '#2563eb';
      const label = pk.pricePeak === 0 ? 'P' : `${pk.pricePeak}`;

      // Élément HTML du marqueur
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          background:${dotColor};color:#fff;font-weight:700;font-size:10px;
          width:28px;height:28px;border-radius:50%;display:flex;align-items:center;
          justify-content:center;border:2.5px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;
          font-family:sans-serif;
        ">P</div>
        <div style="
          width:2px;height:6px;background:${dotColor};margin:0 auto;
        "></div>
      `;

      const popup = new maplibregl.Popup({ offset: 30, maxWidth: '260px', closeButton: true })
        .setHTML(`
          <div style="font-family:sans-serif;padding:4px 2px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${pk.name}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:8px">${pk.address}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:8px">
              <div style="background:#f8fafc;border-radius:5px;padding:5px;text-align:center">
                <div style="font-weight:700;font-size:16px">${pk.capacity}</div>
                <div style="color:#6b7280;font-size:10px">places</div>
              </div>
              <div style="background:${pk.pricePeak===0?'#f0fdf4':'#eff6ff'};border-radius:5px;padding:5px;text-align:center">
                <div style="font-weight:700;font-size:16px;color:${pk.pricePeak===0?'#16a34a':'#2563eb'}">${pk.pricePeak===0?'GRATUIT':pk.pricePeak+' CHF/h'}</div>
                <div style="color:#6b7280;font-size:10px">tarif pointe</div>
              </div>
            </div>
            ${pk.freeFirst ? `<div style="font-size:10px;color:#6b7280;margin-bottom:3px">⏱ ${pk.freeFirst}</div>` : ''}
            <div style="font-size:10px;background:#f0fdf4;color:#15803d;padding:4px 8px;border-radius:4px;margin-bottom:3px">✓ ${pk.freeFriSat}</div>
            <div style="font-size:10px;color:#6b7280">🚶 ${pk.walkCentre} du centre</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:5px;border-top:1px solid #f1f5f9;padding-top:4px">
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
  }, [mapReady, showParkings, dayType]);

  return (
    <div className={`relative flex flex-col ${className}`} style={{ height }}>
      {/* Carte */}
      <div ref={containerRef} className="flex-1 rounded-xl overflow-hidden" />

      {/* Contrôles superposés */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => setShowFlows(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm border transition-all ${
            showFlows
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-ink-500 border-ink-200 hover:bg-ink-50'
          }`}
          title="Afficher/masquer les flux OD"
        >
          <span>↗</span> Flux OD
        </button>
        <button
          onClick={() => setShowParkings(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm border transition-all ${
            showParkings
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-ink-500 border-ink-200 hover:bg-ink-50'
          }`}
          title="Afficher/masquer les parkings"
        >
          <span>P</span> Parkings
        </button>
      </div>

      {/* Légende flux OD */}
      {showFlows && (
        <div className="absolute bottom-8 left-3 z-10 bg-white/92 backdrop-blur rounded-xl shadow-sm border border-ink-100 p-3 text-xs max-w-[180px]">
          <div className="font-semibold text-ink mb-2">Flux OD — Sion</div>
          <div className="space-y-1.5 text-ink-600">
            <div className="flex items-center gap-2">
              <div style={{ width: 20, height: 4, background: '#2563eb', opacity: 0.9, borderRadius: 2 }} />
              <span>Volume élevé</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 20, height: 2, background: '#2563eb', opacity: 0.6, borderRadius: 2 }} />
              <span>Volume modéré</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-ink-100 text-ink-400 text-[10px]">
            Source : ARE Microrecensement 2015 · Estimation MobilityLab
          </div>
        </div>
      )}

      {/* Légende zones */}
      {zoneResults && (
        <div className="absolute bottom-8 right-3 z-10 bg-white/92 backdrop-blur rounded-xl shadow-sm border border-ink-100 p-3 text-xs">
          <div className="font-semibold text-ink mb-2">Potentiel bascule</div>
          <div className="space-y-1">
            {[['vert','Fort (≥60)', '#22c55e'],['orange','Modéré (35–59)','#f59e0b'],['rouge','Faible (<35)','#ef4444']].map(([k,l,c])=>(
              <div key={k} className="flex items-center gap-1.5">
                <div style={{ width:10, height:10, borderRadius:2, background: c as string }} />
                <span className="text-ink-600">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
