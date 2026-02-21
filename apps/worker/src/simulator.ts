import type {
  Scenario, SimulationResults, ZoneResult, PersonaResult,
  ModeSplit, ParkingData, TPData, Persona
} from './types.js';

// ─── Constantes moteur ──────────────────────────────────────────────────────
const SHORT_STAY_H = 1.0;
const LONG_STAY_H = 3.5;
const CAR_KM_COST_CHF = 0.18; // coût kilométrique marginal (hors temps)
const TAD_BASE_FEE_CHF = 2.5;
const TAD_PER_KM_CHF = 0.35;
const TAXI_BASE_CHF = 12.0;
const TAXI_PER_KM_CHF = 2.8;
const TAXI_BON_VALUE_CHF = 8.0;
const TRANSFER_PENALTY_CHF = 2.5; // inconfort transfert
const SOFTMAX_TEMPERATURE = 0.6;  // sensibilité au coût

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeCostCHF(minutes: number, valueOfTimeCHFh: number): number {
  return (minutes / 60) * valueOfTimeCHFh;
}

/** Softmax sur un vecteur de coûts négatifs (coût élevé = prob basse) */
export function softmax(costs: number[], temperature = SOFTMAX_TEMPERATURE): number[] {
  // Convertir coûts en utilités négatives
  const utils = costs.map(c => -c / temperature);
  const maxU = Math.max(...utils);
  const exps = utils.map(u => Math.exp(u - maxU));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function effectiveParkingPrice(
  parking: ParkingData,
  scenario: Scenario,
  zoneId: string,
  timeWindow: 'peak' | 'offpeak',
  durationType: 'short' | 'long'
): number {
  const durationH = durationType === 'short' ? SHORT_STAY_H : LONG_STAY_H;

  // Prix de base selon scénario
  let basePrice: number;
  if (zoneId === 'centre' || zoneId === 'gare') {
    basePrice = timeWindow === 'peak' ? scenario.centrePeakPriceCHFh : scenario.centreOffpeakPriceCHFh;
  } else if (zoneId === 'peripherie') {
    basePrice = timeWindow === 'peak' ? scenario.peripheriePeakPriceCHFh : scenario.peripherieOffpeakPriceCHFh;
  } else {
    // Autres zones: interpolation basée sur le prix de base + multiplicateur scénario
    const scenarioFactor = (scenario.centrePeakPriceCHFh / 2.5) * (timeWindow === 'peak' ? parking.peakMultiplier : parking.offpeakMultiplier);
    basePrice = parking.basePriceCHFh * scenarioFactor;
  }

  // Prix progressif: majoration après 1ère heure
  if (scenario.progressiveSlopeFactor > 1 && durationType === 'long') {
    const firstH = basePrice * 1;
    const remainH = (durationH - 1) * basePrice * scenario.progressiveSlopeFactor;
    return firstH + remainH;
  }

  return basePrice * durationH;
}

// ─── Calcul coût par mode pour un persona dans une zone ────────────────────

interface TripCosts {
  car: number;
  tp: number;
  covoiturage: number;
  tad: number;
  taxiBons: number;
}

export function computeTripCosts(
  persona: Persona,
  parking: ParkingData,
  tp: TPData,
  scenario: Scenario,
  zoneId: string
): TripCosts {
  const { timeWindow, durationType } = persona.typicalTrip;
  const vot = persona.valueOfTimeCHFh;
  const durationH = durationType === 'short' ? SHORT_STAY_H : LONG_STAY_H;

  // Estimation distance (approximation depuis accessIndex)
  const distanceKm = clamp((1 - tp.accessIndex) * 20 + 2, 1, 25);

  // ─── Voiture ───
  const parkingCost = effectiveParkingPrice(parking, scenario, zoneId, timeWindow, durationType);
  const carTimeMin = clamp(tp.timeToCenterMin * 0.8, 5, 45); // voiture ~ 80% du temps TP (fluidité)
  const carTimeCost = timeCostCHF(carTimeMin, vot);
  const carFrictionPenalty = parking.frictionIndex * vot * 0.3; // pénalité recherche parking
  const carKmCost = distanceKm * CAR_KM_COST_CHF;
  const carTotal = parkingCost + carTimeCost + carFrictionPenalty + carKmCost;

  // ─── TP ───
  const tpDiscountFactor = timeWindow === 'offpeak'
    ? 1 - Math.min(tp.offpeakDiscountMax, scenario.tpOffpeakDiscountPct / 100)
    : 1;
  const tpTicketCost = tp.ticketBaseCHF * tpDiscountFactor;
  const tpFreqMin = timeWindow === 'peak' ? tp.peakFreqMin : tp.offpeakFreqMin;
  const tpWaitMin = tpFreqMin / 2; // attente moyenne
  const tpTotalTimeMin = tp.timeToCenterMin + tpWaitMin;
  const tpTimeCost = timeCostCHF(tpTotalTimeMin, vot);
  // Pénalité transfert/marche si accessIndex bas
  const tpAccessPenalty = (1 - tp.accessIndex) * TRANSFER_PENALTY_CHF;
  const tpTotal = tpTicketCost + tpTimeCost + tpAccessPenalty;

  // ─── Covoiturage ───
  let covoiturageTotal = Infinity;
  if (scenario.enableCovoiturage) {
    const matchingPotential = clamp(1 - persona.scheduleRigidity * 0.7, 0.1, 0.9);
    if (matchingPotential > 0.3) {
      const inconveniencePenalty = persona.scheduleRigidity * vot * 0.5 * (30 / 60);
      covoiturageTotal = carTotal * 0.6 + inconveniencePenalty;
    }
  }

  // ─── TAD (Transport à la Demande) ───
  let tadTotal = Infinity;
  if (scenario.enableTAD) {
    const tadCost = TAD_BASE_FEE_CHF + distanceKm * TAD_PER_KM_CHF;
    const tadTimeMin = tp.timeToCenterMin * 1.2; // léger détour
    const tadTimeCost = timeCostCHF(tadTimeMin, vot);
    tadTotal = tadCost + tadTimeCost;
  }

  // ─── Taxi-bons ───
  let taxiBonsTotal = Infinity;
  const isTaxiBonsEligible = persona.tags.some(t =>
    ['horaires atypiques', 'senior', 'mobilité réduite', 'décalé', 'urgent'].includes(t)
  );
  if (scenario.enableTaxiBons && isTaxiBonsEligible) {
    const taxiCost = TAXI_BASE_CHF + distanceKm * TAXI_PER_KM_CHF;
    const taxiTimeCost = timeCostCHF(carTimeMin * 1.1, vot);
    taxiBonsTotal = taxiCost - TAXI_BON_VALUE_CHF + taxiTimeCost;
  }

  return {
    car: carTotal,
    tp: tpTotal,
    covoiturage: covoiturageTotal,
    tad: tadTotal,
    taxiBons: taxiBonsTotal,
  };
}

// ─── Calcul mode split (softmax) ────────────────────────────────────────────

export function computeModeSplit(
  costs: TripCosts,
  persona: Persona
): ModeSplit {
  // Intégrer préférences persona via ajustement de coût effectif
  const carAdjusted = costs.car * (0.7 + persona.carDependency * 0.6);
  const tpAdjusted = costs.tp * (1.2 - persona.tpAffinity * 0.5);
  const covoiAdjusted = costs.covoiturage;
  const tadAdjusted = costs.tad;
  const taxiAdjusted = costs.taxiBons;

  const rawCosts = [carAdjusted, tpAdjusted, covoiAdjusted, tadAdjusted, taxiAdjusted];
  const probs = softmax(rawCosts);

  return {
    car: probs[0],
    tp: probs[1],
    covoiturage: probs[2],
    tad: probs[3],
    taxiBons: probs[4],
  };
}

// ─── Calcul baseline (sans modifications scénario) ──────────────────────────

function buildBaselineScenario(): Scenario {
  return {
    centrePeakPriceCHFh: 2.5,
    centreOffpeakPriceCHFh: 1.5,
    peripheriePeakPriceCHFh: 0.0,
    peripherieOffpeakPriceCHFh: 0.0,
    progressiveSlopeFactor: 1.0,
    tpOffpeakDiscountPct: 0,
    enableCovoiturage: false,
    enableTAD: false,
    enableTaxiBons: false,
    objective: 'reduce-peak-car',
  };
}

// ─── Moteur principal ────────────────────────────────────────────────────────

export function runSimulation(
  scenario: Scenario,
  parkingData: ParkingData[],
  tpData: TPData[],
  personas: Persona[]
): SimulationResults {
  const baseline = buildBaselineScenario();
  const scenarioId = `sim_${Date.now()}`;
  const timestamp = new Date().toISOString();

  const parkingMap = new Map(parkingData.map(p => [p.zoneId, p]));
  const tpMap = new Map(tpData.map(t => [t.zoneId, t]));

  // ─── Résultats par zone ───
  const zoneIds = [...parkingMap.keys()];
  const zoneResults: ZoneResult[] = [];

  // Zone labels
  const zoneLabels: Record<string, string> = {
    centre: 'Centre-ville', gare: 'Gare', est: 'Est', ouest: 'Ouest',
    nord: 'Nord', sud: 'Sud', emploi: 'Zone Emploi', peripherie: 'Périphérie'
  };

  for (const zoneId of zoneIds) {
    const parking = parkingMap.get(zoneId)!;
    const tp = tpMap.get(zoneId);
    if (!tp) continue;

    // Agréger résultats personas dans cette zone
    const zonePersonas = personas.filter(p =>
      p.typicalTrip.toZoneId === zoneId || p.typicalTrip.fromZoneId === zoneId
    );

    if (zonePersonas.length === 0) continue;

    let totalCarShareBefore = 0;
    let totalCarShareAfter = 0;
    let equityFlag = false;
    const equityReasons: string[] = [];

    for (const persona of zonePersonas) {
      const baselineCosts = computeTripCosts(persona, parking, tp, baseline, zoneId);
      const scenarioCosts = computeTripCosts(persona, parking, tp, scenario, zoneId);

      const beforeSplit = computeModeSplit(baselineCosts, persona);
      const afterSplit = computeModeSplit(scenarioCosts, persona);

      totalCarShareBefore += beforeSplit.car;
      totalCarShareAfter += afterSplit.car;

      // Détection équité: coût voiture monte fortement + peu d'alternatives
      const costsIncreased = scenarioCosts.car > baselineCosts.car * 1.2;
      const hasAlternatives = scenarioCosts.tp < scenarioCosts.car * 1.3 ||
        scenarioCosts.covoiturage < Infinity || scenarioCosts.tad < Infinity;

      if (costsIncreased && !hasAlternatives && persona.income === 'faible') {
        equityFlag = true;
        equityReasons.push(persona.label);
      }
    }

    const avgCarBefore = totalCarShareBefore / zonePersonas.length;
    const avgCarAfter = totalCarShareAfter / zonePersonas.length;
    const shiftIndex = clamp((avgCarBefore - avgCarAfter) / Math.max(avgCarBefore, 0.01), 0, 1);

    // Score d'élasticité: capacité de la zone à voir une bascule modale
    const accessBonus = tp.accessIndex * 30;
    const priceSignal = Math.min((scenario.centrePeakPriceCHFh - baseline.centrePeakPriceCHFh) * 8, 30);
    const alternativesBonus = (scenario.enableCovoiturage ? 10 : 0) +
      (scenario.enableTAD ? 8 : 0) + (scenario.enableTaxiBons ? 5 : 0);
    const elasticityScore = clamp(Math.round(shiftIndex * 60 + accessBonus * 0.4 + priceSignal * 0.3 + alternativesBonus), 0, 100);

    let category: 'vert' | 'orange' | 'rouge';
    if (elasticityScore >= 60) category = 'vert';
    else if (elasticityScore >= 35) category = 'orange';
    else category = 'rouge';

    // Seuil de bascule estimé
    const estimatedThreshold = zoneId === 'centre'
      ? clamp(parking.basePriceCHFh * (1 + (1 - tp.accessIndex)), 2, 8)
      : undefined;

    // Mode split moyen agrégé
    const avgSplit = zonePersonas.reduce((acc, persona) => {
      const costs = computeTripCosts(persona, parking, tp, scenario, zoneId);
      const split = computeModeSplit(costs, persona);
      return {
        car: acc.car + split.car / zonePersonas.length,
        tp: acc.tp + split.tp / zonePersonas.length,
        covoiturage: acc.covoiturage + split.covoiturage / zonePersonas.length,
        tad: acc.tad + split.tad / zonePersonas.length,
        taxiBons: acc.taxiBons + split.taxiBons / zonePersonas.length,
      };
    }, { car: 0, tp: 0, covoiturage: 0, tad: 0, taxiBons: 0 });

    zoneResults.push({
      zoneId,
      label: zoneLabels[zoneId] || zoneId,
      elasticityScore,
      category,
      shiftIndex,
      estimatedThreshold,
      equityFlag,
      equityReason: equityReasons.length > 0 ? `Personas à risque: ${equityReasons.join(', ')}` : undefined,
      modeSplit: avgSplit,
    });
  }

  // ─── Résultats par persona ───
  const personaResults: PersonaResult[] = personas.map(persona => {
    const zoneId = persona.typicalTrip.toZoneId;
    const parking = parkingMap.get(zoneId) || parkingMap.get('centre')!;
    const tp = tpMap.get(zoneId) || tpMap.get('centre')!;

    const baselineCosts = computeTripCosts(persona, parking, tp, baseline, zoneId);
    const scenarioCosts = computeTripCosts(persona, parking, tp, scenario, zoneId);

    const beforeSplit = computeModeSplit(baselineCosts, persona);
    const afterSplit = computeModeSplit(scenarioCosts, persona);

    const modeNames = ['Voiture', 'TP', 'Covoiturage', 'TAD', 'Taxi-bons'];
    const beforeIdx = [beforeSplit.car, beforeSplit.tp, beforeSplit.covoiturage, beforeSplit.tad, beforeSplit.taxiBons].indexOf(
      Math.max(beforeSplit.car, beforeSplit.tp, beforeSplit.covoiturage, beforeSplit.tad, beforeSplit.taxiBons)
    );
    const afterIdx = [afterSplit.car, afterSplit.tp, afterSplit.covoiturage, afterSplit.tad, afterSplit.taxiBons].indexOf(
      Math.max(afterSplit.car, afterSplit.tp, afterSplit.covoiturage, afterSplit.tad, afterSplit.taxiBons)
    );

    const beforeCost = [baselineCosts.car, baselineCosts.tp, baselineCosts.covoiturage, baselineCosts.tad, baselineCosts.taxiBons][beforeIdx];
    const afterCostRaw = [scenarioCosts.car, scenarioCosts.tp, scenarioCosts.covoiturage, scenarioCosts.tad, scenarioCosts.taxiBons][afterIdx];
    const afterCost = afterCostRaw === Infinity ? scenarioCosts.car : afterCostRaw;

    const equityFlag = persona.income === 'faible' && afterCost > beforeCost * 1.15;

    // Bullets d'explication
    const delta = afterCost - beforeCost;
    const explanation: string[] = [];

    if (Math.abs(delta) < 0.5) {
      explanation.push('Impact coût neutre: le scénario ne modifie pas significativement le coût total pour ce profil.');
    } else if (delta > 0) {
      explanation.push(`Hausse estimée: +${delta.toFixed(1)} CHF/trajet par rapport à la situation actuelle.`);
    } else {
      explanation.push(`Économie estimée: ${delta.toFixed(1)} CHF/trajet par rapport à la situation actuelle.`);
    }

    if (modeNames[beforeIdx] !== modeNames[afterIdx]) {
      explanation.push(`Bascule modale probable: ${modeNames[beforeIdx]} → ${modeNames[afterIdx]} selon les paramètres du scénario.`);
    } else {
      explanation.push(`Mode préférentiel stable: ${modeNames[afterIdx]} reste l'option dominante.`);
    }

    if (equityFlag) {
      explanation.push('⚠ Risque équité: revenu faible + hausse de coût sans alternative accessible. Mesures compensatoires recommandées.');
    } else if (persona.alternatives.length > 0 && afterIdx > 0) {
      explanation.push(`Alternative activable: ${persona.alternatives[0].toUpperCase()} constitue une option crédible pour ce profil.`);
    }

    return {
      personaId: persona.id,
      label: persona.label,
      emoji: persona.emoji,
      beforeCostCHF: Math.round(beforeCost * 10) / 10,
      afterCostCHF: Math.round(afterCost * 10) / 10,
      costDeltaCHF: Math.round(delta * 10) / 10,
      preferredModeBefore: modeNames[beforeIdx],
      preferredMode: modeNames[afterIdx],
      equityFlag,
      tags: persona.tags,
      explanation,
    };
  });

  // ─── Agrégats globaux ────
  const equityFlags = personaResults
    .filter(p => p.equityFlag)
    .map(p => `${p.emoji} ${p.label}`);

  const globalShiftIndex = zoneResults.length > 0
    ? zoneResults.reduce((s, z) => s + z.shiftIndex, 0) / zoneResults.length
    : 0;

  const hypotheses = [
    'Durée de stationnement courte = 1h, longue = 3.5h (proxy moyenne).',
    'Coût kilométrique auto marginal = 0.18 CHF/km (hors amortissement).',
    'Softmax température 0.6 – sensibilité modérée au différentiel de coût.',
    'Covoiturage activable si rigidité horaire < 0.85 et matching > 0.3.',
    'TAD: base 2.50 CHF + 0.35 CHF/km, temps +20% vs direct.',
    'Taxi-bons: valeur unitaire 8 CHF, éligibles personas horaires atypiques/senior.',
    'Résultats ordre de grandeur; calibration données réelles requise pour chiffres définitifs.',
  ];

  const greenZones = zoneResults.filter(z => z.category === 'vert').length;
  const summary = `Scénario simulé: ${zoneResults.length} zones analysées. ` +
    `${greenZones} zone(s) à fort potentiel de bascule (Vert). ` +
    `Shift global estimé: ${(globalShiftIndex * 100).toFixed(0)}%. ` +
    `${equityFlags.length > 0 ? `${equityFlags.length} profil(s) à risque équité détecté(s).` : 'Aucun risque équité majeur identifié.'}`;

  return {
    scenarioId,
    timestamp,
    globalShiftIndex,
    zoneResults,
    personaResults,
    equityFlags,
    hypotheses,
    summary,
  };
}
