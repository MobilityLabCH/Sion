# Sources de données & intégration future

## 1. Données actuelles (MVP)

Toutes les données sont mock, créées manuellement dans `/data/`:

| Fichier | Contenu mock | Statut |
|---------|-------------|--------|
| `zones.geojson` | 8 zones polygonales approximatives | Mock |
| `parking.json` | Capacité, prix, friction estimés | Mock |
| `tp.json` | Accessibilité TP, fréquences estimées | Mock |
| `personas.json` | 12 profils types synthétiques | Mock |

---

## 2. Données réelles disponibles

### Parkings (Ville de Sion)
- **Source**: Service de la mobilité, Ville de Sion
- **Format attendu**: CSV ou API JSON avec `zoneId, capacity, currentOccupancy, priceMatrix`
- **Intégration**: Remplacer `parking.json` ou créer endpoint `/api/live-parking`
- **Fréquence**: Temps réel idéal; hebdomadaire acceptable pour simulation

### Transports Publics (GTFS)
- **Source**: [GTFS Suisse — opentransportdata.swiss](https://opentransportdata.swiss/fr/dataset/timetable-2024-gtfs2020)
- **Format**: GTFS standard (`stops.txt`, `trips.txt`, `stop_times.txt`)
- **Intégration**: Parser GTFS pour calculer fréquences et temps de parcours par zone
- **Outil recommandé**: `gtfs-utils` (Node.js) ou `conveyal/r5` pour le routage

### Données emploi (OFS)
- **Source**: OFS Microrecensement Mobilité et Transports (MZ)
- **Données utiles**: matrice OD pendulaires, taux motorisation par commune, distance domicile-travail
- **Format**: CSV agrégé par commune

### Comptages trafic (OFROU / Canton VS)
- **Source**: OFROU — Trafic suisse / SRCE Canton Valais
- **Données utiles**: TMJA, pointes horaires, taux occupation véhicules
- **URL**: [www.astra.admin.ch/comptages](https://www.astra.admin.ch/astra/fr/home/documentation/donnees-et-statistiques.html)

### Zones cadastrales / périmètre urbain
- **Source**: [swisstopo — swissBOUNDARIES3D](https://www.swisstopo.admin.ch/fr/modele-topographique-du-territoire-swissboundaries3d)
- **Format**: Shapefile / GeoJSON
- **Usage**: Remplacer les polygones manuels par les vraies limites de quartiers

---

## 3. Pipeline d'intégration recommandé (V1)

```
opentransportdata.swiss (GTFS) 
    ↓ [cron job hebdomadaire]
    → Parser & agréger fréquences/temps par zone
    → Stocker en D1 (SQLite)
    
Ville de Sion (API parkings)
    ↓ [cron job horaire ou quotidien]
    → Normaliser & stocker en D1
    
Cloudflare Worker /api/data
    → Lire D1 au lieu des JSON statiques
```

### Exemple de migration JSON → D1

```sql
-- Schema D1
CREATE TABLE parking_zones (
  zone_id TEXT PRIMARY KEY,
  capacity INTEGER,
  base_price_chfh REAL,
  peak_multiplier REAL,
  offpeak_multiplier REAL,
  long_stay_share REAL,
  friction_index REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tp_zones (
  zone_id TEXT PRIMARY KEY,
  access_index REAL,
  time_to_center_min INTEGER,
  peak_freq_min INTEGER,
  offpeak_freq_min INTEGER,
  ticket_base_chf REAL,
  offpeak_discount_max REAL
);
```

```typescript
// Worker avec D1
const parking = await env.DB.prepare('SELECT * FROM parking_zones').all();
```

---

## 4. APIs tierces à éviter (MVP)

Ces sources nécessiteraient des clés API ou comptes payants:
- ❌ Google Maps Platform (geocoding, directions)
- ❌ HERE Maps
- ❌ OpenRouteService (version cloud)

Alternatives libres utilisées:
- ✅ OpenStreetMap (fond de carte via MapLibre)
- ✅ GTFS open data Suisse
- ✅ swisstopo (open data depuis 2021)
