import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/store.ts';
import * as api from '../lib/api.ts';

const HORIZONS = [
  { key: 'horizon0_3' as const, label: '0–3 mois', color: 'bg-red-50 border-red-200 text-red-700', dotColor: 'bg-red-500', description: 'Actions immédiates: pilote, communication, mesures' },
  { key: 'horizon3_12' as const, label: '3–12 mois', color: 'bg-amber-50 border-amber-200 text-amber-700', dotColor: 'bg-amber-500', description: 'Consolidation: extension, ajustements, suivi' },
  { key: 'horizon12_36' as const, label: '12–36 mois', color: 'bg-blue-50 border-blue-200 text-blue-700', dotColor: 'bg-blue-500', description: 'Vision: transformation structurelle, investissements' },
];

const PRIORITY_COLORS: Record<string, string> = {
  haute: 'text-red-600 bg-red-50 border-red-200',
  moyenne: 'text-amber-600 bg-amber-50 border-amber-200',
  basse: 'text-green-600 bg-green-50 border-green-200',
};

export default function Actions() {
  const { results, scenario, insights, actions, loadActions, loadInsights, isLoadingActions, isLoadingInsights } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (results && !actions && !isLoadingActions) {
      loadActions();
    }
    if (results && !insights && !isLoadingInsights) {
      loadInsights();
    }
  }, [results]);

  const handleExportMarkdown = async () => {
    if (!results || !insights || !actions) return;
    setIsExporting(true);
    try {
      const { markdown } = await api.fetchReport(scenario, results, insights, actions);
      setMarkdownContent(markdown);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sion-mobility-${scenario.name?.replace(/\s+/g, '-').toLowerCase() || 'scenario'}-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintReport = async () => {
    if (!results || !insights || !actions) return;
    setIsExporting(true);
    try {
      const { htmlPrintable } = await api.fetchReport(scenario, results, insights, actions);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(htmlPrintable);
        win.document.close();
        setTimeout(() => win.print(), 500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!results) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="card p-10 max-w-md mx-auto">
          <div className="text-4xl mb-4">▷</div>
          <h2 className="section-title mb-2">Aucun résultat</h2>
          <p className="text-ink-500 text-sm mb-6">Simulez d'abord un scénario.</p>
          <button onClick={() => navigate('/scenario')} className="btn-primary mx-auto">Configurer →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="animate-fade-up flex items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Actions & Export</h1>
          <p className="text-ink-500 mt-1 text-sm">
            Plan d'action structuré sur 3 horizons · {scenario.name || 'Scénario'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportMarkdown}
            disabled={isExporting || !actions || !insights}
            className="btn-secondary"
          >
            ↓ Markdown
          </button>
          <button
            onClick={handlePrintReport}
            disabled={isExporting || !actions || !insights}
            className="btn-primary"
          >
            🖨 Rapport PDF
          </button>
        </div>
      </div>

      {/* Pilot 90j */}
      {insights?.pilot90Days && (
        <div className="card p-6 border-accent-200 bg-accent-50 animate-fade-up animate-fade-up-delay-1">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">90j</span>
            </div>
            <div>
              <div className="label-sm text-accent mb-1">Pilote recommandé</div>
              <h3 className="font-semibold text-ink">{insights.pilot90Days.title}</h3>
              <p className="text-sm text-ink-600 mt-1">{insights.pilot90Days.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {insights.pilot90Days.metrics.map((m, i) => (
                  <span key={i} className="text-xs bg-white border border-accent-200 text-accent-700 px-2.5 py-1 rounded-full">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan d'actions */}
      {(isLoadingActions || actions) ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {HORIZONS.map(horizon => (
            <div key={horizon.key} className="card overflow-hidden animate-fade-up animate-fade-up-delay-2">
              <div className={`p-4 border-b ${horizon.color.split(' ').filter(c => c.startsWith('border')).join(' ')} bg-opacity-50`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${horizon.dotColor}`} />
                  <h3 className="font-semibold text-sm text-ink">{horizon.label}</h3>
                </div>
                <p className="text-xs text-ink-500">{horizon.description}</p>
              </div>

              <div className="p-4 space-y-4">
                {isLoadingActions ? (
                  [1, 2].map(i => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 bg-ink-100 rounded animate-pulse w-3/4" />
                      <div className="h-2 bg-ink-50 rounded animate-pulse w-full" />
                      <div className="h-2 bg-ink-50 rounded animate-pulse w-2/3" />
                    </div>
                  ))
                ) : (
                  actions?.[horizon.key].map((action, i) => (
                    <div key={i} className="border-l-2 border-ink-200 pl-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-ink leading-tight">{action.title}</h4>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${PRIORITY_COLORS[action.priority]}`}>
                          {action.priority}
                        </span>
                      </div>
                      <p className="text-xs text-ink-600 mb-2">{action.description}</p>
                      <div className="text-xs text-ink-400">
                        <div className="font-medium">{action.owner}</div>
                        <div className="mt-1 space-y-0.5">
                          {action.metrics.map((m, j) => (
                            <div key={j}>• {m}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Communication draft */}
      {insights?.commDraft && (
        <div className="card p-6 animate-fade-up">
          <h2 className="font-semibold text-ink mb-3">Brouillon de communication</h2>
          <blockquote className="border-l-4 border-ink-200 pl-4 text-sm text-ink-600 italic leading-relaxed">
            {insights.commDraft}
          </blockquote>
          <p className="text-xs text-ink-400 mt-2">
            Communication neutre à adapter selon le canal (site web, communiqué de presse, réseaux sociaux).
          </p>
        </div>
      )}

      {/* Markdown preview */}
      {markdownContent && (
        <div className="card p-6 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">Aperçu Markdown exporté</h2>
            <button
              onClick={() => setMarkdownContent('')}
              className="btn-ghost text-xs"
            >
              Fermer
            </button>
          </div>
          <pre className="text-xs font-mono text-ink-600 bg-ink-50 p-4 rounded-xl overflow-auto max-h-80 whitespace-pre-wrap">
            {markdownContent.substring(0, 2000)}...
          </pre>
        </div>
      )}
    </div>
  );
}
