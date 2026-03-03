// ─── Types partagés frontend ─────────────────────────────────────────────────
// apps/web/src/types.ts

// ── Helper types ─────────────────────────────────────────────────────────────

export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

/**
 * Objectif principal du scénario.
 * Étendu pour couvrir toutes les valeurs utilisées dans le projet.
 */
export type Objective =
  | 'reduce-peak-car'
  | 'protect-short-stay'
  | 'equity-access'
  | 'attractivity'
  | 'revenue'
  | (string & {});   // ← accepte toute chaîne supplémentaire sans casser le typage

// ── Scenario ─────────────────────────────────────────────────────────────────

export interface Scenario {
  id?: string;
  name?: string;

  // Parking centre (Planta/Scex/Cible)
  // Baseline réel Sion = 3.00 CHF/h après 1ère heure gratuite (sion.ch PDFs 2024-2025)
  centrePeakPriceCHFh:    number;
  centreOffpeakPriceCHFh: number;

  // Parking périphérie / P+R (baseline = 0 CHF, P+R Potences+Stade gratuits)
  peripheriePeakPriceCHFh:    number;
  peripherieOffpeakPriceCHFh: number;

  // Progressivité longue durée (1.0 = actuel)
  progressiveSlopeFactor: number;

  // TP discount hors-pointe
  tpOffpeakDiscountPct: number;

  // Mesures complémentaires
  enableCovoiturage: boolean;
  enableTAD:         boolean;
  enableTaxiBons:    boolean;

  // Objectif principal — string ouvert pour compatibilité ascendante
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

/** Alias pour compatibilité avec Dashboard.tsx et store.tsx */
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
