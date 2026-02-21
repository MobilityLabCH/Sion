// ─── Types partagés ────────────────────────────────────────────────────────

export interface Scenario {
  id?: string;
  name?: string;
  createdAt?: string;

  // Parking centre
  centrePeakPriceCHFh: number;      // 0 – 10
  centreOffpeakPriceCHFh: number;   // 0 – 10
  // Parking périphérie
  peripheriePeakPriceCHFh: number;  // 0 – 5
  peripherieOffpeakPriceCHFh: number;

  // Progressive pricing
  progressiveSlopeFactor: number;   // 1.0 = linéaire, 2.0 = doublement après 1h

  // TP discount hors-pointe
  tpOffpeakDiscountPct: number;     // 0 – 50 (%)

  // Toggles mesures complémentaires
  enableCovoiturage: boolean;
  enableTAD: boolean;
  enableTaxiBons: boolean;

  // Objectif principal
  objective: 'reduce-peak-car' | 'protect-short-stay' | 'equity-access';
}

export interface ZoneResult {
  zoneId: string;
  label: string;
  elasticityScore: number;           // 0–100
  category: 'vert' | 'orange' | 'rouge';
  shiftIndex: number;                // % de bascule voiture -> alternatives (0–1)
  estimatedThreshold?: number;       // CHF/h où la bascule devient significative
  equityFlag: boolean;
  equityReason?: string;
  modeSplit: ModeSplit;
}

export interface ModeSplit {
  car: number;      // probabilité softmax
  tp: number;
  covoiturage: number;
  tad: number;
  taxiBons: number;
}

export interface PersonaResult {
  personaId: string;
  label: string;
  emoji: string;
  beforeCostCHF: number;            // coût total avant scénario
  afterCostCHF: number;
  costDeltaCHF: number;
  preferredMode: string;
  preferredModeBefore: string;
  equityFlag: boolean;
  tags: string[];
  explanation: string[];            // 2-3 bullets
}

export interface SimulationResults {
  scenarioId: string;
  timestamp: string;
  globalShiftIndex: number;         // % voiture -> alternatives, global
  zoneResults: ZoneResult[];
  personaResults: PersonaResult[];
  equityFlags: string[];            // zones/personas potentiellement pénalisés
  hypotheses: string[];
  summary: string;
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

export interface ParkingData {
  zoneId: string;
  capacity: number;
  basePriceCHFh: number;
  peakMultiplier: number;
  offpeakMultiplier: number;
  longStayShare: number;
  frictionIndex: number;
  notes?: string;
}

export interface TPData {
  zoneId: string;
  accessIndex: number;
  timeToCenterMin: number;
  peakFreqMin: number;
  offpeakFreqMin: number;
  ticketBaseCHF: number;
  offpeakDiscountMax: number;
  notes?: string;
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
  income: 'faible' | 'moyen' | 'élevé';
  alternatives: string[];
}
