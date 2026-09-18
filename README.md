# Digital Battery Pass (DBP) – Prototype

## Overview

This prototype implements a **Digital Battery Pass (DBP)** based on the
**Asset Administration Shell (AAS)** according to IEC 63278-1. It shows how
regulatory requirements of the EU Battery Regulation can be translated into
an interoperable, machine-readable data architecture.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DBP Prototype                                │
│                                                                     │
│  dbp_prototype/     ← AAS data model (8 submodels, JSON)           │
│  dbp-frontend/      ← Web viewer with RBAC (Node.js + Keycloak)    │
│  basyx/             ← BaSyx configuration                          │
│  docker-compose.yml ← Entire infrastructure                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Docker Desktop ≥ 4.0 / Docker Engine ≥ 20
- docker compose v2
- Free ports: 3000, 3001, 8080, 8081, 8082, 8083

### 1. Start the infrastructure

```bash
docker compose up -d
```

Wait until all containers are `healthy` (~40 seconds for Keycloak):

```bash
docker compose ps
```

### 2. Load submodels and assets

```bash
bash dbp_prototype/add_submodels.sh
```

### 3. Open the frontend

```
http://localhost:3000
```

Open the passport directly:
```
http://localhost:8090/passport/urn%3Auuid%3Aaas-battery-module-001
```

---

## Services

| Service | URL | Description |
|--------|-----|--------------|
| **DBP Frontend** | http://localhost:8090| Passport viewer with RBAC |
| **BaSyx Web UI** | http://localhost:3000 | AAS explorer (BaSyx) |
| **AAS Environment** | http://localhost:8081 | REST API for AAS + submodels |
| **AAS Registry** | http://localhost:8082 | Registry for AAS instances |
| **SM Registry** | http://localhost:8083 | Registry for submodels |
| **Keycloak** | http://localhost:8080 | Identity provider |

---

## Login (RBAC)

The frontend uses **OAuth2 / OIDC with PKCE** against Keycloak.

### Test users (password everywhere: `password`)

| Username | Role | Access |
|---|---|---|
| `hersteller` | manufacturer | Full access to all data |
| `betreiber` | operator | Master data + performance |
| `recycler` | recycler | Materials + disassembly |
| `behoerde` | authority | Full access, including due diligence |
| `secondlife` | secondLifeOperator | Second-life phase |
| `remanufacturer` | remanufacturer | Write access to materials |

Without login → role `public` → only public fields visible (CO₂ class, status).

### Keycloak Admin

```
URL:       http://localhost:8080
User:      admin
Password:  admin
```

---

## Project Structure

```
.
├── README.md                          ← This file
├── docker-compose.yml                 ← Entire infrastructure
│
├── basyx/                             ← BaSyx configuration files
│   ├── aas-env.properties             ← AAS Environment configuration
│   ├── aas-registry.yml               ← AAS Registry configuration
│   ├── sm-registry.yml                ← Submodel Registry configuration
│   ├── aas-discovery.properties       ← Discovery Service configuration
│   └── basyx-infra.yml                ← Infrastructure only (no frontend)
│
├── dbp-frontend/                      ← DBP web viewer
│   ├── Dockerfile
│   ├── server.js                      ← Express server with RBAC middleware
│   ├── package.json
│   ├── .env.example                   ← All environment variables explained
│   ├── adapters/                      ← Format adapters (Prototype, IDTA-02035, Generic)
│   │   ├── aas-utils.js
│   │   ├── adapter-prototype.js
│   │   ├── adapter-idta-02035.js
│   │   ├── adapter-generic.js
│   │   └── adapter-registry.js
│   ├── rbac/                          ← Access control
│   │   ├── policies.json              ← ← ← CHANGE ACCESS RIGHTS HERE
│   │   ├── policies.js
│   │   └── auth-middleware.js
│   ├── public/                        ← Browser files
│   │   ├── index.html                 ← Landing page / search
│   │   ├── passport.html              ← Passport detail view
│   │   └── auth.js                    ← PKCE OAuth2 client
│   ├── keycloak/
│   │   └── realm-export.json          ← Keycloak realm (auto-import)
│   └── docs/
│       ├── frontend.md                ← Frontend documentation
│       └── rbac.md                    ← RBAC documentation
│
├── dbp_prototype/                     ← AAS data model (JSON files)
│   ├── add_submodels.sh               ← Script: load data into BaSyx
│   ├── aas_instances/
│   │   └── battery_module_001.json    ← AAS instance (serial number)
│   ├── aas_model/
│   │   └── battery_model_001.json     ← AAS model (type level)
│   ├── submodel_instances/            ← 9 submodel JSONs (dummy data)
│   │   ├── sm_general_product_information_battery_001.json
│   │   ├── sm_carbon_footprint_battery_001.json
│   │   ├── sm_material_composition_battery_001.json
│   │   ├── sm_performance_durability_battery_001.json
│   │   ├── sm_circularity_battery_001.json
│   │   ├── sm_ownership_responsibility_battery_001.json
│   │   ├── sm_labels_battery_001.json
│   │   ├── sm_due_diligence_battery_001.json
│   │   └── sm_general_product_information_battery_001_refVariant.json
│   ├── submodel_definitions/          ← Markdown documentation of the submodels
│   └── docs/
│       └── README.md                  ← Prototype documentation
│
└── aas/                               ← (Reserved for future AAS artifacts)
```

---

## RBAC – Adjusting Access Rights

Access rights are configured **exclusively** in `dbp-frontend/rbac/policies.json`.
No code changes required.

### Example: giving the operator CO₂ access

```json
// dbp-frontend/rbac/policies.json
"carbonFootprint": {
  "operator": "read"   // was null
}
```

With `RBAC_HOT_RELOAD=true` in `docker-compose.yml`, this takes effect
immediately without a restart.

→ Full documentation: `dbp-frontend/docs/rbac.md`

---

## Adapter System

The frontend automatically detects the format of the loaded submodels:

| Adapter | Detection feature | Fields |
|---|---|---|
| **IDTA-02035** | `semanticId` contains `idta/battery/...` | IDTA field names |
| **Prototype** | `idShort` is `GeneralProductInformation` etc. | Custom field names |
| **Generic** | Fallback (always active) | Heuristic |

→ Documentation: `dbp-frontend/docs/frontend.md`, chapters 9–10

---

## Running BaSyx Only (without Frontend + Keycloak)

```bash
docker compose -f basyx/basyx-infra.yml up -d
bash dbp_prototype/add_submodels.sh
# BaSyx Web UI: http://localhost:3001
```

---

## Development Mode (without Keycloak)

```bash
cd dbp-frontend
RBAC_ENABLED=false DEV_ROLE=manufacturer node server.js
```

---
