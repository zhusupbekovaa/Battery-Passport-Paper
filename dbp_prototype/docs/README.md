# DBP Prototype – Dokumentation
**Projekt:** Digital Battery Pass (DBP) – Prototypische Implementierung  


## 1. Überblick

Dieser Prototyp implementiert den **Digital Battery Pass (DBP)** für ein industrielles Lithium-Ionen-Batteriemodul (48V / 100Ah) auf Basis der **Asset Administration Shell (AAS)** gemäß IEC 63278-1. Die Implementierung nutzt **Eclipse BaSyx** als AAS-Laufzeitumgebung.

### Regulatorische Grundlage
Die EU-Batterieverordnung 2023/1542 verpflichtet ab 2027 bestimmte Batterieklassen zur Bereitstellung eines DBP. Für Industriebatterien über 2 kWh (vorliegendes Modul: 4,8 kWh) gilt die vollständige Informationspflicht gemäß Art. 77 und Anhang XIII.

---

## 2. Architektur und Dateistruktur

```
DBP Prototype/
├── aas_instances/
│   └── battery_module_001.json          ← AAS-Instanz (Instanzebene)
├── aas_model/
│   └── battery_model_001.json           ← AAS-Modell (Typebene)
├── submodel_instances/
│   ├── sm_general_product_information_battery_001.json           ← GPI Variante A (Dummy-Daten)
│   ├── sm_general_product_information_battery_001_refVariant.json ← GPI Variante B (Referenzen)
│   ├── sm_carbon_footprint_battery_001.json
│   ├── sm_circularity_battery_001.json
│   ├── sm_due_diligence_battery_001.json
│   ├── sm_labels_battery_001.json
│   ├── sm_material_composition_battery_001.json
│   ├── sm_ownership_responsibility_battery_001.json
│   └── sm_performance_durability_battery_001.json
├── submodel_definitions/
│   ├── general_product_information_structure.md    ← GPI-Dokumentation (vollständig)
│   ├── carbon_footprint_structure.md
│   ├── circularity_structure.md
│   ├── due_diligence_structure.md
│   ├── labels_structure.md
│   ├── material_composition_structure.md
│   ├── ownership_responsibility_structure.md
│   └── performance_durability_structure.md
├── docs/
│   └── README.md                        ← Diese Datei
└── add_submodels.sh                     ← BaSyx Registrierungsscript
```

---

## 3. Typ- und Instanzebene (Kernprinzip)

Das Referenzmodell unterscheidet explizit zwischen zwei Datenebenen:

### Typebene (battery_model_001.json)
- Repräsentiert das **Batteriemodell** als generischen Typ
- `assetKind: "Type"`
- Enthält: CO₂-Fußabdruck, Materialzusammensetzung, Performance-Parameter, Technische Spezifikation
- **Gilt für alle Instanzen dieses Modells**

### Instanzebene (battery_module_001.json)
- Repräsentiert eine **konkrete physische Batterieeinheit** (Seriennummer BAT-EJOT-2025-00001)
- `assetKind: "Instance"`
- Enthält: Eigentumsdaten, Lifecycle-Status, Zertifikate, Kreislaufwirtschaftsdaten
- **`derivedFrom`-Referenz verknüpft Instanz mit Modelltyp**

```
battery_model_001 (Type)
        │
        │ derivedFrom
        ▼
battery_module_001 (Instance)
```

---

## 4. Submodelle und Verantwortlichkeiten

| Submodell | Ebene | Verpflichtung | Primäre Akteure | Datenart |
|---|---|---|---|---|
| General Product Information | Typ + Instanz | PFLICHT | Hersteller | statisch + dynamisch |
| Carbon Footprint | Typ | PFLICHT | Hersteller, Behörden | statisch |
| Material Composition | Typ | PFLICHT (teilweise) | Hersteller, Recycler | statisch |
| Performance & Durability | Typ + Instanz | PFLICHT | Hersteller, Betreiber | statisch + dynamisch |
| Lifecycle & Circularity | Instanz | PFLICHT | Alle | dynamisch |
| Labels & Certification | Typ | PFLICHT (kategoriespezifisch) | Hersteller, Behörden | statisch |
| Due Diligence | Instanz | PFLICHT (akteurspezifisch) | Behörden | statisch |
| Ownership & Responsibility | Instanz | PFLICHT (ereignisbasiert) | Alle | dynamisch |

---

## 5. GPI – Zwei Implementierungsvarianten

Das Submodell `GeneralProductInformation` liegt in zwei Varianten vor:

### Variante A: Direkte Datenwerte
**Datei:** `sm_general_product_information_battery_001.json`  
Alle Felder enthalten konkrete Werte (`"value": "..."`).  
→ **Einsatz:** Demonstrator, Prototyp, BaSyx-Testumgebung

### Variante B: Externe Systemreferenzen
**Datei:** `sm_general_product_information_battery_001_refVariant.json`  
Alle Felder enthalten `"valueId"` mit URI-Referenz auf das Quellsystem.  
→ **Einsatz:** Produktive Umgebung, echte Systemintegration

#### Systemzuordnung (Variante B)

| Quellsystem | Anbindung | Felder |
|---|---|---|
| **ERP** | REST-API, OAuth2 | BatteryId, ManufacturerName, ManufacturerAddress |
| **PLM**  | REST-API, OAuth2 | ModelId, BatteryCategory, TechnicalSpecification |
| **MES** | REST-API, OAuth2 | BatchId, ManufacturingDate |
| **Governance-Service** (intern) | REST-API, OAuth2 | BatteryStatus, Versionierung, Verantwortlichkeit |
| **Audit-Trail-DB** (intern) | REST-API | AuditReference |

---

## 6. Datentypen und Feldkennzeichnung

Alle Felder in den JSON-Dateien enthalten folgende Metadaten-Felder (mit `_`-Präfix – keine AAS-Standardfelder, nur zur Dokumentation):

| Feld | Bedeutung |
|---|---|
| `_dataSource` | Quellsystem, aus dem der Wert stammt |
| `_dataType` | `static` = unveränderlich nach Produktion \| `dynamic` = wird über Lifecycle aktualisiert |
| `_regulatoryRef` | Artikel/Anhang der EU-Batterieverordnung 2023/1542 + Verpflichtungsgrad |
| `_eclass` | ECLASS IRDI für semantische Referenzierung |
| `_unit` | Physikalische Einheit des Wertes |
| `_note` | Hinweis für Entwickler / zukünftige Implementierung |

> **Wichtig:** Felder mit `_`-Präfix sind **keine AAS-Standardfelder**. Sie dienen der Dokumentation und müssen vor dem Produktionseinsatz entfernt oder in `description`-Felder überführt werden.

---

## 7. Statische vs. dynamische Daten

### Statische Daten
Entstehen bei der Produktion und ändern sich danach **nicht mehr**:
- Seriennummer, Modell-ID, Chargennummer
- Herstellerinformationen
- Technische Spezifikation (Spannung, Kapazität, Chemie)
- CO₂-Fußabdruck (Typebene)
- Materialzusammensetzung

### Dynamische Daten
Werden über den **Lebenszyklus kontinuierlich aktualisiert**:

| Feld | Auslöser | Häufigkeit |
|---|---|---|
| `BatteryStatus` | Lifecycle-Events (Kauf, Second Life, Recycling) | ereignisbasiert |
| `ResponsibleOperator` | Eigentumswechsel | ereignisbasiert |
| `SubmodelVersion` | Jede Änderung an einem Submodell | bei Änderung |
| `LastUpdatedAt` | Jede Änderung | bei Änderung |
| `SoH` (Performance-SM) | Messdaten vom BMS | regelmäßig (täglich/wöchentlich) |
| `ChargeCount` | Ladevorgänge | regelmäßig |
| `AuditReference` | Jedes Governance-Event | ereignisbasiert |

---

## 8. Lifecycle-Events und DBP-Aktualisierungen

Gemäß dem Referenzmodell (vgl. Masterarbeit, Abschnitt 5.2.2.1 und Abbildung 5.4) lösen folgende Ereignisse Aktualisierungen im DBP aus:

```
Produktion           → DBP v1.0 erstellt (Instanz, Typ verknüpft)
      │
Eigentumstransfer    → Ownership-SM aktualisiert, Governance-Metadaten
      │
Nutzung / Wartung    → Performance-SM aktualisiert (SoH, Zyklen)
      │
Second-Life          → Neue DBP-Instanz (v2.0) mit Parent-Child-Referenz
      │                 BatteryStatus = "Repurposed"
Remanufacturing      → Material- und Performance-Daten partiell aktualisiert
      │
Recycling            → Finale Instanzaktualisierung, Archivierung
                       BatteryStatus = "Waste"
```

---

## 9. Einschränkungen des Prototyps

Folgende Aspekte wurden im Prototyp **nicht implementiert** (konzeptionell vorgesehen):

| Aspekt | Status | Verweis |
|---|---|---|
| RBAC / Zugriffskontrolle | Konzeptionell (Tabellen 5.6, 5.7) | Kapitel 8.4: nächster Schritt |
| OPC UA / MQTT Integration | Konzeptionell | Kapitel 8.4 |
| EDC / Datenraum-Anbindung | Konzeptionell | Kapitel 8.4 |
| Vollständige IRDI-Referenzen | Strukturell vorbereitet | Kapitel 8.4 |
| Dynamische Laufzeitdaten (SoH) | Konzeptionell | Kapitel 8.4 |
| Policy-Enforcement | Konzeptionell | Kapitel 8.4 |

Der Prototyp validiert **strukturelle Konsistenz und technische Instanziierbarkeit** – nicht den produktiven Betrieb.

---

## 10. BaSyx-Registrierung

Alle AAS-Instanzen und Submodelle müssen in der BaSyx-Umgebung registriert werden.  
Das Script `add_submodels.sh` automatisiert diesen Prozess.

### Manuelle Registrierung (REST-API)

```bash
# AAS-Instanz registrieren
curl -X POST http://localhost:8081/shells \
  -H "Content-Type: application/json" \
  -d @aas_instances/battery_module_001.json

# AAS-Modell registrieren
curl -X POST http://localhost:8081/shells \
  -H "Content-Type: application/json" \
  -d @aas_model/battery_model_001.json

# GPI Submodell registrieren (Variante A)
curl -X POST http://localhost:8081/submodels \
  -H "Content-Type: application/json" \
  -d @submodel_instances/sm_general_product_information_battery_001.json
```

### Zugriff nach Registrierung

```
# AAS-Instanz abrufen
GET http://localhost:8081/shells/urn%3Auuid%3Aaas-battery-module-001

# Submodell-Element abrufen
GET http://localhost:8081/submodels/urn%3Adbp%3Asubmodel%3AgeneralProductInformation%3Abattery001/submodel-elements/BatteryIdentification.BatteryId

# BaSyx Web UI
http://localhost:3000
```

---

*Letzte Aktualisierung: März 2026*
