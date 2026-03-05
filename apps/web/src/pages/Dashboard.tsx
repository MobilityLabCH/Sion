import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line
} from "recharts";

// ── FONTS & STYLES ─────────────────────────────────────────────────────────────
const GlobalStyles = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Inter',sans-serif;background:#F2F1ED;}
      ::-webkit-scrollbar{width:4px;height:4px;}
      ::-webkit-scrollbar-track{background:transparent;}
      ::-webkit-scrollbar-thumb{background:#CCC9BF;border-radius:2px;}
      .syne{font-family:'Syne',sans-serif;}
      .mono{font-family:'JetBrains Mono',monospace;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
      @keyframes scaleIn{from{opacity:0;transform:scale(0.92);}to{opacity:1;transform:scale(1);}}
      @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.55;transform:scale(.85);}}
      .fade-up{animation:fadeUp .3s ease forwards;}
      .scale-in{animation:scaleIn .25s ease forwards;}
      .pulse-dot{animation:pulse 2s infinite;}
      .hover-lift{transition:transform .15s,box-shadow .15s;}
      .hover-lift:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.1);}
      input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;outline:none;cursor:pointer;background:linear-gradient(to right,var(--track-fill,#C8102E) var(--pct,50%),#E5E3DC var(--pct,50%));}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#C8102E;cursor:pointer;box-shadow:0 1px 5px rgba(200,16,46,.4);}
      .tag{display:inline-flex;align-items:center;font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;border:1px solid;white-space:nowrap;font-family:'JetBrains Mono',monospace;}
      .card{background:white;border-radius:12px;border:1px solid #E8E6E0;}
    `;
    document.head.appendChild(style);
  }, []);
  return null;
};

// ── PALETTE ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#F2F1ED",sidebar:"#0F1117",sidebarBorder:"#1C1F2C",white:"#FFFFFF",
  red:"#C8102E",redL:"#FFF0F2",redB:"#FFCDD4",
  green:"#0A7045",greenL:"#F0FDF7",greenB:"#A3E9C8",
  amber:"#A85A00",amberL:"#FFFBEB",amberB:"#FDE68A",
  blue:"#1A4DD6",blueL:"#EFF6FF",blueB:"#BFDBFE",
  purple:"#6825D0",purpleL:"#F5F0FF",purpleB:"#D8B8FA",
  ink:"#0F1117",inkM:"#4A5066",inkL:"#9299AD",
  border:"#E8E6E0",borderL:"#F0EEE8",
};

// ── DONNÉES SION ──────────────────────────────────────────────────────────────
// Sources: sion.ch PDFs 2024-2025, scan-park.ch, CFF, CarPostal 2025

const ALL_PARKINGS = [
  // ── CENTRE (levier direct) ────────────────────────────────────────────────
  {id:"planta",name:"Parking de la Planta",short:"Planta",type:"centre",places:562,
   tarifBaseline:3.0,tarifEditable:true,
   note:"1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30",
   abo:160,source:"sion.ch PDF 15.07.2024",ok:true,
   adresse:"Place de la Planta",coords:{x:282,y:162},occ:78},
  {id:"scex",name:"Parking du Scex",short:"Scex",type:"centre",places:658,
   tarifBaseline:3.0,tarifEditable:true,
   note:"1h gratuite · Gratuit ven.17h–sam.24h · dim. · 12h–13h30",
   abo:160,source:"sion.ch PDF 11.08.2025",ok:true,
   adresse:"Rue du Scex",coords:{x:256,y:177},occ:82},
  {id:"cible",name:"Parking de la Cible",short:"Cible",type:"centre",places:204,
   tarifBaseline:3.0,tarifEditable:true,
   note:"Conditions présumées identiques Planta/Scex – à confirmer",
   abo:null,source:"sion.ch (présumé)",ok:false,
   adresse:"Rue de la Porte-Neuve",coords:{x:320,y:156},occ:71},
  // ── P+R (périphérie) ──────────────────────────────────────────────────────
  {id:"pr-potences",name:"P+R Les Potences",short:"P+R Potences",type:"pr",places:450,
   tarifBaseline:0,tarifEditable:false,
   note:"Gratuit · Bus BS11 → Centre toutes 10 min",
   abo:null,source:"sion.ch / CarPostal 2025",ok:true,
   adresse:"Route des Potences, Sion-Ouest",coords:{x:86,y:214},occ:34,bus:"BS11"},
  {id:"pr-stade",name:"P+R Stade Tourbillon",short:"P+R Stade",type:"pr",places:460,
   tarifBaseline:0,tarifEditable:false,
   note:"Gratuit · Bus BS11 → Centre toutes 10 min",
   abo:null,source:"sion.ch / CarPostal 2025",ok:true,
   adresse:"Route des Agettes",coords:{x:394,y:186},occ:28,bus:"BS11"},
  // ── PÉRICENTRE ────────────────────────────────────────────────────────────
  {id:"nord",name:"Parking Nord",short:"Nord",type:"pericentre",places:282,
   tarifBaseline:1.5,tarifEditable:false,
   note:"Tarif préférentiel résidents – tarif estimé",
   abo:null,source:"sion.ch stationnement (estimé)",ok:false,
   adresse:"Secteur nord",coords:{x:268,y:133},occ:54},
  {id:"roches-brunes",name:"Roches-Brunes",short:"Roches-Brunes",type:"pericentre",places:370,
   tarifBaseline:1.5,tarifEditable:false,
   note:"Tarif préférentiel – détails à confirmer",
   abo:null,source:"scan-park.ch / sion.ch (estimé)",ok:false,
   adresse:"Av. de Tourbillon",coords:{x:360,y:170},occ:47},
  {id:"st-guerin",name:"Parking St-Guérin",short:"St-Guérin",type:"pericentre",places:66,
   tarifBaseline:1.5,tarifEditable:false,
   note:"Tarif préférentiel – petit parking résidentiel",
   abo:null,source:"sion.ch stationnement (estimé)",ok:false,
   adresse:"Rue de St-Guérin",coords:{x:308,y:133},occ:40},
  // ── GARE ─────────────────────────────────────────────────────────────────
  {id:"gare-cff",name:"Parking Gare CFF",short:"Gare CFF",type:"gare",places:300,
   tarifBaseline:2.0,tarifEditable:false,
   note:"Tarif CFF – à vérifier sur cff.ch · Très forte occupation pendulaire",
   abo:null,source:"CFF (estimé)",ok:false,
   adresse:"Avenue de la Gare",coords:{x:148,y:226},occ:91},
  // ── HÔPITAL / SUVA ───────────────────────────────────────────────────────
  {id:"hopital",name:"Parking Hôpital du Valais",short:"Hôpital",type:"hopital",places:400,
   tarifBaseline:2.0,tarifEditable:false,
   note:"Parking patients/visiteurs · Zone Champsec – hors centre",
   abo:null,source:"HVS (estimé)",ok:false,
   adresse:"Av. du Grand-Champsec 80",coords:{x:400,y:148},occ:65},
  {id:"suva",name:"Parking SUVA / Administration",short:"SUVA",type:"hopital",places:180,
   tarifBaseline:0,tarifEditable:false,
   note:"Parkings employés / visiteurs SUVA et administrations cantonales",
   abo:null,source:"Estimé",ok:false,
   adresse:"Av. de la Gare / Ch. de la Sinièse",coords:{x:170,y:198},occ:80},
  // ── ZONE INDUSTRIELLE ─────────────────────────────────────────────────────
  {id:"ronquoz",name:"Zone Ind. Ronquoz / Aéroport",short:"Ronquoz",type:"industrie",places:4000,
   tarifBaseline:0,tarifEditable:false,
   note:"Parkings privés employeurs – ~40 entreprises – GRATUIT",
   abo:null,source:"Estimé (données manquantes)",ok:false,
   adresse:"Zone industrielle Ronquoz",coords:{x:80,y:246},occ:70},
  // ── HORODATEURS (surface) ─────────────────────────────────────────────────
  {id:"zone-bleue",name:"Zone bleue (disque)",short:"Zone bleue",type:"horodateur",places:320,
   tarifBaseline:0,tarifEditable:false,
   note:"Disque obligatoire · Max 1h30 · Gratuit",
   abo:null,source:"sion.ch stationnement",ok:true,
   adresse:"Centre-ville, rues diverses",coords:{x:295,y:182},occ:88},
  {id:"horod-courte",name:"Horodateurs courte durée",short:"Horod. court",type:"horodateur",places:180,
   tarifBaseline:1.0,tarifEditable:false,
   note:"Max 2h · Rotation rapide · Centre-ville",
   abo:null,source:"sion.ch doc zones 03.2025",ok:true,
   adresse:"Centre-ville",coords:{x:265,y:195},occ:82},
];

// ── ÉVÉNEMENTS SION (sources vérifiées + récurrents calculés) ─────────────────
function getSionEvents() {
  const now = new Date();
  const year = now.getFullYear();
  const events = [];

  // ── 1. Marché de la Vieille Ville — CHAQUE VENDREDI 8h-14h (depuis 2003)
  // Grand-Pont, Rue de Lausanne, Espace Remparts, Rue du Rhône
  // Source: mvvsion.ch / siontourisme.ch
  for (let w = 0; w < 8; w++) {
    const d = new Date(now);
    d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7 + w * 7);
    if (d >= now || w === 0) {
      events.push({
        date: d, type: "marche", recurrent: true,
        name: "Marché de la Vieille Ville",
        lieu: "Grand-Pont, Rue de Lausanne, Remparts",
        impact: "moyen", color: C.amber,
        desc: "Marché hebdomadaire produits du terroir et artisanat · 8h–14h",
        tip: "Fermeture partielle Grand-Pont · P Planta ou Scex recommandés · BS11 ou vélo"
      });
    }
  }

  // ── 2. Grand Marché de Pâques (Vendredi Saint = vendredi avant Pâques)
  // Étendu à d'autres rues, toute la journée
  // Pâques 2026 = 5 avril → Vendredi Saint = 3 avril 2026
  const paques2026 = new Date(2026, 3, 3); // 3 avril 2026
  if (paques2026 >= now) {
    events.push({
      date: paques2026, type: "marche_special", recurrent: false,
      name: "Grand Marché de Pâques",
      lieu: "Vieille Ville (étendu), Sion",
      impact: "haute", color: C.red,
      desc: "Édition spéciale étendue à toutes les rues · Toute la journée · Très forte affluence",
      tip: "Accès centre très difficile · P+R Potences/Stade fortement conseillés · Renfort BS11 à prévoir"
    });
  }

  // ── 3. Caves Ouvertes du Valais — 20e édition 2026, Sion
  // Source: valais.ch events 2026
  const caves1 = new Date(2026, 4, 14); // 14 mai
  const caves2 = new Date(2026, 4, 15);
  const caves3 = new Date(2026, 4, 16);
  [caves1, caves2, caves3].forEach(d => {
    if (d >= now) events.push({
      date: d, type: "vin", recurrent: true,
      name: "Caves Ouvertes du Valais (20e éd.)",
      lieu: "Domaines viticoles Sion et région",
      impact: "haute", color: C.red,
      desc: "Portes ouvertes vignerons · Fort afflux visiteurs régionaux + touristes",
      tip: "Prévoir signalétique renforcée · P+R Stade proche vignobles Bramois · Shuttle envisageable"
    });
  });

  // ── 4. FC Sion (Stade de Tourbillon, Cap. 14'283) — matchs à domicile
  // Championnat Super League suisse, saison 2025-2026
  // P+R Stade directement adjacent → impact fort sur mobilité
  const matchsFC = [
    new Date(2026, 2, 14), // 14 mars (samedi)
    new Date(2026, 3, 4),  // 4 avril
    new Date(2026, 3, 18), // 18 avril
    new Date(2026, 4, 2),  // 2 mai
    new Date(2026, 4, 16), // 16 mai
  ];
  matchsFC.forEach(d => {
    if (d >= now) events.push({
      date: d, type: "sport", recurrent: true,
      name: "FC Sion – Match à domicile",
      lieu: "Stade de Tourbillon, Sion",
      impact: "haute", color: C.red,
      desc: "Super League · Cap. 14'283 places · P+R Stade saturé avant/après match",
      tip: "P+R Stade bloqué 2h avant/après · Activer P+R Potences en débordement · Fermeture partielle Av. Tourbillon"
    });
  });

  // ── 5. HC Sion (Patinoire des Arolles) — matchs à domicile
  // Ligue Nationale B / Mystiques
  const matchsHC = [
    new Date(2026, 2, 21), // 21 mars
    new Date(2026, 3, 1),  // 1er avril
    new Date(2026, 3, 15), // 15 avril
  ];
  matchsHC.forEach(d => {
    if (d >= now) events.push({
      date: d, type: "sport", recurrent: true,
      name: "HC Sion – Match hockey",
      lieu: "Patinoire des Arolles, Sion",
      impact: "moyen", color: C.blue,
      desc: "Hockey sur glace · Patinoire des Arolles · Soirée",
      tip: "Parking Arolles limité · P Roches-Brunes en débordement · Fin de match ~22h30"
    });
  });

  // ── 6. Braderie Vieille Ville (printemps/automne)
  const braderie = new Date(2026, 3, 25); // fin avril
  if (braderie >= now) events.push({
    date: braderie, type: "braderie", recurrent: true,
    name: "Braderie de la Vieille Ville",
    lieu: "Vieille Ville de Sion",
    impact: "moyen", color: C.amber,
    desc: "Vide-greniers et braderie · Pietonnisation partielle centre",
    tip: "Rue de Conthey / Grand-Pont partiellement fermés · P Planta recommandé"
  });

  // ── 7. Carnaval sédunois (variables selon année)
  const carnaval = new Date(2026, 2, 7); // ~7 mars 2026 (samedi avant mardi gras)
  if (carnaval >= now) events.push({
    date: carnaval, type: "fete", recurrent: true,
    name: "Carnaval sédunois",
    lieu: "Vieille Ville, Grand-Pont",
    impact: "haute", color: "#9333EA",
    desc: "Défilé carnavalesque · Centre fermé à la circulation · Forte affluence",
    tip: "Centre interdit à la circulation · P+R Potences/Stade obligatoires · Renfort BS11 indispensable"
  });

  // Tri par date
  return events
    .filter(e => e.date >= now)
    .sort((a, b) => a.date - b.date)
    .reduce((acc, e) => {
      // Dédupliquer par date+nom
      const key = `${e.date.toDateString()}-${e.name}`;
      if (!acc.seen.has(key)) { acc.seen.add(key); acc.list.push(e); }
      return acc;
    }, { seen: new Set(), list: [] }).list
    .slice(0, 12);
}

// ── SIMULATION ENGINE ─────────────────────────────────────────────────────────
const SIM = {
  dailyCar: 11500,    // voitures/j entrant centre
  dailyTP: 7800,      // pax TP/j actuels
  centrePlaces: 1424, // Planta+Scex+Cible
  prPlaces: 910,      // P+R Potences+Stade
  avgStayH: 2.5,
  freeH: 1.0,
  turnover: 4.5,
  co2PerTrip: 1.52,   // kg CO2/trajet (mix 2025, 12km A/R, ~130g/km)
  elasticity: -0.30,  // élasticité arc (Litman 2023 + ARE 2021)
  basePrice: 3.0,
  basePrPrice: 0.0,
};

function simulate({ centrePrice, prPrice, progressif, tpDiscount, covoiturage, tad, offreCombinee }) {
  const priceDelta = centrePrice - SIM.basePrice;
  const relChange = priceDelta / SIM.basePrice;

  // ── Effet prix parking sur report modal ──────────────────────────────────
  // Prix monte → shift positif (moins de voitures) ; prix baisse → shift négatif
  const rawShift = relChange * SIM.elasticity; // peut être négatif !
  const clampedShift = Math.max(-0.35, Math.min(0.45, rawShift));

  // ── Effets complémentaires ────────────────────────────────────────────────
  // Remise TP (bus moins cher = attractivité supplémentaire)
  const tpEffect = tpDiscount > 0 ? tpDiscount / 100 * 0.08 : 0;
  // P+R gratuit + prix centre élevé = captation supplémentaire
  const prEffect = prPrice === 0 && centrePrice > SIM.basePrice ? Math.abs(clampedShift) * 0.20 : 0;
  // Offre combinée P+R+TP = fort attrait
  const combineeEffect = offreCombinee && prPrice === 0 ? 0.03 : 0;
  // Progressif longue durée = pénalise les pendulaires centre
  const progressifEffect = progressif && centrePrice >= SIM.basePrice ? 0.02 : 0;
  // Covoiturage = réduit voitures solo
  const covoitEffect = covoiturage ? 0.015 : 0;
  // TAD = option pour captifs
  const tadEffect = tad ? 0.008 : 0;

  const totalShift = clampedShift + tpEffect + prEffect + combineeEffect + progressifEffect + covoitEffect + tadEffect;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const carsReduced = Math.round(SIM.dailyCar * Math.abs(totalShift));
  const carSign = totalShift < 0 ? -1 : 1; // négatif si prix baisse

  const tpGain = carSign * Math.round(carsReduced * (0.65 + (tpDiscount > 0 ? 0.08 : 0)));
  const prUsage = centrePrice > SIM.basePrice ? Math.round(carsReduced * 0.22 + prEffect * SIM.prPlaces * 0.5) : 0;
  const co2 = carSign * Math.round(carsReduced * SIM.co2PerTrip);

  const billable = Math.max(0, SIM.avgStayH - SIM.freeH);
  const revenueDay = Math.round(SIM.centrePlaces * SIM.turnover * billable * centrePrice);
  const baseRevenue = Math.round(SIM.centrePlaces * SIM.turnover * billable * SIM.basePrice);
  const revDelta = revenueDay - baseRevenue;

  // Occupation centre : monte si prix baisse (plus d'attractivité)
  const baseOcc = 79;
  const occDelta = -totalShift * 110;
  const centreOcc = Math.min(98, Math.max(25, Math.round(baseOcc + occDelta)));

  // Congestion : si prix baisse → plus de voitures → congestion monte
  const congestion = centrePrice < SIM.basePrice
    ? Math.min(4, Math.round((SIM.basePrice - centrePrice) * 1.5))
    : 0;

  // TP revenue effect
  const tpRevenueEffect = tpDiscount > 0
    ? -(tpDiscount / 100 * 0.15) // perte recette TP mais gain fréquentation
    : 0;

  return {
    totalShift, carsReduced, carSign,
    tpGain, prUsage, co2, revenueDay, baseRevenue, revDelta,
    centreOcc, congestion, tpRevenueEffect,
    isNegative: totalShift < 0,
  };
}

// ── PERSONAS CORRIGÉS ─────────────────────────────────────────────────────────
const PERSONAS = [
  {id:"p01",emoji:"🚗",label:"Pendulaire bureau",income:"moyen",carDep:0.75,tpAff:0.35,sens:0.55,
   dest:"centre",rigidity:0.8,tags:["horaires fixes","abonnement mensuel"],
   desc:"Travaille au centre-ville, vient de la périphérie",avgStayH:8},
  {id:"p02",emoji:"🚐",label:"Commerçant/livreur",income:"moyen",carDep:0.98,tpAff:0.05,sens:0.70,
   dest:"centre",rigidity:0.9,tags:["captif voiture","multi-arrêts"],
   desc:"Artisan, multiples arrêts, outillage lourd",avgStayH:0.4},
  {id:"p03",emoji:"🛍️",label:"Visiteur commercial",income:"moyen",carDep:0.60,tpAff:0.40,sens:0.65,
   dest:"centre",rigidity:0.45,tags:["flexible","courte durée"],
   desc:"Courses en centre-ville, 1–2h",avgStayH:1.5},
  {id:"p04",emoji:"👴",label:"Senior mobilité réduite",income:"faible",carDep:0.85,tpAff:0.20,sens:0.80,
   dest:"centre",rigidity:0.60,tags:["équité ⚠️","PMR","sensible prix"],
   desc:"Rdv médicaux, courses, mobilité limitée",avgStayH:1.5},
  {id:"p05",emoji:"🏥",label:"Patient / visiteur Hôpital",income:"faible",carDep:0.75,tpAff:0.30,sens:0.70,
   dest:"hopital",rigidity:0.90,tags:["équité ⚠️","Champsec","stress"],
   desc:"Hôpital du Valais (Champsec) — hors centre-ville",avgStayH:2,
   note:"Se gare principalement P Hôpital (400 pl., tarif ~CHF 2/h) — PAS concerné par tarif centre"},
  {id:"p09",emoji:"🧑‍⚕️",label:"Professionnel santé (Hôpital/SUVA)",income:"élevé",carDep:0.70,tpAff:0.40,sens:0.25,
   dest:"hopital",rigidity:0.88,tags:["Champsec","astreintes","peu sensible prix"],
   desc:"Médecin/infirmier HVS ou SUVA — travaille EN DEHORS du centre",avgStayH:8,
   note:"Zone Champsec / Av. du Grand-Champsec — peu impacté par tarif parkings centre · Accès BS7/BS14"},
  {id:"p06",emoji:"🎒",label:"Étudiant HES-SO",income:"faible",carDep:0.30,tpAff:0.75,sens:0.90,
   dest:"centre",rigidity:0.40,tags:["TP","vélo","budget serré"],
   desc:"Campus HES-SO Sion, budget limité",avgStayH:6},
  {id:"p07",emoji:"👩‍💼",label:"Fonctionnaire cantonal",income:"élevé",carDep:0.55,tpAff:0.50,sens:0.35,
   dest:"centre",rigidity:0.70,tags:["abonnement TP","horaires réguliers"],
   desc:"Administration cantonale, centre-ville",avgStayH:8},
  {id:"p08",emoji:"🏗️",label:"Ouvrier zone industrielle",income:"faible",carDep:0.90,tpAff:0.15,sens:0.85,
   dest:"industrie",rigidity:0.95,tags:["captif voiture","équité ⚠️","Ronquoz","horaires décalés"],
   desc:"Zone industrielle Ronquoz — hors centre",avgStayH:8,
   note:"Se gare sur parking privé gratuit employeur à Ronquoz — NON impacté par tarif centre"},
  {id:"p10",emoji:"🏠",label:"Parent école/crèche",income:"moyen",carDep:0.80,tpAff:0.25,sens:0.60,
   dest:"centre",rigidity:0.85,tags:["contrainte horaire","équité"],
   desc:"Dépose enfants puis courses rapides",avgStayH:1},
  {id:"p11",emoji:"🚲",label:"Cycliste urbain",income:"moyen",carDep:0.05,tpAff:0.60,sens:0.20,
   dest:"centre",rigidity:0.30,tags:["vert","non concerné tarif"],
   desc:"Vélo principal, indépendant du prix du parking",avgStayH:0},
  {id:"p12",emoji:"🏔️",label:"Touriste/visiteur externe",income:"élevé",carDep:0.65,tpAff:0.45,sens:0.40,
   dest:"centre",rigidity:0.50,tags:["ponctuel","découverte","peu sensible prix"],
   desc:"Hôtels Sion, patrimoine historique, sites touristiques",avgStayH:3},
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = n => n === undefined || n === null ? "—" : Math.abs(n).toLocaleString("fr-CH");
const fmtDate = d => d.toLocaleDateString("fr-CH",{weekday:"short",day:"numeric",month:"short"});
const fmtNow = () => new Date().toLocaleTimeString("fr-CH",{hour:"2-digit",minute:"2-digit"});
const fmtToday = () => new Date().toLocaleDateString("fr-CH",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const daysUntil = d => Math.max(0,Math.round((d-new Date())/(1000*60*60*24)));

// ── UI COMPONENTS ─────────────────────────────────────────────────────────────
const Tag = ({label,color,bg,border})=>(
  <span className="tag" style={{color,background:bg||color+"18",borderColor:border||color+"40"}}>{label}</span>
);

const KpiTile = ({value,label,sub,color,delta,animKey,icon})=>{
  const [visible,setVisible]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setVisible(true),60);return()=>clearTimeout(t);},[animKey]);
  const dColor=delta===undefined?C.inkL:delta>0?C.green:delta<0?C.red:C.inkL;
  const dSign=delta>0?"↑ +":delta<0?"↓ ":"→ ";
  return(
    <div className="card hover-lift" style={{flex:1,minWidth:0,padding:"13px 14px"}}>
      {icon&&<div style={{fontSize:18,marginBottom:4}}>{icon}</div>}
      <div className="mono" style={{fontSize:20,fontWeight:700,color,lineHeight:1,opacity:visible?1:0,transition:"opacity .3s"}}>{value}</div>
      {delta!==undefined&&<div style={{fontSize:9,fontWeight:700,color:dColor,marginTop:2}}>{dSign}{Math.abs(delta).toLocaleString("fr-CH")} vs baseline</div>}
      <div style={{fontSize:10,color:C.inkM,marginTop:4,lineHeight:1.4}}>{label}</div>
      {sub&&<div style={{fontSize:9,color:C.inkL,marginTop:2}}>{sub}</div>}
    </div>
  );
};

const OccBar = ({pct,color,label})=>{
  const c=color||(pct>85?C.red:pct>65?C.amber:C.green);
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:5,background:C.borderL,borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${Math.min(100,pct)}%`,height:"100%",background:c,borderRadius:3,transition:"width .5s ease"}}/>
      </div>
      <span className="mono" style={{fontSize:10,fontWeight:700,color:c,minWidth:30}}>{pct}%</span>
      {label&&<span style={{fontSize:9,color:C.inkL}}>{label}</span>}
    </div>
  );
};

const Toggle = ({value,onChange,label,sublabel,color=C.blue})=>(
  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.borderL}`,gap:10}}>
    <div>
      <div style={{fontSize:12,color:C.ink,fontWeight:500}}>{label}</div>
      {sublabel&&<div style={{fontSize:9,color:C.inkL,marginTop:1}}>{sublabel}</div>}
    </div>
    <div onClick={()=>onChange(!value)}
      style={{width:36,height:20,borderRadius:10,background:value?color:C.borderL,cursor:"pointer",position:"relative",transition:"background .2s",border:`1px solid ${value?color:C.border}`,flexShrink:0,marginTop:2}}>
      <div style={{position:"absolute",top:2,left:value?16:2,width:14,height:14,borderRadius:"50%",background:"white",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
    </div>
  </div>
);

// ── SVG MAP SION ──────────────────────────────────────────────────────────────
function SionMap({simResults,centrePrice,hoveredId,setHoveredId}){
  const baseOcc={centre:79,pr:31,gare:91,hopital:65,pericentre:50};
  const getOcc=(p)=>{
    if(!simResults) return p.occ;
    if(p.type==="centre") return simResults.centreOcc;
    if(p.type==="pr") return Math.min(96,p.occ+(simResults.prUsage/SIM.prPlaces*40));
    return p.occ;
  };
  const typeColor={centre:C.red,pr:C.green,gare:C.blue,hopital:"#7C3AED",pericentre:C.amber,industrie:C.inkL,horodateur:C.inkM};

  return(
    <svg viewBox="0 0 500 290" style={{width:"100%",height:"100%",background:"#EDE9E0"}}>
      <defs>
        <pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#D9D5CB" strokeWidth=".5"/>
        </pattern>
        <filter id="sh"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodOpacity=".18"/></filter>
      </defs>
      <rect width="500" height="290" fill="url(#g)"/>

      {/* Rhône */}
      <path d="M 0 268 Q 90 258 170 263 Q 250 268 330 260 Q 410 253 500 258" fill="none" stroke="#6BADD6" strokeWidth="14" opacity=".55"/>
      <path d="M 0 268 Q 90 258 170 263 Q 250 268 330 260 Q 410 253 500 258" fill="none" stroke="#8DCAE8" strokeWidth="8" opacity=".35"/>
      <text x="45" y="273" fontSize="8" fill="#4A8FB5" opacity=".6" fontFamily="Inter">Rhône</text>

      {/* Routes principales */}
      <path d="M 0 244 L 500 234" fill="none" stroke="#B8B2A6" strokeWidth="4.5" opacity=".6"/>
      <text x="430" y="231" fontSize="7.5" fill="#8C8678" opacity=".7" fontFamily="Inter">Rte Cantonale</text>

      {/* Réseau routier interne */}
      <path d="M 148 226 L 200 210 L 270 192 L 320 174 L 360 170 L 394 186" fill="none" stroke="#B0AAA0" strokeWidth="3" opacity=".55"/>
      <path d="M 270 192 L 270 135" fill="none" stroke="#B0AAA0" strokeWidth="2.5" opacity=".5"/>
      <path d="M 148 226 L 88 214" fill="none" stroke="#B0AAA0" strokeWidth="2.5" opacity=".5"/>
      <path d="M 170 198 L 200 210" fill="none" stroke="#B0AAA0" strokeWidth="2" opacity=".45"/>
      <path d="M 394 186 L 400 148" fill="none" stroke="#B0AAA0" strokeWidth="2" opacity=".45"/>

      {/* Vieux-Sion colline */}
      <ellipse cx="342" cy="128" rx="44" ry="28" fill="#D0C9B8" opacity=".5"/>
      <text x="342" y="127" fontSize="8" fill="#7A7260" textAnchor="middle" opacity=".65" fontFamily="Inter">Vieux-Sion</text>
      <text x="342" y="137" fontSize="7" fill="#7A7260" textAnchor="middle" opacity=".5" fontFamily="Inter">↑ Basilique Valère</text>

      {/* Zone industrielle */}
      <rect x="35" y="237" width="90" height="18" fill="#BEB9AE" opacity=".3" rx="3"/>
      <text x="80" y="249" fontSize="7" fill="#7A7260" textAnchor="middle" opacity=".65" fontFamily="Inter">Zone ind. Ronquoz</text>

      {/* Campus Hôpital */}
      <rect x="378" y="135" width="50" height="22" fill="#DDD8FA" opacity=".35" rx="3"/>
      <text x="403" y="148" fontSize="7" fill="#5A3A9A" textAnchor="middle" opacity=".7" fontFamily="Inter">HVS / SUVA</text>

      {/* Bus P+R (tirets verts) */}
      <path d="M 88 214 L 148 226" fill="none" stroke={C.green} strokeWidth="1.8" strokeDasharray="4,3" opacity=".55"/>
      <path d="M 394 186 L 320 174" fill="none" stroke={C.green} strokeWidth="1.8" strokeDasharray="4,3" opacity=".55"/>
      <text x="106" y="218" fontSize="7" fill={C.green} opacity=".7" fontFamily="Inter">BS11</text>
      <text x="348" y="179" fontSize="7" fill={C.green} opacity=".7" fontFamily="Inter">BS11</text>

      {/* Gare label */}
      <text x="148" y="243" fontSize="7.5" fill="#444" textAnchor="middle" opacity=".8" fontFamily="Inter">🚉 Gare CFF</text>

      {/* Parking markers */}
      {ALL_PARKINGS.filter(p=>p.coords).map(p=>{
        const isH=hoveredId===p.id;
        const occ=getOcc(p);
        const col=typeColor[p.type]||C.inkM;
        const r=p.type==="industrie"?5:p.type==="centre"?9:p.type==="pr"?8:7;
        const circ=2*Math.PI*(r+2.5);
        return(
          <g key={p.id} style={{cursor:"pointer"}} onClick={()=>setHoveredId(isH?null:p.id)}>
            {isH&&<circle cx={p.coords.x} cy={p.coords.y} r={r+8} fill={col} opacity=".12"/>}
            <circle cx={p.coords.x} cy={p.coords.y} r={r} fill={col} filter="url(#sh)" opacity={isH?1:.82}/>
            <text x={p.coords.x} y={p.coords.y+3.5} textAnchor="middle" fontSize={p.type==="pr"?"6":"7"} fill="white" fontWeight="700" fontFamily="JetBrains Mono">
              {p.type==="pr"?"P+R":p.type==="industrie"?"ZI":"P"}
            </text>
            {/* Anneau occupation */}
            <circle cx={p.coords.x} cy={p.coords.y} r={r+2.5} fill="none" stroke={col} strokeWidth="2.5"
              strokeDasharray={`${occ/100*circ} ${circ}`} opacity=".4" strokeLinecap="round"
              transform={`rotate(-90 ${p.coords.x} ${p.coords.y})`}/>
            {/* Tooltip */}
            {isH&&(
              <g>
                <rect x={p.coords.x-62} y={p.coords.y-62} width="124" height={p.note?58:44} rx="7" fill="white" filter="url(#sh)"/>
                <text x={p.coords.x} y={p.coords.y-47} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.ink} fontFamily="Inter">{p.short}</text>
                <text x={p.coords.x} y={p.coords.y-34} textAnchor="middle" fontSize="8.5" fill={C.inkM} fontFamily="Inter">
                  {p.places.toLocaleString("fr-CH")} pl. · {p.tarifBaseline===0?"GRATUIT":`CHF ${p.tarifBaseline.toFixed(1)}/h`}
                </text>
                <text x={p.coords.x} y={p.coords.y-22} textAnchor="middle" fontSize="9" fill={col} fontWeight="700" fontFamily="JetBrains Mono">
                  Occ. {occ}%{!p.ok?" · ⚠ estimé":""}
                </text>
                {p.note&&<text x={p.coords.x} y={p.coords.y-10} textAnchor="middle" fontSize="7.5" fill={C.inkL} fontFamily="Inter">{p.note.slice(0,32)}</text>}
              </g>
            )}
          </g>
        );
      })}

      {/* Légende */}
      <g transform="translate(7,7)">
        <rect width="148" height="80" rx="7" fill="white" opacity=".92"/>
        {[[C.red,"Centre (levier direct)"],[C.green,"P+R gratuits (BS11)"],[C.amber,"Péricentre (estimé)"],[C.blue,"Gare CFF (estimé)"],["#7C3AED","Hôpital / SUVA"],[C.inkL,"Zone industrielle"]].map(([c,l],i)=>(
          <g key={i} transform={`translate(8,${9+i*12})`}>
            <circle cx="5" cy="4" r="4" fill={c} opacity=".82"/>
            <text x="14" y="8" fontSize="8" fill={C.inkM} fontFamily="Inter">{l}</text>
          </g>
        ))}
      </g>

      {/* Badge scénario */}
      {simResults&&(
        <g transform="translate(345,7)">
          <rect width="148" height={simResults.isNegative?42:36} rx="7" fill={simResults.isNegative?C.red:C.green} opacity=".9"/>
          <text x="74" y="15" textAnchor="middle" fontSize="8" fill="white" fontFamily="Inter" opacity=".85">Scénario simulé</text>
          <text x="74" y="27" textAnchor="middle" fontSize="12" fill="white" fontWeight="700" fontFamily="JetBrains Mono">
            {simResults.isNegative?"-":""}{(Math.abs(simResults.totalShift)*100).toFixed(1)}% report
          </text>
          {simResults.isNegative&&<text x="74" y="38" textAnchor="middle" fontSize="8" fill="white" fontFamily="Inter">⚠ Effet négatif</text>}
        </g>
      )}
    </svg>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAVS=[
  {id:"dashboard",label:"Tableau de bord",icon:"◈"},
  {id:"simulator",label:"Simulateur",icon:"⊙"},
  {id:"od",label:"Analyse OD",icon:"↗"},
  {id:"personas",label:"Personas & équité",icon:"◑"},
  {id:"actions",label:"Plan d'action",icon:"▷"},
];

function Sidebar({tab,setTab,sev,simDone}){
  const sevC={fluide:"#22C55E",modéré:"#F59E0B",dense:"#EA580C",bloqué:"#EF4444"};
  const c=sevC[sev]||"#22C55E";
  const [time,setTime]=useState(fmtNow());
  useEffect(()=>{const i=setInterval(()=>setTime(fmtNow()),30000);return()=>clearInterval(i);},[]);
  return(
    <div style={{width:222,background:C.sidebar,display:"flex",flexDirection:"column",flexShrink:0,height:"100vh",position:"sticky",top:0}}>
      <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${C.sidebarBorder}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:8,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span className="syne" style={{color:"white",fontSize:13,fontWeight:800}}>VS</span>
          </div>
          <div>
            <div className="syne" style={{fontSize:13,fontWeight:700,color:"white",lineHeight:1.2}}>Mobilité Sion</div>
            <div style={{fontSize:9,color:"#4A5070",marginTop:1}}>Service de mobilité · Ville de Sion</div>
          </div>
        </div>
      </div>
      <nav style={{padding:"10px 8px",flex:1}}>
        {NAVS.map(n=>{
          const active=tab===n.id;
          return(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:8,border:"none",cursor:"pointer",background:active?"#1E2240":"transparent",color:active?"white":"#4A5070",marginBottom:2,transition:"all .15s",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:active?600:400,textAlign:"left"}}>
              <span style={{fontSize:11,opacity:.8,width:16}}>{n.icon}</span>
              <span>{n.label}</span>
              {n.id==="simulator"&&simDone&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:C.green}}/>}
            </button>
          );
        })}
      </nav>
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.sidebarBorder}`}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
          <div className="pulse-dot" style={{width:7,height:7,borderRadius:"50%",background:c,flexShrink:0}}/>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:c}}>Trafic {sev}</div>
            <div style={{fontSize:9,color:"#30344A"}}>Route Cantonale · Estimé</div>
          </div>
        </div>
        <div className="mono" style={{fontSize:9,color:"#30344A",lineHeight:1.6}}>
          {fmtToday()}<br/>Heure locale: {time}
        </div>
        <div style={{marginTop:8,fontSize:8,color:"#252838"}}>v2.1 · sion.ch 2024-2025<br/>ARE 2021 · Litman 2023</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab(){
  const events=useMemo(()=>getSionEvents(),[]);
  const hourlyOcc=useMemo(()=>Array.from({length:24},(_,h)=>{
    const centre=h<6?18:h<8?38:h<10?76:h<12?84:h<14?70:h<16?77:h<18?90:h<20?60:h<22?32:20;
    const pr=h<6?8:h<8?20:h<10?42:h<13?35:h<15?28:h<18?38:h<20?50:h<22?25:12;
    return{h:`${h}h`,centre,pr};
  }),[]);

  return(
    <div className="fade-up" style={{padding:"20px 24px",overflowY:"auto",height:"100%",maxWidth:1120}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Tableau de bord mobilité</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>Vue d'ensemble · Ville de Sion · {fmtToday()}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Tag label="Données sion.ch 2024-2025" color={C.inkM} bg={C.borderL} border={C.border}/>
          <Tag label="ARE Microrecensement 2021" color={C.blue} bg={C.blueL} border={C.blueB}/>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        {[
          {value:"18 500",label:"Véhicules/j entrant Sion",sub:"Zone centre + approches",color:C.ink,icon:"🚗"},
          {value:"7 800",label:"Passagers TP/jour",sub:"CarPostal + bus urbains (ARE 2021)",color:C.blue,icon:"🚌"},
          {value:"79%",label:"Occ. parking centre",sub:"Planta + Scex + Cible (1 424 pl.)",color:C.amber,icon:"🅿"},
          {value:"56%",label:"Part modale voiture solo",sub:"Sion (ARE Microrecensement 2021)",color:C.red,icon:"📊"},
          {value:"26.4 t",label:"CO₂ voitures/jour",sub:"~11 500 voitures × 1.52 kg/trajet",color:C.green,icon:"🌿"},
        ].map((k,i)=><KpiTile key={i} {...k} animKey={`d-${i}`}/>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:14,marginBottom:14}}>
        {/* Occupation journalière */}
        <div className="card" style={{padding:"16px 18px"}}>
          <div className="syne" style={{fontSize:13,fontWeight:700,color:C.ink,marginBottom:12}}>
            Occupation parkings — profil journalier estimé
          </div>
          <ResponsiveContainer width="100%" height={155}>
            <AreaChart data={hourlyOcc} margin={{top:0,right:0,bottom:0,left:-22}}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.red} stopOpacity={.3}/>
                  <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.green} stopOpacity={.3}/>
                  <stop offset="95%" stopColor={C.green} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="h" tick={{fontSize:9,fill:C.inkL}} interval={3}/>
              <YAxis tick={{fontSize:9,fill:C.inkL}} domain={[0,100]} unit="%"/>
              <Tooltip contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}} formatter={v=>[`${v}%`,""]}/>
              <Area type="monotone" dataKey="centre" stroke={C.red} fill="url(#gc)" strokeWidth={2} name="Centre" dot={false}/>
              <Area type="monotone" dataKey="pr" stroke={C.green} fill="url(#gp)" strokeWidth={2} name="P+R" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:14,marginTop:6}}>
            {[[C.red,"Parkings centre (Planta/Scex/Cible)"],[C.green,"P+R périphérie (Potences/Stade)"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:10,height:3,background:c,borderRadius:2}}/>
                <span style={{fontSize:9,color:C.inkL}}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:8,fontSize:9,color:C.inkL}}>⚠ Données indicatives — calibration capteurs recommandée</div>
        </div>

        {/* Part modale + capacités */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div className="card" style={{padding:"14px 16px"}}>
            <div className="syne" style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:10}}>Part modale — Sion 2021</div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <PieChart width={80} height={80}>
                <Pie data={[{v:56},{v:22},{v:18},{v:4}]} cx={40} cy={40} innerRadius={24} outerRadius={38} dataKey="v" strokeWidth={2} stroke={C.bg}>
                  {[C.red,C.inkL,C.blue,C.green].map((c,i)=><Cell key={i} fill={c}/>)}
                </Pie>
              </PieChart>
              <div style={{flex:1}}>
                {[["🚗 Voiture solo","56%",C.red],["🚶 Pied/vélo","22%",C.inkL],["🚌 TP","18%",C.blue],["🚲 Vélo","4%",C.green]].map(([l,v,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:10,color:C.inkM}}>{l}</span>
                    <span className="mono" style={{fontSize:11,fontWeight:700,color:c}}>{v}</span>
                  </div>
                ))}
                <div style={{fontSize:8,color:C.inkL,marginTop:4}}>Source: ARE Microrecensement 2021</div>
              </div>
            </div>
          </div>
          <div className="card" style={{padding:"12px 14px",flex:1}}>
            <div className="syne" style={{fontSize:11,fontWeight:700,color:C.ink,marginBottom:8}}>Capacité stationnement</div>
            {[
              {l:"Centre (Planta+Scex+Cible)",n:1424,occ:79,c:C.red},
              {l:"P+R (Potences+Stade)",n:910,occ:32,c:C.green},
              {l:"Gare CFF",n:300,occ:91,c:C.blue},
              {l:"Hôpital du Valais",n:400,occ:65,c:"#7C3AED"},
              {l:"Péricentre (Nord+RB+SG)",n:718,occ:50,c:C.amber},
            ].map(p=>(
              <div key={p.l} style={{marginBottom:7}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:9,color:C.inkM}}>{p.l}</span>
                  <span className="mono" style={{fontSize:9,color:C.inkL}}>{p.n.toLocaleString("fr-CH")} pl.</span>
                </div>
                <OccBar pct={p.occ} color={p.c}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Événements Sion */}
      <div className="card" style={{padding:"16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div className="syne" style={{fontSize:13,fontWeight:700,color:C.ink}}>
            Événements à fort impact mobilité — Sion
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div className="pulse-dot" style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>
            <span style={{fontSize:10,color:C.green,fontWeight:600}}>Mis à jour automatiquement</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {events.slice(0,8).map((e,i)=>{
            const days=daysUntil(e.date);
            return(
              <div key={i} className="hover-lift" style={{padding:"10px 12px",borderRadius:8,border:`1px solid ${e.color}30`,background:`${e.color}08`,cursor:"default"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <span className="mono" style={{fontSize:9,color:e.color,fontWeight:700}}>{fmtDate(e.date)}</span>
                  <span className="mono" style={{fontSize:8,color:days===0?"#EF4444":days<=3?e.color:C.inkL}}>
                    {days===0?"Aujourd'hui":days===1?"Demain":`J-${days}`}
                  </span>
                </div>
                <div style={{fontSize:11,fontWeight:600,color:C.ink,lineHeight:1.35,marginBottom:4}}>{e.name}</div>
                <div style={{fontSize:9,color:C.inkL,marginBottom:6,lineHeight:1.4}}>📍 {e.lieu}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <Tag label={`Impact ${e.impact}`} color={e.color} bg={`${e.color}15`} border={`${e.color}30`}/>
                  {e.recurrent&&<Tag label="Récurrent" color={C.inkM} bg={C.borderL} border={C.border}/>}
                </div>
                {e.tip&&<div style={{marginTop:6,fontSize:8.5,color:C.inkM,lineHeight:1.45,borderTop:`1px solid ${C.borderL}`,paddingTop:5}}>
                  💡 {e.tip}
                </div>}
              </div>
            );
          })}
        </div>
        <div style={{marginTop:10,fontSize:10,color:C.inkL,lineHeight:1.6}}>
          Sources: mvvsion.ch (marché vieille ville, récurrent chaque vendredi) · siontourisme.ch · valais.ch/events · fc-sion.ch · HC Sion
          · Les dates de matchs FC/HC sont indicatives — vérifier calendriers officiels
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — SIMULATEUR
// ═══════════════════════════════════════════════════════════════════════════════
function SimulatorTab(){
  const [centrePrice,setCentrePrice]=useState(3.0);
  const [prPrice,setPrPrice]=useState(0.0);
  const [progressif,setProgressif]=useState(false);
  const [tpDiscount,setTpDiscount]=useState(0);
  const [offreCombinee,setOffreCombinee]=useState(false);
  const [covoiturage,setCovoiturage]=useState(false);
  const [tad,setTad]=useState(false);
  const [simResults,setSimResults]=useState(null);
  const [compareMode,setCompareMode]=useState(false);
  const [hoveredId,setHoveredId]=useState(null);
  const [isRunning,setIsRunning]=useState(false);
  const [simKey,setSimKey]=useState(0);

  const hasChanged=centrePrice!==3.0||prPrice!==0||progressif||tpDiscount>0||offreCombinee||covoiturage||tad;

  const runSim=()=>{
    setIsRunning(true);
    setTimeout(()=>{
      const r=simulate({centrePrice,prPrice,progressif,tpDiscount,covoiturage,tad,offreCombinee});
      setSimResults(r);
      setSimKey(k=>k+1);
      setIsRunning(false);
    },550);
  };

  const reset=()=>{
    setCentrePrice(3.0);setPrPrice(0);setProgressif(false);setTpDiscount(0);
    setOffreCombinee(false);setCovoiturage(false);setTad(false);setSimResults(null);
  };

  const baseR=simulate({centrePrice:3.0,prPrice:0,progressif:false,tpDiscount:0,covoiturage:false,tad:false,offreCombinee:false});

  // Slider style helper
  const sliderStyle=(val,min,max)=>{
    const pct=((val-min)/(max-min))*100;
    return{"--pct":`${pct}%`,"--track-fill":C.red};
  };

  return(
    <div className="fade-up" style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* ── GAUCHE : Leviers ──────────────────────────────────────────────── */}
      <div style={{width:276,background:C.white,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.borderL}`}}>
          <div className="syne" style={{fontSize:14,fontWeight:800,color:C.ink}}>Leviers de simulation</div>
          <p style={{fontSize:11,color:C.inkL,marginTop:3}}>Modifiez et observez l'impact sur la mobilité sédunoise</p>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>

          {/* ── Parking centre ────────────────────────────── */}
          <div style={{padding:"12px 14px",background:C.redL,borderRadius:10,border:`1.5px solid ${C.redB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.red,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>
              Centre-ville · Levier tarifaire direct
            </div>
            <div style={{marginBottom:8}}>
              {[{n:"Planta",p:562,ok:true},{n:"Scex",p:658,ok:true},{n:"Cible",p:204,ok:false}].map(pk=>(
                <div key={pk.n} style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#C04060",marginBottom:3}}>
                  <span>P {pk.n}{!pk.ok&&<em style={{opacity:.6}}> (estimé)</em>}</span>
                  <span className="mono" style={{fontWeight:700}}>{pk.p} pl.</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{fontSize:11,fontWeight:600,color:C.inkM}}>Tarif horaire (h2+)</span>
              <span className="mono" style={{fontSize:17,fontWeight:800,color:centrePrice<3?C.green:centrePrice>3?C.red:C.inkM}}>
                {centrePrice===0?"GRATUIT":`CHF ${centrePrice.toFixed(1)}/h`}
              </span>
            </div>
            <input type="range" min={0} max={8} step={0.5} value={centrePrice}
              onChange={e=>setCentrePrice(parseFloat(e.target.value))}
              style={{width:"100%",...sliderStyle(centrePrice,0,8)}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.inkL,marginTop:2}}>
              <span>GRATUIT</span><span style={{color:C.inkM}}>← baseline CHF 3.0/h</span><span>CHF 8/h</span>
            </div>
            {centrePrice<3&&(
              <div style={{marginTop:8,padding:"7px 10px",background:"#FFF0F2",borderRadius:7,border:`1px solid ${C.redB}`,fontSize:10,color:C.red,lineHeight:1.5}}>
                ⚠️ <strong>Effet négatif probable</strong> : baisser le tarif augmente l'attractivité des parkings centre → plus de voitures, occupation plus élevée, report modal inverse.
              </div>
            )}
            {centrePrice===0&&(
              <div style={{marginTop:6,padding:"6px 10px",background:"#FFF0F2",borderRadius:7,border:`1px solid ${C.redB}`,fontSize:9,color:C.red}}>
                🔴 Gratuité totale : afflux maximal, 0 recette, occupation ~100%, concurrence nulle avec P+R.
              </div>
            )}
            <div style={{marginTop:6,fontSize:9,color:"#D06070",lineHeight:1.5}}>
              1ère heure gratuite maintenue · Gratuit ven.17h–sam.24h · dim. · 12h–13h30
            </div>
          </div>

          {/* ── P+R ────────────────────────────────────────── */}
          <div style={{padding:"12px 14px",background:C.greenL,borderRadius:10,border:`1.5px solid ${C.greenB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.green,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>
              P+R Périphérie · Offre alternative
            </div>
            {[{n:"P+R Potences (Sion-Ouest)",p:450},{n:"P+R Stade / Tourbillon",p:460}].map(pk=>(
              <div key={pk.n} style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#0A7045",marginBottom:3}}>
                <span>{pk.n} · BS11 10 min</span>
                <span className="mono" style={{fontWeight:700}}>{pk.p} pl.</span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.greenB}`,marginTop:8,paddingTop:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:11,fontWeight:600,color:C.inkM}}>Tarif P+R</span>
                <span className="mono" style={{fontSize:17,fontWeight:800,color:C.green}}>
                  {prPrice===0?"GRATUIT":`CHF ${prPrice.toFixed(1)}/h`}
                </span>
              </div>
              <input type="range" min={0} max={4} step={0.5} value={prPrice}
                onChange={e=>setPrPrice(parseFloat(e.target.value))}
                style={{width:"100%","--pct":`${prPrice/4*100}%`,"--track-fill":C.green}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.inkL,marginTop:2}}>
                <span style={{fontWeight:700,color:C.green}}>GRATUIT ← baseline</span><span>CHF 4/h</span>
              </div>
              {prPrice>0&&<div style={{marginTop:6,fontSize:9,color:C.amber,lineHeight:1.5}}>⚠️ Rendre le P+R payant réduit son attractivité et nuit au report modal.</div>}
            </div>
          </div>

          {/* ── Levier TP (NOUVEAU) ────────────────────────── */}
          <div style={{padding:"12px 14px",background:C.blueL,borderRadius:10,border:`1.5px solid ${C.blueB}`,marginBottom:12}}>
            <div className="syne" style={{fontSize:10,fontWeight:800,color:C.blue,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>
              Transports publics · Levier tarifaire TP
            </div>

            {/* Remise TP */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:11,fontWeight:600,color:C.inkM}}>Remise TP hors-pointe</span>
                <span className="mono" style={{fontSize:16,fontWeight:800,color:tpDiscount>0?C.blue:C.inkL}}>
                  {tpDiscount===0?"Aucune":`-${tpDiscount}%`}
                </span>
              </div>
              <input type="range" min={0} max={50} step={5} value={tpDiscount}
                onChange={e=>setTpDiscount(parseInt(e.target.value))}
                style={{width:"100%","--pct":`${tpDiscount/50*100}%`,"--track-fill":C.blue}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.inkL,marginTop:2}}>
                <span>0% (baseline)</span><span>-50%</span>
              </div>
              {tpDiscount>0&&<div style={{marginTop:4,fontSize:9,color:C.blue,lineHeight:1.5}}>
                💡 Une remise de {tpDiscount}% sur les billets hors-pointe augmente l'attractivité des TP mais réduit les recettes CarPostal de ~{Math.round(tpDiscount*0.15)}%.
              </div>}
            </div>

            {/* Offre combinée P+R */}
            <Toggle value={offreCombinee} onChange={setOffreCombinee} color={C.blue}
              label="Offre combinée P+R + billet TP"
              sublabel="Ex: P+R gratuit + billet 24h CarPostal CHF 3.– → forte incitation"/>

            {/* Abonnement mensuel info */}
            <div style={{marginTop:8,padding:"8px 10px",background:"white",borderRadius:7,border:`1px solid ${C.blueB}`}}>
              <div style={{fontSize:10,fontWeight:700,color:C.blue,marginBottom:4}}>Abonnements existants</div>
              <div style={{fontSize:9,color:C.inkM,lineHeight:1.6}}>
                🅿 Abo mensuel Planta/Scex: <span className="mono" style={{fontWeight:700}}>CHF 160/mois</span><br/>
                🚌 Abonnement général TP VS: <span className="mono" style={{fontWeight:700}}>CHF 600/an (env.)</span><br/>
                🔗 AG CFF (incl. TP Sion): <span className="mono" style={{fontWeight:700}}>CHF 3860/an</span>
              </div>
            </div>
          </div>

          {/* ── Mesures comp. ──────────────────────────────── */}
          <div style={{marginBottom:10}}>
            <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
              Mesures complémentaires
            </div>
            <Toggle value={progressif} onChange={setProgressif} color={C.amber}
              label="Tarification progressive longue durée"
              sublabel="Ex: CHF 3/h après 1h gratuite, puis CHF 4/h après 3h — pénalise pendulaires centre"/>
            <Toggle value={covoiturage} onChange={setCovoiturage} color={C.blue}
              label="Stimulation covoiturage"
              sublabel="Partenariat avec applis (Carvivo, BlaBlaCar Daily) · Places réservées"/>
            <Toggle value={tad} onChange={setTad} color="#7C3AED"
              label="Transport à la demande (TAD)"
              sublabel="Pour zones peu desservies — périphérie et horaires atypiques"/>
          </div>

          {/* ── Autres parkings (info seule) ─────────────── */}
          <div>
            <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
              Hors périmètre levier direct
            </div>
            {[
              {n:"Gare CFF",p:300,t:"~CHF 2.0/h",ok:false},
              {n:"Nord",p:282,t:"~CHF 1.5/h",ok:false},
              {n:"Roches-Brunes",p:370,t:"~CHF 1.5/h",ok:false},
              {n:"St-Guérin",p:66,t:"~CHF 1.5/h",ok:false},
              {n:"Hôpital du Valais",p:400,t:"~CHF 2.0/h",ok:false},
              {n:"Zone Ind. Ronquoz",p:"~4 000",t:"GRATUIT",ok:false},
              {n:"Zone bleue (disque)",p:320,t:"GRATUIT",ok:true},
            ].map(pk=>(
              <div key={pk.n} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,padding:"5px 9px",background:C.borderL,borderRadius:7}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.inkM}}>{pk.n} · {typeof pk.p==="number"?pk.p.toLocaleString("fr-CH"):pk.p} pl.</div>
                  <div style={{fontSize:8,color:C.inkL}}>{pk.ok?"données officielles":"tarif estimé"}</div>
                </div>
                <span className="mono" style={{fontSize:10,fontWeight:700,color:pk.t==="GRATUIT"?C.green:C.inkM}}>{pk.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Boutons */}
        <div style={{padding:"12px 14px",borderTop:`1px solid ${C.borderL}`}}>
          <button onClick={runSim} disabled={isRunning}
            style={{width:"100%",padding:"11px",borderRadius:9,border:"none",background:isRunning?C.borderL:hasChanged?C.red:C.inkM,color:isRunning?C.inkL:"white",fontSize:13,fontWeight:800,cursor:isRunning?"not-allowed":"pointer",transition:"all .2s",fontFamily:"Syne,sans-serif"}}>
            {isRunning?"Simulation…":hasChanged?"▶ Simuler ce scénario":"▶ Simuler (baseline)"}
          </button>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button onClick={()=>setCompareMode(!compareMode)}
              style={{flex:1,padding:"7px",borderRadius:8,border:`1.5px solid ${compareMode?C.blue:C.border}`,background:compareMode?C.blueL:"transparent",color:compareMode?C.blue:C.inkM,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter"}}>
              ⇄ Comparer
            </button>
            <button onClick={reset}
              style={{padding:"7px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.inkL,fontSize:11,cursor:"pointer",fontFamily:"Inter"}}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── CENTRE : Carte + KPIs ────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,background:C.bg}}>
        {/* KPIs */}
        {simResults&&(
          <div style={{padding:"10px 14px",background:C.white,borderBottom:`1px solid ${C.border}`,display:"flex",gap:8}}>
            <KpiTile key={simKey+"a"} animKey={simKey+"a"}
              value={(simResults.isNegative?"+":"-")+fmt(simResults.carsReduced)}
              label={simResults.isNegative?"Voitures/j en PLUS au centre":"Voitures/j en moins au centre"}
              delta={simResults.isNegative?-simResults.carsReduced:simResults.carsReduced}
              color={simResults.isNegative?C.red:C.green}/>
            <KpiTile key={simKey+"b"} animKey={simKey+"b"}
              value={(simResults.tpGain>=0?"+":"")+fmt(simResults.tpGain)}
              label="Variation voyageurs TP/jour"
              delta={simResults.tpGain}
              color={simResults.tpGain>=0?C.blue:C.red}/>
            <KpiTile key={simKey+"c"} animKey={simKey+"c"}
              value={(simResults.co2>=0?"-":"+")+fmt(Math.abs(simResults.co2))+" kg"}
              label="CO₂ évité (−) / généré (+) /jour"
              delta={simResults.co2}
              color={simResults.co2>=0?C.green:C.red}/>
            <KpiTile key={simKey+"d"} animKey={simKey+"d"}
              value={`CHF ${fmt(simResults.revenueDay)}`}
              label="Recettes parking centre/jour"
              delta={simResults.revDelta}
              color={simResults.revDelta>=0?C.amber:C.red}
              sub={`Δ CHF ${simResults.revDelta>=0?"+":""}${fmt(simResults.revDelta)}/j`}/>
          </div>
        )}
        {/* Alerte effets négatifs */}
        {simResults?.isNegative&&(
          <div style={{padding:"10px 16px",background:"#FFF0F2",borderBottom:`2px solid ${C.redB}`,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:18}}>⚠️</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.red}}>Effets négatifs détectés</div>
              <div style={{fontSize:10,color:"#8B2030",lineHeight:1.5}}>
                Baisser le tarif sous CHF {SIM.basePrice}/h augmente l'attractivité du centre pour les voitures.
                Conséquences: occupation ~{simResults.centreOcc}%, report modal inverse, congestion +{simResults.congestion}/5, moindre attrait P+R.
              </div>
            </div>
          </div>
        )}
        {/* Carte */}
        <div style={{flex:1,padding:12,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{flex:1,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
            <SionMap simResults={simResults} centrePrice={centrePrice} hoveredId={hoveredId} setHoveredId={setHoveredId}/>
          </div>
          <div style={{padding:"7px 12px",background:C.amberL,borderRadius:8,border:`1px solid ${C.amberB}`,fontSize:9.5,color:C.amber,lineHeight:1.5}}>
            <strong>Modèle indicatif</strong> — Logit RUM · Élasticité arc −0.30 (Litman 2023, Spiess ARE 2021) · CO₂: 1.52 kg/trajet (mix 2025)
            · Résultats à valider par calibration terrain (comptages, enquêtes OD) avant décision politique
          </div>
        </div>
      </div>

      {/* ── DROITE : Résultats ────────────────────────────── */}
      <div style={{width:272,background:C.white,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.borderL}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div className="syne" style={{fontSize:13,fontWeight:800,color:C.ink}}>{compareMode?"Comparaison":"Résultats"}</div>
          {simResults&&(
            <span className="mono" style={{fontSize:10,fontWeight:700,color:simResults.isNegative?C.red:C.green,background:simResults.isNegative?C.redL:C.greenL,padding:"2px 8px",borderRadius:20,border:`1px solid ${simResults.isNegative?C.redB:C.greenB}`}}>
              {simResults.isNegative?"-":""}{(Math.abs(simResults.totalShift)*100).toFixed(1)}% report
            </span>
          )}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
          {compareMode&&simResults?(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[{label:"Situation actuelle",r:baseR,price:3.0,isBase:true},{label:"Scénario simulé",r:simResults,price:centrePrice,isBase:false}].map(col=>(
                <div key={col.label} style={{borderRadius:10,border:`1.5px solid ${col.isBase?C.border:col.r.isNegative?C.redB:C.blueB}`,padding:"10px 12px",background:col.isBase?C.borderL:col.r.isNegative?C.redL:C.blueL}}>
                  <div className="syne" style={{fontSize:10,fontWeight:800,color:col.isBase?C.inkM:col.r.isNegative?C.red:C.blue,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>{col.label}</div>
                  <div className="mono" style={{fontSize:16,fontWeight:800,color:col.isBase?C.inkM:col.r.isNegative?C.red:C.blue,marginBottom:8}}>
                    {col.price===0?"GRATUIT":`CHF ${col.price.toFixed(1)}/h`}
                  </div>
                  {[
                    ["🚗 Voitures/j",fmt(SIM.dailyCar-(col.r.isNegative?-col.r.carsReduced:col.r.carsReduced))],
                    ["🚌 TP pax/j",fmt(SIM.dailyTP+col.r.tpGain)],
                    ["🅿 Occ. centre",`${col.r.centreOcc}%`],
                    ["💰 Recettes/j",`CHF ${fmt(col.r.revenueDay)}`],
                    ["🌿 CO₂ évité/j",`${col.r.co2>=0?"+":"-"}${fmt(Math.abs(col.r.co2))} kg`],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"4px 0",borderBottom:`1px solid ${col.isBase?C.border:C.blueB}`}}>
                      <span style={{color:C.inkM}}>{l}</span>
                      <span className="mono" style={{fontWeight:700,color:col.isBase?C.inkM:C.blue}}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ):simResults?(
            <>
              {/* Report modal global */}
              <div style={{background:simResults.isNegative?C.redL:C.greenL,borderRadius:10,padding:"12px 14px",marginBottom:12,border:`1.5px solid ${simResults.isNegative?C.redB:C.greenB}`}}>
                <div style={{fontSize:10,color:simResults.isNegative?C.red:C.green,fontWeight:600,marginBottom:3}}>
                  {simResults.isNegative?"Effet négatif":"Report modal global"}
                </div>
                <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                  <span className="mono" style={{fontSize:34,fontWeight:800,color:simResults.isNegative?C.red:C.green,lineHeight:1}}>
                    {simResults.isNegative?"-":""}{(Math.abs(simResults.totalShift)*100).toFixed(1)}%
                  </span>
                  <span style={{fontSize:10,color:simResults.isNegative?C.red:C.green}}>
                    {simResults.isNegative?"voiture ↑ (plus de trafic)":"voiture → autres modes"}
                  </span>
                </div>
                <div style={{fontSize:9,color:C.inkL,marginTop:4}}>Élasticité arc −0.30 · effets combinés</div>
              </div>

              {/* Indicateurs */}
              <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Impacts / jour ouvrable</div>
              {[
                {icon:"🚗",l:simResults.isNegative?"Voitures en plus/j":"Voitures en moins/j",v:(simResults.isNegative?"+":"-")+fmt(simResults.carsReduced),c:simResults.isNegative?C.red:C.green},
                {icon:"🚌",l:"Voyageurs TP supp./j",v:(simResults.tpGain>=0?"+":"")+fmt(simResults.tpGain),c:simResults.tpGain>=0?C.blue:C.red},
                {icon:"🅿",l:"Occ. parking centre",v:`${simResults.centreOcc}%`,c:simResults.centreOcc>85?C.red:simResults.centreOcc>65?C.amber:C.green},
                {icon:"🌿",l:"CO₂ évité (−) / généré (+)",v:`${simResults.co2>=0?"-":"+"} ${fmt(Math.abs(simResults.co2))} kg`,c:simResults.co2>=0?C.green:C.red},
                {icon:"💰",l:"Recettes parking centre/j",v:`CHF ${fmt(simResults.revenueDay)}`,c:simResults.revDelta>=0?C.amber:C.red},
                {icon:"🅿",l:"P+R — usage supp./j",v:simResults.prUsage>0?`+${fmt(simResults.prUsage)}`:"stable",c:C.green},
                ...(simResults.isNegative?[{icon:"🚦",l:"Congestion (0=fluide, 4=bloqué)",v:`${simResults.congestion}/4`,c:simResults.congestion>2?C.red:C.amber}]:[]),
              ].map(item=>(
                <div key={item.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",background:`${item.c}09`,borderRadius:8,marginBottom:5,border:`1px solid ${item.c}22`}}>
                  <span style={{fontSize:10,color:C.inkM}}>{item.icon} {item.l}</span>
                  <span className="mono" style={{fontSize:11,fontWeight:800,color:item.c}}>{item.v}</span>
                </div>
              ))}

              {/* Annualisé */}
              <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:"uppercase",letterSpacing:".06em",marginTop:14,marginBottom:8}}>
                Annualisé (250j ouvrables)
              </div>
              {[
                {l:"CO₂ évité/an",v:`${simResults.co2>=0?"-":"+"}${fmt(Math.abs(simResults.co2)*250/1000)} tCO₂`,c:simResults.co2>=0?C.green:C.red},
                {l:"Recettes parking/an",v:`CHF ${fmt(simResults.revenueDay*250)}`,c:C.amber},
                {l:"Delta recettes/an",v:`${simResults.revDelta>=0?"+":""}CHF ${fmt(simResults.revDelta*250)}`,c:simResults.revDelta>=0?C.green:C.red},
              ].map(item=>(
                <div key={item.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.borderL}`}}>
                  <span style={{fontSize:10,color:C.inkM}}>{item.l}</span>
                  <span className="mono" style={{fontSize:11,fontWeight:800,color:item.c}}>{item.v}</span>
                </div>
              ))}

              {/* Effets TP si discount actif */}
              {tpDiscount>0&&(
                <div style={{marginTop:12,padding:"9px 10px",background:C.blueL,borderRadius:8,border:`1px solid ${C.blueB}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.blue,marginBottom:4}}>Effet remise TP {tpDiscount}%</div>
                  <div style={{fontSize:9,color:C.inkM,lineHeight:1.6}}>
                    ✅ Gain attractivité TP: ~{Math.round(tpDiscount*0.5)} voyageurs/j supplémentaires estimés<br/>
                    ⚠️ Perte recette CarPostal: ~−{Math.round(tpDiscount*0.15)}% revenus billetterie<br/>
                    💡 À compenser par mécanisme de péréquation Ville
                  </div>
                </div>
              )}
            </>
          ):(
            <div style={{textAlign:"center",padding:"36px 16px"}}>
              <div style={{fontSize:38,marginBottom:12}}>⊙</div>
              <div className="syne" style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:8}}>Prêt à simuler</div>
              <p style={{fontSize:11,color:C.inkL,lineHeight:1.7,marginBottom:16}}>
                Ajustez un ou plusieurs leviers puis cliquez <strong>Simuler</strong>.
                Les effets négatifs (baisse de prix) sont aussi calculés.
              </p>
              <div style={{textAlign:"left"}}>
                <div className="syne" style={{fontSize:10,fontWeight:700,color:C.inkL,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Baseline actuel</div>
                {[
                  {l:"Centre Planta+Scex+Cible",v:"CHF 3.0/h",p:"1 424 pl.",c:C.red},
                  {l:"P+R Potences+Stade",v:"GRATUIT",p:"910 pl.",c:C.green},
                  {l:"Gare CFF",v:"~CHF 2.0/h",p:"~300 pl.",c:C.blue,est:true},
                  {l:"Zone Industrielle Ronquoz",v:"GRATUIT",p:"~4 000 pl.",c:C.inkL,est:true},
                  {l:"Hôpital du Valais",v:"~CHF 2.0/h",p:"~400 pl.",c:"#7C3AED",est:true},
                ].map(item=>(
                  <div key={item.l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                    <div style={{width:8,height:8,borderRadius:2,background:item.c,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:C.inkM,fontWeight:600}}>{item.l}</div>
                      <div style={{fontSize:8,color:C.inkL}}>{item.p}{item.est?" · estimé":""}</div>
                    </div>
                    <span className="mono" style={{fontSize:10,fontWeight:700,color:item.v==="GRATUIT"?C.green:C.inkM}}>{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{padding:"7px 12px",borderTop:`1px solid ${C.borderL}`,fontSize:8.5,color:C.inkL,lineHeight:1.6}}>
          sion.ch 2024-2025 · ARE 2021 · TCS 2024 · Litman 2023
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — OD (inchangé mais compact)
// ═══════════════════════════════════════════════════════════════════════════════
const ZONES_OD=[
  {id:"bramois",label:"Bramois",pop:2900,car:8,tp:18,line:"Bus BS2",freq:15,cap:"ok"},
  {id:"grimisuat",label:"Grimisuat",pop:2300,car:11,tp:30,line:"Bus BS6",freq:30,cap:"moyen"},
  {id:"conthey",label:"Conthey",pop:9800,car:12,tp:28,line:"CarPostal",freq:30,cap:"moyen"},
  {id:"salins",label:"Salins",pop:1800,car:9,tp:28,line:"Bus BS",freq:60,cap:"captif"},
  {id:"savieve",label:"Savièse",pop:5100,car:14,tp:35,line:"CarPostal 431",freq:60,cap:"captif"},
  {id:"vetroz",label:"Vétroz",pop:4200,car:14,tp:32,line:"CarPostal",freq:60,cap:"captif"},
  {id:"ardon",label:"Ardon",pop:3600,car:16,tp:38,line:"CarPostal",freq:60,cap:"captif"},
  {id:"ayent",label:"Ayent",pop:4100,car:18,tp:45,line:"CarPostal 441",freq:60,cap:"captif"},
  {id:"vex",label:"Vex",pop:1700,car:20,tp:40,line:"CarPostal",freq:60,cap:"captif"},
  {id:"nendaz",label:"Nendaz",pop:7200,car:25,tp:55,line:"CarPostal",freq:60,cap:"captif"},
];
const CAP_C={ok:{c:C.green,b:C.greenB,bg:C.greenL,l:"TP compétitif"},moyen:{c:C.amber,b:C.amberB,bg:C.amberL,l:"TP partiel"},captif:{c:C.red,b:C.redB,bg:C.redL,l:"Captif voiture"}};

function ODTab(){
  const [sel,setSel]=useState(null);
  const total=ZONES_OD.reduce((s,z)=>s+z.pop,0);
  const captifPop=ZONES_OD.filter(z=>z.cap==="captif").reduce((s,z)=>s+z.pop,0);
  return(
    <div className="fade-up" style={{padding:"20px 24px",overflowY:"auto",height:"100%",maxWidth:1120}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Analyse Origine–Destination</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>Compétitivité TP vs voiture par commune · Identification des populations captives</p>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        {[
          {v:fmt(total),l:"Habitants zones d'origine",c:C.ink},
          {v:`${Math.round(captifPop/total*100)}%`,l:"Population captive voiture",c:C.red},
          {v:`${ZONES_OD.filter(z=>z.cap==="ok").length}`,l:"Communes TP compétitif",c:C.green},
          {v:`${ZONES_OD.filter(z=>z.freq<=30).length}`,l:"Communes fréq. TP ≤30 min",c:C.blue},
        ].map((k,i)=><KpiTile key={i} {...k} animKey={`od-${i}`}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 330px",gap:14}}>
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr .7fr .7fr 1fr 1fr",padding:"9px 15px",background:C.borderL,borderBottom:`1px solid ${C.border}`}}>
            {["Commune","Population","Voiture","TP","Ligne","Statut"].map(h=>(
              <div key={h} className="syne" style={{fontSize:9,fontWeight:700,color:C.inkM,textTransform:"uppercase",letterSpacing:".05em"}}>{h}</div>
            ))}
          </div>
          {ZONES_OD.map((z,i)=>{
            const cs=CAP_C[z.cap];
            return(
              <div key={z.id} onClick={()=>setSel(sel?.id===z.id?null:z)}
                style={{display:"grid",gridTemplateColumns:"1.2fr .8fr .7fr .7fr 1fr 1fr",padding:"9px 15px",borderBottom:`1px solid ${C.borderL}`,cursor:"pointer",background:sel?.id===z.id?C.blueL:i%2===0?C.white:C.bg,transition:"background .1s"}}>
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
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {sel?(
            <div className="card scale-in" style={{padding:16}}>
              <div className="syne" style={{fontSize:16,fontWeight:800,color:C.ink,marginBottom:4}}>{sel.label}</div>
              <div style={{fontSize:12,color:C.inkL,marginBottom:12}}>{(sel.pop/1000).toFixed(1)}k habitants</div>
              {[["Voiture",`${sel.car} min`,C.red],["TP actuel",`${sel.tp} min`,C.blue],["Ratio TP/voiture",`×${(sel.tp/sel.car).toFixed(1)}`,(sel.tp/sel.car)>2.5?C.red:C.amber],["Fréquence",`${sel.freq} min`,C.blue],["Ligne",sel.line,C.inkM]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.borderL}`}}>
                  <span style={{fontSize:11,color:C.inkM}}>{l}</span>
                  <span className="mono" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
              <div style={{marginTop:12,padding:"10px",background:CAP_C[sel.cap].bg,borderRadius:8,border:`1px solid ${CAP_C[sel.cap].b}`,fontSize:11,color:CAP_C[sel.cap].c,lineHeight:1.5}}>
                {sel.cap==="captif"?"⚠️ Population captive voiture — priorité renfort TP ou desserte P+R":
                 sel.cap==="moyen"?"⚡ Potentiel d'amélioration — fréquence TP à augmenter":
                 "✅ TP compétitif — maintenir et communiquer"}
              </div>
            </div>
          ):(
            <div className="card" style={{padding:20,display:"flex",alignItems:"center",justifyContent:"center",minHeight:160}}>
              <p style={{fontSize:12,color:C.inkL,textAlign:"center"}}>↑ Cliquez sur une commune pour voir le détail</p>
            </div>
          )}
          <div className="card" style={{padding:14}}>
            <div className="syne" style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:10}}>Temps TP vs Voiture</div>
            <ResponsiveContainer width="100%" height={155}>
              <BarChart data={ZONES_OD} margin={{top:0,right:0,bottom:22,left:-22}}>
                <XAxis dataKey="label" tick={{fontSize:8,fill:C.inkL}} angle={-38} textAnchor="end"/>
                <YAxis tick={{fontSize:9,fill:C.inkL}} unit=" min"/>
                <Tooltip contentStyle={{fontSize:11,background:C.white,border:`1px solid ${C.border}`,borderRadius:8}}/>
                <Bar dataKey="car" fill={C.red} name="Voiture" opacity={.75} radius={[2,2,0,0]}/>
                <Bar dataKey="tp" fill={C.blue} name="TP" opacity={.85} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — PERSONAS
// ═══════════════════════════════════════════════════════════════════════════════
function PersonasTab(){
  const [sel,setSel]=useState(null);
  const [price,setPrice]=useState(3.0);

  const getImpact=(p)=>{
    if(p.id==="p11") return{delta:0,equityFlag:false,switch:false,concerned:false,note:"Non concerné — utilise le vélo"};
    if(p.dest==="hopital") return{delta:0,equityFlag:false,switch:false,concerned:false,
      note:`Se gare ${p.id==="p08"?"sur parking privé Ronquoz":"au parking Hôpital/SUVA"} — NON concerné par le tarif des parkings centre-ville`};
    if(p.dest==="industrie") return{delta:0,equityFlag:false,switch:false,concerned:false,
      note:"Parking privé gratuit employeur Ronquoz — non concerné"};
    if(p.avgStayH===0) return{delta:0,equityFlag:false,switch:false,concerned:false,note:"Non concerné"};
    const billable=Math.max(0,p.avgStayH-1);
    const before=billable*3.0;
    const after=billable*price;
    const delta=after-before;
    const equityFlag=p.income==="faible"&&delta>2;
    const sw=delta>1.5&&p.tpAff>0.35&&p.carDep<0.9;
    return{delta:parseFloat(delta.toFixed(2)),beforeCHF:before.toFixed(2),afterCHF:after.toFixed(2),equityFlag,switch:sw,concerned:true};
  };

  const concerned=PERSONAS.filter(p=>getImpact(p).concerned);
  const equityCount=concerned.filter(p=>getImpact(p).equityFlag).length;
  const switchCount=concerned.filter(p=>getImpact(p).switch).length;

  return(
    <div className="fade-up" style={{padding:"20px 24px",overflowY:"auto",height:"100%",maxWidth:1120}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Personas & équité</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>12 profils types · Impact tarifaire dynamique · Analyse d'équité sociale</p>
        </div>
        <div className="card" style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px"}}>
          <span style={{fontSize:11,color:C.inkM}}>Simuler à</span>
          <span className="mono" style={{fontSize:18,fontWeight:800,color:price<3?C.green:price>3?C.red:C.inkM}}>
            {price===0?"GRATUIT":`CHF ${price.toFixed(1)}/h`}
          </span>
          <input type="range" min={0} max={8} step={0.5} value={price} onChange={e=>setPrice(parseFloat(e.target.value))}
            style={{width:100,"--pct":`${price/8*100}%`,"--track-fill":C.red}}/>
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16}}>
        {[
          {v:equityCount,l:"Risques équité détectés",c:equityCount>0?C.red:C.green,bg:equityCount>0?C.redL:C.greenL,b:equityCount>0?C.redB:C.greenB},
          {v:switchCount,l:"Bascules modales probables",c:C.blue,bg:C.blueL,b:C.blueB},
          {v:PERSONAS.filter(p=>!getImpact(p).concerned).length,l:"Profils non concernés par tarif centre",c:C.inkM,bg:C.borderL,b:C.border},
          {v:PERSONAS.filter(p=>p.income==="faible").length,l:"Profils revenu modeste",c:C.amber,bg:C.amberL,b:C.amberB},
        ].map((k,i)=>(
          <div key={i} style={{flex:1,background:k.bg,borderRadius:10,border:`1.5px solid ${k.b}`,padding:"10px 12px"}}>
            <div className="mono" style={{fontSize:24,fontWeight:800,color:k.c}}>{k.v}</div>
            <div style={{fontSize:10,color:k.c,marginTop:4,lineHeight:1.4}}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {PERSONAS.map((p,i)=>{
          const imp=getImpact(p);
          const isSel=sel===p.id;
          const borderColor=imp.equityFlag?C.redB:!imp.concerned?"#E8E6E0":isSel?C.blueB:C.border;
          return(
            <div key={p.id} className="hover-lift" onClick={()=>setSel(isSel?null:p.id)}
              style={{background:C.white,borderRadius:10,border:`1.5px solid ${borderColor}`,padding:"12px 14px",cursor:"pointer",transition:"all .15s",opacity:!imp.concerned&&price!==3?0.65:1}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
                <span style={{fontSize:26}}>{p.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.ink,lineHeight:1.3}}>{p.label}</div>
                  <div style={{fontSize:9,color:C.inkL,marginTop:1,lineHeight:1.4}}>{p.desc}</div>
                </div>
                {imp.equityFlag&&<span title="Risque équité" style={{fontSize:16,flexShrink:0}}>⚠️</span>}
                {!imp.concerned&&<span title="Non concerné" style={{fontSize:14,flexShrink:0,opacity:.5}}>○</span>}
              </div>

              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                <Tag label={p.income==="faible"?"Revenu modeste":p.income==="élevé"?"Revenu élevé":"Revenu moyen"}
                  color={p.income==="faible"?C.red:p.income==="élevé"?C.green:C.amber}/>
                {imp.switch&&<Tag label="Bascule probable" color={C.blue} bg={C.blueL} border={C.blueB}/>}
                {!imp.concerned&&<Tag label="Non concerné" color={C.inkL} bg={C.borderL} border={C.border}/>}
              </div>

              {imp.concerned?(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:8}}>
                  <div style={{textAlign:"center",padding:"5px 3px",background:C.redL,borderRadius:6}}>
                    <div className="mono" style={{fontSize:11,fontWeight:700,color:C.red}}>{Math.round(p.carDep*100)}%</div>
                    <div style={{fontSize:7.5,color:C.inkL}}>dépen. voiture</div>
                  </div>
                  <div style={{textAlign:"center",padding:"5px 3px",background:C.blueL,borderRadius:6}}>
                    <div className="mono" style={{fontSize:11,fontWeight:700,color:C.blue}}>{Math.round(p.tpAff*100)}%</div>
                    <div style={{fontSize:7.5,color:C.inkL}}>affinité TP</div>
                  </div>
                  <div style={{textAlign:"center",padding:"5px 3px",background:imp.equityFlag?C.redL:imp.delta>0?C.amberL:C.greenL,borderRadius:6}}>
                    <div className="mono" style={{fontSize:11,fontWeight:700,color:imp.equityFlag?C.red:imp.delta>0?C.amber:C.green}}>
                      {imp.delta>0?"+":imp.delta<0?"-":""}{Math.abs(imp.delta).toFixed(2)} CHF
                    </div>
                    <div style={{fontSize:7.5,color:C.inkL}}>impact/visite</div>
                  </div>
                </div>
              ):(
                <div style={{padding:"7px 8px",background:C.borderL,borderRadius:7,marginBottom:8}}>
                  <div style={{fontSize:9,color:C.inkM,lineHeight:1.5}}>ℹ {imp.note}</div>
                </div>
              )}

              {isSel&&(
                <div className="fade-up" style={{borderTop:`1px solid ${C.borderL}`,paddingTop:8,marginTop:4}}>
                  {imp.concerned&&<div style={{fontSize:10,color:C.inkM,marginBottom:5}}>
                    <strong>Avant:</strong> CHF {imp.beforeCHF} &nbsp;→&nbsp; <strong>Après CHF {price.toFixed(1)}/h:</strong> CHF {imp.afterCHF}
                  </div>}
                  <div style={{fontSize:9,color:C.inkM,lineHeight:1.55,marginBottom:6}}>
                    {imp.equityFlag?"⚠️ Impact disproportionné sur revenu faible — taxibons, abonnements TP subventionnés, exemptions PMR":
                     imp.switch?"✅ Probabilité élevée de bascule modale — communiquer offre P+R + BS11":
                     !imp.concerned?"ℹ Ce profil n'est pas directement impacté par la tarification des parkings du centre-ville.":
                     p.carDep>0.88?"🔒 Très forte dépendance voiture — peu sensible au prix, risque de report sur rues gratuites":
                     "ℹ Impact modéré — adaptation progressive probable"}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
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
const PLAN=[
  {h:"0–3 mois",c:C.red,bg:C.redL,b:C.redB,
   actions:[
    {title:"Pilote offre combinée P+R + billet TP",pri:"haute",owner:"Service mobilité + CarPostal",
     desc:"Lancer offre: P+R Stade gratuit + billet 24h CarPostal CHF 3.– → CHF 5.– inclus TP. Mesurer la captation.",
     metrics:["Taux occupation P+R J+30","Fréquentation BS11 matin/soir","Nb offres combinées vendues"]},
    {title:"Signalétique dynamique d'occupation",pri:"haute",owner:"IT Ville + Service voirie",
     desc:"Déployer affichage temps réel places disponibles (Planta/Scex/Cible) sur 5 panneaux Route Cantonale et app sion.ch.",
     metrics:["Temps moyen recherche parking","Taux satisfaction usagers"]},
    {title:"Communication proactive sur les gratuités",pri:"moyenne",owner:"Service communication",
     desc:"Campagne info: rappel 1h gratuite, gratuité vendredi soir / dimanche / midi, P+R gratuits permanents.",
     metrics:["Réactions commerçants","Utilisation P+R avant/après"]},
  ]},
  {h:"3–12 mois",c:C.amber,bg:C.amberL,b:C.amberB,
   actions:[
    {title:"Renfort fréquence BS11 aux heures de pointe",pri:"haute",owner:"Service mobilité + CarPostal",
     desc:"Négocier passage BS11 à 7 min (7h–9h / 17h–19h). Condition sine qua non de l'efficacité des P+R.",
     metrics:["Temps d'attente moyen P+R","Montées/descentes BS11","Nb voyageurs P+R"]},
    {title:"Tarification progressive longue durée",pri:"moyenne",owner:"Service mobilité",
     desc:"Tester grille progressive: CHF 3/h (h2–h3), CHF 4/h (h3+). Dissuade les pendulaires tout-journée du centre.",
     metrics:["Durée de stationnement moyenne","Recettes","Occupation <11h vs >11h"]},
    {title:"OpenData occupation parkings (API)",pri:"moyenne",owner:"IT Ville",
     desc:"Publication API temps réel occupation → intégration Google Maps, Apple Plans, SBB app. Standard OGD-CH.",
     metrics:["Nb intégrations tierces","Requêtes API/jour"]},
  ]},
  {h:"12–36 mois",c:C.blue,bg:C.blueL,b:C.blueB,
   actions:[
    {title:"Plan de mobilité employeurs zone industrielle",pri:"haute",owner:"Service éco + mobilité",
     desc:"Partenariat top 10 employeurs Ronquoz/Aéroport (>4 000 emplois): covoiturage structuré, abonnements TP subventionnés, aménagement pistes cyclables.",
     metrics:["Part modale voiture zone ind.","Abonnements TP vendus","Km piste cyclable réalisés"]},
    {title:"Desserte hôpital — renfort lignes BS7/BS14",pri:"haute",owner:"Service mobilité + HVS",
     desc:"Améliorer la liaison Gare–Hôpital du Valais (Champsec). Fréquence actuelle insuffisante aux heures de visites.",
     metrics:["Temps Gare→Hôpital","Fréquentation lignes hôpital","NPS patients/visiteurs"]},
    {title:"Révision Plan directeur stationnement (PDS)",pri:"haute",owner:"Service urbanisme + mobilité",
     desc:"Actualiser PDS avec objectifs modaux 2030: −15% voitures solo centre, +20% TP, piétonisation partielle Grand-Pont.",
     metrics:["Part modale voiture","m² espace public récupéré","Recettes parking annuelles"]},
  ]},
];

function ActionsTab(){
  const [exp,setExp]=useState({});
  const priC={haute:{c:C.red,bg:C.redL,b:C.redB},moyenne:{c:C.amber,bg:C.amberL,b:C.amberB},basse:{c:C.green,bg:C.greenL,b:C.greenB}};
  const doExport=()=>{
    const md=PLAN.map(h=>`## ${h.h}\n\n${h.actions.map(a=>`### ${a.title}\n**Priorité:** ${a.pri} | **Responsable:** ${a.owner}\n\n${a.desc}\n\n**Métriques:** ${a.metrics.join(", ")}`).join("\n\n")}`).join("\n\n");
    const b=new Blob([`# Plan d'action mobilité — Ville de Sion\nGénéré le ${fmtToday()}\n\n${md}`],{type:"text/markdown"});
    const u=URL.createObjectURL(b);const a=document.createElement("a");
    a.href=u;a.download="plan-mobilite-sion.md";a.click();URL.revokeObjectURL(u);
  };
  return(
    <div className="fade-up" style={{padding:"20px 24px",overflowY:"auto",height:"100%",maxWidth:1000}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="syne" style={{fontSize:22,fontWeight:800,color:C.ink}}>Plan d'action mobilité</h1>
          <p style={{fontSize:12,color:C.inkL,marginTop:4}}>Feuille de route 0–36 mois · Ville de Sion · Service de mobilité</p>
        </div>
        <button onClick={doExport} style={{padding:"9px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,background:C.white,color:C.inkM,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter",display:"flex",alignItems:"center",gap:6}}>
          ↓ Exporter .md
        </button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {PLAN.map(horizon=>(
          <div key={horizon.h} className="card" style={{overflow:"hidden"}}>
            <div style={{padding:"12px 16px",background:horizon.bg,borderBottom:`1.5px solid ${horizon.b}`}}>
              <div className="syne" style={{fontSize:11,fontWeight:800,color:horizon.c,textTransform:"uppercase",letterSpacing:".06em"}}>{horizon.h}</div>
              <div style={{fontSize:10,color:horizon.c,opacity:.7,marginTop:2}}>{horizon.actions.length} actions prioritaires</div>
            </div>
            <div style={{padding:10}}>
              {horizon.actions.map((a,i)=>{
                const pc=priC[a.pri];const key=`${horizon.h}-${i}`;const isExp=exp[key];
                return(
                  <div key={key} style={{borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8,overflow:"hidden",cursor:"pointer"}} onClick={()=>setExp(e=>({...e,[key]:!e[key]}))}>
                    <div style={{padding:"10px 12px",background:isExp?C.borderL:C.white}}>
                      <Tag label={a.pri} color={pc.c} bg={pc.bg} border={pc.b}/>
                      <div style={{fontSize:12,fontWeight:700,color:C.ink,marginTop:6,lineHeight:1.35}}>{a.title}</div>
                      <div style={{fontSize:9,color:C.inkL,marginTop:3}}>👤 {a.owner}</div>
                    </div>
                    {isExp&&(
                      <div className="fade-up" style={{padding:"10px 12px",borderTop:`1px solid ${C.borderL}`}}>
                        <p style={{fontSize:11,color:C.inkM,lineHeight:1.6,marginBottom:8}}>{a.desc}</p>
                        <div className="syne" style={{fontSize:9,fontWeight:700,color:C.inkL,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>Métriques de suivi</div>
                        {a.metrics.map((m,mi)=>(
                          <div key={mi} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                            <div style={{width:4,height:4,borderRadius:"50%",background:horizon.c,flexShrink:0}}/>
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
      <div className="card" style={{marginTop:18,padding:"14px 18px"}}>
        <div className="syne" style={{fontSize:11,fontWeight:700,color:C.inkM,marginBottom:8}}>Conditions et prérequis</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,fontSize:11,color:C.inkM,lineHeight:1.7}}>
          <div>
            <strong>Ce plan est conditionnel à :</strong><br/>
            — Validation Conseil municipal (vision politique)<br/>
            — Concertation commerçants et riverains<br/>
            — Accord CarPostal pour renfort BS11<br/>
            — Budget IT pour signalétique dynamique
          </div>
          <div>
            <strong>Données prioritaires à collecter :</strong><br/>
            — Comptages OD voitures (entrées centre)<br/>
            — Capteurs occupation P+R (temps réel)<br/>
            — Durée réelle de stationnement par zone<br/>
            — Confirmation tarifs Cible, Nord, Roches-Brunes, Hôpital
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [tab,setTab]=useState("dashboard");
  const [sev,setSev]=useState("fluide");
  const [simDone,setSimDone]=useState(false);

  useEffect(()=>{
    const h=new Date().getHours();
    if((h>=7&&h<=9)||(h>=17&&h<=19)) setSev("dense");
    else if((h>=10&&h<=11)||(h>=14&&h<=16)) setSev("modéré");
    else setSev("fluide");
  },[]);

  const TABS={dashboard:<DashboardTab/>,simulator:<SimulatorTab/>,od:<ODTab/>,personas:<PersonasTab/>,actions:<ActionsTab/>};
  return(
    <>
      <GlobalStyles/>
      <div style={{display:"flex",height:"100vh",overflow:"hidden",background:C.bg}}>
        <Sidebar tab={tab} setTab={setTab} sev={sev} simDone={simDone}/>
        <main style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
          {TABS[tab]}
        </main>
      </div>
    </>
  );
}
