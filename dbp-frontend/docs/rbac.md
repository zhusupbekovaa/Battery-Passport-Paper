# RBAC – Role-Based Access Control

**Project:** Digital Battery Passport Viewer
**Master's thesis:** Zhusupbekova, University of Siegen, 2025
**Regulatory basis:** EU Battery Regulation 2023/1542, Art. 77 (data sovereignty)
**Technical basis:** OAuth2 / OIDC · PKCE · Keycloak 24 · JWT (RS256)

---

## Table of Contents

1. [Concept & Architecture](#1-concept--architecture)
2. [Roles & Access Levels](#2-roles--access-levels)
3. [Access Matrices](#3-access-matrices)
4. [policies.json – Configuration](#4-policiesjson--configuration)
5. [Environment Variables](#5-environment-variables)
6. [Login Flow (PKCE)](#6-login-flow-pkce)
7. [Setting Up Keycloak](#7-setting-up-keycloak)
8. [API Endpoints](#8-api-endpoints)
9. [Development Mode (without Keycloak)](#9-development-mode-without-keycloak)
10. [Adding a New Role](#10-adding-a-new-role)
11. [Changing an Access Right](#11-changing-an-access-right)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Concept & Architecture

### Why RBAC in the DBP?

The EU Battery Regulation 2023/1542 requires, in Art. 77, that not all
information in a battery passport be publicly accessible. Supply chain
information, ownership data, and detailed sustainability evidence are
subject to access restrictions. The RBAC system technically implements
the access matrices from tables 5.6 and 5.7 of the master's thesis.

### System Overview

```
Browser                 server.js              Keycloak
   │                        │                      │
   │── GET /api/passport ──►│                      │
   │   (Bearer token)       │── JWKS request ─────►│
   │                        │◄── Public key ────────│
   │                        │── Verify JWT          │
   │                        │── Extract role        │
   │                        │── applyPolicy()       │
   │◄── filtered JSON ──────│                      │
```

### Three-Layer Protection

| Layer | Location | What is protected |
|---|---|---|
| **Token validation** | `auth-middleware.js` | Every API call is checked |
| **Policy filter** | `policies.js` + `policies.json` | Fields in the passport object |
| **UI display** | `passport.html` | Locked fields show a 🔒 overlay |

> **Important:** The actual protection lives in layers 1+2 (server.js). The
> UI display (layer 3) is purely visual and not a security feature.

### File Structure

```
dbp-frontend/
├── rbac/
│   ├── policies.json        ← ONLY file to edit for access changes
│   ├── policies.js          ← Loads the JSON, provides applyPolicy()
│   └── auth-middleware.js   ← JWT validation against Keycloak
├── public/
│   └── auth.js              ← PKCE client in the browser
├── keycloak/
│   └── realm-export.json    ← Keycloak realm (auto-imported)
└── server.js                ← Wires in the middleware + policy filter
```

---

## 2. Roles & Access Levels

### Roles

The system defines seven roles, derived directly from the stakeholder
analysis in the master's thesis (chapter 5.1.3):

| Role (internal) | Display name | Lifecycle phase | Color |
|---|---|---|---|
| `public` | Public | both | gray |
| `manufacturer` | Manufacturer | Original | blue |
| `operator` | Operator | Original | yellow |
| `recycler` | Recycler | both | orange-red |
| `authority` | Authority | both | green |
| `secondLifeOperator` | Second-life operator | Second life | purple |
| `remanufacturer` | Remanufacturer | Second life | orange |

> `public` is the default role when a token is missing or invalid.
> No Keycloak login required – public data is always visible.

### Access Levels

| Level | Symbol | Meaning |
|---|---|---|
| `"full"` | ✅ | Full access – all fields visible, writing allowed |
| `"read"` | 👁 | Read access – all fields visible, no writing |
| `"summary"` | 📋 | Only summarized fields visible (e.g. CO₂ class, no detail) |
| `"write"` | ✏️ | Write access (implies read) |
| `null` | 🔒 | No access – field appears locked in the frontend |

### Role Priority

If a user has multiple roles in Keycloak, the highest priority wins:

```
authority > manufacturer > secondLifeOperator > remanufacturer > recycler > operator
```

---

## 3. Access Matrices

### Original Phase (Table 5.6 of the master's thesis)

Active when `BatteryStatus = "Original"`.

| Submodel / field | public | manufacturer | operator | recycler | authority |
|---|:---:|:---:|:---:|:---:|:---:|
| **Identification** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Manufacturer** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Technical** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Carbon footprint** | 📋 ¹ | ✅ | 🔒 | 🔒 | ✅ |
| **Materials** | 🔒 | ✅ | 🔒 | 👁 | ✅ |
| **Recycled content** | 🔒 | ✅ | 🔒 | 👁 | ✅ |
| **Due diligence** | 🔒 | ✅ | 🔒 | 🔒 | ✅ |
| **Ownership** | 🔒 | ✏️ | 🔒 | 🔒 | ✅ |
| **Performance / SoH** | 🔒 | ✅ | 👁 | 🔒 | ✅ |
| **Lifecycle** | 📋 ² | ✅ | 👁 | 👁 | ✅ |
| **Certificates** | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Governance** | 🔒 | ✅ | 👁 | 🔒 | ✅ |

¹ Public: only total CO₂ value and class (no LCA detail)
² Public: only lifecycle status

### Second-Life Phase (Table 5.7 of the master's thesis)

Active when `BatteryStatus = "Repurposed"` or contains `"secondlife"`.

| Submodel / field | public | manufacturer | secondLifeOp. | remanufacturer | recycler | authority |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Identification** | 👁 | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Manufacturer** | 👁 | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Technical** | 👁 | 👁 | ✅ | 👁 | 👁 | ✅ |
| **Carbon footprint** | 📋 | 👁 | ✏️ | 🔒 | 🔒 | ✅ |
| **Materials** | 🔒 | 👁 | 🔒 | ✏️ | ✅ | ✅ |
| **Recycled content** | 🔒 | 👁 | 🔒 | ✏️ | ✅ | ✅ |
| **Due diligence** | 🔒 | 👁 | 🔒 | 🔒 | 🔒 | ✅ |
| **Ownership** | 🔒 | 👁 | ✏️ | 🔒 | 🔒 | ✅ |
| **Performance / SoH** | 🔒 | 👁 | ✏️ | ✏️ | 🔒 | ✅ |
| **Lifecycle** | 📋 | 👁 | ✏️ | ✏️ | 👁 | ✅ |
| **Certificates** | 👁 | 👁 | 👁 | ✏️ | 👁 | ✅ |
| **Governance** | 🔒 | 👁 | ✅ | 👁 | 🔒 | ✅ |

### Lifecycle Phase Detection

The phase is automatically derived from the passport object:

```javascript
// policies.js – detectLifecyclePhase()
status.includes("repurposed") || status.includes("secondlife") → "secondLife"
otherwise                                                      → "original"
```

The status comes from `identification.status` or `lifecycle.status` of
the normalized passport object (value taken from the BaSyx submodel).

### Summary Fields

If a field has the `"summary"` level, only these sub-fields are returned:

| Field | Publicly visible sub-fields |
|---|---|
| `carbonFootprint` | `total`, `class`, `unit` |
| `lifecycle` | `status` |

Additional summary fields can be defined in `policies.json` under
`summaryFields`.

---

## 4. policies.json – Configuration

The file `rbac/policies.json` is the **only place** that needs to be
edited for access changes. No code changes required.

### File Structure

```json
{
  "roles": {
    "<roleName>": {
      "label":  "Display name",
      "color":  "#hexcolor",
      "border": "#hexcolor",
      "bg":     "#hexcolor"
    }
  },

  "rolePriority": ["authority", "manufacturer", ...],

  "summaryFields": {
    "<fieldName>": ["subfield1", "subfield2"]
  },

  "policies": {
    "<lifecyclePhase>": {
      "<fieldName>": {
        "<role>": "full" | "read" | "summary" | "write" | null
      }
    }
  }
}
```

### `roles` – Role Definition

```json
"manufacturer": {
  "label":  "Manufacturer", ← display name in the frontend badge
  "color":  "#74c0fc",      ← badge text color
  "border": "#2a4a5e",      ← badge border color
  "bg":     "#1a2e3d"       ← badge background color
}
```

### `rolePriority` – Role Priority

If a user has multiple Keycloak roles, the first one in this list wins:

```json
"rolePriority": [
  "authority",           ← highest priority
  "manufacturer",
  "secondLifeOperator",
  "remanufacturer",
  "recycler",
  "operator"             ← lowest priority (public has none)
]
```

### `summaryFields` – Sub-fields for the Summary Level

```json
"summaryFields": {
  "carbonFootprint": ["total", "class", "unit"],
  "lifecycle":       ["status"]
}
```

If a role has `"summary"` for `carbonFootprint`, it only sees `total`,
`class`, and `unit` – not `rawMaterial`, `verifier`, etc.

### `policies` – Access Matrix

```json
"policies": {
  "original": {
    "carbonFootprint": {
      "_comment": "Public gets summary only",
      "public":       "summary",
      "manufacturer": "full",
      "operator":     null,
      "recycler":     null,
      "authority":    "full"
    }
  }
}
```

> **`_comment` fields** are ignored and serve documentation purposes only.

### Hot Reload

With `RBAC_HOT_RELOAD=true`, the server re-reads `policies.json` on every
API call – no restart needed for changes.

```bash
# In docker-compose.yml:
RBAC_HOT_RELOAD: "true"

# Then change an access right:
# edit policies.json → takes effect immediately
```

---

## 5. Environment Variables

All RBAC settings are configured via environment variables.
Template: `.env.example`

| Variable | Default | Description |
|---|---|---|
| `RBAC_ENABLED` | `true` | `false` = dev mode, no login required |
| `KEYCLOAK_URL` | `http://keycloak:8080` | Internal container URL (server → Keycloak) |
| `KEYCLOAK_EXTERNAL_URL` | *(empty)* | External URL (browser → Keycloak), e.g. `http://192.168.1.10:8080` |
| `KEYCLOAK_REALM` | `dbp-realm` | Realm name in Keycloak |
| `KEYCLOAK_CLIENT_ID` | `dbp-frontend` | Client ID (must exist in Keycloak) |
| `KEYCLOAK_ROLE_CLAIM` | `realm_access.roles` | JWT path to the role claims |
| `JWKS_CACHE_TTL` | `300000` | JWKS cache in ms (default: 5 minutes) |
| `DEV_ROLE` | `manufacturer` | Role in dev mode (only when `RBAC_ENABLED=false`) |
| `RBAC_HOT_RELOAD` | `false` | `true` = re-read policies.json on every request |

### KEYCLOAK_URL vs. KEYCLOAK_EXTERNAL_URL

This distinction matters for Docker deployments:

```
KEYCLOAK_URL         = http://keycloak:8080   ← resolvable only within the Docker network
                       Used for JWKS lookup and JWT validation (server-side)

KEYCLOAK_EXTERNAL_URL= http://192.168.1.10:8080  ← reachable from the browser
                       Delivered to the frontend via /api/auth/config
                       For login redirect, token exchange (browser-side)
```

Locally without Docker (both on localhost):
```bash
KEYCLOAK_URL=http://localhost:8080
# omit KEYCLOAK_EXTERNAL_URL, or set it the same
```

### KEYCLOAK_ROLE_CLAIM

Determines where in the JWT token the roles are located:

```bash
# Keycloak default (realm roles):
KEYCLOAK_ROLE_CLAIM=realm_access.roles

# Client-specific roles:
KEYCLOAK_ROLE_CLAIM=resource_access.dbp-frontend.roles
```

---

## 6. Login Flow (PKCE)

The frontend uses the **Authorization Code Flow with PKCE** (RFC 7636).
No client secret required – suitable for public clients (browser apps).

### Flow

```
1. User clicks "Sign in"
        │
        ▼
2. auth.login() generates:
   • code_verifier  (random, 64 bytes)
   • code_challenge = SHA256(verifier), base64url-encoded
   • state          (CSRF protection)
        │
        ▼
3. Redirect → Keycloak login page
   /realms/dbp-realm/protocol/openid-connect/auth
   ?response_type=code
   &client_id=dbp-frontend
   &redirect_uri=http://localhost:8090/
   &code_challenge=<SHA256 hash>
   &code_challenge_method=S256
   &state=<random>
        │
        ▼
4. User enters username + password
        │
        ▼
5. Keycloak redirects back:
   http://localhost:8090/?code=<auth-code>&state=<state>
        │
        ▼
6. auth.handleCallback() checks state, exchanges the code for a token:
   POST /realms/dbp-realm/protocol/openid-connect/token
   { grant_type: "authorization_code", code: <code>,
     code_verifier: <verifier>, client_id: "dbp-frontend" }
        │
        ▼
7. Keycloak responds with access_token + refresh_token
   Token is stored in sessionStorage
        │
        ▼
8. auth.apiFetch() attaches the token to every API call:
   GET /api/passport/:id
   Authorization: Bearer <access_token>
        │
        ▼
9. server.js validates the token, extracts the role, filters the data
```

### Token Storage

```javascript
sessionStorage.setItem("dbp_access_token",  data.access_token);
sessionStorage.setItem("dbp_refresh_token", data.refresh_token);
sessionStorage.setItem("dbp_user_info",     JSON.stringify(userInfo));
```

> `sessionStorage` is cleared when the tab is closed.
> The token is **not persistent** across browser sessions.

### auth.js – Public API

```javascript
// Initialization (call when the page loads)
const state = await auth.init();
// → { loggedIn: true, role: "manufacturer", roleLabel: "Manufacturer",
//     roleColor: "#74c0fc", userInfo: { name, email, username } }

// Start login (redirect to Keycloak)
auth.login();

// Logout (end the Keycloak session + clear storage)
auth.logout();

// fetch() with an automatic bearer token
const res = await auth.apiFetch("/api/passport/urn%3A...");
const data = await res.json();

// Helper functions
auth.getRole();       // → "manufacturer"
auth.getRoleLabel();  // → "Manufacturer"
auth.isLoggedIn();    // → true
auth.getUserInfo();   // → { name, email, username } | null
auth.getState();      // → full state object
```

---

## 7. Setting Up Keycloak

### Automatic Import (docker compose)

The realm is imported automatically on first startup:

```yaml
# docker-compose.yml
keycloak:
  command: start-dev --import-realm
  volumes:
    - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro
```

The file `keycloak/realm-export.json` contains:
- Realm `dbp-realm` with all settings
- Client `dbp-frontend` (public client, PKCE enabled)
- 6 test roles: `manufacturer`, `operator`, `recycler`, `authority`, `secondLifeOperator`, `remanufacturer`
- 6 test users (all with password: `password`)

### Test Users

| Username | Password | Role | Lifecycle phase |
|---|---|---|---|
| `hersteller` | `password` | manufacturer | Original |
| `betreiber` | `password` | operator | Original |
| `recycler` | `password` | recycler | Original + second life |
| `behoerde` | `password` | authority | Original + second life |
| `secondlife` | `password` | secondLifeOperator | Second life |
| `remanufacturer` | `password` | remanufacturer | Second life |

### Keycloak Admin UI

```
URL:       http://localhost:8080
User:      admin
Password:  admin
```

Important paths in the admin UI:

```
Realm "dbp-realm" → Clients → dbp-frontend
  → Settings: Valid Redirect URIs, Web Origins
  → Advanced: PKCE Code Challenge Method = S256

Realm "dbp-realm" → Realm roles
  → Create / rename roles

Realm "dbp-realm" → Users
  → Create users, assign roles
```

### Manually Creating a New User

1. Admin UI → Users → Add user
2. Fill in username, email → Create
3. Tab "Credentials" → set password, "Temporary" set to OFF
4. Tab "Role mapping" → assign a realm role

### Configuring Redirect URIs

If `INTERNAL_HOST` is a different IP/domain:

1. Admin UI → Clients → `dbp-frontend` → Settings
2. "Valid redirect URIs" → add URI: `http://<INTERNAL_HOST>:8090/*`
3. "Web origins" → `http://<INTERNAL_HOST>:8090`
4. Save

---

## 8. API Endpoints

### `GET /api/auth/config`

Returns the OIDC configuration – fetched by `auth.js` on load.
No token required (public).

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

> `authUrl`, `tokenUrl`, `logoutUrl` use `KEYCLOAK_EXTERNAL_URL` so the
> browser can reach the Keycloak page.

### `GET /api/auth/me`

Returns information about the current session.

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8090/api/auth/me
```

```json
{
  "loggedIn": true,
  "role":     "manufacturer",
  "userInfo": {
    "sub":      "abc123",
    "name":     "Test Manufacturer",
    "email":    "hersteller@example.com",
    "username": "hersteller"
  }
}
```

Without a token: `{ "loggedIn": false, "role": "public", "userInfo": null }`

### `GET /api/auth/policy-matrix`

Returns the complete access matrix – useful for debugging and
documentation. No token required.

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

Returns the passport object filtered by role. Without a token → `public`.

```bash
# As a manufacturer
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8090/api/passport/urn%3Auuid%3Aaas-battery-module-001"
```

Locked fields appear as:

```json
"dueDiligence": {
  "_restricted":    true,
  "_reason":        "Role \"Operator\" has no access.",
  "_requiredRoles": ["Manufacturer", "Authority"]
}
```

Summarized fields (summary):

```json
"carbonFootprint": {
  "total":       "75.4",
  "class":       "C",
  "unit":        "kg CO2e / kWh",
  "_summarized": true
}
```

The response object additionally contains `_rbac`:

```json
"_rbac": {
  "role":            "operator",
  "roleLabel":       "Operator",
  "roleColor":       "#ffd166",
  "roleBorder":      "#4a3f22",
  "roleBg":          "#2e2a1a",
  "lifecyclePhase":  "original",
  "writeableFields": []
}
```

---

## 9. Development Mode (without Keycloak)

For local development without a Keycloak container:

```bash
# .env or docker-compose environment:
RBAC_ENABLED=false
DEV_ROLE=manufacturer   # values: public | manufacturer | operator |
                        #         recycler | authority |
                        #         secondLifeOperator | remanufacturer
```

In dev mode:
- No login button visible
- All API calls are treated as `DEV_ROLE`
- `req.userRole = DEV_ROLE`, `req.userInfo = { name: "Dev User (RBAC disabled)" }`
- `authMiddleware` passes straight through to `next()`, no token needed

---

## 10. Adding a New Role

Example: role `auditor` (external auditor, reads certificates and CO₂).

### Step 1 – Extend `policies.json`

```json
"roles": {
  ...
  "auditor": {
    "label":  "External auditor",
    "color":  "#a78bfa",
    "border": "#5b3fd4",
    "bg":     "#1e1a2e"
  }
},

"rolePriority": [
  "authority",
  "manufacturer",
  "auditor",           ← set the priority
  "secondLifeOperator",
  ...
],
```

Then add the new role to every policy phase:

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
    // Proceed the same way ...
  }
}
```

### Step 2 – Keycloak: Create the Role

1. Admin UI → `dbp-realm` → Realm roles → Create role
2. Name: `auditor` → Save

### Step 3 – Keycloak: Assign to Users

1. Admin UI → Users → select a user
2. Tab "Role mapping" → assign `auditor`

### Step 4 – Done

No code changes required. The new role takes effect immediately
(use `RBAC_HOT_RELOAD=true` for the JSON change to apply instantly).

---

## 11. Changing an Access Right

### Example 1: Let the operator see full CO₂ data

```json
// policies.json → policies → original → carbonFootprint
"carbonFootprint": {
  "public":       "summary",
  "manufacturer": "full",
  "operator":     "read",    // ← was null, now "read"
  "recycler":     null,
  "authority":    "full"
}
```

### Example 2: Grant recyclers access to due diligence

```json
"dueDiligence": {
  "public":       null,
  "manufacturer": "full",
  "operator":     null,
  "recycler":     "read",    // ← was null, now "read"
  "authority":    "full"
}
```

### Example 3: Adding a New Submodel Field

If the adapter delivers a new field `supplyChain`:

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

Fields that are **not** listed in the policy are passed through
**unchanged** (no access filter). This is the behavior of `policies.js`:

```javascript
// Fields not listed in the policy: pass through 1:1
for (const key of Object.keys(passport)) {
  if (!(key in result)) result[key] = passport[key];
}
```

---

## 12. Troubleshooting

### "Token expired" – user must sign in again

JWT tokens expire after the Keycloak session timeout (default: 5 minutes
access token, 30 minutes session).

**Solution:** Increase the session timeout in Keycloak:
Admin UI → Realm Settings → Tokens → Access Token Lifespan

### "No matching key found for kid" – JWKS issue

Keycloak has rotated its signing key and the cache is stale.

**Solution 1:** Reduce `JWKS_CACHE_TTL` (e.g. `60000` = 1 minute)
**Solution 2:** Restart the container (clears the in-memory cache)

### "Token audience mismatch" – warning in the log

```
[RBAC] Token audience mismatch: account vs dbp-frontend
```

This is a warning, not an error. The token is still valid.
**Cause:** Keycloak sometimes sends `account` as the `aud` claim.
**Solution:** In Keycloak → Clients → `dbp-frontend` → Advanced → "Audience"
set it to `dbp-frontend` (add the `roles` client scope).

### Login loop – browser doesn't come back

**Cause:** The redirect URI is not registered in Keycloak.

**Solution:** Admin UI → Clients → `dbp-frontend` → Settings →
"Valid Redirect URIs" → add `http://<INTERNAL_HOST>:8090/*`

### "connect ECONNREFUSED keycloak:8080" – server cannot reach Keycloak

**Cause:** `KEYCLOAK_URL` is incorrect, or Keycloak isn't running yet.
**Solution:** Wait until Keycloak is healthy (healthcheck ~40s startup delay).

```bash
# Check status
docker compose ps keycloak
# Check logs
docker compose logs keycloak | tail -20
```

### RBAC has no effect – all fields are visible

Check whether `RBAC_ENABLED=true` is set:

```bash
curl http://localhost:8090/api/auth/config
# → "enabled": true  (if false: RBAC is disabled)

curl -H "Authorization: Bearer <token>" http://localhost:8090/api/auth/me
# → shows the detected role
```

Adapter diagnosis for a specific passport:

```bash
curl http://localhost:8090/api/debug/urn%3Auuid%3Aaas-battery-module-001
# → shows the detected role + which submodels were found
```

---

*Documentation – RBAC · DBP Frontend v3 · Master's thesis by Nuraiym Zhusupbekova · University of Siegen · 2025*
