// ─── Types partagés Worker ─────────────────────────────────────────────────

export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

export interface Scenario {
  id?: string;
  name?: string;
  createdAt?: string;

  // Parking centre
  centrePeakPriceCHFh: number;
  centreOffpeakPriceCHFh: number;
  // Parking périphérie
  peripheriePeakPriceCHFh: number;
  peripherieOffpeakPriceCHFh: number;

  // Progressive pricing
  progressiveSlopeFactor: number;

  // Fenêtre temporelle
  dayType?: DayType;
  startHour?: number;
  endHour?: number;

  // TP discount hors-pointe
  tpOffpeakDiscountPct: number;

  // Toggles
  enableCovoiturage: boolean;
  enableTAD: boolean;
  enableTaxiBons: boolean;
  enableFreeBus?: boolean;

  // Objectif
  objective: 'reduce-peak-car' | 'protect-short-stay' | 'equity-access' | 'attractivity' | 'revenue';
}

export interface ParkingRule {
  dayType: DayType;
  startHour: number;
  endHour: number;
  pricePerHour: number;
  freeFirstMin?: number | null;
  maxDurationH?: number | null;
  note?: string;
}

export interface ParkingData {
  id: string;
  zoneId: string;
  name: string;
  capacity: number;
  capacityPMR?: number;
  basePriceCHFh: number;
  peakMultiplier: number;
  offpeakMultiplier: number;
  freeFirstMinutes?: number | null;
  walkDistanceM: number;
  frictionIndex: number;
  source: string;
  license: string;
  confidence: number;
  notes?: string;
  rules?: ParkingRule[];
}

export interface ModeSplit {
  car: number;
  tp: number;
  covoiturage: number;
  tad: number;
  taxiBons: number;
}

export interface ZoneResult {
  zoneId: string;
  label: string;
  elasticityScore: number;
  category: 'vert' | 'orange' | 'rouge';
  shiftIndex: number;
  estimatedThreshold?: number;
  equityFlag: boolean;
  equityReason?: string;
  modeSplit: ModeSplit;
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

export interface TPData {
  id: string;
  zoneId: string;
  name: string;
  accessIndex: number;
  avgFrequencyMin: number;
  avgFareCHF: number;
  source?: string;
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
