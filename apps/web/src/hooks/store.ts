import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Scenario, SimulationResults, InsightsResponse, ActionsResponse } from '../types.ts';
import { DEFAULT_SCENARIO } from '../types.ts';
import * as api from '../lib/api.ts';

interface AppState {
  scenario: Scenario;
  results: SimulationResults | null;
  insights: InsightsResponse | null;
  actions: ActionsResponse | null;
  isSimulating: boolean;
  isLoadingInsights: boolean;
  isLoadingActions: boolean;
  error: string | null;
  apiOnline: boolean | null;
}

interface AppActions {
  setScenario: (s: Scenario) => void;
  updateScenario: (patch: Partial<Scenario>) => void;
  runSimulation: () => Promise<void>;
  loadInsights: (includeImprovements?: boolean) => Promise<void>;
  loadActions: () => Promise<void>;
  reset: () => void;
}

const initialState: AppState = {
  scenario: DEFAULT_SCENARIO,
  results: null,
  insights: null,
  actions: null,
  isSimulating: false,
  isLoadingInsights: false,
  isLoadingActions: false,
  error: null,
  apiOnline: null,
};

const AppContext = createContext<(AppState & AppActions) | null>(null);

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
      const { results } = await api.simulate(state.scenario);
      setState(s => ({ ...s, results, isSimulating: false, apiOnline: true }));
    } catch (err: any) {
      setState(s => ({ ...s, isSimulating: false, error: err.message, apiOnline: false }));
    }
  }, [state.scenario]);

  const loadInsights = useCallback(async (includeImprovements = false) => {
    if (!state.results) return;
    setState(s => ({ ...s, isLoadingInsights: true }));
    try {
      const insights = await api.fetchInsights(state.scenario, state.results, includeImprovements);
      setState(s => ({ ...s, insights, isLoadingInsights: false }));
    } catch (err: any) {
      setState(s => ({ ...s, isLoadingInsights: false, error: err.message }));
    }
  }, [state.scenario, state.results]);

  const loadActions = useCallback(async () => {
    if (!state.results) return;
    setState(s => ({ ...s, isLoadingActions: true }));
    try {
      const actions = await api.fetchActions(state.scenario, state.results);
      setState(s => ({ ...s, actions, isLoadingActions: false }));
    } catch (err: any) {
      setState(s => ({ ...s, isLoadingActions: false, error: err.message }));
    }
  }, [state.scenario, state.results]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      setScenario, updateScenario, runSimulation, loadInsights, loadActions, reset,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// Exporter le provider comme default pour React.lazy
export { AppContext };
