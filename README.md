# Sion Mobility Pricing Simulator

> Simulateur de tarification de mobilité pour la Ville de Sion (Valais, Suisse)  
> Stack: React + Vite + TypeScript / Cloudflare Pages + Workers + Workers AI + KV

---

## Table des matières

1. [Présentation](#présentation)
2. [Installation & développement local](#installation--développement-local)
3. [Architecture](#architecture)
4. [Déploiement Cloudflare](#déploiement-cloudflare)
5. [Bindings & variables](#bindings--variables)
6. [Données mock](#données-mock)
7. [Tests](#tests)
8. [Limites & prochaines étapes](#limites--prochaines-étapes)

---

## Présentation

Le **Sion Mobility Pricing Simulator** est un outil d'aide à la décision permettant de simuler l'impact de politiques de tarification du stationnement et des transports publics sur la mobilité sédunoise.

### Fonctionnalités MVP
- **Dashboard** avec carte MapLibre des zones colorées selon potentiel de bascule modale
- **Configurateur de scénario** : sliders prix parking (centre/périphérie), pricing progressif, rabais TP, mesures complémentaires (covoiturage, TAD, taxi-bons)
- **Moteur de simulation déterministe** : softmax multi-modal pour 8 zones et 12 personas
- **Résultats par zone** : élasticité, shift index, mode split, risques équité
- **Impact personas** : coût avant/après, bascule modale, risques équité
- **Plan d'actions** 3 horizons (0–3 / 3–12 / 12–36 mois) généré par Workers AI
- **Export** Markdown + rapport HTML imprimable (PDF via impression navigateur)
- **Améliorations produit** : Workers AI génère 10 recommandations MoSCoW

---

## Installation & développement local

### Prérequis
- Node.js ≥ 18
- npm ≥ 9
- (Optionnel) Compte Cloudflare pour le déploiement

### 1. Cloner le repo

```bash
git clone https://github.com/MobilityLabCH/SION.git
cd SION
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Démarrer en développement

**Option A — Full stack (recommandé):**
```bash
npm run dev
```
Lance simultanément:
- Frontend sur `http://localhost:5173` (via `apps/web`)
- Worker API sur `http://localhost:8787` (via `apps/worker`)

**Option B — Frontend seul (sans worker):**
```bash
npm run dev:web
```
> Le frontend proxy les appels `/api/*` vers le worker. Si le worker n'est pas démarré, les appels échoueront.

**Option C — Worker seul:**
```bash
npm run dev:worker
```

---

## Architecture

```
SION/
├── apps/
│   ├── web/                    # Frontend React + Vite + TypeScript
│   │   ├── src/
│   │   │   ├── components/     # ZoneMap, KPICard, SliderField, ToggleField...
│   │   │   ├── hooks/          # store.ts (state global via Context)
│   │   │   ├── lib/            # api.ts (client HTTP vers worker)
│   │   │   └── pages/          # Dashboard, ScenarioBuilder, Results, Personas, Actions, Ameliorations
│   │   └── ...
│   └── worker/                 # Cloudflare Worker TypeScript
│       └── src/
│           ├── index.ts        # Router HTTP (GET /api/health, POST /api/simulate, etc.)
│           ├── simulator.ts    # Moteur de simulation déterministe (softmax)
│           ├── ai.ts           # Intégration Workers AI + fallbacks déterministes
│           ├── report.ts       # Génération rapport Markdown + HTML
│           └── types.ts        # Types partagés
├── data/                       # Datasets mock (GeoJSON + JSON)
│   ├── zones.geojson
│   ├── parking.json
│   ├── tp.json
│   └── personas.json
└── docs/                       # Documentation technique
    ├── methodology.md
    ├── data-sources.md
    └── roadmap.md
```

### API Worker (`/api/*`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Statut worker + bindings AI/KV |
| GET | `/api/data` | Datasets mock (zones, parking, TP, personas) |
| POST | `/api/simulate` | `{scenario}` → `{results}` |
| POST | `/api/insights` | `{scenario, results}` → synthèse AI |
| POST | `/api/actions` | `{scenario, results}` → plan d'actions |
| POST | `/api/report` | `{scenario, results, insights, actions}` → markdown + HTML |

---

## Déploiement Cloudflare

### 1. Créer le namespace KV

```bash
npx wrangler kv:namespace create "SION_KV"
# Copier l'id retourné
npx wrangler kv:namespace create "SION_KV" --preview
# Copier le preview_id
```

Mettre à jour `apps/worker/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV"
id = "VOTRE_ID_ICI"
preview_id = "VOTRE_PREVIEW_ID_ICI"
```

### 2. Déployer le Worker

```bash
npm run deploy:worker
# ou directement:
cd apps/worker && npx wrangler deploy
```

Notez l'URL du worker (ex: `https://sion-mobility-worker.VOTRE_SOUS_DOMAINE.workers.dev`)

### 3. Déployer le Frontend (Cloudflare Pages)

**Option A — Via CLI:**
```bash
# Définir l'URL du worker
echo "VITE_API_URL=https://sion-mobility-worker.VOTRE_SOUS_DOMAINE.workers.dev/api" > apps/web/.env.production

npm run build:web
cd apps/web && npx wrangler pages deploy dist --project-name=sion-mobility
```

**Option B — Via Dashboard Cloudflare (recommandé):**
1. Dashboard Cloudflare → Pages → Créer un projet
2. Connecter votre repo GitHub (`MobilityLabCH/SION`)
3. Framework preset: **Vite**
4. Build command: `npm run build:web`
5. Build output: `apps/web/dist`
6. Variable d'environnement: `VITE_API_URL` = URL de votre Worker

### 4. Relier le frontend au worker (Routes)

Dans `apps/web` déploié sur Pages, ajouter une règle de routage vers le Worker:

**Option 1 — Workers Routes (Dashboard):**
- Cloudflare → Workers → Routes → Ajouter
- Pattern: `sion-mobility.pages.dev/api/*`
- Worker: `sion-mobility-worker`

**Option 2 — `_routes.json` (Cloudflare Pages Functions proxy):**
Créer `apps/web/public/_routes.json`:
```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```
Et un proxy function `apps/web/functions/api/[[path]].ts` qui forward vers le worker.

> Pour un MVP, l'option la plus simple est de configurer `VITE_API_URL` directement avec l'URL complète du worker.

---

## Bindings & variables

### Worker (`wrangler.toml`)

| Binding | Type | Description |
|---------|------|-------------|
| `AI` | Workers AI | Génération insights (llama-3.1-8b-instruct) |
| `KV` | KV Namespace | Stockage scénarios et résultats |

### Frontend (variables d'environnement)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `VITE_API_URL` | URL complète de l'API worker | `/api` (proxy local) |

### Fichier `.dev.vars` (développement local)

Créer `apps/worker/.dev.vars` pour simuler les bindings localement:
```
# Les bindings AI et KV sont simulés automatiquement par wrangler dev
# Aucune variable supplémentaire requise pour le MVP
ENVIRONMENT=development
```

> **Note:** En développement local, `env.AI` sera `undefined` → le code bascule automatiquement sur les fallbacks déterministes (pas besoin de compte Cloudflare pour développer).

---

## Données mock

Toutes les données sont dans `/data/`:

| Fichier | Contenu |
|---------|---------|
| `zones.geojson` | 8 zones Sion (polygones GeoJSON simplifiés) |
| `parking.json` | Capacité, prix, friction par zone |
| `tp.json` | Accessibilité TP, fréquences, tarifs par zone |
| `personas.json` | 12 profils usagers (valeur du temps, sensibilité prix, dépendance auto...) |

Ces données sont **bundlées dans le worker** via les imports JSON statiques.

---

## Tests

```bash
npm run test:worker
```

3 tests unitaires (`apps/worker/src/simulator.test.ts`):
1. **Cohérence softmax** : somme à 1, monotonie, bornes [0, 1]
2. **Hausse prix parking → shift diminue** : tarif centre × 3.3 réduit la part voiture
3. **Covoiturage améliore le shift** : activation → part covoiturage augmente, shift global stable ou meilleur

---

## Limites & prochaines étapes

### Limites MVP

- **Données mock uniquement** : les résultats sont des ordres de grandeur, pas des prévisions
- **Modèle simplifié** : softmax sans calibration sur données réelles
- **KV** : pas de gestion de comptes utilisateurs, pas de partage multi-utilisateurs
- **Carte** : zones GeoJSON simplifiées (polygones manuels, pas de vraies limites cadastrales)
- **Workers AI** : disponibilité variable; fallbacks déterministes activés automatiquement

### Prochaines étapes (voir `/docs/roadmap.md`)

- V1.1: Import données réelles parking (API Ville de Sion), GTFS CFF/CarPostal
- V1.2: Comparaison multi-scénarios A vs B
- V2: Migration KV → D1 (SQL), historique, dashboard de suivi
- V2+: Intégration données emploi OFS, modèle de déplacement agrégé calibré

---

*Développé par MobilityLab CH · Données mock uniquement · Ne pas utiliser pour décisions définitives sans calibration*
