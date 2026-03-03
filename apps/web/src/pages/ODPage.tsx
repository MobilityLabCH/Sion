/**
 * ODPage.tsx — Accessibilité depuis les communes · Sion Mobility
 * VERSION SIMPLIFIÉE : suppression des éléments redondants
 *
 * Chemin : apps/web/src/pages/ODPage.tsx
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

type DayType     = 'weekday' | 'weekend';
type DurationH   = 1 | 2 | 4;
type Destination = 'centre' | 'gare' | 'emploi';
type CaptivityCls = 'competitive' | 'moderate' | 'captive';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEST_COORDS: Record<Destination, [number, number]> = {
  centre: [7.3595, 46.2333],
  gare:   [7.3590, 46.2295],
  emploi: [7.3400, 46.2210], // Zone Industrielle Ronquoz — corrigé
};

const DEST_LABELS: Record<Destination, string> = {
  centre: 'Centre-ville',
  gare:   'Gare CFF',
  emploi: 'Zone Industrielle',
};

const PR_NODES: Record<string, {
  label: string; coords: [number, number]; cap: number; busTimeToCentreMin: number;
}> = {
  potences: { label: 'P+R Potences', coords: [7.3318, 46.2282], cap: 450, busTimeToCentreMin: 12 },
  stade:    { label: 'P+R Stade',    coords: [7.3888, 46.2330], cap: 460, busTimeToCentreMin: 10 },
};

const CAP_COLORS: Record<CaptivityCls, string> = {
  competitive: '#22c55e', moderate: '#f59e0b', captive: '#ef4444',
};
const CAP_BG: Record<CaptivityCls, string> = {
  competitive: '#f0fdf4', moderate: '#fffbeb', captive: '#fef2f2',
};
const CAP_TEXT: Record<CaptivityCls, string> = {
  competitive: '#15803d', moderate: '#b45309', captive: '#dc2626',
};
const CAP_LABEL: Record<CaptivityCls, string> = {
  competitive: 'TP compétitif', moderate: 'TP moyen (×1.2–1.6)', captive: 'Captif voiture (>×1.6)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parkingCost(dur: DurationH, day: DayType): number {
  if (day === 'weekend') return 0;
  if (dur <= 1) return 0;
  return (dur - 1) * 3.0;
}
function captRatio(o: Origin) { return o.tpTimeMin / o.carTimeMin; }
function captClass(r: number): CaptivityCls {
  return r < 1.2 ? 'competitive' : r < 1.6 ? 'moderate' : 'captive';
}
function arc(from: [number, number], to: [number, number], n = 40): [number, number][] {
  const dx = to[0]-from[0], dy = to[1]-from[1];
  const cx = (from[0]+to[0])/2 - dy*0.25, cy = (from[1]+to[1])/2 + dx*0.25;
  return Array.from({length: n+1}, (_,i) => {
    const t = i/n;
    return [(1-t)*(1-t)*from[0]+2*(1-t)*t*cx+t*t*to[0], (1-t)*(1-t)*from[1]+2*(1-t)*t*cy+t*t*to[1]];
  });
}

// ─── Composant ───────────────────────────────────────────────────────────────

function CostBar({ icon, label, total, maxVal, color, bg, border, items, note }: {
  icon: string; label: string; total: number; maxVal: number;
  color: string; bg: string; border: string;
  items: {label: string; val: number}[]; note?: string;
}) {
  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${border}`, background: bg, padding: '9px 12px', marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{icon} {label}</span>
        <span style={{ fontSize: 17, fontWeight: 900, color }}>CHF {total.toFixed(2)}</span>
      </div>
      <div style={{ height: 4, background: `${color}20`, borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(total/(maxVal*1.1)*100, 100)}%`, background: color, borderRadius: 2, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        {items.filter(i => i.val > 0.005).map(i => (
          <span key={i.label} style={{ fontSize: 10, color, opacity: 0.85 }}>{i.label}: {i.val.toFixed(2)}</span>
        ))}
      </div>
      {note && <div style={{ fontSize: 10, color, opacity: 0.7, marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function ODSimulator() {
  const mapRef  = useRef<maplibregl.Map | null>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const mkrsRef = useRef<maplibregl.Marker[]>([]);
  const lyrRef  = useRef<string[]>([]);
  const srcRef  = useRef<string[]>([]);

  const [origins,  setOrigins]  = useState<Origin[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mapErr,   setMapErr]   = useState(false);
  const [ready,    setReady]    = useState(false);
  const [search,   setSearch]   = useState('');
  const [sel,      setSel]      = useState<Origin | null>(null);
  const [dest,     setDest]     = useState<Destination>('centre');
  const [dur,      setDur]      = useState<DurationH>(2);
  const [day,      setDay]      = useState<DayType>('weekday');
  const [halfFare, setHalfFare] = useState(false);

  useEffect(() => {
    (fetchData() as Promise<any>)
      .then((d: any) => { setOrigins(d.origins ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!contRef.current || mapRef.current) return;
    try {
      const m = new maplibregl.Map({
        container: contRef.current,
        style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
        center: [7.363, 46.232], zoom: 10.5, attributionControl: false,
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      m.on('load', () => setReady(true));
      m.on('error', () => setMapErr(true));
      mapRef.current = m;
    } catch { setMapErr(true); }
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  const buildMarkers = useCallback(() => {
    const m = mapRef.current;
    if (!m || !origins.length) return;
    mkrsRef.current.forEach(mk => mk.remove()); mkrsRef.current = [];

    origins.forEach(o => {
      const r = captRatio(o), c = captClass(r), col = CAP_COLORS[c];
      const el = document.createElement('div');
      el.style.cssText = `width:36px;height:36px;border-radius:50%;background:${col};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:transform .15s;`;
      el.textContent = o.emoji; el.title = `${o.label} — ×${r.toFixed(2)}`;
      el.addEventListener('click', () => setSel(prev => prev?.id === o.id ? null : o));
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
      mkrsRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(o.coords).addTo(m));
    });

    (['centre','gare','emploi'] as Destination[]).forEach(d => {
      const el = document.createElement('div');
      el.style.cssText = `width:32px;height:32px;border-radius:7px;background:#1e3a5f;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:15px;`;
      el.textContent = d === 'centre' ? '🏛' : d === 'gare' ? '🚉' : '🏭';
      el.title = DEST_LABELS[d];
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(DEST_COORDS[d]).addTo(m);
    });

    Object.values(PR_NODES).forEach(pr => {
      const el = document.createElement('div');
      el.style.cssText = `padding:2px 7px;border-radius:10px;background:#16a34a;border:2px solid white;font-size:10px;font-weight:700;color:white;white-space:nowrap;`;
      el.textContent = `P+R ${pr.cap}pl.`; el.title = pr.label;
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(pr.coords).addTo(m);
    });
  }, [origins]);

  useEffect(() => { if (ready && origins.length) buildMarkers(); }, [ready, buildMarkers]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    lyrRef.current.forEach(id => { if (m.getLayer(id)) m.removeLayer(id); });
    srcRef.current.forEach(id => { if (m.getSource(id)) m.removeSource(id); });
    lyrRef.current = []; srcRef.current = [];
    if (!sel) return;
    const dc = DEST_COORDS[dest];
    const addArc = (si: string, li: string, from: [number,number], to: [number,number], paint: Record<string,unknown>) => {
      m.addSource(si, { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates: arc(from,to) }, properties:{} } });
      m.addLayer({ id:li, type:'line', source:si, paint: paint as any });
      srcRef.current.push(si); lyrRef.current.push(li);
    };
    addArc('sc','lc', sel.coords, dc, { 'line-color':'#3b82f6','line-width':3,'line-opacity':.85 });
    if (sel.prPotential && sel.prId) {
      const pr = PR_NODES[sel.prId];
      if (pr) {
        addArc('sp1','lp1', sel.coords, pr.coords, { 'line-color':'#16a34a','line-width':2.5,'line-opacity':.8,'line-dasharray':[5,3] });
        addArc('sp2','lp2', pr.coords, dc, { 'line-color':'#16a34a','line-width':3,'line-opacity':.9 });
      }
    }
    m.fitBounds(new maplibregl.LngLatBounds(sel.coords, dc), { padding: 100, maxZoom: 13, duration: 600 });
  }, [sel, dest, ready]);

  // Coûts
  const VOT = 22;
  const park = sel ? parkingCost(dur, day) : 0;
  const carKm   = sel ? (sel.carTimeMin/60)*40*0.18 : 0;
  const carTime = sel ? (sel.carTimeMin/60)*VOT : 0;
  const carTotal = sel ? park + carTime + carKm + 1.2 : 0;
  const freq = sel ? (day==='weekday' ? sel.tpFreqPeakMin : sel.tpFreqOffpeakMin) : 30;
  const tpTicket = sel ? sel.tpTicketCHF*(halfFare?.5:1) : 0;
  const tpWait   = sel ? (freq/2/60)*VOT : 0;
  const tpTime   = sel ? (sel.tpTimeMin/60)*VOT : 0;
  const tpTotal  = sel ? tpTicket + tpWait + tpTime : 0;
  let prTotal: number | null = null;
  if (sel?.prPotential && sel?.prId) {
    const pr = PR_NODES[sel.prId];
    if (pr) prTotal = 2.20 + ((sel.carTimeMin*0.4 + pr.busTimeToCentreMin + 5)/60)*VOT + (sel.carTimeMin*0.4/60)*40*0.18;
  }

  const ratio = sel ? captRatio(sel) : null;
  const cls   = ratio != null ? captClass(ratio) : null;
  const filtered = [...origins].filter(o => o.label.toLowerCase().includes(search.toLowerCase())).sort((a,b) => captRatio(b)-captRatio(a));

  const tab = (active: boolean, color: string): React.CSSProperties => ({
    flex:1, padding:'5px 3px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
    border:'1.5px solid', borderColor: active ? color : '#e5e7eb',
    background: active ? `${color}15` : 'white', color: active ? color : '#6b7280',
  });

  return (
    <div style={{ display:'flex', height:'100%', fontFamily:"'DM Sans','Inter',sans-serif" }}>

      {/* MAP */}
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        {mapErr ? (
          <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f1f5f9', gap:12 }}>
            <div style={{ fontSize:40 }}>🗺️</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#374151' }}>Carte indisponible</div>
            <div style={{ fontSize:12, color:'#9ca3af', textAlign:'center', maxWidth:260 }}>Réseau filtré · utilisez le panneau de droite</div>
          </div>
        ) : <div ref={contRef} style={{ height:'100%' }} />}

        {/* Compteur */}
        {!mapErr && origins.length > 0 && (
          <div style={{ position:'absolute', top:12, left:12, zIndex:10, background:'rgba(255,255,255,.95)', borderRadius:12, padding:'7px 14px', boxShadow:'0 2px 12px rgba(0,0,0,.1)', display:'flex', gap:14 }}>
            {(['captive','moderate','competitive'] as CaptivityCls[]).map(c => (
              <div key={c} style={{ textAlign:'center' }}>
                <div style={{ fontSize:17, fontWeight:900, color:CAP_COLORS[c] }}>{origins.filter(o=>captClass(captRatio(o))===c).length}</div>
                <div style={{ fontSize:9, color:'#9ca3af', fontWeight:700, textTransform:'uppercase' as const }}>{c==='captive'?'Captifs':c==='moderate'?'Moyens':'OK TP'}</div>
              </div>
            ))}
          </div>
        )}

        {/* Légende simplifiée */}
        {!mapErr && (
          <div style={{ position:'absolute', bottom:30, left:12, zIndex:10, background:'rgba(255,255,255,.95)', borderRadius:12, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,.1)', minWidth:160 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', marginBottom:7, textTransform:'uppercase' as const, letterSpacing:'.06em' }}>Captivité voiture</div>
            {(['competitive','moderate','captive'] as CaptivityCls[]).map(c => (
              <div key={c} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5, fontSize:11 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:CAP_COLORS[c] }} />
                <span style={{ color:'#374151' }}>🟢🟡🔴'.split('')[['competitive','moderate','captive'].indexOf(c)]} {CAP_LABEL[c]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PANEL */}
      <div style={{ width:370, background:'white', borderLeft:'1px solid #e5e7eb', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Contrôles — simplifiés */}
        <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid #f1f5f9', background:'#fafafa' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#111827', marginBottom:12 }}>Accessibilité depuis les communes</div>

          {/* Destination */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:800, color:'#9ca3af', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'.07em' }}>Destination</div>
            <div style={{ display:'flex', gap:6 }}>
              {(['centre','gare','emploi'] as Destination[]).map(d => (
                <button key={d} onClick={() => setDest(d)} style={tab(dest===d,'#2563eb')}>
                  {d==='centre'?'🏛 Centre':d==='gare'?'🚉 Gare':'🏭 ZI'}
                </button>
              ))}
            </div>
          </div>

          {/* Durée + Jour */}
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, fontWeight:800, color:'#9ca3af', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'.07em' }}>Durée stationnement</div>
              <div style={{ display:'flex', gap:4 }}>
                {([1,2,4] as DurationH[]).map(d => <button key={d} onClick={() => setDur(d)} style={tab(dur===d,'#7c3aed')}>{d}h</button>)}
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, fontWeight:800, color:'#9ca3af', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'.07em' }}>Jour</div>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={()=>setDay('weekday')} style={tab(day==='weekday','#d97706')}>Lun–Sam</button>
                <button onClick={()=>setDay('weekend')} style={tab(day==='weekend','#d97706')}>Dim ⚡</button>
              </div>
            </div>
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#374151' }}>
            <input type="checkbox" checked={halfFare} onChange={e=>setHalfFare(e.target.checked)} style={{ width:14, height:14, accentColor:'#2563eb' }} />
            Demi-tarif CFF
            {day==='weekend' && <span style={{ marginLeft:'auto', fontSize:10, background:'#fef3c7', color:'#d97706', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>Parking gratuit ⚡</span>}
          </label>
        </div>

        {/* Corps */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {sel && cls && ratio != null ? (

            /* DÉTAIL */
            <div style={{ padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#111827' }}>{sel.emoji} {sel.label}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>→ {DEST_LABELS[dest]} · {sel.population.toLocaleString('fr-CH')} hab.</div>
                </div>
                <button onClick={()=>setSel(null)} style={{ background:'#f1f5f9', border:'none', cursor:'pointer', color:'#6b7280', borderRadius:7, padding:'3px 9px', fontSize:12, fontWeight:700 }}>✕</button>
              </div>

              {/* Badge */}
              <div style={{ padding:'9px 12px', borderRadius:10, marginBottom:12, background:CAP_BG[cls], border:`1.5px solid ${CAP_COLORS[cls]}30`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:CAP_TEXT[cls] }}>{CAP_LABEL[cls]}</div>
                  <div style={{ fontSize:10, color:CAP_TEXT[cls], opacity:.7, marginTop:2 }}>Le TP prend {sel.tpTimeMin} min vs {sel.carTimeMin} min en voiture</div>
                </div>
                <div style={{ fontSize:22, fontWeight:900, color:CAP_COLORS[cls], lineHeight:1 }}>×{ratio.toFixed(2)}</div>
              </div>

              {/* Temps comparés */}
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                {[
                  { icon:'🚗', label:'Voiture', min:sel.carTimeMin, color:'#3b82f6', bg:'#eff6ff' },
                  { icon:'🚌', label:sel.tpLine, min:sel.tpTimeMin, color:'#16a34a', bg:'#f0fdf4' },
                ].map(it => (
                  <div key={it.label} style={{ flex:1, background:it.bg, borderRadius:10, padding:'8px 0', textAlign:'center', border:`1px solid ${it.color}20` }}>
                    <div style={{ fontSize:10, color:it.color, fontWeight:600, marginBottom:2 }}>{it.icon} {it.label}</div>
                    <div style={{ fontSize:22, fontWeight:900, color:it.color, lineHeight:1 }}>{it.min}</div>
                    <div style={{ fontSize:9, color:it.color, opacity:.7, marginTop:2 }}>min</div>
                  </div>
                ))}
              </div>

              {/* Fréquence */}
              <div style={{ fontSize:11, color:'#374151', marginBottom:12, padding:'7px 10px', background:'#f8fafc', borderRadius:7 }}>
                🕐 <strong>{sel.tpLine}</strong> toutes les <strong>{day==='weekday'?sel.tpFreqPeakMin:sel.tpFreqOffpeakMin} min</strong>
                {' · '}billet CHF <strong>{(sel.tpTicketCHF*(halfFare?.5:1)).toFixed(2)}</strong>
              </div>

              {/* Coûts */}
              <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', marginBottom:8, textTransform:'uppercase' as const, letterSpacing:'.06em' }}>
                Coût total {dur}h · {day==='weekday'?'semaine':'week-end'}
              </div>
              <CostBar icon="🚗" label="Voiture" total={carTotal} maxVal={Math.max(carTotal,tpTotal)} color="#3b82f6" bg="#eff6ff" border="#bfdbfe"
                items={[{label:'Parking',val:park},{label:'Temps',val:carTime},{label:'Distance',val:carKm},{label:'Friction',val:1.2}]} />
              <CostBar icon="🚌" label="TP direct" total={tpTotal} maxVal={Math.max(carTotal,tpTotal)} color="#16a34a" bg="#f0fdf4" border="#bbf7d0"
                items={[{label:'Billet',val:tpTicket},{label:'Trajet',val:tpTime},{label:'Attente',val:tpWait}]} />
              {prTotal != null && sel.prNote && (
                <CostBar icon="🅿️" label="Via P+R" total={prTotal} maxVal={Math.max(carTotal,tpTotal)} color="#065f46" bg="#ecfdf5" border="#a7f3d0"
                  note={sel.prNote}
                  items={[{label:'Billet',val:2.20},{label:'Temps',val:prTotal-2.20-(sel.carTimeMin*.4/60)*40*.18},{label:'km',val:(sel.carTimeMin*.4/60)*40*.18}]} />
              )}

              {/* Économies */}
              {tpTotal < carTotal && (
                <div style={{ padding:'10px 12px', borderRadius:10, marginBottom:12, background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #86efac' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#15803d', marginBottom:6 }}>💡 Économie si TP</div>
                  <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:900, color:'#15803d' }}>CHF {(carTotal-tpTotal).toFixed(2)}</div>
                      <div style={{ fontSize:9, color:'#16a34a' }}>par trajet</div>
                    </div>
                    <div style={{ width:1, background:'#86efac', alignSelf:'stretch' }} />
                    <div>
                      <div style={{ fontSize:18, fontWeight:900, color:'#15803d' }}>CHF {((carTotal-tpTotal)*2*220).toFixed(0)}</div>
                      <div style={{ fontSize:9, color:'#16a34a' }}>par an (A/R × 220j)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Flux */}
              <div style={{ padding:'8px 12px', background:'#f8fafc', borderRadius:8, fontSize:11, color:'#9ca3af' }}>
                📊 ~<strong style={{color:'#374151'}}>{sel.demand[dest].toLocaleString('fr-CH')}</strong> voyages/jour vers {DEST_LABELS[dest]}
              </div>
            </div>

          ) : (

            /* LISTE */
            <div style={{ padding:'10px 14px' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une commune…"
                style={{ width:'100%', padding:'7px 10px', borderRadius:7, fontSize:12, border:'1.5px solid #e5e7eb', background:'#f9fafb', color:'#374151', outline:'none', boxSizing:'border-box' as const, marginBottom:10 }} />

              {loading ? (
                <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}><div style={{ fontSize:24, marginBottom:8 }}>⏳</div>Chargement…</div>
              ) : filtered.length===0 ? (
                <div style={{ textAlign:'center', padding:30, color:'#9ca3af', fontSize:12 }}>Aucune commune.</div>
              ) : (
                <>
                  <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', marginBottom:7, textTransform:'uppercase' as const, letterSpacing:'.06em' }}>
                    {filtered.length} communes · les plus captives en premier
                  </div>
                  {filtered.map(o => {
                    const r=captRatio(o), c=captClass(r), col=CAP_COLORS[c];
                    return (
                      <button key={o.id} onClick={()=>setSel(o)}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9, marginBottom:4, border:'1.5px solid #e5e7eb', background:'white', cursor:'pointer', textAlign:'left' as const, transition:'all .12s' }}
                        onMouseEnter={e => { const t=e.currentTarget as HTMLButtonElement; t.style.borderColor=col; t.style.background=CAP_BG[c]; }}
                        onMouseLeave={e => { const t=e.currentTarget as HTMLButtonElement; t.style.borderColor='#e5e7eb'; t.style.background='white'; }}
                      >
                        <div style={{ width:7, height:7, borderRadius:'50%', background:col, flexShrink:0 }} />
                        <span style={{ fontSize:16 }}>{o.emoji}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#111827' }}>{o.label}</div>
                          <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>🚗 {o.carTimeMin}' · 🚌 {o.tpTimeMin}' · {o.tpLine}</div>
                        </div>
                        <div style={{ textAlign:'right' as const, flexShrink:0 }}>
                          <div style={{ fontSize:12, fontWeight:800, color:col }}>×{r.toFixed(2)}</div>
                        </div>
                        {o.prPotential && <div style={{ fontSize:9, background:'#dcfce7', color:'#15803d', padding:'2px 5px', borderRadius:7, fontWeight:800 }}>P+R</div>}
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
  return <div style={{ height:'calc(100vh - 48px)', overflow:'hidden' }}><ODSimulator /></div>;
}
