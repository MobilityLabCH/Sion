# Guide de déploiement — Compte Cloudflare `ericimstepf`

> Worker existant: **sion** · URL cible: `https://sion.ericimstepf.workers.dev`  
> GitHub: `https://github.com/MobilityLabCH/Sion`

---

## Étape 1 — Pousser le code sur GitHub

```bash
cd /chemin/vers/dossier/sion-mvp

git init
git add .
git commit -m "feat: MVP Sion Mobility Pricing Simulator v0.1"
git branch -M main
git remote add origin https://github.com/MobilityLabCH/Sion.git
git push -u origin main
```

---

## Étape 2 — Créer le namespace KV

```bash
cd apps/worker

# Installer les dépendances d'abord
npm install

# Créer le namespace production
npx wrangler kv:namespace create SION_KV
# → Retourne: { binding: "KV", id: "abc123..." }

# Créer le namespace preview (dev local)
npx wrangler kv:namespace create SION_KV --preview
# → Retourne: { binding: "KV", preview_id: "xyz456..." }
```

Ouvrir `apps/worker/wrangler.toml` et **remplacer** les placeholders :

```toml
[[kv_namespaces]]
binding = "KV"
id = "abc123..."          # ← coller votre id ici
preview_id = "xyz456..."  # ← coller votre preview_id ici
```

---

## Étape 3 — Déployer le Worker

```bash
cd apps/worker
npx wrangler deploy
```

**Résultat attendu :**
```
✅ Deployed sion
   https://sion.ericimstepf.workers.dev
```

**Tester immédiatement :**
```bash
curl https://sion.ericimstepf.workers.dev/api/health
# → {"status":"ok","version":"0.1.0","ai":true,"kv":true}

curl https://sion.ericimstepf.workers.dev/api/data
# → {zones: {...}, parking: [...], tp: [...], personas: [...]}
```

---

## Étape 4 — Déployer le Frontend sur Cloudflare Pages

### Option A — Via Dashboard (recommandée)

1. Aller sur [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. Cliquer **Create** → onglet **Pages**
3. **Connect to Git** → sélectionner `MobilityLabCH/Sion`
4. Configurer le build :

| Paramètre | Valeur |
|-----------|--------|
| Framework preset | **Vite** |
| Build command | `npm run build:web` |
| Build output directory | `apps/web/dist` |
| Root directory | *(laisser vide)* |

5. **Environment variables** → Add variable :

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://sion.ericimstepf.workers.dev/api` |

6. Cliquer **Save and Deploy**

### Option B — Via CLI

```bash
# Depuis la racine du projet
npm run build:web

cd apps/web
VITE_API_URL=https://sion.ericimstepf.workers.dev/api npx wrangler pages deploy dist \
  --project-name=sion-mobility \
  --commit-message="MVP v0.1"
```

---

## Étape 5 — Vérification finale

Une fois les deux déployés :

```bash
# Worker
curl https://sion.ericimstepf.workers.dev/api/health

# Simulation test
curl -X POST https://sion.ericimstepf.workers.dev/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": {
      "centrePeakPriceCHFh": 4.0,
      "centreOffpeakPriceCHFh": 1.5,
      "peripheriePeakPriceCHFh": 0.0,
      "peripherieOffpeakPriceCHFh": 0.0,
      "progressiveSlopeFactor": 1.5,
      "tpOffpeakDiscountPct": 20,
      "enableCovoiturage": true,
      "enableTAD": false,
      "enableTaxiBons": true,
      "objective": "reduce-peak-car"
    }
  }'
```

---

## Bindings Cloudflare à vérifier

Dans le Dashboard Cloudflare → Workers → **sion** → **Settings** → **Bindings** :

| Binding | Type | Valeur |
|---------|------|--------|
| `AI` | Workers AI | *(automatique)* |
| `KV` | KV Namespace | `SION_KV` |

Si les bindings ne sont pas visibles après `wrangler deploy`, les ajouter manuellement via le Dashboard.

---

## Développement local

```bash
# À la racine
npm install

# Lancer frontend + worker en parallèle
npm run dev
# Frontend: http://localhost:5173
# Worker:   http://localhost:8787

# En local, Workers AI n'est pas disponible →
# le code bascule automatiquement sur les fallbacks déterministes
# (aucune clé ni compte requis pour développer)
```

---

## Structure des URLs finales

| Service | URL |
|---------|-----|
| Frontend | `https://sion-mobility.pages.dev` (ou domaine custom) |
| API Worker | `https://sion.ericimstepf.workers.dev/api` |
| Health check | `https://sion.ericimstepf.workers.dev/api/health` |
