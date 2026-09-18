# DBP Frontend – Entwicklerdokumentation

**Projekt:** Digital Battery Passport Viewer  
**Masterarbeit:** Modellierung einer optimalen Datenstruktur für industrielle Anwendungen auf Basis eines Digitalen Zwillings  
**Autorin:** Nuraiym Zhusupbekova, Universität Siegen, 2025  
**Stack:** Node.js · Express · Vanilla HTML/CSS/JS

---

## Inhaltsverzeichnis

1. [Projektstruktur](#1-projektstruktur)
2. [Starten & Konfiguration](#2-starten--konfiguration)
3. [Design-System: Farben anpassen](#3-design-system-farben-anpassen)
4. [Typografie anpassen](#4-typografie-anpassen)
5. [Layout & Komponenten](#5-layout--komponenten)
6. [Passport-Seite: Inhalte anpassen](#6-passport-seite-inhalte-anpassen)
7. [Tabs hinzufügen oder umbenennen](#7-tabs-hinzufügen-oder-umbenennen)
8. [API-Endpunkte](#8-api-endpunkte)
9. [Adapter-System](#9-adapter-system)
10. [Einen neuen Adapter schreiben](#10-einen-neuen-adapter-schreiben)
11. [Docker & docker-compose](#11-docker--docker-compose)

---

## 1. Projektstruktur

```
dbp-frontend/
│
├── server.js                    ← Express-Server, API-Routen
├── package.json
├── Dockerfile
│
├── adapters/                    ← Format-Erkennung & Extraktion
│   ├── aas-utils.js             ← Shared Hilfsfunktionen (getPropByPath etc.)
│   ├── adapter-prototype.js     ← Parser für eigenen Prototyp (Masterarbeit)
│   ├── adapter-idta-02035.js    ← Parser für IDTA-02035 (offizieller Standard)
│   ├── adapter-generic.js       ← Fallback per Heuristik (immer aktiv)
│   └── adapter-registry.js      ← Zentrale Dispatcher-Logik
│
└── public/                      ← Statische Dateien (direkt an Browser)
    ├── index.html               ← Startseite / Suchmaske
    └── passport.html            ← Passport-Detailansicht
```

---

## 2. Starten & Konfiguration

### Lokal starten

```bash
npm install
AAS_API=http://localhost:8081 node server.js
```

### Umgebungsvariablen

| Variable  | Standard              | Beschreibung                        |
|-----------|-----------------------|-------------------------------------|
| `PORT`    | `3000`                | HTTP-Port des Frontends             |
| `AAS_API` | `http://aas-env:8081` | Basis-URL des BaSyx AAS Environment |

### Mit docker-compose

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

## 3. Design-System: Farben anpassen

Alle Farben sind als **CSS Custom Properties (Variablen)** definiert. Sie stehen
ganz oben im `<style>`-Block von **`public/index.html`** und **`public/passport.html`**.
Änderungen dort wirken sich auf die gesamte jeweilige Seite aus.

### Aktuelle Farbpalette

```css
:root {
  /* ── Hintergründe ─────────────────────────────────── */
  --bg:          #0a0f0d;   /* Seiten-Hintergrund (sehr dunkel) */
  --surface:     #111814;   /* Sekundäre Flächen (Features, Footer) */
  --card:        #161e1a;   /* Karten-Hintergrund */
  --card-hover:  #1c2820;   /* Karte beim Hover */

  /* ── Rahmen / Trennlinien ─────────────────────────── */
  --border:      #1f2e27;   /* Standard-Border */
  --border-light:#2a3d32;   /* Hellere Border (Hover-Zustand) */

  /* ── Akzentfarbe (Grün) ───────────────────────────── */
  --green:       #3ddc84;   /* Primäre Akzentfarbe */
  --green-dim:   #2aad63;   /* Abgedunkelte Variante */
  --green-glow:  #3ddc8418; /* Transparenter Glow (Badges, Focus) */
  --accent:      #a8ffcc;   /* Heller Akzent (Hover auf Buttons) */

  /* ── Textfarben ───────────────────────────────────── */
  --text:        #e8f0ec;   /* Primärer Text */
  --text-muted:  #7a9989;   /* Sekundärer Text (Labels, Beschriftungen) */
  --text-dim:    #3d5447;   /* Schwach sichtbarer Text (regulatorische Refs) */

  /* ── Status- / Datenfarben ────────────────────────── */
  --red:         #ff6b6b;   /* Fehler, "Waste"-Status */
  --yellow:      #ffd166;   /* Warnungen, CO₂-Klasse, dynamische Daten */
  --blue:        #74c0fc;   /* IDTA-Adapter-Badge, Ladezyklen */
}
```

### Beispiel: Helles Theme

Um von dunkel auf hell zu wechseln, folgende Werte in **beiden** HTML-Dateien ersetzen:

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

> **Hinweis:** Das Hintergrundgitter (`body::before`) verwendet `var(--border)`.
> Bei hellem Theme wirkt es sehr schwach – ggf. `opacity` anpassen oder entfernen.

### Adapter-Badge-Farben

Die Farben der Adapter-Badges werden **in `passport.html` im JavaScript** gesetzt,
nicht über CSS-Variablen. Suche nach `adapterColors`:

```javascript
// passport.html, Zeile ~820
const adapterColors = {
  "idta-02035": { color: "var(--blue)",   border: "#5598cc" },
  "prototype":  { color: "var(--green)",  border: "var(--green-dim)" },
  "generic":    { color: "var(--yellow)", border: "#cc9900" },
};
```

---

## 4. Typografie anpassen

Das Frontend verwendet drei Google Fonts, eingebunden im `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1
  &family=DM+Mono:wght@400;500
  &family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
```

| Verwendung                    | Font              | CSS                                 |
|-------------------------------|-------------------|-------------------------------------|
| Überschriften, Zahlen (groß)  | DM Serif Display  | `font-family: 'DM Serif Display'`   |
| Fließtext, Labels, Buttons    | DM Sans           | `font-family: 'DM Sans'`            |
| IDs, Code, Monospaceinhalte   | DM Mono           | `font-family: 'DM Mono'`            |

### Andere Fonts einbinden

Ersetze den Google Fonts `<link>` und passe die `font-family`-Deklarationen im
CSS an. Alternativen mit ähnlichem Charakter:

```html
<!-- Modern Sans-Serif Alternative -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600
  &family=JetBrains+Mono:wght@400;500
  &family=Playfair+Display:ital@0;1&display=swap" rel="stylesheet">
```

Dann im CSS:
```css
body                  { font-family: 'Inter', sans-serif; }
h1, .section-title    { font-family: 'Playfair Display', serif; }
.card-value.big       { font-family: 'Playfair Display', serif; }
.passport-id, code    { font-family: 'JetBrains Mono', monospace; }
```

### Schriftgrößen

Wichtige Größen in `passport.html`:

| Element                     | CSS-Klasse / Selektor        | Standard   |
|-----------------------------|------------------------------|------------|
| Passport-Titel (Überschrift)| `.passport-title`            | clamp(1.6rem, 3vw, 2.4rem) |
| Große Kennzahlen (SoH etc.) | `.card-value.big`            | `2rem`     |
| Tab-Labels                  | `.tab-btn`                   | `0.82rem`  |
| Daten-Keys (linke Spalte)   | `.data-key`                  | `0.72rem`  |
| Regulatorische Referenzen   | `.card-reg`                  | `0.6rem`   |

---

## 5. Layout & Komponenten

### Seitenbreite

Die maximale Breite der Passport-Seite ist in `.page-wrapper` definiert:

```css
.page-wrapper {
  max-width: 1200px;   /* ← hier anpassen */
  margin: 0 auto;
  padding: 0 40px 80px;
}
```

### Grid-Layouts

Es gibt drei vordefinierte Grid-Klassen für die Kachelansichten:

| Klasse     | Spalten              | Verwendet in                    |
|------------|----------------------|---------------------------------|
| `.grid-2`  | `1fr 1fr`            | Hersteller + Owner, CO₂-Karten  |
| `.grid-3`  | `repeat(3, 1fr)`     | SoH + Zyklen + Kapazität        |
| `.grid-4`  | `repeat(4, 1fr)`     | Übersichts-KPIs oben            |

Responsive Breakpoints: unter 900px wird `.grid-4` zu 2 Spalten, unter 700px
werden alle Grids zu 1 Spalte.

### Karten (`.card`)

```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;      /* ← Eckenradius */
  padding: 20px 22px;       /* ← Innenabstand */
}
```

### Datenlisten (`.data-list` / `.data-row`)

Schlüssel-Wert-Zeilen (z. B. Herstellerliste). Die Breite der Schlüsselspalte:

```css
.data-key {
  flex: 0 0 220px;    /* ← Breite der linken Label-Spalte */
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  color: var(--text-muted);
}
```

### Hintergrundgitter

Das Gitternetz ist ein CSS `::before`-Pseudo-Element auf `body`:

```css
body::before {
  background-size: 48px 48px;   /* ← Gittergröße */
  opacity: 0.2;                 /* ← Sichtbarkeit (0 = unsichtbar) */
}
```

Gitter komplett entfernen: `body::before { display: none; }`

---

## 6. Passport-Seite: Inhalte anpassen

### Welche Element-IDs gibt es?

Alle Inhalte werden per JavaScript in HTML-Elemente mit festen `id`-Attributen geschrieben.

**Hero-Bereich (Kopfzeile der Passport-Seite):**

| ID                  | Inhalt                                      |
|---------------------|---------------------------------------------|
| `passportCategory`  | Kategorie-Label (z. B. „Industriebatterie") |
| `passportTitle`     | Haupttitel (idShort der AAS)                |
| `passportId`        | AAS-ID (monospaced)                         |
| `statusChip`        | Lifecycle-Status-Badge                      |
| `metaManufacturer`  | Herstellername in der Meta-Zeile            |
| `metaDate`          | Herstelldatum                               |
| `metaModel`         | Modell-ID                                   |
| `metaChemistry`     | Chemie (z. B. „NMC")                        |
| `metaEnergy`        | Nennenergie in kWh                          |

**Übersichts-Tab KPI-Karten:**

| ID               | Inhalt                        |
|------------------|-------------------------------|
| `ov-soh`         | State of Health (groß)        |
| `ov-soh-sub`     | Datum letzte Messung          |
| `ov-co2`         | CO₂-Gesamtwert                |
| `ov-co2-class`   | CO₂-Leistungsklasse           |
| `ov-cycles`      | Aktuelle Ladezyklen           |
| `ov-cycles-max`  | Max. Ladezyklen (Design)      |
| `ov-recycling`   | Recyclingeffizienz            |

**Listen (werden per `innerHTML` befüllt):**

| ID                   | Tab            | Inhalt                             |
|----------------------|----------------|------------------------------------|
| `manufacturerList`   | Übersicht      | Hersteller-Datenzeilen             |
| `ownerList`          | Übersicht      | Verantwortlicher Beteiligter       |
| `govStrip`           | Übersicht      | Governance-Metadaten               |
| `technicalList`      | Technisch      | Technische Spezifikation           |
| `identifiersList`    | Technisch      | Digitale Identifikatoren           |
| `co2Phases`          | CO₂            | Lebenszyklusphasen-Balken          |
| `co2StudyList`       | CO₂            | LCA-Studie Angaben                 |
| `recycledGrid`       | Materialien    | Rezyklatanteile (Pills)            |
| `activeMaterialsList`| Materialien    | Kathode / Anode / Elektrolyt       |
| `originList`         | Materialien    | Rohstoffherkunft                   |
| `tempList`           | Performance    | Temperaturhistorie                 |
| `designList`         | Performance    | Auslegungsparameter                |
| `lcStatusList`       | Lebenszyklus   | Lifecycle-Status                   |
| `dismantlingList`    | Lebenszyklus   | Demontage & Recycling              |
| `wasteList`          | Lebenszyklus   | Abfallbehandlung                   |
| `certList`           | Zertifikate    | Zertifikatskacheln                 |
| `rawJson`            | Rohdaten       | Aufgeklapptes JSON                 |

### Eine neue Zeile in einer Datenliste hinzufügen

Datenlisten werden mit der Hilfsfunktion `dataRow(key, value, badge)` aufgebaut.
Badge kann `'static'`, `'dynamic'` oder `null` sein.

Beispiel – neue Zeile in der Herstellerliste ergänzen (in `passport.html`, in der
`render()`-Funktion, Abschnitt `// ── OVERVIEW ──`):

```javascript
setHtml('manufacturerList',
  dataRow('Hersteller',   m.name,    'static')  +
  dataRow('Adresse',      m.address, 'static')  +
  // ← neue Zeile:
  dataRow('GLN',          m.gln,     'static')  +
  dataRow('Kontakt',      m.contact, 'static')
);
```

Der zugehörige Wert muss im Adapter als `manufacturer.gln` bereitgestellt werden
(siehe [Kapitel 9](#9-adapter-system)).

---

## 7. Tabs hinzufügen oder umbenennen

### Tab umbenennen

In `passport.html`, im HTML-Teil:

```html
<!-- vorher -->
<button class="tab-btn" data-tab="certification">Zertifikate</button>

<!-- nachher -->
<button class="tab-btn" data-tab="certification">Konformität & Zertifikate</button>
```

Das Tab-Panel selbst (`id="tab-certification"`) bleibt unverändert.

### Neuen Tab hinzufügen

**Schritt 1:** Button in der Tab-Leiste einfügen:

```html
<button class="tab-btn" data-tab="duediligence">Due Diligence</button>
```

**Schritt 2:** Tab-Panel-Div nach den anderen `tab-section`-Divs einfügen:

```html
<div class="tab-section" id="tab-duediligence">
  <div class="section-header">
    <div class="section-icon">🔍</div>
    <div class="section-title">Sorgfaltspflichten (Due Diligence)</div>
    <div class="section-reg">Art. 39 ff.</div>
  </div>
  <div class="data-list" id="dueDiligenceList"></div>
</div>
```

**Schritt 3:** In der `render()`-Funktion befüllen:

```javascript
// Zugriff auf Due-Diligence-Daten (müssen im Adapter vorhanden sein)
const dd = p.dueDiligence || {};

setHtml('dueDiligenceList',
  dataRow('Richtlinie',     dd.policyRef,    'static') +
  dataRow('OECD-Standard',  dd.standard,     'static') +
  dataRow('Risikolevel',    dd.riskLevel,     'dynamic') +
  dataRow('Prüfung (Kobalt)', dd.cobaltAudit, 'static')
);
```

**Schritt 4:** Die Tab-Aktivierung läuft automatisch über den Event-Listener:

```javascript
// Dieser Code in passport.html muss NICHT verändert werden
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => { /* ... */ });
});
```

---

## 8. API-Endpunkte

### `GET /api/passport/:id`

Gibt ein normalisiertes Passport-Objekt zurück. Die `id` muss URL-enkodiert sein.

**Beispiel:**
```bash
curl "http://localhost:3000/api/passport/urn%3Auuid%3Aaas-battery-module-001"
```

**Antwort-Struktur:**

```jsonc
{
  "id": "urn:uuid:aas-battery-module-001",
  "idShort": "BatteryModule001",
  "assetKind": "Instance",
  "globalAssetId": "urn:ejot:battery:module:BAT-EJOT-2025-00001",

  // ── Normalisierte Felder (immer gleiche Struktur) ──
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

  // ── Adapter-Metadaten ──
  "_adapterName":  "prototype",           // "idta-02035" | "prototype" | "generic"
  "_adapterLabel": "Prototyp (Masterarbeit)",
  "_unmatchedSubmodels": [],              // Submodelle ohne Treffer

  // ── Rohdaten für den Raw-Tab ──
  "_raw": { "shell": { ... }, "submodels": { ... } }
}
```

### `GET /api/debug/:id`

Gibt eine vollständige Adapter-Diagnose zurück. Nützlich für die Fehlersuche.

```bash
curl "http://localhost:3000/api/debug/urn%3Auuid%3Aaas-battery-module-001"
```

```jsonc
{
  "shellId": "urn:uuid:aas-battery-module-001",
  "selectedAdapter": { "name": "prototype", "label": "Prototyp (Masterarbeit)" },
  "submodelDiagnostics": [
    {
      "idShort": "GeneralProductInformation",
      "semanticId": "https://admin-shell.io/idta/digitalBatteryPass/...",
      "adapterMatches": [
        { "adapter": "prototype",  "role": "gpi" },
        { "adapter": "generic",    "role": "generic" }
      ]
    }
    // ... ein Eintrag pro Submodell
  ],
  "roleMap": {
    "gpi":    { "idShort": "GeneralProductInformation", "id": "urn:dbp:submodel:..." },
    "cf":     { "idShort": "CarbonFootprint", "id": "urn:dbp:submodel:..." }
  },
  "unmatchedSubmodels": []
}
```

---

## 9. Adapter-System

### Konzept

Jeder eingehende API-Aufruf durchläuft die **Adapter-Registry** (`adapter-registry.js`).
Diese bewertet alle geladenen Submodelle mit jedem registrierten Adapter und wählt
den mit den meisten Treffern.

```
Eingehende Submodelle
        │
        ▼
┌─────────────────────────────────────────┐
│ Adapter-Registry                        │
│                                         │
│  idta-02035.detect(sm) → score = 4      │  ← gewinnt
│  prototype.detect(sm)  → score = 2      │
│  generic.detect(sm)    → score = 1      │
└───────────────┬─────────────────────────┘
                │ extract(roleMap)
                ▼
        Normalisiertes Passport-Objekt
```

### Adapter-Schnittstelle

Jeder Adapter muss drei Funktionen exportieren:

```javascript
// Erkennt, ob dieses Submodell zum Adapter gehört
function detect(submodel) → boolean

// Gibt die interne Rolle zurück (z. B. "gpi", "nameplate")
function role(submodel) → string | null

// Extrahiert das normalisierte Passport-Objekt aus der roleMap
function extract(submodelsByRole) → PassportObject
```

### Verfügbare Hilfsfunktionen (`aas-utils.js`)

| Funktion                                  | Beschreibung                                             |
|-------------------------------------------|----------------------------------------------------------|
| `getPropByPath(elements, "A.B.C")`        | Navigiert per `idShort`-Pfad (Prototyp-Adapter)          |
| `getPropBySemanticId(elements, iri)`      | Sucht rekursiv nach `semanticId` (IDTA-Adapter)          |
| `getCollection(elements, idShort)`        | Gibt `value[]` einer Collection zurück                   |
| `getCollectionBySemanticId(elements, iri)`| Gibt `value[]` per semanticId                            |
| `flatElements(elements, prefix)`          | Flacht alle Leaf-Properties in eine Liste ab             |
| `getSubmodelSemanticId(submodel)`         | Liest die semanticId eines Submodells selbst aus         |
| `extractSemanticIdValue(semanticId)`      | Extrahiert den String-Wert aus einem semanticId-Objekt   |
| `normalizeId(id)`                         | Normalisiert IRIs für Vergleiche (lowercase, kein Slash) |

---

## 10. Einen neuen Adapter schreiben

Beispiel: Ein Adapter für das **Catena-X Battery Pass**-Format.

**Schritt 1:** Neue Datei `adapters/adapter-catena-x.js` anlegen:

```javascript
const { getPropByPath, getPropBySemanticId, getSubmodelSemanticId } = require("./aas-utils");

// Bekannte idShort-Namen im Catena-X-Ökosystem
const IDSHORT_MAP = {
  "BatteryPass":      "main",
  "CX_BatteryPass":   "main",
};

// Bekannte semanticId-Fragmente
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
      // ... weitere Felder
    },
    manufacturer: {
      name: getPropByPath(m, "Manufacturer.ManufacturerName"),
    },
    // ... alle weiteren Felder mit null befüllen wenn nicht vorhanden
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

**Schritt 2:** In `adapter-registry.js` registrieren:

```javascript
// Oben bei den require()-Aufrufen
const adapterCatenaX = require("./adapter-catena-x");

// In der ADAPTERS-Liste – VOR dem generic-Eintrag einfügen:
const ADAPTERS = [
  { name: "idta-02035",  label: "IDTA-02035 (offiziell)", adapter: adapterIdta },
  { name: "catena-x",    label: "Catena-X",               adapter: adapterCatenaX }, // ← neu
  { name: "prototype",   label: "Prototyp (Masterarbeit)", adapter: adapterProto },
  { name: "generic",     label: "Generisch (Fallback)",    adapter: adapterGeneric },
];
```

**Schritt 3:** Badge-Farbe in `passport.html` ergänzen:

```javascript
const adapterColors = {
  "idta-02035": { color: "var(--blue)",   border: "#5598cc" },
  "catena-x":   { color: "#ff9f43",       border: "#cc7a00" }, // ← orange für Catena-X
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

### Vollständige docker-compose.yml (Referenz)

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

### Submodelle beim Start registrieren

Über das mitgelieferte `add_submodels.sh`-Script oder manuell:

```bash
# AAS-Instanz hochladen
curl -X POST http://localhost:8081/shells \
  -H "Content-Type: application/json" \
  -d @aas_instances/battery_module_001.json

# Submodell registrieren
curl -X POST http://localhost:8081/submodels \
  -H "Content-Type: application/json" \
  -d @submodel_instances/sm_general_product_information_battery_001.json

# Im Frontend aufrufen:
# http://localhost:3000/passport/urn%3Auuid%3Aaas-battery-module-001
```

---

*Dokumentation – DBP Frontend v2.0 · Masterarbeit Nuraiym Zhusupbekova · Universität Siegen · 2025*
