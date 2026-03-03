import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';

const NAV = [
  { to: '/', label: 'Simulateur', icon: '◈', end: true },
  { to: '/resultats', label: 'Résultats', icon: '◉', end: false },
  { to: '/personas', label: 'Personas', icon: '◑', end: false },
  { to: '/actions', label: 'Actions', icon: '▷', end: false },
  { to: '/ameliorations', label: 'Améliorations', icon: '✦', end: false },
];

export default function Layout() {
  const { results, trafficData } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-40 h-12">
        <div className="max-w-full px-4 h-full flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-ink leading-none">MobilityPricing</div>
              <div className="text-[10px] text-ink-400 leading-none mt-0.5">Sion · Valais CH</div>
            </div>
          </NavLink>

          <nav className="flex items-center gap-0.5">
            {NAV.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-accent-50 text-accent'
                      : 'text-ink-500 hover:text-ink hover:bg-ink-50'
                  }`
                }
              >
                <span className="text-[10px]">{icon}</span>
                <span className="hidden md:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            {trafficData?.connected && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                TomTom · {trafficData.currentSpeed} km/h
              </div>
            )}
            {results && (
              <div className="hidden sm:flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-2 py-1 rounded-full border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {(results.globalShiftIndex * 100).toFixed(0)}% shift
              </div>
            )}
            <button onClick={() => navigate('/')} className="btn-primary py-1 text-xs">
              + Simuler
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
