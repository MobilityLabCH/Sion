/**
 * ODPage.tsx -- Accessibilite TP depuis les communes de Sion
 * Chemin : apps/web/src/pages/ODPage.tsx
 *
 * Affiche pour chaque commune : temps voiture vs TP, ratio captivite,
 * cout compare et potentiel P+R.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
  tpTicketCHF: number;
  prPotential: boolean;
  prId?: string;
  prNote?: string;
  demand: { centre: number; gare: number; emploi: number };
}

type Destination = 'centre' | 'gare' | 'emploi';
type CaptClass   = 'ok' | 'moyen' | 'captif';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEST_COORDS: Record<Destination, [number, number]> = {
  centre: [7.3595, 46.2333],
  gare:   [7.3521, 46.2278],
  emploi: [7.3380, 46.2195],
};

const DEST_LABELS: Record<Destination, string> = {
  centre: 'Centre-ville',
  gare:   'Gare CFF',
  emploi: 'Zone Industrielle',
};

const DEST_EMOJI: Record<Destination, string> = {
  centre: '🏛',
  gare:   '🚉',
  emploi: '🏭',
};

const PR_NODES: Record<string, { label: string; coords: [number, number]; cap: number; busMin: number }> = {
  potences: { label: 'P+R Potences', coords: [7.3240, 46.2268], cap: 450, busMin: 12 },
  stade:    { label: 'P+R Stade',    coords: [7.3840, 46.2330], cap: 460, busMin: 10 },
};

const CAP_COLOR: Record<CaptClass, string> = {
  ok:     '#22c55e',
  moyen:  '#f59e0b',
  captif: '#ef4444',
};

const CAP_BG: Record<CaptClass, string> = {
  ok:     '#f0fdf4',
  moyen:  '#fffbeb',
  captif: '#fef2f2',
};

const CAP_LABEL: Record<CaptClass, string> = {
  ok:     'TP competitif',
  moyen:  'TP acceptable',
  captif: 'Captif voiture',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function captClass(carMin: number, tpMin: number): CaptClass {
  const r = tpMin / carMin;
  if (r < 1.2) return 'ok';
  if (r < 1.6) return 'moyen';
  return 'captif';
}

function captRatio(carMin: number, tpMin: number): number {
  return Math.round((tpMin / carMin) * 100) / 100;
}

function arcCoords(from: [number, number], to: [number, number]): [number, number][] {
  const n = 40;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const cx = (from[0] + to[0]) / 2 - dy * 0.25;
  const cy = (from[1] + to[1]) / 2 + dx * 0.25;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push([
      mt * mt * from[0] + 2 * mt * t * cx + t * t * to[0],
      mt * mt * from[1] + 2 * mt * t * cy + t * t * to[1],
    ]);
  }
  return pts;
}

// Parking centre Sion : 1h gratuite puis 3 CHF/h
function parkingCost(durationH: number, isFreeDay: boolean): number {
  if (isFreeDay) return 0;
  if (durationH <= 1) return 0;
  return (durationH - 1) * 3.0;
}

// Valeur du temps moyenne (navetteur moyen Sion)
const VOT = 22; // CHF/h

function carCost(o: Origin, durationH: number, isFreeDay: boolean): number {
  const park    = parkingCost(durationH, isFreeDay);
  const timeVal = (o.carTimeMin / 60) * VOT;
  const distKm  = (o.carTimeMin / 60) * 40 * 0.18; // 40 km/h moy, 0.18 CHF/km
  return park + timeVal + distKm + 1.2; // 1.2 = friction stationnement
}

function tpCost(o: Origin, halfFare: boolean): number {
  const ticket  = o.tpTicketCHF * (halfFare ? 0.5 : 1);
  const wait    = (o.tpFreqPeakMin / 2 / 60) * VOT;
  const timeVal = (o.tpTimeMin / 60) * VOT;
  return ticket + wait + timeVal;
}

function prCost(o: Origin): number | null {
  if (!o.prPotential || !o.prId) return null;
  const pr = PR_NODES[o.prId];
  if (!pr) return null;
  const driveFrac  = 0.4; // 40% du temps voiture pour rejoindre P+R
  const driveMin   = o.carTimeMin * driveFrac;
  const distKm     = (driveMin / 60) * 40 * 0.18;
  const timeTotal  = driveMin + pr.busMin + 5; // +5 correspondance
  return 2.20 + (timeTotal / 60) * VOT + distKm;
}

// ─── Composant ODSimulator ────────────────────────────────────────────────────

function ODSimulator() {
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const layersRef  = useRef<string[]>([]);
  const sourcesRef = useRef<string[]>([]);

  const [origins,  setOrigins]  = useState<Origin[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [search,   setSearch]   = useState('');
  const [sel,      setSel]      = useState<Origin | null>(null);
  const [dest,     setDest]     = useState<Destination>('centre');
  const [dur,      setDur]      = useState<number>(2);
  const [freeDay,  setFreeDay]  = useState(false);
  const [halfFare, setHalfFare] = useState(false);

  // Chargement donnees OD
  useEffect(() => {
    const API = (import.meta as any).env?.VITE_API_URL ?? 'https://sion.ericimstepf.workers.dev/api';
    fetch(API + '/data')
      .then(r => r.json())
      .then((d: any) => { setOrigins(d.origins ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Init carte
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    try {
      const map = new maplibregl.Map({
        container: mapDivRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '(c) OpenStreetMap',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [7.363, 46.232],
        zoom: 10.5,
        attributionControl: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.on('load', () => setMapReady(true));
      map.on('error', () => setMapError(true));
      mapRef.current = map;
    } catch (_) {
      setMapError(true);
    }
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Marqueurs origines
  const buildMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !origins.length) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    origins.forEach(o => {
      const cls = captClass(o.carTimeMin, o.tpTimeMin);
      const col = CAP_COLOR[cls];
      const el  = document.createElement('div');
      el.title  = o.label;
      el.style.cssText = [
        'width:36px', 'height:36px', 'border-radius:50%',
        'background:' + col, 'border:3px solid white',
        'box-shadow:0 2px 8px rgba(0,0,0,.3)', 'cursor:pointer',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-size:14px', 'transition:transform .15s',
      ].join(';');
      el.textContent = o.emoji;
      el.addEventListener('click', () => setSel(prev => prev?.id === o.id ? null : o));
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(o.coords).addTo(map)
      );
    });

    // Marqueurs destinations
    const destList: Destination[] = ['centre', 'gare', 'emploi'];
    destList.forEach(d => {
      const el = document.createElement('div');
      el.style.cssText = [
        'width:32px', 'height:32px', 'border-radius:7px',
        'background:#1e3a5f', 'border:2px solid white',
        'box-shadow:0 2px 8px rgba(0,0,0,.4)',
        'display:flex', 'align-items:center', 'justify-content:center', 'font-size:15px',
      ].join(';');
      el.textContent = DEST_EMOJI[d];
      el.title = DEST_LABELS[d];
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(DEST_COORDS[d]).addTo(map);
    });

    // Marqueurs P+R
    Object.values(PR_NODES).forEach(pr => {
      const el = document.createElement('div');
      el.style.cssText = [
        'padding:3px 8px', 'border-radius:10px', 'background:#16a34a',
        'border:2px solid white', 'font-size:10px', 'font-weight:700',
        'color:white', 'white-space:nowrap', 'cursor:default',
      ].join(';');
      el.textContent = 'P+R ' + pr.cap + 'pl.';
      el.title = pr.label;
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(pr.coords).addTo(map);
    });
  }, [origins]);

  useEffect(() => { if (mapReady && origins.length) buildMarkers(); }, [mapReady, buildMarkers]);

  // Arc vers destination selectionnee
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    layersRef.current.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
    sourcesRef.current.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
    layersRef.current  = [];
    sourcesRef.current = [];
    if (!sel) return;

    const dc = DEST_COORDS[dest];

    const addArc = (sid: string, lid: string, from: [number, number], to: [number, number], color: string, width: number, dash: number[] | null) => {
      map.addSource(sid, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arcCoords(from, to) } },
      });
      const paint: Record<string, unknown> = { 'line-color': color, 'line-width': width, 'line-opacity': 0.85 };
      if (dash) paint['line-dasharray'] = dash;
      map.addLayer({ id: lid, type: 'line', source: sid, paint: paint as any });
      sourcesRef.current.push(sid);
      layersRef.current.push(lid);
    };

    addArc('arc-main', 'lay-main', sel.coords, dc, '#3b82f6', 3, null);

    if (sel.prPotential && sel.prId) {
      const pr = PR_NODES[sel.prId];
      if (pr) {
        addArc('arc-pr1', 'lay-pr1', sel.coords, pr.coords, '#16a34a', 2.5, [5, 3]);
        addArc('arc-pr2', 'lay-pr2', pr.coords, dc, '#16a34a', 3, null);
      }
    }

    map.fitBounds(new maplibregl.LngLatBounds(sel.coords, dc), { padding: 100, maxZoom: 13, duration: 600 });
  }, [sel, dest, mapReady]);

  // Calcul couts
  const car  = sel ? carCost(sel, dur, freeDay) : 0;
  const tp   = sel ? tpCost(sel, halfFare) : 0;
  const pr   = sel ? prCost(sel) : null;
  const cls  = sel ? captClass(sel.carTimeMin, sel.tpTimeMin) : null;
  const rat  = sel ? captRatio(sel.carTimeMin, sel.tpTimeMin) : null;
  const save = sel && tp < car ? car - tp : 0;
  const saveYear = Math.round(save * 2 * 220);

  const counts = {
    ok:     origins.filter(o => captClass(o.carTimeMin, o.tpTimeMin) === 'ok').length,
    moyen:  origins.filter(o => captClass(o.carTimeMin, o.tpTimeMin) === 'moyen').length,
    captif: origins.filter(o => captClass(o.carTimeMin, o.tpTimeMin) === 'captif').length,
  };

  const filtered = origins
    .filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => captRatio(b.carTimeMin, b.tpTimeMin) - captRatio(a.carTimeMin, a.tpTimeMin));

  // ── Styles inline utilitaires ─────────────────────────────────────────────

  const pill = (active: boolean, col: string): React.CSSProperties => ({
    flex: 1, padding: '5px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', border: '1.5px solid', textAlign: 'center',
    borderColor: active ? col : '#e5e7eb',
    background: active ? col + '18' : 'white',
    color: active ? col : '#6b7280',
  });

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: "'DM Sans','Inter',sans-serif" }}>

      {/* CARTE */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {mapError ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', gap: 12 }}>
            <div style={{ fontSize: 40 }}>🗺️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Carte indisponible</div>
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', maxWidth: 260 }}>Utilisez la liste a droite</div>
          </div>
        ) : (
          <div ref={mapDivRef} style={{ height: '100%' }} />
        )}

        {/* Compteur captivite */}
        {!mapError && origins.length > 0 && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'rgba(255,255,255,.95)', borderRadius: 12, padding: '7px 14px', boxShadow: '0 2px 12px rgba(0,0,0,.1)', display: 'flex', gap: 14 }}>
            {(['ok', 'moyen', 'captif'] as CaptClass[]).map(c => (
              <div key={c} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: CAP_COLOR[c] }}>{counts[c]}</div>
                <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                  {c === 'ok' ? 'OK TP' : c === 'moyen' ? 'Moyens' : 'Captifs'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legende */}
        {!mapError && (
          <div style={{ position: 'absolute', bottom: 30, left: 12, zIndex: 10, background: 'rgba(255,255,255,.95)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>Captivite voiture</div>
            {(['ok', 'moyen', 'captif'] as CaptClass[]).map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontSize: 11 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: CAP_COLOR[c] }} />
                <span style={{ color: '#374151' }}>{CAP_LABEL[c]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PANNEAU DROIT */}
      <div style={{ width: 370, background: 'white', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Controles */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Accessibilite TP depuis les communes</div>

          {/* Destination */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Destination dans Sion</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['centre', 'gare', 'emploi'] as Destination[]).map(d => (
                <button key={d} onClick={() => setDest(d)} style={pill(dest === d, '#2563eb')}>
                  {DEST_EMOJI[d]} {DEST_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Duree + options */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Duree parking</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 4].map(d => (
                  <button key={d} onClick={() => setDur(d)} style={pill(dur === d, '#7c3aed')}>
                    {d}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
              <input type="checkbox" checked={freeDay} onChange={e => setFreeDay(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#d97706' }} />
              Parking gratuit (ven./sam.)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
              <input type="checkbox" checked={halfFare} onChange={e => setHalfFare(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#2563eb' }} />
              Demi-tarif CFF
            </label>
          </div>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sel && cls && rat !== null ? (

            /* DETAIL COMMUNE */
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{sel.emoji} {sel.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    vers {DEST_LABELS[dest]} -- {sel.population.toLocaleString('fr-CH')} hab.
                  </div>
                </div>
                <button onClick={() => setSel(null)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#6b7280', borderRadius: 7, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
                  X
                </button>
              </div>

              {/* Badge captivite */}
              <div style={{ padding: '9px 12px', borderRadius: 10, marginBottom: 12, background: CAP_BG[cls], border: '1.5px solid ' + CAP_COLOR[cls] + '40', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: CAP_COLOR[cls] }}>{CAP_LABEL[cls]}</div>
                  <div style={{ fontSize: 10, color: CAP_COLOR[cls], opacity: 0.8, marginTop: 2 }}>
                    TP : {sel.tpTimeMin} min -- Voiture : {sel.carTimeMin} min
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: CAP_COLOR[cls], lineHeight: 1 }}>
                  x{rat.toFixed(2)}
                </div>
              </div>

              {/* Temps */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, background: '#eff6ff', borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600, marginBottom: 2 }}>🚗 Voiture</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>{sel.carTimeMin}</div>
                  <div style={{ fontSize: 9, color: '#3b82f6', opacity: 0.7, marginTop: 2 }}>min</div>
                </div>
                <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginBottom: 2 }}>🚌 {sel.tpLine}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>{sel.tpTimeMin}</div>
                  <div style={{ fontSize: 9, color: '#16a34a', opacity: 0.7, marginTop: 2 }}>min</div>
                </div>
              </div>

              {/* Frequence */}
              <div style={{ fontSize: 11, color: '#374151', marginBottom: 12, padding: '7px 10px', background: '#f8fafc', borderRadius: 7 }}>
                Frequence : toutes les {sel.tpFreqPeakMin} min -- Billet CHF {(sel.tpTicketCHF * (halfFare ? 0.5 : 1)).toFixed(2)}
              </div>

              {/* Couts */}
              <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Cout total {dur}h {freeDay ? '(parking gratuit)' : ''}
              </div>

              {/* Barre voiture */}
              <div style={{ borderRadius: 10, border: '1.5px solid #bfdbfe', background: '#eff6ff', padding: '9px 12px', marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>🚗 Voiture</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#3b82f6' }}>CHF {car.toFixed(2)}</span>
                </div>
                <div style={{ height: 4, background: '#dbeafe', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '100%', background: '#3b82f6', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, color: '#3b82f6', opacity: 0.8, marginTop: 4 }}>
                  Parking CHF {parkingCost(dur, freeDay).toFixed(2)} + temps + distance
                </div>
              </div>

              {/* Barre TP */}
              <div style={{ borderRadius: 10, border: '1.5px solid #bbf7d0', background: '#f0fdf4', padding: '9px 12px', marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>🚌 Transport public</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#16a34a' }}>CHF {tp.toFixed(2)}</span>
                </div>
                <div style={{ height: 4, background: '#dcfce7', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: Math.min(tp / car * 100, 100) + '%', background: '#16a34a', borderRadius: 2, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 10, color: '#16a34a', opacity: 0.8, marginTop: 4 }}>
                  Billet + temps de trajet + attente
                </div>
              </div>

              {/* Barre P+R si disponible */}
              {pr !== null && sel.prNote && (
                <div style={{ borderRadius: 10, border: '1.5px solid #a7f3d0', background: '#ecfdf5', padding: '9px 12px', marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>🅿 Via P+R</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: '#065f46' }}>CHF {pr.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 4, background: '#d1fae5', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: Math.min(pr / car * 100, 100) + '%', background: '#059669', borderRadius: 2, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#065f46', opacity: 0.8, marginTop: 4 }}>{sel.prNote}</div>
                </div>
              )}

              {/* Economies */}
              {save > 0.1 && (
                <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 12, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #86efac' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>Economie potentielle si TP</div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>CHF {save.toFixed(2)}</div>
                      <div style={{ fontSize: 9, color: '#16a34a' }}>par trajet</div>
                    </div>
                    <div style={{ width: 1, background: '#86efac', alignSelf: 'stretch' }} />
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>CHF {saveYear.toLocaleString('fr-CH')}</div>
                      <div style={{ fontSize: 9, color: '#16a34a' }}>par an (A/R x 220 jours)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Volume */}
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#9ca3af' }}>
                Volume estime : {sel.demand[dest].toLocaleString('fr-CH')} voyages/jour vers {DEST_LABELS[dest]}
              </div>

              <div style={{ fontSize: 9, color: '#d1d5db', marginTop: 10, lineHeight: 1.5 }}>
                Modele simplifie -- VOT 22 CHF/h -- ARE Microrecensement 2015
              </div>
            </div>

          ) : (

            /* LISTE COMMUNES */
            <div style={{ padding: '10px 14px' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une commune..."
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12, border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
              />

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Chargement...</div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af', fontSize: 12 }}>Aucune commune.</div>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {filtered.length} communes -- triees par captivite voiture
                  </div>
                  {filtered.map(o => {
                    const c   = captClass(o.carTimeMin, o.tpTimeMin);
                    const col = CAP_COLOR[c];
                    return (
                      <button
                        key={o.id}
                        onClick={() => setSel(o)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, marginBottom: 4, border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }} />
                        <span style={{ fontSize: 16 }}>{o.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{o.label}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                            Voiture {o.carTimeMin} min -- TP {o.tpTimeMin} min -- {o.tpLine}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: col }}>
                            x{captRatio(o.carTimeMin, o.tpTimeMin).toFixed(2)}
                          </div>
                        </div>
                        {o.prPotential && (
                          <div style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', padding: '2px 5px', borderRadius: 7, fontWeight: 800 }}>P+R</div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ODPage() {
  return (
    <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      <ODSimulator />
    </div>
  );
}
