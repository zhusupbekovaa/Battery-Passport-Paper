# Digital Battery Pass – Prototyp

## Übersicht

Dieser Prototyp implementiert einen **Digital Battery Pass (DBP)** auf Basis der
**Asset Administration Shell (AAS)** nach IEC 63278-1. Er zeigt, wie regulatorische
Anforderungen der EU-Batterieverordnung in eine interoperable, maschinenlesbare
Datenarchitektur überführt werden können.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DBP Prototyp                                 │
│                                                                     │
│  dbp_prototype/     ← AAS-Datenmodell (8 Submodelle, JSON)         │
│  dbp-frontend/      ← Web-Viewer mit RBAC (Node.js + Keycloak)     │
│  basyx/             ← BaSyx-Konfiguration                           │
│  docker-compose.yml ← Gesamte Infrastruktur                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Schnellstart

### Voraussetzungen

- Docker Desktop ≥ 4.0 / Docker Engine ≥ 20
- docker compose v2
- Ports frei: 3000, 3001, 8080, 8081, 8082, 8083

### 1. Infrastruktur starten

```bash
docker compose up -d
```

Warte bis alle Container `healthy` sind (~40 Sekunden für Keycloak):

```bash
docker compose ps
```

### 2. Submodelle und Assets laden

```bash
bash dbp_prototype/add_submodels.sh
```

### 3. Frontend aufrufen

```
http://localhost:3000
```

Passport direkt öffnen:
```
http://localhost:8090/passport/urn%3Auuid%3Aaas-battery-module-001
```

---

## Dienste

| Dienst | URL | Beschreibung |
|--------|-----|--------------|
| **DBP Frontend** | http://localhost:8090| Passport-Viewer mit RBAC |
| **BaSyx Web UI** | http://localhost:3000 | AAS-Explorer (BaSyx) |
| **AAS Environment** | http://localhost:8081 | REST-API für AAS + Submodelle |
| **AAS Registry** | http://localhost:8082 | Registry für AAS-Instanzen |
| **SM Registry** | http://localhost:8083 | Registry für Submodelle |
| **Keycloak** | http://localhost:8080 | Identity Provider |

---

## Login (RBAC)

Das Frontend nutzt **OAuth2 / OIDC mit PKCE** gegen Keycloak.

### Testnutzer (Passwort überall: `password`)

| Benutzername | Rolle | Zugriff |
|---|---|---|
| `hersteller` | manufacturer | Vollzugriff auf alle Daten |
| `betreiber` | operator | Stammdaten + Performance |
| `recycler` | recycler | Materialien + Demontage |
| `behoerde` | authority | Vollzugriff inkl. Due Diligence |
| `secondlife` | secondLifeOperator | Second-Life-Phase |
| `remanufacturer` | remanufacturer | Materialien schreiben |

Ohne Login → Rolle `public` → nur öffentliche Felder sichtbar (CO₂-Klasse, Status).

### Keycloak Admin

```
URL:       http://localhost:8080
Benutzer:  admin
Passwort:  admin
```

---

## Projektstruktur

```
.
├── README.md                          ← Diese Datei
├── docker-compose.yml                 ← Gesamte Infrastruktur
│
├── basyx/                             ← BaSyx-Konfigurationsdateien
│   ├── aas-env.properties             ← AAS Environment Konfiguration
│   ├── aas-registry.yml               ← AAS Registry Konfiguration
│   ├── sm-registry.yml                ← Submodel Registry Konfiguration
│   ├── aas-discovery.properties       ← Discovery Service Konfiguration
│   └── basyx-infra.yml                ← Nur Infrastruktur (ohne Frontend)
│
├── dbp-frontend/                      ← DBP Web-Viewer
│   ├── Dockerfile
│   ├── server.js                      ← Express-Server mit RBAC-Middleware
│   ├── package.json
│   ├── .env.example                   ← Alle Umgebungsvariablen erklärt
│   ├── adapters/                      ← Format-Adapter (Prototyp, IDTA-02035, Generic)
│   │   ├── aas-utils.js
│   │   ├── adapter-prototype.js
│   │   ├── adapter-idta-02035.js
│   │   ├── adapter-generic.js
│   │   └── adapter-registry.js
│   ├── rbac/                          ← Zugriffskontrolle
│   │   ├── policies.json              ← ← ← HIER Zugriffsrechte ändern
│   │   ├── policies.js
│   │   └── auth-middleware.js
│   ├── public/                        ← Browser-Dateien
│   │   ├── index.html                 ← Startseite / Suche
│   │   ├── passport.html              ← Passport-Detailansicht
│   │   └── auth.js                    ← PKCE OAuth2-Client
│   ├── keycloak/
│   │   └── realm-export.json          ← Keycloak-Realm (auto-import)
│   └── docs/
│       ├── frontend.md                ← Frontend-Dokumentation
│       └── rbac.md                    ← RBAC-Dokumentation
│
├── dbp_prototype/                     ← AAS-Datenmodell (JSON-Dateien)
│   ├── add_submodels.sh               ← Script: Daten in BaSyx laden
│   ├── aas_instances/
│   │   └── battery_module_001.json    ← AAS-Instanz (Seriennummer)
│   ├── aas_model/
│   │   └── battery_model_001.json     ← AAS-Modell (Typebene)
│   ├── submodel_instances/            ← 9 Submodell-JSONs (Dummy-Daten)
│   │   ├── sm_general_product_information_battery_001.json
│   │   ├── sm_carbon_footprint_battery_001.json
│   │   ├── sm_material_composition_battery_001.json
│   │   ├── sm_performance_durability_battery_001.json
│   │   ├── sm_circularity_battery_001.json
│   │   ├── sm_ownership_responsibility_battery_001.json
│   │   ├── sm_labels_battery_001.json
│   │   ├── sm_due_diligence_battery_001.json
│   │   └── sm_general_product_information_battery_001_refVariant.json
│   ├── submodel_definitions/          ← Markdown-Dokumentation der Submodelle
│   └── docs/
│       └── README.md                  ← Prototyp-Dokumentation
│
└── aas/                               ← (Reserviert für zukünftige AAS-Artefakte)
```

---

## RBAC – Zugriffsrechte anpassen

Zugriffsrechte werden **ausschließlich** in `dbp-frontend/rbac/policies.json`
konfiguriert. Kein Code-Change nötig.

### Beispiel: Betreiber erhält CO₂-Zugriff

```json
// dbp-frontend/rbac/policies.json
"carbonFootprint": {
  "operator": "read"   // war null
}
```

Mit `RBAC_HOT_RELOAD=true` in `docker-compose.yml` wirkt das sofort ohne Neustart.

→ Vollständige Dokumentation: `dbp-frontend/docs/rbac.md`

---

## Adapter-System

Das Frontend erkennt automatisch das Format der geladenen Submodelle:

| Adapter | Erkennungsmerkmal | Felder |
|---|---|---|
| **IDTA-02035** | `semanticId` enthält `idta/battery/...` | IDTA-Feldnamen |
| **Prototyp** | `idShort` ist `GeneralProductInformation` etc. | Eigene Feldnamen |
| **Generic** | Fallback (immer aktiv) | Heuristik |

→ Dokumentation: `dbp-frontend/docs/frontend.md`, Kapitel 9–10

---

## Nur BaSyx starten (ohne Frontend + Keycloak)

```bash
docker compose -f basyx/basyx-infra.yml up -d
bash dbp_prototype/add_submodels.sh
# BaSyx Web UI: http://localhost:3001
```

---

## Entwicklungsmodus (ohne Keycloak)

```bash
cd dbp-frontend
RBAC_ENABLED=false DEV_ROLE=manufacturer node server.js
```

---