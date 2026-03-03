// ScenarioBuilder.tsx — redirige vers Dashboard qui intègre maintenant tout le builder
// Cette page sert de fallback pour la navigation /scenario
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ScenarioBuilder() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/', { replace: true }); }, []);
  return null;
}
