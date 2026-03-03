import { Outlet, NavLink } from 'react-router-dom';
import { useApp } from '../hooks/store';

const LOGO_URL = 'https://raw.githubusercontent.com/MobilityLabCH/Sion/main/Sion/Logo_Lockup_01_MobilityLab_Black_Red.png';

const NAV = [
  { to: '/', label: 'Simulateur', icon: '◈', end: true },
  { to: '/resultats', label: 'Résultats', icon: '◉' },
  { to: '/personas', label: 'Personas', icon: '◑' },
  { to: '/actions', label: 'Actions', icon: '▷' },
];

export default function Layout() {
  const { results, trafficData, simulationSource } = useApp() as any;

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-40 h-12">
        <div className="max-w-full px-4 h-full flex items-center justify-between gap-4">

          {/* Logo MobilityLab */}
          <NavLink to="/" className="flex items-center flex-shrink-0">
            <img
              src={LOGO_URL}
              alt="MobilityLab Sion"
              className="h-7 w-auto"
              onError={e => {
                // Fallback si GitHub inaccessible
                const el = e.currentTarget;
                el.style.display = 'none';
                const fb = el.nextElementSibling as HTMLElement;
                if (fb) fb.style.display = 'flex';
              }}
            />
            {/* Fallback texte */}
            <div className="hidden items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">ML</span>
              </div>
              <span className="text-sm font-semibold text-ink">MobilityLab</span>
            </div>
          </NavLink>

          {/* Nav */}
          <nav className="flex items-center gap-0.5">
            {NAV.map(({ to, label, icon, end }) => (
              <NavLink
                key={to} to={to} end={!!end}
                className={({ isActive }) =>
                  `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive ? 'bg-red-50 text-red-700' : 'text-ink-500 hover:text-ink hover:bg-ink-50'
                  }`
                }
              >
                <span className="text-[10px]">{icon}</span>
                <span className="hidden md:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Statut droite */}
          <div className="flex items-center gap-2 flex-shrink-0 text-xs">
            {(simulationSource as any) === 'local' && (
              <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-mono text-[10px]" title="Simulation locale — Worker inaccessible depuis ce réseau">
                ⚡ LOCAL
              </span>
            )}
            {trafficData?.connected ? (
              <span className="hidden sm:flex items-center gap-1.5 text-ink-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                TomTom {trafficData.currentSpeed} km/h
              </span>
            ) : null}
            {results && (
              <span className="hidden sm:flex items-center gap-1.5 bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {(results.globalShiftIndex * 100).toFixed(0)}% shift
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
