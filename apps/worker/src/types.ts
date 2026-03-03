// ─── Types worker (apps/worker/src/types.ts) ─────────────────────────────────
// IMPORTANT: Ce fichier est SÉPARÉ de apps/web/src/types.ts
// Le worker n'a pas accès au DOM ni aux types React

export interface Scenario {
  id?: string;
  name?: string;
  createdAt?: string;

  // Parking centre (Planta/Scex/Cible)
  // Baseline réel Sion = CHF 3.00/h après 1ère heure gratuite (sion.ch PDFs 2024-2025)
  centrePeakPriceCHFh:    number;  // 0–10
  centreOffpeakPriceCHFh: number;  // 0–10

  // Parking périphérie / P+R (baseline = 0 CHF, P+R Potences+Stade gratuits)
  peripheriePeakPriceCHFh:    number;  // 0–5
  peripherieOffpeakPriceCHFh: number;  // 0–5

  // Progressivité longue durée (1.0 = actuel, > 1.0 = majoration scénario)
  progressiveSlopeFactor: number;  // 1.0–3.0

  // TP discount hors-pointe
  tpOffpeakDiscountPct: number;    // 0–50 (%)

  // Mesures complémentaires
  enableCovoiturage: boolean;
  enableTAD:         boolean;
  enableTaxiBons:    boolean;

  // Objectif principal
  objective: 'reduce-peak-car' | 'protect-short-stay' | 'equity-access';
}

export interface ModeSplit {
  car:         number;
  tp:          number;
  covoiturage: number;
  tad:         number;
  taxiBons:    number;
}

export interface ZoneResult {
  zoneId:              string;
  label:               string;
  elasticityScore:     number;
  category:            'vert' | 'orange' | 'rouge';
  shiftIndex:          number;
  estimatedThreshold?: number;
  equityFlag:          boolean;
  equityReason?:       string;
  modeSplit:           ModeSplit;
  occupancyPct?:       number;
  avgParkingCostCHF?:  number;
}

export interface PersonaResult {
  personaId:           string;
  label:               string;
  emoji:               string;
  beforeCostCHF:       number;
  afterCostCHF:        number;
  costDeltaCHF:        number;
  preferredMode:       string;
  preferredModeBefore: string;
  equityFlag:          boolean;
  tags:                string[];
  explanation:         string[];
}

export interface SimulationResults {
  scenarioId:       string;
  timestamp:        string;
  globalShiftIndex: number;
  zoneResults:      ZoneResult[];
  personaResults:   PersonaResult[];
  equityFlags:      string[];
  hypotheses:       string[];
  summary:          string;
}

export interface InsightsResponse {
  summaryBullets: string[];
  risks:          { risk: string; mitigation: string }[];
  pilot90Days:    { title: string; description: string; metrics: string[] };
  commDraft:      string;
  improvements?:  { title: string; priority: 'M' | 'S' | 'C' | 'W'; effort: 'S' | 'M' | 'L'; value: string }[];
}

export interface ActionsResponse {
  horizon0_3:   ActionItem[];
  horizon3_12:  ActionItem[];
  horizon12_36: ActionItem[];
}

export interface ActionItem {
  title:       string;
  description: string;
  owner:       string;
  metrics:     string[];
  priority:    'haute' | 'moyenne' | 'basse';
}

// ── Données brutes (chargées depuis JSON) ────────────────────────────────────

/**
 * ParkingData — structure du fichier apps/worker/src/data/parking.json
 * Chaque entrée représente une ZONE (agrégation de parkings similaires)
 */
export interface ParkingData {
  zoneId:           string;
  capacity:         number;
  basePriceCHFh:    number;    // Taux horaire de base (CHF/h)
  peakMultiplier:   number;    // Multiplicateur heure de pointe
  offpeakMultiplier: number;   // Multiplicateur heure creuse
  longStayShare:    number;    // Part de stationnement longue durée (0–1)
  frictionIndex:    number;    // Friction recherche de place (0–1)
  notes?:           string;
}

/**
 * TPData — structure du fichier apps/worker/src/data/tp.json
 * Données TP par zone géographique (source: isireso-sion.ch, CarPostal 2025)
 */
export interface TPData {
  zoneId:            string;
  accessIndex:       number;    // Qualité d'accès TP (0–1, 1=excellent)
  timeToCenterMin:   number;    // Temps trajet jusqu'au centre (min)
  peakFreqMin:       number;    // Fréquence en pointe (min entre passages)
  offpeakFreqMin:    number;    // Fréquence hors pointe
  ticketBaseCHF:     number;    // Tarif aller plein tarif (CHF) · isireso zones 1–4
  offpeakDiscountMax: number;   // Remise max hors pointe (0–1)
  notes?:            string;
}

/**
 * Persona — structure du fichier apps/worker/src/data/personas.json
 */
export interface Persona {
  id:              string;
  label:           string;
  emoji:           string;
  description:     string;
  valueOfTimeCHFh: number;
  priceSensitivity:  number;
  scheduleRigidity:  number;
  tpAffinity:        number;
  carDependency:     number;
  typicalTrip: {
    fromZoneId:   string;
    toZoneId:     string;
    timeWindow:   'peak' | 'offpeak';
    durationType: 'short' | 'long';
  };
  tags:        string[];
  income:      'faible' | 'moyen' | 'élevé';
  alternatives: string[];
}
