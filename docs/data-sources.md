# 6. Données — Open Data First (traçables, crédibles)

## Principe directeur
Toute donnée intégrée dans l'outil **doit exposer** :
- `source` : organisation émettrice + URL
- `date` : date de dernière mise à jour
- `licence` : OGD-CH / CC-BY / ODbL / Commercial
- `confidence` : niveau de fiabilité de 0 à 1

Niveaux de confiance affichés dans l'UI :
| Badge | Seuil | Signification |
|---|---|---|
| `✓ RÉEL` | ≥ 0.80 | Données officielles, vérifiées, récentes |
| `⚠ ESTIMÉ` | 0.40–0.79 | Extrapolations ou données partielles |
| `~ HYP` | < 0.40 | Hypothèse de modèle, à calibrer |

---

## A. Fonds de carte

### Sources prioritaires (ordre de préférence)

**1. geo.admin.ch / swisstopo (officiel, gratuit)**
- URL : `https://api3.geo.admin.ch/rest/services/all/MapServer`
- Couches pertinentes :
  - `ch.swisstopo.swissimage` : orthophoto Suisse (résolution 10 cm)
  - `ch.are.gemeindetypen` : typologies communes
  - `ch.bfs.volkszaehlung2020-bevoelkerung-gemeinde` : densité population
- Licence : OGD-CH (gratuit, attribution requise)
- Format : WMTS / GeoJSON / MVT
- Confiance : 1.00

**2. GeoValais — SIT Valais (cantonal)**
- URL : `https://map.geo.vs.ch`
- Couches pertinentes :
  - Réseau routier cantonal
  - Zones à bâtir / planification
  - Périmètres communes
- Licence : OGD-CH (demande d'accès via formulaire SIT Valais)
- Confiance : 0.95

**3. OpenStreetMap (complément piéton/vélo)**
- Tiles : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- Routing piéton/vélo : OpenRouteService (`https://api.openrouteservice.org`)
- Licence : ODbL — attribution requise `© OSM contributors`
- Usage : isochrones marche, réseau cyclable, POI
- Confiance : 0.80

---

## B. Stationnement

### Dataset open bike-and-car-parking (national)
- URL : `https://opentransportdata.swiss/dataset/bike-and-car-parking`
- Opérateur : Opendata.swiss / SBB Open Data
- Couverture Sion : partielle (gare CFF uniquement confirmée)
- Format : JSON / GeoJSON, mis à jour en temps réel pour P+R gérés par SBB
- Licence : OGD-CH
- **Action** : vérifier couverture Planta/Scex dans le dataset avant import
- Confiance : 0.75 (couverture incomplète centre-ville)

### Données Ville de Sion (à demander au service mobilité)

| Donnée | Format souhaité | Source | Confiance actuelle |
|---|---|---|---|
| Inventaire parkings (id, nom, adresse, capacité, PMR) | CSV ou GeoJSON | Service mobilité | ⚠ 0.95 — données embarquées issues de sion.ch |
| Coordonnées GPS des entrées/sorties | GeoJSON | SIG Ville de Sion | ⚠ 0.60 — coordonnées estimées |
| Règles tarifaires 2025 (prix, durée, gratuités) | JSON structuré ou PDF | Arrêté Conseil Communal | ✓ 0.95 — gratuité ven/sam confirmée |
| Zones horodateurs (périmètre exact) | SHP ou GeoJSON | SIG Ville de Sion | ~ 0.40 — non intégré |
| Zones bleues (durée limitée, sans paiement) | SHP ou GeoJSON | SIG Ville de Sion | ~ 0.40 — non intégré |
| Comptages entrées/sorties (même 1 semaine test) | CSV timestampé | Opérateur parkings | ~ 0.00 — manquant (CRITIQUE) |

**Structure JSON règles tarifaires recommandée :**
```json
{
  "id": "planta",
  "name": "Parking de la Planta",
  "capacity": 570,
  "coordinates": [7.3589, 46.2328],
  "source": "sion.ch · 2025-07-15",
  "license": "OGD-CH",
  "confidence": 0.95,
  "rules": [
    { "dayType": "weekday",  "startHour": 7,  "endHour": 18, "pricePerHour": 3.00, "freeFirstMin": 60 },
    { "dayType": "friday",   "startHour": 17, "endHour": 24, "pricePerHour": 0.00, "note": "Gratuit — arrêté CC 2023" },
    { "dayType": "saturday", "startHour": 0,  "endHour": 24, "pricePerHour": 0.00, "note": "Gratuit — arrêté CC 2023" }
  ]
}
```

---

## C. Transports publics

### GTFS Static (horaires planifiés)
- Source : **opentransportdata.swiss** (plateforme nationale officielle)
- URL : `https://opentransportdata.swiss/dataset/timetable-2025-gtfs2020`
- Contenu : tous les horaires CFF, CarPostal, lignes urbaines Sion
- Mise à jour : annuelle (décembre)
- Licence : OGD-CH
- Lignes pertinentes Sion : Urbain 1, 2, 3, 4 + CarPostal régional
- Confiance : 0.95

### GTFS Realtime (temps réel)
- Source : opentransportdata.swiss — flux SIRI-ET / GTFS-RT
- URL API : `https://api.opentransportdata.swiss/gtfsrt2020`
- Contenu : retards, suppressions, véhicules en temps réel
- Accès : token API gratuit (inscription sur opentransportdata.swiss)
- Confiance : 0.90

### Arrêts bus géolocalisés
- Inclus dans GTFS (`stops.txt`) ou via API :
  `https://transport.opendata.ch/v1/locations?query=Sion`
- Tous les arrêts officiels avec coordonnées GPS, codes UIC
- Confiance : 1.00

---

## D. Trafic & Routage

### TomTom Traffic Flow v4 (live)
- Endpoint : `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json`
- Paramètres utilisés : `point=46.2333,7.3595` (Grand-Pont Sion)
- Données : vitesse actuelle, vitesse flux libre, indice congestion
- Accès : **via proxy Worker Cloudflare sécurisé** (clé API jamais exposée au client)
- Fréquence : polling 5 min, cache KV Cloudflare
- Licence : Commercial (API key MobilityLab)
- Confiance : 0.90

### TomTom Routing (calcul d'itinéraires)
- Endpoint : `https://api.tomtom.com/routing/1/calculateRoute/`
- Usage prévu : calcul temps conduite origine → parking (Modes OD)
- Non encore intégré — Phase 1 priorité SHOULD
- Alternative open source : OpenRouteService (ORS) — gratuit, précis Suisse

### Alternative open source (pare-feu réseau entreprise)
Si TomTom inaccessible depuis un réseau filtré :
- **OpenRouteService** : `https://api.openrouteservice.org`
- **GraphHopper** : `https://graphhopper.com/api/`
- **Valhalla** (auto-hébergeable) : routing engine open source

---

## E. Origine-Destination (comportements)

### ARE Microrecensement mobilité et transports 2021
- Source : Office fédéral du développement territorial (ARE)
- URL : `https://www.are.admin.ch/mrmt`
- Contenu : distances, durées, modes, motifs de déplacement par commune
- Format : SPSS / CSV (accès sur demande ou via OFS)
- Licence : OGD-CH
- Confiance pour Sion : 0.60 (données 2021, granularité communale)
- **À faire** : extraire les déplacements depuis/vers Sion + communes voisines

### Enquête ménages-déplacements (si disponible Ville de Sion)
- Potentiellement disponible via PCC (Plan de circulation communal)
- Confiance si disponible : 0.85

---

## F. Ce qui manque — Données critiques à obtenir

| Priorité | Donnée | Qui peut la fournir | Impact sur le modèle |
|---|---|---|---|
| 🔴 CRITIQUE | Comptages entrées/sorties parkings Planta + Scex (même 2 semaines) | Opérateur (Ville ou prestataire) | Calibration occupation réelle → résultats 3× plus fiables |
| 🔴 CRITIQUE | Coordonnées GPS exactes entrées/sorties parkings | SIG Ville de Sion | Calcul marche parking→destination |
| 🟠 IMPORTANT | Plan zones horodateurs + zones bleues (SHP) | Service urbanisme Sion | Modèle spatial complet |
| 🟠 IMPORTANT | Fréquentation commerces centre-ville ven/sam | Association des commerçants | Valider hypothèse attractivité |
| 🟡 UTILE | Enquête mobilité résidentielle (même partielle) | Service mobilité ou MFS | Calibrer VOT et profils réels |
| 🟡 UTILE | Données GTFS Realtime CarPostal | opentransportdata.swiss | TP en temps réel dans simulation |
