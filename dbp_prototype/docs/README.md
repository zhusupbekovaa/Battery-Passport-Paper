# DBP Prototype – Documentation
**Project:** Digital Battery Pass (DBP) – Prototype Implementation


## 1. Overview

This prototype implements the **Digital Battery Pass (DBP)** for an industrial Lithium-Ion battery module (48V / 100Ah) based on the **Asset Administration Shell (AAS)** according to IEC 63278-1. The implementation uses **Eclipse BaSyx** as the AAS runtime environment.

### Regulatory Basis
The EU Battery Regulation 2023/1542 requires certain battery classes to provide a DBP starting in 2027. For industrial batteries above 2 kWh (this module: 4.8 kWh), the full information obligation under Art. 77 and Annex XIII applies.

---

## 2. Architecture and File Structure

```
DBP Prototype/
├── aas_instances/
│   └── battery_module_001.json          ← AAS instance (instance level)
├── aas_model/
│   └── battery_model_001.json           ← AAS model (type level)
├── submodel_instances/
│   ├── sm_general_product_information_battery_001.json           ← GPI variant A (dummy data)
│   ├── sm_general_product_information_battery_001_refVariant.json ← GPI variant B (references)
│   ├── sm_carbon_footprint_battery_001.json
│   ├── sm_circularity_battery_001.json
│   ├── sm_due_diligence_battery_001.json
│   ├── sm_labels_battery_001.json
│   ├── sm_material_composition_battery_001.json
│   ├── sm_ownership_responsibility_battery_001.json
│   └── sm_performance_durability_battery_001.json
├── submodel_definitions/
│   ├── general_product_information_structure.md    ← GPI documentation (complete)
│   ├── carbon_footprint_structure.md
│   ├── circularity_structure.md
│   ├── due_diligence_structure.md
│   ├── labels_structure.md
│   ├── material_composition_structure.md
│   ├── ownership_responsibility_structure.md
│   └── performance_durability_structure.md
├── docs/
│   └── README.md                        ← This file
└── add_submodels.sh                     ← BaSyx registration script
```

---

## 3. Type and Instance Level (Core Principle)

The reference model explicitly distinguishes between two data levels:

### Type Level (battery_model_001.json)
- Represents the **battery model** as a generic type
- `assetKind: "Type"`
- Contains: CO₂ footprint, material composition, performance parameters, technical specification
- **Applies to all instances of this model**

### Instance Level (battery_module_001.json)
- Represents a **specific physical battery unit** (serial number BAT-EJOT-2025-00001)
- `assetKind: "Instance"`
- Contains: ownership data, lifecycle status, certificates, circular economy data
- **`derivedFrom` reference links the instance to the model type**

```
battery_model_001 (Type)
        │
        │ derivedFrom
        ▼
battery_module_001 (Instance)
```

---

## 4. Submodels and Responsibilities

| Submodel | Level | Obligation | Primary Actors | Data Type |
|---|---|---|---|---|
| General Product Information | Type + Instance | MANDATORY | Manufacturer | static + dynamic |
| Carbon Footprint | Type | MANDATORY | Manufacturer, authorities | static |
| Material Composition | Type | MANDATORY (partially) | Manufacturer, recycler | static |
| Performance & Durability | Type + Instance | MANDATORY | Manufacturer, operator | static + dynamic |
| Lifecycle & Circularity | Instance | MANDATORY | All | dynamic |
| Labels & Certification | Type | MANDATORY (category-specific) | Manufacturer, authorities | static |
| Due Diligence | Instance | MANDATORY (actor-specific) | Authorities | static |
| Ownership & Responsibility | Instance | MANDATORY (event-based) | All | dynamic |

---

## 5. GPI – Two Implementation Variants

The `GeneralProductInformation` submodel exists in two variants:

### Variant A: Direct Data Values
**File:** `sm_general_product_information_battery_001.json`
All fields contain concrete values (`"value": "..."`).
→ **Use case:** demonstrator, prototype, BaSyx test environment

### Variant B: External System References
**File:** `sm_general_product_information_battery_001_refVariant.json`
All fields contain a `"valueId"` with a URI reference to the source system.
→ **Use case:** production environment, real system integration

#### System Mapping (Variant B)

| Source system | Connection | Fields |
|---|---|---|
| **ERP** | REST API, OAuth2 | BatteryId, ManufacturerName, ManufacturerAddress |
| **PLM**  | REST API, OAuth2 | ModelId, BatteryCategory, TechnicalSpecification |
| **MES** | REST API, OAuth2 | BatchId, ManufacturingDate |
| **Governance service** (internal) | REST API, OAuth2 | BatteryStatus, versioning, responsibility |
| **Audit trail DB** (internal) | REST API | AuditReference |

---

## 6. Data Types and Field Markers

All fields in the JSON files contain the following metadata fields (with `_` prefix – not AAS standard fields, for documentation purposes only):

| Field | Meaning |
|---|---|
| `_dataSource` | Source system the value originates from |
| `_dataType` | `static` = unchangeable after production \| `dynamic` = updated over the lifecycle |
| `_regulatoryRef` | Article/annex of the EU Battery Regulation 2023/1542 + level of obligation |
| `_eclass` | ECLASS IRDI for semantic referencing |
| `_unit` | Physical unit of the value |
| `_note` | Note for developers / future implementation |

> **Important:** Fields with the `_` prefix are **not standard AAS fields**. They serve documentation purposes and must be removed or migrated into `description` fields before production use.

---

## 7. Static vs. Dynamic Data

### Static Data
Established during production and **never changes afterward**:
- Serial number, model ID, batch number
- Manufacturer information
- Technical specification (voltage, capacity, chemistry)
- CO₂ footprint (type level)
- Material composition

### Dynamic Data
Continuously updated over the **lifecycle**:

| Field | Trigger | Frequency |
|---|---|---|
| `BatteryStatus` | Lifecycle events (purchase, second life, recycling) | event-based |
| `ResponsibleOperator` | Change of ownership | event-based |
| `SubmodelVersion` | Every change to a submodel | on change |
| `LastUpdatedAt` | Every change | on change |
| `SoH` (Performance SM) | Measurement data from the BMS | regularly (daily/weekly) |
| `ChargeCount` | Charging cycles | regularly |
| `AuditReference` | Every governance event | event-based |

---

## 8. Lifecycle Events and DBP Updates

According to the reference model (cf. master's thesis, section 5.2.2.1 and figure 5.4), the following events trigger updates to the DBP:

```
Production           → DBP v1.0 created (instance linked to type)
      │
Ownership transfer   → Ownership SM updated, governance metadata
      │
Use / Maintenance    → Performance SM updated (SoH, cycles)
      │
Second life          → New DBP instance (v2.0) with parent-child reference
      │                 BatteryStatus = "Repurposed"
Remanufacturing       → Material and performance data partially updated
      │
Recycling             → Final instance update, archiving
                        BatteryStatus = "Waste"
```

---

## 9. Prototype Limitations

The following aspects were **not implemented** in the prototype (conceptually foreseen):

| Aspect | Status | Reference |
|---|---|---|
| RBAC / access control | Conceptual (tables 5.6, 5.7) | Chapter 8.4: next step |
| OPC UA / MQTT integration | Conceptual | Chapter 8.4 |
| EDC / data space integration | Conceptual | Chapter 8.4 |
| Complete IRDI references | Structurally prepared | Chapter 8.4 |
| Dynamic runtime data (SoH) | Conceptual | Chapter 8.4 |
| Policy enforcement | Conceptual | Chapter 8.4 |

The prototype validates **structural consistency and technical instantiability** – not production operation.

---

## 10. BaSyx Registration

All AAS instances and submodels must be registered in the BaSyx environment.
The `add_submodels.sh` script automates this process.

### Manual Registration (REST API)

```bash
# Register AAS instance
curl -X POST http://localhost:8081/shells \
  -H "Content-Type: application/json" \
  -d @aas_instances/battery_module_001.json

# Register AAS model
curl -X POST http://localhost:8081/shells \
  -H "Content-Type: application/json" \
  -d @aas_model/battery_model_001.json

# Register GPI submodel (variant A)
curl -X POST http://localhost:8081/submodels \
  -H "Content-Type: application/json" \
  -d @submodel_instances/sm_general_product_information_battery_001.json
```

### Access After Registration

```
# Retrieve AAS instance
GET http://localhost:8081/shells/urn%3Auuid%3Aaas-battery-module-001

# Retrieve submodel element
GET http://localhost:8081/submodels/urn%3Adbp%3Asubmodel%3AgeneralProductInformation%3Abattery001/submodel-elements/BatteryIdentification.BatteryId

# BaSyx Web UI
http://localhost:3000
```

---

*Last updated: March 2026*
