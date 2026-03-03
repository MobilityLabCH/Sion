import type {
  Scenario, SimulationResults, ZoneResult, PersonaResult,
  ModeSplit, ParkingData, TPData, Persona
} from './types';

// ─── Constantes moteur ──────────────────────────────────────────────────────
const SHORT_STAY_H = 1.0;
const LONG_STAY_H  = 3.5;

const CAR_KM_COST_CHF      = 0.18;   // TCS 2024, coût marginal hors amortissement
const CAR_FRICTION_MAX_CHF = 2.0;    // coût fixe recherche parking (frictionIndex × 2 CHF)
const TAD_BASE_FEE_CHF     = 2.50;
const TAD_PER_KM_CHF       = 0.35;
const TAXI_BASE_CHF        = 12.0;
const TAXI_PER_KM_CHF      = 2.80;
const TAXI_BON_VALUE_CHF   = 8.0;
const TRANSFER_PENALTY_CHF = 2.5;    // inconfort marche/attente (utilité)

/**
 * Température softmax : contrôle la « douceur » de la transition modale.
 * 0.6 = très sensible (winner-takes-all) → trop radical
 * 1.5 = réaliste : un écart de 5 CHF donne ~95%/5%, un écart de 2 CHF donne ~75%/25%
 */
const SOFTMAX_TEMPERATURE = 1.5;

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeCostCHF(minutes: number, valueOfTimeCHFh: number): number {
  return (minutes / 60) * valueOfTimeCHFh;
}

/** Softmax : coût élevé → probabilité faible */
export function softmax(costs: number[], temperature = SOFTMAX_TEMPERATURE): number[] {
  const utils = costs.map(c => -c / temperature);
  const maxU  = Math.max(...utils);
  const exps  = utils.map(u => Math.exp(u - maxU));
  const sum   = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Coût de stationnement selon le barème officiel Sion.
 *
 * Barème Planta/Scex (source: sion.ch PDFs 2024-2025) :
 *   - 1ère heure : GRATUITE
 *   - h2–h11    : CHF 3.00/h (= scenario.centrePeakPriceCHFh au baseline)
 *   - Au-delà   : CHF 0.20/h
 *   - Ven.17h → Sam.24h, dimanches : GRATUIT
 *   - P+R Potences/Stade : TOUJOURS GRATUIT
 *
 * Le scénario peut modifier le taux horaire (CHF/h) pour simuler des alternatives.
 * Le paramètre `progressiveSlopeFactor` ajoute une pénalité SUPPLÉMENTAIRE
 * sur la partie longue durée (>1h) au-delà du barème officiel.
 */
function effectiveParkingPrice(
  parking: ParkingData,
  scenario: Scenario,
  zoneId: string,
  timeWindow: 'peak' | 'offpeak',
  durationType: 'short' | 'long'
): number {
  const durationH = durationType === 'short' ? SHORT_STAY_H : LONG_STAY_H;

  // P+R et zones périphériques : gratuit ou tarif paramétré
  if (zoneId === 'peripherie') {
    const prRate = timeWindow === 'peak'
      ? scenario.peripheriePeakPriceCHFh
      : scenario.peripherieOffpeakPriceCHFh;
    return prRate * durationH;
  }

  // Taux horaire du scénario selon zone et fenêtre
  let ratePerH: number;
  if (zoneId === 'centre' || zoneId === 'gare') {
    ratePerH = timeWindow === 'peak'
      ? scenario.centrePeakPriceCHFh
      : scenario.centreOffpeakPriceCHFh;
  } else {
    // Autres zones : proportionnel au ratio scénario/baseline (3.0 CHF/h = réel Sion)
    const scenarioFactor = scenario.centrePeakPriceCHFh / 3.0;
    const zoneRate = parking.basePriceCHFh * scenarioFactor;
    ratePerH = timeWindow === 'peak'
      ? zoneRate * parking.peakMultiplier
      : zoneRate * parking.offpeakMultiplier;
  }

  // Gratuité 1ère heure (Planta/Scex/Cible)
  const hasFirstHourFree = zoneId === 'centre' || zoneId === 'gare';

  if (hasFirstHourFree) {
    if (durationType === 'short') return 0;   // 1h ≤ franchise gratuite → 0 CHF

    const billableH = durationH - 1.0;        // 3.5h → 2.5h facturées
    // progressiveSlopeFactor = majoration SUPPLÉMENTAIRE longue durée (>1.0 = scénario pénalisant)
    const slope     = Math.max(1.0, scenario.progressiveSlopeFactor);
    return Math.round(billableH * ratePerH * slope * 100) / 100;
  }

  // Zones sans franchise : linéaire + pente optionnelle
  const slope = durationType === 'long' && scenario.progressiveSlopeFactor > 1
    ? scenario.progressiveSlopeFactor : 1.0;
  return Math.round(durationH * ratePerH * slope * 100) / 100;
}

// ─── Calcul coût par mode ────────────────────────────────────────────────────

interface TripCosts {
  car: number;
  tp:  number;
  pr:  number;        // P+R (drive to periphery + bus to centre)
  covoiturage: number;
  tad:      number;
  taxiBons: number;
}

/**
 * Calcule les coûts effectifs de chaque mode pour un persona.
 *
 * CORRECTION CLÉS vs version précédente :
 * 1. `originTp` = données TP de la zone d'ORIGINE (fromZoneId), pas de destination.
 *    → Un commuter de la périphérie a un TP lent/rare, pas celui du centre-ville.
 * 2. Friction = frictionIndex × 2 CHF (coût fixe), pas VOT-dépendant.
 *    → Évite d'artificiellement pénaliser la voiture même quand le parking est vide.
 * 3. Mode P+R calculé explicitement : conduite jusqu'à P+R gratuit + BS11.
 */
export function computeTripCosts(
  persona: Persona,
  destParking: ParkingData,   // parking à destination (pour coût stationnement)
  destTp:      TPData,        // TP de la zone de destination (fallback)
  scenario:    Scenario,
  destZoneId:  string,
  originTp?:   TPData         // TP de la zone d'ORIGINE ← clé de la correction
): TripCosts {
  const { timeWindow, durationType } = persona.typicalTrip;
  const vot = persona.valueOfTimeCHFh;

  // TP de l'origine pour calculer le temps de trajet et le ticket
  const tp = originTp ?? destTp;

  // Distance estimée depuis l'accessIndex de l'origine
  const distanceKm = clamp((1 - tp.accessIndex) * 20 + 2, 1, 25);

  // ─── Voiture ─────────────────────────────────────────────────────────────
  const parkingCost = effectiveParkingPrice(destParking, scenario, destZoneId, timeWindow, durationType);
  const carTimeMin  = clamp(tp.timeToCenterMin * 0.8, 5, 45); // voiture ~20% plus rapide que TP
  const carTimeCost = timeCostCHF(carTimeMin, vot);
  const carFriction = destParking.frictionIndex * CAR_FRICTION_MAX_CHF; // coût fixe, pas VOT-dépendant
  const carKmCost   = distanceKm * CAR_KM_COST_CHF;
  const carTotal    = parkingCost + carTimeCost + carFriction + carKmCost;

  // ─── Transport public ─────────────────────────────────────────────────────
  const tpDiscountFactor = timeWindow === 'offpeak'
    ? 1 - Math.min(tp.offpeakDiscountMax, scenario.tpOffpeakDiscountPct / 100)
    : 1;
  const tpTicket       = tp.ticketBaseCHF * tpDiscountFactor;
  const tpFreqMin      = timeWindow === 'peak' ? tp.peakFreqMin : tp.offpeakFreqMin;
  const tpWaitMin      = tpFreqMin / 2;
  const tpTimeCost     = timeCostCHF(tp.timeToCenterMin + tpWaitMin, vot);
  const tpAccessPenalty = (1 - tp.accessIndex) * TRANSFER_PENALTY_CHF;
  const tpTotal        = tpTicket + tpTimeCost + tpAccessPenalty;

  // ─── P+R (Potences ou Stade, gratuit + BS 11) ────────────────────────────
  // Modélisé explicitement : conduite jusqu'au P+R (demi-distance) + bus 12 min
  const prParkingCost  = scenario.peripheriePeakPriceCHFh; // généralement 0
  const prBusFare      = 2.20; // zone 1 isireso (BS11 urbain)
  const prDriveMin     = clamp(tp.timeToCenterMin * 0.4, 3, 15); // demi-trajet en voiture
  const prBusMin       = 12; // BS 11 Potences/Stade → centre, officiel
  const prWaitMin      = timeWindow === 'peak' ? 5 : 10; // BS 11 toutes les 10 min pointe
  const prTimeCost     = timeCostCHF(prDriveMin + prBusMin + prWaitMin, vot);
  const prKmCost       = (distanceKm * 0.4) * CAR_KM_COST_CHF; // demi-distance
  const prTotal        = prParkingCost + prBusFare + prTimeCost + prKmCost;

  // ─── Covoiturage ──────────────────────────────────────────────────────────
  let covoiturageTotal = Infinity;
  if (scenario.enableCovoiturage) {
    const matchPotential = clamp(1 - persona.scheduleRigidity * 0.7, 0.1, 0.9);
    if (matchPotential > 0.3) {
      const inconveniencePenalty = persona.scheduleRigidity * vot * 0.5 * (30 / 60);
      covoiturageTotal = carTotal * 0.55 + inconveniencePenalty;
    }
  }

  // ─── TAD ─────────────────────────────────────────────────────────────────
  let tadTotal = Infinity;
  if (scenario.enableTAD) {
    const tadCost    = TAD_BASE_FEE_CHF + distanceKm * TAD_PER_KM_CHF;
    tadTotal = tadCost + timeCostCHF(tp.timeToCenterMin * 1.2, vot);
  }

  // ─── Taxi-bons ────────────────────────────────────────────────────────────
  let taxiBonsTotal = Infinity;
  const taxiBonsEligible = persona.tags.some(t =>
    ['horaires atypiques', 'senior', 'mobilité réduite', 'décalé', 'urgent'].includes(t)
  );
  if (scenario.enableTaxiBons && taxiBonsEligible) {
    const taxiCost = TAXI_BASE_CHF + distanceKm * TAXI_PER_KM_CHF;
    taxiBonsTotal  = taxiCost - TAXI_BON_VALUE_CHF + timeCostCHF(carTimeMin * 1.1, vot);
  }

  return { car: carTotal, tp: tpTotal, pr: prTotal, covoiturage: covoiturageTotal, tad: tadTotal, taxiBons: taxiBonsTotal };
}

// ─── Mode split (softmax avec préférences attitudinales) ─────────────────────
//
// CORRECTION : carDependency ↑ → coût PERÇU voiture ↓ (persona préfère voiture)
//              Formule précédente était INVERSÉE (carDep élevé augmentait le coût perçu)
//
// Principe : les préférences modale sont des « remises attitudinales » sur le coût perçu.
//   carDep=0.75 → voiture perçue à 85% de son coût réel (inertie, habitude, confort)
//   tpAffinity=0.9 → TP perçu à 75% de son coût réel (étudiant convaincu TP)

export function computeModeSplit(costs: TripCosts, persona: Persona): ModeSplit {
  // CORRIGÉ : signe correct → carDep élevé = coût voiture perçu BAS
  const carAdjusted  = costs.car * (1.3 - persona.carDependency * 0.6);
  // tpAffinity élevée = coût TP perçu BAS
  const tpAdjusted   = costs.tp  * (1.2 - persona.tpAffinity    * 0.5);
  // P+R : attractif pour persona avec moyen carDependency, accès P+R ok
  const prAdjusted   = costs.pr  * (1.1 - persona.tpAffinity    * 0.3);
  const covoiAdjusted = costs.covoiturage;
  const tadAdjusted   = costs.tad;
  const taxiAdjusted  = costs.taxiBons;

  const probs = softmax([carAdjusted, tpAdjusted, prAdjusted, covoiAdjusted, tadAdjusted, taxiAdjusted]);

  // Fusionner P+R dans la part TP (P+R est un mode TP)
  return {
    car:         probs[0],
    tp:          probs[1] + probs[2],  // TP direct + P+R
    covoiturage: probs[3],
    tad:         probs[4],
    taxiBons:    probs[5],
  };
}

// ─── Baseline : situation RÉELLE actuelle de Sion ────────────────────────────
//
// Source officielle : sion.ch PDFs Planta (15.07.2024) + Scex (11.08.2025)
//   - Centre (Planta/Scex/Cible) : 1h gratuite puis CHF 3.00/h (h2→h11)
//   - P+R Potences (450 pl.) + Stade (460 pl.) : GRATUIT
//   - Bus Sédunois BS 11 : GRATUIT ven.17h → sam.24h

function buildBaselineScenario(): Scenario {
  return {
    centrePeakPriceCHFh:        3.0,  // CHF 3.00/h officiel Planta/Scex (après 1h gratuite)
    centreOffpeakPriceCHFh:     3.0,  // idem — Sion n'a pas de tarif creux distinct
    peripheriePeakPriceCHFh:    0.0,  // P+R gratuit
    peripherieOffpeakPriceCHFh: 0.0,
    progressiveSlopeFactor:     1.0,
    tpOffpeakDiscountPct:       0,
    enableCovoiturage: false,
    enableTAD:         false,
    enableTaxiBons:    false,
    objective: 'reduce-peak-car',
  };
}

// ─── Moteur principal ────────────────────────────────────────────────────────

export function runSimulation(
  scenario: Scenario,
  parkingData: ParkingData[],
  tpData:      TPData[],
  personas:    Persona[]
): SimulationResults {
  const baseline    = buildBaselineScenario();
  const scenarioId  = `sim_${Date.now()}`;
  const timestamp   = new Date().toISOString();

  const parkingMap  = new Map(parkingData.map(p => [p.zoneId, p]));
  const tpMap       = new Map(tpData.map(t => [t.zoneId, t]));

  const zoneLabels: Record<string, string> = {
    centre:     'Centre-ville',
    gare:       'Gare CFF',
    est:        'Est (Bramois/Vissigen)',
    ouest:      'Ouest (Châteauneuf)',
    nord:       'Nord (Savièse/Grimisuat)',
    sud:        'Sud (Aproz/Nendaz)',
    emploi:     'Zone Emploi',
    peripherie: 'Périphérie / P+R',
  };

  // ─── Résultats par zone ───────────────────────────────────────────────────
  const zoneResults: ZoneResult[] = [];

  for (const [zoneId, parking] of parkingMap) {
    const destTp = tpMap.get(zoneId);
    if (!destTp) continue;

    // Personas dont le DESTINATION est cette zone
    const zonePersonas = personas.filter(p => p.typicalTrip.toZoneId === zoneId);
    if (zonePersonas.length === 0) continue;

    let totalCarBefore = 0;
    let totalCarAfter  = 0;
    let equityFlag     = false;
    const equityReasons: string[] = [];

    for (const persona of zonePersonas) {
      // ← CORRECTION BUG 1: utiliser TP de la zone d'ORIGINE pour les calculs
      const originTp = tpMap.get(persona.typicalTrip.fromZoneId) ?? destTp;

      const baselineCosts = computeTripCosts(persona, parking, destTp, baseline,  zoneId, originTp);
      const scenarioCosts = computeTripCosts(persona, parking, destTp, scenario,  zoneId, originTp);
      const beforeSplit   = computeModeSplit(baselineCosts,  persona);
      const afterSplit    = computeModeSplit(scenarioCosts,  persona);

      totalCarBefore += beforeSplit.car;
      totalCarAfter  += afterSplit.car;

      const costsIncreased  = scenarioCosts.car > baselineCosts.car * 1.2;
      const hasAlternatives = scenarioCosts.tp  < scenarioCosts.car * 1.3
        || scenarioCosts.covoiturage < Infinity
        || scenarioCosts.tad         < Infinity;

      if (costsIncreased && !hasAlternatives && persona.income === 'faible') {
        equityFlag = true;
        equityReasons.push(persona.label);
      }
    }

    const avgCarBefore  = totalCarBefore / zonePersonas.length;
    const avgCarAfter   = totalCarAfter  / zonePersonas.length;
    const shiftIndex    = clamp(
      (avgCarBefore - avgCarAfter) / Math.max(avgCarBefore, 0.01),
      0, 1
    );

    // Score élasticité composite
    const accessBonus      = destTp.accessIndex * 30;
    const baselineRate     = 3.0;
    const priceDelta       = Math.max(0, scenario.centrePeakPriceCHFh - baselineRate);
    const priceSignal      = Math.min(priceDelta * 8, 30);
    const alternativesBonus = (scenario.enableCovoiturage ? 10 : 0)
      + (scenario.enableTAD ? 8 : 0) + (scenario.enableTaxiBons ? 5 : 0);
    const elasticityScore  = clamp(
      Math.round(shiftIndex * 60 + accessBonus * 0.4 + priceSignal * 0.3 + alternativesBonus),
      0, 100
    );

    const category: 'vert' | 'orange' | 'rouge' =
      elasticityScore >= 60 ? 'vert' : elasticityScore >= 35 ? 'orange' : 'rouge';

    // Seuil de bascule estimé : prix auquel TP + P+R devient compétitif
    const estimatedThreshold = (zoneId === 'centre' || zoneId === 'gare')
      ? clamp(destTp.ticketBaseCHF + destTp.timeToCenterMin * 0.05 + 1.0, 2.5, 8)
      : undefined;

    // Mode split agrégé (scénario)
    const avgSplit = zonePersonas.reduce((acc, persona) => {
      const originTp = tpMap.get(persona.typicalTrip.fromZoneId) ?? destTp;
      const costs    = computeTripCosts(persona, parking, destTp, scenario, zoneId, originTp);
      const split    = computeModeSplit(costs, persona);
      const n        = zonePersonas.length;
      return {
        car:         acc.car         + split.car         / n,
        tp:          acc.tp          + split.tp          / n,
        covoiturage: acc.covoiturage + split.covoiturage / n,
        tad:         acc.tad         + split.tad         / n,
        taxiBons:    acc.taxiBons    + split.taxiBons    / n,
      };
    }, { car: 0, tp: 0, covoiturage: 0, tad: 0, taxiBons: 0 });

    // Occupation estimée (proportionnelle à la part voiture)
    const avgParkingCostCHF = effectiveParkingPrice(parking, scenario, zoneId, 'peak', 'long');
    const occupancyPct      = clamp(avgCarAfter * (parking.longStayShare + 0.3), 0, 1);

    zoneResults.push({
      zoneId, label: zoneLabels[zoneId] || zoneId,
      elasticityScore, category, shiftIndex, estimatedThreshold,
      equityFlag,
      equityReason: equityReasons.length > 0
        ? `Personas à risque: ${equityReasons.join(', ')}` : undefined,
      modeSplit: avgSplit,
      occupancyPct,
      avgParkingCostCHF,
    });
  }

  // ─── Résultats par persona ────────────────────────────────────────────────
  const personaResults: PersonaResult[] = personas.map(persona => {
    const destZoneId = persona.typicalTrip.toZoneId;
    const parking    = parkingMap.get(destZoneId) || parkingMap.get('centre')!;
    const destTp     = tpMap.get(destZoneId)      || tpMap.get('centre')!;
    const originTp   = tpMap.get(persona.typicalTrip.fromZoneId) ?? destTp;

    const baselineCosts = computeTripCosts(persona, parking, destTp, baseline,  destZoneId, originTp);
    const scenarioCosts = computeTripCosts(persona, parking, destTp, scenario,  destZoneId, originTp);
    const beforeSplit   = computeModeSplit(baselineCosts, persona);
    const afterSplit    = computeModeSplit(scenarioCosts, persona);

    const modeNames = ['Voiture', 'TP / P+R', 'Covoiturage', 'TAD', 'Taxi-bons'];
    const beforeArr  = [beforeSplit.car, beforeSplit.tp, beforeSplit.covoiturage, beforeSplit.tad, beforeSplit.taxiBons];
    const afterArr   = [afterSplit.car,  afterSplit.tp,  afterSplit.covoiturage,  afterSplit.tad,  afterSplit.taxiBons];
    const beforeIdx  = beforeArr.indexOf(Math.max(...beforeArr));
    const afterIdx   = afterArr.indexOf(Math.max(...afterArr));

    // Coût du mode préféré avant/après
    const costArr_before = [baselineCosts.car, baselineCosts.tp, baselineCosts.covoiturage, baselineCosts.tad, baselineCosts.taxiBons];
    const costArr_after  = [scenarioCosts.car, scenarioCosts.tp, scenarioCosts.covoiturage, scenarioCosts.tad, scenarioCosts.taxiBons];
    const beforeCost = costArr_before[beforeIdx];
    const afterCostRaw = costArr_after[afterIdx];
    const afterCost  = afterCostRaw === Infinity ? scenarioCosts.car : afterCostRaw;

    const equityFlag = persona.income === 'faible' && afterCost > beforeCost * 1.15;
    const delta      = afterCost - beforeCost;

    const explanation: string[] = [];
    if (Math.abs(delta) < 0.5) {
      explanation.push('Impact neutre : coût total quasi-identique à la situation actuelle.');
    } else if (delta > 0) {
      explanation.push(`Hausse : +${delta.toFixed(1)} CHF/trajet vs. situation actuelle (Planta/Scex 3 CHF/h, 1h gratuite).`);
    } else {
      explanation.push(`Économie : ${Math.abs(delta).toFixed(1)} CHF/trajet vs. situation actuelle.`);
    }

    if (modeNames[beforeIdx] !== modeNames[afterIdx]) {
      explanation.push(`Bascule probable : ${modeNames[beforeIdx]} → ${modeNames[afterIdx]}.`);
    } else {
      explanation.push(`Mode stable : ${modeNames[afterIdx]} reste dominant pour ce profil.`);
    }

    if (equityFlag) {
      explanation.push('⚠ Risque équité : revenu faible + hausse sans alternative accessible.');
    } else if (persona.alternatives.length > 0 && afterIdx > 0) {
      explanation.push(`Alternative : ${persona.alternatives[0].toUpperCase()} est crédible pour ce profil.`);
    }

    return {
      personaId: persona.id, label: persona.label, emoji: persona.emoji,
      beforeCostCHF: Math.round(beforeCost * 10) / 10,
      afterCostCHF:  Math.round(afterCost  * 10) / 10,
      costDeltaCHF:  Math.round(delta       * 10) / 10,
      preferredModeBefore: modeNames[beforeIdx],
      preferredMode:       modeNames[afterIdx],
      equityFlag, tags: persona.tags, explanation,
    };
  });

  // ─── Agrégats ─────────────────────────────────────────────────────────────
  const equityFlags = personaResults
    .filter(p => p.equityFlag)
    .map(p => `${p.emoji} ${p.label}`);

  const globalShiftIndex = zoneResults.length > 0
    ? zoneResults.reduce((s, z) => s + z.shiftIndex, 0) / zoneResults.length
    : 0;

  const hypotheses = [
    'Baseline = situation RÉELLE Sion 2025 : 1h gratuite + CHF 3.00/h (Planta/Scex · sion.ch PDFs 2024-2025).',
    'P+R Potences (450 pl.) + Stade (460 pl.) : gratuits · BS 11 toutes les 10 min en pointe.',
    'isireso-sion : zone 1 CHF 2.20 · zone 2 CHF 3.20 · zone 3 CHF 4.20 · zone 4 CHF 5.20.',
    'Coût TP calculé depuis la zone d\'ORIGINE (pas de destination) — réflète le vrai accès TP.',
    'Mode P+R modélisé explicitement : conduite jusqu\'au P+R + BS 11 (12 min) + billet zone 1.',
    'Softmax T=1.5 : Δ5 CHF → ~95% vs 5% · Δ2 CHF → ~75% vs 25% (réaliste).',
    'Voiture dépendance = remise attitudinale sur coût perçu (habitude, confort, flexibilité).',
    'Friction parking = coût fixe (frictionIndex × 2 CHF) · indépendant du VOT.',
    'Résultats = ordre de grandeur · calibration sur enquête ménages recommandée.',
  ];

  const greenZones = zoneResults.filter(z => z.category === 'vert').length;
  const summary    =
    `Scénario simulé : ${zoneResults.length} zones. ` +
    `${greenZones} zone(s) à fort potentiel de bascule (Vert). ` +
    `Shift global estimé : ${(globalShiftIndex * 100).toFixed(0)}%. ` +
    (equityFlags.length > 0
      ? `${equityFlags.length} profil(s) à risque équité.`
      : 'Aucun risque équité majeur.');

  return {
    scenarioId, timestamp, globalShiftIndex,
    zoneResults, personaResults, equityFlags, hypotheses, summary,
  };
}
