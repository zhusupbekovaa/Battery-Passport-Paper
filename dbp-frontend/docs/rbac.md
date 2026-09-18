# RBAC – Rollenbasierte Zugriffskontrolle

**Projekt:** Digital Battery Passport Viewer  
**Masterarbeit:** Zhusupbekova, Universität Siegen, 2025  
**Regulatorische Grundlage:** EU-Batterieverordnung 2023/1542, Art. 77 (Datensouveränität)  
**Technische Basis:** OAuth2 / OIDC · PKCE · Keycloak 24 · JWT (RS256)

---

## Inhaltsverzeichnis

1. [Konzept & Architektur](#1-konzept--architektur)
2. [Rollen & Zugriffslevels](#2-rollen--zugriffslevels)
3. [Zugriffsmatrizen](#3-zugriffsmatrizen)
4. [policies.json – Konfiguration](#4-policiesjson--konfiguration)
5. [Umgebungsvariablen](#5-umgebungsvariablen)
6. [Login-Flow (PKCE)](#6-login-flow-pkce)
7. [Keycloak einrichten](#7-keycloak-einrichten)
8. [API-Endpunkte](#8-api-endpunkte)
9. [Entwicklungsmodus (ohne Keycloak)](#9-entwicklungsmodus-ohne-keycloak)
10. [Neue Rolle hinzufügen](#10-neue-rolle-hinzufügen)
11. [Zugriffsrecht ändern](#11-zugriffsrecht-ändern)
12. [Fehlerbehebung](#12-fehlerbehebung)

---

## 1. Konzept & Architektur

### Warum RBAC im DBP?

Die EU-Batterieverordnung 2023/1542 verlangt in Art. 77, dass nicht alle Informationen
eines Batteriepasses öffentlich zugänglich sind. Lieferketteninformationen, Eigentumsdaten
und detaillierte Nachhaltigkeitsnachweise unterliegen Zugriffseinschränkungen.
Das RBAC-System setzt die Zugriffsmatrizen aus Tabelle 5.6 und 5.7 der Masterarbeit
technisch um.

### Systemübersicht

```
Browser                 server.js              Keycloak
   │                        │                      │
   │── GET /api/passport ──►│                      │
   │   (Bearer Token)       │── JWKS-Abruf ───────►│
   │                        │◄── Public Key ────────│
   │                        │── JWT verifizieren    │
   │                        │── Rolle extrahieren   │
   │                        │── applyPolicy()       │
   │◄── gefiltertes JSON ───│                      │
```

### Dreischichtiger Schutz

| Schicht | Ort | Was wird geschützt |
|---|---|---|
| **Token-Validierung** | `auth-middleware.js` | Jeder API-Aufruf wird geprüft |
| **Policy-Filter** | `policies.js` + `policies.json` | Felder im Passport-Objekt |
| **UI-Anzeige** | `passport.html` | Gesperrte Felder zeigen 🔒-Overlay |

> **Wichtig:** Der echte Schutz liegt auf Schicht 1+2 (server.js). Die UI-Anzeige
> (Schicht 3) ist rein visuell und kein Sicherheitsmerkmal.

### Dateistruktur

```
dbp-frontend/
├── rbac/
│   ├── policies.json        ← EINZIGE Datei für Zugriffsänderungen
│   ├── policies.js          ← Lädt JSON, stellt applyPolicy() bereit
│   └── auth-middleware.js   ← JWT-Validierung gegen Keycloak
├── public/
│   └── auth.js              ← PKCE-Client im Browser
├── keycloak/
│   └── realm-export.json    ← Keycloak-Realm (auto-importiert)
└── server.js                ← Bindet Middleware + Policy-Filter ein
```

---

## 2. Rollen & Zugriffslevels

### Rollen

Das System kennt sieben Rollen, direkt abgeleitet aus der Stakeholder-Analyse
der Masterarbeit (Kapitel 5.1.3):

| Rolle (intern) | Anzeigename | Lifecycle-Phase | Farbe |
|---|---|---|---|
| `public` | Öffentlich | beide | grau |
| `manufacturer` | Hersteller | Original | blau |
| `operator` | Betreiber | Original | gelb |
| `recycler` | Recycler | beide | orange-rot |
| `authority` | Behörde | beide | grün |
| `secondLifeOperator` | Second-Life-Betreiber | Second Life | lila |
| `remanufacturer` | Remanufacturer | Second Life | orange |

> `public` ist die Standardrolle bei fehlendem oder ungültigem Token.
> Kein Keycloak-Login nötig – öffentliche Daten sind immer sichtbar.

### Zugriffslevels

| Level | Symbol | Bedeutung |
|---|---|---|
| `"full"` | ✅ | Vollzugriff – alle Felder sichtbar, Schreiben möglich |
| `"read"` | 👁 | Lesezugriff – alle Felder sichtbar, kein Schreiben |
| `"summary"` | 📋 | Nur zusammengefasste Felder sichtbar (z. B. CO₂-Klasse, kein Detail) |
| `"write"` | ✏️ | Schreibzugriff (impliziert read) |
| `null` | 🔒 | Kein Zugriff – Feld erscheint gesperrt im Frontend |

### Rollenpriorität

Hat ein Nutzer mehrere Rollen in Keycloak, greift die höchste Priorität:

```
authority > manufacturer > secondLifeOperator > remanufacturer > recycler > operator
```

---

## 3. Zugriffsmatrizen

### Original-Phase (Tabelle 5.6 der Masterarbeit)

Aktiv wenn `BatteryStatus = "Original"`.

| Submodell / Feld | public | manufacturer | operator | recycler | authority |
|---|:---:|:---:|:---:|:---:|:---:|
| **Identifikation** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Hersteller** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Technisch** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **CO₂-Fußabdruck** | 📋 ¹ | ✅ | 🔒 | 🔒 | ✅ |
| **Materialien** | 🔒 | ✅ | 🔒 | 👁 | ✅ |
| **Rezyklatanteile** | 🔒 | ✅ | 🔒 | 👁 | ✅ |
| **Due Diligence** | 🔒 | ✅ | 🔒 | 🔒 | ✅ |
| **Eigentum** | 🔒 | ✏️ | 🔒 | 🔒 | ✅ |
| **Performance / SoH** | 🔒 | ✅ | 👁 | 🔒 | ✅ |
| **Lebenszyklus** | 📋 ² | ✅ | 👁 | 👁 | ✅ |
| **Zertifikate** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Governance** | 🔒 | ✅ | 👁 | 🔒 | ✅ |

¹ Öffentlich: nur CO₂-Gesamtwert und Klasse (kein LCA-Detail)  
² Öffentlich: nur Lifecycle-Status

### Second-Life-Phase (Tabelle 5.7 der Masterarbeit)

Aktiv wenn `BatteryStatus = "Repurposed"` oder enthält `"secondlife"`.

| Submodell / Feld | public | manufacturer | secondLifeOp. | remanufacturer | recycler | authority |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Identifikation** | 👁 | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Hersteller** | 👁 | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Technisch** | 👁 | 👁 | ✅ | 👁 | 👁 | ✅ |
| **CO₂-Fußabdruck** | 📋 | 👁 | ✏️ | 🔒 | 🔒 | ✅ |
| **Materialien** | 🔒 | 👁 | 🔒 | ✏️ | ✅ | ✅ |
| **Rezyklatanteile** | 🔒 | 👁 | 🔒 | ✏️ | ✅ | ✅ |
| **Due Diligence** | 🔒 | 👁 | 🔒 | 🔒 | 🔒 | ✅ |
| **Eigentum** | 🔒 | 👁 | ✏️ | 🔒 | 🔒 | ✅ |
| **Performance / SoH** | 🔒 | 👁 | ✏️ | ✏️ | 🔒 | ✅ |
| **Lebenszyklus** | 📋 | 👁 | ✏️ | ✏️ | 👁 | ✅ |
| **Zertifikate** | 👁 | 👁 | 👁 | ✏️ | 👁 | ✅ |
| **Governance** | 🔒 | 👁 | ✅ | 👁 | 🔒 | ✅ |

### Lifecycle-Phasenerkennung

Die Phase wird automatisch aus dem Passport-Objekt abgeleitet:

```javascript
// policies.js – detectLifecyclePhase()
status.includes("repurposed") || status.includes("secondlife") → "secondLife"
sonst                                                           → "original"
```

Der Status kommt aus `identification.status` oder `lifecycle.status` des
normalisierten Passport-Objekts (Wert aus dem BaSyx-Submodell).

### Summary-Felder

Wenn ein Feld den Level `"summary"` hat, werden nur diese Teilfelder zurückgegeben:

| Feld | Öffentlich sichtbare Teilfelder |
|---|---|
| `carbonFootprint` | `total`, `class`, `unit` |
| `lifecycle` | `status` |

Weitere Summary-Felder können in `policies.json` unter `summaryFields` definiert werden.

---

## 4. policies.json – Konfiguration

Die Datei `rbac/policies.json` ist die **einzige Stelle**, die für
Zugriffsänderungen bearbeitet werden muss. Kein Code-Change nötig.

### Dateistruktur

```json
{
  "roles": {
    "<rollenname>": {
      "label":  "Anzeigename",
      "color":  "#hexfarbe",
      "border": "#hexfarbe",
      "bg":     "#hexfarbe"
    }
  },

  "rolePriority": ["authority", "manufacturer", ...],

  "summaryFields": {
    "<feldname>": ["teilfeld1", "teilfeld2"]
  },

  "policies": {
    "<lifecyclePhase>": {
      "<feldname>": {
        "<rolle>": "full" | "read" | "summary" | "write" | null
      }
    }
  }
}
```

### `roles` – Rollendefinition

```json
"manufacturer": {
  "label":  "Hersteller",   ← Anzeigename im Frontend-Badge
  "color":  "#74c0fc",      ← Textfarbe des Badges
  "border": "#2a4a5e",      ← Rahmenfarbe des Badges
  "bg":     "#1a2e3d"       ← Hintergrundfarbe des Badges
}
```

### `rolePriority` – Rollenpriorität

Wenn ein Nutzer mehrere Keycloak-Rollen hat, gewinnt die erste in dieser Liste:

```json
"rolePriority": [
  "authority",           ← höchste Priorität
  "manufacturer",
  "secondLifeOperator",
  "remanufacturer",
  "recycler",
  "operator"             ← niedrigste Priorität (public hat keine)
]
```

### `summaryFields` – Teilfelder für Summary-Level

```json
"summaryFields": {
  "carbonFootprint": ["total", "class", "unit"],
  "lifecycle":       ["status"]
}
```

Wenn eine Rolle `"summary"` für `carbonFootprint` hat, sieht sie nur
`total`, `class` und `unit` – nicht `rawMaterial`, `verifier` etc.

### `policies` – Zugriffsmatrix

```json
"policies": {
  "original": {
    "carbonFootprint": {
      "_comment": "Öffentlich nur Zusammenfassung",
      "public":       "summary",
      "manufacturer": "full",
      "operator":     null,
      "recycler":     null,
      "authority":    "full"
    }
  }
}
```

> **`_comment`-Felder** werden ignoriert und dienen nur der Dokumentation.

### Hot-Reload

Mit `RBAC_HOT_RELOAD=true` liest der Server `policies.json` bei jedem API-Aufruf
neu ein – kein Neustart nötig bei Änderungen.

```bash
# In docker-compose.yml:
RBAC_HOT_RELOAD: "true"

# Dann Zugriffsrecht ändern:
# policies.json bearbeiten → sofort wirksam
```

---

## 5. Umgebungsvariablen

Alle RBAC-Einstellungen werden über Umgebungsvariablen konfiguriert.
Vorlage: `.env.example`

| Variable | Standard | Beschreibung |
|---|---|---|
| `RBAC_ENABLED` | `true` | `false` = Dev-Modus, kein Login erforderlich |
| `KEYCLOAK_URL` | `http://keycloak:8080` | Interne Container-URL (Server → Keycloak) |
| `KEYCLOAK_EXTERNAL_URL` | *(leer)* | Externe URL (Browser → Keycloak), z. B. `http://192.168.1.10:8080` |
| `KEYCLOAK_REALM` | `dbp-realm` | Realm-Name in Keycloak |
| `KEYCLOAK_CLIENT_ID` | `dbp-frontend` | Client-ID (muss in Keycloak angelegt sein) |
| `KEYCLOAK_ROLE_CLAIM` | `realm_access.roles` | JWT-Pfad zu den Rollen-Claims |
| `JWKS_CACHE_TTL` | `300000` | JWKS-Cache in ms (Standard: 5 Minuten) |
| `DEV_ROLE` | `manufacturer` | Rolle im Dev-Modus (nur wenn `RBAC_ENABLED=false`) |
| `RBAC_HOT_RELOAD` | `false` | `true` = policies.json bei jedem Request neu lesen |

### KEYCLOAK_URL vs. KEYCLOAK_EXTERNAL_URL

Dieser Unterschied ist wichtig bei Docker-Deployments:

```
KEYCLOAK_URL         = http://keycloak:8080   ← nur im Docker-Netz auflösbar
                       Wird für JWKS-Abruf und JWT-Validierung genutzt (server-seitig)

KEYCLOAK_EXTERNAL_URL= http://192.168.1.10:8080  ← vom Browser erreichbar
                       Wird über /api/auth/config ans Frontend geliefert
                       Für Login-Redirect, Token-Exchange (browser-seitig)
```

Lokal ohne Docker (beide auf localhost):
```bash
KEYCLOAK_URL=http://localhost:8080
# KEYCLOAK_EXTERNAL_URL weglassen oder gleich setzen
```

### KEYCLOAK_ROLE_CLAIM

Bestimmt, wo im JWT-Token die Rollen stehen:

```bash
# Keycloak-Standard (Realm-Rollen):
KEYCLOAK_ROLE_CLAIM=realm_access.roles

# Client-spezifische Rollen:
KEYCLOAK_ROLE_CLAIM=resource_access.dbp-frontend.roles
```

---

## 6. Login-Flow (PKCE)

Das Frontend verwendet **Authorization Code Flow mit PKCE** (RFC 7636).
Kein Client-Secret nötig – geeignet für Public Clients (Browser-Apps).

### Ablauf

```
1. Nutzer klickt "Anmelden"
        │
        ▼
2. auth.login() generiert:
   • code_verifier  (zufällig, 64 Bytes)
   • code_challenge = SHA256(verifier), Base64url-encoded
   • state          (CSRF-Schutz)
        │
        ▼
3. Redirect → Keycloak Login-Seite
   /realms/dbp-realm/protocol/openid-connect/auth
   ?response_type=code
   &client_id=dbp-frontend
   &redirect_uri=http://localhost:8090/
   &code_challenge=<SHA256-Hash>
   &code_challenge_method=S256
   &state=<zufällig>
        │
        ▼
4. Nutzer gibt Nutzername + Passwort ein
        │
        ▼
5. Keycloak redirectet zurück:
   http://localhost:8090/?code=<auth-code>&state=<state>
        │
        ▼
6. auth.handleCallback() prüft state, tauscht Code gegen Token:
   POST /realms/dbp-realm/protocol/openid-connect/token
   { grant_type: "authorization_code", code: <code>,
     code_verifier: <verifier>, client_id: "dbp-frontend" }
        │
        ▼
7. Keycloak antwortet mit access_token + refresh_token
   Token wird in sessionStorage gespeichert
        │
        ▼
8. auth.apiFetch() hängt bei jedem API-Call den Token an:
   GET /api/passport/:id
   Authorization: Bearer <access_token>
        │
        ▼
9. server.js validiert Token, extrahiert Rolle, filtert Daten
```

### Token-Speicherung

```javascript
sessionStorage.setItem("dbp_access_token",  data.access_token);
sessionStorage.setItem("dbp_refresh_token", data.refresh_token);
sessionStorage.setItem("dbp_user_info",     JSON.stringify(userInfo));
```

> `sessionStorage` wird beim Schließen des Tabs geleert.
> Token ist **nicht persistent** über Browser-Sitzungen hinweg.

### auth.js – öffentliche API

```javascript
// Initialisierung (beim Laden der Seite aufrufen)
const state = await auth.init();
// → { loggedIn: true, role: "manufacturer", roleLabel: "Hersteller",
//     roleColor: "#74c0fc", userInfo: { name, email, username } }

// Login starten (Redirect zu Keycloak)
auth.login();

// Logout (Keycloak-Session beenden + Storage leeren)
auth.logout();

// fetch() mit automatischem Bearer-Token
const res = await auth.apiFetch("/api/passport/urn%3A...");
const data = await res.json();

// Hilfsfunktionen
auth.getRole();       // → "manufacturer"
auth.getRoleLabel();  // → "Hersteller"
auth.isLoggedIn();    // → true
auth.getUserInfo();   // → { name, email, username } | null
auth.getState();      // → vollständiges State-Objekt
```

---

## 7. Keycloak einrichten

### Automatischer Import (docker compose)

Der Realm wird beim ersten Start automatisch importiert:

```yaml
# docker-compose.yml
keycloak:
  command: start-dev --import-realm
  volumes:
    - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro
```

Die Datei `keycloak/realm-export.json` enthält:
- Realm `dbp-realm` mit allen Einstellungen
- Client `dbp-frontend` (Public Client, PKCE aktiviert)
- 6 Testrollen: `manufacturer`, `operator`, `recycler`, `authority`, `secondLifeOperator`, `remanufacturer`
- 6 Testnutzer (alle Passwort: `password`)

### Testnutzer

| Benutzername | Passwort | Rolle | Lifecycle-Phase |
|---|---|---|---|
| `hersteller` | `password` | manufacturer | Original |
| `betreiber` | `password` | operator | Original |
| `recycler` | `password` | recycler | Original + Second Life |
| `behoerde` | `password` | authority | Original + Second Life |
| `secondlife` | `password` | secondLifeOperator | Second Life |
| `remanufacturer` | `password` | remanufacturer | Second Life |

### Keycloak Admin UI

```
URL:       http://localhost:8080
Benutzer:  admin
Passwort:  admin
```

Wichtige Pfade in der Admin UI:

```
Realm "dbp-realm" → Clients → dbp-frontend
  → Settings: Valid Redirect URIs, Web Origins
  → Advanced: PKCE Code Challenge Method = S256

Realm "dbp-realm" → Realm roles
  → Rollen anlegen / umbenennen

Realm "dbp-realm" → Users
  → Nutzer anlegen, Rollen zuweisen
```

### Neuen Nutzer manuell anlegen

1. Admin UI → Users → Add user
2. Username, Email ausfüllen → Create
3. Tab „Credentials" → Password setzen, „Temporary" auf OFF
4. Tab „Role mapping" → Realm role zuweisen

### Redirect-URIs konfigurieren

Wenn `INTERNAL_HOST` eine andere IP/Domain ist:

1. Admin UI → Clients → `dbp-frontend` → Settings
2. „Valid redirect URIs" → URI hinzufügen: `http://<INTERNAL_HOST>:8090/*`
3. „Web origins" → `http://<INTERNAL_HOST>:8090`
4. Save

---

## 8. API-Endpunkte

### `GET /api/auth/config`

Gibt die OIDC-Konfiguration zurück – wird von `auth.js` beim Laden abgerufen.
Kein Token erforderlich (öffentlich).

```json
{
  "enabled":   true,
  "issuer":    "http://keycloak:8080/realms/dbp-realm",
  "authUrl":   "http://192.168.1.10:8080/realms/dbp-realm/protocol/openid-connect/auth",
  "tokenUrl":  "http://192.168.1.10:8080/realms/dbp-realm/protocol/openid-connect/token",
  "logoutUrl": "http://192.168.1.10:8080/realms/dbp-realm/protocol/openid-connect/logout",
  "clientId":  "dbp-frontend",
  "scope":     "openid profile email"
}
```

> `authUrl`, `tokenUrl`, `logoutUrl` verwenden `KEYCLOAK_EXTERNAL_URL`,
> damit der Browser die Keycloak-Seite erreichen kann.

### `GET /api/auth/me`

Gibt Informationen über die aktuelle Sitzung zurück.

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8090/api/auth/me
```

```json
{
  "loggedIn": true,
  "role":     "manufacturer",
  "userInfo": {
    "sub":      "abc123",
    "name":     "Test Hersteller",
    "email":    "hersteller@example.com",
    "username": "hersteller"
  }
}
```

Ohne Token: `{ "loggedIn": false, "role": "public", "userInfo": null }`

### `GET /api/auth/policy-matrix`

Gibt die vollständige Zugriffsmatrix zurück – nützlich für Debugging und
Dokumentation. Kein Token erforderlich.

```bash
curl http://localhost:8090/api/auth/policy-matrix
```

```json
{
  "roles": { "public": {...}, "manufacturer": {...}, ... },
  "rolePriority": ["authority", "manufacturer", ...],
  "policies": {
    "original":   { "carbonFootprint": { "public": "summary", ... } },
    "secondLife": { ... }
  },
  "summaryFields": { "carbonFootprint": ["total", "class", "unit"], ... }
}
```

### `GET /api/passport/:id`

Gibt das nach Rolle gefilterte Passport-Objekt zurück. Ohne Token → `public`.

```bash
# Als Hersteller
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8090/api/passport/urn%3Auuid%3Aaas-battery-module-001"
```

Gesperrte Felder erscheinen als:

```json
"dueDiligence": {
  "_restricted":    true,
  "_reason":        "Rolle \"Betreiber\" hat keinen Zugriff.",
  "_requiredRoles": ["Hersteller", "Behörde"]
}
```

Zusammengefasste Felder (summary):

```json
"carbonFootprint": {
  "total":       "75.4",
  "class":       "C",
  "unit":        "kg CO2e / kWh",
  "_summarized": true
}
```

Das Antwort-Objekt enthält zusätzlich `_rbac`:

```json
"_rbac": {
  "role":            "operator",
  "roleLabel":       "Betreiber",
  "roleColor":       "#ffd166",
  "roleBorder":      "#4a3f22",
  "roleBg":          "#2e2a1a",
  "lifecyclePhase":  "original",
  "writeableFields": []
}
```

---

## 9. Entwicklungsmodus (ohne Keycloak)

Für lokale Entwicklung ohne Keycloak-Container:

```bash
# .env oder docker-compose environment:
RBAC_ENABLED=false
DEV_ROLE=manufacturer   # Werte: public | manufacturer | operator |
                        #        recycler | authority |
                        #        secondLifeOperator | remanufacturer
```

Im Dev-Modus:
- Kein Login-Button sichtbar
- Alle API-Calls werden als `DEV_ROLE` behandelt
- `req.userRole = DEV_ROLE`, `req.userInfo = { name: "Dev User (RBAC disabled)" }`
- `authMiddleware` übergibt direkt an `next()`, kein Token nötig

---

## 10. Neue Rolle hinzufügen

Beispiel: Rolle `auditor` (externer Prüfer, liest Zertifikate und CO₂).

### Schritt 1 – `policies.json` erweitern

```json
"roles": {
  ...
  "auditor": {
    "label":  "Externer Prüfer",
    "color":  "#a78bfa",
    "border": "#5b3fd4",
    "bg":     "#1e1a2e"
  }
},

"rolePriority": [
  "authority",
  "manufacturer",
  "auditor",           ← Priorität festlegen
  "secondLifeOperator",
  ...
],
```

Dann in jeder Policy-Phase die neue Rolle eintragen:

```json
"policies": {
  "original": {
    "identification":  { ..., "auditor": "read"    },
    "carbonFootprint": { ..., "auditor": "read"    },
    "certification":   { ..., "auditor": "full"    },
    "dueDiligence":    { ..., "auditor": "read"    },
    "materials":       { ..., "auditor": null       },
    "performance":     { ..., "auditor": null       },
    "ownership":       { ..., "auditor": null       },
    "manufacturer":    { ..., "auditor": "read"    },
    "technical":       { ..., "auditor": "read"    },
    "recycledContent": { ..., "auditor": null       },
    "lifecycle":       { ..., "auditor": "summary" },
    "governance":      { ..., "auditor": null       }
  },
  "secondLife": {
    // Gleich vorgehen ...
  }
}
```

### Schritt 2 – Keycloak: Rolle anlegen

1. Admin UI → `dbp-realm` → Realm roles → Create role
2. Name: `auditor` → Save

### Schritt 3 – Keycloak: Nutzer zuweisen

1. Admin UI → Users → Nutzer auswählen
2. Tab „Role mapping" → `auditor` zuweisen

### Schritt 4 – Fertig

Kein Code-Change nötig. Die neue Rolle ist sofort wirksam
(ggf. `RBAC_HOT_RELOAD=true` für sofortige JSON-Übernahme).

---

## 11. Zugriffsrecht ändern

### Beispiel 1: Betreiber soll CO₂-Daten vollständig sehen

```json
// policies.json → policies → original → carbonFootprint
"carbonFootprint": {
  "public":       "summary",
  "manufacturer": "full",
  "operator":     "read",    // ← war null, jetzt "read"
  "recycler":     null,
  "authority":    "full"
}
```

### Beispiel 2: Due Diligence für Recycler freigeben

```json
"dueDiligence": {
  "public":       null,
  "manufacturer": "full",
  "operator":     null,
  "recycler":     "read",    // ← war null, jetzt "read"
  "authority":    "full"
}
```

### Beispiel 3: Neues Submodell-Feld hinzufügen

Wenn der Adapter ein neues Feld `supplyChain` liefert:

```json
"policies": {
  "original": {
    ...
    "supplyChain": {
      "public":       null,
      "manufacturer": "full",
      "operator":     null,
      "recycler":     "read",
      "authority":    "full"
    }
  }
}
```

Felder die **nicht** in der Policy stehen, werden **unverändert** durchgereicht
(kein Zugriff-Filter). Das ist das Verhalten von `policies.js`:

```javascript
// Felder die nicht in der Policy stehen: 1:1 durchreichen
for (const key of Object.keys(passport)) {
  if (!(key in result)) result[key] = passport[key];
}
```

---

## 12. Fehlerbehebung

### "Token expired" – Nutzer muss sich erneut anmelden

JWT-Token laufen nach der Keycloak-Session-Timeout ab (Standard: 5 Minuten
Access Token, 30 Minuten Session).

**Lösung:** Session-Timeout in Keycloak erhöhen:  
Admin UI → Realm Settings → Tokens → Access Token Lifespan

### "No matching key found for kid" – JWKS-Problem

Keycloak hat seinen Signing-Key rotiert, der Cache ist veraltet.

**Lösung 1:** `JWKS_CACHE_TTL` reduzieren (z. B. `60000` = 1 Minute)  
**Lösung 2:** Container neu starten (leert den In-Memory-Cache)

### "Token audience mismatch" – Warnung im Log

```
[RBAC] Token audience mismatch: account vs dbp-frontend
```

Das ist eine Warnung, kein Fehler. Der Token ist trotzdem gültig.  
**Ursache:** Keycloak sendet manchmal `account` als `aud`-Claim.  
**Lösung:** In Keycloak → Clients → `dbp-frontend` → Advanced → „Audience"  
auf `dbp-frontend` setzen (Client Scope `roles` hinzufügen).

### Login-Loop – Browser kommt nicht zurück

**Ursache:** Redirect-URI ist nicht in Keycloak eingetragen.  

**Lösung:** Admin UI → Clients → `dbp-frontend` → Settings →  
„Valid Redirect URIs" → `http://<INTERNAL_HOST>:8090/*` hinzufügen

### "connect ECONNREFUSED keycloak:8080" – Server kann Keycloak nicht erreichen

**Ursache:** `KEYCLOAK_URL` ist nicht korrekt oder Keycloak läuft noch nicht.  
**Lösung:** Warten bis Keycloak healthy ist (healthcheck ~40s Start-Delay).

```bash
# Status prüfen
docker compose ps keycloak
# Logs prüfen
docker compose logs keycloak | tail -20
```

### RBAC greift nicht – alle Felder sind sichtbar

Prüfen ob `RBAC_ENABLED=true` gesetzt ist:

```bash
curl http://localhost:8090/api/auth/config
# → "enabled": true  (wenn false: RBAC deaktiviert)

curl -H "Authorization: Bearer <token>" http://localhost:8090/api/auth/me
# → zeigt erkannte Rolle
```

Adapter-Diagnose für den konkreten Passport:

```bash
curl http://localhost:8090/api/debug/urn%3Auuid%3Aaas-battery-module-001
# → zeigt erkannte Rolle + welche Submodelle gefunden wurden
```

---

*Dokumentation – RBAC · DBP Frontend v3 · Masterarbeit Nuraiym Zhusupbekova · Universität Siegen · 2025*
