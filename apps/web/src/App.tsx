import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './hooks/store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ScenarioBuilder from './pages/ScenarioBuilder';
import Results from './pages/Results';
import Personas from './pages/Personas';
import Actions from './pages/Actions';
import Ameliorations from './pages/Ameliorations';

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
