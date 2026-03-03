// ─── Types partagés frontend ─────────────────────────────────────────────────

export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';
export type Objective = 'reduce-peak-car' | 'protect-short-stay' | 'equity-access' | 'attractivity' | 'revenue';

export interface Scenario {
  id?: string;
  name?: string;

  // Tarifs parking
  centrePeakPriceCHFh: number;
  centreOffpeakPriceCHFh: number;
  peripheriePeakPriceCHFh: number;
  peripherieOffpeakPriceCHFh: number;
  progressiveSlopeFactor: number;

  // Fenêtre temporelle
  dayType: DayType;
  startHour: number;
  endHour: number;

  // TP & alternatives
  tpOffpeakDiscountPct: number;
  enableCovoiturage: boolean;
  enableTAD: boolean;
  enableTaxiBons: boolean;
  enableFreeBus: boolean;   // gratuité bus (vendredi/samedi Sion)

  // Objectif politique
  objective: Objective;
}

// ── Baseline officielle : gratuité vendredi dès 17h + samedi toute la journée
// Source: Ville de Sion, arrêté Conseil Communal 2023
export const BASELINE_SCENARIO: Scenario = {
  name: 'Baseline — Gratuité vendredi/samedi (actuel 2025)',
  centrePeakPriceCHFh: 3.0,
  centreOffpeakPriceCHFh: 1.5,
  peripheriePeakPriceCHFh: 0.0,
  peripherieOffpeakPriceCHFh: 0.0,
  progressiveSlopeFactor: 1.0,
  dayType: 'friday',
  startHour: 17,
  endHour: 24,
  tpOffpeakDiscountPct: 0,
  enableCovoiturage: false,
  enableTAD: false,
  enableTaxiBons: false,
  enableFreeBus: true,   // bus gratuits vendredi soir + samedi
  objective: 'attractivity',
};

export const DEFAULT_SCENARIO: Scenario = {
  name: 'Nouveau scénario',
  centrePeakPriceCHFh: 2.5,
  centreOffpeakPriceCHFh: 1.5,
  peripheriePeakPriceCHFh: 0.0,
  peripherieOffpeakPriceCHFh: 0.0,
  progressiveSlopeFactor: 1.0,
  dayType: 'weekday',
  startHour: 7,
  endHour: 19,
  tpOffpeakDiscountPct: 0,
  enableCovoiturage: false,
  enableTAD: false,
  enableTaxiBons: false,
  enableFreeBus: false,
  objective: 'reduce-peak-car',
};

export interface ZoneResult {
  zoneId: string;
  label: string;
  elasticityScore: number;
  category: 'vert' | 'orange' | 'rouge';
  shiftIndex: number;
  estimatedThreshold?: number;
  equityFlag: boolean;
  equityReason?: string;
  modeSplit: {
    car: number;
    tp: number;
    covoiturage: number;
    tad: number;
    taxiBons: number;
  };
  // KPIs stationnement
  occupancyPct?: number;
  avgParkingCostCHF?: number;
  avgWalkMinutes?: number;
}

export interface PersonaResult {
  personaId: string;
  label: string;
  emoji: string;
  beforeCostCHF: number;
  afterCostCHF: number;
  costDeltaCHF: number;
  preferredMode: string;
  preferredModeBefore: string;
  equityFlag: boolean;
  tags: string[];
  explanation: string[];
}

export interface SimulationResults {
  scenarioId: string;
  timestamp: string;
  globalShiftIndex: number;
  zoneResults: ZoneResult[];
  personaResults: PersonaResult[];
  equityFlags: string[];
  hypotheses: string[];
  summary: string;
  // KPIs financiers
  estimatedRevenueLossCHFyear?: number;
  estimatedCostPerVisitorCHF?: number;
  co2SavedTonnesYear?: number;
}

export interface InsightsResponse {
  summaryBullets: string[];
  risks: { risk: string; mitigation: string }[];
  pilot90Days: { title: string; description: string; metrics: string[] };
  commDraft: string;
  improvements?: { title: string; priority: 'M' | 'S' | 'C' | 'W'; effort: 'S' | 'M' | 'L'; value: string }[];
}

export interface ActionsResponse {
  horizon0_3: ActionItem[];
  horizon3_12: ActionItem[];
  horizon12_36: ActionItem[];
}

export interface ActionItem {
  title: string;
  description: string;
  owner: string;
  metrics: string[];
  priority: 'haute' | 'moyenne' | 'basse';
}

export interface Persona {
  id: string;
  label: string;
  emoji: string;
  description: string;
  valueOfTimeCHFh: number;
  priceSensitivity: number;
  scheduleRigidity: number;
  tpAffinity: number;
  carDependency: number;
  typicalTrip: {
    fromZoneId: string;
    toZoneId: string;
    timeWindow: 'peak' | 'offpeak';
    durationType: 'short' | 'long';
  };
  tags: string[];
  income: string;
  alternatives: string[];
}
