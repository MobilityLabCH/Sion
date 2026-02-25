import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/scenario', label: 'Scénario', icon: '⊞' },
  { to: '/resultats', label: 'Résultats', icon: '◉' },
  { to: '/personas', label: 'Personas', icon: '◑' },
  { to: '/actions', label: 'Actions', icon: '▷' },
  { to: '/ameliorations', label: 'Améliorations', icon: '✦' },
];

const SEV_COLORS: Record<string, string> = {
  fluide: 'bg-green-400',
  modéré: 'bg-amber-400',
  dense: 'bg-orange-500',
  bloqué: 'bg-red-500',
};

export default function Layout() {
  const { results, scenario, trafficData, isLoadingTraffic } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center">
                <span className="text-white text-sm font-bold font-display">S</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-ink leading-none">Sion Mobility</div>
                <div className="text-xs text-ink-400 leading-none mt-0.5">Pricing Simulator</div>
              </div>
            </NavLink>

            {/* Nav links */}
            <nav className="flex items-center gap-0.5">
              {NAV.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-accent-50 text-accent'
                        : 'text-ink-500 hover:text-ink hover:bg-ink-50'
                    }`
                  }
                >
                  <span className="text-xs">{icon}</span>
                  <span className="hidden md:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Status badges */}
            <div className="flex items-center gap-2">
              {/* TomTom traffic indicator */}
              {isLoadingTraffic ? (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-300 px-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-200 animate-pulse" />
                  trafic…
                </div>
              ) : trafficData?.connected ? (
                <div className="hidden sm:flex items-center gap-1.5 bg-ink-50 text-ink-600 text-xs font-medium px-2.5 py-1 rounded-full border border-ink-200">
                  <span className={`w-1.5 h-1.5 rounded-full ${SEV_COLORS[trafficData.severity ?? 'fluide'] ?? 'bg-ink-300'} animate-pulse`} />
                  {trafficData.currentSpeed} km/h
                </div>
              ) : null}

              {/* Simulation shift badge */}
              {results && (
                <div className="hidden sm:flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {(results.globalShiftIndex * 100).toFixed(0)}% shift
                </div>
              )}

              <button
                onClick={() => navigate('/scenario')}
                className="btn-primary py-1.5 text-xs"
              >
                + Scénario
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-100 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-ink-400">
            Données indicatives · MobilityLab Sion 2025
            {trafficData?.connected && (
              <> · Trafic: <span className="font-medium">{trafficData.severity}</span> ({trafficData.currentSpeed} km/h)</>
            )}
          </span>
          <span className="text-xs text-ink-400">
            Sion Mobility Pricing Simulator v3.0
            {trafficData?.connected && ` · TomTom ${new Date(trafficData.timestamp!).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>
      </footer>
    </div>
  );
}
