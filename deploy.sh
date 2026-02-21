#!/bin/bash
# ============================================================
# SION MOBILITY — Script de déploiement complet
# Worker déjà créé: sion.ericimstepf.workers.dev
# Repo: https://github.com/MobilityLabCH/Sion
# ============================================================

set -e

echo "🚀 Sion Mobility — Déploiement"
echo "================================"

# 1. Push vers GitHub
echo ""
echo "📦 Étape 1/4 — Push GitHub"
echo "--------------------------"
cd "$(dirname "$0")"

git init
git add .
git commit -m "feat: MVP complet — Sion Mobility Pricing Simulator v0.1"
git branch -M main
git remote add origin https://github.com/MobilityLabCH/Sion.git
git push -u origin main

echo "✅ Code pushé sur GitHub"

# 2. Installer dépendances
echo ""
echo "📦 Étape 2/4 — Installation des dépendances"
echo "--------------------------------------------"
npm install

# 3. Créer le namespace KV
echo ""
echo "🗄️  Étape 3/4 — Création KV Namespace"
echo "--------------------------------------"
echo "Exécutez manuellement:"
echo ""
echo "  npx wrangler kv:namespace create SION_KV"
echo "  npx wrangler kv:namespace create SION_KV --preview"
echo ""
echo "Puis mettez à jour apps/worker/wrangler.toml avec les IDs retournés."
echo "Appuyez sur Entrée pour continuer après cette étape..."
read -r

# 4. Déployer le Worker
echo ""
echo "⚡ Étape 4/4 — Déploiement Worker"
echo "---------------------------------"
cd apps/worker
npx wrangler deploy

echo ""
echo "✅ Worker déployé sur: https://sion.ericimstepf.workers.dev"
echo ""
echo "📋 Étape suivante: connecter Cloudflare Pages au repo GitHub"
echo "  → dash.cloudflare.com → Workers & Pages → Create → Pages"
echo "  → Connect to Git → MobilityLabCH/Sion"
echo "  → Build: npm run build:web | Output: apps/web/dist"
echo "  → Env var: VITE_API_URL = https://sion.ericimstepf.workers.dev/api"
