# DBP Frontend – Developer Documentation

**Project:** Digital Battery Passport Viewer
**Master's thesis:** Modeling an optimal data structure for industrial applications based on a digital twin
**Author:** Nuraiym Zhusupbekova, University of Siegen, 2025
**Stack:** Node.js · Express · Vanilla HTML/CSS/JS

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Startup & Configuration](#2-startup--configuration)
3. [Design System: Adjusting Colors](#3-design-system-adjusting-colors)
4. [Adjusting Typography](#4-adjusting-typography)
5. [Layout & Components](#5-layout--components)
6. [Passport Page: Adjusting Content](#6-passport-page-adjusting-content)
7. [Adding or Renaming Tabs](#7-adding-or-renaming-tabs)
8. [API Endpoints](#8-api-endpoints)
9. [Adapter System](#9-adapter-system)
10. [Writing a New Adapter](#10-writing-a-new-adapter)
11. [Docker & docker-compose](#11-docker--docker-compose)

---

## 1. Project Structure

```
dbp-frontend/
│
├── server.js                    ← Express server, API routes
├── package.json
├── Dockerfile
│
├── adapters/                    ← Format detection & extraction
│   ├── aas-utils.js             ← Shared helper functions (getPropByPath etc.)
│   ├── adapter-prototype.js     ← Parser for the custom prototype (master's thesis)
│   ├── adapter-idta-02035.js    ← Parser for IDTA-02035 (official standard)
│   ├── adapter-generic.js       ← Fallback via heuristics (always active)
│   └── adapter-registry.js      ← Central dispatcher logic
│
└── public/                      ← Static files (served directly to the browser)
    ├── index.html               ← Landing page / search form
    └── passport.html            ← Passport detail view
```

---

## 2. Startup & Configuration

### Running locally

```bash
npm install
AAS_API=http://localhost:8081 node server.js
```

### Environment Variables

| Variable  | Default               | Description                          |
|-----------|-----------------------|---------------------------------------|
| `PORT`    | `3000`                | HTTP port of the frontend             |
| `AAS_API` | `http://aas-env:8081` | Base URL of the BaSyx AAS Environment |

### With docker-compose

```yaml
dbp-frontend:
  build: ./dbp-frontend
  ports:
    - "8090:3000"
  environment:
    - AAS_API=http://aas-env:8081
  depends_on:
    - aas-env
```

---

## 3. Design System: Adjusting Colors

All colors are defined as **CSS custom properties (variables)**. They sit
at the very top of the `<style>` block in **`public/index.html`** and
**`public/passport.html`**. Changes there affect the entire respective page.

### Current Color Palette

```css
:root {
  /* ── Backgrounds ─────────────────────────────────── */
  --bg:          #0a0f0d;   /* page background (very dark) */
  --surface:     #111814;   /* secondary surfaces (features, footer) */
  --card:        #161e1a;   /* card background */
  --card-hover:  #1c2820;   /* card on hover */

  /* ── Borders / dividers ─────────────────────────── */
  --border:      #1f2e27;   /* standard border */
  --border-light:#2a3d32;   /* lighter border (hover state) */

  /* ── Accent color (green) ───────────────────────── */
  --green:       #3ddc84;   /* primary accent color */
  --green-dim:   #2aad63;   /* darkened variant */
  --green-glow:  #3ddc8418; /* transparent glow (badges, focus) */
  --accent:      #a8ffcc;   /* light accent (button hover) */

  /* ── Text colors ───────────────────────────────── */
  --text:        #e8f0ec;   /* primary text */
  --text-muted:  #7a9989;   /* secondary text (labels, captions) */
  --text-dim:    #3d5447;   /* low-visibility text (regulatory refs) */

  /* ── Status / data colors ────────────────────────── */
  --red:         #ff6b6b;   /* errors, "Waste" status */
  --yellow:      #ffd166;   /* warnings, CO₂ class, dynamic data */
  --blue:        #74c0fc;   /* IDTA adapter badge, charge cycles */
}
```

### Example: Light Theme

To switch from dark to light, replace the following values in **both** HTML
files:

```css
:root {
  --bg:          #f4f7f5;
  --surface:     #ffffff;
  --card:        #ffffff;
  --card-hover:  #f0f5f2;
  --border:      #d1e0d8;
  --border-light:#b0ccc0;
  --green:       #1a8c4e;
  --green-dim:   #147a42;
  --green-glow:  #1a8c4e18;
  --accent:      #0d6636;
  --text:        #0f1f18;
  --text-muted:  #4a6b5a;
  --text-dim:    #8aab98;
  --red:         #c0392b;
  --yellow:      #c87a00;
  --blue:        #1a6eb5;
}
```

> **Note:** The background grid (`body::before`) uses `var(--border)`.
> With a light theme it appears very faint – adjust or remove `opacity`
> if needed.

### Adapter Badge Colors

The colors of the adapter badges are set **in `passport.html` in the
JavaScript**, not via CSS variables. Search for `adapterColors`:

```javascript
// passport.html, line ~820
const adapterColors = {
  "idta-02035": { color: "var(--blue)",   border: "#5598cc" },
  "prototype":  { color: "var(--green)",  border: "var(--green-dim)" },
  "generic":    { color: "var(--yellow)", border: "#cc9900" },
};
```

---

## 4. Adjusting Typography

The frontend uses three Google Fonts, loaded in the `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1
  &family=DM+Mono:wght@400;500
  &family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
```

| Usage                          | Font              | CSS                                 |
|---------------------------------|-------------------|--------------------------------------|
| Headings, large numbers         | DM Serif Display  | `font-family: 'DM Serif Display'`   |
| Body text, labels, buttons      | DM Sans           | `font-family: 'DM Sans'`            |
| IDs, code, monospace content    | DM Mono           | `font-family: 'DM Mono'`            |

### Using Different Fonts

Replace the Google Fonts `<link>` and adjust the `font-family` declarations
in the CSS. Alternatives with a similar character:

```html
<!-- Modern sans-serif alternative -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600
  &family=JetBrains+Mono:wght@400;500
  &family=Playfair+Display:ital@0;1&display=swap" rel="stylesheet">
```

Then in the CSS:
```css
body                  { font-family: 'Inter', sans-serif; }
h1, .section-title    { font-family: 'Playfair Display', serif; }
.card-value.big       { font-family: 'Playfair Display', serif; }
.passport-id, code    { font-family: 'JetBrains Mono', monospace; }
```

### Font Sizes

Important sizes in `passport.html`:

| Element                        | CSS class / selector          | Default    |
|---------------------------------|-------------------------------|------------|
| Passport title (heading)        | `.passport-title`            | clamp(1.6rem, 3vw, 2.4rem) |
| Large key figures (SoH etc.)    | `.card-value.big`            | `2rem`     |
| Tab labels                      | `.tab-btn`                   | `0.82rem`  |
| Data keys (left column)         | `.data-key`                  | `0.72rem`  |
| Regulatory references           | `.card-reg`                  | `0.6rem`   |

---

## 5. Layout & Components

### Page Width

The maximum width of the passport page is defined in `.page-wrapper`:

```css
.page-wrapper {
  max-width: 1200px;   /* ← adjust here */
  margin: 0 auto;
  padding: 0 40px 80px;
}
```

### Grid Layouts

There are three predefined grid classes for the tile views:

| Class      | Columns              | Used in                          |
|------------|----------------------|-----------------------------------|
| `.grid-2`  | `1fr 1fr`            | Manufacturer + owner, CO₂ cards  |
| `.grid-3`  | `repeat(3, 1fr)`     | SoH + cycles + capacity          |
| `.grid-4`  | `repeat(4, 1fr)`     | Overview KPIs at the top         |

Responsive breakpoints: below 900px `.grid-4` becomes 2 columns, below
700px all grids become 1 column.

### Cards (`.card`)

```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;      /* ← corner radius */
  padding: 20px 22px;       /* ← inner padding */
}
```

### Data Lists (`.data-list` / `.data-row`)

Key-value rows (e.g., the manufacturer list). Width of the key column:

```css
.data-key {
  flex: 0 0 220px;    /* ← width of the left label column */
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  color: var(--text-muted);
}
```

### Background Grid

The grid pattern is a CSS `::before` pseudo-element on `body`:

```css
body::before {
  background-size: 48px 48px;   /* ← grid size */
  opacity: 0.2;                 /* ← visibility (0 = invisible) */
}
```

To remove the grid entirely: `body::before { display: none; }`

---

## 6. Passport Page: Adjusting Content

### What Element IDs Exist?

All content is written into HTML elements with fixed `id` attributes via
JavaScript.

**Hero section (header of the passport page):**

| ID                  | Content                                       |
|---------------------|------------------------------------------------|
| `passportCategory`  | Category label (e.g., "Industrial battery")    |
| `passportTitle`     | Main title (idShort of the AAS)                |
| `passportId`        | AAS ID (monospaced)                            |
| `statusChip`        | Lifecycle status badge                          |
| `metaManufacturer`  | Manufacturer name in the meta row               |
| `metaDate`          | Manufacturing date                              |
| `metaModel`         | Model ID                                        |
| `metaChemistry`     | Chemistry (e.g., "NMC")                         |
| `metaEnergy`        | Rated energy in kWh                             |

**Overview tab KPI cards:**

| ID               | Content                        |
|------------------|----------------------------------|
| `ov-soh`         | State of health (large)          |
| `ov-soh-sub`     | Date of last measurement         |
| `ov-co2`         | Total CO₂ value                  |
| `ov-co2-class`   | CO₂ performance class            |
| `ov-cycles`      | Current charge cycles            |
| `ov-cycles-max`  | Max. charge cycles (design)      |
| `ov-recycling`   | Recycling efficiency             |

**Lists (populated via `innerHTML`):**

| ID                   | Tab              | Content                             |
|----------------------|------------------|--------------------------------------|
| `manufacturerList`   | Overview         | Manufacturer data rows               |
| `ownerList`          | Overview         | Responsible party                    |
| `govStrip`           | Overview         | Governance metadata                  |
| `technicalList`      | Technical        | Technical specification              |
| `identifiersList`    | Technical        | Digital identifiers                  |
| `co2Phases`          | CO₂              | Lifecycle phase bars                 |
| `co2StudyList`       | CO₂              | LCA study details                    |
| `recycledGrid`       | Materials        | Recycled content shares (pills)      |
| `activeMaterialsList`| Materials        | Cathode / anode / electrolyte        |
| `originList`         | Materials        | Raw material origin                  |
| `tempList`           | Performance      | Temperature history                  |
| `designList`         | Performance      | Design parameters                    |
| `lcStatusList`       | Lifecycle        | Lifecycle status                     |
| `dismantlingList`    | Lifecycle        | Disassembly & recycling              |
| `wasteList`          | Lifecycle        | Waste treatment                      |
| `certList`           | Certificates     | Certificate tiles                    |
| `rawJson`            | Raw data         | Expanded JSON                        |

### Adding a New Row to a Data List

Data lists are built with the `dataRow(key, value, badge)` helper function.
`badge` can be `'static'`, `'dynamic'`, or `null`.

Example – add a new row to the manufacturer list (in `passport.html`, in
the `render()` function, section `// ── OVERVIEW ──`):

```javascript
setHtml('manufacturerList',
  dataRow('Manufacturer', m.name,    'static')  +
  dataRow('Address',      m.address, 'static')  +
  // ← new row:
  dataRow('GLN',          m.gln,     'static')  +
  dataRow('Contact',      m.contact, 'static')
);
```

The corresponding value must be provided as `manufacturer.gln` in the
adapter (see [chapter 9](#9-adapter-system)).

---

## 7. Adding or Renaming Tabs

### Renaming a Tab

In `passport.html`, in the HTML section:

```html
<!-- before -->
<button class="tab-btn" data-tab="certification">Certificates</button>

<!-- after -->
<button class="tab-btn" data-tab="certification">Compliance & Certificates</button>
```

The tab panel itself (`id="tab-certification"`) remains unchanged.

### Adding a New Tab

**Step 1:** Insert a button in the tab bar:

```html
<button class="tab-btn" data-tab="duediligence">Due Diligence</button>
```

**Step 2:** Insert the tab panel div after the other `tab-section` divs:

```html
<div class="tab-section" id="tab-duediligence">
  <div class="section-header">
    <div class="section-icon">🔍</div>
    <div class="section-title">Due Diligence</div>
    <div class="section-reg">Art. 39 ff.</div>
  </div>
  <div class="data-list" id="dueDiligenceList"></div>
</div>
```

**Step 3:** Populate it in the `render()` function:

```javascript
// Access to due diligence data (must be present in the adapter)
const dd = p.dueDiligence || {};

setHtml('dueDiligenceList',
  dataRow('Policy',            dd.policyRef,   'static') +
  dataRow('OECD standard',     dd.standard,    'static') +
  dataRow('Risk level',        dd.riskLevel,   'dynamic') +
  dataRow('Audit (cobalt)',    dd.cobaltAudit, 'static')
);
```

**Step 4:** Tab activation happens automatically via the event listener:

```javascript
// This code in passport.html does NOT need to be changed
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => { /* ... */ });
});
```

---

## 8. API Endpoints

### `GET /api/passport/:id`

Returns a normalized passport object. The `id` must be URL-encoded.

**Example:**
```bash
curl "http://localhost:3000/api/passport/urn%3Auuid%3Aaas-battery-module-001"
```

**Response structure:**

```jsonc
{
  "id": "urn:uuid:aas-battery-module-001",
  "idShort": "BatteryModule001",
  "assetKind": "Instance",
  "globalAssetId": "urn:ejot:battery:module:BAT-EJOT-2025-00001",

  // ── Normalized fields (always the same structure) ──
  "identification": { "batteryId": "...", "modelId": "...", ... },
  "manufacturer":   { "name": "...", "address": "...", ... },
  "technical":      { "voltage": "48.0", "capacity": "100.0", ... },
  "carbonFootprint":{ "total": "75.4", "class": "C", ... },
  "recycledContent":{ "cobalt": "12.0", "lithium": "4.0", ... },
  "materials":      { "cathode": "NMC 622", ... },
  "performance":    { "soh": "98.5", "cycles": "12", ... },
  "lifecycle":      { "status": "Original", ... },
  "ownership":      { "operatorName": "EJOT GmbH", ... },
  "certification":  { "ceRef": "https://...", ... },
  "governance":     { "version": "1.0.0", "quality": "Validated", ... },

  // ── Adapter metadata ──
  "_adapterName":  "prototype",           // "idta-02035" | "prototype" | "generic"
  "_adapterLabel": "Prototype (master's thesis)",
  "_unmatchedSubmodels": [],              // submodels without a match

  // ── Raw data for the raw tab ──
  "_raw": { "shell": { ... }, "submodels": { ... } }
}
```

### `GET /api/debug/:id`

Returns a complete adapter diagnosis. Useful for troubleshooting.

```bash
curl "http://localhost:3000/api/debug/urn%3Auuid%3Aaas-battery-module-001"
```

```jsonc
{
  "shellId": "urn:uuid:aas-battery-module-001",
  "selectedAdapter": { "name": "prototype", "label": "Prototype (master's thesis)" },
  "submodelDiagnostics": [
    {
      "idShort": "GeneralProductInformation",
      "semanticId": "https://admin-shell.io/idta/digitalBatteryPass/...",
      "adapterMatches": [
        { "adapter": "prototype",  "role": "gpi" },
        { "adapter": "generic",    "role": "generic" }
      ]
    }
    // ... one entry per submodel
  ],
  "roleMap": {
    "gpi":    { "idShort": "GeneralProductInformation", "id": "urn:dbp:submodel:..." },
    "cf":     { "idShort": "CarbonFootprint", "id": "urn:dbp:submodel:..." }
  },
  "unmatchedSubmodels": []
}
```

---

## 9. Adapter System

### Concept

Every incoming API call passes through the **adapter registry**
(`adapter-registry.js`). It evaluates all loaded submodels against every
registered adapter and selects the one with the most matches.

```
Incoming submodels
        │
        ▼
┌─────────────────────────────────────────┐
│ Adapter Registry                        │
│                                         │
│  idta-02035.detect(sm) → score = 4      │  ← wins
│  prototype.detect(sm)  → score = 2      │
│  generic.detect(sm)    → score = 1      │
└───────────────┬─────────────────────────┘
                │ extract(roleMap)
                ▼
        Normalized passport object
```

### Adapter Interface

Every adapter must export three functions:

```javascript
// Detects whether this submodel belongs to the adapter
function detect(submodel) → boolean

// Returns the internal role (e.g., "gpi", "nameplate")
function role(submodel) → string | null

// Extracts the normalized passport object from the roleMap
function extract(submodelsByRole) → PassportObject
```

### Available Helper Functions (`aas-utils.js`)

| Function                                  | Description                                                |
|--------------------------------------------|-------------------------------------------------------------|
| `getPropByPath(elements, "A.B.C")`        | Navigates via an `idShort` path (prototype adapter)          |
| `getPropBySemanticId(elements, iri)`      | Recursively searches for `semanticId` (IDTA adapter)         |
| `getCollection(elements, idShort)`        | Returns the `value[]` of a collection                        |
| `getCollectionBySemanticId(elements, iri)`| Returns `value[]` by semanticId                               |
| `flatElements(elements, prefix)`          | Flattens all leaf properties into a list                     |
| `getSubmodelSemanticId(submodel)`         | Reads the semanticId of a submodel itself                     |
| `extractSemanticIdValue(semanticId)`      | Extracts the string value from a semanticId object            |
| `normalizeId(id)`                         | Normalizes IRIs for comparisons (lowercase, no trailing slash)|

---

## 10. Writing a New Adapter

Example: an adapter for the **Catena-X Battery Pass** format.

**Step 1:** Create a new file `adapters/adapter-catena-x.js`:

```javascript
const { getPropByPath, getPropBySemanticId, getSubmodelSemanticId } = require("./aas-utils");

// Known idShort names in the Catena-X ecosystem
const IDSHORT_MAP = {
  "BatteryPass":      "main",
  "CX_BatteryPass":   "main",
};

// Known semanticId fragments
const SEMID_PATTERN = /catena-x\.net|catenax/i;

function detect(submodel) {
  const semId = getSubmodelSemanticId(submodel);
  if (semId && SEMID_PATTERN.test(semId)) return true;
  return !!IDSHORT_MAP[submodel?.idShort];
}

function role(submodel) {
  return IDSHORT_MAP[submodel?.idShort] || "main";
}

function extract(submodelsByRole) {
  const el = (r) => submodelsByRole[r]?.submodelElements || [];
  const m = el("main");

  return {
    _adapter: "catena-x",

    identification: {
      batteryId: getPropByPath(m, "LocalIdentifiers.SerialNumber"),
      modelId:   getPropByPath(m, "LocalIdentifiers.PartInstanceId"),
      // ... additional fields
    },
    manufacturer: {
      name: getPropByPath(m, "Manufacturer.ManufacturerName"),
    },
    // ... fill in all remaining fields with null if not present
    technical: { voltage: null, capacity: null, energy: null,
                 chemistry: null, cellType: null, cells: null,
                 weight: null, protection: null },
    carbonFootprint: { total: null, unit: "kg CO2e / kWh", class: null,
                       rawMaterial: null, production: null,
                       distribution: null, endOfLife: null,
                       methodology: null, verifier: null, renewableShare: null },
    recycledContent: { cobalt: null, lithium: null, nickel: null },
    materials: { cathode: null, anode: null, electrolyte: null,
                 cobaltOrigin: null, lithiumOrigin: null, nickelOrigin: null },
    performance: { soh: null, capacity: null, cycles: null, maxCycles: null,
                   lifetimeYears: null, lastMeasured: null,
                   maxTemp: null, avgTemp: null, thermalEvents: null },
    lifecycle: { status: null, statusDate: null, dismantlingRef: null,
                 recyclability: null, recyclingTarget: null },
    ownership: { operatorName: null, operatorRole: null, since: null },
    certification: { ceRef: null, un383Ref: null, iecStandard: null, co2Class: null },
    governance: { version: null, createdAt: null, updatedAt: null,
                  responsible: null, quality: null },
  };
}

module.exports = { detect, role, extract };
```

**Step 2:** Register it in `adapter-registry.js`:

```javascript
// Near the top, with the require() calls
const adapterCatenaX = require("./adapter-catena-x");

// In the ADAPTERS list – insert BEFORE the generic entry:
const ADAPTERS = [
  { name: "idta-02035",  label: "IDTA-02035 (official)",      adapter: adapterIdta },
  { name: "catena-x",    label: "Catena-X",                   adapter: adapterCatenaX }, // ← new
  { name: "prototype",   label: "Prototype (master's thesis)", adapter: adapterProto },
  { name: "generic",     label: "Generic (fallback)",          adapter: adapterGeneric },
];
```

**Step 3:** Add the badge color in `passport.html`:

```javascript
const adapterColors = {
  "idta-02035": { color: "var(--blue)",   border: "#5598cc" },
  "catena-x":   { color: "#ff9f43",       border: "#cc7a00" }, // ← orange for Catena-X
  "prototype":  { color: "var(--green)",  border: "var(--green-dim)" },
  "generic":    { color: "var(--yellow)", border: "#cc9900" },
};
```

---

## 11. Docker & docker-compose

### Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Complete docker-compose.yml (Reference)

```yaml
version: "3.8"

services:

  aas-env:
    image: eclipsebasyx/aas-environment:2.0.0
    ports:
      - "8081:8081"
    environment:
      - BASYX_AASREPOSITORY_BACKEND=InMemory

  aas-registry:
    image: eclipsebasyx/aas-registry-log-mem:2.0.0
    ports:
      - "8082:8080"

  sm-registry:
    image: eclipsebasyx/submodel-registry-log-mem:2.0.0
    ports:
      - "8083:8080"

  aas-ui:
    image: eclipsebasyx/aas-gui:v2-240918
    ports:
      - "3001:3000"
    environment:
      - AAS_REGISTRY_PATH=http://localhost:8082
      - SUBMODEL_REGISTRY_PATH=http://localhost:8083
      - AAS_REPO_PATH=http://localhost:8081

  dbp-frontend:
    build: ./dbp-frontend
    ports:
      - "3000:3000"
    environment:
      - AAS_API=http://aas-env:8081
    depends_on:
      - aas-env
```

### Registering Submodels at Startup

Via the included `add_submodels.sh` script, or manually:

```bash
# Upload the AAS instance
curl -X POST http://localhost:8081/shells \
  -H "Content-Type: application/json" \
  -d @aas_instances/battery_module_001.json

# Register a submodel
curl -X POST http://localhost:8081/submodels \
  -H "Content-Type: application/json" \
  -d @submodel_instances/sm_general_product_information_battery_001.json

# Open in the frontend:
# http://localhost:3000/passport/urn%3Auuid%3Aaas-battery-module-001
```

---

*Documentation – DBP Frontend v2.0 · Master's thesis by Nuraiym Zhusupbekova · University of Siegen · 2025*
