import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from "./hooks/store";
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ScenarioBuilder from './pages/ScenarioBuilder.tsx';
import Results from './pages/Results.tsx';
import Personas from './pages/Personas.tsx';
import Actions from './pages/Actions.tsx';
import Ameliorations from './pages/Ameliorations.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scenario" element={<ScenarioBuilder />} />
            <Route path="/resultats" element={<Results />} />
            <Route path="/personas" element={<Personas />} />
            <Route path="/actions" element={<Actions />} />
            <Route path="/ameliorations" element={<Ameliorations />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
