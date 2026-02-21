import type { Scenario, SimulationResults, InsightsResponse, ActionsResponse } from './types.js';

export function generateMarkdownReport(
  scenario: Scenario,
  results: SimulationResults,
  insights: InsightsResponse,
  actions: ActionsResponse
): string {
  const now = new Date().toLocaleDateString('fr-CH', { year: 'numeric', month: 'long', day: 'numeric' });

  const zoneTable = results.zoneResults.map(z =>
    `| ${z.label} | ${z.category.toUpperCase()} | ${(z.shiftIndex * 100).toFixed(0)}% | ${z.elasticityScore}/100 | ${z.equityFlag ? '⚠ Oui' : 'Non'} |`
  ).join('\n');

  const personaTable = results.personaResults.map(p =>
    `| ${p.emoji} ${p.label} | ${p.beforeCostCHF} CHF | ${p.afterCostCHF} CHF | ${p.costDeltaCHF > 0 ? '+' : ''}${p.costDeltaCHF} CHF | ${p.preferredMode} | ${p.equityFlag ? '⚠' : '✓'} |`
  ).join('\n');

  const risks = insights.risks.map(r =>
    `- **Risque:** ${r.risk}\n  **Mitigation:** ${r.mitigation}`
  ).join('\n\n');

  const actions0_3 = actions.horizon0_3.map(a =>
    `- **${a.title}** (${a.priority})\n  ${a.description}\n  *Responsable: ${a.owner}*\n  *Métriques: ${a.metrics.join(', ')}*`
  ).join('\n\n');

  const actions3_12 = actions.horizon3_12.map(a =>
    `- **${a.title}** (${a.priority})\n  ${a.description}\n  *Responsable: ${a.owner}*`
  ).join('\n\n');

  const actions12_36 = actions.horizon12_36.map(a =>
    `- **${a.title}** (${a.priority})\n  ${a.description}\n  *Responsable: ${a.owner}*`
  ).join('\n\n');

  return `# Sion Mobility Pricing Simulator – Rapport de Simulation

**Date:** ${now}  
**Scénario:** ${scenario.name || 'Simulation'}  
**Référence:** ${results.scenarioId}

---

## 1. Paramètres du scénario

| Paramètre | Valeur |
|-----------|--------|
| Tarif parking centre (pointe) | ${scenario.centrePeakPriceCHFh} CHF/h |
| Tarif parking centre (creux) | ${scenario.centreOffpeakPriceCHFh} CHF/h |
| Tarif parking périphérie (pointe) | ${scenario.peripheriePeakPriceCHFh} CHF/h |
| Pricing progressif | Facteur ${scenario.progressiveSlopeFactor}x |
| Rabais TP hors-pointe | ${scenario.tpOffpeakDiscountPct}% |
| Covoiturage | ${scenario.enableCovoiturage ? 'Activé' : 'Désactivé'} |
| TAD | ${scenario.enableTAD ? 'Activé' : 'Désactivé'} |
| Taxi-bons | ${scenario.enableTaxiBons ? 'Activé' : 'Désactivé'} |

---

## 2. Résultats par zone

**Shift global estimé: ${(results.globalShiftIndex * 100).toFixed(0)}%**

| Zone | Catégorie | Shift modal | Élasticité | Équité |
|------|-----------|-------------|------------|--------|
${zoneTable}

---

## 3. Synthèse décisionnelle

${insights.summaryBullets.map(b => `- ${b}`).join('\n')}

---

## 4. Risques & mitigations

${risks}

---

## 5. Impact par persona

| Persona | Coût avant | Coût après | Delta | Mode préféré | Équité |
|---------|-----------|-----------|-------|--------------|--------|
${personaTable}

---

## 6. Plan d'action

### Horizon 0–3 mois
${actions0_3}

### Horizon 3–12 mois
${actions3_12}

### Horizon 12–36 mois
${actions12_36}

---

## 7. Pilote 90 jours

**${insights.pilot90Days.title}**

${insights.pilot90Days.description}

**Métriques de suivi:**
${insights.pilot90Days.metrics.map(m => `- ${m}`).join('\n')}

---

## 8. Communication

> ${insights.commDraft}

---

## 9. Hypothèses & limites

${results.hypotheses.map(h => `- ${h}`).join('\n')}

---

*Document généré automatiquement par Sion Mobility Pricing Simulator. Données mock – ne pas utiliser pour décisions définitives sans calibration sur données réelles.*
`;
}

export function generateHTMLReport(markdown: string, title = 'Rapport Mobilité Sion'): string {
  // Conversion markdown → HTML basique
  const html = markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\| (.+) \|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim() && c.trim() !== '---' && !c.trim().match(/^-+$/));
      if (cells.length === 0) return '';
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    })
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      background: white;
      padding: 0;
    }
    
    .page {
      max-width: 21cm;
      margin: 0 auto;
      padding: 2cm 2.5cm;
    }
    
    .header {
      border-bottom: 3px solid #1a1a2e;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .header-left h1 {
      font-family: 'Source Serif 4', serif;
      font-size: 22pt;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1.2;
    }
    
    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #666;
    }
    
    h1 { font-family: 'Source Serif 4', serif; font-size: 18pt; font-weight: 700; margin: 2rem 0 0.8rem; color: #1a1a2e; }
    h2 { font-family: 'Source Serif 4', serif; font-size: 14pt; font-weight: 600; margin: 1.8rem 0 0.6rem; color: #1a1a2e; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3rem; }
    h3 { font-size: 11pt; font-weight: 600; margin: 1.2rem 0 0.4rem; color: #374151; }
    
    p { margin: 0.6rem 0; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 9.5pt;
    }
    
    th, td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tr:first-child td { background: #1a1a2e; color: white; font-weight: 600; }
    tr:nth-child(even) td { background: #f9fafb; }
    
    ul { padding-left: 1.5rem; margin: 0.6rem 0; }
    li { margin: 0.3rem 0; }
    
    blockquote {
      border-left: 3px solid #6366f1;
      padding: 0.8rem 1.2rem;
      background: #f5f3ff;
      border-radius: 0 4px 4px 0;
      font-style: italic;
      margin: 1rem 0;
    }
    
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    
    strong { font-weight: 600; }
    em { color: #6b7280; }
    
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      font-size: 8pt;
      color: #9ca3af;
      text-align: center;
    }
    
    @media print {
      body { padding: 0; }
      .page { padding: 1.5cm 2cm; max-width: 100%; }
      .no-print { display: none; }
      h2 { page-break-before: auto; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>Sion Mobility<br>Pricing Simulator</h1>
        <p style="font-size:10pt;color:#6366f1;font-weight:600;margin-top:0.3rem;">Rapport de simulation</p>
      </div>
      <div class="header-right">
        <p>Ville de Sion – Mobilité</p>
        <p>${new Date().toLocaleDateString('fr-CH')}</p>
        <p style="color:#9ca3af;font-size:8pt;">Document confidentiel – données mock</p>
      </div>
    </div>
    
    <div class="content">
      ${html}
    </div>
    
    <div class="footer">
      Généré par Sion Mobility Pricing Simulator · Données simulées à titre indicatif uniquement · Ne pas diffuser sans validation technique
    </div>
  </div>
  
  <div class="no-print" style="position:fixed;bottom:1rem;right:1rem;">
    <button onclick="window.print()" style="background:#1a1a2e;color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
      🖨 Imprimer / PDF
    </button>
  </div>
</body>
</html>`;
}
