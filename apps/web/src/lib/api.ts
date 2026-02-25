import type { Scenario, SimulationResults, InsightsResponse, ActionsResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── TomTom Traffic Flow ──────────────────────────────────────────────────────
export interface TrafficData {
  connected: boolean;
  source?: string;
  timestamp?: string;
  area?: string;
  currentSpeed?: number;
  freeFlowSpeed?: number;
  confidence?: number;
  congestionIdx?: number;
  severity?: 'fluide' | 'modéré' | 'dense' | 'bloqué';
  note?: string;
  error?: string;
}

export async function simulate(
  scenario: Scenario
): Promise<{ scenario: Scenario; results: SimulationResults; trafficData?: TrafficData | null }> {
  return fetchJSON(`${API_BASE}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  });
}

export async function fetchInsights(
  scenario: Scenario,
  results: SimulationResults,
  includeImprovements = false
): Promise<InsightsResponse> {
  return fetchJSON(`${API_BASE}/insights`, {
    method: 'POST',
    body: JSON.stringify({ scenario, results, includeImprovements }),
  });
}

export async function fetchActions(
  scenario: Scenario,
  results: SimulationResults
): Promise<ActionsResponse> {
  return fetchJSON(`${API_BASE}/actions`, {
    method: 'POST',
    body: JSON.stringify({ scenario, results }),
  });
}

export async function fetchReport(
  scenario: Scenario,
  results: SimulationResults,
  insights: InsightsResponse,
  actions: ActionsResponse
): Promise<{ markdown: string; htmlPrintable: string }> {
  return fetchJSON(`${API_BASE}/report`, {
    method: 'POST',
    body: JSON.stringify({ scenario, results, insights, actions }),
  });
}

export async function fetchData(): Promise<{
  zones: any;
  parking: any[];
  tp: any[];
  personas: any[];
  meta?: { tomtomLive: boolean };
}> {
  return fetchJSON(`${API_BASE}/data`);
}

export async function healthCheck(): Promise<{
  status: string;
  ai: boolean;
  kv: boolean;
  tomtom: boolean;
}> {
  return fetchJSON(`${API_BASE}/health`);
}

/**
 * Récupère le trafic live.
 * Le backend peut renvoyer soit des champs “métriques” (currentSpeed, etc.)
 * soit une erreur; on unifie tout dans TrafficData.
 */
export async function fetchTrafficFlow(): Promise<TrafficData> {
  try {
    // On utilise fetchJSON pour gérer les erreurs HTTP proprement
    const data = await fetchJSON<any>(`${API_BASE}/traffic/flow`);

    // Si ton API renvoie déjà exactement TrafficData -> retourne direct
    // Sinon on essaye d’envelopper en gardant les champs utiles.
    return {
      connected: data?.connected ?? true,
      source: data?.source,
      timestamp: data?.timestamp,
      area: data?.area,
      currentSpeed: data?.currentSpeed,
      freeFlowSpeed: data?.freeFlowSpeed,
      confidence: data?.confidence,
      congestionIdx: data?.congestionIdx,
      severity: data?.severity,
      note: data?.note,
      error: data?.error,
    } as TrafficData;
  } catch (e: any) {
    return { connected: false, error: e?.message || 'Erreur réseau' };
  }
}
