# Méthodologie — Moteur de simulation

## 1. Vue d'ensemble

Le moteur est **déterministe** et basé sur un modèle de coûts généralisés par mode de transport, combiné avec un **choix modal par softmax** (modèle de type logit multinomial simplifié).

L'objectif est de produire des **ordres de grandeur crédibles** pour guider la décision publique, pas des prévisions précises.

---

## 2. Structure des coûts

### Coût voiture (CarCost)

```
CarCost = parkingCost + timeCostCar + frictionPenalty + kmCost
```

- **parkingCost** : prix effectif selon tarif pointe/creux, durée, pricing progressif
- **timeCostCar** : (carTimeMin / 60) × valueOfTimeCHFh
- **frictionPenalty** : frictionIndex × valueOfTimeCHFh × 0.3 (recherche de place)
- **kmCost** : distanceKm × 0.18 CHF/km (coût marginal, hors amortissement)

### Coût TP (TPCost)

```
TPCost = ticketPrice × (1 - discount) + timeCostTP + accessPenalty
```

- **ticketPrice** : tarif de base, réduit si hors-pointe selon discount scénario
- **timeCostTP** : (tpTimeMin + waitMin) / 60 × valueOfTimeCHFh
- **waitMin** : fréquence / 2 (attente moyenne)
- **accessPenalty** : (1 - accessIndex) × 2.5 CHF (pénalité marche + transferts)

### Coût covoiturage (si activé)

```
CovoiCost = CarCost × 0.6 + inconveniencePenalty
inconveniencePenalty = scheduleRigidity × valueOfTimeCHFh × 0.5 × 0.5h
```
- Éligible uniquement si `matchingPotential = (1 - scheduleRigidity × 0.7) > 0.3`

### Coût TAD (si activé)

```
TADCost = 2.50 CHF + distanceKm × 0.35 CHF + timeCostTAD
timeCostTAD = tpTimeMin × 1.2 / 60 × valueOfTimeCHFh
```

### Coût taxi-bons (si activé, personas éligibles)

```
TaxiBonsCost = (12 + distanceKm × 2.8) - 8 CHF + timeCostCar × 1.1
```
- Éligibles: personas avec tags `horaires atypiques`, `senior`, `mobilité réduite`, `décalé`, `urgent`

---

## 3. Choix modal (softmax)

Le choix modal utilise un **softmax sur les coûts ajustés par les préférences du persona** :

```
coûts ajustés:
- car_adj = carCost × (0.7 + carDependency × 0.6)
- tp_adj  = tpCost  × (1.2 - tpAffinity × 0.5)
- covoiturage, TAD, taxiBons: coûts bruts

softmax(c_i, T) = exp(-c_i / T) / Σ exp(-c_j / T)
```

**Température T = 0.6** : sensibilité modérée au différentiel de coût. Une valeur basse rend le choix très sensible aux prix; une valeur haute l'atténue.

---

## 4. Score d'élasticité (0–100)

```
elasticityScore = shiftIndex × 60 + accessBonus × 0.4 + priceSignal × 0.3 + alternativesBonus
```

- **shiftIndex** : bascule voiture → alternatives (0 à 1)
- **accessBonus** : tp.accessIndex × 30
- **priceSignal** : (prixCentre - prixBase) × 8, plafonné à 30
- **alternativesBonus** : +10 covoiturage, +8 TAD, +5 taxi-bons

Catégories:
- **Vert** (≥ 60): conditions très favorables à la bascule
- **Orange** (35–59): potentiel modéré
- **Rouge** (< 35): dépendance auto structurelle

---

## 5. Détection des risques équité

Un persona est flaggé "risque équité" si:
1. `income === 'faible'`
2. ET coût après > coût avant × 1.15 (hausse de 15%)
3. ET pas d'alternative accessible (TP, covoiturage, TAD)

---

## 6. Hypothèses et paramètres calibrables

| Paramètre | Valeur MVP | Source idéale |
|-----------|-----------|--------------|
| Durée court séjour | 1h | Enquêtes parking |
| Durée long séjour | 3.5h | Enquêtes parking |
| Coût km auto (marginal) | 0.18 CHF | TCS / OFROU |
| Température softmax | 0.6 | Calibration SP |
| Pénalité transfert | 2.5 CHF | Littérature TP suisse |
| Attente TP | fréquence / 2 | Horaires GTFS |
| Inconfort covoiturage | 0.5h × VoT | Calibration à faire |

---

## 7. Calibration future

Pour passer à un modèle de production:
1. **Enquêtes préférences révélées** sur les parkings sédunois (taux d'occupation, durées réelles)
2. **Calibration softmax** sur données enquête ménages déplacements
3. **GTFS réel** CFF/CarPostal pour temps TP précis
4. **Données emploi OFS** pour pendulaires intercommunaux
5. **Validation croisée** avec comptages voiture sur axes principaux

---

*Ce modèle est fourni comme base de réflexion stratégique. Les chiffres produits sont des ordres de grandeur.*
