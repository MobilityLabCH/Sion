/**
 * ai.ts -- Prompts IA pour l'analyse de scenarios de mobilite
 *
 * Principes :
 *   - Ne jamais inventer de chiffres hors du contexte fourni
 *   - Rester dans le cadre du modele logit RUM tel que parametre
 *   - Reconnaitre les limites du modele (echelle, calibration)
 *   - Ton : administratif neutre, scientifiquement honnete
 *
 * Sources de reference integrees dans les prompts :
 *   - ARE Microrecensement 2015 (base de calibration)
 *   - sion.ch PDFs tarifs stationnement 2024-2025
 *   - Litterature en economie du transport (elasticite parking)
 *
 * Chemin : apps/worker/src/ai.ts
 */

import type { Scenario, SimulationResults, InsightsResponse, ActionsResponse } from './types.js';

export interface Env {
  AI: any;
  KV: KVNamespace;
  ENVIRONMENT?: string;
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ─── Contexte de reference (injecte dans chaque prompt) ──────────────────────

const SION_CONTEXT = `
CONTEXTE SION (a ne pas modifier, utiliser tels quels) :
- Ville de Sion, Valais, Suisse. Population : ~35 000 hab. (2025).
- Parkings publics centre : Planta (562 pl.), Scex (658 pl.), Cible (~204 pl.) = 1 424 pl. totales.
- Tarif officiel centre (baseline) : 1h gratuite + CHF 3.00/h (h2+). Source : sion.ch PDFs 2024-2025.
- P+R Potences (450 pl.) + Stade (460 pl.) = 910 pl. Tarif : GRATUIT. Bus BS11 toutes 10 min en pointe.
- Part modale voiture Sion centre (ARE Microrecensement 2015) : estimee ~62% trajets domicile-travail.
- Modele utilise : logit discret multinomial (Random Utility Model), temperature softmax T=1.5.
- IMPORTANT : les resultats sont des estimations d'ordre de grandeur. Aucune calibration sur enquete menage Sion n'a ete realisee. Toute decision politique requiert une validation terrain.
`.trim();

// ─── Prompt Insights ─────────────────────────────────────────────────────────

function buildInsightsPrompt(scenario: Scenario, results: SimulationResults): string {
  const zonesSummary = results.zoneResults
    .map(z =>
      `- ${z.label} : categorie ${z.category.toUpperCase()}, shift estime ${(z.shiftIndex * 100).toFixed(0)}%, elasticite ${z.elasticityScore}/100` +
      (z.equityFlag ? `, RISQUE EQUITE : ${z.equityReason ?? 'profils vulnerables'}` : '') +
      (z.avgParkingCostCHF !== undefined ? `, cout parking moyen CHF ${z.avgParkingCostCHF.toFixed(2)}` : '')
    )
    .join('\n');

  const mesures = [
    scenario.enableCovoiturage && 'covoiturage actif',
    scenario.enableTAD && 'TAD Valais actif',
    scenario.enableTaxiBons && 'taxi-bons actifs',
    scenario.tpOffpeakDiscountPct > 0 && `rabais TP hors-pointe ${scenario.tpOffpeakDiscountPct}%`,
  ].filter(Boolean).join(', ') || 'aucune mesure complementaire';

  const deltaVsCentre3 = scenario.centrePeakPriceCHFh - 3.0;
  const directionTarif = deltaVsCentre3 > 0 ? 'hausse tarifaire' : deltaVsCentre3 < 0 ? 'baisse tarifaire' : 'pas de changement tarifaire centre';

  return `${SION_CONTEXT}

SCENARIO ANALYSE :
- Tarif centre-ville : CHF ${scenario.centrePeakPriceCHFh.toFixed(1)}/h (${directionTarif} de ${Math.abs(deltaVsCentre3).toFixed(1)} CHF/h vs baseline)
- Tarif P+R peripherie : CHF ${scenario.peripheriePeakPriceCHFh.toFixed(2)}/h (baseline = GRATUIT)
- Multiplicateur progressif longue duree : ${scenario.progressiveSlopeFactor}x
- Mesures complementaires : ${mesures}
- Objectif declare : ${scenario.objective}

RESULTATS PAR ZONE (modele logit RUM, T=1.5) :
${zonesSummary}

SHIFT MODAL GLOBAL ESTIME : ${(results.globalShiftIndex * 100).toFixed(0)}%
RISQUES EQUITE DETECTES : ${results.equityFlags.length > 0 ? results.equityFlags.join(', ') : 'aucun'}

INSTRUCTION :
Tu es expert en economie du transport urbain en Suisse.
Analyse ce scenario de tarification stationnement pour Sion et produis une synthese CONCISE, FACTUELLE et PRUDENTE.

REGLES STRICTES :
1. N'invente AUCUN chiffre hors des donnees fournies ci-dessus.
2. Ne cite pas de pourcentages de report modal hors de ceux calcules (${(results.globalShiftIndex * 100).toFixed(0)}%).
3. Formule les conclusions avec le niveau de certitude approprie ("le modele suggere", "ordre de grandeur", "estimation").
4. Mentionne SYSTEMATIQUEMENT la limite : resultats a calibrer sur enquete menage avant decision.
5. Identifie les zones a fort potentiel ET les risques (equite, commerce, acceptabilite).
6. Maximum 5 bullets, 3 risques, ton administratif neutre.

Reponds UNIQUEMENT en JSON valide, sans markdown ni backticks. Structure exacte :
{
  "summaryBullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "risks": [
    {"risk": "description precise du risque", "mitigation": "mesure concrete proposee"}
  ],
  "pilot90Days": {
    "title": "Titre court du pilote",
    "description": "Description en 2 phrases max",
    "metrics": ["metrique 1", "metrique 2", "metrique 3"]
  },
  "commDraft": "Brouillon de communication neutre, 3-4 phrases, ton institutionnel Ville de Sion"
}`;
}

// ─── Prompt Actions ───────────────────────────────────────────────────────────

function buildActionsPrompt(scenario: Scenario, results: SimulationResults): string {
  const zonesRouges  = results.zoneResults.filter(z => z.category === 'rouge').map(z => z.label);
  const zonesVertes  = results.zoneResults.filter(z => z.category === 'vert').map(z => z.label);
  const equiteRisque = results.equityFlags.length > 0;
  const shiftPct     = (results.globalShiftIndex * 100).toFixed(0);

  const contextAction = `${SION_CONTEXT}

RESULTATS DE SIMULATION :
- Shift modal global estime : ${shiftPct}% (voiture vers alternatives)
- Zones a fort potentiel de bascule (VERT) : ${zonesVertes.join(', ') || 'aucune'}
- Zones a faible potentiel (ROUGE) : ${zonesRouges.join(', ') || 'aucune'}
- Risque equite : ${equiteRisque ? 'OUI -- ' + results.equityFlags.join(', ') : 'NON DETECTE'}
- Tarif centre simule : CHF ${scenario.centrePeakPriceCHFh.toFixed(1)}/h
- Tarif P+R simule : ${scenario.peripheriePeakPriceCHFh > 0 ? 'CHF ' + scenario.peripheriePeakPriceCHFh.toFixed(2) + '/h' : 'GRATUIT (inchange)'}
- Mesures actives : ${[scenario.enableCovoiturage && 'covoiturage', scenario.enableTAD && 'TAD', scenario.enableTaxiBons && 'taxi-bons'].filter(Boolean).join(', ') || 'aucune'}`;

  return `${contextAction}

INSTRUCTION :
Tu es specialiste en politique de mobilite urbaine suisse (procedures communales, acteurs institutionnels, contraintes juridiques Valais).
Genere un plan d'action REALISTE pour la Ville de Sion, base UNIQUEMENT sur les donnees ci-dessus.

REGLES STRICTES :
1. N'invente AUCUN chiffre non fourni.
2. Chaque action doit nommer l'acteur responsable reel : Ville de Sion (service mobilite), CarPostal Alpes, CFF Infrastructure, Canton du Valais (transports), ou CHVR.
3. Chaque metrique doit etre mesurable et realiste en contexte suisse (ex : taux d'occupation parking, comptages bus, recettes CHF/mois).
4. Actions proportionnees a la taille de Sion (ville moyenne, ~35 000 hab.).
5. Horizon 0-3 mois : mesures sans investissement majeur (tarification, communication, pilote limite).
6. Horizon 3-12 mois : ajustements sur la base du retour pilote, concertation.
7. Horizon 12-36 mois : investissements structures, revision reglementaire si necessaire.

Reponds UNIQUEMENT en JSON valide. Structure exacte :
{
  "horizon0_3": [
    {
      "title": "Titre court (max 8 mots)",
      "description": "Description precise en 2-3 phrases. Contexte Sion.",
      "owner": "Acteur responsable Sion",
      "metrics": ["metrique 1 mesurable", "metrique 2 mesurable"],
      "priority": "haute"
    }
  ],
  "horizon3_12": [...],
  "horizon12_36": [...]
}

Contrainte : 2 actions par horizon maximum. Priorite : haute / moyenne / basse.`;
}

// ─── Prompt Ameliorations produit ────────────────────────────────────────────

function buildImprovementsPrompt(): string {
  return `Tu es product manager senior pour un outil SaaS de simulation de politique de mobilite urbaine (Sion Mobility Pricing Simulator), destine aux responsables mobilite et elus de villes suisses de taille moyenne (20 000 a 100 000 hab.).

L'outil simule l'impact de la tarification des parkings sur le report modal, via un modele logit discret multinomial.

Propose 10 ameliorations produit / UX priorisees selon la methode MoSCoW. Chaque amelioration doit avoir une valeur concrete pour les decideurs publics suisses.

Reponds UNIQUEMENT en JSON valide :
{
  "improvements": [
    {
      "title": "Titre court",
      "priority": "M",
      "effort": "S",
      "value": "Valeur concrete pour le decideur public (1-2 phrases)"
    }
  ]
}

Legende priority : M=Must have, S=Should have, C=Could have, W=Won't have cette version
Legende effort : S=Small (<1 sem.), M=Medium (1-4 sem.), L=Large (>1 mois)

Focus : comparaison multi-scenarions, export rapport PDF/Word officiel, import donnees comptage reels, notification seuils, historique simulations.`;
}

// ─── Fallbacks deterministes ─────────────────────────────────────────────────

function fallbackInsights(scenario: Scenario, results: SimulationResults): InsightsResponse {
  const shiftPct      = (results.globalShiftIndex * 100).toFixed(0);
  const greenCount    = results.zoneResults.filter(z => z.category === 'vert').length;
  const redCount      = results.zoneResults.filter(z => z.category === 'rouge').length;
  const deltaVsBase   = scenario.centrePeakPriceCHFh - 3.0;
  const dirStr        = deltaVsBase > 0 ? 'superieur au baseline' : deltaVsBase < 0 ? 'inferieur au baseline' : 'identique au baseline';

  return {
    summaryBullets: [
      `Le modele logit RUM (T=1.5) estime un report modal de ${shiftPct}% (voiture vers alternatives) pour ce scenario. Ce chiffre est un ordre de grandeur ; une calibration sur enquete menage Sion est requise avant toute decision.`,
      `Tarif simule au centre-ville : CHF ${scenario.centrePeakPriceCHFh.toFixed(1)}/h (${dirStr} de CHF 3.00/h, baseline Planta/Scex 2025). ${greenCount} zone(s) presentent un potentiel de bascule eleve.`,
      redCount > 0
        ? `${redCount} zone(s) montrent un faible potentiel de bascule, probablement en raison d'une dependance automobile elevee ou d'une accessibilite TP limitee. Des mesures complementaires (TAD, covoiturage) pourraient etre evaluees.`
        : 'Toutes les zones analysees presentent un potentiel de bascule moyen a eleve avec ce scenario tarifaire.',
      results.equityFlags.length > 0
        ? `Risque equite identifie pour ${results.equityFlags.length} profil(s) : ${results.equityFlags.join(', ')}. Des mesures compensatoires ciblees (taxi-bons, abonnements TP subventionnes) devraient etre evaluees.`
        : 'Le modele ne detecte pas de risque equite majeur avec ces parametres. A confirmer par une analyse socio-economique des usagers cibles.',
      'Limite methodologique : resultats bases sur ARE Microrecensement 2015 et parametres comportementaux estimes. Aucune calibration sur donnees de comptage Sion reelles. Simulation d\'ordre de grandeur uniquement.',
    ],
    risks: [
      {
        risk: 'Report de la demande vers des parkings hors perimetre simule (voirie, zones non tarifees), annulant partiellement l\'effet attendu.',
        mitigation: 'Completer la mesure par une revision simultanee des zones horodateurs (source : sion.ch 03.2025) et surveiller l\'occupation des parkings non concernes.',
      },
      {
        risk: 'Impact negatif sur la frequentation commerciale du centre-ville si la hausse tarifaire n\'est pas accompagnee d\'une communication claire sur les alternatives (P+R Potences 450 pl., P+R Stade 460 pl., tous deux gratuits).',
        mitigation: 'Lancer une campagne de communication sur les P+R avant toute modification tarifaire. Mesurer la frequentation commerciale par enquete avant/apres.',
      },
      {
        risk: 'Acceptabilite politique et sociale : une hausse tarifaire peut etre percue comme une mesure punitive si les alternatives ne sont pas credibles et visibles.',
        mitigation: 'Associer la mesure a une amelioration tangible de l\'offre TP (frequence BS11, information voyageurs) et prevoir une periode de transition avec tarif progressif.',
      },
    ],
    pilot90Days: {
      title: 'Pilote tarifaire 90 jours -- Centre Sion',
      description: `Tester le tarif simule (CHF ${scenario.centrePeakPriceCHFh.toFixed(1)}/h) sur un perimetre limite (ex : Parking Planta uniquement) pendant 90 jours, avec mesure d'impact avant/apres sur l'occupation et la frequentation TP.`,
      metrics: [
        'Taux d\'occupation du parking pilote (comptage hebdomadaire)',
        'Frequentation bus BS11 (source : CarPostal, donnees valideurs)',
        'Recettes de stationnement pilote vs periode de reference N-1',
      ],
    },
    commDraft: `La Ville de Sion etudie une adaptation de la tarification de ses parkings publics (Planta, Scex, Cible) dans le cadre de sa politique de mobilite. Cette mesure vise a mieux gerer la demande de stationnement en centre-ville tout en favorisant l'usage des alternatives disponibles (P+R gratuits, transports publics). Les parkings relais Potences et Stade (910 places, acces gratuit, bus BS11 toutes les 10 minutes) restent une option privilegiee pour les usagers quotidiens. La Ville informera les usagers bien en avance de tout changement tarifaire.`,
  };
}

function fallbackActions(scenario: Scenario, results: SimulationResults): ActionsResponse {
  const hausse = scenario.centrePeakPriceCHFh > 3.0;
  const equite = results.equityFlags.length > 0;

  return {
    horizon0_3: [
      {
        title: 'Communication preventive sur les alternatives P+R',
        description: `Avant toute modification tarifaire, informer les usagers des parkings Planta/Scex/Cible de l'existence et des conditions d'acces aux P+R Potences (450 pl.) et Stade (460 pl.), tous deux gratuits et desservis par le bus BS11 toutes les 10 minutes en pointe. Installer une signalisation directionnelle renforcee depuis les axes principaux d'entree en ville.`,
        owner: 'Ville de Sion -- Service Mobilite',
        metrics: [
          'Taux d\'utilisation des P+R avant/apres campagne (comptage)',
          'Nombre d\'usagers informes (diffusion supports)',
        ],
        priority: 'haute',
      },
      {
        title: hausse ? 'Pilote tarifaire sur Parking Planta (90 jours)' : 'Evaluation de l\'impact sur l\'occupation des parkings',
        description: hausse
          ? `Tester le tarif de CHF ${scenario.centrePeakPriceCHFh.toFixed(1)}/h sur le Parking Planta uniquement, pendant 90 jours. Mesurer l'impact sur le taux d'occupation, les recettes et la frequentation TP. Conserver le tarif actuel (CHF 3.00/h) sur Scex et Cible le temps du pilote.`
          : `Realiser un comptage systematique de l'occupation des parkings publics (Planta, Scex, Cible) et des P+R (Potences, Stade) pour etablir un etat des lieux quantitatif servant de base de comparaison pour toute future modification tarifaire.`,
        owner: 'Ville de Sion -- Service Mobilite / Parkings Publics',
        metrics: [
          'Taux d\'occupation parking pilote J+30, J+60, J+90',
          'Recettes pilote vs meme periode annee N-1',
          'Frequentation bus BS11 (donnees CarPostal)',
        ],
        priority: 'haute',
      },
    ],
    horizon3_12: [
      {
        title: 'Analyse des resultats pilote et ajustement tarifaire',
        description: `Sur la base des donnees collectees lors du pilote de 90 jours, evaluer l'opportunite d'etendre le tarif simule a l'ensemble des parkings du centre (Planta, Scex, Cible) ou de l'ajuster. Presenter les resultats en commission mobilite avec indicateurs quantitatifs. Associer les representants des commercants de centre-ville a la consultation.`,
        owner: 'Ville de Sion -- Service Mobilite + Commission Mobilite',
        metrics: [
          'Rapport d\'evaluation pilote documente',
          'Concertation avec associations commercantes (compte-rendu)',
        ],
        priority: 'haute',
      },
      {
        title: equite ? 'Mise en place mesures compensatoires equite' : 'Amelioration information voyageurs P+R',
        description: equite
          ? `Evaluer la mise en place de mesures compensatoires pour les profils vulnerables identifies (${results.equityFlags.join(', ')}) : abonnements TP subventionnes en partenariat avec CarPostal Alpes / isireso-sion, ou extension du dispositif taxi-bons (seniors, PMR). Chiffrage en partenariat avec le Service social et le Canton du Valais.`
          : `Ameliorer la visibilite et l'information en temps reel sur la disponibilite des P+R (Potences, Stade) : panneaux dynamiques aux entrees de ville, integration dans l'application de navigation. En partenariat avec CarPostal Alpes pour l'information bus BS11.`,
        owner: equite ? 'Ville de Sion -- Service Social + CarPostal Alpes' : 'Ville de Sion -- Service Mobilite + CarPostal Alpes',
        metrics: [
          equite ? 'Nombre de beneficiaires dispositif compensatoire' : 'Taux d\'utilisation P+R avant/apres panneaux',
          'Satisfaction usagers (enquete courte)',
        ],
        priority: equite ? 'haute' : 'moyenne',
      },
    ],
    horizon12_36: [
      {
        title: 'Revision du reglement communal de stationnement',
        description: `Si les resultats du pilote valident l\'efficacite de la mesure tarifaire, entamer la revision formelle du reglement communal de stationnement (procedure administrative cantonale Valais). Integrer les nouvelles grilles tarifaires, les conditions des P+R et les mesures d\'equite. Soumettre en consultation publique conformement aux procedures de la Ville de Sion.`,
        owner: 'Ville de Sion -- Service Juridique + Service Mobilite',
        metrics: [
          'Adoption du nouveau reglement en conseil municipal',
          'Periode de transition clairement definie et communiquee',
        ],
        priority: 'moyenne',
      },
      {
        title: 'Etude d\'opportunite extension offre P+R',
        description: `Evaluer la capacite d\'absorption des P+R existants (Potences 450 pl., Stade 460 pl.) face a l\'evolution de la demande si la tarification centre augmente. Etudier l\'opportunite d\'une extension de capacite ou de nouveaux points P+R, en coherence avec le Plan cantonal des transports (Canton du Valais) et les projets de renforcement de l\'offre CarPostal / CFF.`,
        owner: 'Ville de Sion + Canton du Valais (DTE) + CarPostal Alpes',
        metrics: [
          'Rapport d\'opportunite P+R (go/no-go)',
          'Taux d\'occupation P+R existants en heure de pointe',
        ],
        priority: 'basse',
      },
    ],
  };
}

// ─── Appel IA ────────────────────────────────────────────────────────────────

export async function generateInsights(
  scenario: Scenario,
  results: SimulationResults,
  env: Env
): Promise<InsightsResponse> {
  if (!env.AI) return fallbackInsights(scenario, results);
  try {
    const prompt = buildInsightsPrompt(scenario, results);
    const response = await env.AI.run(MODEL, {
      prompt,
      max_tokens: 1200,
      temperature: 0.2,
    });
    const text = (response?.response ?? '').trim();
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed.summaryBullets || !parsed.risks) throw new Error('Structure invalide');
    return parsed as InsightsResponse;
  } catch (_) {
    return fallbackInsights(scenario, results);
  }
}

export async function generateActions(
  scenario: Scenario,
  results: SimulationResults,
  env: Env
): Promise<ActionsResponse> {
  if (!env.AI) return fallbackActions(scenario, results);
  try {
    const prompt = buildActionsPrompt(scenario, results);
    const response = await env.AI.run(MODEL, {
      prompt,
      max_tokens: 1200,
      temperature: 0.2,
    });
    const text = (response?.response ?? '').trim();
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed.horizon0_3 || !parsed.horizon3_12 || !parsed.horizon12_36) throw new Error('Structure invalide');
    return parsed as ActionsResponse;
  } catch (_) {
    return fallbackActions(scenario, results);
  }
}

export async function generateImprovements(env: Env): Promise<{ improvements: any[] }> {
  if (!env.AI) return { improvements: [] };
  try {
    const response = await env.AI.run(MODEL, {
      prompt: buildImprovementsPrompt(),
      max_tokens: 800,
      temperature: 0.3,
    });
    const text = (response?.response ?? '').trim();
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(jsonStr);
  } catch (_) {
    return { improvements: [] };
  }
}
