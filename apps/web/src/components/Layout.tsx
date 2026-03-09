import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store';

const LOGO_URL = 'https://raw.githubusercontent.com/MobilityLabCH/Sion/main/Sion/Logo_Lockup_01_MobilityLab_Black_Red.png';

// Top nav now links to Dashboard hash tabs (Dashboard is the main app at '/')
const NAV = [
  { to: '/#simulator',  label: 'Simulateur', icon: '◈' },
  { to: '/#od',         label: 'Flux OD',    icon: '↗' },
  { to: '/#dashboard',  label: 'Résultats',  icon: '◉' },
  { to: '/#personas',   label: 'Personas',   icon: '◑' },
  { to: '/#actions',    label: 'Actions',    icon: '▷' },
  { to: '/#donnees',    label: 'Données',    icon: '⊞' },
];

const SEV_COLORS: Record<string, string> = {
  fluide: 'bg-green-400', modéré: 'bg-amber-400', dense: 'bg-orange-500', bloqué: 'bg-red-500',
};
const SEV_TEXT: Record<string, string> = {
  fluide: 'text-green-700', modéré: 'text-amber-700', dense: 'text-orange-700', bloqué: 'text-red-700',
};

export default function Layout() {
  const { results, trafficData, isLoadingTraffic } = useApp() as any;
  const navigate = useNavigate();
  const sev: string = trafficData?.severity ?? 'fluide';

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, to: string) {
    e.preventDefault();
    const [path, hash] = to.split('#');
    // Navigate to '/' then set the hash so Dashboard listens via hashchange
    if (window.location.pathname !== '/') {
      navigate('/');
      setTimeout(() => { window.location.hash = hash ?? ''; }, 50);
    } else {
      window.location.hash = hash ?? '';
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-40 h-12">
        <div className="h-full px-4 flex items-center justify-between gap-3">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src={LOGO_URL} alt="MobilityLab Sion" className="h-7 w-auto"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement;
                if (fb) fb.style.display = 'flex';
              }}/>
            <div className="hidden items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">ML</span>
              </div>
              <span className="text-sm font-semibold text-ink">MobilityLab</span>
            </div>
          </a>

          {/* Nav — links to Dashboard hash sections */}
          <nav className="flex items-center gap-0.5 flex-1 justify-center">
            {NAV.map(({ to, label, icon }) => {
              const hash = to.split('#')[1] ?? '';
              const isActive = window.location.pathname === '/' && window.location.hash === `#${hash}`;
              return (
                <a key={to} href={to}
                  onClick={(e) => handleNavClick(e, to)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive ? 'bg-red-50 text-red-700' : 'text-ink-500 hover:text-ink hover:bg-ink-50'
                  }`}>
                  <span className="text-[10px]">{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </a>
              );
            })}
          </nav>

          {/* Right: trafic + shift */}
          <div className="flex items-center gap-2 flex-shrink-0 text-xs">
            {isLoadingTraffic ? (
              <span className="hidden sm:flex items-center gap-1 text-ink-300">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-200 animate-pulse" />trafic…
              </span>
            ) : trafficData?.connected ? (
              <span className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium
                ${sev === 'fluide' ? 'bg-green-50 border-green-200' :
                  sev === 'modéré' ? 'bg-amber-50 border-amber-200' :
                  sev === 'dense'  ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${SEV_COLORS[sev] ?? 'bg-ink-300'}`} />
                <span className={SEV_TEXT[sev] ?? 'text-ink-600'}>{trafficData.currentSpeed} km/h · {sev}</span>
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

      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
