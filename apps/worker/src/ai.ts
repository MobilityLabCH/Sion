import type { Scenario, SimulationResults, InsightsResponse, ActionsResponse } from './types.js';

export interface Env {
  AI: any;
  KV: KVNamespace;
  ENVIRONMENT?: string;
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildInsightsPrompt(scenario: Scenario, results: SimulationResults): string {
  const zonesSummary = results.zoneResults
    .map(z => `- ${z.label}: catégorie ${z.category.toUpperCase()}, shift ${(z.shiftIndex * 100).toFixed(0)}%, élasticité ${z.elasticityScore}/100${z.equityFlag ? ', ⚠ équité' : ''}`)
    .join('\n');

  return `Tu es un expert en mobilité urbaine suisse. Analyse ce scénario de tarification de stationnement pour la ville de Sion (Valais, Suisse) et produis une synthèse décisionnelle structurée.

PARAMÈTRES DU SCÉNARIO:
- Tarif parking centre pointe: ${scenario.centrePeakPriceCHFh} CHF/h
- Tarif parking centre creux: ${scenario.centreOffpeakPriceCHFh} CHF/h  
- Tarif parking périphérie pointe: ${scenario.peripheriePeakPriceCHFh} CHF/h
- Pricing progressif: facteur ${scenario.progressiveSlopeFactor}x
- Rabais TP hors-pointe: ${scenario.tpOffpeakDiscountPct}%
- Covoiturage activé: ${scenario.enableCovoiturage ? 'OUI' : 'NON'}
- TAD activé: ${scenario.enableTAD ? 'OUI' : 'NON'}
- Taxi-bons activés: ${scenario.enableTaxiBons ? 'OUI' : 'NON'}
- Objectif: ${scenario.objective}

RÉSULTATS PAR ZONE:
${zonesSummary}

SHIFT GLOBAL: ${(results.globalShiftIndex * 100).toFixed(0)}%
RISQUES ÉQUITÉ: ${results.equityFlags.join(', ') || 'Aucun'}

INSTRUCTIONS: Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication hors JSON. Structure exacte:
{
  "summaryBullets": ["bullet 1 (max 2 lignes)", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "risks": [
    {"risk": "description du risque", "mitigation": "mesure proposée"}
  ],
  "pilot90Days": {
    "title": "Titre du pilote 90 jours",
    "description": "Description courte",
    "metrics": ["métrique 1", "métrique 2", "métrique 3"]
  },
  "commDraft": "Brouillon de communication neutre à l'attention des usagers (3-4 phrases)"
}

Ton: administratif neutre. Ne pas inventer de chiffres non calculés. Maximum 5 bullets, 4 risques.`;
}

function buildActionsPrompt(scenario: Scenario, results: SimulationResults): string {
  return `Tu es un expert en politique de mobilité suisse. Génère un plan d'action structuré pour Sion (Valais) basé sur ce scénario de tarification.

SHIFT GLOBAL: ${(results.globalShiftIndex * 100).toFixed(0)}%
ZONES CRITIQUES: ${results.zoneResults.filter(z => z.category === 'rouge').map(z => z.label).join(', ') || 'aucune'}
ÉQUITÉ: ${results.equityFlags.join(', ') || 'RAS'}
MESURES ACTIVES: ${[
    scenario.enableCovoiturage ? 'covoiturage' : '',
    scenario.enableTAD ? 'TAD' : '',
    scenario.enableTaxiBons ? 'taxi-bons' : ''
  ].filter(Boolean).join(', ') || 'aucune mesure complémentaire'}

Réponds UNIQUEMENT en JSON valide, structure exacte:
{
  "horizon0_3": [
    {"title": "...", "description": "...", "owner": "Ville de Sion / CFF / CarPostal", "metrics": ["..."], "priority": "haute"}
  ],
  "horizon3_12": [...],
  "horizon12_36": [...]
}

Contraintes: 2-3 actions par horizon, ton administratif neutre, mesures réalistes pour une ville suisse de taille moyenne.`;
}

function buildImprovementsPrompt(): string {
  return `Tu es product manager pour une application web de simulation de tarification de mobilité urbaine (Sion Mobility Pricing Simulator).

Propose 10 améliorations produit/UX priorisées selon la méthode MoSCoW.

Réponds UNIQUEMENT en JSON valide:
{
  "improvements": [
    {
      "title": "Titre court",
      "priority": "M",
      "effort": "S",
      "value": "Description de la valeur ajoutée pour les décideurs"
    }
  ]
}

Légende priority: M=Must have, S=Should have, C=Could have, W=Won't have (cette version)
Légende effort: S=Small (<1 semaine), M=Medium (1-4 semaines), L=Large (>1 mois)

Focus: app décisionnelle pour collectivités suisses. Pense analyse comparative, import données réelles, export rapport PDF officiel, notifications, etc.`;
}

// ─── Fallbacks déterministes ─────────────────────────────────────────────────

function fallbackInsights(scenario: Scenario, results: SimulationResults): InsightsResponse {
  const greenCount = results.zoneResults.filter(z => z.category === 'vert').length;
  const redCount = results.zoneResults.filter(z => z.category === 'rouge').length;
  const shiftPct = (results.globalShiftIndex * 100).toFixed(0);

  return {
    summaryBullets: [
      `Le scénario produit un shift modal estimé à ${shiftPct}% (voiture vers alternatives) sur l'ensemble des zones analysées.`,
      `${greenCount} zone(s) présentent un potentiel de bascule élevé; l'enjeu principal se concentre sur les zones à forte fréquentation et faible accessibilité TP.`,
      `La tarification progressive (facteur ${scenario.progressiveSlopeFactor}x) est le levier le plus direct pour décourager le stationnement longue durée en centre.`,
      results.enableCovoiturage || scenario.enableTAD
        ? 'Les mesures complémentaires (covoiturage / TAD) améliorent l\'attractivité des alternatives pour les personas à faible flexibilité horaire.'
        : 'L\'absence de mesures complémentaires limite l\'efficacité pour les personas à forte dépendance automobile.',
      results.equityFlags.length > 0
        ? `Vigilance équité: ${results.equityFlags.length} profil(s) à risque identifié(s). Des mesures compensatoires (taxi-bons, abonnements TP ciblés) sont recommandées.`
        : 'Aucun risque équité majeur détecté avec les paramètres actuels du scénario.',
    ],
    risks: [
      {
        risk: 'Report de trafic vers zones non tarifées (périphérie, voirie résidentielle)',
        mitigation: 'Extension progressive de la tarification à l\'ensemble du périmètre urbain + zones résidentielles',
      },
      {
        risk: 'Résistance commerciale: perte de clientèle courte durée si tarif centre trop élevé',
        mitigation: 'Maintien d\'une tranche gratuite (15-30 min) ou tarification dégressive pour 1ère heure',
      },
      {
        risk: 'Capacité TP insuffisante en pointe pour absorber la demande reportée',
        mitigation: 'Coordination avec CFF/CarPostal pour renforcement offre avant déploiement',
      },
      {
        risk: 'Acceptabilité politique et sociale difficile sans communication préalable',
        mitigation: 'Pilote sur périmètre limité + concertation + bilan 90 jours transparent',
      },
    ],
    pilot90Days: {
      title: 'Pilote Centre-Gare: tarification modulée + mesure d\'impact',
      description: 'Déploiement sur les zones Centre et Gare avec les paramètres du scénario, suivi mensuel des indicateurs clés.',
      metrics: [
        'Taux d\'occupation parking centre (avant/après, pointe vs creux)',
        'Fréquentation TP lignes urbaines (variation %)',
        'Satisfaction usagers: enquête courte (NPS) à J+45 et J+90',
      ],
    },
    commDraft: `Dans le cadre de sa politique de mobilité durable, la Ville de Sion adapte ses tarifs de stationnement pour mieux répartir l'usage des parkings selon les périodes de la journée. L'objectif est de faciliter l'accès au centre-ville pour les courtes durées tout en encourageant le report modal vers les transports en commun. Des mesures d'accompagnement sont prévues pour les publics les plus sensibles. Toutes les informations sont disponibles sur le site de la Ville.`,
  };
}

function fallbackActions(scenario: Scenario, results: SimulationResults): ActionsResponse {
  return {
    horizon0_3: [
      {
        title: 'Lancement pilote tarification modulée Centre + Gare',
        description: 'Déployer les nouveaux tarifs sur les zones Centre et Gare. Mise à jour signalétique. Communication grand public.',
        owner: 'Ville de Sion – Service Mobilité',
        metrics: ['Taux d\'occupation parking (hebdomadaire)', 'Recettes parking vs prévisions'],
        priority: 'haute',
      },
      {
        title: 'Mise en place tableau de bord de suivi',
        description: 'Instrumenter la collecte de données: comptages, enquêtes, données parking en temps réel.',
        owner: 'Ville de Sion – SIG / Informatique',
        metrics: ['Données disponibles J+7', 'Tableau de bord opérationnel J+30'],
        priority: 'haute',
      },
    ],
    horizon3_12: [
      {
        title: 'Extension tarification zones secondaires (Est, Ouest)',
        description: 'Après évaluation du pilote, étendre la tarification modulée aux zones périphériques du centre.',
        owner: 'Ville de Sion + partenaires communes',
        metrics: ['Couverture zones tarifées (%)', 'Report trafic mesuré'],
        priority: 'moyenne',
      },
      {
        title: scenario.enableTAD ? 'Renforcement offre TAD: nouvelles plages horaires' : 'Étude faisabilité TAD soirée/weekend',
        description: 'Couvrir les plages horaires non desservies par TP régulier pour réduire la dépendance automobile.',
        owner: 'CarPostal / CFF Régional + Ville',
        metrics: ['Voyages TAD/mois', 'Taux remplissage'],
        priority: 'moyenne',
      },
    ],
    horizon12_36: [
      {
        title: 'Déploiement P+R et navettes cadencées',
        description: 'Activer les parkings périphériques comme P+R avec navettes directes vers centre, intégrés dans l\'offre TP.',
        owner: 'Ville de Sion + CFF + CarPostal',
        metrics: ['Capacité P+R activée', 'Fréquentation navettes', 'Part modale voiture centre'],
        priority: 'haute',
      },
      {
        title: 'Révision complète schéma de mobilité intercommunal',
        description: 'Intégrer la tarification dans une politique mobilité à l\'échelle de l\'agglomération sédunoise.',
        owner: 'Ville de Sion + communes partenaires + Canton Valais',
        metrics: ['Adoption plan intercommunal', 'Indicateurs mobilité durable'],
        priority: 'moyenne',
      },
    ],
  };
}

// ─── Fonctions publiques ─────────────────────────────────────────────────────

export async function generateInsights(
  scenario: Scenario,
  results: SimulationResults,
  env: Env,
  includeImprovements = false
): Promise<InsightsResponse> {
  if (!env.AI) {
    const fallback = fallbackInsights(scenario, results);
    if (includeImprovements) {
      fallback.improvements = fallbackImprovements();
    }
    return fallback;
  }

  try {
    const prompt = includeImprovements
      ? buildImprovementsPrompt()
      : buildInsightsPrompt(scenario, results);

    const response = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'Tu es un expert en mobilité urbaine suisse. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1200,
      temperature: 0.3,
    });

    const text = response?.response || response?.result?.response || '';
    // Nettoyer le JSON (supprimer backticks markdown si présents)
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (includeImprovements && parsed.improvements) {
      return { summaryBullets: [], risks: [], pilot90Days: { title: '', description: '', metrics: [] }, commDraft: '', ...parsed };
    }

    return {
      summaryBullets: parsed.summaryBullets || [],
      risks: parsed.risks || [],
      pilot90Days: parsed.pilot90Days || { title: '', description: '', metrics: [] },
      commDraft: parsed.commDraft || '',
    };
  } catch (err) {
    console.error('AI error, using fallback:', err);
    const fallback = fallbackInsights(scenario, results);
    if (includeImprovements) fallback.improvements = fallbackImprovements();
    return fallback;
  }
}

export async function generateActions(
  scenario: Scenario,
  results: SimulationResults,
  env: Env
): Promise<ActionsResponse> {
  if (!env.AI) {
    return fallbackActions(scenario, results);
  }

  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'Tu es un expert en politique de mobilité suisse. Réponds uniquement en JSON valide.' },
        { role: 'user', content: buildActionsPrompt(scenario, results) },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const text = response?.response || response?.result?.response || '';
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      horizon0_3: parsed.horizon0_3 || [],
      horizon3_12: parsed.horizon3_12 || [],
      horizon12_36: parsed.horizon12_36 || [],
    };
  } catch (err) {
    console.error('AI error for actions, using fallback:', err);
    return fallbackActions(scenario, results);
  }
}

function fallbackImprovements() {
  return [
    { title: 'Import données réelles parking (API ville)', priority: 'M' as const, effort: 'M' as const, value: 'Remplace les données mock par des données en temps réel pour des simulations fiables' },
    { title: 'Export rapport PDF officiel', priority: 'M' as const, effort: 'M' as const, value: 'Permet aux décideurs de partager le rapport en format institutionnel' },
    { title: 'Comparaison multi-scénarios (A vs B)', priority: 'M' as const, effort: 'M' as const, value: 'Visualiser deux scénarios côte à côte accélère la prise de décision' },
    { title: 'Sauvegarde et partage de scénarios (lien URL)', priority: 'S' as const, effort: 'S' as const, value: 'Facilite la collaboration entre services sans compte nécessaire' },
    { title: 'Données GTFS réelles CFF / CarPostal', priority: 'S' as const, effort: 'L' as const, value: 'Calcul précis des temps TP avec les horaires officiels' },
    { title: 'Historique des simulations avec tableau de bord', priority: 'S' as const, effort: 'M' as const, value: 'Suivi de l\'évolution des hypothèses et décisions dans le temps' },
    { title: 'Mode accessibilité (contraste, police)', priority: 'S' as const, effort: 'S' as const, value: 'Conformité WCAG pour institutions publiques suisses' },
    { title: 'Intégration données emploi (pendulaires OFS)', priority: 'C' as const, effort: 'L' as const, value: 'Améliore la précision des personas et des flux' },
    { title: 'Notifications email rapport hebdomadaire', priority: 'C' as const, effort: 'M' as const, value: 'Maintient les décideurs informés sans revenir sur la plateforme' },
    { title: 'Version multilingue (DE/FR)', priority: 'W' as const, effort: 'L' as const, value: 'Utile pour canton bilingue mais hors scope MVP' },
  ];
}
