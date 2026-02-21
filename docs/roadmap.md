# Roadmap — Sion Mobility Pricing Simulator

## MVP (v0.1) — Livré ✅

- Monorepo React + Cloudflare Worker
- 5 pages: Dashboard, Scénario, Résultats, Personas, Actions
- Moteur de simulation déterministe (softmax)
- 8 zones, 12 personas, données mock
- Cloudflare Workers AI (insights + fallback)
- Export Markdown + HTML imprimable
- Page Améliorations (auto-itération produit)
- Tests vitest (3 tests unitaires)

---

## V1.1 (sprint ~4 semaines)

### Données
- [ ] Import données réelles parking Ville de Sion (CSV upload ou API)
- [ ] GTFS CFF/CarPostal → temps TP et fréquences précis par zone
- [ ] Vraies limites de zones (swisstopo / SIG Sion)

### Fonctionnalités
- [ ] Comparaison multi-scénarios (A vs B, side-by-side)
- [ ] Sauvegarde scénarios avec lien partageable (URL hash)
- [ ] Améliorations UX: tooltips, légendes interactives carte
- [ ] Export PDF amélioré (mise en page officielle)

### Technique
- [ ] Migration KV → Cloudflare D1 (base SQL pour scénarios)
- [ ] CI/CD GitHub Actions (build + test + deploy automatique)
- [ ] Error monitoring basique (Cloudflare Analytics)

---

## V1.2 (sprint ~6 semaines)

### Modélisation
- [ ] Calibration softmax sur données enquêtes (si disponibles)
- [ ] Mode vélo: coût + temps + infrastructures disponibles
- [ ] Matrice OD (origine-destination) pour flux entre zones
- [ ] Saturation parking: demande vs capacité, modélisation congestion

### Fonctionnalités
- [ ] Tableau de bord de suivi: métriques réelles vs simulées
- [ ] Historique des simulations avec chronologie
- [ ] Notifications email: rapport hebdomadaire (Cloudflare Email Workers)
- [ ] Mode accessibilité (WCAG AA)

---

## V2.0 (trimestre 2–3)

### Architecture
- [ ] **Migration KV → D1** (SQLite serverless Cloudflare)
  - Scénarios, résultats, personas personnalisés
  - Requêtes SQL complexes (comparaisons, agrégations)
- [ ] **Cloudflare R2** pour stockage rapports PDF
- [ ] Multi-tenant: comptes organisations (Ville, Canton, consultants)

### Modélisation avancée
- [ ] Intégration données emploi OFS (pendulaires intercommunaux)
- [ ] Modèle de trafic agrégé (4 étapes simplifié)
- [ ] Sensibilité paramétrique: "que se passe-t-il si la fréquence TP double ?"
- [ ] Scénarios combinés: parking + TP + urbanisme

### Analytics & IA
- [ ] Fine-tuning modèle IA sur données Valais (si volume suffisant)
- [ ] Génération automatique d'alertes (seuils dépassés)
- [ ] Analyse comparative avec villes similaires (Sierre, Martigny, Visp)

---

## V3.0 (horizon 12–18 mois)

- [ ] Module de suivi post-déploiement: comparer simulé vs observé
- [ ] API publique documentée (pour tiers: consultants, académique)
- [ ] Version multilingue (FR/DE pour contexte valaisan)
- [ ] Intégration SITG / infrastructure géomatique cantonale
- [ ] Module formation/sensibilisation pour élus et techniciens

---

## Notes techniques

### Migrations importantes

**KV → D1 (V1.2):**
```typescript
// Avant (KV)
await env.KV.put(`scenario:${id}`, JSON.stringify(data));

// Après (D1)
await env.DB.prepare(
  'INSERT INTO scenarios (id, name, params, results) VALUES (?, ?, ?, ?)'
).bind(id, name, JSON.stringify(params), JSON.stringify(results)).run();
```

**Raisons de migrer vers D1:**
- Requêtes SQL pour comparaisons, filtres, agrégations
- Meilleure cohérence transactionnelle
- Coûts prévisibles à l'usage
- Pas de limite de taille par clé (KV: 25 MB/valeur)

---

*Roadmap non contractuelle, ajustable selon priorités métier*
