// ─── Types partagés frontend ─────────────────────────────────────────────────
// apps/web/src/types.ts

// ── Helper types ─────────────────────────────────────────────────────────────

/** Plage horaire (utilisée dans Dashboard + ODSimulator) */
export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

/**
 * Objectif principal du scénario.
 * NB: 'attractivity' et 'revenue' sont utilisés dans Dashboard.tsx (GitHub)
 * en plus des 3 objectifs du ScenarioBuilder.
 */
export type Objective =
  | 'reduce-peak-car'
  | 'protect-short-stay'
  | 'equity-access'
  | 'attractivity'
  | 'revenue';

// ── Scenario ─────────────────────────────────────────────────────────────────

export interface Scenario {
  id?: string;
  name?: string;

  // Parking centre (Planta/Scex/Cible)
  // Baseline réel Sion = 3.00 CHF/h après 1ère heure gratuite (sion.ch PDFs 2024-2025)
  centrePeakPriceCHFh:    number;  // 0–10
  centreOffpeakPriceCHFh: number;  // 0–10

  // Parking périphérie / P+R (baseline = 0 CHF, P+R Potences+Stade gratuits)
  peripheriePeakPriceCHFh:    number;  // 0–5
  peripherieOffpeakPriceCHFh: number;  // 0–5

  // Progressivité longue durée (1.0 = actuel, >1.0 = majoration scénario)
  progressiveSlopeFactor: number;  // 1.0–3.0

  // TP discount hors-pointe
  tpOffpeakDiscountPct: number;    // 0–50 (%)

  // Mesures complémentaires
  enableCovoiturage: boolean;
  enableTAD:         boolean;
  enableTaxiBons:    boolean;

  // Objectif principal
  objective: Objective;
}

/**
 * Situation ACTUELLE de Sion (= baseline)
 * Sources: sion.ch/stationnement · PDFs Planta 15.07.2024 + Scex 11.08.2025
 */
export const DEFAULT_SCENARIO: Scenario = {
  name: 'Nouveau scénario',
  centrePeakPriceCHFh:    3.0,
  centreOffpeakPriceCHFh: 3.0,
  peripheriePeakPriceCHFh:    0.0,
  peripherieOffpeakPriceCHFh: 0.0,
  progressiveSlopeFactor: 1.0,
  tpOffpeakDiscountPct:   0,
  enableCovoiturage: false,
  enableTAD:         false,
  enableTaxiBons:    false,
  objective: 'reduce-peak-car',
};

/** Alias exporté pour compatibilité avec Dashboard.tsx et store.tsx */
export const BASELINE_SCENARIO: Scenario = DEFAULT_SCENARIO;

// ── Résultats simulation ──────────────────────────────────────────────────────

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
  elasticityScore:     number;         // 0–100
  category:            'vert' | 'orange' | 'rouge';
  shiftIndex:          number;         // 0–1
  estimatedThreshold?: number;
  equityFlag:          boolean;
  equityReason?:       string;
  modeSplit:           ModeSplit;
  occupancyPct?:       number;         // optionnel — taux d'occupation estimé (ZoneMap)
  avgParkingCostCHF?:  number;         // optionnel — coût moyen parking simulé (ZoneMap)
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

// ── Insights / Actions ───────────────────────────────────────────────────────

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

// ── Persona ──────────────────────────────────────────────────────────────────

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
