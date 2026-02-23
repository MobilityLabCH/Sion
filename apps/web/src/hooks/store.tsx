import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

import type {
  Scenario,
  SimulationResults,
  InsightsResponse,
  ActionsResponse,
} from '../types';

import { DEFAULT_SCENARIO } from '../types';
import * as api from '../lib/api';
import type { TrafficData } from '../lib/api';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface AppState {
  scenario:          Scenario;
  results:           SimulationResults | null;
  insights:          InsightsResponse | null;
  actions:           ActionsResponse | null;
  trafficData:       TrafficData | null;
  isSimulating:      boolean;
  isLoadingInsights: boolean;
  isLoadingActions:  boolean;
  isLoadingTraffic:  boolean;
  error:             string | null;
  apiOnline:         boolean | null;
}

interface AppActions {
  setScenario:    (s: Scenario) => void;
  updateScenario: (patch: Partial<Scenario>) => void;
  runSimulation:  () => Promise<void>;
  loadInsights:   (includeImprovements?: boolean) => Promise<void>;
  loadActions:    () => Promise<void>;
  fetchTraffic:   () => Promise<void>;
  reset:          () => void;
}

type AppContextType = AppState & AppActions;

/* ─── Initial state ──────────────────────────────────────────────────────────── */

const initialState: AppState = {
  scenario:          DEFAULT_SCENARIO,
  results:           null,
  insights:          null,
  actions:           null,
  trafficData:       null,
  isSimulating:      false,
  isLoadingInsights: false,
  isLoadingActions:  false,
  isLoadingTraffic:  false,
  error:             null,
  apiOnline:         null,
};

/* ─── Context ────────────────────────────────────────────────────────────────── */

const AppContext = createContext<AppContextType | null>(null);

/* ─── Provider ───────────────────────────────────────────────────────────────── */

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const setScenario = useCallback((scenario: Scenario) => {
    setState(s => ({ ...s, scenario, results: null, insights: null, actions: null }));
  }, []);

  const updateScenario = useCallback((patch: Partial<Scenario>) => {
    setState(s => ({ ...s, scenario: { ...s.scenario, ...patch } }));
  }, []);

  const runSimulation = useCallback(async () => {
    setState(s => ({ ...s, isSimulating: true, error: null, insights: null, actions: null }));
    try {
      const { results, trafficData } = await api.simulate(state.scenario);
      setState(s => ({
        ...s,
        results,
        isSimulating: false,
        apiOnline: true,
        // Update trafficData from simulation response if fresher
        trafficData: trafficData ?? s.trafficData,
      }));
    } catch (err: any) {
      setState(s => ({
        ...s,
        isSimulating: false,
        error: err?.message ?? 'Simulation error',
        apiOnline: false,
      }));
    }
  }, [state.scenario]);

  const loadInsights = useCallback(async (includeImprovements = false) => {
    if (!state.results) return;
    setState(s => ({ ...s, isLoadingInsights: true }));
    try {
      const insights = await api.fetchInsights(state.scenario, state.results, includeImprovements);
      setState(s => ({ ...s, insights, isLoadingInsights: false }));
    } catch (err: any) {
      setState(s => ({ ...s, isLoadingInsights: false, error: err?.message ?? 'Insights error' }));
    }
  }, [state.scenario, state.results]);

  const loadActions = useCallback(async () => {
    if (!state.results) return;
    setState(s => ({ ...s, isLoadingActions: true }));
    try {
      const actions = await api.fetchActions(state.scenario, state.results);
      setState(s => ({ ...s, actions, isLoadingActions: false }));
    } catch (err: any) {
      setState(s => ({ ...s, isLoadingActions: false, error: err?.message ?? 'Actions error' }));
    }
  }, [state.scenario, state.results]);

  // Fetch TomTom live traffic data
  const fetchTraffic = useCallback(async () => {
    setState(s => ({ ...s, isLoadingTraffic: true }));
    try {
      const trafficData = await api.fetchTrafficFlow();
      setState(s => ({ ...s, trafficData, isLoadingTraffic: false }));
    } catch {
      setState(s => ({ ...s, isLoadingTraffic: false }));
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const value: AppContextType = {
    ...state,
    setScenario,
    updateScenario,
    runSimulation,
    loadInsights,
    loadActions,
    fetchTraffic,
    reset,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

/* ─── Hook ───────────────────────────────────────────────────────────────────── */

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export { AppContext };
