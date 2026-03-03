import type {
  Scenario, SimulationResults, ZoneResult, PersonaResult,
  ModeSplit, ParkingData, TPData, Persona
} from './types.js';

// ─── Constantes moteur ──────────────────────────────────────────────────────
const SHORT_STAY_H = 1.0;   // visite courte : 1h (1ère heure gratuite Planta/Scex)
const LONG_STAY_H  = 3.5;   // pendulaire/bureau : proxy 3.5h

const CAR_KM_COST_CHF    = 0.18;  // coût km marginal (hors amortissement) · TCS 2024
const TAD_BASE_FEE_CHF   = 2.50;  // taxibus Valais base
const TAD_PER_KM_CHF     = 0.35;  // taxibus Valais par km
const TAXI_BASE_CHF      = 12.0;
const TAXI_PER_KM_CHF    = 2.80;
const TAXI_BON_VALUE_CHF = 8.0;   // valeur d'un taxibon Sion
const TRANSFER_PENALTY_CHF = 2.5; // inconfort marche/attente (utilité non-monétaire)
const SOFTMAX_TEMPERATURE  = 0.6; // sensibilité au différentiel de coût (0=max, ∞=neutre)

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeCostCHF(minutes: number, valueOfTimeCHFh: number): number {
  return (minutes / 60) * valueOfTimeCHFh;
}

/** Softmax sur coûts : coût élevé → probabilité faible */
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
 * Calcule le coût de stationnement pour une zone/durée/scénario donnés.
 *
 * Barème officiel Sion (Planta/Scex · sion.ch 2024-2025) :
 *   - 1ère heure : GRATUITE
 *   - Heures 2–11 : CHF 3.00/h (= scenario.centrePeakPriceCHFh au baseline)
 *   - Au-delà 11h : CHF 0.20/h
 *   - Vendredi 17h → samedi 24h : GRATUIT
 *   - Dimanches/jours fériés : GRATUIT
 *
 * Le paramètre scenario.centrePeakPriceCHFh est le TAUX HORAIRE simulé
 * (baseline = 3.00 CHF/h, i.e. situation actuelle Sion).
 */
function effectiveParkingPrice(
  parking: ParkingData,
  scenario: Scenario,
  zoneId: string,
  timeWindow: 'peak' | 'offpeak',
  durationType: 'short' | 'long'
): number {
  const durationH = durationType === 'short' ? SHORT_STAY_H : LONG_STAY_H;

  // ── P+R et périphérie : toujours gratuit (P+R Potences/Stade)
  if (zoneId === 'peripherie') {
    const prRate = timeWindow === 'peak'
      ? scenario.peripheriePeakPriceCHFh
      : scenario.peripherieOffpeakPriceCHFh;
    return prRate * durationH;
  }

  // ── Taux horaire selon zone et fenêtre temporelle
  let ratePerH: number;
  if (zoneId === 'centre' || zoneId === 'gare') {
    // Sion n'a pas de tarif distinct pointe/creux (même barème jour) —
    // le scénario peut en créer un artificiellement
    ratePerH = timeWindow === 'peak'
      ? scenario.centrePeakPriceCHFh
      : scenario.centreOffpeakPriceCHFh;
  } else {
    // Zones intermédiaires (est, ouest, nord, sud, emploi) :
    // interpolation proportionnelle au ratio scénario/baseline
    const baselineRate = 3.0;
    const scenarioFactor = scenario.centrePeakPriceCHFh / baselineRate;
    const zoneRate = parking.basePriceCHFh * scenarioFactor;
    ratePerH = timeWindow === 'peak'
      ? zoneRate * parking.peakMultiplier
      : zoneRate * parking.offpeakMultiplier;
  }

  // ── Gratuité 1ère heure (Planta/Scex/Cible) : uniquement centre et gare
  const hasFirstHourFree = zoneId === 'centre' || zoneId === 'gare';

  if (hasFirstHourFree) {
    if (durationType === 'short') return 0; // 1h ≤ franchise gratuite

    // Long stay (3.5h) : 1h gratuit + fraction payante
    const billableH = durationH - 1.0;

    // Majoration optionnelle longue durée (scenario.progressiveSlopeFactor)
    // 1.0 = barème officiel actuel, >1.0 = scénario plus pénalisant sur longue durée
    const slope = Math.max(1.0, scenario.progressiveSlopeFactor);
    const billableCost = billableH * ratePerH * slope;

    return Math.round(billableCost * 100) / 100;
  }

  // ── Autres zones : tarif linéaire simple
  const slope = durationType === 'long' && scenario.progressiveSlopeFactor > 1
    ? scenario.progressiveSlopeFactor : 1.0;
  return Math.round(durationH * ratePerH * slope * 100) / 100;
}

// ─── Calcul coût par mode ────────────────────────────────────────────────────

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

  // Distance estimée depuis accessIndex (proxy géographique)
  const distanceKm = clamp((1 - tp.accessIndex) * 20 + 2, 1, 25);

  // ─── Voiture ───────────────────────────────────────────────────────────────
  const parkingCost    = effectiveParkingPrice(parking, scenario, zoneId, timeWindow, durationType);
  const carTimeMin     = clamp(tp.timeToCenterMin * 0.8, 5, 45); // voiture ~20% plus rapide que TP
  const carTimeCost    = timeCostCHF(carTimeMin, vot);
  const carFriction    = parking.frictionIndex * vot * 0.3;      // pénalité recherche de place
  const carKmCost      = distanceKm * CAR_KM_COST_CHF;
  const carTotal       = parkingCost + carTimeCost + carFriction + carKmCost;

  // ─── Transports publics ────────────────────────────────────────────────────
  const tpDiscountFactor = timeWindow === 'offpeak'
    ? 1 - Math.min(tp.offpeakDiscountMax, scenario.tpOffpeakDiscountPct / 100)
    : 1;
  const tpTicketCost  = tp.ticketBaseCHF * tpDiscountFactor;
  const tpFreqMin     = timeWindow === 'peak' ? tp.peakFreqMin : tp.offpeakFreqMin;
  const tpWaitMin     = tpFreqMin / 2; // attente moyenne = demi-fréquence
  const tpTimeCost    = timeCostCHF(tp.timeToCenterMin + tpWaitMin, vot);
  const tpAccessPenalty = (1 - tp.accessIndex) * TRANSFER_PENALTY_CHF;
  const tpTotal       = tpTicketCost + tpTimeCost + tpAccessPenalty;

  // ─── Covoiturage ──────────────────────────────────────────────────────────
  let covoiturageTotal = Infinity;
  if (scenario.enableCovoiturage) {
    const matchingPotential = clamp(1 - persona.scheduleRigidity * 0.7, 0.1, 0.9);
    if (matchingPotential > 0.3) {
      const inconveniencePenalty = persona.scheduleRigidity * vot * 0.5 * (30 / 60);
      covoiturageTotal = carTotal * 0.55 + inconveniencePenalty; // 55% du coût voiture
    }
  }

  // ─── TAD (Transport à la Demande) ────────────────────────────────────────
  let tadTotal = Infinity;
  if (scenario.enableTAD) {
    const tadCost    = TAD_BASE_FEE_CHF + distanceKm * TAD_PER_KM_CHF;
    const tadTimeCost = timeCostCHF(tp.timeToCenterMin * 1.2, vot); // +20% vs direct
    tadTotal = tadCost + tadTimeCost;
  }

  // ─── Taxi-bons ────────────────────────────────────────────────────────────
  let taxiBonsTotal = Infinity;
  const isTaxiBonsEligible = persona.tags.some(t =>
    ['horaires atypiques', 'senior', 'mobilité réduite', 'décalé', 'urgent'].includes(t)
  );
  if (scenario.enableTaxiBons && isTaxiBonsEligible) {
    const taxiCost    = TAXI_BASE_CHF + distanceKm * TAXI_PER_KM_CHF;
    const taxiTimeCost = timeCostCHF(carTimeMin * 1.1, vot);
    taxiBonsTotal = taxiCost - TAXI_BON_VALUE_CHF + taxiTimeCost;
  }

  return { car: carTotal, tp: tpTotal, covoiturage: covoiturageTotal, tad: tadTotal, taxiBons: taxiBonsTotal };
}

// ─── Mode split (softmax avec préférences persona) ───────────────────────────
//
// Correction: high carDependency → perceived car cost LOWER (not higher)
// high tpAffinity → perceived TP cost LOWER
// The attitudinal factor works as a preference discount on perceived cost.

export function computeModeSplit(costs: TripCosts, persona: Persona): ModeSplit {
  // carDependency ↑ → multiplier ↓ → perceived car cost ↓ → softmax prob ↑ (correct)
  const carAdjusted  = costs.car  * (1.3 - persona.carDependency * 0.6);
  // tpAffinity ↑ → multiplier ↓ → perceived TP cost ↓ → softmax prob ↑ (correct)
  const tpAdjusted   = costs.tp   * (1.2 - persona.tpAffinity    * 0.5);
  const covoiAdjusted = costs.covoiturage;
  const tadAdjusted   = costs.tad;
  const taxiAdjusted  = costs.taxiBons;

  const probs = softmax([carAdjusted, tpAdjusted, covoiAdjusted, tadAdjusted, taxiAdjusted]);
  return {
    car: probs[0], tp: probs[1],
    covoiturage: probs[2], tad: probs[3], taxiBons: probs[4],
  };
}

// ─── Baseline : situation RÉELLE actuelle de Sion ────────────────────────────
//
// Source: sion.ch PDFs Planta (15.07.2024) + Scex (11.08.2025)
// - Centre (Planta/Scex/Cible) : 1h gratuite puis CHF 3.00/h
// - Périphérie (P+R Potences/Stade) : gratuit
// - Pas de différentiel pointe/creux dans le tarif actuel Sion
// - Gratuité totale vendredi 17h → samedi 24h (non modélisée dans baseline, impact neutre)

function buildBaselineScenario(): Scenario {
  return {
    centrePeakPriceCHFh:    3.0,  // CHF 3.00/h après 1ère heure gratuite (Planta/Scex officiel)
    centreOffpeakPriceCHFh: 3.0,  // idem — Sion n'a pas de tarif creux distinct actuellement
    peripheriePeakPriceCHFh:    0.0,  // P+R gratuit
    peripherieOffpeakPriceCHFh: 0.0,
    progressiveSlopeFactor: 1.0,  // barème actuel = progressivité officielle (1h gratuit + CHF 3/h)
    tpOffpeakDiscountPct:   0,
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
  tpData: TPData[],
  personas: Persona[]
): SimulationResults {
  const baseline    = buildBaselineScenario();
  const scenarioId  = `sim_${Date.now()}`;
  const timestamp   = new Date().toISOString();

  const parkingMap  = new Map(parkingData.map(p => [p.zoneId, p]));
  const tpMap       = new Map(tpData.map(t => [t.zoneId, t]));

  const zoneLabels: Record<string, string> = {
    centre: 'Centre-ville', gare: 'Gare CFF', est: 'Est (Bramois/Vissigen)',
    ouest: 'Ouest (Châteauneuf)', nord: 'Nord (Savièse/Grimisuat)',
    sud: 'Sud (Aproz/Nendaz)', emploi: 'Zone Emploi', peripherie: 'Périphérie / P+R',
  };

  // ─── Résultats par zone ───────────────────────────────────────────────────
  const zoneResults: ZoneResult[] = [];

  for (const [zoneId, parking] of parkingMap) {
    const tp = tpMap.get(zoneId);
    if (!tp) continue;

    const zonePersonas = personas.filter(p =>
      p.typicalTrip.toZoneId === zoneId || p.typicalTrip.fromZoneId === zoneId
    );
    if (zonePersonas.length === 0) continue;

    let totalCarBefore = 0;
    let totalCarAfter  = 0;
    let equityFlag     = false;
    const equityReasons: string[] = [];

    for (const persona of zonePersonas) {
      const baselineCosts  = computeTripCosts(persona, parking, tp, baseline,  zoneId);
      const scenarioCosts  = computeTripCosts(persona, parking, tp, scenario, zoneId);
      const beforeSplit    = computeModeSplit(baselineCosts,  persona);
      const afterSplit     = computeModeSplit(scenarioCosts,  persona);

      totalCarBefore += beforeSplit.car;
      totalCarAfter  += afterSplit.car;

      const costsIncreased  = scenarioCosts.car > baselineCosts.car * 1.2;
      const hasAlternatives = scenarioCosts.tp < scenarioCosts.car * 1.3
        || scenarioCosts.covoiturage < Infinity
        || scenarioCosts.tad         < Infinity;

      if (costsIncreased && !hasAlternatives && persona.income === 'faible') {
        equityFlag = true;
        equityReasons.push(persona.label);
      }
    }

    const avgCarBefore  = totalCarBefore / zonePersonas.length;
    const avgCarAfter   = totalCarAfter  / zonePersonas.length;
    const shiftIndex    = clamp((avgCarBefore - avgCarAfter) / Math.max(avgCarBefore, 0.01), 0, 1);

    // Score d'élasticité composite
    const accessBonus      = tp.accessIndex * 30;
    const baselineRate     = 3.0;
    const priceSignal      = Math.min(
      Math.max(0, scenario.centrePeakPriceCHFh - baselineRate) * 8, 30
    );
    const alternativesBonus = (scenario.enableCovoiturage ? 10 : 0)
      + (scenario.enableTAD ? 8 : 0) + (scenario.enableTaxiBons ? 5 : 0);
    const elasticityScore = clamp(
      Math.round(shiftIndex * 60 + accessBonus * 0.4 + priceSignal * 0.3 + alternativesBonus),
      0, 100
    );

    const category: 'vert' | 'orange' | 'rouge' =
      elasticityScore >= 60 ? 'vert' : elasticityScore >= 35 ? 'orange' : 'rouge';

    // Seuil de bascule : prix centre à partir duquel TP devient compétitif
    // Approximation : coût voiture centre = coût TP → résoudre en ratePerH
    const estimatedThreshold = (zoneId === 'centre' || zoneId === 'gare')
      ? clamp(tp.ticketBaseCHF + tp.timeToCenterMin * 0.05 + 1.0, 2.5, 8)
      : undefined;

    const avgSplit = zonePersonas.reduce((acc, persona) => {
      const costs = computeTripCosts(persona, parking, tp, scenario, zoneId);
      const split = computeModeSplit(costs, persona);
      const n     = zonePersonas.length;
      return {
        car:         acc.car         + split.car         / n,
        tp:          acc.tp          + split.tp          / n,
        covoiturage: acc.covoiturage + split.covoiturage / n,
        tad:         acc.tad         + split.tad         / n,
        taxiBons:    acc.taxiBons    + split.taxiBons    / n,
      };
    }, { car: 0, tp: 0, covoiturage: 0, tad: 0, taxiBons: 0 });

    zoneResults.push({
      zoneId, label: zoneLabels[zoneId] || zoneId,
      elasticityScore, category, shiftIndex, estimatedThreshold,
      equityFlag,
      equityReason: equityReasons.length > 0
        ? `Personas à risque: ${equityReasons.join(', ')}` : undefined,
      modeSplit: avgSplit,
    });
  }

  // ─── Résultats par persona ────────────────────────────────────────────────
  const personaResults: PersonaResult[] = personas.map(persona => {
    const zoneId  = persona.typicalTrip.toZoneId;
    const parking = parkingMap.get(zoneId) || parkingMap.get('centre')!;
    const tp      = tpMap.get(zoneId)      || tpMap.get('centre')!;

    const baselineCosts = computeTripCosts(persona, parking, tp, baseline,  zoneId);
    const scenarioCosts = computeTripCosts(persona, parking, tp, scenario, zoneId);
    const beforeSplit   = computeModeSplit(baselineCosts, persona);
    const afterSplit    = computeModeSplit(scenarioCosts, persona);

    const modeNames = ['Voiture', 'TP', 'Covoiturage', 'TAD', 'Taxi-bons'];
    const beforeArr = [beforeSplit.car, beforeSplit.tp, beforeSplit.covoiturage, beforeSplit.tad, beforeSplit.taxiBons];
    const afterArr  = [afterSplit.car,  afterSplit.tp,  afterSplit.covoiturage,  afterSplit.tad,  afterSplit.taxiBons];
    const beforeIdx = beforeArr.indexOf(Math.max(...beforeArr));
    const afterIdx  = afterArr.indexOf(Math.max(...afterArr));

    const costsBefore = [baselineCosts.car, baselineCosts.tp, baselineCosts.covoiturage, baselineCosts.tad, baselineCosts.taxiBons];
    const costsAfter  = [scenarioCosts.car, scenarioCosts.tp, scenarioCosts.covoiturage, scenarioCosts.tad, scenarioCosts.taxiBons];
    const beforeCost  = costsBefore[beforeIdx];
    const afterCostRaw = costsAfter[afterIdx];
    const afterCost   = afterCostRaw === Infinity ? scenarioCosts.car : afterCostRaw;

    const equityFlag = persona.income === 'faible' && afterCost > beforeCost * 1.15;
    const delta      = afterCost - beforeCost;

    const explanation: string[] = [];
    if (Math.abs(delta) < 0.5) {
      explanation.push('Impact coût neutre : le scénario ne modifie pas significativement le coût total pour ce profil.');
    } else if (delta > 0) {
      explanation.push(`Hausse estimée : +${delta.toFixed(1)} CHF/trajet vs. situation actuelle.`);
    } else {
      explanation.push(`Économie estimée : ${Math.abs(delta).toFixed(1)} CHF/trajet vs. situation actuelle.`);
    }

    if (modeNames[beforeIdx] !== modeNames[afterIdx]) {
      explanation.push(`Bascule modale probable : ${modeNames[beforeIdx]} → ${modeNames[afterIdx]}.`);
    } else {
      explanation.push(`Mode préférentiel stable : ${modeNames[afterIdx]} reste l'option dominante.`);
    }

    if (equityFlag) {
      explanation.push('⚠ Risque équité : revenu faible + hausse sans alternative accessible. Mesures compensatoires recommandées.');
    } else if (persona.alternatives.length > 0 && afterIdx > 0) {
      explanation.push(`Alternative activable : ${persona.alternatives[0].toUpperCase()} est une option crédible pour ce profil.`);
    }

    return {
      personaId: persona.id, label: persona.label, emoji: persona.emoji,
      beforeCostCHF: Math.round(beforeCost  * 10) / 10,
      afterCostCHF:  Math.round(afterCost   * 10) / 10,
      costDeltaCHF:  Math.round(delta        * 10) / 10,
      preferredModeBefore: modeNames[beforeIdx],
      preferredMode:       modeNames[afterIdx],
      equityFlag, tags: persona.tags, explanation,
    };
  });

  // ─── Agrégats ─────────────────────────────────────────────────────────────
  const equityFlags = personaResults.filter(p => p.equityFlag).map(p => `${p.emoji} ${p.label}`);

  const globalShiftIndex = zoneResults.length > 0
    ? zoneResults.reduce((s, z) => s + z.shiftIndex, 0) / zoneResults.length
    : 0;

  const hypotheses = [
    'Durée courte = 1h · longue = 3.5h (proxy pendulaire).',
    'Tarif baseline centre = 1h gratuite + CHF 3.00/h (source: sion.ch PDFs 2024-2025, Planta & Scex).',
    'P+R Potences (450 pl.) et Stade/Échutes (460 pl.) : gratuits, connexion BS 11 toutes les 10 min.',
    'isireso-sion : zone 1 CHF 2.20 · zone 2 CHF 3.20 · zone 3 CHF 4.20 · zone 4 CHF 5.20.',
    'Coût km auto marginal = 0.18 CHF/km (hors amortissement, TCS 2024).',
    'Softmax température 0.6 — sensibilité modérée au différentiel de coût.',
    'Mode split : préférence modale via utilité perçue (carDependency/tpAffinity comme remises attitudinales).',
    'Covoiturage : 55% du coût voiture + pénalité rigidité horaire.',
    'Résultats = ordre de grandeur ; calibration sur données observées requise pour chiffres définitifs.',
  ];

  const greenZones = zoneResults.filter(z => z.category === 'vert').length;
  const summary    =
    `Scénario simulé : ${zoneResults.length} zones analysées. ` +
    `${greenZones} zone(s) à fort potentiel de bascule (Vert). ` +
    `Shift global estimé : ${(globalShiftIndex * 100).toFixed(0)}%. ` +
    (equityFlags.length > 0
      ? `${equityFlags.length} profil(s) à risque équité détecté(s).`
      : 'Aucun risque équité majeur identifié.');

  return { scenarioId, timestamp, globalShiftIndex, zoneResults, personaResults, equityFlags, hypotheses, summary };
}
