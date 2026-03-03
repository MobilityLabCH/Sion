// ODSimulator — Carte OD interactive Sion
// React artifact: charge MapLibre GL depuis CDN
// Données officielles: sion.ch, CarPostal 2025

import { useState, useEffect, useRef, useMemo } from "react";

// ─── DATA (inline depuis data.ts) ────────────────────────────────────────────

const PARKINGS = [
  { id:"planta",       name:"Parking de la Planta",         short:"Planta",       coords:[7.3578,46.2330], capacity:562, pmr:18,  type:"central",   priceH:3.0,  firstHFree:true,  walkCentre:3,  freePeriods:["lunch","fri17","sat","sun","night"], source:"sion.ch 15.07.2024", conf:0.97 },
  { id:"scex",         name:"Parking du Scex",              short:"Scex",         coords:[7.3650,46.2298], capacity:658, pmr:22,  type:"central",   priceH:3.0,  firstHFree:true,  walkCentre:4,  freePeriods:["lunch","fri17","sat","sun","night"], source:"sion.ch 11.08.2025", conf:0.99 },
  { id:"cible",        name:"Parking de la Cible",          short:"Cible",        coords:[7.3622,46.2345], capacity:204, pmr:8,   type:"central",   priceH:3.0,  firstHFree:false, walkCentre:5,  freePeriods:["fri17","sat","sun"],               source:"sion.ch estimé",    conf:0.70 },
  { id:"nord",         name:"Parking Nord",                 short:"Nord",         coords:[7.3595,46.2432], capacity:282, pmr:10,  type:"preferred", priceH:1.5,  firstHFree:false, walkCentre:14, freePeriods:["fri17","sat","sun"],               source:"sion.ch préf. estimé",conf:0.60},
  { id:"roches-brunes",name:"Parking des Roches-Brunes",   short:"Roches-Brunes",coords:[7.3748,46.2368], capacity:300, pmr:12,  type:"preferred", priceH:1.5,  firstHFree:false, walkCentre:10, freePeriods:["fri17","sat","sun"],               source:"sion.ch préf. estimé",conf:0.60},
  { id:"st-guerin",    name:"Parking St-Guérin",            short:"St-Guérin",    coords:[7.3468,46.2318], capacity:66,  pmr:4,   type:"preferred", priceH:1.5,  firstHFree:false, walkCentre:8,  freePeriods:["fri17","sat","sun"],               source:"sion.ch préf. estimé",conf:0.60},
  { id:"vissigen",     name:"Parking Vissigen",             short:"Vissigen",     coords:[7.3808,46.2295], capacity:97,  pmr:4,   type:"preferred", priceH:2.0,  firstHFree:false, walkCentre:16, freePeriods:[],                                  source:"sion.ch estimé",    conf:0.55 },
  { id:"cour-gare",    name:"Cour de Gare / CFF",          short:"Gare CFF",     coords:[7.3525,46.2278], capacity:300, pmr:14,  type:"station",   priceH:2.0,  firstHFree:false, walkCentre:10, freePeriods:["sat","sun"],                       source:"CFF estimé",        conf:0.70 },
  { id:"pr-potences",  name:"P+R Potences (Sion-Ouest)",   short:"P+R Potences", coords:[7.3318,46.2282], capacity:450, pmr:0,   type:"pr",        priceH:0,    firstHFree:false, walkCentre:25, freePeriods:["always"], busLine:"BS 11", busDest:"Place du Midi", busFreq:10, busTravelMin:12, hasBike:true, source:"sion.ch/CarPostal", conf:0.95 },
  { id:"pr-stade",     name:"P+R Stade / Échutes (Sion-Est)",short:"P+R Stade",  coords:[7.3888,46.2282], capacity:460, pmr:0,   type:"pr",        priceH:0,    firstHFree:false, walkCentre:20, freePeriods:["always"], busLine:"BS 11", busDest:"Place du Midi", busFreq:10, busTravelMin:10, hasBike:true, source:"sion.ch/CarPostal", conf:0.95 },
];

const ORIGINS = [
  { id:"bramois",         name:"Bramois",                 emoji:"🏘", coords:[7.3945,46.2265], distKm:3.5,  pop:4800,
    bus:[{line:"BS 11",min:10,freqPk:10,freqOff:20,zones:1,fare:2.20,hf:1.50,note:"Direct · isireso zone 1"}], train:[],
    pRec:"pr-stade",  tp:"BS 11 direct · 10 min · toutes les 10 min" },
  { id:"chateauneuf",     name:"Châteauneuf-Conthey",    emoji:"🏔", coords:[7.3255,46.2278], distKm:4.8,  pop:7500,
    bus:[{line:"BS11/331",min:18,freqPk:20,freqOff:30,zones:2,fare:3.20,hf:2.20,note:"Via Gare CFF"}],
    train:[{op:"RegionAlps",min:8,freq:30,fare:3.20,hf:2.20,note:"Zone 2 isireso · dès déc. 2023"}],
    pRec:"pr-potences", tp:"Train RegionAlps 8 min · zone 2 isireso" },
  { id:"saviese",         name:"Savièse",                 emoji:"🍇", coords:[7.3272,46.2545], distKm:5.2,  pop:6800,
    bus:[{line:"341/342",min:25,freqPk:30,freqOff:60,zones:3,fare:4.20,hf:2.90,note:"Via Mont d'Orge"}], train:[],
    pRec:"pr-potences", tp:"Bus 341/342 · 25 min · 30 min pointe" },
  { id:"grimisuat",       name:"Grimisuat",               emoji:"⛰",  coords:[7.3858,46.2528], distKm:6.0,  pop:2800,
    bus:[{line:"386",min:22,freqPk:30,freqOff:60,zones:3,fare:4.20,hf:2.90,note:"Bus régional 386"}], train:[],
    pRec:"pr-stade",    tp:"Bus 386 · 22 min · 1×/heure" },
  { id:"uvrier-leonard",  name:"Uvrier / St-Léonard",    emoji:"🍷", coords:[7.4178,46.2335], distKm:7.5,  pop:5200,
    bus:[{line:"411",min:18,freqPk:30,freqOff:60,zones:2,fare:3.20,hf:2.20,note:"Bus 411"}],
    train:[{op:"RegionAlps",min:8,freq:30,fare:3.20,hf:2.20,note:"Zone 2 · train direct"}],
    pRec:"cour-gare",   tp:"Train 8 min · zone 2 isireso · 30 min" },
  { id:"arbaz-ayent",     name:"Arbaz / Ayent",           emoji:"🌿", coords:[7.3615,46.2748], distKm:8.5,  pop:4200,
    bus:[{line:"342",min:35,freqPk:60,freqOff:120,zones:3,fare:4.20,hf:2.90,note:"Bus 342"}], train:[],
    pRec:null,          tp:"Bus 342 · 35 min · 1×/heure · forte dépendance auto" },
  { id:"conthey-ardon",   name:"Conthey / Ardon",         emoji:"🏡", coords:[7.3072,46.2248], distKm:7.0,  pop:5500,
    bus:[{line:"331",min:22,freqPk:30,freqOff:60,zones:3,fare:4.20,hf:2.90,note:"Bus 331 via Conthey"}], train:[],
    pRec:"pr-potences", tp:"Bus 331 · 22 min · 30 min pointe" },
  { id:"nendaz",          name:"Basse-Nendaz / Nendaz",   emoji:"⛷",  coords:[7.2985,46.1892], distKm:19.0, pop:6500,
    bus:[{line:"361/362",min:38,freqPk:30,freqOff:60,zones:4,fare:5.20,hf:3.60,note:"Bus 361/362 via Aproz/Salins"}], train:[],
    pRec:null,          tp:"Bus 361/362 · 38 min · 30 min pointe" },
  { id:"veysonnaz",       name:"Veysonnaz / Salins",       emoji:"🎿", coords:[7.3372,46.2018], distKm:14.0, pop:1800,
    bus:[{line:"363",min:30,freqPk:60,freqOff:120,zones:3,fare:4.20,hf:2.90,note:"Bus 363 Chandoline–Salins"}], train:[],
    pRec:null,          tp:"Bus 363 · 30 min · 1×/heure" },
  { id:"sierre",          name:"Sierre / Siders",          emoji:"🚉", coords:[7.5328,46.2965], distKm:17.5, pop:16500,
    bus:[],
    train:[{op:"CFF/RegionAlps",min:15,freq:30,fare:5.80,hf:4.00,note:"Train direct"}],
    pRec:"cour-gare",   tp:"Train CFF 15 min · toutes les 30 min" },
  { id:"martigny",        name:"Martigny",                 emoji:"🚉", coords:[7.0738,46.1032], distKm:30.0, pop:18200,
    bus:[],
    train:[{op:"CFF",min:25,freq:30,fare:8.80,hf:6.00,note:"Train direct CFF"}],
    pRec:"cour-gare",   tp:"Train CFF 25 min · toutes les 30 min" },
  { id:"anzere",          name:"Anzère",                   emoji:"⛷",  coords:[7.3958,46.2885], distKm:20.0, pop:1200,
    bus:[{line:"351",min:45,freqPk:60,freqOff:120,zones:4,fare:5.20,hf:3.60,note:"Bus 351 saisonnier"}], train:[],
    pRec:null,          tp:"Bus 351 · 45 min · accès saisonnier limité" },
  { id:"val-herens",      name:"Val d'Hérens (Évolène…)", emoji:"🏔", coords:[7.4978,46.1132], distKm:35.0, pop:3500,
    bus:[{line:"381",min:60,freqPk:60,freqOff:120,zones:5,fare:7.80,hf:5.40,note:"Bus 381 La Crettaz–Haudères"}], train:[],
    pRec:null,          tp:"Bus 381 · 60 min · 1×/heure · très dépendant voiture" },
];

// ─── COST HELPERS ─────────────────────────────────────────────────────────────

function isFreeP(p, dayType, hour) {
  if (p.type === "pr") return true;
  if (dayType === "saturday" || dayType === "sunday") return true;
  if (dayType === "friday" && hour >= 17) return true;
  if ((p.id === "planta"||p.id === "scex") && dayType !== "saturday" && hour >= 12 && hour < 13.5) return true;
  return false;
}

function parkCost(p, durH, dayType, hour) {
  if (isFreeP(p, dayType, hour)) return 0;
  if (p.id === "planta" || p.id === "scex") {
    const b = Math.max(0, durH - 1);
    if (b === 0) return 0;
    return Math.round((Math.min(b,10)*3 + Math.max(0,b-10)*0.20)*100)/100;
  }
  return Math.round(durH * p.priceH * 100)/100;
}

function parkBreakdown(p, durH, dayType, hour) {
  if (isFreeP(p, dayType, hour)) {
    let why = "Période gratuite";
    if (dayType === "saturday") why = "Samedi : GRATUIT";
    else if (dayType === "sunday") why = "Dimanche : GRATUIT";
    else if (dayType === "friday" && hour >= 17) why = "Ven. dès 17h : GRATUIT";
    else if (p.type === "pr") why = "P+R : toujours GRATUIT";
    else if (hour >= 12 && hour < 13.5) why = "Pause midi 12h–13h30 : GRATUIT";
    return { total:0, lines:[why] };
  }
  if (p.id === "planta" || p.id === "scex") {
    const lines = ["1ère heure : GRATUIT"];
    let tot = 0;
    const b = durH - 1;
    if (b > 0) {
      const n = Math.min(b,10);
      const l = Math.max(0,b-10);
      lines.push(`${n.toFixed(1)}h × CHF 3.00/h = CHF ${(n*3).toFixed(2)}`);
      tot += n*3;
      if (l > 0) { lines.push(`${l.toFixed(1)}h × CHF 0.20/h = CHF ${(l*0.20).toFixed(2)} (longue durée)`); tot += l*0.20; }
    }
    return { total: Math.round(tot*100)/100, lines };
  }
  const tot = Math.round(durH*p.priceH*100)/100;
  return { total:tot, lines:[`${durH}h × CHF ${p.priceH.toFixed(2)}/h = CHF ${tot.toFixed(2)}${p.priceH===1.5?" (⚠ tarif préf. estimé)":""}`] };
}

function busCostOne(line, dayType, hour, hf) {
  if ((dayType==="friday"&&hour>=17)||dayType==="saturday") return 0;
  return hf ? line.hf : line.fare;
}

function bestTP(origin, dayType, hour, hf) {
  const all = [
    ...(origin.bus||[]).map(l=>({...l,isTrain:false})),
    ...(origin.train||[]).map(t=>({line:t.op,min:t.min,freqPk:t.freq,freqOff:t.freq*2,fare:t.fare,hf:t.hf,isTrain:true,note:t.note})),
  ];
  if (!all.length) return null;
  const s = [...all].sort((a,b)=>a.min-b.min);
  const b = s[0];
  const oneway = busCostOne(b, dayType, hour, hf);
  const free = (dayType==="friday"&&hour>=17)||dayType==="saturday";
  return { ...b, oneway, roundTrip: oneway*2, free };
}

// ─── MAPLIBRE LOADER ────────────────────────────────────────────────────────

let mlLoaded = false;
let mlError = false;
function loadML() {
  return new Promise((res, rej) => {
    if (window.maplibregl) { mlLoaded=true; res(window.maplibregl); return; }
    if (mlError) { rej(new Error("ML failed")); return; }
    const css = document.createElement("link");
    css.rel="stylesheet";
    css.href="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/3.6.2/maplibre-gl.min.css";
    document.head.appendChild(css);
    const scr = document.createElement("script");
    scr.src="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/3.6.2/maplibre-gl.min.js";
    scr.onload=()=>{ mlLoaded=true; res(window.maplibregl); };
    scr.onerror=()=>{ mlError=true; rej(new Error("ML CDN failed")); };
    document.head.appendChild(scr);
  });
}

// ─── BEZIER ARC ─────────────────────────────────────────────────────────────

function arc(from, to, bend=0.018) {
  const mx=(from[0]+to[0])/2, my=(from[1]+to[1])/2;
  const dx=to[0]-from[0], dy=to[1]-from[1];
  const len=Math.sqrt(dx*dx+dy*dy)||1;
  const mid=[mx-dy/len*bend, my+dx/len*bend];
  const pts=[];
  for(let t=0;t<=1;t+=0.025) {
    const q=1-t;
    pts.push([q*q*from[0]+2*q*t*mid[0]+t*t*to[0], q*q*from[1]+2*q*t*mid[1]+t*t*to[1]]);
  }
  return pts;
}

// ─── STYLES ────────────────────────────────────────────────────────────────

const TYPE_COLOR = { central:"#1d4ed8", preferred:"#d97706", pr:"#16a34a", station:"#7c3aed" };
const TYPE_LABEL = { central:"Centre (CHF 3/h)", preferred:"Tarif préférentiel", pr:"P+R GRATUIT", station:"Gare CFF" };

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ODSimulator() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mlReady, setMlReady] = useState(false);
  const [mlFailed, setMlFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // UI state
  const [origin, setOrigin] = useState(null);
  const [parkingId, setParkingId] = useState("planta");
  const [durH, setDurH] = useState(2);
  const [dayType, setDayType] = useState("weekday");
  const [hour, setHour] = useState(9);
  const [halfFare, setHalfFare] = useState(false);
  const [tab, setTab] = useState("od"); // od | aggregate
  const [popupParking, setPopupParking] = useState(null);

  const parking = useMemo(() => PARKINGS.find(p=>p.id===parkingId)||PARKINGS[0], [parkingId]);
  const originObj = useMemo(() => origin ? ORIGINS.find(o=>o.id===origin) : null, [origin]);

  const pBreakdown = useMemo(() => parkBreakdown(parking, durH, dayType, hour), [parking, durH, dayType, hour]);
  const tpInfo = useMemo(() => originObj ? bestTP(originObj, dayType, hour, halfFare) : null, [originObj, dayType, hour, halfFare]);
  const fuelCost = useMemo(() => originObj ? Math.round(originObj.distKm*2*0.18*100)/100 : 0, [originObj]);

  const isFreeNow = useMemo(() => isFreeP(parking, dayType, hour), [parking, dayType, hour]);
  const dayLabel = { weekday:"Lun–Jeu", friday:"Vendredi", saturday:"Samedi", sunday:"Dimanche" };
  const isFreeTP = tpInfo?.free;

  // ── Load MapLibre ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadML().then(()=>setMlReady(true)).catch(()=>setMlFailed(true));
  }, []);

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mlReady || !mapEl.current || mapRef.current) return;
    const ml = window.maplibregl;
    const map = new ml.Map({
      container: mapEl.current,
      style: {
        version:8,
        sources:{ osm:{ type:"raster", tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize:256, attribution:"© OpenStreetMap contributors" }},
        layers:[{id:"osm",type:"raster",source:"osm"}],
      },
      center:[7.362,46.233], zoom:11.5,
      attributionControl:false,
    });
    map.addControl(new ml.NavigationControl({showCompass:false}),"top-right");
    map.addControl(new ml.AttributionControl({compact:true}),"bottom-right");
    map.on("load",()=>{
      // Sources
      map.addSource("arcs",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
      map.addLayer({ id:"arc-pr",type:"line",source:"arcs",filter:["==","arcType","pr"],
        layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":"#16a34a","line-width":3,"line-opacity":0.8,"line-dasharray":[2,1.5]}});
      map.addLayer({ id:"arc-car",type:"line",source:"arcs",filter:["==","arcType","car"],
        layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":"#1d4ed8","line-width":3.5,"line-opacity":0.85}});

      // Parking markers
      PARKINGS.forEach(p=>{
        const size = 8 + Math.round(p.capacity/100)*2;
        const el = document.createElement("div");
        const isPR = p.type==="pr";
        const isPref = p.type==="preferred";
        const color = TYPE_COLOR[p.type]||"#1d4ed8";
        el.innerHTML=`
          <div style="position:relative;cursor:pointer">
            <div style="width:${size+12}px;height:${size+12}px;border-radius:50%;background:${color};
              border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);
              display:flex;align-items:center;justify-content:center;
              color:white;font-weight:700;font-size:10px;font-family:sans-serif">
              ${isPR?"P+R":"P"}
            </div>
            <div style="width:2px;height:6px;background:${color};margin:0 auto"></div>
          </div>`;
        el.addEventListener("click",e=>{ e.stopPropagation(); setPopupParking(p.id); setParkingId(p.id); });
        const marker = new ml.Marker({element:el,anchor:"bottom"}).setLngLat(p.coords).addTo(map);
        markersRef.current.push({type:"parking",id:p.id,marker});
      });

      // Origin markers
      ORIGINS.forEach(o=>{
        const el = document.createElement("div");
        el.style.cssText="cursor:pointer;position:relative";
        el.innerHTML=`
          <div style="background:white;border:2px solid #6b7280;border-radius:50%;
            width:28px;height:28px;display:flex;align-items:center;justify-content:center;
            font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:all .2s"
            title="${o.name}">
            ${o.emoji}
          </div>
          <div style="width:2px;height:5px;background:#6b7280;margin:0 auto"></div>`;
        el.addEventListener("click",e=>{ e.stopPropagation(); setOrigin(prev=>prev===o.id?null:o.id); });
        const marker = new ml.Marker({element:el,anchor:"bottom"}).setLngLat(o.coords).addTo(map);
        markersRef.current.push({type:"origin",id:o.id,marker,el});
      });

      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach(m=>m.marker.remove());
      markersRef.current=[];
      map.remove(); mapRef.current=null;
    };
  }, [mlReady]);

  // ── Update arcs & marker highlights ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Update origin marker styles
    markersRef.current.filter(m=>m.type==="origin").forEach(m=>{
      const isSelected = m.id === origin;
      const dot = m.el.querySelector("div");
      if (dot) {
        dot.style.borderColor = isSelected ? "#dc2626" : "#6b7280";
        dot.style.borderWidth = isSelected ? "3px" : "2px";
        dot.style.transform = isSelected ? "scale(1.2)" : "scale(1)";
        dot.style.boxShadow = isSelected ? "0 2px 8px rgba(220,38,38,.5)" : "0 1px 4px rgba(0,0,0,.3)";
      }
    });

    // Update parking marker highlights
    markersRef.current.filter(m=>m.type==="parking").forEach(m=>{
      const isSelected = m.id === parkingId;
      const dot = m.el.querySelector("div:first-child");
      if (dot) {
        dot.style.transform = isSelected ? "scale(1.2)" : "scale(1)";
        dot.style.boxShadow = isSelected ? "0 0 0 3px white, 0 0 0 5px rgba(220,38,38,.6)" : "0 2px 8px rgba(0,0,0,.4)";
      }
    });

    if (!map.getSource("arcs")) return;

    const features = [];
    if (origin && originObj) {
      // Car arc: origin → selected parking
      const carPts = arc(originObj.coords, parking.coords);
      features.push({ type:"Feature", properties:{arcType:"car"}, geometry:{type:"LineString",coordinates:carPts}});

      // P+R arc if origin has recommended P+R and it's not already the selected parking
      const prId = originObj.pRec;
      if (prId && prId !== parkingId) {
        const pr = PARKINGS.find(p=>p.id===prId);
        if (pr) {
          const prPts = arc(originObj.coords, pr.coords, 0.022);
          features.push({ type:"Feature", properties:{arcType:"pr"}, geometry:{type:"LineString",coordinates:prPts}});
        }
      }
    }
    map.getSource("arcs").setData({type:"FeatureCollection",features});

    // Fly to origin
    if (origin && originObj) {
      const bounds = [
        [Math.min(originObj.coords[0], parking.coords[0]) - 0.01, Math.min(originObj.coords[1], parking.coords[1]) - 0.01],
        [Math.max(originObj.coords[0], parking.coords[0]) + 0.01, Math.max(originObj.coords[1], parking.coords[1]) + 0.01],
      ];
      map.fitBounds(bounds, { padding:80, duration:600 });
    }
  }, [origin, parkingId, mapReady]);

  // ── Parking popup in panel ───────────────────────────────────────────────
  const ppObj = useMemo(()=>popupParking?PARKINGS.find(p=>p.id===popupParking):null,[popupParking]);
  const ppBreak = useMemo(()=>ppObj?parkBreakdown(ppObj,durH,dayType,hour):null,[ppObj,durH,dayType,hour]);

  // ── Aggregate OD flows (static data) ────────────────────────────────────
  const FLOWS = [
    { from:"Périphérie / Nendaz / Val d'Hérens", vol:100, pct:0.92, tp:"Faible (bus 1×/h ou moins)", carDepIdx:0.88 },
    { from:"Savièse", vol:85, pct:0.78, tp:"Bus 341/342 · 30 min", carDepIdx:0.72 },
    { from:"Conthey / Ardon / Châteauneuf", vol:90, pct:0.70, tp:"Train/bus 8-22 min · zone 2", carDepIdx:0.58 },
    { from:"Bramois / Uvrier / St-Léonard", vol:75, pct:0.65, tp:"BS 11 / Train · 8-18 min", carDepIdx:0.45 },
    { from:"Sierre / Martigny (train)", vol:60, pct:0.55, tp:"Train 15-25 min · 30 min", carDepIdx:0.30 },
    { from:"Anzère / Grimisuat", vol:30, pct:0.82, tp:"Bus 45-50 min · rare", carDepIdx:0.85 },
  ];

  // ─── RENDER ──────────────────────────────────────────────────────────────

  const DUR_OPTIONS = [0.5, 1, 1.5, 2, 3, 4, 8];
  const DAY_OPTIONS = [
    {v:"weekday",l:"Lun–Jeu"},
    {v:"friday",l:"Vendredi"},
    {v:"saturday",l:"Samedi"},
    {v:"sunday",l:"Dimanche"},
  ];

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"system-ui,sans-serif",background:"#f8fafc",color:"#0f1117",overflow:"hidden"}}>

      {/* ── MAP ──────────────────────────────────────────────────────────── */}
      <div style={{flex:1,position:"relative",minWidth:0}}>
        {mlFailed ? (
          <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,background:"#f1f5f9"}}>
            <div style={{fontSize:32}}>⚠️</div>
            <div style={{fontWeight:600,color:"#475569"}}>Carte indisponible</div>
            <div style={{fontSize:12,color:"#94a3b8",textAlign:"center"}}>CDN MapLibre inaccessible (réseau filtré)<br/>Utilisez le panneau de droite</div>
          </div>
        ) : (
          <div ref={mapEl} style={{width:"100%",height:"100%"}}/>
        )}

        {/* Legend overlay */}
        <div style={{position:"absolute",bottom:24,left:12,zIndex:10,background:"rgba(255,255,255,.93)",borderRadius:10,padding:"10px 12px",boxShadow:"0 2px 8px rgba(0,0,0,.15)",backdropFilter:"blur(4px)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Parkings</div>
          {Object.entries(TYPE_COLOR).map(([t,c])=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:11}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:c}}/>
              <span style={{color:"#475569"}}>{TYPE_LABEL[t]}</span>
            </div>
          ))}
          <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f1f5f9",fontSize:10,color:"#94a3b8"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <div style={{width:18,height:3,borderRadius:2,background:"#1d4ed8"}}/>
              <span>Flux voiture</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:18,height:2,borderRadius:2,background:"#16a34a",borderStyle:"dashed"}}/>
              <span>P+R recommandé</span>
            </div>
          </div>
          <div style={{marginTop:6,fontSize:9,color:"#cbd5e1"}}>Cliquer sur une origine 🍇 pour voir les flux</div>
        </div>
      </div>

      {/* ── PANEL ────────────────────────────────────────────────────────── */}
      <div style={{width:360,flexShrink:0,background:"#fff",borderLeft:"1px solid #e2e8f0",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",background:"#fff"}}>
          <div style={{display:"flex",gap:4,marginBottom:8}}>
            {[{v:"od",l:"👤 OD Démo"},  {v:"aggregate",l:"◉ Flux"}].map(t=>(
              <button key={t.v} onClick={()=>setTab(t.v)} style={{
                flex:1,padding:"6px 8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                background:tab===t.v?"#dc2626":"#f8fafc",color:tab===t.v?"#fff":"#6b7280",transition:"all .15s"
              }}>{t.l}</button>
            ))}
          </div>

          {/* Day selector */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:3,marginBottom:8}}>
            {DAY_OPTIONS.map(d=>{
              const isFriSat = (d.v==="friday"||d.v==="saturday");
              return (
                <button key={d.v} onClick={()=>setDayType(d.v)} style={{
                  padding:"4px 2px",borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:600,
                  background:dayType===d.v?"#1e3a8a":"#f8fafc",
                  color:dayType===d.v?"#fff":isFriSat?"#15803d":"#6b7280",
                }}>
                  {d.l}
                  {isFriSat && <div style={{fontSize:8,color:dayType===d.v?"#bfdbfe":"#16a34a"}}>🆓 gratuit</div>}
                </button>
              );
            })}
          </div>

          {/* Hour slider */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:10,color:"#6b7280",minWidth:40}}>Heure</span>
            <input type="range" min={0} max={23} value={hour} onChange={e=>setHour(+e.target.value)}
              style={{flex:1,height:4,accentColor:"#1e3a8a"}}/>
            <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,minWidth:24}}>{hour}h</span>
          </div>

          {/* Duration selector */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{fontSize:10,color:"#6b7280",minWidth:40}}>Durée</span>
            <div style={{display:"flex",gap:2,flex:1,flexWrap:"wrap"}}>
              {DUR_OPTIONS.map(d=>(
                <button key={d} onClick={()=>setDurH(d)} style={{
                  padding:"3px 5px",borderRadius:5,border:"none",cursor:"pointer",fontSize:10,fontWeight:600,
                  background:durH===d?"#1e3a8a":"#f8fafc",color:durH===d?"#fff":"#6b7280",
                }}>{d<1?`${d*60}min`:d===1?"1h":`${d}h`}</button>
              ))}
            </div>
          </div>

          {/* Half fare toggle */}
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11}}>
            <div onClick={()=>setHalfFare(v=>!v)} style={{
              width:32,height:18,borderRadius:9,background:halfFare?"#1e3a8a":"#e2e8f0",
              display:"flex",alignItems:"center",padding:2,cursor:"pointer",transition:"background .2s"
            }}>
              <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",transition:"transform .2s",transform:halfFare?"translateX(14px)":"translateX(0)"}}/>
            </div>
            <span style={{color:"#475569"}}>Demi-tarif CFF</span>
          </label>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto"}}>

          {/* ── OD TAB ─────────────────────────────────────────────── */}
          {tab === "od" && (
            <div>
              {/* Origins list */}
              <div style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
                  Origine — cliquer sur carte ou liste
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {ORIGINS.map(o=>{
                    const isSelected = origin===o.id;
                    const distColor = o.distKm<8?"#16a34a":o.distKm<18?"#d97706":"#dc2626";
                    return (
                      <button key={o.id} onClick={()=>setOrigin(prev=>prev===o.id?null:o.id)} style={{
                        textAlign:"left",padding:"6px 8px",borderRadius:8,cursor:"pointer",
                        border:`1.5px solid ${isSelected?"#dc2626":"#e2e8f0"}`,
                        background:isSelected?"#fef2f2":"#fff",
                        transition:"all .15s",
                      }}>
                        <div style={{fontSize:13}}>{o.emoji} <span style={{fontWeight:600,fontSize:11,color:isSelected?"#dc2626":"#1e293b"}}>{o.name}</span></div>
                        <div style={{fontSize:9,color:distColor,marginTop:1}}>{o.distKm} km</div>
                        <div style={{fontSize:9,color:"#94a3b8",marginTop:1,lineHeight:1.3}}>{o.tp.slice(0,45)}{o.tp.length>45?"…":""}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Result panel */}
              {originObj ? (
                <div style={{padding:"12px 16px"}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>
                    {originObj.emoji} {originObj.name} → Sion
                  </div>
                  <div style={{fontSize:11,color:"#6b7280",marginBottom:12}}>
                    {dayLabel[dayType]} · {hour}h · {durH<1?`${durH*60}min`:durH+"h"} · {originObj.distKm} km
                  </div>

                  {/* Parking selector for this origin */}
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:6}}>Choisir le parking</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {PARKINGS.map(p=>{
                        const cost = parkCost(p, durH, dayType, hour);
                        const isFree = isFreeP(p, dayType, hour);
                        const isSel = parkingId===p.id;
                        return (
                          <button key={p.id} onClick={()=>{setParkingId(p.id);setPopupParking(null);}} style={{
                            display:"flex",alignItems:"center",justifyContent:"space-between",
                            padding:"6px 10px",borderRadius:8,cursor:"pointer",
                            border:`1.5px solid ${isSel?"#1e3a8a":"#e2e8f0"}`,
                            background:isSel?"#eff6ff":"#fff",textAlign:"left",
                          }}>
                            <div>
                              <span style={{fontSize:10,fontWeight:600,color:isSel?"#1e3a8a":"#1e293b"}}>{p.short}</span>
                              <span style={{fontSize:9,color:"#94a3b8",marginLeft:4}}>{p.capacity}pl · {p.walkCentre}min</span>
                            </div>
                            <div style={{
                              fontSize:11,fontWeight:700,
                              color:isFree?"#16a34a":cost===0?"#16a34a":TYPE_COLOR[p.type]||"#1e3a8a"
                            }}>
                              {isFree ? "0.—" : cost===0 ? "0.—" : `CHF ${cost.toFixed(2)}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* AVANT / APRÈS comparison */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    {/* VOITURE */}
                    <div style={{background:isFreeNow?"#f0fdf4":"#eff6ff",borderRadius:10,padding:10,border:`1px solid ${isFreeNow?"#bbf7d0":"#bfdbfe"}`}}>
                      <div style={{fontSize:9,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:6}}>🚗 Voiture</div>
                      {pBreakdown.lines.map((l,i)=>(
                        <div key={i} style={{fontSize:10,color:"#475569",marginBottom:2,lineHeight:1.3}}>{l}</div>
                      ))}
                      <div style={{fontSize:10,color:"#6b7280",marginTop:4}}>+ Carburant ~CHF {fuelCost.toFixed(2)} <span style={{fontSize:9}}>(A/R)</span></div>
                      <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${isFreeNow?"#bbf7d0":"#bfdbfe"}`}}>
                        <span style={{fontWeight:700,fontSize:14,color:isFreeNow?"#16a34a":"#1e3a8a"}}>
                          CHF {(pBreakdown.total+fuelCost).toFixed(2)}
                        </span>
                        <div style={{fontSize:9,color:"#94a3b8"}}>parking + carburant</div>
                      </div>
                    </div>

                    {/* BUS / TRAIN */}
                    {tpInfo ? (
                      <div style={{background:isFreeTP?"#f0fdf4":"#fafafa",borderRadius:10,padding:10,border:`1px solid ${isFreeTP?"#bbf7d0":"#e2e8f0"}`}}>
                        <div style={{fontSize:9,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:6}}>
                          {tpInfo.isTrain ? "🚉 Train" : "🚌 Bus"}
                        </div>
                        <div style={{fontSize:10,fontWeight:600,color:"#1e293b",marginBottom:2}}>{tpInfo.line}</div>
                        <div style={{fontSize:10,color:"#475569",marginBottom:1}}>⏱ {tpInfo.min} min</div>
                        <div style={{fontSize:10,color:"#475569",marginBottom:1}}>🔄 toutes les {tpInfo.freqPk} min (pointe)</div>
                        <div style={{fontSize:10,color:"#475569",marginBottom:4,lineHeight:1.3}}>{tpInfo.note}</div>
                        <div style={{marginTop:4,paddingTop:6,borderTop:"1px solid #e2e8f0"}}>
                          {isFreeTP ? (
                            <div>
                              <span style={{fontWeight:700,fontSize:14,color:"#16a34a"}}>GRATUIT 🎉</span>
                              <div style={{fontSize:9,color:"#16a34a",marginTop:1}}>Ven. 17h–Sam. 24h · isireso-sion</div>
                            </div>
                          ) : (
                            <div>
                              <span style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>CHF {tpInfo.roundTrip.toFixed(2)}</span>
                              <div style={{fontSize:9,color:"#94a3b8"}}>aller-retour {halfFare?"(demi-tarif)":"(plein tarif)"}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{background:"#fef3c7",borderRadius:10,padding:10,border:"1px solid #fde68a"}}>
                        <div style={{fontSize:9,fontWeight:700,color:"#92400e",marginBottom:4}}>⚠️ TP LIMITÉS</div>
                        <div style={{fontSize:10,color:"#78350f",lineHeight:1.4}}>{originObj.tp}</div>
                        <div style={{marginTop:6,fontSize:10,fontWeight:600,color:"#92400e"}}>Voiture quasi-indispensable</div>
                      </div>
                    )}
                  </div>

                  {/* P+R recommendation */}
                  {originObj.pRec && (() => {
                    const pr = PARKINGS.find(p=>p.id===originObj.pRec);
                    if (!pr) return null;
                    return (
                      <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:10,marginBottom:12}}>
                        <div style={{fontSize:10,fontWeight:700,color:"#15803d",marginBottom:4}}>💡 P+R recommandé</div>
                        <div style={{fontSize:11,fontWeight:600,color:"#166534"}}>{pr.name}</div>
                        <div style={{fontSize:10,color:"#4ade80",marginTop:2}}>
                          ✓ Gratuit · {pr.capacity} places · {pr.busLine} → {pr.busDest}
                        </div>
                        <div style={{fontSize:10,color:"#166534",marginTop:1}}>🚌 Toutes les {pr.busFreq} min · {pr.busTravelMin} min trajet</div>
                      </div>
                    );
                  })()}

                  {/* Savings */}
                  {tpInfo && !tpInfo.isTrain && (() => {
                    const carTotal = pBreakdown.total + fuelCost;
                    const tpTotal = tpInfo.roundTrip;
                    const saving = Math.round((carTotal - tpTotal)*100)/100;
                    if (saving <= 0) return null;
                    return (
                      <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:10,marginBottom:12}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#1e40af"}}>
                          Économie TP : CHF {saving.toFixed(2)} / trajet
                        </div>
                        <div style={{fontSize:10,color:"#3b82f6",marginTop:2}}>
                          En prenant le bus au lieu de la voiture ce trajet
                        </div>
                      </div>
                    );
                  })()}

                  {/* Data source */}
                  <div style={{fontSize:9,color:"#94a3b8",borderTop:"1px solid #f1f5f9",paddingTop:8}}>
                    ⚠ Tarifs parking : {parking.source} (confiance {Math.round(parking.conf*100)}%)<br/>
                    TP : CarPostal horaires 2024-25 · isireso-sion.ch
                    {parking.conf < 0.80 && <div style={{color:"#f59e0b",marginTop:2}}>⚠ Tarif préférentiel estimé — à confirmer avec sion.ch</div>}
                  </div>
                </div>
              ) : (
                <div style={{padding:24,textAlign:"center",color:"#94a3b8"}}>
                  <div style={{fontSize:28,marginBottom:8}}>📍</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#475569"}}>Sélectionnez une origine</div>
                  <div style={{fontSize:11,marginTop:4}}>Cliquer sur un village 🍇 sur la carte ou dans la liste</div>
                </div>
              )}

              {/* Parking detail popup */}
              {ppObj && (
                <div style={{margin:"0 16px 16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{fontWeight:700,fontSize:13,color:TYPE_COLOR[ppObj.type]}}>{ppObj.name}</div>
                    <button onClick={()=>setPopupParking(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8"}}>×</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                    <div style={{background:"#fff",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                      <div style={{fontWeight:700,fontSize:18,color:"#1e293b"}}>{ppObj.capacity}</div>
                      <div style={{fontSize:9,color:"#94a3b8"}}>places</div>
                    </div>
                    <div style={{background:ppBreak?.total===0?"#f0fdf4":"#eff6ff",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                      <div style={{fontWeight:700,fontSize:18,color:ppBreak?.total===0?"#16a34a":TYPE_COLOR[ppObj.type]}}>
                        {ppBreak?.total===0?"GRATUIT":`CHF ${ppBreak?.total.toFixed(2)}`}
                      </div>
                      <div style={{fontSize:9,color:"#94a3b8"}}>{durH}h</div>
                    </div>
                  </div>
                  {ppBreak?.lines.map((l,i)=><div key={i} style={{fontSize:10,color:"#475569",marginBottom:2}}>{l}</div>)}
                  {ppObj.type==="pr"&&<div style={{fontSize:10,color:"#16a34a",marginTop:4}}>🚌 {ppObj.busLine} → {ppObj.busDest} · toutes les {ppObj.busFreq} min</div>}
                  <div style={{fontSize:9,color:"#94a3b8",marginTop:6}}>📍 {ppObj.address}</div>
                  <div style={{fontSize:9,color:"#cbd5e1",marginTop:2}}>Source: {ppObj.source}</div>
                </div>
              )}
            </div>
          )}

          {/* ── AGGREGATE TAB ──────────────────────────────────────────── */}
          {tab === "aggregate" && (
            <div style={{padding:"12px 16px"}}>
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 10px",marginBottom:12,fontSize:10,color:"#92400e"}}>
                ⚠ Volumes relatifs estimés · ARE Microrecensement 2015 · Estimation MobilityLab
              </div>

              {/* Parkings cost table for current settings */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>
                  Coût parking · {dayLabel[dayType]} {hour}h · {durH<1?`${durH*60}min`:durH+"h"}
                </div>
                {PARKINGS.map(p=>{
                  const cost = parkCost(p, durH, dayType, hour);
                  const free = isFreeP(p, dayType, hour);
                  return (
                    <div key={p.id} style={{display:"flex",alignItems:"center",marginBottom:5,gap:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:TYPE_COLOR[p.type],flexShrink:0}}/>
                      <div style={{flex:1,fontSize:11,color:"#1e293b"}}>{p.short}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>{p.capacity}pl</div>
                      <div style={{
                        fontSize:11,fontWeight:700,minWidth:60,textAlign:"right",
                        color:free||cost===0?"#16a34a":TYPE_COLOR[p.type]
                      }}>
                        {free||cost===0 ? "GRATUIT" : `CHF ${cost.toFixed(2)}`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* OD flows */}
              <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>
                Principaux flux OD → Centre Sion
              </div>
              {FLOWS.map((f,i)=>(
                <div key={i} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                    <span style={{fontWeight:600,color:"#1e293b"}}>{f.from}</span>
                    <span style={{color:f.carDepIdx>0.75?"#dc2626":f.carDepIdx>0.50?"#d97706":"#16a34a",fontWeight:600,fontSize:10}}>
                      {Math.round(f.carDepIdx*100)}% voiture
                    </span>
                  </div>
                  <div style={{height:6,background:"#f1f5f9",borderRadius:3,overflow:"hidden",marginBottom:3}}>
                    <div style={{height:"100%",borderRadius:3,background:f.carDepIdx>0.75?"#ef4444":f.carDepIdx>0.50?"#f59e0b":"#22c55e",width:`${f.pct*100}%`}}/>
                  </div>
                  <div style={{fontSize:9,color:"#94a3b8"}}>{f.tp}</div>
                </div>
              ))}

              {/* Duration cost table */}
              <div style={{marginTop:16,borderTop:"1px solid #f1f5f9",paddingTop:12}}>
                <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>
                  Grille tarifaire Planta / Scex (tarif officiel)
                </div>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:8}}>Source: sion.ch PDFs 2024-2025</div>
                {[[0.5,"30 min"],[1,"1h"],[1.5,"1h30"],[2,"2h"],[3,"3h"],[4,"4h"],[8,"8h"],[12,"12h"]].map(([d,l])=>{
                  const p = PARKINGS[0];
                  const normalCost = parkCost(p, d, "weekday", 9);
                  const friCost = parkCost(p, d, "friday", 17);
                  return (
                    <div key={d} style={{display:"flex",borderBottom:"1px solid #f8fafc",padding:"4px 0",fontSize:10}}>
                      <div style={{flex:1,color:"#475569",fontWeight:600}}>{l}</div>
                      <div style={{minWidth:80,textAlign:"right",color:normalCost===0?"#16a34a":"#1e3a8a",fontWeight:600}}>
                        {normalCost===0?"GRATUIT":`CHF ${normalCost.toFixed(2)}`}
                      </div>
                      <div style={{minWidth:70,textAlign:"right",color:"#16a34a",fontSize:9}}>ven/sam: 0.—</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{borderTop:"1px solid #f1f5f9",padding:"8px 16px",fontSize:9,color:"#cbd5e1",flexShrink:0}}>
          Données: sion.ch · CarPostal 2025 · isireso-sion.ch · ARE · © OSM contributors
        </div>
      </div>
    </div>
  );
}
