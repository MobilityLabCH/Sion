/**
 * Dashboard.tsx — SION-CET Simulator (Choix Évolutif de Transport)
 * Prototype d'outil d'aide à la décision — Projet pilote expérimental MobilityLab
 * TypeScript strict · Zéro dépendance externe · Cloudflare Pages compatible
 * Sources: sion.ch/stationnement · PDFs Planta 15.07.2024, Scex 11.08.2025 · ARE 2021
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ─── TomTom Traffic — via Worker proxy ──────────────────────────────────────
// La clé TOMTOM_API_KEY est stockée dans le Worker Cloudflare (secret).
// Dashboard appelle /api/traffic/flow ; le Worker proxifie TomTom.
const WORKER_URL = 'https://sion.ericimstepf.workers.dev';

interface TrafficFlowResp {
  connected: boolean;
  severity?: string;
  congestionIdx?: number;
  currentSpeed?: number;
  freeFlowSpeed?: number;
  error?: string;
}

async function fetchTomTomSev(): Promise<{sev:string;ok:boolean}> {
  try {
    const r = await fetch(`${WORKER_URL}/api/traffic/flow`, {cache:'no-store'});
    if (!r.ok) return {sev:'',ok:false};
    const d = await r.json() as TrafficFlowResp;
    if (!d.connected || !d.severity) return {sev:'',ok:false};
    return {sev:d.severity,ok:true};
  } catch { return {sev:'',ok:false}; }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function useGlobalStyles(): void {
  useEffect(() => {
    if (document.getElementById('sion-cet-styles')) return;
    const lnk = document.createElement('link');
    lnk.rel = 'stylesheet';
    lnk.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(lnk);
    const s = document.createElement('style');
    s.id = 'sion-cet-styles';
    s.textContent = `
      *{box-sizing:border-box;margin:0;padding:0;}
      .syne{font-family:'Syne',sans-serif;}
      .mono{font-family:'JetBrains Mono',monospace;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
      @keyframes scaleIn{from{opacity:0;transform:scale(.93);}to{opacity:1;transform:scale(1);}}
      @keyframes pulseAnim{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(.82);}}
      @keyframes numIn{from{opacity:0;transform:scale(.85);}to{opacity:1;transform:scale(1);}}
      .fade-up{animation:fadeUp .3s ease forwards;}
      .scale-in{animation:scaleIn .22s ease forwards;}
      .pulse-dot{animation:pulseAnim 2s infinite;}
      .num-in{animation:numIn .35s cubic-bezier(.34,1.56,.64,1) forwards;}
      .hover-lift{transition:transform .15s,box-shadow .15s;}
      .hover-lift:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.1);}
      input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;outline:none;cursor:pointer;}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.25);}
      .park-pin{position:absolute;transform:translate(-50%,-50%);cursor:pointer;transition:transform .15s;}
      .park-pin:hover{transform:translate(-50%,-50%) scale(1.25);}
      .park-tooltip{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% + 10px);background:white;border-radius:10px;padding:8px 12px;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.18);pointer-events:none;white-space:nowrap;z-index:20;}
      .park-tooltip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:white;}
    `;
    document.head.appendChild(s);
  }, []);
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#F2F1ED', sidebar:'#0F1117', sidebarBorder:'#1C1F2C', white:'#FFFFFF',
  red:'#C8102E', redL:'#FFF0F2', redB:'#FFCDD4',
  green:'#0A7045', greenL:'#F0FDF7', greenB:'#A3E9C8',
  amber:'#A85A00', amberL:'#FFFBEB', amberB:'#FDE68A',
  blue:'#1A4DD6', blueL:'#EFF6FF', blueB:'#BFDBFE',
  purple:'#6825D0', purpleL:'#F5F0FF', purpleB:'#D8B8FA',
  ink:'#0F1117', inkM:'#4A5066', inkL:'#9299AD',
  border:'#E8E6E0', borderL:'#F0EEE8',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'dashboard'|'simulator'|'od'|'personas'|'actions'|'donnees';
type CapType = 'ok'|'moyen'|'captif';
type IncomeType = 'faible'|'moyen'|'élevé';
type DestType = 'centre'|'hopital'|'industrie'|'gare';
type ParkingType = 'centre'|'pr'|'pericentre'|'gare'|'hopital'|'industrie'|'horodateur';
type PriLevel = 'haute'|'moyenne'|'basse';

interface Parking {
  id:string; name:string; short:string; type:ParkingType;
  places:number; tarifBaseline:number;
  note:string; source:string; ok:boolean;
  adresse:string;
  // % position on official map (1069×625) — kept for reference
  px:number; py:number;
  // WGS84 coordinates for MapLibre
  lng:number; lat:number;
  occ:number; secondaryEditable?:boolean;
}
interface SionEvent {
  date:Date; type:string; recurrent:boolean;
  name:string; lieu:string; impact:string;
  color:string; desc:string; tip:string;
}
interface SimParams {
  centrePrice:number; prPrice:number; progressif:boolean;
  tpDiscount:number; offreCombinee:boolean;
  gareCFFPrice:number; nordPrice:number; rochesBrunesPrice:number; hopitalPrice:number;
}
interface SimResult {
  totalShift:number; carsReduced:number; carSign:number;
  tpGain:number; prUsage:number; co2:number;
  revenueDay:number; baseRevenue:number; revDelta:number;
  centreOcc:number; congestion:number; tpRevenueEffect:number;
  isNegative:boolean;
}
interface PersonaData {
  id:string; emoji:string; label:string; income:IncomeType;
  carDep:number; tpAff:number; sens:number;
  dest:DestType; rigidity:number; tags:string[];
  desc:string; avgStayH:number; note?:string;
}
interface ZoneOD {
  id:string; label:string; pop:number;
  car:number; tp:number; line:string; freq:number; cap:CapType;
}
interface ActionItem { title:string; pri:PriLevel; owner:string; desc:string; metrics:string[]; context:string; expectedResult:string; }
interface PlanHorizon { h:string; c:string; bg:string; b:string; actions:ActionItem[] }
interface PersonaImpact {
  delta:number; beforeCHF?:string; afterCHF?:string;
  equityFlag:boolean; switch:boolean; concerned:boolean; note:string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n:number) => Math.abs(n).toLocaleString('fr-CH');
const fmtDate = (d:Date) => d.toLocaleDateString('fr-CH',{weekday:'short',day:'numeric',month:'short'});
const fmtNow  = () => new Date().toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'});
const fmtToday= () => new Date().toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const daysUntil=(d:Date)=>Math.max(0,Math.round((d.getTime()-Date.now())/86400000));
const rangeBg=(val:number,min:number,max:number,color:string)=>{
  const pct=((val-min)/(max-min))*100;
  return `linear-gradient(to right,${color} ${pct}%,#E5E3DC ${pct}%)`;
};

// ─── Hash-based tab sync with top Layout nav ──────────────────────────────────
const HASH_TO_TAB: Record<string, TabId> = {
  '#dashboard':'dashboard','#simulator':'simulator','#od':'od','#personas':'personas','#actions':'actions','#donnees':'donnees',
  '#simulateur':'simulator','#flux-od':'od','#resultats':'dashboard','#plan':'actions',
};
function getTabFromHash(): TabId {
  return HASH_TO_TAB[window.location.hash] ?? 'dashboard';
}

// ─── Data: Parkings (données officielles sion.ch/stationnement) ─────────────
// Sources: sion.ch/stationnement · carte officielle stationnement Sion 2025
// Positions px/py = % sur carte officielle (1069×625 px)
const ALL_PARKINGS: Parking[] = [
  // CENTRE — levier direct Ville de Sion
  {id:'planta',name:'Parking de la Planta',short:'Planta',type:'centre',places:552,
   tarifBaseline:3.0,note:'1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30 · Abo CHF 160/mois',
   source:'sion.ch PDF 15.07.2024',ok:true,adresse:'Place de la Planta, Sion',
   px:39.6,py:43.7,lng:7.3581,lat:46.2329,occ:78},
  {id:'scex',name:'Parking du Scex',short:'Scex',type:'centre',places:449,
   tarifBaseline:3.0,note:'1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30 · Abo CHF 160/mois',
   source:'sion.ch PDF 11.08.2025',ok:true,adresse:'Rue du Scex, Sion',
   px:48.3,py:46.0,lng:7.3636,lat:46.2322,occ:82},
  {id:'cible',name:'Parking de la Cible',short:'Cible',type:'centre',places:204,
   tarifBaseline:3.0,note:'Tarif préférentiel (résidents) · Conditions à confirmer',
   source:'sion.ch (estimé)',ok:false,adresse:'Rue de la Porte-Neuve, Sion',
   px:45.0,py:33.3,lng:7.361,lat:46.2348,occ:71},
  // P+R GRATUITS
  {id:'pr-potences',name:'P+R Les Potences',short:'P+R Potences',type:'pr',places:450,
   tarifBaseline:0,note:'GRATUIT · Bus BS11 → Centre ~12 min · Vélo disponible',
   source:'sion.ch · CarPostal 2025',ok:true,adresse:'Route des Potences, Sion-Ouest',
   px:16.7,py:68.1,lng:7.3431,lat:46.226,occ:34},
  {id:'pr-echutes2',name:"P+R Les Échutes II",short:"P+R Échutes II",type:'pr',places:400,
   tarifBaseline:0,note:"GRATUIT · Bus BS11 → Centre ~10 min · Vélo disponible",
   source:'sion.ch · CarPostal 2025',ok:true,adresse:"Route des Échutes, Sion-Est",
   px:73.0,py:37.3,lng:7.3797,lat:46.2347,occ:28},
  {id:'pr-echutes1',name:"P+R Les Échutes I",short:"P+R Échutes I",type:'pr',places:60,
   tarifBaseline:0,note:"GRATUIT · Bus → Centre",
   source:'sion.ch',ok:true,adresse:"Route des Échutes, Sion-Est",
   px:68.5,py:31.9,lng:7.375,lat:46.2343,occ:22},
  // PÉRICENTRE (Tarif préférentiel — hors levier direct)
  {id:'nord',name:'Parking Nord',short:'Nord',type:'pericentre',places:282,
   tarifBaseline:1.5,note:'Tarif préférentiel résidents — à confirmer',secondaryEditable:true,
   source:'sion.ch/stationnement',ok:false,adresse:'Secteur nord, Sion',
   px:45.2,py:28.0,lng:7.3615,lat:46.2374,occ:54},
  {id:'roches-brunes',name:'Roches-Brunes',short:'Roches-Brunes',type:'pericentre',places:300,
   tarifBaseline:1.5,note:'Tarif préférentiel — à confirmer',secondaryEditable:true,
   source:'sion.ch/stationnement',ok:false,adresse:'Av. de Tourbillon, Sion',
   px:56.4,py:46.7,lng:7.3687,lat:46.2319,occ:47},
  {id:'st-guerin',name:'Parking St-Guérin',short:'St-Guérin',type:'pericentre',places:66,
   tarifBaseline:1.5,note:'Tarif préférentiel résidentiel',
   source:'sion.ch/stationnement',ok:false,adresse:'Rue de St-Guérin, Sion',
   px:25.7,py:51.0,lng:7.3488,lat:46.2309,occ:40},
  {id:'vissigen',name:'Parking Vissigen',short:'Vissigen',type:'pericentre',places:23,
   tarifBaseline:0,note:'Petit parking · gratuit',
   source:'sion.ch/stationnement',ok:false,adresse:'Vissigen, Sion',
   px:66.7,py:54.2,lng:7.3720,lat:46.2278,occ:30},
  // GARE / COUR DE GARE
  {id:'gare-cff',name:'Cour de Gare (CFF)',short:'Cour de Gare',type:'gare',places:300,
   tarifBaseline:2.0,note:'Géré CFF · forte occupation pendulaire · tarif estimé CHF 2/h',secondaryEditable:true,
   source:'CFF (estimé)',ok:false,adresse:'Av. de la Gare, Sion',
   px:44.7,py:60.4,lng:7.3603,lat:46.2279,occ:91},
  // HÔPITAL
  {id:'hopital',name:'P+R Hôpital (Champsec)',short:'Hôpital P+R',type:'hopital',places:400,
   tarifBaseline:2.0,note:'Zone Champsec · patients / visiteurs HVS · hors centre',secondaryEditable:true,
   source:'HVS (estimé)',ok:false,adresse:'Av. du Grand-Champsec 80, Sion',
   px:87.0,py:32.0,lng:7.3854,lat:46.2359,occ:65},
  // ZONE INDUSTRIELLE
  {id:'ronquoz',name:'Zone Industrielle Ronquoz',short:'Ronquoz / Aéroport',type:'industrie',places:4000,
   tarifBaseline:0,note:'Parkings privés employeurs (~40 entreprises) · GRATUIT · données lacunaires',
   source:'Estimé',ok:false,adresse:'Zone industrielle Ronquoz, Sion',
   px:11.0,py:78.0,lng:7.3545,lat:46.2241,occ:70},
];

const CENTRE_TOTAL = ALL_PARKINGS.filter(p=>p.type==='centre').reduce((s,p)=>s+p.places,0);
// Centre: 552+449+204 = 1205

const TYPE_COLOR: Record<ParkingType,string>={
  centre:C.red,pr:C.green,pericentre:C.amber,
  gare:C.blue,hopital:C.purple,industrie:C.inkL,horodateur:C.inkM
};

// ─── Events ───────────────────────────────────────────────────────────────────
function getSionEvents(): SionEvent[] {
  const now = new Date();
  const y = now.getFullYear();
  const evs: SionEvent[] = [];
  for(let w=0;w<10;w++){
    const d=new Date(now);d.setDate(d.getDate()+(5-d.getDay()+7)%7+w*7);d.setHours(8,0,0,0);
    if(d>=now) evs.push({date:d,type:'marche',recurrent:true,impact:'moyenne',color:C.amber,
      name:'Marché de la Vieille Ville',lieu:'Grand-Pont, Rue de Lausanne, Remparts',
      desc:'Marché hebdomadaire terroir & artisanat · 8h–14h (mvvsion.ch)',
      tip:'P Planta/Scex recommandés · BS11 ou vélo depuis P+R'});
  }
  const dates: [number,number,number,string,string,string,string,string,string][] = [
    [y,3,3,'marche_special','haute',C.red,'Grand Marché de Pâques (Vieille Ville)','Vieille Ville étendue, Sion','P+R Potences/Échutes obligatoires · Renfort BS11'],
    [y,4,14,'vin','haute',C.red,'Caves Ouvertes Valais 20e éd. – J1','Domaines viticoles Sion & région','Fort afflux touristes · P+R Échutes II conseillé'],
    [y,4,15,'vin','haute',C.red,'Caves Ouvertes Valais 20e éd. – J2','Domaines viticoles Sion & région','Fort afflux · signalétique renforcée'],
    [y,4,16,'vin','haute',C.red,'Caves Ouvertes Valais 20e éd. – J3','Domaines viticoles Sion & région','Dernier jour · Retours tardifs'],
    [y,2,14,'sport','haute',C.red,'FC Sion – Match à domicile','Stade de Tourbillon, Sion','P+R Échutes II saturé · activer P+R Potences'],
    [y,3,4,'sport','haute',C.red,'FC Sion – Match à domicile','Stade de Tourbillon, Sion','P+R Échutes II saturé 2h avant/après'],
    [y,3,18,'sport','haute',C.red,'FC Sion – Match à domicile','Stade de Tourbillon, Sion','P+R Échutes II saturé 2h avant/après'],
    [y,4,2,'sport','haute',C.red,'FC Sion – Match à domicile','Stade de Tourbillon, Sion','P+R Échutes II saturé'],
    [y,4,16,'sport','haute',C.red,'FC Sion – Match à domicile','Stade de Tourbillon, Sion','P+R Échutes II saturé'],
    [y,2,21,'sport','moyenne',C.blue,'HC Sion – Match hockey (Arolles)','Patinoire des Arolles, Sion','Roches-Brunes en débordement'],
    [y,3,1,'sport','moyenne',C.blue,'HC Sion – Match hockey (Arolles)','Patinoire des Arolles, Sion','Fin ~22h30 · TP limité'],
    [y,2,7,'fete','haute',C.purple,'Carnaval sédunois','Vieille Ville, Grand-Pont, Sion','Centre interdit voitures · P+R obligatoires'],
    [y,3,25,'braderie','moyenne',C.amber,'Braderie de la Vieille Ville','Grand-Pont, Sion','Grand-Pont partiellement fermé'],
  ];
  const seen = new Set<string>();
  for(const [yr,mo,da,type,impact,color,name,lieu,tip] of dates){
    const d=new Date(yr,mo,da);
    if(d>=now){
      const k=`${d.toDateString()}-${name}`;
      if(!seen.has(k)){seen.add(k);evs.push({date:d,type,recurrent:true,impact,color,name,lieu,desc:'',tip});}
    }
  }
  return evs.sort((a,b)=>a.date.getTime()-b.date.getTime()).slice(0,12);
}

// ─── Simulation ───────────────────────────────────────────────────────────────
const SIM={dailyCar:11500,dailyTP:7800,centrePlaces:CENTRE_TOTAL,prPlaces:910,
  avgStayH:2.5,freeH:1.0,turnover:4.5,co2PerTrip:1.52,elasticity:-0.30,basePrice:3.0} as const;

function simulate(p:SimParams):SimResult {
  const delta=p.centrePrice-SIM.basePrice;
  // Élasticité-prix de la demande voiture : ε = -0.30 (Litman 2023, ARE 2021)
  // Interprétation : +1% de prix → -0.30% de demande voiture
  // Shift modal vers TP = -(ε × ΔP/P) = -(-0.30) × ΔP/P = +0.30 × ΔP/P
  // → positif quand prix augmente (moins de voitures → gain TP) ✓
  // → négatif quand prix baisse / gratuit (plus de voitures → perte TP) ✓
  const raw=(delta/SIM.basePrice)*(-SIM.elasticity); // = (delta/3.0)*0.30
  // Plafond empirique : gain TP max ~38%, afflux voiture max ~46% (saturation)
  const clamped=Math.max(-0.46,Math.min(0.38,raw));
  const tpE=p.tpDiscount>0?(p.tpDiscount/100)*0.08:0;
  // P+R amplifie le report seulement si le centre EST plus cher que la baseline
  const prE=p.prPrice===0&&delta>0?clamped*0.20:0;
  const combE=p.offreCombinee&&p.prPrice===0&&delta>0?0.028:0;
  const progE=p.progressif&&p.centrePrice>=SIM.basePrice?0.022:0;
  const covE=0;
  const tadE=0;
  // Fuite modale : parkings périphériques bon marché captent une partie
  // du report attendu (les usagers évitent le centre sans passer aux TP)
  // Ne s'applique que quand le centre est PLUS cher (sinon pas de raison de fuir)
  const leak=delta>0?Math.max(0,(SIM.basePrice-p.gareCFFPrice)*0.01+(1.5-p.nordPrice)*0.008+(1.5-p.rochesBrunesPrice)*0.006):0;
  const total=clamped+tpE+prE+combE+progE+covE+tadE-leak;
  const carsReduced=Math.round(SIM.dailyCar*Math.abs(total));
  const carSign=total<0?-1:1;
  const tpGain=Math.round(carsReduced*(0.65+(p.tpDiscount>0?0.07:0)))*carSign;
  const prUsage=delta>0?Math.round(carsReduced*0.22+prE*SIM.prPlaces*0.5):0;
  const co2=Math.round(carsReduced*SIM.co2PerTrip)*carSign;
  const billable=Math.max(0,SIM.avgStayH-SIM.freeH);
  const revenueDay=Math.round(SIM.centrePlaces*SIM.turnover*billable*p.centrePrice);
  const baseRevenue=Math.round(SIM.centrePlaces*SIM.turnover*billable*SIM.basePrice);
  const centreOcc=Math.min(98,Math.max(25,Math.round(79-total*110)));
  const congestion=p.centrePrice<SIM.basePrice?Math.min(4,Math.round((SIM.basePrice-p.centrePrice)*1.5)):0;
  return{totalShift:total,carsReduced,carSign,tpGain,prUsage,co2,revenueDay,baseRevenue,
    revDelta:revenueDay-baseRevenue,centreOcc,congestion,tpRevenueEffect:p.tpDiscount>0?-(p.tpDiscount/100*0.15):0,
    isNegative:total<0};
}

// ─── Static Data ──────────────────────────────────────────────────────────────
const PERSONAS: PersonaData[] = [
  {id:'p01',emoji:'🚗',label:'Pendulaire bureau',income:'moyen',carDep:.75,tpAff:.35,sens:.55,
   dest:'centre',rigidity:.8,tags:['horaires fixes','abonnement mensuel'],desc:'Travaille au centre, vient de la périphérie',avgStayH:8},
  {id:'p02',emoji:'🚐',label:'Commerçant / livreur',income:'moyen',carDep:.98,tpAff:.05,sens:.70,
   dest:'centre',rigidity:.9,tags:['captif voiture','multi-arrêts'],desc:'Artisan, multiples arrêts courts, outillage lourd',avgStayH:0.4},
  {id:'p03',emoji:'🛍️',label:'Visiteur commercial',income:'moyen',carDep:.60,tpAff:.40,sens:.65,
   dest:'centre',rigidity:.45,tags:['flexible','courte durée'],desc:'Courses en centre-ville, 1–2h',avgStayH:1.5},
  {id:'p04',emoji:'👴',label:'Senior mobilité réduite',income:'faible',carDep:.85,tpAff:.20,sens:.80,
   dest:'centre',rigidity:.60,tags:['équité ⚠️','PMR','sensible prix'],desc:'Rdv médicaux, courses, mobilité limitée',avgStayH:1.5},
  {id:'p05',emoji:'🏥',label:'Patient / visiteur HVS',income:'faible',carDep:.75,tpAff:.30,sens:.70,
   dest:'hopital',rigidity:.90,tags:['équité ⚠️','Champsec','stress'],
   desc:'Hôpital du Valais — zone Champsec · P+R Hôpital (400 pl.)',avgStayH:2,
   note:'Se gare au P+R Hôpital (400 pl.) en zone Champsec — NON concerné par tarif centre'},
  {id:'p06',emoji:'🎒',label:'Étudiant HES-SO',income:'faible',carDep:.30,tpAff:.75,sens:.90,
   dest:'centre',rigidity:.40,tags:['TP','vélo','budget serré'],desc:'Campus HES-SO Sion, budget limité',avgStayH:6},
  {id:'p07',emoji:'👩‍💼',label:'Fonctionnaire cantonal',income:'élevé',carDep:.55,tpAff:.50,sens:.35,
   dest:'centre',rigidity:.70,tags:['abonnement TP','horaires réguliers'],desc:'Administration cantonale, centre-ville',avgStayH:8},
  {id:'p08',emoji:'🏗️',label:'Ouvrier zone industrielle',income:'faible',carDep:.90,tpAff:.15,sens:.85,
   dest:'industrie',rigidity:.95,tags:['captif voiture','équité ⚠️','Ronquoz'],
   desc:'Zone industrielle Ronquoz — parking privé gratuit employeur',avgStayH:8,
   note:'Parking privé gratuit Ronquoz (~4 000 pl.) — NON concerné par tarif centre'},
  {id:'p09',emoji:'🧑‍⚕️',label:'Professionnel santé HVS',income:'élevé',carDep:.70,tpAff:.40,sens:.25,
   dest:'hopital',rigidity:.88,tags:['Champsec','astreintes'],
   desc:'Médecin/infirmier HVS — zone Champsec, hors centre',avgStayH:8,
   note:'P+R Hôpital HVS (400 pl.) · accès BS7/BS14'},
  {id:'p10',emoji:'🏠',label:'Parent école / crèche',income:'moyen',carDep:.80,tpAff:.25,sens:.60,
   dest:'centre',rigidity:.85,tags:['contrainte horaire','équité'],desc:'Dépose enfants + courses rapides',avgStayH:1},
  {id:'p11',emoji:'🚲',label:'Cycliste urbain',income:'moyen',carDep:.05,tpAff:.60,sens:.20,
   dest:'centre',rigidity:.30,tags:['vert','non concerné'],desc:'Vélo principal — indépendant du tarif parking',avgStayH:0},
  {id:'p12',emoji:'🏔️',label:'Touriste / visiteur externe',income:'élevé',carDep:.65,tpAff:.45,sens:.40,
   dest:'centre',rigidity:.50,tags:['ponctuel','découverte'],desc:'Hôtels Sion, patrimoine historique',avgStayH:3},
];

const ZONES_OD: ZoneOD[] = [
  {id:'bramois',label:'Bramois',pop:2900,car:8,tp:18,line:'Bus BS2',freq:15,cap:'ok'},
  {id:'grimisuat',label:'Grimisuat',pop:2300,car:11,tp:30,line:'Bus BS6',freq:30,cap:'moyen'},
  {id:'conthey',label:'Conthey',pop:9800,car:12,tp:28,line:'CarPostal',freq:30,cap:'moyen'},
  {id:'salins',label:'Salins',pop:1800,car:9,tp:28,line:'Bus BS',freq:60,cap:'captif'},
  {id:'savieve',label:'Savièse',pop:5100,car:14,tp:35,line:'CarPostal 431',freq:60,cap:'captif'},
  {id:'vetroz',label:'Vétroz',pop:4200,car:14,tp:32,line:'CarPostal',freq:60,cap:'captif'},
  {id:'ardon',label:'Ardon',pop:3600,car:16,tp:38,line:'CarPostal',freq:60,cap:'captif'},
  {id:'ayent',label:'Ayent',pop:4100,car:18,tp:45,line:'CarPostal 441',freq:60,cap:'captif'},
  {id:'vex',label:'Vex',pop:1700,car:20,tp:40,line:'CarPostal',freq:60,cap:'captif'},
  {id:'nendaz',label:'Nendaz',pop:7200,car:25,tp:55,line:'CarPostal',freq:60,cap:'captif'},
];

const CAP_C: Record<CapType,{c:string;b:string;bg:string;l:string}> = {
  ok:{c:C.green,b:C.greenB,bg:C.greenL,l:'TP compétitif'},
  moyen:{c:C.amber,b:C.amberB,bg:C.amberL,l:'TP partiel'},
  captif:{c:C.red,b:C.redB,bg:C.redL,l:'Captif voiture'},
};
const PRI_C: Record<PriLevel,{c:string;bg:string;b:string}> = {
  haute:{c:C.red,bg:C.redL,b:C.redB},
  moyenne:{c:C.amber,bg:C.amberL,b:C.amberB},
  basse:{c:C.green,bg:C.greenL,b:C.greenB},
};

const PLAN: PlanHorizon[] = [
  {h:'0–3 mois',c:C.red,bg:C.redL,b:C.redB,actions:[
    {title:'Pilote offre combinée P+R + billet TP',pri:'haute',owner:'Service mobilité + CarPostal',
     context:"Les P+R Potences (450 pl.) et Échutes II (400 pl.) sont déjà gratuits mais sous-utilisés (<30% occ.) faute de lien TP attractif. Le billet TP séparé (CHF 4.60 aller-retour BS11) constitue une barrière psychologique et financière.",
     desc:'P+R Potences/Échutes II gratuit + billet 24h CarPostal à CHF 3.–. Vente combinée à l\'entrée du P+R (QR code, borne, app). Durée pilote : 3 mois.',
     expectedResult:"Augmentation taux d'occupation P+R de ~30% à ~55–65% (cible : 250 voitures/j captées). Report modal estimé : −350 à −500 voitures/j centre. Gain fréquentation BS11 : +200–300 pax/j en pointe.",
     metrics:['Occ. P+R J+30','Fréquentation BS11 pointe','Nb offres combinées vendues']},
    {title:'Signalétique dynamique occupation parkings',pri:'haute',owner:'IT Ville + Service voirie',
     context:"L'absence d'information temps réel génère un trafic de recherche estimé à 15–20% du trafic centre (Shoup 2011). Les usagers font plusieurs tours avant de se garer, aggravant la congestion et les émissions.",
     desc:'Affichage temps réel places disponibles (Planta/Scex/Cible) sur 5 panneaux Route Cantonale + signalétique directionnelle + intégration app sion.ch.',
     expectedResult:"Réduction du trafic de recherche de -15% estimée (soit ~100–150 véh./h en moins en pointe). Amélioration expérience usager. Prérequis pour OpenData API (action 3–12 mois).",
     metrics:['Temps moyen recherche parking (enquête)','Taux satisfaction usagers','Taux occupation Planta/Scex']},
    {title:'Campagne communication sur les gratuités existantes',pri:'moyenne',owner:'Service communication',
     context:"La majorité des Sédunois ignorent les règles tarifaires existantes : 1h gratuite en semaine, gratuité totale vendredi soir/samedi/dimanche/midi, P+R permanents gratuits. Ce déficit d'information empêche un report modal spontané.",
     desc:'Campagne multicanale (sion.ch, réseaux sociaux, affiches bus, dépliant commerçants) : 1h gratuite, gratuité ven.soir/dim./midi, P+R Potences & Échutes I/II permanents gratuits.',
     expectedResult:"Augmentation utilisation P+R de +10–15% sans investissement supplémentaire. Réduction pression centre certains créneaux. Effet mesurable en 6 semaines.",
     metrics:['Utilisation P+R avant/après (comptage)','Réactions commerçants','Trafic centre sam. matin']},
  ]},
  {h:'3–12 mois',c:C.amber,bg:C.amberL,b:C.amberB,actions:[
    {title:'Renfort fréquence BS11 aux heures de pointe',pri:'haute',owner:'Service mobilité + CarPostal',
     context:"La BS11 (Potences → Centre → Échutes) tourne à 15 min en pointe, rendant le P+R peu attractif (attente + correspondance = 20–25 min). Litman (2023) montre qu'une fréquence <10 min multiplie par 2 la captation P+R.",
     desc:"Passage BS11 à 7 min (7h–9h / 17h–19h en semaine). Nécessite accord CarPostal + financement (~CHF 180 000/an surcoût estimé). Condition sine qua non à l'efficacité des P+R.",
     expectedResult:"Temps porte-à-porte P+R → centre : 15 min max. Captation P+R estimée à 400–600 voitures/j. Report modal simulé : −5 à −8% voitures centre. ROI: ~CHF 360/voiture captée/an.",
     metrics:['Temps d\'attente moyen P+R (chrono)','Montées BS11 pointe (compteur porte)','Nb voyageurs P+R/j']},
    {title:'Tarification progressive longue durée (>3h)',pri:'moyenne',owner:'Service mobilité',
     context:"Les pendulaires tout-journée (8h+) immobilisent 20–30% des places centre (estimé données Planta 2024) au tarif horaire normal. Cette occupation longue durée réduit la rotation disponible pour les visiteurs courte durée et les commerçants.",
     desc:'Grille progressive : CHF 3.0/h (h1), CHF 3.0/h (h2–3 avec franchise 1h), CHF 4.0/h (h3+). Objectif : décourager les pendulaires centre vers P+R ou TP.',
     expectedResult:"Réduction stationnement longue durée centre de -25–30%. Libération 60–90 places pour rotation visiteurs. Hausse recettes estimée +CHF 40 000–60 000/an. Impact equity : surveiller profils revenus modestes.",
     metrics:['Durée moyenne stationnement Planta/Scex','Recettes parking centre/mois','Ratio occup. <3h vs >3h']},
    {title:'OpenData occupation parkings (API temps réel)',pri:'moyenne',owner:'IT Ville',
     context:"Sans données ouvertes, les applications de navigation (Google Maps, Waze, SBB) dirigent aveuglément vers le centre. Une API temps réel permet la redirection automatique vers les P+R disponibles, sans panneau supplémentaire.",
     desc:'API REST/JSON temps réel (capteurs magnétiques ou comptage par barrière) → intégration Google Maps, SBB app, Waze. Standard OGD-CH (opendata.swiss).',
     expectedResult:"Réduction trafic généré par navigation aveugle : −8–12% trajets entrants centre. Données objectives pour calibrage du simulateur SION-CET. Prérequis pour PDS 2030.",
     metrics:['Nb intégrations tierces actives','Requêtes API/jour','Taux couverture capteurs (%)']},
  ]},
  {h:'12–36 mois',c:C.blue,bg:C.blueL,b:C.blueB,actions:[
    {title:'Plan mobilité employeurs zone industrielle Ronquoz',pri:'haute',owner:'Service éco. + mobilité',
     context:"La zone Ronquoz/Aéroport concentre ~4 000 emplois (estimé) avec quasi 100% de dépendance voiture et ~4 000 places privées gratuites. C'est le principal réservoir de report modal non adressé. Sans action, les mesures centre-ville ne changent rien à ces flux.",
     desc:'Partenariat volontaire top 10 employeurs (>100 pers.) : abonnements TP subventionnés 50% employeur, pistes cyclables sécurisées Ronquoz–Centre, plan de déplacement entreprise (PDE) avec objectifs chiffrés.',
     expectedResult:"Part modale voiture zone ind. : −5 à −10% en 3 ans (objectif ARE). Abonnements TP : 200–400 vendus/an. Km CO₂ évité : ~400–800 tonnes/an. Effet levier si combiné avec offre TP renforcée.",
     metrics:['Part modale voiture zone ind. (enquête PDE)','Abo TP vendus employeurs','Km piste vélo réalisés','Tonne CO₂ évitée/an']},
    {title:'Renfort BS7/BS14 → Hôpital du Valais (Champsec)',pri:'haute',owner:'Service mobilité + HVS',
     context:"Le HVS emploie ~2 000 personnes et accueille ~300 000 consultations/an. La liaison Gare–Champsec est sous-cadencée (15–30 min), rendant la voiture quasi-obligatoire malgré un P+R de 400 pl. La zone est hors périmètre des mesures centre mais génère un trafic significatif.",
     desc:'Renfort fréquence BS7/BS14 à 10 min (7h–20h) sur axe Gare–Champsec. Convention mobilité HVS–Ville. Signalétique P+R Hôpital renforcée.',
     expectedResult:"Report modal HVS estimé : −80 à −150 voitures/j (actuellement ~280 voitures/j en arrêt devant urgences). Réduction stress accès urgences. Amélioration conditions travail personnel soignant.",
     metrics:['Temps Gare→Hôpital (chrono)','Fréquentation lignes hôpital','Occ. P+R Hôpital (400 pl.)']},
    {title:'Révision Plan directeur stationnement (PDS) 2030',pri:'haute',owner:'Service urbanisme + mobilité',
     context:"Le PDS actuel date de 2018 et ne tient pas compte de l'évolution modale post-COVID, des objectifs ARE 2030 (−15% voitures agglomérations), ni du potentiel P+R. Sa révision est le cadre légal nécessaire pour toutes les mesures tarifaires durables.",
     desc:'Actualiser PDS avec : objectifs 2030 (−15% voitures centre, +20% TP), quotas par zone, tarification différenciée centre/périphérie, réserves foncières P+R, indicateurs de suivi annuels.',
     expectedResult:"Cadre légal et contractuel pour les mesures tarifaires progressives. Base pour la négociation avec CFF (Cour de Gare). Crédibilité du projet pilote SION-CET auprès des partenaires.",
     metrics:['Adoption PDS par Conseil municipal','Part modale voiture 2027 (microrecensement)','Recettes parking/an vs coût TP']},
  ]},
];

// ─── UI Components ─────────────────────────────────────────────────────────────
interface TagProps{label:string;color:string;bg?:string;border?:string}
function Tag({label,color,bg,border}:TagProps):JSX.Element {
  return <span style={{display:'inline-flex',alignItems:'center',fontSize:9,fontWeight:700,
    fontFamily:"'JetBrains Mono',monospace",padding:'2px 7px',borderRadius:20,whiteSpace:'nowrap',
    color,background:bg??color+'18',border:`1px solid ${border??color+'40'}`}}>{label}</span>;
}

interface KpiProps{value:string;label:string;sub?:string;color:string;delta?:number;animKey:string;icon?:string}
function KpiTile({value,label,sub,color,delta,animKey,icon}:KpiProps):JSX.Element {
  const [vis,setVis]=useState(false);
  useEffect(()=>{setVis(false);const t=setTimeout(()=>setVis(true),60);return()=>clearTimeout(t);},[animKey]);
  const dColor=delta===undefined?C.inkL:delta>0?C.green:delta<0?C.red:C.inkL;
  const dSign=delta!==undefined&&delta>0?'↑ +':delta!==undefined&&delta<0?'↓ ':'→ ';
  return(
    <div className="hover-lift" style={{flex:1,minWidth:0,padding:'12px 13px',background:C.white,borderRadius:12,border:`1px solid ${C.border}`}}>
      {icon&&<div style={{fontSize:17,marginBottom:3}}>{icon}</div>}
      <div className="mono num-in" style={{fontSize:19,fontWeight:700,color,lineHeight:1,opacity:vis?1:0,transition:'opacity .3s'}}>{value}</div>
      {delta!==undefined&&<div style={{fontSize:9,fontWeight:700,color:dColor,marginTop:2}}>{dSign}{fmt(Math.abs(delta))} vs baseline</div>}
      <div style={{fontSize:10,color:C.inkM,marginTop:4,lineHeight:1.4}}>{label}</div>
      {sub&&<div style={{fontSize:9,color:C.inkL,marginTop:2}}>{sub}</div>}
    </div>
  );
}

interface OccBarProps{pct:number;color?:string}
function OccBar({pct,color}:OccBarProps):JSX.Element {
  const c=color??(pct>85?C.red:pct>65?C.amber:C.green);
  return(
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{flex:1,height:5,background:C.borderL,borderRadius:3,overflow:'hidden'}}>
        <div style={{width:`${Math.min(100,pct)}%`,height:'100%',background:c,borderRadius:3,transition:'width .5s ease'}}/>
      </div>
      <span className="mono" style={{fontSize:10,fontWeight:700,color:c,minWidth:30}}>{pct}%</span>
    </div>
  );
}

interface ToggleProps{value:boolean;onChange:(v:boolean)=>void;label:string;sublabel?:string;color?:string}
function Toggle({value,onChange,label,sublabel,color=C.blue}:ToggleProps):JSX.Element {
  return(
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.borderL}`,gap:10}}>
      <div><div style={{fontSize:12,color:C.ink,fontWeight:500}}>{label}</div>
        {sublabel&&<div style={{fontSize:9,color:C.inkL,marginTop:1}}>{sublabel}</div>}
      </div>
      <div onClick={()=>onChange(!value)} style={{width:36,height:20,borderRadius:10,background:value?color:C.borderL,cursor:'pointer',position:'relative',transition:'background .2s',border:`1px solid ${value?color:C.border}`,flexShrink:0,marginTop:2}}>
        <div style={{position:'absolute',top:2,left:value?16:2,width:14,height:14,borderRadius:'50%',background:'white',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
      </div>
    </div>
  );
}

interface SliderRowProps{label:string;value:number;onChange:(v:number)=>void;min:number;max:number;step:number;baseline:number;color:string;unit?:string}
function SliderRow({label,value,onChange,min,max,step,baseline,color,unit='/h'}:SliderRowProps):JSX.Element {
  const changed=value!==baseline;
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <span style={{fontSize:11,fontWeight:600,color:C.inkM}}>{label}</span>
        <span className="mono" style={{fontSize:15,fontWeight:800,color:changed?(value>baseline?C.red:C.green):C.inkM}}>
          {value===0?'GRATUIT':`CHF ${value.toFixed(1)}${unit}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))}
        style={{width:'100%',background:rangeBg(value,min,max,color),accentColor:color}}/>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:8.5,color:C.inkL,marginTop:2}}>
        <span>{min===0?'GRATUIT':`CHF ${min}`}</span>
        <span style={{color:C.inkM}}>← CHF {baseline.toFixed(1)} baseline</span>
        <span>CHF {max}</span>
      </div>
    </div>
  );
}

// ─── Interactive MapLibre GL map with parking pins ────────────────────────────
interface MapProps{simResults:SimResult|null;hoveredId:string|null;setHoveredId:(id:string|null)=>void}
interface TooltipState{id:string;x:number;y:number}

function SionMap({simResults,hoveredId,setHoveredId}:MapProps):JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map|null>(null);
  const markersRef   = useRef<Record<string,maplibregl.Marker>>({});
  const [tooltip,setTooltip]=useState<TooltipState|null>(null);

  const getOcc=(p:Parking)=>{
    if(!simResults)return p.occ;
    if(p.type==='centre')return simResults.centreOcc;
    if(p.type==='pr')return Math.min(96,p.occ+Math.round(simResults.prUsage/(SIM.prPlaces||1)*40));
    return p.occ;
  };

  // Update tooltip pixel position (called on map move/zoom)
  const refreshTooltip=(map:maplibregl.Map,id:string|null)=>{
    if(!id){setTooltip(null);return;}
    const p=ALL_PARKINGS.find(x=>x.id===id);
    if(!p){setTooltip(null);return;}
    const pt=map.project([p.lng,p.lat]);
    setTooltip({id,x:pt.x,y:pt.y});
  };

  // Init map once
  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=new maplibregl.Map({
      container:containerRef.current,
      style:{
        version:8,
        glyphs:'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources:{'osm-raster':{
          type:'raster',
          tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize:256,
          attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxzoom:19
        }},
        layers:[{id:'osm-raster',type:'raster',source:'osm-raster',minzoom:0,maxzoom:19}]
      },
      center:[7.3630,46.2295],
      zoom:13.8,
      attributionControl:false,
    });
    map.addControl(new maplibregl.NavigationControl({showCompass:false}));
    map.addControl(new maplibregl.AttributionControl({compact:true}),  'bottom-right');
    mapRef.current=map;

    // Add parking markers after style loads
    map.on('load',()=>{
      ALL_PARKINGS.forEach(p=>{
        const col=TYPE_COLOR[p.type]??C.inkM;
        const sz=p.type==='centre'?26:p.type==='pr'?24:p.type==='industrie'?18:20;
        const label=p.type==='pr'?'P+R':p.type==='industrie'?'ZI':'P';
        const occ=getOcc(p);

        // Build custom DOM element
        const el=document.createElement('div');
        el.className='park-pin';
        el.style.cssText='position:relative;cursor:pointer;width:0;height:0;';
        el.innerHTML=`
          <svg width="${sz+12}" height="${sz+12}" style="position:absolute;top:-${sz/2+6}px;left:-${sz/2+6}px;pointer-events:none">
            <circle cx="${(sz+12)/2}" cy="${(sz+12)/2}" r="${(sz+6)/2}" fill="none" stroke="${col}" stroke-width="2.5" opacity=".25"/>
            <circle cx="${(sz+12)/2}" cy="${(sz+12)/2}" r="${(sz+6)/2}" fill="none" stroke="${col}" stroke-width="2.5" opacity=".7"
              stroke-dasharray="${occ/100*Math.PI*(sz+6)} ${Math.PI*(sz+6)}"
              stroke-linecap="round"
              transform="rotate(-90 ${(sz+12)/2} ${(sz+12)/2})"/>
          </svg>
          <div data-pin="${p.id}" style="width:${sz}px;height:${sz}px;border-radius:50%;background:${col}CC;
            border:2.5px solid ${col}80;display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 6px ${col}44;transition:all .15s;position:relative;z-index:1;
            margin-left:-${sz/2}px;margin-top:-${sz/2}px;">
            <span style="font-size:${sz===26?8.5:7}px;font-weight:800;color:white;font-family:'JetBrains Mono',monospace;line-height:1">${label}</span>
          </div>
        `;

        el.addEventListener('click',()=>{
          setHoveredId(hoveredId===p.id?null:p.id);
        });

        const marker=new maplibregl.Marker({element:el,anchor:'center'})
          .setLngLat([p.lng,p.lat])
          .addTo(map);
        markersRef.current[p.id]=marker;
      });
    });

    // Refresh tooltip position on map move
    map.on('move',()=>{
      setTooltip(prev=>{
        if(!prev)return null;
        const pp=ALL_PARKINGS.find(x=>x.id===prev.id);
        if(!pp)return null;
        const pt=map.project([pp.lng,pp.lat]);
        return{id:prev.id,x:pt.x,y:pt.y};
      });
    });

    return()=>{map.remove();mapRef.current=null;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Sync hoveredId → tooltip position & marker style
  useEffect(()=>{
    const map=mapRef.current;
    if(!map||!map.isStyleLoaded())return;
    // Update all marker styles
    ALL_PARKINGS.forEach(p=>{
      const pin=document.querySelector<HTMLElement>(`[data-pin="${p.id}"]`);
      if(!pin)return;
      const col=TYPE_COLOR[p.type]??C.inkM;
      const isH=hoveredId===p.id;
      pin.style.background=isH?col:col+'CC';
      pin.style.border=`2.5px solid ${isH?'white':col+'80'}`;
      pin.style.boxShadow=isH?`0 4px 16px ${col}66`:`0 2px 6px ${col}44`;
      pin.style.zIndex=isH?'10':'1';
    });
    // Set tooltip position
    if(hoveredId&&map){
      const p=ALL_PARKINGS.find(x=>x.id===hoveredId);
      if(p){
        const pt=map.project([p.lng,p.lat]);
        setTooltip({id:hoveredId,x:pt.x,y:pt.y});
      }
    } else {
      setTooltip(null);
    }
  },[hoveredId]);

  // Render tooltip for hovered parking
  const hovP=tooltip?ALL_PARKINGS.find(x=>x.id===tooltip.id):null;
  const occ=hovP?getOcc(hovP):0;
  const col=hovP?(TYPE_COLOR[hovP.type]??C.inkM):C.inkM;

  return(
    <div style={{position:'relative',width:'100%',height:'100%',borderRadius:10,overflow:'hidden'}}>
      {/* MapLibre GL container */}
      <div ref={containerRef} style={{width:'100%',height:'100%'}}/>

      {/* React tooltip overlay */}
      {hovP&&tooltip&&(
        <div className="park-tooltip scale-in"
          style={{
            position:'absolute',
            left:tooltip.x+14,
            top:tooltip.y-10,
            zIndex:30,
            pointerEvents:'none',
          }}>
          <div style={{fontSize:12,fontWeight:800,color:C.ink,marginBottom:3}}>{hovP.short}</div>
          <div style={{fontSize:10,color:C.inkM,marginBottom:2}}>{hovP.places.toLocaleString('fr-CH')} places</div>
          <div style={{fontSize:11,fontWeight:700,color:col,marginBottom:2}}>
            {hovP.tarifBaseline===0?'GRATUIT':`CHF ${hovP.tarifBaseline.toFixed(1)}/h`}
          </div>
          <div style={{fontSize:10,fontWeight:700,color:occ>85?C.red:occ>65?C.amber:C.green}}>
            Occ. {occ}%{!hovP.ok?' · ⚠ estimé':''}
          </div>
          <div style={{fontSize:8.5,color:C.inkL,marginTop:3,maxWidth:180,whiteSpace:'normal',lineHeight:1.4}}>{hovP.note}</div>
        </div>
      )}

      {/* Scenario badge */}
      {simResults&&(
        <div style={{position:'absolute',top:8,left:8,background:simResults.isNegative?C.red:C.green,
          color:'white',borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:800,
          fontFamily:"'JetBrains Mono',monospace",boxShadow:'0 4px 12px rgba(0,0,0,.25)',zIndex:10}}>
          {simResults.isNegative?'-':''}{(Math.abs(simResults.totalShift)*100).toFixed(1)}% report
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV:{id:TabId;label:string;icon:string;hash:string}[]=[
  {id:'dashboard',label:'Tableau de bord',icon:'◈',hash:'#dashboard'},
  {id:'simulator',label:'Simulateur',icon:'⊙',hash:'#simulator'},
  {id:'od',label:'Analyse OD',icon:'↗',hash:'#od'},
  {id:'personas',label:'Personas & équité',icon:'◑',hash:'#personas'},
  {id:'actions',label:"Plan d'action",icon:'▷',hash:'#actions'},
  {id:'donnees',label:'Données',icon:'⊞',hash:'#donnees'},
];
const SEV_COLORS: Record<string,string>={fluide:'#22C55E',modéré:'#F59E0B',dense:'#EA580C',bloqué:'#EF4444'};

function Sidebar({tab,setTab,sev,simDone,tomtomOk}:{tab:TabId;setTab:(t:TabId)=>void;sev:string;simDone:boolean;tomtomOk:boolean|null}):JSX.Element {
  const [time,setTime]=useState(fmtNow());
  useEffect(()=>{const i=setInterval(()=>setTime(fmtNow()),30000);return()=>clearInterval(i);},[]);
  const sc=SEV_COLORS[sev]??'#22C55E';
  return(
    <div style={{width:222,background:C.sidebar,display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0,zIndex:5}}>
      <div style={{padding:'16px 16px 12px',borderBottom:`1px solid ${C.sidebarBorder}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:C.red,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span className="syne" style={{color:'white',fontSize:11,fontWeight:800}}>VS</span>
          </div>
          <div>
            <div className="syne" style={{fontSize:14,fontWeight:800,color:'white',lineHeight:1.15}}>SION-CET</div>
            <div style={{fontSize:9,color:'#4A5070',marginTop:2}}>Choix Évolutif de Transport</div>
          </div>
        </div>
        <div style={{marginTop:8,padding:'5px 8px',background:'#1A1D2C',borderRadius:6}}>
          <div style={{fontSize:8,color:'#383C54',lineHeight:1.55}}>
            Prototype d'aide à la décision<br/>
            <span style={{color:'#4A5070'}}>Projet pilote expérimental MobilityLab</span>
          </div>
        </div>
      </div>
      <nav style={{padding:'10px 8px',flex:1}}>
        {NAV.map(n=>{
          const active=tab===n.id;
          return(
            <button key={n.id} onClick={()=>{setTab(n.id);window.history.replaceState(null,'',n.hash);}}
              style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:8,border:'none',cursor:'pointer',background:active?'#1E2240':'transparent',color:active?'white':'#4A5070',marginBottom:2,transition:'all .15s',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:active?600:400,textAlign:'left'}}>
              <span style={{fontSize:11,opacity:.8,width:16}}>{n.icon}</span>
              <span>{n.label}</span>
              {n.id==='simulator'&&simDone&&<span style={{marginLeft:'auto',width:6,height:6,borderRadius:'50%',background:C.green}}/>}
            </button>
          );
        })}
      </nav>
      <div style={{padding:'12px 16px',borderTop:`1px solid ${C.sidebarBorder}`}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
          <div className="pulse-dot" style={{width:7,height:7,borderRadius:'50%',background:sc,flexShrink:0}}/>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:sc,display:'flex',alignItems:'center',gap:5}}>
              Trafic {sev}
              <span title={tomtomOk===true?'Données TomTom temps réel':tomtomOk===false?'Estimation horaire (pas de clé TomTom)':'Chargement…'}
                style={{fontSize:8,padding:'1px 5px',borderRadius:4,fontWeight:700,
                  background:tomtomOk===true?C.green+'22':C.amber+'22',
                  color:tomtomOk===true?C.green:C.amber,
                  border:`1px solid ${tomtomOk===true?C.green:C.amber}44`,lineHeight:1.6}}>
                {tomtomOk===true?'TomTom ●':'⏱ local'}
              </span>
            </div>
            <div style={{fontSize:9,color:'#30344A'}}>Route Cantonale · Estimé</div>
          </div>
        </div>
        <div className="mono" style={{fontSize:8.5,color:'#30344A',lineHeight:1.6}}>{fmtToday()}<br/>Heure: {time}</div>
        <div style={{marginTop:7,fontSize:8,color:'#252838'}}>v2.2 · MobilityLab prototype<br/>sion.ch 2024-2025 · ARE 2021</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab():JSX.Element {
  const events=useMemo(()=>getSionEvents(),[]);
  const hourly=useMemo(()=>Array.from({length:24},(_,h)=>({
    h,c:h<6?18:h<8?38:h<10?76:h<12?84:h<14?70:h<16?77:h<18?90:h<20?60:h<22?32:20,
    pr:h<6?8:h<8?20:h<10?42:h<13?35:h<15?28:h<18?38:h<20?50:h<22?25:12,
  })),[]);
  const maxV=90;const chartH=110;const cw=20;
  return(
    <div className="fade-up" style={{padding:'20px 24px',overflowY:'auto',height:'100%',maxWidth:1120}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:18}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Tableau de bord mobilité</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>SION-CET Simulator · {fmtToday()}</p>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Tag label="sion.ch 2024-2025" color={C.inkM} bg={C.borderL} border={C.border}/>
          <Tag label="ARE 2021" color={C.blue} bg={C.blueL} border={C.blueB}/>
          <Tag label="MobilityLab prototype" color={C.red} bg={C.redL} border={C.redB}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16}}>
        {[
          {value:'18 500',label:'Véhicules/j entrant Sion',sub:'Zone centre + approches (estimé)',color:C.ink,icon:'🚗'},
          {value:'7 800',label:'Passagers TP/jour',sub:'CarPostal + bus urbains (ARE 2021)',color:C.blue,icon:'🚌'},
          {value:'79%',label:'Occupation parking centre',sub:`Planta+Scex+Cible (${CENTRE_TOTAL} pl.)`,color:C.amber,icon:'🅿'},
          {value:'56%',label:'Part modale voiture solo',sub:'Sion (ARE Microrecensement 2021)',color:C.red,icon:'📊'},
          {value:'26.4 t',label:'CO₂ voitures/jour',sub:'~11 500 trajs × 1.52 kg (mix 2025)',color:C.green,icon:'🌿'},
        ].map((k,i)=><KpiTile key={i} {...k} animKey={`d-${i}`}/>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:14,marginBottom:14}}>
        <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'16px 18px'}}>
          <div className="syne" style={{fontSize:13,fontWeight:700,color:C.ink,marginBottom:12}}>Occupation parkings — profil journalier estimé</div>
          <svg width="100%" height={chartH+22} viewBox={`0 0 ${hourly.length*cw} ${chartH+22}`} preserveAspectRatio="none" style={{overflow:'visible'}}>
            <path d={`M 0 ${chartH} `+hourly.map((d,i)=>`L ${i*cw+cw/2} ${chartH-(d.c/maxV)*chartH}`).join(' ')+` L ${hourly.length*cw} ${chartH}`} fill={C.red+'28'} stroke={C.red} strokeWidth="1.5"/>
            <path d={`M 0 ${chartH} `+hourly.map((d,i)=>`L ${i*cw+cw/2} ${chartH-(d.pr/maxV)*chartH}`).join(' ')+` L ${hourly.length*cw} ${chartH}`} fill={C.green+'28'} stroke={C.green} strokeWidth="1.5"/>
            {hourly.filter((_,i)=>i%4===0).map(d=>(
              <text key={d.h} x={d.h*cw+cw/2} y={chartH+14} textAnchor="middle" fontSize="8" fill={C.inkL} fontFamily="Inter">{d.h}h</text>
            ))}
          </svg>
          <div style={{display:'flex',gap:14,marginTop:4}}>
            {([[C.red,'Parkings centre'],[C.green,'P+R périphérie']] as [string,string][]).map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{width:10,height:3,background:c,borderRadius:2}}/><span style={{fontSize:9,color:C.inkL}}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:6,fontSize:9,color:C.inkL}}>⚠ Profil estimé — calibration capteurs recommandée (Planta/Scex minimum)</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'14px 16px'}}>
            <div className="syne" style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:10}}>Part modale — Sion (ARE 2021)</div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                {([{pct:56,c:C.red,off:0},{pct:22,c:C.inkL,off:56},{pct:18,c:C.blue,off:78},{pct:4,c:C.green,off:96}]).map(seg=>{
                  const r=28,cx=40,cy=40;
                  const sa=(seg.off/100)*2*Math.PI-Math.PI/2;
                  const ea=((seg.off+seg.pct)/100)*2*Math.PI-Math.PI/2;
                  return <path key={seg.off} d={`M ${cx} ${cy} L ${cx+r*Math.cos(sa)} ${cy+r*Math.sin(sa)} A ${r} ${r} 0 ${seg.pct>50?1:0} 1 ${cx+r*Math.cos(ea)} ${cy+r*Math.sin(ea)} Z`} fill={seg.c} stroke="white" strokeWidth="2" opacity=".85"/>;
                })}
                <circle cx="40" cy="40" r="18" fill="white"/>
              </svg>
              <div style={{flex:1}}>
                {([[' 🚗 Voiture','56%',C.red],['🚶 Pied/vélo','22%',C.inkL],['🚌 TP','18%',C.blue],['🚲 Vélo','4%',C.green]] as [string,string,string][]).map(([l,v,c])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10,color:C.inkM}}>{l}</span>
                    <span className="mono" style={{fontSize:11,fontWeight:700,color:c}}>{v}</span>
                  </div>
                ))}
                <div style={{fontSize:8,color:C.inkL,marginTop:4}}>Source: ARE Microrecensement 2021</div>
              </div>
            </div>
          </div>
          <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'12px 14px',flex:1}}>
            <div className="syne" style={{fontSize:11,fontWeight:700,color:C.ink,marginBottom:8}}>Capacité stationnement (données officielles sion.ch)</div>
            {([
              {l:'Centre: Planta (552) + Scex (449) + Cible (204)',n:CENTRE_TOTAL,occ:79,c:C.red},
              {l:'P+R Potences (450) + Échutes II (400) + I (60)',n:910,occ:32,c:C.green},
              {l:'Cour de Gare CFF (estimé)',n:300,occ:91,c:C.blue},
              {l:'Hôpital du Valais – P+R (estimé)',n:400,occ:65,c:C.purple},
              {l:'Péricentre: Nord+Roches-Brunes+St-Guérin+Vissigen',n:671,occ:50,c:C.amber},
            ] as {l:string;n:number;occ:number;c:string}[]).map(p=>(
              <div key={p.l} style={{marginBottom:7}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{fontSize:9,color:C.inkM}}>{p.l}</span>
                  <span className="mono" style={{fontSize:9,color:C.inkL}}>{p.n.toLocaleString('fr-CH')} pl.</span>
                </div>
                <OccBar pct={p.occ} color={p.c}/>
              </div>
            ))}
            <div style={{fontSize:8,color:C.inkL,marginTop:6}}>Planta/Scex/Cible/Nord : sion.ch/stationnement 2025 · Cour de Gare / HVS : estimés</div>
          </div>
        </div>
      </div>
      <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'16px 18px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div className="syne" style={{fontSize:13,fontWeight:700,color:C.ink}}>Événements à fort impact mobilité — Sion</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div className="pulse-dot" style={{width:6,height:6,borderRadius:'50%',background:C.green}}/>
            <span style={{fontSize:10,color:C.green,fontWeight:600}}>Calendrier auto-calculé</span>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {events.slice(0,8).map((e,i)=>{
            const days=daysUntil(e.date);
            return(
              <div key={i} className="hover-lift" style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${e.color}30`,background:`${e.color}08`}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <span className="mono" style={{fontSize:9,color:e.color,fontWeight:700}}>{fmtDate(e.date)}</span>
                  <span className="mono" style={{fontSize:8,color:days===0?'#EF4444':days<=3?e.color:C.inkL}}>{days===0?'Auj.':days===1?'Dem.':`J-${days}`}</span>
                </div>
                <div style={{fontSize:11,fontWeight:600,color:C.ink,lineHeight:1.35,marginBottom:4}}>{e.name}</div>
                <div style={{fontSize:9,color:C.inkL,marginBottom:6}}>📍 {e.lieu}</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:5}}>
                  <Tag label={`Impact ${e.impact}`} color={e.color} bg={`${e.color}15`} border={`${e.color}30`}/>
                </div>
                <div style={{fontSize:8.5,color:C.inkM,lineHeight:1.45,borderTop:`1px solid ${C.borderL}`,paddingTop:5}}>💡 {e.tip}</div>
              </div>
            );
          })}
        </div>
        <div style={{marginTop:10,fontSize:9,color:C.inkL}}>
          Sources: mvvsion.ch (marché ven.) · valais.ch/events (Caves Ouvertes 14–16 mai 2026) · fc-sion.ch · hc-sion.ch — dates indicatives
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — SIMULATEUR
// ═══════════════════════════════════════════════════════════════════════════════
function SimulatorTab():JSX.Element {
  const [centrePrice,setCentrePrice]=useState(3.0);
  const [prPrice,setPrPrice]=useState(0.0);
  const [progressif,setProgressif]=useState(false);
  const [tpDiscount,setTpDiscount]=useState(0);
  const [offreCombinee,setOffreCombinee]=useState(false);
  const [gareCFFPrice,setGareCFFPrice]=useState(2.0);
  const [nordPrice,setNordPrice]=useState(1.5);
  const [rochesBrunesPrice,setRochesBrunesPrice]=useState(1.5);
  const [hopitalPrice,setHopitalPrice]=useState(2.0);
  const [showSecondary,setShowSecondary]=useState(false);
  const [showMethodo,setShowMethodo]=useState(false);
  const [simResults,setSimResults]=useState<SimResult|null>(null);
  const [compareMode,setCompareMode]=useState(false);
  const [hoveredId,setHoveredId]=useState<string|null>(null);
  const [isRunning,setIsRunning]=useState(false);
  const [simKey,setSimKey]=useState(0);
  const params:SimParams={centrePrice,prPrice,progressif,tpDiscount,offreCombinee,gareCFFPrice,nordPrice,rochesBrunesPrice,hopitalPrice};
  const baseParams:SimParams={centrePrice:3.0,prPrice:0,progressif:false,tpDiscount:0,offreCombinee:false,gareCFFPrice:2.0,nordPrice:1.5,rochesBrunesPrice:1.5,hopitalPrice:2.0};
  const baseR=simulate(baseParams);
  const hasChanged=centrePrice!==3.0||prPrice!==0||progressif||tpDiscount>0||offreCombinee||gareCFFPrice!==2.0||nordPrice!==1.5||rochesBrunesPrice!==1.5||hopitalPrice!==2.0;
  const runSim=useCallback(()=>{
    setIsRunning(true);
    setTimeout(()=>{setSimResults(simulate(params));setSimKey(k=>k+1);setIsRunning(false);},550);
  },[centrePrice,prPrice,progressif,tpDiscount,offreCombinee,gareCFFPrice,nordPrice,rochesBrunesPrice,hopitalPrice]);
  const reset=useCallback(()=>{setCentrePrice(3.0);setPrPrice(0);setProgressif(false);setTpDiscount(0);setOffreCombinee(false);setGareCFFPrice(2.0);setNordPrice(1.5);setRochesBrunesPrice(1.5);setHopitalPrice(2.0);setSimResults(null);},[]);
  const R=simResults;
  return(
    <div className="fade-up" style={{display:'flex',height:'100%',overflow:'hidden'}}>
      {/* LEFT PANEL */}
      <div style={{width:280,background:C.white,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.borderL}`}}>
          <div className="syne" style={{fontSize:14,fontWeight:800,color:C.ink}}>Leviers de simulation</div>
          <p style={{fontSize:10,color:C.inkL,marginTop:3}}>SION-CET · Prototype MobilityLab · Résultats indicatifs</p>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 14px'}}>
          {/* Centre */}
          <div style={{padding:'12px 14px',background:C.redL,borderRadius:10,border:`1.5px solid ${C.redB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.red,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Centre-ville · Levier direct</div>
            {[{n:'Planta',p:552},{n:'Scex',p:449},{n:'Cible',p:204}].map(pk=>(
              <div key={pk.n} style={{display:'flex',justifyContent:'space-between',fontSize:9.5,color:'#C04060',marginBottom:3}}>
                <span>P {pk.n}</span><span className="mono" style={{fontWeight:700}}>{pk.p} pl.</span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.redB}`,marginTop:8,paddingTop:8}}>
              <SliderRow label="Tarif horaire (h2+)" value={centrePrice} onChange={setCentrePrice} min={0} max={8} step={0.5} baseline={3.0} color={C.red}/>
              {centrePrice<3&&(
                <div style={{padding:'7px 10px',background:'#FFF0F2',borderRadius:7,border:`1px solid ${C.redB}`,fontSize:9.5,color:C.red,lineHeight:1.5,marginTop:4}}>
                  ⚠️ <strong>Effet négatif</strong> : baisser le tarif augmente l'attractivité → plus de voitures, saturation.
                </div>
              )}
            </div>
            <div style={{fontSize:8.5,color:'#D06070',lineHeight:1.5,marginTop:4}}>1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30</div>
          </div>
          {/* P+R */}
          <div style={{padding:'12px 14px',background:C.greenL,borderRadius:10,border:`1.5px solid ${C.greenB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.green,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>P+R Périphérie · GRATUITS</div>
            {[{n:'P+R Potences',p:450,note:'BS11 ~12 min'},{n:"P+R Échutes II",p:400,note:'BS11 ~10 min'},{n:"P+R Échutes I",p:60,note:'BS11'}].map(pk=>(
              <div key={pk.n} style={{display:'flex',justifyContent:'space-between',fontSize:9.5,color:'#0A7045',marginBottom:3}}>
                <span>{pk.n} · {pk.note}</span><span className="mono" style={{fontWeight:700}}>{pk.p} pl.</span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.greenB}`,marginTop:8,paddingTop:8}}>
              <SliderRow label="Tarif P+R" value={prPrice} onChange={setPrPrice} min={0} max={4} step={0.5} baseline={0} color={C.green}/>
              {prPrice>0&&<div style={{fontSize:9,color:C.amber,marginTop:4}}>⚠️ Rendre le P+R payant réduit son attractivité.</div>}
            </div>
          </div>
          {/* TP */}
          <div style={{padding:'12px 14px',background:C.blueL,borderRadius:10,border:`1.5px solid ${C.blueB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.blue,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Transports publics</div>
            <SliderRow label="Remise TP hors-pointe" value={tpDiscount} onChange={setTpDiscount} min={0} max={50} step={5} baseline={0} color={C.blue} unit="%"/>
            {tpDiscount>0&&<div style={{fontSize:9,color:C.blue,marginTop:4}}>💡 Remise {tpDiscount}% → ~{Math.round(tpDiscount*0.5)} voyageurs/j supplémentaires</div>}
            <Toggle value={offreCombinee} onChange={setOffreCombinee} color={C.blue} label="Offre combinée P+R + billet TP" sublabel="P+R gratuit + billet 24h CarPostal CHF 3.–"/>
            <div style={{marginTop:8,padding:'8px 10px',background:'white',borderRadius:7,border:`1px solid ${C.blueB}`,fontSize:9,color:C.inkM,lineHeight:1.6}}>
              🅿 Abo mensuel Planta/Scex: <strong>CHF 160/mois</strong><br/>
              🚌 AG CFF (incl. TP Sion): <strong>CHF 3 860/an</strong>
            </div>
          </div>
          {/* Mesures comp */}
          <div style={{marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Mesures complémentaires</div>
            <Toggle value={progressif} onChange={setProgressif} color={C.amber} label="Tarification progressive (>3h)" sublabel="CHF 3/h → CHF 4/h après 3h · pénalise pendulaires centre"/>
          </div>
          {/* Secondaire */}
          <div style={{marginBottom:10}}>
            <button onClick={()=>setShowSecondary(!showSecondary)}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${showSecondary?C.amberB:C.border}`,background:showSecondary?C.amberL:C.borderL,cursor:'pointer',fontFamily:'Inter',fontSize:11,fontWeight:700,color:showSecondary?C.amber:C.inkM}}>
              <span>Parkings hors périmètre (fuite modale)</span><span>{showSecondary?'▲':'▼'}</span>
            </button>
            {showSecondary&&(
              <div className="fade-up" style={{padding:'10px 12px',background:C.amberL,borderRadius:'0 0 10px 10px',border:`1.5px solid ${C.amberB}`,borderTop:'none',marginTop:-1}}>
                <div style={{fontSize:9,color:C.amber,lineHeight:1.5,marginBottom:10,padding:'6px 8px',background:'white',borderRadius:6}}>
                  ⚠️ Parkings hors contrôle Ville (CFF, HVS). Tarifs <strong>estimés</strong>. Si moins chers que le centre → fuite modale.
                </div>
                <SliderRow label="Cour de Gare CFF (estimé)" value={gareCFFPrice} onChange={setGareCFFPrice} min={0} max={5} step={0.5} baseline={2.0} color={C.blue}/>
                <SliderRow label="Parking Nord (estimé)" value={nordPrice} onChange={setNordPrice} min={0} max={4} step={0.5} baseline={1.5} color={C.amber}/>
                <SliderRow label="Roches-Brunes (estimé)" value={rochesBrunesPrice} onChange={setRochesBrunesPrice} min={0} max={4} step={0.5} baseline={1.5} color={C.amber}/>
                <SliderRow label="P+R Hôpital HVS (estimé)" value={hopitalPrice} onChange={setHopitalPrice} min={0} max={5} step={0.5} baseline={2.0} color={C.purple}/>
              </div>
            )}
          </div>
        </div>
        <div style={{padding:'12px 14px',borderTop:`1px solid ${C.borderL}`}}>
          <button onClick={runSim} disabled={isRunning}
            style={{width:'100%',padding:11,borderRadius:9,border:'none',background:isRunning?C.borderL:hasChanged?C.red:C.inkM,color:isRunning?C.inkL:'white',fontSize:13,fontWeight:800,cursor:isRunning?'not-allowed':'pointer',fontFamily:'Syne,sans-serif',transition:'all .2s'}}>
            {isRunning?'Simulation…':hasChanged?'▶ Simuler ce scénario':'▶ Simuler (baseline)'}
          </button>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button onClick={()=>setCompareMode(!compareMode)} style={{flex:1,padding:7,borderRadius:8,border:`1.5px solid ${compareMode?C.blue:C.border}`,background:compareMode?C.blueL:'transparent',color:compareMode?C.blue:C.inkM,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'Inter'}}>⇄ Comparer</button>
            <button onClick={reset} style={{padding:'7px 12px',borderRadius:8,border:`1.5px solid ${C.border}`,background:'transparent',color:C.inkL,fontSize:11,cursor:'pointer',fontFamily:'Inter'}}>Reset</button>
          </div>
        </div>
      </div>
      {/* CENTER: MAP */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:C.bg}}>
        {R&&(
          <div style={{padding:'10px 14px',background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',gap:8}}>
            <KpiTile key={simKey+'a'} animKey={simKey+'a'} value={(R.isNegative?'+':'-')+fmt(R.carsReduced)} label={R.isNegative?'Voitures/j en PLUS':'Voitures/j en moins'} delta={R.isNegative?-R.carsReduced:R.carsReduced} color={R.isNegative?C.red:C.green}/>
            <KpiTile key={simKey+'b'} animKey={simKey+'b'} value={(R.tpGain>=0?'+':'')+fmt(R.tpGain)} label="Variation voyageurs TP/j" delta={R.tpGain} color={R.tpGain>=0?C.blue:C.red}/>
            <KpiTile key={simKey+'c'} animKey={simKey+'c'} value={(R.co2>=0?'-':'+')+fmt(Math.abs(R.co2))+' kg'} label="CO₂ évité/généré /j" delta={R.co2} color={R.co2>=0?C.green:C.red}/>
            <KpiTile key={simKey+'d'} animKey={simKey+'d'} value={`CHF ${fmt(R.revenueDay)}`} label="Recettes parking centre/j" delta={R.revDelta} color={R.revDelta>=0?C.amber:C.red} sub={`Δ ${R.revDelta>=0?'+':''}CHF ${fmt(R.revDelta)}/j`}/>
          </div>
        )}
        {R?.isNegative&&(
          <div style={{padding:'9px 16px',background:'#FFF0F2',borderBottom:`2px solid ${C.redB}`,display:'flex',gap:10,alignItems:'center'}}>
            <span style={{fontSize:18}}>⚠️</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.red}}>Effets négatifs détectés</div>
              <div style={{fontSize:9.5,color:'#8B2030'}}>
                Baisser le tarif sous CHF 3.0/h augmente l'attractivité du centre → occ. {R.centreOcc}%, congestion {R.congestion}/4
              </div>
            </div>
          </div>
        )}
        <div style={{flex:1,padding:12,display:'flex',flexDirection:'column',gap:8,minHeight:0}}>
          <div style={{flex:1,borderRadius:12,overflow:'hidden',border:`1px solid ${C.border}`,minHeight:0}}>
            <SionMap simResults={R} hoveredId={hoveredId} setHoveredId={setHoveredId}/>
          </div>
          <div style={{padding:'7px 12px',background:C.amberL,borderRadius:8,border:`1px solid ${C.amberB}`,fontSize:9.5,color:C.amber,flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setShowMethodo(!showMethodo)}>
              <span><strong>Modèle SION-CET</strong> — Logit RUM · Élasticité arc −0.30 · CO₂ 1.52 kg/trajet · Prototype indicatif</span>
              <span style={{marginLeft:8,fontWeight:700}}>{showMethodo?'▲':'▼ Méthodologie'}</span>
            </div>
            {showMethodo&&(
              <div className="fade-up" style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.amberB}`,lineHeight:1.7,color:C.amber}}>
                <strong style={{fontSize:10}}>Formule de report modal</strong><br/>
                <code style={{fontSize:9,background:'white',padding:'2px 6px',borderRadius:4,display:'inline-block',margin:'3px 0',color:'#6B4A00'}}>
                  Shift = (ΔPrix / BasePrix) × (−ε) = (ΔP / 3.0) × 0.30
                </code><br/>
                L'élasticité prix de la demande automobile <strong>ε = −0.30</strong> signifie qu'une hausse de 1% du tarif réduit la demande voiture de 0.30%. Le shift modal attendu (gain TP) est l'inverse : <em>−ε × ΔP/P = +0.30 × ΔP/P</em>.<br/><br/>
                <strong style={{fontSize:10}}>Paramètres de base calibrés sur Sion</strong><br/>
                • Trafic voiture journalier : <strong>11 500 véh./j</strong> (ARE Microrecensement 2021, corr. Sion)<br/>
                • Fréquentation TP quotidienne : <strong>7 800 pax/j</strong> (CarPostal 2025, estimé BVR MVV)<br/>
                • Durée moyenne stationnement centre : <strong>2.5h</strong> (données Planta/Scex 2024)<br/>
                • Rotation moyenne : <strong>4.5 rot./pl./j</strong> (capacité 1 205 pl. centre)<br/>
                • CO₂ par trajet voiture évité : <strong>1.52 kg</strong> (OFEV mix véhicule Suisse 2025, 14.3 km moy. trajet)<br/>
                • Plafonds empiriques : gain TP max <strong>+38%</strong> / afflux voiture max <strong>+46%</strong> (saturation)<br/><br/>
                <strong style={{fontSize:10}}>Sources scientifiques</strong><br/>
                • Litman T. (2023) — <em>Parking Pricing Implementation Guidelines</em>, Victoria Transport Policy Institute<br/>
                • Shoup D. (2011) — <em>The High Cost of Free Parking</em> (élasticité −0.1 à −0.6, médiane −0.3)<br/>
                • ARE / OFS (2021) — Microrecensement Mobilité et Transports, Confédération suisse<br/>
                • TCS / ADAC (2024) — Enquête comportementale automobilistes urbains Suisse romande<br/>
                • OFEV (2025) — Inventaire national des émissions CO₂, transport routier<br/><br/>
                <strong style={{fontSize:10,color:C.red}}>⚠️ Prototype indicatif</strong> — Résultats à ±30%. Calibration fine recommandée avec comptages réels (capteurs Planta/Scex) et enquête origine-destination 2025.
              </div>
            )}
          </div>
        </div>
      </div>
      {/* RIGHT: RESULTS */}
      <div style={{width:272,background:C.white,borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.borderL}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div className="syne" style={{fontSize:13,fontWeight:800,color:C.ink}}>{compareMode?'Comparaison':'Résultats'}</div>
          {R&&<span className="mono" style={{fontSize:10,fontWeight:700,color:R.isNegative?C.red:C.green,background:R.isNegative?C.redL:C.greenL,padding:'2px 8px',borderRadius:20,border:`1px solid ${R.isNegative?C.redB:C.greenB}`}}>
            {R.isNegative?'-':''}{(Math.abs(R.totalShift)*100).toFixed(1)}% report
          </span>}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 14px'}}>
          {compareMode&&R?(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {([{label:'Situation actuelle',r:baseR,price:3.0,isBase:true},{label:'Scénario simulé',r:R,price:centrePrice,isBase:false}]).map(col=>(
                <div key={col.label} style={{borderRadius:10,border:`1.5px solid ${col.isBase?C.border:col.r.isNegative?C.redB:C.blueB}`,padding:'10px 12px',background:col.isBase?C.borderL:col.r.isNegative?C.redL:C.blueL}}>
                  <div className="syne" style={{fontSize:10,fontWeight:800,color:col.isBase?C.inkM:col.r.isNegative?C.red:C.blue,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5}}>{col.label}</div>
                  <div className="mono" style={{fontSize:16,fontWeight:800,color:col.isBase?C.inkM:col.r.isNegative?C.red:C.blue,marginBottom:8}}>{col.price===0?'GRATUIT':`CHF ${col.price.toFixed(1)}/h`}</div>
                  {([[' 🚗 Voitures/j',fmt(SIM.dailyCar-(col.r.isNegative?-col.r.carsReduced:col.r.carsReduced))],['🚌 TP pax/j',fmt(SIM.dailyTP+col.r.tpGain)],['🅿 Occ. centre',`${col.r.centreOcc}%`],['💰 Recettes/j',`CHF ${fmt(col.r.revenueDay)}`]] as [string,string][]).map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'4px 0',borderBottom:`1px solid ${col.isBase?C.border:C.blueB}`}}>
                      <span style={{color:C.inkM}}>{l}</span>
                      <span className="mono" style={{fontWeight:700,color:col.isBase?C.inkM:C.blue}}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ):R?(
            <>
              <div style={{background:R.isNegative?C.redL:C.greenL,borderRadius:10,padding:'12px 14px',marginBottom:12,border:`1.5px solid ${R.isNegative?C.redB:C.greenB}`}}>
                <div style={{fontSize:10,color:R.isNegative?C.red:C.green,fontWeight:600,marginBottom:3}}>{R.isNegative?'Effet négatif simulé':'Report modal global'}</div>
                <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                  <span className="mono" style={{fontSize:34,fontWeight:800,color:R.isNegative?C.red:C.green,lineHeight:1}}>
                    {R.isNegative?'-':''}{(Math.abs(R.totalShift)*100).toFixed(1)}%
                  </span>
                </div>
                <div style={{fontSize:9,color:C.inkL,marginTop:4}}>Élasticité arc −0.30 · effets combinés · ARE 2021</div>
              </div>
              {([
                {icon:'🚗',l:R.isNegative?'Voitures en plus/j':'Voitures en moins/j',v:(R.isNegative?'+':'-')+fmt(R.carsReduced),c:R.isNegative?C.red:C.green},
                {icon:'🚌',l:'Voyageurs TP supp./j',v:(R.tpGain>=0?'+':'')+fmt(R.tpGain),c:R.tpGain>=0?C.blue:C.red},
                {icon:'🅿',l:'Occupation centre',v:`${R.centreOcc}%`,c:R.centreOcc>85?C.red:R.centreOcc>65?C.amber:C.green},
                {icon:'🌿',l:'CO₂ évité−/généré+',v:`${R.co2>=0?'-':'+'} ${fmt(Math.abs(R.co2))} kg`,c:R.co2>=0?C.green:C.red},
                {icon:'💰',l:'Recettes parking/j',v:`CHF ${fmt(R.revenueDay)}`,c:R.revDelta>=0?C.amber:C.red},
                {icon:'🅿',l:'P+R usage supp./j',v:R.prUsage>0?`+${fmt(R.prUsage)}`:'stable',c:C.green},
              ] as {icon:string;l:string;v:string;c:string}[]).map(item=>(
                <div key={item.l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px',background:`${item.c}09`,borderRadius:8,marginBottom:5,border:`1px solid ${item.c}22`}}>
                  <span style={{fontSize:10,color:C.inkM}}>{item.icon} {item.l}</span>
                  <span className="mono" style={{fontSize:11,fontWeight:800,color:item.c}}>{item.v}</span>
                </div>
              ))}
              <div style={{marginTop:12,padding:'9px 10px',background:C.borderL,borderRadius:8}}>
                <div className="syne" style={{fontSize:9,fontWeight:700,color:C.inkL,textTransform:'uppercase',marginBottom:6}}>Annualisé (250j)</div>
                {([
                  {l:'CO₂/an',v:`${R.co2>=0?'-':'+'}${fmt(Math.abs(R.co2)*250/1000)} tCO₂`,c:R.co2>=0?C.green:C.red},
                  {l:'Recettes/an',v:`CHF ${fmt(R.revenueDay*250)}`,c:C.amber},
                  {l:'Δ recettes/an',v:`${R.revDelta>=0?'+':''}CHF ${fmt(R.revDelta*250)}`,c:R.revDelta>=0?C.green:C.red},
                ] as {l:string;v:string;c:string}[]).map(item=>(
                  <div key={item.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.borderL}`}}>
                    <span style={{fontSize:10,color:C.inkM}}>{item.l}</span>
                    <span className="mono" style={{fontSize:11,fontWeight:800,color:item.c}}>{item.v}</span>
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{textAlign:'center',padding:'36px 16px'}}>
              <div style={{fontSize:38,marginBottom:12}}>⊙</div>
              <div className="syne" style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:8}}>Prêt à simuler</div>
              <p style={{fontSize:11,color:C.inkL,lineHeight:1.7}}>Ajustez un levier puis cliquez <strong>Simuler</strong>.</p>
            </div>
          )}
        </div>
        <div style={{padding:'7px 12px',borderTop:`1px solid ${C.borderL}`,fontSize:8.5,color:C.inkL}}>sion.ch 2024-2025 · ARE 2021 · Litman 2023 · SION-CET MobilityLab</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — OD
// ═══════════════════════════════════════════════════════════════════════════════
function ODTab():JSX.Element {
  const [sel,setSel]=useState<ZoneOD|null>(null);
  const total=ZONES_OD.reduce((s,z)=>s+z.pop,0);
  const captifPop=ZONES_OD.filter(z=>z.cap==='captif').reduce((s,z)=>s+z.pop,0);
  return(
    <div className="fade-up" style={{padding:'20px 24px',overflowY:'auto',height:'100%',maxWidth:1120}}>
      <div style={{marginBottom:18}}>
        <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Analyse Origine–Destination</h1>
        <p style={{fontSize:12,color:C.inkL,marginTop:4}}>Compétitivité TP vs voiture · Identification populations captives par commune</p>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        {([{v:fmt(total),l:"Habitants zones d'origine",c:C.ink},{v:`${Math.round(captifPop/total*100)}%`,l:'Population captive voiture',c:C.red},{v:`${ZONES_OD.filter(z=>z.cap==='ok').length}`,l:'Communes TP compétitif',c:C.green},{v:`${ZONES_OD.filter(z=>z.freq<=30).length}`,l:'Communes fréq. TP ≤30 min',c:C.blue}] as {v:string;l:string;c:string}[]).map((k,i)=><KpiTile key={i} value={k.v} label={k.l} color={k.c} animKey={`od-${i}`}/>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 330px',gap:14}}>
        <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1.2fr .8fr .7fr .7fr 1fr 1fr',padding:'9px 15px',background:C.borderL,borderBottom:`1px solid ${C.border}`}}>
            {['Commune','Population','Voiture','TP actuel','Ligne','Statut'].map(h=>(
              <div key={h} className="syne" style={{fontSize:9,fontWeight:700,color:C.inkM,textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</div>
            ))}
          </div>
          {ZONES_OD.map((z,i)=>{
            const cs=CAP_C[z.cap];
            return(
              <div key={z.id} onClick={()=>setSel(sel?.id===z.id?null:z)}
                style={{display:'grid',gridTemplateColumns:'1.2fr .8fr .7fr .7fr 1fr 1fr',padding:'9px 15px',borderBottom:`1px solid ${C.borderL}`,cursor:'pointer',background:sel?.id===z.id?C.blueL:i%2===0?C.white:C.bg,transition:'background .1s'}}>
                <div style={{fontSize:12,fontWeight:600,color:C.ink}}>{z.label}</div>
                <div className="mono" style={{fontSize:10,color:C.inkM}}>{(z.pop/1000).toFixed(1)}k</div>
                <div className="mono" style={{fontSize:10,color:C.inkM}}>{z.car} min</div>
                <div className="mono" style={{fontSize:10,color:z.tp/z.car>2.5?C.red:z.tp/z.car>1.8?C.amber:C.green,fontWeight:700}}>{z.tp} min</div>
                <div style={{fontSize:9,color:C.inkM}}>{z.line}</div>
                <Tag label={`${z.freq} min · ${cs.l}`} color={cs.c} bg={cs.bg} border={cs.b}/>
              </div>
            );
          })}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {sel?(
            <div className="scale-in" style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
              <div className="syne" style={{fontSize:16,fontWeight:800,color:C.ink,marginBottom:4}}>{sel.label}</div>
              <div style={{fontSize:12,color:C.inkL,marginBottom:12}}>{(sel.pop/1000).toFixed(1)}k habitants</div>
              {([['Voiture',`${sel.car} min`,C.red],['TP actuel',`${sel.tp} min`,C.blue],['Ratio TP/voiture',`×${(sel.tp/sel.car).toFixed(1)}`,sel.tp/sel.car>2.5?C.red:C.amber],['Fréquence',`${sel.freq} min`,C.blue],['Ligne',sel.line,C.inkM]] as [string,string,string][]).map(([l,v,c])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.borderL}`}}>
                  <span style={{fontSize:11,color:C.inkM}}>{l}</span>
                  <span className="mono" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
              <div style={{marginTop:12,padding:'10px',background:CAP_C[sel.cap].bg,borderRadius:8,border:`1px solid ${CAP_C[sel.cap].b}`,fontSize:11,color:CAP_C[sel.cap].c,lineHeight:1.5}}>
                {sel.cap==='captif'?'⚠️ Population captive voiture — priorité renfort TP ou desserte P+R':sel.cap==='moyen'?"⚡ Potentiel d'amélioration — fréquence TP à augmenter":'✅ TP compétitif — maintenir et communiquer'}
              </div>
            </div>
          ):(
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:20,display:'flex',alignItems:'center',justifyContent:'center',minHeight:160}}>
              <p style={{fontSize:12,color:C.inkL,textAlign:'center'}}>↑ Cliquez sur une commune pour le détail</p>
            </div>
          )}
          <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:14}}>
            <div className="syne" style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:10}}>Temps TP vs Voiture</div>
            <svg width="100%" height="140" viewBox={`0 0 ${ZONES_OD.length*28} 130`} preserveAspectRatio="none" style={{overflow:'visible'}}>
              {ZONES_OD.map((z,i)=>{
                const maxT=60,ch=80,by=100;
                return(
                  <g key={z.id}>
                    <rect x={i*28+2} y={by-(z.car/maxT)*ch} width={10} height={(z.car/maxT)*ch} fill={C.red} opacity=".75" rx="1"/>
                    <rect x={i*28+14} y={by-(z.tp/maxT)*ch} width={10} height={(z.tp/maxT)*ch} fill={C.blue} opacity=".85" rx="1"/>
                    <text x={i*28+12} y={by+12} textAnchor="middle" fontSize="6.5" fill={C.inkL} fontFamily="Inter">{z.label.slice(0,4)}</text>
                  </g>
                );
              })}
            </svg>
            <div style={{display:'flex',gap:12,marginTop:4}}>
              {([[C.red,'Voiture'],[C.blue,'TP actuel']] as [string,string][]).map(([c,l])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{fontSize:9,color:C.inkL}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — PERSONAS
// ═══════════════════════════════════════════════════════════════════════════════
function PersonasTab():JSX.Element {
  const [sel,setSel]=useState<string|null>(null);
  const [price,setPrice]=useState(3.0);
  const getImpact=(p:PersonaData):PersonaImpact=>{
    if(p.id==='p11')return{delta:0,equityFlag:false,switch:false,concerned:false,note:'Utilise le vélo — non concerné par le tarif parking'};
    if(p.dest==='hopital')return{delta:0,equityFlag:false,switch:false,concerned:false,note:p.note??'Zone Champsec — hors périmètre centre'};
    if(p.dest==='industrie')return{delta:0,equityFlag:false,switch:false,concerned:false,note:p.note??'Parking privé gratuit Ronquoz'};
    if(p.avgStayH===0)return{delta:0,equityFlag:false,switch:false,concerned:false,note:'Non concerné'};
    // 1h gratuite dans tous les parkings centre (Planta/Scex/Cible)
    // → durée facturable = max(0, durée – 1h)
    const billable=Math.max(0,p.avgStayH-1);
    if(billable===0)return{delta:0,equityFlag:false,switch:false,concerned:false,
      note:`Stationnement ≤ 1h → couvert par la franchise gratuite (pas d'impact tarifaire pour ce profil)`};
    const before=billable*3.0;const after=billable*price;
    const delta=parseFloat((after-before).toFixed(2));
    // Bascule modale : seulement si coût augmente ET profil réceptif aux TP ET pas trop captif
    const switchPossible=delta>1.5&&p.tpAff>0.35&&p.carDep<0.9;
    return{delta,beforeCHF:before.toFixed(2),afterCHF:after.toFixed(2),equityFlag:p.income==='faible'&&delta>2,switch:switchPossible,concerned:true,note:''};
  };
  const concerned=PERSONAS.filter(p=>getImpact(p).concerned);
  const equityCount=concerned.filter(p=>getImpact(p).equityFlag).length;
  const switchCount=concerned.filter(p=>getImpact(p).switch).length;
  return(
    <div className="fade-up" style={{padding:'20px 24px',overflowY:'auto',height:'100%',maxWidth:1120}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Personas & équité</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>12 profils types · Impact tarifaire dynamique · Analyse d'équité sociale</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:C.white,borderRadius:12,border:`1px solid ${C.border}`}}>
          <span style={{fontSize:11,color:C.inkM}}>Simuler à</span>
          <span className="mono" style={{fontSize:18,fontWeight:800,color:price<3?C.green:price>3?C.red:C.inkM}}>{price===0?'GRATUIT':`CHF ${price.toFixed(1)}/h`}</span>
          <input type="range" min={0} max={8} step={0.5} value={price} onChange={e=>setPrice(parseFloat(e.target.value))} style={{width:90,background:rangeBg(price,0,8,C.red),accentColor:C.red}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16}}>
        {([{v:equityCount,l:'Risques équité détectés',c:equityCount>0?C.red:C.green,bg:equityCount>0?C.redL:C.greenL},{v:switchCount,l:'Bascules modales probables',c:C.blue,bg:C.blueL},{v:PERSONAS.filter(p=>!getImpact(p).concerned).length,l:'Profils non concernés tarif centre',c:C.inkM,bg:C.borderL},{v:PERSONAS.filter(p=>p.income==='faible').length,l:'Profils revenu modeste',c:C.amber,bg:C.amberL}] as {v:number;l:string;c:string;bg:string}[]).map((k,i)=>(
          <div key={i} style={{flex:1,background:k.bg,borderRadius:10,border:`1px solid ${k.c}30`,padding:'10px 12px'}}>
            <div className="mono" style={{fontSize:24,fontWeight:800,color:k.c}}>{k.v}</div>
            <div style={{fontSize:10,color:k.c,marginTop:4,lineHeight:1.4}}>{k.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {PERSONAS.map(p=>{
          const imp=getImpact(p);const isSel=sel===p.id;
          const bc=imp.equityFlag?C.redB:!imp.concerned?C.border:isSel?C.blueB:C.border;
          return(
            <div key={p.id} className="hover-lift" onClick={()=>setSel(isSel?null:p.id)}
              style={{background:C.white,borderRadius:10,border:`1.5px solid ${bc}`,padding:'12px 14px',cursor:'pointer',opacity:!imp.concerned&&price!==3?0.65:1}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                <span style={{fontSize:26}}>{p.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.ink,lineHeight:1.3}}>{p.label}</div>
                  <div style={{fontSize:9,color:C.inkL,marginTop:1}}>{p.desc}</div>
                </div>
                {imp.equityFlag&&<span style={{fontSize:16}}>⚠️</span>}
              </div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                <Tag label={p.income==='faible'?'Revenu modeste':p.income==='élevé'?'Revenu élevé':'Revenu moyen'} color={p.income==='faible'?C.red:p.income==='élevé'?C.green:C.amber}/>
                {imp.switch&&<Tag label="Bascule probable" color={C.blue} bg={C.blueL} border={C.blueB}/>}
                {!imp.concerned&&<Tag label="Non concerné" color={C.inkL} bg={C.borderL} border={C.border}/>}
              </div>
              {imp.concerned?(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginBottom:8}}>
                  <div style={{textAlign:'center',padding:'5px 3px',background:C.redL,borderRadius:6}}>
                    <div className="mono" style={{fontSize:11,fontWeight:700,color:C.red}}>{Math.round(p.carDep*100)}%</div>
                    <div style={{fontSize:7.5,color:C.inkL}}>dépen. voiture</div>
                  </div>
                  <div style={{textAlign:'center',padding:'5px 3px',background:C.blueL,borderRadius:6}}>
                    <div className="mono" style={{fontSize:11,fontWeight:700,color:C.blue}}>{Math.round(p.tpAff*100)}%</div>
                    <div style={{fontSize:7.5,color:C.inkL}}>affinité TP</div>
                  </div>
                  <div style={{textAlign:'center',padding:'5px 3px',background:imp.equityFlag?C.redL:imp.delta>0?C.amberL:C.greenL,borderRadius:6}}>
                    <div className="mono" style={{fontSize:11,fontWeight:700,color:imp.equityFlag?C.red:imp.delta>0?C.amber:C.green}}>
                      {imp.delta>0?'+':imp.delta<0?'-':''}{Math.abs(imp.delta).toFixed(2)} CHF
                    </div>
                    <div style={{fontSize:7.5,color:C.inkL}}>impact/visite</div>
                  </div>
                </div>
              ):(
                <div style={{padding:'7px 8px',background:C.borderL,borderRadius:7,marginBottom:8}}>
                  <div style={{fontSize:9,color:C.inkM}}>ℹ {imp.note}</div>
                </div>
              )}
              {isSel&&(
                <div className="fade-up" style={{borderTop:`1px solid ${C.borderL}`,paddingTop:8,marginTop:4}}>
                  {imp.concerned&&<div style={{fontSize:10,color:C.inkM,marginBottom:5}}>
                    <strong>Avant:</strong> CHF {imp.beforeCHF} → <strong>Après CHF {price.toFixed(1)}/h:</strong> CHF {imp.afterCHF}
                  </div>}
                  <div style={{fontSize:9,color:C.inkM,lineHeight:1.55,marginBottom:6}}>
                    {imp.equityFlag?'⚠️ Impact disproportionné sur revenu faible — taxibons, abo TP subventionnés':
                     imp.switch?'✅ Probabilité élevée de bascule modale — communiquer offre P+R + BS11':
                     !imp.concerned?'ℹ Ce profil utilise un parking hors périmètre centre.':
                     p.carDep>0.88?'🔒 Très forte dépendance voiture':'ℹ Impact modéré — adaptation progressive probable'}
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {p.tags.map(t=><Tag key={t} label={t} color={C.inkM} bg={C.borderL} border={C.border}/>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function ActionsTab():JSX.Element {
  const [exp,setExp]=useState<Record<string,boolean>>({});
  const doExport=()=>{
    const md=PLAN.map(h=>`## ${h.h}\n\n${h.actions.map(a=>`### ${a.title}\n**Priorité:** ${a.pri} | **Responsable:** ${a.owner}\n\n${a.desc}\n\n**Métriques:** ${a.metrics.join(', ')}`).join('\n\n')}`).join('\n\n');
    const b=new Blob([`# Plan d'action mobilité SION-CET\nPrototype MobilityLab · ${fmtToday()}\n\n${md}`],{type:'text/markdown'});
    const u=URL.createObjectURL(b);const a=document.createElement('a');
    a.href=u;a.download='sion-cet-plan-action.md';a.click();URL.revokeObjectURL(u);
  };
  return(
    <div className="fade-up" style={{padding:'20px 24px',overflowY:'auto',height:'100%',maxWidth:1000}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Plan d'action mobilité</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>Feuille de route 0–36 mois · Ville de Sion · SION-CET MobilityLab</p>
        </div>
        <button onClick={doExport} style={{padding:'9px 14px',borderRadius:8,border:`1.5px solid ${C.border}`,background:C.white,color:C.inkM,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter'}}>
          ↓ Exporter .md
        </button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {PLAN.map(horizon=>(
          <div key={horizon.h} style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
            <div style={{padding:'12px 16px',background:horizon.bg,borderBottom:`1.5px solid ${horizon.b}`}}>
              <div className="syne" style={{fontSize:11,fontWeight:800,color:horizon.c,textTransform:'uppercase',letterSpacing:'.06em'}}>{horizon.h}</div>
              <div style={{fontSize:10,color:horizon.c,opacity:.7,marginTop:2}}>{horizon.actions.length} actions prioritaires</div>
            </div>
            <div style={{padding:10}}>
              {horizon.actions.map((a,i)=>{
                const pc=PRI_C[a.pri];const key=`${horizon.h}-${i}`;const isExp=!!exp[key];
                return(
                  <div key={key} style={{borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8,overflow:'hidden',cursor:'pointer'}} onClick={()=>setExp(e=>({...e,[key]:!e[key]}))}>
                    <div style={{padding:'10px 12px',background:isExp?C.borderL:C.white}}>
                      <Tag label={a.pri} color={pc.c} bg={pc.bg} border={pc.b}/>
                      <div style={{fontSize:12,fontWeight:700,color:C.ink,marginTop:6,lineHeight:1.35}}>{a.title}</div>
                      <div style={{fontSize:9,color:C.inkL,marginTop:3}}>👤 {a.owner}</div>
                    </div>
                    {isExp&&(
                      <div className="fade-up" style={{padding:'10px 12px',borderTop:`1px solid ${C.borderL}`}}>
                        <div style={{padding:'8px 10px',background:horizon.bg,borderRadius:7,border:`1px solid ${horizon.b}`,marginBottom:8}}>
                          <div className="syne" style={{fontSize:9,fontWeight:700,color:horizon.c,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>Pourquoi cette action ?</div>
                          <p style={{fontSize:10,color:C.ink,lineHeight:1.6,margin:0}}>{a.context}</p>
                        </div>
                        <div style={{padding:'8px 10px',background:C.white,borderRadius:7,border:`1px solid ${C.border}`,marginBottom:8}}>
                          <div className="syne" style={{fontSize:9,fontWeight:700,color:C.inkM,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>Description / Comment</div>
                          <p style={{fontSize:10.5,color:C.inkM,lineHeight:1.6,margin:0}}>{a.desc}</p>
                        </div>
                        <div style={{padding:'8px 10px',background:C.greenL,borderRadius:7,border:`1px solid ${C.greenB}`,marginBottom:8}}>
                          <div className="syne" style={{fontSize:9,fontWeight:700,color:C.green,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>Résultat attendu</div>
                          <p style={{fontSize:10,color:C.green,lineHeight:1.6,margin:0}}>{a.expectedResult}</p>
                        </div>
                        <div className="syne" style={{fontSize:9,fontWeight:700,color:C.inkL,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>Métriques de suivi</div>
                        {a.metrics.map((m,mi)=>(
                          <div key={mi} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <div style={{width:4,height:4,borderRadius:'50%',background:horizon.c}}/>
                            <span style={{fontSize:10,color:C.inkM}}>{m}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:18,background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'14px 18px'}}>
        <div className="syne" style={{fontSize:11,fontWeight:700,color:C.inkM,marginBottom:8}}>Conditions et prérequis</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:11,color:C.inkM,lineHeight:1.7}}>
          <div><strong>Ce plan est conditionnel à :</strong><br/>
            — Validation Conseil municipal<br/>— Concertation commerçants et riverains<br/>
            — Accord CarPostal pour renfort BS11<br/>— Budget IT signalétique dynamique</div>
          <div><strong>Données prioritaires à collecter :</strong><br/>
            — Comptages OD voitures (entrées centre)<br/>— Capteurs occupation P+R Potences & Échutes<br/>
            — Durée réelle stationnement par zone<br/>— Tarifs confirmés Cour de Gare CFF & HVS</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6 — DONNÉES (saisie manuelle)
// ═══════════════════════════════════════════════════════════════════════════════
function DonneesTab():JSX.Element {
  // Valeurs par défaut = constantes SIM + données officielles
  const [dailyCar,setDailyCar]=useState(11500);
  const [dailyTP,setDailyTP]=useState(7800);
  const [centrePlaces,setCentrePlaces]=useState(1205);
  const [prPlaces,setPrPlaces]=useState(910);
  const [avgStayH,setAvgStayH]=useState(2.5);
  const [turnover,setTurnover]=useState(4.5);
  const [co2PerTrip,setCo2PerTrip]=useState(1.52);
  const [prOcc,setPrOcc]=useState(30);
  const [centreOcc,setCentreOcc]=useState(79);
  const [saved,setSaved]=useState(false);
  const [notes,setNotes]=useState('');

  const handleSave=()=>{
    // Store to localStorage for persistence (not used by simulator yet — feature future)
    try{localStorage.setItem('sion-cet-donnees',JSON.stringify({dailyCar,dailyTP,centrePlaces,prPlaces,avgStayH,turnover,co2PerTrip,prOcc,centreOcc,notes}));}catch(e){void e;}
    setSaved(true);setTimeout(()=>setSaved(false),2200);
  };

  const numField=(label:string,unit:string,val:number,set:(v:number)=>void,min:number,max:number,source:string,confirmed:boolean)=>(
    <div style={{padding:'10px 12px',background:C.white,borderRadius:8,border:`1px solid ${confirmed?C.greenB:C.amberB}`,marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <div>
          <span style={{fontSize:12,fontWeight:600,color:C.ink}}>{label}</span>
          <span style={{fontSize:9,color:confirmed?C.green:C.amber,marginLeft:6}}>{confirmed?'✓ confirmé':'⚠ estimé'}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="number" min={min} max={max} value={val}
            onChange={e=>set(Math.max(min,Math.min(max,parseFloat(e.target.value)||min)))}
            style={{width:80,padding:'4px 8px',borderRadius:6,border:`1.5px solid ${C.border}`,fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:C.ink,textAlign:'right',background:C.borderL}}/>
          <span style={{fontSize:10,color:C.inkM,minWidth:30}}>{unit}</span>
        </div>
      </div>
      <div style={{fontSize:9,color:C.inkL,lineHeight:1.5}}>Source : {source}</div>
    </div>
  );

  return(
    <div className="fade-up" style={{padding:'20px 24px',overflowY:'auto',height:'100%',maxWidth:900}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Données & paramètres</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>Saisie manuelle · Calibration du simulateur SION-CET · Remplace les estimations par des données terrain</p>
        </div>
        <button onClick={handleSave}
          style={{padding:'9px 16px',borderRadius:8,border:'none',background:saved?C.green:C.red,color:'white',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Syne,sans-serif',transition:'all .2s'}}>
          {saved?'✓ Sauvegardé':'Sauvegarder'}
        </button>
      </div>
      <div style={{padding:'8px 12px',background:'#FFF8E1',borderRadius:8,border:`1px solid ${C.amberB}`,fontSize:10,color:C.amber,marginBottom:16,lineHeight:1.6}}>
        💡 Ces valeurs servent à calibrer les calculs du simulateur. Les données marquées <strong>⚠ estimées</strong> proviennent de sources indirectes — remplacez-les avec vos données terrain dès qu'elles sont disponibles. La sauvegarde est locale (votre navigateur).
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* Colonne gauche */}
        <div>
          <div className="syne" style={{fontSize:10,fontWeight:800,color:C.red,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Trafic & mobilité</div>
          {numField('Trafic voiture journalier','véh./j',dailyCar,setDailyCar,1000,50000,'ARE Microrecensement 2021 · corrigé Sion',false)}
          {numField('Fréquentation TP quotidienne','pax/j',dailyTP,setDailyTP,500,30000,'CarPostal 2025 + MVV Sion (estimé)',false)}
          {numField('Occ. actuelle P+R (%)','%',prOcc,setPrOcc,0,100,'Estimé — données terrain manquantes',false)}
          {numField('Occ. actuelle parkings centre (%)','%',centreOcc,setCentreOcc,0,100,'Estimé Planta/Scex 2024',false)}

          <div className="syne" style={{fontSize:10,fontWeight:800,color:C.green,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10,marginTop:14}}>Capacités</div>
          {numField('Places parkings centre (total)','pl.',centrePlaces,setCentrePlaces,100,5000,'sion.ch/stationnement · Planta 552 + Scex 449 + Cible 204',true)}
          {numField('Places P+R (total)','pl.',prPlaces,setPrPlaces,0,3000,'sion.ch · Potences 450 + Échutes II 400 + Échutes I 60',true)}
        </div>
        {/* Colonne droite */}
        <div>
          <div className="syne" style={{fontSize:10,fontWeight:800,color:C.blue,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Paramètres tarifaires & comportementaux</div>
          {numField('Durée moyenne stationnement centre','h',avgStayH,setAvgStayH,0.5,12,'Données Planta/Scex 2024 (estimé — à confirmer par capteurs)',false)}
          {numField('Rotation moyenne parkings centre','rot./pl./j',turnover,setTurnover,1,10,'Calculé : 11 500 véh./j ÷ 1 205 pl. ÷ jours · incl. franchise 1h',false)}
          {numField('CO₂ par trajet voiture évité','kg/trajet',co2PerTrip,setCo2PerTrip,0.5,5,'OFEV 2025 · mix véhicule CH 2025 · 14.3 km trajet moyen Sion',true)}

          <div className="syne" style={{fontSize:10,fontWeight:800,color:C.inkM,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10,marginTop:14}}>Notes terrain</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex: comptage P+R Potences 14.03.2026 = 87 voitures à 8h30&#10;Tarif Cour de Gare CFF confirmé = 2.50 CHF/h..."
            style={{width:'100%',height:130,padding:'10px 12px',borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:'Inter',fontSize:11,color:C.ink,resize:'vertical',lineHeight:1.6,boxSizing:'border-box',background:C.borderL}}/>
        </div>
      </div>
      <div style={{marginTop:16,padding:'12px 14px',background:C.white,borderRadius:10,border:`1px solid ${C.border}`}}>
        <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkM,marginBottom:8}}>Données prioritaires à obtenir</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,fontSize:10,color:C.inkM,lineHeight:1.7}}>
          <div style={{padding:'8px 10px',background:C.redL,borderRadius:7,border:`1px solid ${C.redB}`}}>
            <strong style={{color:C.red}}>Urgent (0–3 mois)</strong><br/>
            — Compteurs entrée/sortie Planta & Scex<br/>
            — Capteurs occupation P+R Potences<br/>
            — Enquête durée stationnement (5 j.)
          </div>
          <div style={{padding:'8px 10px',background:C.amberL,borderRadius:7,border:`1px solid ${C.amberB}`}}>
            <strong style={{color:C.amber}}>Important (3–12 mois)</strong><br/>
            — Tarif officiel Cour de Gare CFF<br/>
            — Tarif P+R Hôpital HVS confirmé<br/>
            — Taux occupation P+R Échutes I/II
          </div>
          <div style={{padding:'8px 10px',background:C.blueL,borderRadius:7,border:`1px solid ${C.blueB}`}}>
            <strong style={{color:C.blue}}>Utile (&gt;12 mois)</strong><br/>
            — Enquête OD complète (OFROU)<br/>
            — Données emplois zone Ronquoz<br/>
            — Microrecensement local 2026
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard():JSX.Element {
  useGlobalStyles();
  const [tab,setTab]=useState<TabId>(getTabFromHash);
  const [sev,setSev]=useState('fluide');
  const [simDone,setSimDone]=useState(false);

  // Sync with Layout top nav via hash changes
  useEffect(()=>{
    const onHash=()=>{const t=getTabFromHash();setTab(t);}
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);

  const [tomtomOk,setTomtomOk]=useState<boolean|null>(null);

  useEffect(()=>{
    const fallback=()=>{
      const h=new Date().getHours();
      if((h>=7&&h<=9)||(h>=17&&h<=19))setSev('dense');
      else if((h>=10&&h<=11)||(h>=14&&h<=16))setSev('modéré');
      else setSev('fluide');
    };
    // Try TomTom first; update every 5 min
    const refresh=async()=>{
      const {sev:s,ok}=await fetchTomTomSev();
      if(ok&&s){setSev(s);setTomtomOk(true);}
      else{fallback();setTomtomOk(false);}
    };
    refresh();
    const iv=setInterval(refresh,300_000);
    return()=>clearInterval(iv);
  },[]);

  useEffect(()=>{if(tab==='simulator')setSimDone(true);},[tab]);

  const TABS: Record<TabId,JSX.Element>={
    dashboard:<DashboardTab/>,
    simulator:<SimulatorTab/>,
    od:<ODTab/>,
    personas:<PersonasTab/>,
    actions:<ActionsTab/>,
    donnees:<DonneesTab/>,
  };

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:C.bg}}>
      <Sidebar tab={tab} setTab={setTab} sev={sev} simDone={simDone} tomtomOk={tomtomOk}/>
      <main style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column'}}>
        {TABS[tab]}
      </main>
    </div>
  );
}
