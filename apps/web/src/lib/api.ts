import type { Scenario, SimulationResults, InsightsResponse, ActionsResponse } from '../types.ts';

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

export async function simulate(scenario: Scenario): Promise<{ scenario: Scenario; results: SimulationResults }> {
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

export async function fetchActions(scenario: Scenario, results: SimulationResults): Promise<ActionsResponse> {
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

export async function fetchData(): Promise<{ zones: any; parking: any[]; tp: any[]; personas: any[] }> {
  return fetchJSON(`${API_BASE}/data`);
}

export async function healthCheck(): Promise<{ status: string; ai: boolean; kv: boolean }> {
  return fetchJSON(`${API_BASE}/health`);
}
