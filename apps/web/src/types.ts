// ─── Types partagés frontend ─────────────────────────────────────────────────
// Ce fichier est également importé par le worker (via symlink ou copie).

export interface Scenario {
  id?: string;
  name?: string;

  // ── Parking centre (Planta/Scex/Cible)
  // Baseline réel Sion = 3.00 CHF/h après 1ère heure gratuite (source: sion.ch PDFs 2024-2025)
  centrePeakPriceCHFh:    number;  // 0–10
  centreOffpeakPriceCHFh: number;  // 0–10

  // ── Parking périphérie / P+R
  // Baseline réel Sion = 0 CHF (P+R Potences 450 pl. + Stade 460 pl., gratuits)
  peripheriePeakPriceCHFh:    number;  // 0–5
  peripherieOffpeakPriceCHFh: number;  // 0–5

  // ── Tarification progressive longue durée
  // 1.0 = barème officiel actuel (1h gratuit + CHF 3/h)
  // > 1.0 = majoration supplémentaire sur les heures au-delà de 1h
  progressiveSlopeFactor: number;  // 1.0–3.0

  // ── TP discount hors-pointe
  tpOffpeakDiscountPct: number;    // 0–50 (%)

  // ── Mesures complémentaires
  enableCovoiturage: boolean;
  enableTAD:         boolean;
  enableTaxiBons:    boolean;

  // ── Objectif principal
  objective: 'reduce-peak-car' | 'protect-short-stay' | 'equity-access';
}

/**
 * Situation ACTUELLE de Sion (baseline)
 * Sources: sion.ch/stationnement · PDFs Planta 15.07.2024 + Scex 11.08.2025
 *   - Centre: 1h gratuite + CHF 3.00/h (h2→h11) + CHF 0.20/h (>h11)
 *   - P+R Potences/Stade: GRATUIT, connexion BS 11 toutes les 10 min
 *   - Gratuit vendredi 17h → samedi 24h sur tous les parkings municipaux
 */
export const DEFAULT_SCENARIO: Scenario = {
  name: 'Nouveau scénario',
  centrePeakPriceCHFh:    3.0,   // CHF 3.00/h après 1h gratuite — Planta/Scex actuel
  centreOffpeakPriceCHFh: 3.0,   // idem (Sion: pas de tarif creux distinct actuellement)
  peripheriePeakPriceCHFh:    0.0,
  peripherieOffpeakPriceCHFh: 0.0,
  progressiveSlopeFactor: 1.0,
  tpOffpeakDiscountPct:   0,
  enableCovoiturage: false,
  enableTAD:         false,
  enableTaxiBons:    false,
  objective: 'reduce-peak-car',
};

// ─── Résultats simulation ────────────────────────────────────────────────────

export interface ModeSplit {
  car:         number;
  tp:          number;
  covoiturage: number;
  tad:         number;
  taxiBons:    number;
}

export interface ZoneResult {
  zoneId:             string;
  label:              string;
  elasticityScore:    number;        // 0–100
  category:           'vert' | 'orange' | 'rouge';
  shiftIndex:         number;        // 0–1 : fraction de bascule voiture → alternatives
  estimatedThreshold?: number;       // CHF/h estimé de déclenchement bascule
  equityFlag:         boolean;
  equityReason?:      string;
  modeSplit:          ModeSplit;
}

export interface PersonaResult {
  personaId:          string;
  label:              string;
  emoji:              string;
  beforeCostCHF:      number;
  afterCostCHF:       number;
  costDeltaCHF:       number;
  preferredMode:      string;
  preferredModeBefore: string;
  equityFlag:         boolean;
  tags:               string[];
  explanation:        string[];
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
    fromZoneId:  string;
    toZoneId:    string;
    timeWindow:  'peak' | 'offpeak';
    durationType: 'short' | 'long';
  };
  tags:       string[];
  income:     'faible' | 'moyen' | 'élevé';
  alternatives: string[];
}
