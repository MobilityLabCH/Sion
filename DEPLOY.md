# Guide de déploiement — Sion Mobility Pricing Simulator

## ✅ Corrections appliquées (v3.1)

- **SliderField.tsx** : ajout des props `referenceValue` et `referenceLabel` (erreur TS2322 corrigée)
- **ToggleField.tsx** : ajout de la prop `icon` (erreur TS2322 corrigée)
- **api.ts** : déplacement de l'interface `TrafficData` avant son utilisation

---

## 🔑 Problème TomTom — CAUSE RACINE

Votre clé TomTom est configurée dans le **mauvais endroit** sur Cloudflare.

### ❌ INCORRECT (ce que vous avez fait)
```
Cloudflare → Workers & Pages → "sion" icône △ (Pages) → Settings → Variables
→ sion-cet.pages.dev
```
Cette clé n'est **pas accessible** par le Worker qui fait les appels TomTom.

### ✅ CORRECT (ce qu'il faut faire)

**Étape 1 : Ouvrir le bon Worker**
```
dash.cloudflare.com → Workers & Pages
→ Chercher "sion" avec l'icône ⬡ (hexagone = Worker)
→ Pas l'icône △ (triangle = Pages)
→ L'URL sera : sion.ericimstepf.workers.dev
```

**Étape 2 : Ajouter la clé**
```
→ Settings → Variables and Secrets → + Add variable
→ Type: Secret
→ Name: TOMTOM_API_KEY
→ Value: [votre clé API TomTom]
```

**Étape 3 : Obtenir la BONNE clé TomTom**
```
my.tomtom.com → Se connecter → Keys
→ Cliquer sur "My First API key" (ou votre clé)
→ Bouton "Copy API Key" (chaîne de ~32 caractères)

⚠️  NE PAS copier l'UUID/ID du projet (format xxxxxxxx-xxxx-xxxx-xxxx)
✅  Copier la vraie clé API (format alphanumérique)
```

### Vérification
Après avoir configuré la clé dans le Worker, visitez :
```
https://sion.ericimstepf.workers.dev/api/health
```
Vous devez voir `"tomtom": true`.

Puis testez le flux trafic :
```
https://sion.ericimstepf.workers.dev/api/traffic/flow
```

---

## 🚀 Déploiement Cloudflare Pages (frontend)

Le frontend se déploie automatiquement depuis GitHub sur la branche `main`.

**Commande de build dans Cloudflare Pages Settings :**
```bash
cd apps/web && npm install && npm run build
```

**Output directory :** `apps/web/dist`

**Variable d'environnement (dans Pages, pas le Worker) :**
```
VITE_API_URL = https://sion.ericimstepf.workers.dev/api
```

---

## 🔧 Déploiement Worker (backend)

```bash
cd apps/worker
npx wrangler deploy
```

Ou via Cloudflare → Workers → "sion" (⬡) → Deploy.

---

## 🏗 Structure des deux entités Cloudflare

```
Cloudflare Workers & Pages
├── sion (△ Pages)        → sion-cet.pages.dev
│   ├── Build: apps/web
│   ├── Variable: VITE_API_URL
│   └── ⚠️  PAS de TOMTOM_API_KEY ici
│
└── sion (⬡ Worker)       → sion.ericimstepf.workers.dev
    ├── Source: apps/worker
    ├── Secret: TOMTOM_API_KEY  ← ICI ✅
    └── Binding: AI (Workers AI)
```
