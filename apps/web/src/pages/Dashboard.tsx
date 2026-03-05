/**
 * Dashboard.tsx — SION-CET Simulator (Choix Évolutif de Transport)
 * Prototype d'outil d'aide à la décision — Projet pilote expérimental MobilityLab
 *
 * TypeScript strict · Zéro dépendance externe · Cloudflare Pages compatible
 * Sources: sion.ch PDFs 2024-2025, ARE Microrecensement 2021, Litman 2023, CarPostal 2025
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

// ─── CSS Injection ─────────────────────────────────────────────────────────────
function useGlobalStyles(): void {
  useEffect(() => {
    if (document.getElementById('sion-cet-styles')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    const s = document.createElement('style');
    s.id = 'sion-cet-styles';
    s.textContent = `
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Inter',sans-serif;background:#F2F1ED;}
      ::-webkit-scrollbar{width:4px;height:4px;}
      ::-webkit-scrollbar-track{background:transparent;}
      ::-webkit-scrollbar-thumb{background:#CCC9BF;border-radius:2px;}
      .syne{font-family:'Syne',sans-serif;}
      .mono{font-family:'JetBrains Mono',monospace;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
      @keyframes scaleIn{from{opacity:0;transform:scale(0.93);}to{opacity:1;transform:scale(1);}}
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
    `;
    document.head.appendChild(s);
  }, []);
}

// ─── Palette ───────────────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────────────
type TabId = 'dashboard'|'simulator'|'od'|'personas'|'actions';
type CapType = 'ok'|'moyen'|'captif';
type IncomeType = 'faible'|'moyen'|'élevé';
type DestType = 'centre'|'hopital'|'industrie'|'gare';
type ParkingType = 'centre'|'pr'|'pericentre'|'gare'|'hopital'|'industrie'|'horodateur';
type PriLevel = 'haute'|'moyenne'|'basse';

interface Parking {
  id:string; name:string; short:string; type:ParkingType;
  places:number; tarifBaseline:number;
  note:string; source:string; ok:boolean;
  adresse:string; coords:{x:number;y:number}; occ:number;
  secondaryEditable?:boolean;
}
interface SionEvent {
  date:Date; type:string; recurrent:boolean;
  name:string; lieu:string; impact:string;
  color:string; desc:string; tip:string;
}
interface SimParams {
  centrePrice:number; prPrice:number; progressif:boolean;
  tpDiscount:number; offreCombinee:boolean; covoiturage:boolean; tad:boolean;
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
interface ActionItem { title:string; pri:PriLevel; owner:string; desc:string; metrics:string[] }
interface PlanHorizon { h:string; c:string; bg:string; b:string; actions:ActionItem[] }
interface PersonaImpact {
  delta:number; beforeCHF?:string; afterCHF?:string;
  equityFlag:boolean; switch:boolean; concerned:boolean; note:string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n:number) => Math.abs(n).toLocaleString('fr-CH');
const fmtDate = (d:Date) => d.toLocaleDateString('fr-CH',{weekday:'short',day:'numeric',month:'short'});
const fmtNow  = () => new Date().toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'});
const fmtToday= () => new Date().toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const daysUntil=(d:Date)=>Math.max(0,Math.round((d.getTime()-Date.now())/86400000));
const rangeBg=(val:number,min:number,max:number,color:string)=>{
  const pct=((val-min)/(max-min))*100;
  return `linear-gradient(to right,${color} ${pct}%,#E5E3DC ${pct}%)`;
};

// ─── Data: Parkings ────────────────────────────────────────────────────────────
const ALL_PARKINGS:Parking[] = [
  // CENTRE — levier direct (données officielles sion.ch)
  {id:'planta',name:'Parking de la Planta',short:'Planta',type:'centre',places:562,
   tarifBaseline:3.0,note:'1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30',
   source:'sion.ch PDF 15.07.2024',ok:true,adresse:'Place de la Planta, Sion',coords:{x:282,y:162},occ:78},
  {id:'scex',name:'Parking du Scex',short:'Scex',type:'centre',places:658,
   tarifBaseline:3.0,note:'1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30',
   source:'sion.ch PDF 11.08.2025',ok:true,adresse:'Rue du Scex, Sion',coords:{x:256,y:177},occ:82},
  {id:'cible',name:'Parking de la Cible',short:'Cible',type:'centre',places:204,
   tarifBaseline:3.0,note:'Conditions présumées identiques Planta/Scex — à confirmer',
   source:'sion.ch (présumé)',ok:false,adresse:'Rue de la Porte-Neuve, Sion',coords:{x:320,y:156},occ:71},
  // P+R
  {id:'pr-potences',name:'P+R Les Potences',short:'P+R Potences',type:'pr',places:450,
   tarifBaseline:0,note:'Gratuit · Bus BS11 → Centre 10 min',
   source:'sion.ch / CarPostal 2025',ok:true,adresse:'Route des Potences, Sion-Ouest',coords:{x:86,y:214},occ:34},
  {id:'pr-stade',name:'P+R Stade Tourbillon',short:'P+R Stade',type:'pr',places:460,
   tarifBaseline:0,note:'Gratuit · Bus BS11 → Centre 10 min',
   source:'sion.ch / CarPostal 2025',ok:true,adresse:'Route des Agettes, Sion',coords:{x:394,y:186},occ:28},
  // PÉRICENTRE — estimés, secondaryEditable
  {id:'nord',name:'Parking Nord',short:'Nord',type:'pericentre',places:282,
   tarifBaseline:1.5,note:'Tarif préférentiel résidents — estimé',secondaryEditable:true,
   source:'sion.ch (estimé)',ok:false,adresse:'Secteur nord, Sion',coords:{x:268,y:133},occ:54},
  {id:'roches-brunes',name:'Roches-Brunes',short:'Roches-Brunes',type:'pericentre',places:370,
   tarifBaseline:1.5,note:'Tarif préférentiel — à confirmer',secondaryEditable:true,
   source:'scan-park.ch / sion.ch (estimé)',ok:false,adresse:'Av. de Tourbillon, Sion',coords:{x:360,y:170},occ:47},
  {id:'st-guerin',name:'Parking St-Guérin',short:'St-Guérin',type:'pericentre',places:66,
   tarifBaseline:1.5,note:'Petit parking résidentiel — estimé',
   source:'sion.ch (estimé)',ok:false,adresse:'Rue de St-Guérin, Sion',coords:{x:308,y:133},occ:40},
  // GARE
  {id:'gare-cff',name:'Parking Gare CFF',short:'Gare CFF',type:'gare',places:300,
   tarifBaseline:2.0,note:'Géré CFF · très forte occ. pendulaire · tarif estimé',secondaryEditable:true,
   source:'CFF (estimé)',ok:false,adresse:'Avenue de la Gare, Sion',coords:{x:148,y:226},occ:91},
  // HÔPITAL / SUVA
  {id:'hopital',name:'Parking Hôpital du Valais',short:'Hôpital HVS',type:'hopital',places:400,
   tarifBaseline:2.0,note:'Zone Champsec · patients / visiteurs HVS · hors centre',secondaryEditable:true,
   source:'HVS (estimé)',ok:false,adresse:'Av. du Grand-Champsec 80, Sion',coords:{x:400,y:148},occ:65},
  {id:'suva',name:'Parking SUVA / Admin. cantonale',short:'SUVA',type:'hopital',places:180,
   tarifBaseline:0,note:'Employés / visiteurs SUVA · hors centre',
   source:'Estimé',ok:false,adresse:'Ch. de la Sinièse, Sion',coords:{x:170,y:198},occ:80},
  // INDUSTRIE
  {id:'ronquoz',name:'Zone Ind. Ronquoz / Aéroport',short:'Ronquoz',type:'industrie',places:4000,
   tarifBaseline:0,note:'Parkings privés employeurs (~40 entreprises) · GRATUIT · données lacunaires',
   source:'Estimé',ok:false,adresse:'Zone industrielle Ronquoz, Sion',coords:{x:80,y:246},occ:70},
  // SURFACE
  {id:'zone-bleue',name:'Zone bleue (disque 1h30)',short:'Zone bleue',type:'horodateur',places:320,
   tarifBaseline:0,note:'Disque obligatoire · Max 1h30 · Gratuit · source sion.ch mars 2025',
   source:'sion.ch 03.2025',ok:true,adresse:'Centre-ville, rues diverses',coords:{x:295,y:182},occ:88},
  {id:'horod-courte',name:'Horodateurs courte durée',short:'Horod. court',type:'horodateur',places:180,
   tarifBaseline:1.0,note:'Max 2h · Rotation rapide',
   source:'sion.ch 03.2025',ok:true,adresse:'Centre-ville, Sion',coords:{x:265,y:195},occ:82},
];

const TYPE_COLOR:Record<ParkingType,string>={
  centre:C.red,pr:C.green,pericentre:C.amber,
  gare:C.blue,hopital:C.purple,industrie:C.inkL,horodateur:C.inkM
};

// ─── Data: Événements ──────────────────────────────────────────────────────────
function getSionEvents():SionEvent[] {
  const now = new Date();
  const y = now.getFullYear();
  const evs:SionEvent[] = [];

  // Marché Vieille Ville — chaque vendredi (mvvsion.ch, actif depuis 2003)
  for(let w=0;w<10;w++){
    const d=new Date(now);
    d.setDate(d.getDate()+(5-d.getDay()+7)%7+w*7);
    d.setHours(8,0,0,0);
    if(d>=now) evs.push({date:d,type:'marche',recurrent:true,impact:'moyenne',color:C.amber,
      name:'Marché de la Vieille Ville',lieu:'Grand-Pont, Rue de Lausanne, Remparts',
      desc:'Marché hebdomadaire terroir & artisanat · 8h–14h (source: mvvsion.ch)',
      tip:'Rue de Lausanne occupée · P Planta/Scex recommandés · BS11 ou vélo'});
  }
  // Grand Marché de Pâques — Vendredi Saint = 3 avril 2026
  const paques=new Date(y,3,3);
  if(paques>=now) evs.push({date:paques,type:'marche_special',recurrent:true,impact:'haute',color:C.red,
    name:'Grand Marché de Pâques (Vieille Ville)',lieu:'Vieille Ville étendue, Sion',
    desc:'Édition spéciale · toutes les rues · toute la journée · forte affluence (siontourisme.ch)',
    tip:'Centre très difficile · P+R Potences/Stade obligatoires · Renfort BS11 indispensable'});

  // Caves Ouvertes Valais 20e éd. 14-16 mai 2026 (valais.ch/events 2026)
  [[y,4,14],[y,4,15],[y,4,16]].forEach(([yr,mo,da])=>{
    const d=new Date(yr,mo,da);
    if(d>=now) evs.push({date:d,type:'vin',recurrent:true,impact:'haute',color:C.red,
      name:`Caves Ouvertes Valais 20e éd. – J${da-13}`,lieu:'Domaines viticoles Sion & région',
      desc:'Portes ouvertes vignerons · fort afflux touristes (valais.ch/events 14–16.05.2026)',
      tip:'Signalétique renforcée · P+R Stade proche Bramois · shuttle envisageable'});
  });

  // FC Sion matchs domicile (Stade Tourbillon, cap. 14 283)
  [new Date(y,2,14),new Date(y,3,4),new Date(y,3,18),new Date(y,4,2),new Date(y,4,16)].forEach(d=>{
    if(d>=now) evs.push({date:d,type:'sport',recurrent:true,impact:'haute',color:C.red,
      name:'FC Sion – Match à domicile (Super League)',lieu:'Stade de Tourbillon, Sion',
      desc:'Super League · 14 283 places · P+R Stade saturé avant/après',
      tip:'P+R Stade bloqué 2h avant/après · activer P+R Potences en débordement'});
  });

  // HC Sion — Patinoire des Arolles
  [new Date(y,2,21),new Date(y,3,1),new Date(y,3,15)].forEach(d=>{
    if(d>=now) evs.push({date:d,type:'sport',recurrent:true,impact:'moyenne',color:C.blue,
      name:'HC Sion – Match hockey (Arolles)',lieu:'Patinoire des Arolles, Sion',
      desc:'Soirée · parking Arolles limité · fin ~22h30',
      tip:'P Roches-Brunes en débordement · fin tardive → prévoir retard TP'});
  });

  // Carnaval sédunois — 7 mars 2026
  const carnaval=new Date(y,2,7);
  if(carnaval>=now) evs.push({date:carnaval,type:'fete',recurrent:true,impact:'haute',color:C.purple,
    name:'Carnaval sédunois',lieu:'Vieille Ville, Grand-Pont, Sion',
    desc:'Défilé · centre fermé à la circulation',
    tip:'Centre interdit voitures · P+R Potences/Stade obligatoires · Renfort BS11'});

  // Braderie Vieille Ville — 25 avril 2026
  const braderie=new Date(y,3,25);
  if(braderie>=now) evs.push({date:braderie,type:'braderie',recurrent:true,impact:'moyenne',color:C.amber,
    name:'Braderie de la Vieille Ville',lieu:'Rue de Conthey, Grand-Pont, Sion',
    desc:'Vide-greniers · piétonnisation partielle centre',
    tip:'Grand-Pont partiellement fermé · P Planta recommandé'});

  const seen=new Set<string>();
  return evs
    .filter(e=>{const k=`${e.date.toDateString()}-${e.name}`;if(seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b)=>a.date.getTime()-b.date.getTime())
    .slice(0,12);
}

// ─── Simulation Engine ─────────────────────────────────────────────────────────
const SIM={dailyCar:11500,dailyTP:7800,centrePlaces:1424,prPlaces:910,
  avgStayH:2.5,freeH:1.0,turnover:4.5,co2PerTrip:1.52,elasticity:-0.30,basePrice:3.0} as const;

function simulate(p:SimParams):SimResult {
  const delta=p.centrePrice-SIM.basePrice;
  const raw=(delta/SIM.basePrice)*SIM.elasticity;
  const clamped=Math.max(-0.38,Math.min(0.46,raw));
  const tpE=p.tpDiscount>0?(p.tpDiscount/100)*0.08:0;
  const prE=p.prPrice===0&&delta>0?Math.abs(clamped)*0.20:0;
  const combE=p.offreCombinee&&p.prPrice===0?0.028:0;
  const progE=p.progressif&&p.centrePrice>=SIM.basePrice?0.022:0;
  const covE=p.covoiturage?0.015:0;
  const tadE=p.tad?0.008:0;
  // Fuite si parkings secondaires moins chers
  const leak=Math.max(0,
    (SIM.basePrice-p.gareCFFPrice)*0.01+
    (1.5-p.nordPrice)*0.008+
    (1.5-p.rochesBrunesPrice)*0.006
  );
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

// ─── Static Data ───────────────────────────────────────────────────────────────
const PERSONAS:PersonaData[]=[
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
   desc:'Hôpital du Valais — zone Champsec — hors centre',avgStayH:2,
   note:'Se gare au P Hôpital (400 pl., ~CHF 2/h) en zone Champsec — NON concerné par tarif centre'},
  {id:'p09',emoji:'🧑‍⚕️',label:'Professionnel santé (HVS/SUVA)',income:'élevé',carDep:.70,tpAff:.40,sens:.25,
   dest:'hopital',rigidity:.88,tags:['Champsec','astreintes','hors centre'],
   desc:'Médecin/infirmier HVS ou SUVA — travaille EN DEHORS du centre',avgStayH:8,
   note:'Zone Av. Grand-Champsec 80 · accès BS7/BS14 · NON concerné par tarif parkings centre'},
  {id:'p06',emoji:'🎒',label:'Étudiant HES-SO',income:'faible',carDep:.30,tpAff:.75,sens:.90,
   dest:'centre',rigidity:.40,tags:['TP','vélo','budget serré'],desc:'Campus HES-SO Sion, budget limité',avgStayH:6},
  {id:'p07',emoji:'👩‍💼',label:'Fonctionnaire cantonal',income:'élevé',carDep:.55,tpAff:.50,sens:.35,
   dest:'centre',rigidity:.70,tags:['abonnement TP','horaires réguliers'],desc:'Administration cantonale, centre-ville',avgStayH:8},
  {id:'p08',emoji:'🏗️',label:'Ouvrier zone industrielle',income:'faible',carDep:.90,tpAff:.15,sens:.85,
   dest:'industrie',rigidity:.95,tags:['captif voiture','équité ⚠️','Ronquoz'],
   desc:'Zone industrielle Ronquoz — hors centre',avgStayH:8,
   note:'Parking privé gratuit employeur Ronquoz — NON concerné par tarif centre'},
  {id:'p10',emoji:'🏠',label:'Parent école / crèche',income:'moyen',carDep:.80,tpAff:.25,sens:.60,
   dest:'centre',rigidity:.85,tags:['contrainte horaire','équité'],desc:'Dépose enfants + courses rapides',avgStayH:1},
  {id:'p11',emoji:'🚲',label:'Cycliste urbain',income:'moyen',carDep:.05,tpAff:.60,sens:.20,
   dest:'centre',rigidity:.30,tags:['vert','non concerné'],desc:'Vélo principal — indépendant du tarif',avgStayH:0},
  {id:'p12',emoji:'🏔️',label:'Touriste / visiteur externe',income:'élevé',carDep:.65,tpAff:.45,sens:.40,
   dest:'centre',rigidity:.50,tags:['ponctuel','découverte'],desc:'Hôtels Sion, patrimoine historique',avgStayH:3},
];

const ZONES_OD:ZoneOD[]=[
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

const CAP_C:Record<CapType,{c:string;b:string;bg:string;l:string}>={
  ok:{c:C.green,b:C.greenB,bg:C.greenL,l:'TP compétitif'},
  moyen:{c:C.amber,b:C.amberB,bg:C.amberL,l:'TP partiel'},
  captif:{c:C.red,b:C.redB,bg:C.redL,l:'Captif voiture'},
};
const PRI_C:Record<PriLevel,{c:string;bg:string;b:string}>={
  haute:{c:C.red,bg:C.redL,b:C.redB},
  moyenne:{c:C.amber,bg:C.amberL,b:C.amberB},
  basse:{c:C.green,bg:C.greenL,b:C.greenB},
};

const PLAN:PlanHorizon[]=[
  {h:'0–3 mois',c:C.red,bg:C.redL,b:C.redB,actions:[
    {title:'Pilote offre combinée P+R + billet TP',pri:'haute',owner:'Service mobilité + CarPostal',
     desc:'P+R Stade/Potences gratuit + billet 24h CarPostal CHF 3.–. Mesurer captation de demande modale.',
     metrics:['Occ. P+R J+30','Fréquentation BS11 pointe','Nb offres combinées vendues']},
    {title:'Signalétique dynamique occupation',pri:'haute',owner:'IT Ville + Service voirie',
     desc:'Affichage temps réel places disponibles (Planta/Scex/Cible) sur 5 panneaux Route Cantonale + app sion.ch.',
     metrics:['Temps moyen recherche parking','Taux satisfaction usagers']},
    {title:'Communication proactive sur les gratuités',pri:'moyenne',owner:'Service communication',
     desc:'Campagne: 1h gratuite, gratuité ven.soir/dim./midi, P+R permanents gratuits. Ciblée commerçants + résidents.',
     metrics:['Utilisation P+R avant/après','Réactions commerçants']},
  ]},
  {h:'3–12 mois',c:C.amber,bg:C.amberL,b:C.amberB,actions:[
    {title:'Renfort fréquence BS11 aux heures de pointe',pri:'haute',owner:'Service mobilité + CarPostal',
     desc:'Passage BS11 à 7 min (7h–9h / 17h–19h). Condition indispensable à l\'efficacité des P+R.',
     metrics:['Temps attente P+R','Montées BS11 pointe','Nb voyageurs P+R']},
    {title:'Tarification progressive longue durée (>3h)',pri:'moyenne',owner:'Service mobilité',
     desc:'Grille: CHF 3/h (h2–h3), CHF 4/h (h3+). Dissuade les pendulaires tout-journée au centre.',
     metrics:['Durée stationnement moyenne','Recettes','Occ. <11h vs >11h']},
    {title:'OpenData occupation parkings (API)',pri:'moyenne',owner:'IT Ville',
     desc:'API temps réel → intégration Google Maps, SBB app. Standard OGD-CH. Alimenter via capteurs.',
     metrics:['Nb intégrations tierces','Requêtes API/jour']},
  ]},
  {h:'12–36 mois',c:C.blue,bg:C.blueL,b:C.blueB,actions:[
    {title:'Plan mobilité employeurs zone industrielle',pri:'haute',owner:'Service éco. + mobilité',
     desc:'Partenariat top 10 employeurs Ronquoz/Aéroport (>4 000 emplois): covoiturage, abo TP subventionnés, pistes cyclables.',
     metrics:['Part modale voiture zone ind.','Abo TP vendus','Km piste vélo']},
    {title:'Renfort BS7/BS14 → Hôpital du Valais',pri:'haute',owner:'Service mobilité + HVS',
     desc:'Améliorer liaison Gare–HVS (Champsec). Fréquence insuffisante aux heures de visites et relèves.',
     metrics:['Temps Gare→Hôpital','Fréquentation lignes hôpital','NPS patients']},
    {title:'Révision Plan directeur stationnement (PDS)',pri:'haute',owner:'Service urbanisme + mobilité',
     desc:'Actualiser PDS avec objectifs 2030: −15% voitures centre, +20% TP, piétonisation partielle Grand-Pont.',
     metrics:['Part modale voiture','m² espace récupéré','Recettes parking/an']},
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
      <div>
        <div style={{fontSize:12,color:C.ink,fontWeight:500}}>{label}</div>
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
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(parseFloat(e.target.value))}
        style={{width:'100%',background:rangeBg(value,min,max,color),accentColor:color}}/>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:8.5,color:C.inkL,marginTop:2}}>
        <span>{min===0?'GRATUIT':`CHF ${min}`}</span>
        <span style={{color:C.inkM}}>← CHF {baseline.toFixed(1)} baseline</span>
        <span>CHF {max}</span>
      </div>
    </div>
  );
}

// ─── SVG Map ───────────────────────────────────────────────────────────────────
interface MapProps{simResults:SimResult|null;hoveredId:string|null;setHoveredId:(id:string|null)=>void}
function SionMap({simResults,hoveredId,setHoveredId}:MapProps):JSX.Element {
  const getOcc=(p:Parking)=>{
    if(!simResults)return p.occ;
    if(p.type==='centre')return simResults.centreOcc;
    if(p.type==='pr')return Math.min(96,p.occ+Math.round(simResults.prUsage/SIM.prPlaces*40));
    return p.occ;
  };
  return(
    <svg viewBox="0 0 500 290" style={{width:'100%',height:'100%',background:'#EDE9E0'}}>
      <defs>
        <pattern id="mg" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#D9D5CB" strokeWidth=".5"/>
        </pattern>
        <filter id="ms"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodOpacity=".18"/></filter>
      </defs>
      <rect width="500" height="290" fill="url(#mg)"/>
      {/* Rhône */}
      <path d="M 0 268 Q 90 258 170 263 Q 250 268 330 260 Q 410 253 500 258" fill="none" stroke="#6BADD6" strokeWidth="14" opacity=".55"/>
      <path d="M 0 268 Q 90 258 170 263 Q 250 268 330 260 Q 410 253 500 258" fill="none" stroke="#8DCAE8" strokeWidth="8" opacity=".35"/>
      <text x="45" y="273" fontSize="8" fill="#4A8FB5" opacity=".6" fontFamily="Inter">Rhône</text>
      {/* Routes */}
      <path d="M 0 244 L 500 234" fill="none" stroke="#B8B2A6" strokeWidth="4.5" opacity=".6"/>
      <text x="420" y="231" fontSize="7.5" fill="#8C8678" opacity=".7" fontFamily="Inter">Rte Cantonale</text>
      <path d="M 148 226 L 200 210 L 270 192 L 320 174 L 360 170 L 394 186" fill="none" stroke="#B0AAA0" strokeWidth="3" opacity=".55"/>
      <path d="M 270 192 L 270 135" fill="none" stroke="#B0AAA0" strokeWidth="2.5" opacity=".5"/>
      <path d="M 148 226 L 88 214" fill="none" stroke="#B0AAA0" strokeWidth="2.5" opacity=".5"/>
      <path d="M 394 186 L 400 148" fill="none" stroke="#B0AAA0" strokeWidth="2" opacity=".45"/>
      {/* POI */}
      <ellipse cx="342" cy="128" rx="44" ry="28" fill="#D0C9B8" opacity=".5"/>
      <text x="342" y="127" fontSize="8" fill="#7A7260" textAnchor="middle" opacity=".65" fontFamily="Inter">Vieux-Sion</text>
      <text x="342" y="137" fontSize="7" fill="#7A7260" textAnchor="middle" opacity=".5" fontFamily="Inter">↑ Basilique Valère</text>
      <rect x="35" y="237" width="88" height="18" fill="#BEB9AE" opacity=".3" rx="3"/>
      <text x="79" y="249" fontSize="7" fill="#7A7260" textAnchor="middle" opacity=".65" fontFamily="Inter">Zone ind. Ronquoz</text>
      <rect x="378" y="134" width="52" height="22" fill="#DDD8FA" opacity=".35" rx="3"/>
      <text x="404" y="147" fontSize="7" fill="#5A3A9A" textAnchor="middle" opacity=".7" fontFamily="Inter">HVS / SUVA</text>
      {/* Bus P+R */}
      <path d="M 88 214 L 148 226" fill="none" stroke={C.green} strokeWidth="1.8" strokeDasharray="4,3" opacity=".55"/>
      <path d="M 394 186 L 320 174" fill="none" stroke={C.green} strokeWidth="1.8" strokeDasharray="4,3" opacity=".55"/>
      <text x="106" y="218" fontSize="7" fill={C.green} opacity=".7" fontFamily="Inter">BS11</text>
      <text x="348" y="179" fontSize="7" fill={C.green} opacity=".7" fontFamily="Inter">BS11</text>
      <text x="148" y="243" fontSize="7.5" fill="#444" textAnchor="middle" opacity=".8" fontFamily="Inter">🚉 Gare CFF</text>
      {/* Parkings */}
      {ALL_PARKINGS.map(p=>{
        const isH=hoveredId===p.id;
        const occ=getOcc(p);
        const col=TYPE_COLOR[p.type]??C.inkM;
        const r=p.type==='industrie'?5:p.type==='centre'?9:p.type==='pr'?8:7;
        const circ=2*Math.PI*(r+2.5);
        return(
          <g key={p.id} style={{cursor:'pointer'}} onClick={()=>setHoveredId(isH?null:p.id)}>
            {isH&&<circle cx={p.coords.x} cy={p.coords.y} r={r+8} fill={col} opacity=".12"/>}
            <circle cx={p.coords.x} cy={p.coords.y} r={r} fill={col} filter="url(#ms)" opacity={isH?1:.82}/>
            <text x={p.coords.x} y={p.coords.y+3.5} textAnchor="middle" fontSize={p.type==='pr'?'6':'7'} fill="white" fontWeight="700" fontFamily="JetBrains Mono">
              {p.type==='pr'?'P+R':p.type==='industrie'?'ZI':'P'}
            </text>
            <circle cx={p.coords.x} cy={p.coords.y} r={r+2.5} fill="none" stroke={col} strokeWidth="2.5"
              strokeDasharray={`${occ/100*circ} ${circ}`} opacity=".4" strokeLinecap="round"
              transform={`rotate(-90 ${p.coords.x} ${p.coords.y})`}/>
            {isH&&(
              <g>
                <rect x={p.coords.x-65} y={p.coords.y-68} width="130" height={p.note?64:48} rx="7" fill="white" filter="url(#ms)"/>
                <text x={p.coords.x} y={p.coords.y-53} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.ink} fontFamily="Inter">{p.short}</text>
                <text x={p.coords.x} y={p.coords.y-40} textAnchor="middle" fontSize="8.5" fill={C.inkM} fontFamily="Inter">
                  {p.places.toLocaleString('fr-CH')} pl. · {p.tarifBaseline===0?'GRATUIT':`CHF ${p.tarifBaseline.toFixed(1)}/h`}
                </text>
                <text x={p.coords.x} y={p.coords.y-27} textAnchor="middle" fontSize="9" fill={col} fontWeight="700" fontFamily="JetBrains Mono">
                  Occ. {occ}%{!p.ok?' · ⚠ estimé':''}
                </text>
                {p.note&&<text x={p.coords.x} y={p.coords.y-14} textAnchor="middle" fontSize="7.5" fill={C.inkL} fontFamily="Inter">{p.note.slice(0,36)}</text>}
              </g>
            )}
          </g>
        );
      })}
      {/* Légende */}
      <g transform="translate(7,7)">
        <rect width="155" height="88" rx="7" fill="white" opacity=".92"/>
        {([[C.red,'Centre (levier direct)'],[C.green,'P+R gratuits (BS11)'],[C.amber,'Péricentre (estimé)'],
           [C.blue,'Gare CFF (estimé)'],[C.purple,'Hôpital / SUVA'],[C.inkL,'Zone industrielle']] as [string,string][]).map(([c,l],i)=>(
          <g key={i} transform={`translate(8,${9+i*13})`}>
            <circle cx="5" cy="4" r="4" fill={c} opacity=".82"/>
            <text x="14" y="8" fontSize="8" fill={C.inkM} fontFamily="Inter">{l}</text>
          </g>
        ))}
      </g>
      {simResults&&(
        <g transform="translate(345,7)">
          <rect width="148" height={simResults.isNegative?43:36} rx="7" fill={simResults.isNegative?C.red:C.green} opacity=".9"/>
          <text x="74" y="15" textAnchor="middle" fontSize="8" fill="white" fontFamily="Inter" opacity=".85">Scénario simulé</text>
          <text x="74" y="28" textAnchor="middle" fontSize="12" fill="white" fontWeight="700" fontFamily="JetBrains Mono">
            {simResults.isNegative?'-':''}{(Math.abs(simResults.totalShift)*100).toFixed(1)}% report
          </text>
          {simResults.isNegative&&<text x="74" y="39" textAnchor="middle" fontSize="8" fill="white" fontFamily="Inter">⚠ Effet négatif</text>}
        </g>
      )}
    </svg>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
const NAV:{id:TabId;label:string;icon:string}[]=[
  {id:'dashboard',label:'Tableau de bord',icon:'◈'},
  {id:'simulator',label:'Simulateur',icon:'⊙'},
  {id:'od',label:'Analyse OD',icon:'↗'},
  {id:'personas',label:'Personas & équité',icon:'◑'},
  {id:'actions',label:"Plan d'action",icon:'▷'},
];
const SEV_COLORS:Record<string,string>={fluide:'#22C55E',modéré:'#F59E0B',dense:'#EA580C',bloqué:'#EF4444'};

function Sidebar({tab,setTab,sev,simDone}:{tab:TabId;setTab:(t:TabId)=>void;sev:string;simDone:boolean}):JSX.Element {
  const [time,setTime]=useState(fmtNow());
  useEffect(()=>{const i=setInterval(()=>setTime(fmtNow()),30000);return()=>clearInterval(i);},[]);
  const sc=SEV_COLORS[sev]??'#22C55E';
  return(
    <div style={{width:222,background:C.sidebar,display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
      <div style={{padding:'16px 16px 12px',borderBottom:`1px solid ${C.sidebarBorder}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:C.red,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span className="syne" style={{color:'white',fontSize:11,fontWeight:800,lineHeight:1,textAlign:'center'}}>VS</span>
          </div>
          <div>
            <div className="syne" style={{fontSize:14,fontWeight:800,color:'white',lineHeight:1.15}}>SION-CET</div>
            <div style={{fontSize:9,color:'#4A5070',marginTop:2,lineHeight:1.3}}>Choix Évolutif de Transport</div>
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
            <button key={n.id} onClick={()=>setTab(n.id)}
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
            <div style={{fontSize:10,fontWeight:600,color:sc}}>Trafic {sev}</div>
            <div style={{fontSize:9,color:'#30344A'}}>Route Cantonale · Estimé</div>
          </div>
        </div>
        <div className="mono" style={{fontSize:8.5,color:'#30344A',lineHeight:1.6}}>{fmtToday()}<br/>Heure: {time}</div>
        <div style={{marginTop:7,fontSize:8,color:'#252838'}}>v2.1 · MobilityLab prototype<br/>sion.ch 2024-2025 · ARE 2021</div>
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
    h,
    c:h<6?18:h<8?38:h<10?76:h<12?84:h<14?70:h<16?77:h<18?90:h<20?60:h<22?32:20,
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
          {value:'79%',label:'Occupation parking centre',sub:'Planta + Scex + Cible (1 424 pl.)',color:C.amber,icon:'🅿'},
          {value:'56%',label:'Part modale voiture solo',sub:'Sion (ARE Microrecensement 2021)',color:C.red,icon:'📊'},
          {value:'26.4 t',label:'CO₂ voitures/jour',sub:'~11 500 trajs × 1.52 kg (mix 2025)',color:C.green,icon:'🌿'},
        ].map((k,i)=><KpiTile key={i} {...k} animKey={`d-${i}`}/>)}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:14,marginBottom:14}}>
        {/* Chart occupation */}
        <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'16px 18px'}}>
          <div className="syne" style={{fontSize:13,fontWeight:700,color:C.ink,marginBottom:12}}>Occupation parkings — profil journalier estimé</div>
          <svg width="100%" height={chartH+22} viewBox={`0 0 ${hourly.length*cw} ${chartH+22}`} preserveAspectRatio="none" style={{overflow:'visible'}}>
            {/* Centre area */}
            <path d={`M 0 ${chartH} `+hourly.map((d,i)=>`L ${i*cw+cw/2} ${chartH-(d.c/maxV)*chartH}`).join(' ')+` L ${hourly.length*cw} ${chartH}`} fill={C.red+'28'} stroke={C.red} strokeWidth="1.5"/>
            {/* P+R area */}
            <path d={`M 0 ${chartH} `+hourly.map((d,i)=>`L ${i*cw+cw/2} ${chartH-(d.pr/maxV)*chartH}`).join(' ')+` L ${hourly.length*cw} ${chartH}`} fill={C.green+'28'} stroke={C.green} strokeWidth="1.5"/>
            {hourly.filter((_,i)=>i%4===0).map(d=>(
              <text key={d.h} x={d.h*cw+cw/2} y={chartH+14} textAnchor="middle" fontSize="8" fill={C.inkL} fontFamily="Inter">{d.h}h</text>
            ))}
          </svg>
          <div style={{display:'flex',gap:14,marginTop:4}}>
            {([[C.red,'Parkings centre'],[C.green,'P+R périphérie']] as [string,string][]).map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{width:10,height:3,background:c,borderRadius:2}}/>
                <span style={{fontSize:9,color:C.inkL}}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:6,fontSize:9,color:C.inkL}}>⚠ Profil estimé — calibration capteurs recommandée</div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {/* Part modale */}
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
          {/* Capacités */}
          <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'12px 14px',flex:1}}>
            <div className="syne" style={{fontSize:11,fontWeight:700,color:C.ink,marginBottom:8}}>Capacité stationnement</div>
            {([{l:'Centre (Planta+Scex+Cible)',n:1424,occ:79,c:C.red},{l:'P+R (Potences+Stade)',n:910,occ:32,c:C.green},{l:'Gare CFF',n:300,occ:91,c:C.blue},{l:'Hôpital du Valais (HVS)',n:400,occ:65,c:C.purple},{l:'Péricentre estimé',n:718,occ:50,c:C.amber}] as {l:string;n:number;occ:number;c:string}[]).map(p=>(
              <div key={p.l} style={{marginBottom:7}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{fontSize:9,color:C.inkM}}>{p.l}</span>
                  <span className="mono" style={{fontSize:9,color:C.inkL}}>{p.n.toLocaleString('fr-CH')} pl.</span>
                </div>
                <OccBar pct={p.occ} color={p.c}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Événements */}
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
                  {e.recurrent&&<Tag label="Récurrent" color={C.inkM} bg={C.borderL} border={C.border}/>}
                </div>
                <div style={{fontSize:8.5,color:C.inkM,lineHeight:1.45,borderTop:`1px solid ${C.borderL}`,paddingTop:5}}>💡 {e.tip}</div>
              </div>
            );
          })}
        </div>
        <div style={{marginTop:10,fontSize:9,color:C.inkL,lineHeight:1.6}}>
          Sources: mvvsion.ch (marché ven. depuis 2003) · siontourisme.ch · valais.ch/events (Caves Ouvertes 14–16 mai 2026) · FC Sion / HC Sion — dates matchs indicatives
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
  const [covoiturage,setCovoiturage]=useState(false);
  const [tad,setTad]=useState(false);
  const [gareCFFPrice,setGareCFFPrice]=useState(2.0);
  const [nordPrice,setNordPrice]=useState(1.5);
  const [rochesBrunesPrice,setRochesBrunesPrice]=useState(1.5);
  const [hopitalPrice,setHopitalPrice]=useState(2.0);
  const [showSecondary,setShowSecondary]=useState(false);
  const [simResults,setSimResults]=useState<SimResult|null>(null);
  const [compareMode,setCompareMode]=useState(false);
  const [hoveredId,setHoveredId]=useState<string|null>(null);
  const [isRunning,setIsRunning]=useState(false);
  const [simKey,setSimKey]=useState(0);

  const params:SimParams={centrePrice,prPrice,progressif,tpDiscount,offreCombinee,covoiturage,tad,gareCFFPrice,nordPrice,rochesBrunesPrice,hopitalPrice};
  const baseParams:SimParams={centrePrice:3.0,prPrice:0,progressif:false,tpDiscount:0,offreCombinee:false,covoiturage:false,tad:false,gareCFFPrice:2.0,nordPrice:1.5,rochesBrunesPrice:1.5,hopitalPrice:2.0};
  const baseR=simulate(baseParams);

  const hasChanged=centrePrice!==3.0||prPrice!==0||progressif||tpDiscount>0||offreCombinee||covoiturage||tad||gareCFFPrice!==2.0||nordPrice!==1.5||rochesBrunesPrice!==1.5||hopitalPrice!==2.0;

  const runSim=useCallback(()=>{
    setIsRunning(true);
    setTimeout(()=>{setSimResults(simulate(params));setSimKey(k=>k+1);setIsRunning(false);},550);
  },[centrePrice,prPrice,progressif,tpDiscount,offreCombinee,covoiturage,tad,gareCFFPrice,nordPrice,rochesBrunesPrice,hopitalPrice]);

  const reset=useCallback(()=>{
    setCentrePrice(3.0);setPrPrice(0);setProgressif(false);setTpDiscount(0);
    setOffreCombinee(false);setCovoiturage(false);setTad(false);
    setGareCFFPrice(2.0);setNordPrice(1.5);setRochesBrunesPrice(1.5);setHopitalPrice(2.0);
    setSimResults(null);
  },[]);

  const R=simResults;

  return(
    <div className="fade-up" style={{display:'flex',height:'100%',overflow:'hidden'}}>
      {/* LEFT */}
      <div style={{width:280,background:C.white,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.borderL}`}}>
          <div className="syne" style={{fontSize:14,fontWeight:800,color:C.ink}}>Leviers de simulation</div>
          <p style={{fontSize:10,color:C.inkL,marginTop:3}}>SION-CET · Prototype MobilityLab · Résultats indicatifs</p>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 14px'}}>
          {/* Centre */}
          <div style={{padding:'12px 14px',background:C.redL,borderRadius:10,border:`1.5px solid ${C.redB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.red,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Centre-ville · Levier direct</div>
            {[{n:'Planta',p:562,ok:true},{n:'Scex',p:658,ok:true},{n:'Cible',p:204,ok:false}].map(pk=>(
              <div key={pk.n} style={{display:'flex',justifyContent:'space-between',fontSize:9.5,color:'#C04060',marginBottom:3}}>
                <span>P {pk.n}{!pk.ok&&<em style={{opacity:.6}}> (estimé)</em>}</span>
                <span className="mono" style={{fontWeight:700}}>{pk.p} pl.</span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.redB}`,marginTop:8,paddingTop:8}}>
              <SliderRow label="Tarif horaire (h2+)" value={centrePrice} onChange={setCentrePrice} min={0} max={8} step={0.5} baseline={3.0} color={C.red}/>
              {centrePrice<3&&(
                <div style={{padding:'7px 10px',background:'#FFF0F2',borderRadius:7,border:`1px solid ${C.redB}`,fontSize:9.5,color:C.red,lineHeight:1.5,marginTop:4}}>
                  ⚠️ <strong>Effet négatif attendu</strong> : baisser le tarif augmente l'attractivité du centre → plus de voitures, saturation, report modal inverse.
                </div>
              )}
            </div>
            <div style={{fontSize:8.5,color:'#D06070',lineHeight:1.5,marginTop:4}}>1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30</div>
          </div>
          {/* P+R */}
          <div style={{padding:'12px 14px',background:C.greenL,borderRadius:10,border:`1.5px solid ${C.greenB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.green,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>P+R Périphérie · Offre alternative</div>
            {[{n:'P+R Potences',p:450},{n:'P+R Stade',p:460}].map(pk=>(
              <div key={pk.n} style={{display:'flex',justifyContent:'space-between',fontSize:9.5,color:'#0A7045',marginBottom:3}}>
                <span>{pk.n} · BS11 10 min</span>
                <span className="mono" style={{fontWeight:700}}>{pk.p} pl.</span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.greenB}`,marginTop:8,paddingTop:8}}>
              <SliderRow label="Tarif P+R" value={prPrice} onChange={setPrPrice} min={0} max={4} step={0.5} baseline={0} color={C.green}/>
              {prPrice>0&&<div style={{fontSize:9,color:C.amber,marginTop:4}}>⚠️ Rendre le P+R payant réduit son attractivité et nuit au report modal.</div>}
            </div>
          </div>
          {/* TP */}
          <div style={{padding:'12px 14px',background:C.blueL,borderRadius:10,border:`1.5px solid ${C.blueB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.blue,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Transports publics · Levier tarifaire TP</div>
            <SliderRow label="Remise TP hors-pointe" value={tpDiscount} onChange={setTpDiscount} min={0} max={50} step={5} baseline={0} color={C.blue} unit="%"/>
            {tpDiscount>0&&<div style={{fontSize:9,color:C.blue,marginTop:4,lineHeight:1.5}}>💡 Remise {tpDiscount}% → +~{Math.round(tpDiscount*0.5)} voyageurs/j. Perte recette CarPostal ~{Math.round(tpDiscount*0.15)}%.</div>}
            <Toggle value={offreCombinee} onChange={setOffreCombinee} color={C.blue} label="Offre combinée P+R + billet TP" sublabel="P+R gratuit + billet 24h CarPostal CHF 3.– → forte incitation"/>
            <div style={{marginTop:8,padding:'8px 10px',background:'white',borderRadius:7,border:`1px solid ${C.blueB}`,fontSize:9,color:C.inkM,lineHeight:1.6}}>
              🅿 Abo mensuel Planta/Scex: <strong>CHF 160/mois</strong><br/>
              🚌 Abo TP Valais: <strong>~CHF 600/an</strong><br/>
              🔗 AG CFF (incl. TP Sion): <strong>CHF 3 860/an</strong>
            </div>
          </div>
          {/* Mesures comp */}
          <div style={{marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Mesures complémentaires</div>
            <Toggle value={progressif} onChange={setProgressif} color={C.amber} label="Tarification progressive (>3h)" sublabel="CHF 3/h → CHF 4/h après 3h · pénalise pendulaires centre"/>
            <Toggle value={covoiturage} onChange={setCovoiturage} color={C.blue} label="Stimulation covoiturage" sublabel="Carvivo / BlaBlaCar Daily · places réservées"/>
            <Toggle value={tad} onChange={setTad} color={C.purple} label="Transport à la demande (TAD)" sublabel="Zones peu desservies · horaires atypiques"/>
          </div>
          {/* Secondaire */}
          <div style={{marginBottom:10}}>
            <button onClick={()=>setShowSecondary(!showSecondary)}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${showSecondary?C.amberB:C.border}`,background:showSecondary?C.amberL:C.borderL,cursor:'pointer',fontFamily:'Inter',fontSize:11,fontWeight:700,color:showSecondary?C.amber:C.inkM}}>
              <span>Parkings hors périmètre direct (simulation)</span>
              <span style={{fontSize:10}}>{showSecondary?'▲':'▼'}</span>
            </button>
            {showSecondary&&(
              <div className="fade-up" style={{padding:'10px 12px',background:C.amberL,borderRadius:'0 0 10px 10px',border:`1.5px solid ${C.amberB}`,borderTop:'none',marginTop:-1}}>
                <div style={{fontSize:9,color:C.amber,lineHeight:1.5,marginBottom:10,padding:'6px 8px',background:'white',borderRadius:6}}>
                  ⚠️ Ces parkings sont hors contrôle direct de la Ville (CFF, privé, HVS). Tarifs <strong>estimés</strong>. La simulation calcule les effets de fuite modale si ces parkings deviennent plus attractifs que le centre.
                </div>
                <SliderRow label="Gare CFF (estimé)" value={gareCFFPrice} onChange={setGareCFFPrice} min={0} max={5} step={0.5} baseline={2.0} color={C.blue}/>
                <SliderRow label="Parking Nord (estimé)" value={nordPrice} onChange={setNordPrice} min={0} max={4} step={0.5} baseline={1.5} color={C.amber}/>
                <SliderRow label="Roches-Brunes (estimé)" value={rochesBrunesPrice} onChange={setRochesBrunesPrice} min={0} max={4} step={0.5} baseline={1.5} color={C.amber}/>
                <SliderRow label="Hôpital du Valais (estimé)" value={hopitalPrice} onChange={setHopitalPrice} min={0} max={5} step={0.5} baseline={2.0} color={C.purple}/>
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

      {/* CENTER */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:C.bg}}>
        {R&&(
          <div style={{padding:'10px 14px',background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',gap:8}}>
            <KpiTile key={simKey+'a'} animKey={simKey+'a'} value={(R.isNegative?'+':'-')+fmt(R.carsReduced)} label={R.isNegative?'Voitures/j en PLUS':'Voitures/j en moins'} delta={R.isNegative?-R.carsReduced:R.carsReduced} color={R.isNegative?C.red:C.green}/>
            <KpiTile key={simKey+'b'} animKey={simKey+'b'} value={(R.tpGain>=0?'+':'')+fmt(R.tpGain)} label="Variation voyageurs TP/j" delta={R.tpGain} color={R.tpGain>=0?C.blue:C.red}/>
            <KpiTile key={simKey+'c'} animKey={simKey+'c'} value={(R.co2>=0?'-':'+')+fmt(Math.abs(R.co2))+' kg'} label="CO₂ évité (−)/généré (+) /j" delta={R.co2} color={R.co2>=0?C.green:C.red}/>
            <KpiTile key={simKey+'d'} animKey={simKey+'d'} value={`CHF ${fmt(R.revenueDay)}`} label="Recettes parking centre/j" delta={R.revDelta} color={R.revDelta>=0?C.amber:C.red} sub={`Δ ${R.revDelta>=0?'+':''}CHF ${fmt(R.revDelta)}/j`}/>
          </div>
        )}
        {R?.isNegative&&(
          <div style={{padding:'9px 16px',background:'#FFF0F2',borderBottom:`2px solid ${C.redB}`,display:'flex',gap:10,alignItems:'center'}}>
            <span style={{fontSize:18}}>⚠️</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.red}}>Effets négatifs détectés</div>
              <div style={{fontSize:9.5,color:'#8B2030',lineHeight:1.5}}>
                Baisser le tarif sous CHF 3.0/h augmente l'attractivité du centre → occ. {R.centreOcc}%, congestion {R.congestion}/4, recettes en baisse, report modal inverse.
              </div>
            </div>
          </div>
        )}
        <div style={{flex:1,padding:12,display:'flex',flexDirection:'column',gap:8}}>
          <div style={{flex:1,borderRadius:12,overflow:'hidden',border:`1px solid ${C.border}`}}>
            <SionMap simResults={R} hoveredId={hoveredId} setHoveredId={setHoveredId}/>
          </div>
          <div style={{padding:'7px 12px',background:C.amberL,borderRadius:8,border:`1px solid ${C.amberB}`,fontSize:9.5,color:C.amber,lineHeight:1.5}}>
            <strong>Modèle SION-CET</strong> — Logit RUM · Élasticité arc −0.30 (Litman 2023, ARE 2021) · CO₂ 1.52 kg/trajet (mix 2025) · Prototype MobilityLab — à valider par calibration terrain avant décision politique
          </div>
        </div>
      </div>

      {/* RIGHT */}
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
                  {([[' 🚗 Voitures/j',fmt(SIM.dailyCar-(col.r.isNegative?-col.r.carsReduced:col.r.carsReduced))],['🚌 TP pax/j',fmt(SIM.dailyTP+col.r.tpGain)],['🅿 Occ. centre',`${col.r.centreOcc}%`],['💰 Recettes/j',`CHF ${fmt(col.r.revenueDay)}`],['🌿 CO₂/j',`${col.r.co2>=0?'-':'+'}${fmt(Math.abs(col.r.co2))} kg`]] as [string,string][]).map(([l,v])=>(
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
                  <span style={{fontSize:10,color:R.isNegative?C.red:C.green}}>{R.isNegative?'voiture ↑ plus de trafic':'voiture → autres modes'}</span>
                </div>
                <div style={{fontSize:9,color:C.inkL,marginTop:4}}>Élasticité arc −0.30 · effets combinés</div>
              </div>
              <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Impacts / jour ouvrable</div>
              {([
                {icon:'🚗',l:R.isNegative?'Voitures en plus/j':'Voitures en moins/j',v:(R.isNegative?'+':'-')+fmt(R.carsReduced),c:R.isNegative?C.red:C.green},
                {icon:'🚌',l:'Voyageurs TP supp./j',v:(R.tpGain>=0?'+':'')+fmt(R.tpGain),c:R.tpGain>=0?C.blue:C.red},
                {icon:'🅿',l:'Occupation centre',v:`${R.centreOcc}%`,c:R.centreOcc>85?C.red:R.centreOcc>65?C.amber:C.green},
                {icon:'🌿',l:'CO₂ évité−/généré+',v:`${R.co2>=0?'-':'+'} ${fmt(Math.abs(R.co2))} kg`,c:R.co2>=0?C.green:C.red},
                {icon:'💰',l:'Recettes parking/j',v:`CHF ${fmt(R.revenueDay)}`,c:R.revDelta>=0?C.amber:C.red},
                {icon:'🅿',l:'P+R usage supp./j',v:R.prUsage>0?`+${fmt(R.prUsage)}`:'stable',c:C.green},
                ...(R.isNegative?[{icon:'🚦',l:'Congestion (0=fluide)',v:`${R.congestion}/4`,c:R.congestion>2?C.red:C.amber}]:[]),
              ] as {icon:string;l:string;v:string;c:string}[]).map(item=>(
                <div key={item.l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px',background:`${item.c}09`,borderRadius:8,marginBottom:5,border:`1px solid ${item.c}22`}}>
                  <span style={{fontSize:10,color:C.inkM}}>{item.icon} {item.l}</span>
                  <span className="mono" style={{fontSize:11,fontWeight:800,color:item.c}}>{item.v}</span>
                </div>
              ))}
              <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:'uppercase',letterSpacing:'.06em',marginTop:14,marginBottom:8}}>Annualisé (250j)</div>
              {([
                {l:'CO₂/an',v:`${R.co2>=0?'-':'+'}${fmt(Math.abs(R.co2)*250/1000)} tCO₂`,c:R.co2>=0?C.green:C.red},
                {l:'Recettes/an',v:`CHF ${fmt(R.revenueDay*250)}`,c:C.amber},
                {l:'Delta recettes/an',v:`${R.revDelta>=0?'+':''}CHF ${fmt(R.revDelta*250)}`,c:R.revDelta>=0?C.green:C.red},
              ] as {l:string;v:string;c:string}[]).map(item=>(
                <div key={item.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.borderL}`}}>
                  <span style={{fontSize:10,color:C.inkM}}>{item.l}</span>
                  <span className="mono" style={{fontSize:11,fontWeight:800,color:item.c}}>{item.v}</span>
                </div>
              ))}
              {tpDiscount>0&&(
                <div style={{marginTop:12,padding:'9px 10px',background:C.blueL,borderRadius:8,border:`1px solid ${C.blueB}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.blue,marginBottom:4}}>Effet remise TP {tpDiscount}%</div>
                  <div style={{fontSize:9,color:C.inkM,lineHeight:1.6}}>✅ ~{Math.round(tpDiscount*0.5)} voyageurs/j supplémentaires estimés<br/>⚠️ Perte recette CarPostal: ~−{Math.round(tpDiscount*0.15)}%<br/>💡 À compenser par mécanisme de péréquation Ville</div>
                </div>
              )}
            </>
          ):(
            <div style={{textAlign:'center',padding:'36px 16px'}}>
              <div style={{fontSize:38,marginBottom:12}}>⊙</div>
              <div className="syne" style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:8}}>Prêt à simuler</div>
              <p style={{fontSize:11,color:C.inkL,lineHeight:1.7}}>Ajustez un levier puis cliquez <strong>Simuler</strong>. Les effets négatifs (baisse de prix) sont aussi calculés.</p>
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
              <p style={{fontSize:12,color:C.inkL,textAlign:'center'}}>↑ Cliquez sur une commune</p>
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
    if(p.dest==='hopital')return{delta:0,equityFlag:false,switch:false,concerned:false,note:p.note??'Zone Champsec — non concerné par tarif centre-ville'};
    if(p.dest==='industrie')return{delta:0,equityFlag:false,switch:false,concerned:false,note:p.note??'Parking privé gratuit Ronquoz — non concerné'};
    if(p.avgStayH===0)return{delta:0,equityFlag:false,switch:false,concerned:false,note:'Non concerné'};
    const billable=Math.max(0,p.avgStayH-1);
    const before=billable*3.0;const after=billable*price;
    const delta=parseFloat((after-before).toFixed(2));
    return{delta,beforeCHF:before.toFixed(2),afterCHF:after.toFixed(2),equityFlag:p.income==='faible'&&delta>2,switch:delta>1.5&&p.tpAff>0.35&&p.carDep<0.9,concerned:true,note:''};
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
                  <div style={{fontSize:9,color:C.inkL,marginTop:1,lineHeight:1.4}}>{p.desc}</div>
                </div>
                {imp.equityFlag&&<span style={{fontSize:16,flexShrink:0}}>⚠️</span>}
                {!imp.concerned&&<span style={{fontSize:14,flexShrink:0,opacity:.4}}>○</span>}
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
                  <div style={{fontSize:9,color:C.inkM,lineHeight:1.5}}>ℹ {imp.note}</div>
                </div>
              )}
              {isSel&&(
                <div className="fade-up" style={{borderTop:`1px solid ${C.borderL}`,paddingTop:8,marginTop:4}}>
                  {imp.concerned&&<div style={{fontSize:10,color:C.inkM,marginBottom:5}}>
                    <strong>Avant:</strong> CHF {imp.beforeCHF} → <strong>Après CHF {price.toFixed(1)}/h:</strong> CHF {imp.afterCHF}
                  </div>}
                  <div style={{fontSize:9,color:C.inkM,lineHeight:1.55,marginBottom:6}}>
                    {imp.equityFlag?'⚠️ Impact disproportionné sur revenu faible — taxibons, abo TP subventionnés, exemptions PMR':
                     imp.switch?'✅ Probabilité élevée de bascule modale — communiquer offre P+R + BS11':
                     !imp.concerned?'ℹ Ce profil n\'est pas impacté par la tarification des parkings du centre-ville.':
                     p.carDep>0.88?'🔒 Très forte dépendance voiture — peu sensible au prix':
                     'ℹ Impact modéré — adaptation progressive probable'}
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
    const b=new Blob([`# Plan d'action mobilité SION-CET\nPrototype MobilityLab · Généré le ${fmtToday()}\n\n${md}`],{type:'text/markdown'});
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
        <button onClick={doExport} style={{padding:'9px 14px',borderRadius:8,border:`1.5px solid ${C.border}`,background:C.white,color:C.inkM,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter',display:'flex',alignItems:'center',gap:6}}>
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
                        <p style={{fontSize:11,color:C.inkM,lineHeight:1.6,marginBottom:8}}>{a.desc}</p>
                        <div className="syne" style={{fontSize:9,fontWeight:700,color:C.inkL,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>Métriques de suivi</div>
                        {a.metrics.map((m,mi)=>(
                          <div key={mi} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <div style={{width:4,height:4,borderRadius:'50%',background:horizon.c,flexShrink:0}}/>
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
            — Comptages OD voitures (entrées centre)<br/>— Capteurs occupation P+R (temps réel)<br/>
            — Durée réelle de stationnement par zone<br/>— Tarifs confirmés Cible, Nord, Roches-Brunes, Hôpital</div>
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
  const [tab,setTab]=useState<TabId>('dashboard');
  const [sev,setSev]=useState('fluide');
  const [simDone,setSimDone]=useState(false);

  useEffect(()=>{
    const h=new Date().getHours();
    if((h>=7&&h<=9)||(h>=17&&h<=19))setSev('dense');
    else if((h>=10&&h<=11)||(h>=14&&h<=16))setSev('modéré');
    else setSev('fluide');
  },[]);

  // Detect simulator use
  useEffect(()=>{if(tab==='simulator')setSimDone(true);},[tab]);

  const TABS:Record<TabId,JSX.Element>={
    dashboard:<DashboardTab/>,
    simulator:<SimulatorTab/>,
    od:<ODTab/>,
    personas:<PersonasTab/>,
    actions:<ActionsTab/>,
  };

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:C.bg}}>
      <Sidebar tab={tab} setTab={setTab} sev={sev} simDone={simDone}/>
      <main style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column'}}>
        {TABS[tab]}
      </main>
    </div>
  );
}
