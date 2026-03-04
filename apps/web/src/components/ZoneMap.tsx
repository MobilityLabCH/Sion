/**
 * ZoneMap.tsx -- Carte interactive parkings et zones Sion
 * VERSION 4 : GPS precis, zone hopital/SUVA, 10 parkings, zones horodateurs
 *
 * Sources GPS :
 *   Hopital Sion : Av. Grand-Champsec 80 -> [7.3843, 46.2315]
 *   SUVA/CRR     : Av. Grand-Champsec 90 -> [7.3850, 46.2325]
 *   P+R Potences : Av. des Echutes         -> [7.3225, 46.2260]
 *   P+R Stade    : Rue des Echutes         -> [7.3835, 46.2250]
 *   Roches-Brunes: Av. de Tourbillon       -> [7.3742, 46.2308]
 *
 * Chemin : apps/web/src/components/ZoneMap.tsx
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ZoneResult, Scenario } from '../types';

interface ZoneMapProps {
  zoneResults?: ZoneResult[];
  height?: string;
  className?: string;
  scenario?: Scenario;
  onParkingPriceChange?: (parkingId: string, newPrice: number) => void;
}

// ─── ZONES -- polygones calibres sur OSM/cadastre ────────────────────────────

const ZONES = [
  {
    id: 'centre', label: 'Centre-ville', color: '#ef4444',
    description: '3 parkings publics couverts -- 1424 pl. -- Hyper-centre + Centre (Zone 1+2 horodateurs)',
    coords: [[
      [7.3510, 46.2298], [7.3530, 46.2282], [7.3560, 46.2271],
      [7.3635, 46.2274], [7.3682, 46.2283], [7.3695, 46.2306],
      [7.3685, 46.2348], [7.3655, 46.2364], [7.3597, 46.2368],
      [7.3548, 46.2363], [7.3515, 46.2342], [7.3505, 46.2318],
      [7.3510, 46.2298],
    ]],
  },
  {
    id: 'gare', label: 'Gare CFF', color: '#f97316',
    description: 'Pole multimodal CFF -- ~300 pl. -- Zone 3 horodateurs',
    coords: [[
      [7.3472, 46.2251], [7.3518, 46.2245], [7.3568, 46.2251],
      [7.3590, 46.2269], [7.3568, 46.2285], [7.3518, 46.2292],
      [7.3470, 46.2281], [7.3456, 46.2266], [7.3472, 46.2251],
    ]],
  },
  {
    id: 'hopital', label: 'Champsec / Hopital', color: '#8b5cf6',
    description: 'Hopital de Sion (Av. Grand-Champsec 80) + CRR-SUVA (no 90) -- hors centre-ville',
    coords: [[
      [7.3780, 46.2298], [7.3870, 46.2295], [7.3900, 46.2315],
      [7.3892, 46.2355], [7.3845, 46.2368], [7.3782, 46.2360],
      [7.3755, 46.2335], [7.3770, 46.2310], [7.3780, 46.2298],
    ]],
  },
  {
    id: 'nord', label: 'Sion-Nord', color: '#3b82f6',
    description: 'Parking Nord 282 pl. -- Zones residentielles nord (Vissigen, Gravelone)',
    coords: [[
      [7.3510, 46.2368], [7.3600, 46.2368], [7.3685, 46.2360],
      [7.3720, 46.2385], [7.3705, 46.2435], [7.3640, 46.2458],
      [7.3555, 46.2462], [7.3482, 46.2424], [7.3472, 46.2385],
      [7.3492, 46.2368], [7.3510, 46.2368],
    ]],
  },
  {
    id: 'emploi', label: 'Zone Industrielle', color: '#ec4899',
    description: 'Ronquoz -- CERM -- HES-SO Valais -- ~1200 pl. privees gratuites',
    coords: [[
      [7.3272, 46.2168], [7.3385, 46.2162], [7.3508, 46.2168],
      [7.3535, 46.2196], [7.3522, 46.2228], [7.3458, 46.2242],
      [7.3375, 46.2248], [7.3295, 46.2238], [7.3258, 46.2215],
      [7.3272, 46.2168],
    ]],
  },
  {
    id: 'peripherie', label: 'P+R Peripherie', color: '#14b8a6',
    description: 'P+R Potences 450 pl. (Ouest) + P+R Stade 460 pl. (Est) -- gratuits -- BS11 10 min',
    coords: [[
      [7.3160, 46.2195], [7.3325, 46.2195], [7.3338, 46.2258],
      [7.3318, 46.2302], [7.3285, 46.2322], [7.3192, 46.2312],
      [7.3158, 46.2260], [7.3160, 46.2195],
    ]],
  },
] as const;

// ─── PARKINGS -- coordonnees GPS verifiees ────────────────────────────────────

type ParkingType = 'centre' | 'gare' | 'hopital' | 'pericentre' | 'pr';

interface ParkingDef {
  id: string;
  name: string;
  shortName: string;
  coords: [number, number];
  capacity: number;
  basePriceCHFh: number;
  priceNote: string;
  freeRules: string;
  type: ParkingType;
  editable: boolean;
  walkMinCentre: number;
  source: string;
  confidence: 'Officiel' | 'Estime';
}

const PARKINGS: ParkingDef[] = [
  {
    id: 'planta', name: 'Parking de la Planta', shortName: 'Planta',
    coords: [7.3598, 46.2328], capacity: 562, basePriceCHFh: 3.0,
    priceNote: '1h gratuite · CHF 3/h (h2+) · abo pendulaire CHF 160/mois',
    freeRules: 'Gratuit 12h-13h30 · ven.17h-sam.24h · nuits · dim.',
    type: 'centre', editable: true, walkMinCentre: 3,
    source: 'sion.ch PDF 15.07.2024', confidence: 'Officiel',
  },
  {
    id: 'scex', name: 'Parking du Scex', shortName: 'Scex',
    coords: [7.3630, 46.2298], capacity: 658, basePriceCHFh: 3.0,
    priceNote: '1h gratuite · CHF 3/h (h2+) · abo pendulaire CHF 160/mois',
    freeRules: 'Gratuit 12h-13h30 · ven.17h-sam.24h · nuits · dim.',
    type: 'centre', editable: true, walkMinCentre: 4,
    source: 'sion.ch PDF 11.08.2025', confidence: 'Officiel',
  },
  {
    id: 'cible', name: 'Parking de la Cible', shortName: 'Cible',
    coords: [7.3558, 46.2345], capacity: 204, basePriceCHFh: 3.0,
    priceNote: '~CHF 3/h · tarif presume identique Planta/Scex',
    freeRules: 'Presume idem Planta/Scex',
    type: 'centre', editable: true, walkMinCentre: 5,
    source: 'sion.ch (estime)', confidence: 'Estime',
  },
  {
    id: 'roches', name: 'Parking Roches-Brunes', shortName: 'Roches-Brunes',
    coords: [7.3742, 46.2308], capacity: 370, basePriceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (tarif preferentiel estime)',
    freeRules: 'Details a confirmer aupres de la Ville',
    type: 'pericentre', editable: false, walkMinCentre: 12,
    source: 'scan-park.com · sion.ch', confidence: 'Estime',
  },
  {
    id: 'stguerin', name: 'Parking St-Guerin', shortName: 'St-Guerin',
    coords: [7.3602, 46.2282], capacity: 66, basePriceCHFh: 1.5,
    priceNote: '~CHF 1.50/h (tarif preferentiel estime)',
    freeRules: 'Details a confirmer aupres de la Ville',
    type: 'pericentre', editable: false, walkMinCentre: 8,
    source: 'sion.ch stationnement', confidence: 'Estime',
  },
  {
    id: 'gare', name: 'Parking Gare CFF', shortName: 'Gare CFF',
    coords: [7.3521, 46.2263], capacity: 300, basePriceCHFh: 2.0,
    priceNote: '~CHF 2.00/h (tarif CFF estime)',
    freeRules: 'Modalites CFF a confirmer',
    type: 'gare', editable: false, walkMinCentre: 10,
    source: 'CFF / estimation', confidence: 'Estime',
  },
  {
    id: 'hopital-sion', name: 'Parking Hopital de Sion', shortName: 'Hopital',
    coords: [7.3843, 46.2318], capacity: 250, basePriceCHFh: 2.0,
    priceNote: 'Tarif visiteurs (estime) · employes abonnes',
    freeRules: 'Parking visiteurs payant · abonnes personnel',
    type: 'hopital', editable: false, walkMinCentre: 22,
    source: 'hopitalduvalais.ch · Av. Grand-Champsec 80', confidence: 'Estime',
  },
  {
    id: 'suva-crr', name: 'Parking CRR-SUVA', shortName: 'CRR-SUVA',
    coords: [7.3852, 46.2328], capacity: 150, basePriceCHFh: 0,
    priceNote: 'Gratuit · prive patients/employes CRR',
    freeRules: 'Reserve patients et employes de la clinique',
    type: 'hopital', editable: false, walkMinCentre: 24,
    source: 'crr-suva.ch · Av. Grand-Champsec 90', confidence: 'Estime',
  },
  {
    id: 'pr-potences', name: 'P+R Potences (Sion-Ouest)', shortName: 'P+R Potences',
    coords: [7.3225, 46.2260], capacity: 450, basePriceCHFh: 0,
    priceNote: 'GRATUIT · BS11 vers centre toutes 10 min en pointe',
    freeRules: 'Gratuit permanence · bus BS11 direct centre-ville',
    type: 'pr', editable: true, walkMinCentre: 0,
    source: 'sion.ch · CarPostal 2025', confidence: 'Officiel',
  },
  {
    id: 'pr-stade', name: 'P+R Stade / Echutes', shortName: 'P+R Stade',
    coords: [7.3835, 46.2252], capacity: 460, basePriceCHFh: 0,
    priceNote: 'GRATUIT · BS11 vers centre toutes 10 min en pointe',
    freeRules: 'Gratuit permanence · bus BS11 direct centre-ville',
    type: 'pr', editable: true, walkMinCentre: 0,
    source: 'sion.ch · CarPostal 2025', confidence: 'Officiel',
  },
];

const MARKER_BG: Record<ParkingType, string> = {
  centre:     '#2563eb',
  gare:       '#f97316',
  hopital:    '#8b5cf6',
  pericentre: '#6366f1',
  pr:         '#16a34a',
};

const MARKER_LABEL: Record<ParkingType, string> = {
  centre:     'Centre',
  gare:       'Gare',
  hopital:    'Hopital',
  pericentre: 'Pericentre',
  pr:         'P+R',
};

// ─── Panel edition parking ────────────────────────────────────────────────────

function ParkingPanel({ pk, scenarioPrice, onClose, onApply }: {
  pk: ParkingDef;
  scenarioPrice: number;
  onClose: () => void;
  onApply: (price: number) => void;
}) {
  const [price, setPrice] = useState(scenarioPrice);
  const col = MARKER_BG[pk.type];
  const occBase = pk.type === 'centre' ? 82 : pk.type === 'pr' ? 32 : 60;
  const occ = Math.min(98, Math.max(5, occBase - Math.round((price - pk.basePriceCHFh) * 10)));

  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, width: 280, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '1.5px solid #e5e7eb', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{pk.name}</span>
        </div>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: 6, width: 22, height: 22, fontSize: 11, fontWeight: 800, color: '#6b7280' }}>X</button>
      </div>

      <div style={{ padding: '12px 14px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          <div style={{ background: '#f8fafc', borderRadius: 7, padding: '7px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>{pk.capacity}</div>
            <div style={{ fontSize: 8, color: '#9ca3af' }}>places</div>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 7, padding: '7px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: occ > 85 ? '#dc2626' : occ > 70 ? '#d97706' : '#16a34a' }}>{occ}%</div>
            <div style={{ fontSize: 8, color: '#9ca3af' }}>occupation</div>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 7, padding: '7px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#374151' }}>{pk.walkMinCentre > 0 ? pk.walkMinCentre + 'min' : 'Bus'}</div>
            <div style={{ fontSize: 8, color: '#9ca3af' }}>{pk.walkMinCentre > 0 ? 'marche' : 'BS11'}</div>
          </div>
        </div>

        {pk.editable ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 8 }}>
              Modifier le tarif horaire
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: '#374151' }}>Tarif horaire</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: price === 0 ? '#16a34a' : col }}>
                {price === 0 ? 'GRATUIT' : 'CHF ' + price.toFixed(2) + '/h'}
              </span>
            </div>
            <input
              type="range" min={0} max={8} step={0.5} value={price}
              onChange={e => setPrice(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: col, marginBottom: 6 }}
            />
            <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 10 }}>
              Baseline : CHF {pk.basePriceCHFh.toFixed(2)}/h
            </div>
            <div style={{ fontSize: 10, color: '#374151', background: '#f8fafc', padding: '6px 8px', borderRadius: 7, marginBottom: 10, lineHeight: 1.5 }}>
              {pk.freeRules}
            </div>
            <button
              onClick={() => onApply(price)}
              style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: col, color: 'white', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              Appliquer au scenario
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, background: '#fffbeb', color: '#92400e', padding: '6px 10px', borderRadius: 8, marginBottom: 8, lineHeight: 1.5 }}>
              Pas de levier direct pour la Ville · Gere par {pk.type === 'gare' ? 'CFF' : pk.type === 'hopital' ? 'CHVR / CRR-SUVA' : 'gestionnaire prive'}
            </div>
            <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>
              <strong>Tarif :</strong> {pk.priceNote}
            </div>
            {pk.walkMinCentre > 0 && (
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                A pied du centre : ~{pk.walkMinCentre} min
              </div>
            )}
          </>
        )}

        <div style={{ fontSize: 8, color: '#d1d5db', borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 8 }}>
          {pk.source} · {pk.confidence === 'Officiel' ? 'Donne officielle' : 'Estimation -- a verifier'}
        </div>
      </div>
    </div>
  );
}

// ─── ZoneMap ──────────────────────────────────────────────────────────────────

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
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '(c) OpenStreetMap contributors' } },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [7.358, 46.231],
      zoom: 12.9,
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
      ['fill', 'outline', 'label'].forEach(t => { if (map.getLayer('z-' + t + '-' + z.id)) map.removeLayer('z-' + t + '-' + z.id); });
      if (map.getSource('z-' + z.id))    map.removeSource('z-' + z.id);
      if (map.getSource('zlbl-' + z.id)) map.removeSource('zlbl-' + z.id);
    });

    ZONES.forEach(z => {
      const res = zoneResults?.find(r => r.zoneId === z.id);
      const cat = res?.category;
      const fillColor = cat === 'vert' ? '#22c55e' : cat === 'orange' ? '#f59e0b' : cat === 'rouge' ? '#ef4444' : z.color;
      const centrePrix = scenario?.centrePeakPriceCHFh ?? 3.0;

      map.addSource('z-' + z.id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { zoneId: z.id },
          geometry: { type: 'Polygon', coordinates: z.coords as unknown as [number, number][][] },
        },
      });
      map.addLayer({ id: 'z-fill-' + z.id,    type: 'fill', source: 'z-' + z.id, paint: { 'fill-color': fillColor, 'fill-opacity': res ? 0.28 : 0.10 } });
      map.addLayer({ id: 'z-outline-' + z.id, type: 'line', source: 'z-' + z.id, paint: { 'line-color': z.color, 'line-width': 1.8, 'line-opacity': 0.75 } });

      const pts = (z.coords[0] as unknown as [number, number][]).slice(0, -1);
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const txt = res ? z.label + '\n' + Math.round(res.shiftIndex * 100) + '%' : z.label;

      map.addSource('zlbl-' + z.id, { type: 'geojson', data: { type: 'Feature', properties: { t: txt }, geometry: { type: 'Point', coordinates: [cx, cy] } } });
      map.addLayer({ id: 'z-label-' + z.id, type: 'symbol', source: 'zlbl-' + z.id, layout: { 'text-field': ['get', 't'], 'text-size': 10, 'text-font': ['Open Sans Regular'], 'text-anchor': 'center', 'text-line-height': 1.3 }, paint: { 'text-color': '#111827', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 2 } });

      map.on('click', 'z-fill-' + z.id, (e) => {
        const shiftStr = res ? Math.round(res.shiftIndex * 100) + '% report modal estime' : 'Simulez pour voir les resultats';
        const catColor = cat === 'vert' ? '#22c55e' : cat === 'orange' ? '#f59e0b' : '#ef4444';
        new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(
            '<div style="font-family:\'DM Sans\',sans-serif;padding:2px 0">' +
            '<div style="font-weight:800;font-size:14px;margin-bottom:3px">' + z.label + '</div>' +
            '<div style="font-size:10px;color:#6b7280;margin-bottom:8px;line-height:1.5">' + z.description + '</div>' +
            (res
              ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
                '<div style="background:#f8fafc;border-radius:8px;padding:8px;text-align:center"><div style="font-weight:900;font-size:22px;color:' + catColor + '">' + res.elasticityScore + '</div><div style="color:#9ca3af;font-size:9px">Elasticite /100</div></div>' +
                '<div style="background:#f8fafc;border-radius:8px;padding:8px;text-align:center"><div style="font-weight:900;font-size:22px;color:#111827">' + Math.round(res.shiftIndex * 100) + '%</div><div style="color:#9ca3af;font-size:9px">Report modal</div></div>' +
                '</div>' +
                (res.equityFlag ? '<div style="margin-top:6px;font-size:10px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:6px">Risque equite : ' + (res.equityReason ?? 'profils vulnerables') + '</div>' : '')
              : '<div style="font-size:11px;color:#9ca3af;padding:8px 0">Lancez une simulation pour voir les resultats par zone.</div>'
            ) +
            (z.id === 'centre'
              ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:10px;color:#374151">' +
                'Tarif simule : <strong>' + (centrePrix === 0 ? 'GRATUIT' : 'CHF ' + centrePrix.toFixed(1) + '/h') + '</strong></div>'
              : ''
            ) +
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
      const price = pk.type === 'centre' ? centrePrix : pk.type === 'pr' ? prPrix : pk.basePriceCHFh;
      let bgColor = MARKER_BG[pk.type];
      if (pk.type === 'centre') {
        if (centrePrix > pk.basePriceCHFh + 0.1)      bgColor = '#dc2626';
        else if (centrePrix < pk.basePriceCHFh - 0.1) bgColor = '#16a34a';
        else                                            bgColor = '#2563eb';
      }
      if (pk.type === 'pr' && prPrix > 0) bgColor = '#d97706';

      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';

      const capacityLabel = pk.capacity >= 400 ? pk.capacity + 'pl' : pk.capacity + '';
      const badge = document.createElement('div');
      badge.style.cssText = [
        'background:' + bgColor,
        'color:white', 'font-weight:800', 'font-size:10px',
        'min-width:30px', 'height:26px', 'border-radius:7px',
        'display:flex', 'align-items:center', 'justify-content:center',
        'border:2.5px solid white',
        'box-shadow:0 2px 8px rgba(0,0,0,.28)',
        'padding:0 6px', 'white-space:nowrap', 'gap:3px',
        'transition:transform .15s',
      ].join(';');

      const priceStr = price === 0 ? 'GRAT.' : 'CHF ' + price.toFixed(1);
      badge.textContent = pk.shortName;

      const tip = document.createElement('div');
      tip.style.cssText = 'font-size:9px;color:white;background:' + bgColor + ';padding:0 5px;border-radius:0 0 5px 5px;opacity:.9;white-space:nowrap;';
      tip.textContent = priceStr + ' · ' + capacityLabel;

      el.appendChild(badge);
      el.appendChild(tip);

      el.addEventListener('click', e => { e.stopPropagation(); setEditParking(prev => prev?.id === pk.id ? null : pk); });
      el.addEventListener('mouseenter', () => { badge.style.transform = 'scale(1.12)'; });
      el.addEventListener('mouseleave', () => { badge.style.transform = 'scale(1)'; });

      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(pk.coords).addTo(map)
      );
    });
  }, [mapReady, showParkings, scenario?.centrePeakPriceCHFh, scenario?.peripheriePeakPriceCHFh]);

  useEffect(() => { buildMarkers(); }, [buildMarkers]);

  const centrePrix = scenario?.centrePeakPriceCHFh ?? 3.0;
  const prPrix     = scenario?.peripheriePeakPriceCHFh ?? 0;

  const selPrice = editParking
    ? (editParking.type === 'centre' ? centrePrix : editParking.type === 'pr' ? prPrix : editParking.basePriceCHFh)
    : 0;

  return (
    <div style={{ height, position: 'relative', display: 'flex', flexDirection: 'column' as const }} className={className}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />

      {/* Bouton toggle parkings */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 6 }}>
        <button
          onClick={() => setShowParkings(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', borderColor: showParkings ? '#2563eb' : '#e5e7eb', background: showParkings ? '#2563eb' : 'rgba(255,255,255,.95)', color: showParkings ? 'white' : '#6b7280', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}
        >
          P Parkings {showParkings ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Panel edition */}
      {editParking && (
        <ParkingPanel
          pk={editParking}
          scenarioPrice={selPrice}
          onClose={() => setEditParking(null)}
          onApply={price => {
            if (onParkingPriceChange) onParkingPriceChange(editParking.id, price);
            setEditParking(null);
          }}
        />
      )}

      {/* Legende */}
      {!editParking && (
        <div style={{ position: 'absolute', bottom: 30, left: 12, zIndex: 10, background: 'rgba(255,255,255,.96)', borderRadius: 12, padding: '10px 13px', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Parkings Sion</div>
          {[
            { col: '#2563eb', label: 'Centre (1 424 pl.)', sub: 'CHF ' + centrePrix.toFixed(1) + '/h' },
            { col: '#f97316', label: 'Gare CFF (~300 pl.)', sub: '~CHF 2.00/h' },
            { col: '#8b5cf6', label: 'Hopital/SUVA (400 pl.)', sub: 'Prive/visiteurs' },
            { col: '#6366f1', label: 'Pericentre (436 pl.)', sub: '~CHF 1.50/h' },
            { col: '#16a34a', label: 'P+R (910 pl.)', sub: prPrix > 0 ? 'CHF ' + prPrix.toFixed(1) + '/h' : 'GRATUIT' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 3, background: item.col, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: '#374151', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 8, color: '#9ca3af' }}>{item.sub}</div>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 5, marginTop: 2, fontSize: 8, color: '#9ca3af' }}>
            Clic sur marqueur pour modifier
          </div>
        </div>
      )}

      {/* Legende bascule */}
      {zoneResults && zoneResults.length > 0 && !editParking && (
        <div style={{ position: 'absolute', bottom: 30, right: 12, zIndex: 10, background: 'rgba(255,255,255,.96)', borderRadius: 12, padding: '10px 13px', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Report modal / zone</div>
          {[
            { label: 'Fort (>60%)',    color: '#22c55e' },
            { label: 'Moyen (35-60%)', color: '#f59e0b' },
            { label: 'Faible (<35%)', color: '#ef4444' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: 3, background: item.color }} />
              <span style={{ color: '#374151' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
