/**
 * adapter-idta-02035.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Parser for the OFFICIAL IDTA-02035 Digital Battery Passport submodels.
 *
 * Standard:  IDTA-02035-1 … -7  (August 2025)
 *            Based on DIN DKE SPEC 99100:2025-02
 *
 * The 7 official parts and their idShort / semanticId patterns:
 * ┌────────┬────────────────────────────┬────────────────────────────────────────────┐
 * │ Part   │ idShort (typical)          │ semanticId (admin-shell.io IRI)            │
 * ├────────┼────────────────────────────┼────────────────────────────────────────────┤
 * │ P1     │ DigitalNameplate           │ …/idta/battery/DigitalNameplate/1/0        │
 * │ P2     │ HandoverDocumentation      │ …/idta/battery/HandoverDocumentation/1/0   │
 * │ P3     │ ProductCarbonFootprint     │ …/idta/battery/ProductCarbonFootprint/1/0  │
 * │ P4     │ TechnicalData              │ …/idta/battery/TechnicalData/1/0           │
 * │ P5     │ ProductCondition           │ …/idta/battery/ProductCondition/1/0        │
 * │ P6     │ MaterialComposition        │ …/idta/battery/MaterialComposition/1/0     │
 * │ P7     │ Circularity                │ …/idta/battery/Circularity/1/0             │
 * └────────┴────────────────────────────┴────────────────────────────────────────────┘
 *
 * Detection strategy:
 *   1. Check submodel.semanticId against the known IRI patterns (most reliable).
 *   2. Fallback: check submodel.idShort against the known names.
 *
 * Field extraction:
 *   Uses getPropBySemanticId() wherever possible (robust, idShort-independent).
 *   Falls back to getPropByPath() with IDTA field names when no semanticId is set.
 *
 * Note on field name differences vs. prototype adapter:
 *   IDTA-02035 uses flat structures in many places (no nesting under
 *   "BatteryIdentification" etc.) and ECLASS IRDIs as semanticIds.
 *   See the mapping comments on each field below.
 */

const {
  getPropByPath,
  getPropBySemanticId,
  getSubmodelSemanticId,
  normalizeId,
} = require("./aas-utils");

// ─── Known semanticId IRI fragments for detection ────────────────────────────
// admin-shell.io publishes these; we match on the path segment, ignoring
// the exact version suffix so "1/0" and "1/1" both match.
const SEMID_PATTERNS = {
  nameplate:   /idta[/._-](?:02035[/._-]?1|battery[/._-]digitalNameplate|battery[/._-]nameplate)/i,
  handover:    /idta[/._-](?:02035[/._-]?2|battery[/._-]handover)/i,
  carbon:      /idta[/._-](?:02035[/._-]?3|battery[/._-](?:product)?carbonFootprint|02023)/i,
  technical:   /idta[/._-](?:02035[/._-]?4|battery[/._-]technicalData)/i,
  condition:   /idta[/._-](?:02035[/._-]?5|battery[/._-]productCondition)/i,
  material:    /idta[/._-](?:02035[/._-]?6|battery[/._-]materialComposition)/i,
  circularity: /idta[/._-](?:02035[/._-]?7|battery[/._-]circularity)/i,
};

// ─── idShort fallback patterns for detection ─────────────────────────────────
const IDSHORT_MAP = {
  DigitalNameplate:        "nameplate",
  Nameplate:               "nameplate",
  HandoverDocumentation:   "handover",
  ProductCarbonFootprint:  "carbon",
  CarbonFootprint:         "carbon",   // some implementations shorten it
  TechnicalData:           "technical",
  ProductCondition:        "condition",
  MaterialComposition:     "material",
  Circularity:             "circularity",
};

// ─── ECLASS IRDIs and admin-shell.io IRIs used in IDTA-02035 fields ──────────
// Source: IDTA-02035 specification + DIN DKE SPEC 99100:2025-02
// These are used by getPropBySemanticId() for robust extraction.
const SID = {
  // Part 1 – Digital Nameplate
  serialNumber:          "0173-1#02-AAM556#002",
  manufacturerName:      "0173-1#02-AAO677#002",
  manufacturerPartNumber:"0173-1#02-AAO676#003",
  manufacturingDate:     "https://admin-shell.io/idta/battery/manufacturingDate/1/0",
  batteryCategory:       "https://admin-shell.io/idta/battery/batteryCategory/1/0",
  batteryStatus:         "https://admin-shell.io/idta/battery/batteryStatus/1/0",
  manufacturerAddress:   "0173-1#02-AAQ832#001",
  manufacturerWebsite:   "https://admin-shell.io/idta/battery/manufacturerWebsite/1/0",
  passportId:            "https://admin-shell.io/idta/battery/passportId/1/0",
  qrCode:                "https://admin-shell.io/idta/battery/qrCode/1/0",

  // Part 3 – Product Carbon Footprint
  pcfCO2eq:              "https://admin-shell.io/idta/battery/pcfCO2eq/1/0",
  pcfPerformanceClass:   "https://admin-shell.io/idta/battery/pcfPerformanceClass/1/0",
  pcfCalculationMethod:  "https://admin-shell.io/idta/battery/pcfCalculationMethod/1/0",
  pcfRawMaterial:        "https://admin-shell.io/idta/battery/carbonFootprintRawMaterial/1/0",
  pcfProduction:         "https://admin-shell.io/idta/battery/carbonFootprintProduction/1/0",
  pcfDistribution:       "https://admin-shell.io/idta/battery/carbonFootprintDistribution/1/0",
  pcfEndOfLife:          "https://admin-shell.io/idta/battery/carbonFootprintEndOfLife/1/0",
  pcfVerifier:           "https://admin-shell.io/idta/battery/thirdPartyVerifiedPcf/1/0",

  // Part 4 – Technical Data
  nominalVoltage:        "0173-1#02-AAQ641#002",
  nominalCapacity:       "0173-1#02-AAQ642#002",
  nominalEnergy:         "https://admin-shell.io/idta/battery/nominalEnergy/1/0",
  batteryChemistry:      "https://admin-shell.io/idta/battery/batteryChemistry/1/0",
  weightBattery:         "0173-1#02-AAF575#002",
  expectedLifetimeCycles:"https://admin-shell.io/idta/battery/expectedLifetimeCycles/1/0",
  operatingTempMin:      "https://admin-shell.io/idta/battery/temperatureRangeMin/1/0",
  operatingTempMax:      "https://admin-shell.io/idta/battery/temperatureRangeMax/1/0",

  // Part 5 – Product Condition
  stateOfHealth:         "https://admin-shell.io/idta/battery/stateOfHealth/1/0",
  remainingCapacity:     "https://admin-shell.io/idta/battery/remainingCapacity/1/0",
  fullChargeCycles:      "https://admin-shell.io/idta/battery/fullChargeCycles/1/0",
  lastMeasurement:       "https://admin-shell.io/idta/battery/lastMeasurementDate/1/0",
  powerCapability:       "https://admin-shell.io/idta/battery/powerCapability/1/0",

  // Part 6 – Material Composition
  cathodeMaterial:       "https://admin-shell.io/idta/battery/cathodeActiveMaterial/1/0",
  anodeMaterial:         "https://admin-shell.io/idta/battery/anodeActiveMaterial/1/0",
  electrolyteComposition:"https://admin-shell.io/idta/battery/electrolyteComposition/1/0",
  cobaltRecycled:        "https://admin-shell.io/idta/battery/cobaltRecycledContent/1/0",
  lithiumRecycled:       "https://admin-shell.io/idta/battery/lithiumRecycledContent/1/0",
  nickelRecycled:        "https://admin-shell.io/idta/battery/nickelRecycledContent/1/0",
  cobaltOrigin:          "https://admin-shell.io/idta/battery/placeOfMining_cobalt/1/0",
  lithiumOrigin:         "https://admin-shell.io/idta/battery/placeOfMining_lithium/1/0",
  nickelOrigin:          "https://admin-shell.io/idta/battery/placeOfMining_nickel/1/0",

  // Part 7 – Circularity
  batteryStatusCirc:     "https://admin-shell.io/idta/battery/batteryStatus/1/0",
  dismantlingManual:     "https://admin-shell.io/idta/battery/dismantlingInformation/1/0",
  recyclingEfficiency:   "https://admin-shell.io/idta/battery/recyclingEfficiency/1/0",
  recyclabilityRate:     "https://admin-shell.io/idta/battery/recyclabilityRate/1/0",
  wasteCode:             "https://admin-shell.io/idta/battery/wasteCode/1/0",
};

// ─── Detect: does this submodel belong to IDTA-02035? ────────────────────────
function detect(submodel) {
  const semId = getSubmodelSemanticId(submodel);
  if (semId) {
    for (const pattern of Object.values(SEMID_PATTERNS)) {
      if (pattern.test(semId)) return true;
    }
  }
  return !!IDSHORT_MAP[submodel?.idShort];
}

// ─── Role: which of the 7 parts is this? ─────────────────────────────────────
function role(submodel) {
  const semId = getSubmodelSemanticId(submodel);
  if (semId) {
    for (const [roleName, pattern] of Object.entries(SEMID_PATTERNS)) {
      if (pattern.test(semId)) return roleName;
    }
  }
  return IDSHORT_MAP[submodel?.idShort] || null;
}

// ─── Helper: try semanticId first, fall back to idShort path ─────────────────
function get(elements, semanticId, idShortPath) {
  // Try by semanticId first (IDTA-compliant)
  const byId = getPropBySemanticId(elements, semanticId);
  if (byId !== null && byId !== undefined) return byId;
  // Fallback to idShort path (works when semanticIds are missing)
  if (idShortPath) return getPropByPath(elements, idShortPath);
  return null;
}

// ─── Main extract function ────────────────────────────────────────────────────
function extract(submodelsByRole) {
  const el = (r) => submodelsByRole[r]?.submodelElements || [];

  // Part 1 – Digital Nameplate
  const np = el("nameplate");
  // Part 3 – Product Carbon Footprint
  const cf = el("carbon");
  // Part 4 – Technical Data
  const td = el("technical");
  // Part 5 – Product Condition
  const pc = el("condition");
  // Part 6 – Material Composition
  const mc = el("material");
  // Part 7 – Circularity
  const ci = el("circularity");
  // Part 2 – Handover Documentation
  const hd = el("handover");

  return {
    _adapter: "idta-02035",

    identification: {
      // IDTA P1: SerialNumber is flat (no BatteryIdentification wrapper)
      batteryId:  get(np, SID.serialNumber,   "SerialNumber"),
      modelId:    get(np, SID.manufacturerPartNumber, "ManufacturerProductDesignation")
               || get(np, SID.manufacturerPartNumber, "OrderCodeOfManufacturer"),
      batchId:    getPropByPath(np, "BatchId") || getPropByPath(np, "BatchNumber"),
      category:   get(np, SID.batteryCategory, "BatteryCategory"),
      status:     get(np, SID.batteryStatus,   "BatteryStatus")
               || get(ci, SID.batteryStatusCirc,"BatteryStatus"),
      // QR code / passport URI can be in Nameplate or as a File element
      qrCodeLink: get(np, SID.qrCode,          "URIOfTheProduct")
               || get(np, SID.passportId,       "DigitalPassportIdentifier"),
      aasEndpoint:getPropByPath(np, "AASEndpoint"),
      passportId: get(np, SID.passportId,      "DigitalPassportIdentifier"),
    },

    manufacturer: {
      name:    get(np, SID.manufacturerName,    "ManufacturerName"),
      address: get(np, SID.manufacturerAddress, "ManufacturerAddress"),
      date:    get(np, SID.manufacturingDate,   "ManufacturingDate") || getPropByPath(np, "YearOfConstruction"),
      plant:   getPropByPath(np, "UniqueFacilityIdentifier") || getPropByPath(np, "ManufacturingPlant"),
      contact: getPropByPath(np, "ManufacturerContact"),
      website: get(np, SID.manufacturerWebsite, "ManufacturerWebsite"),
    },

    technical: {
      voltage:     get(td, SID.nominalVoltage,   "NominalVoltage"),
      capacity:    get(td, SID.nominalCapacity,  "NominalCapacity"),
      energy:      get(td, SID.nominalEnergy,    "NominalEnergy"),
      chemistry:   get(td, SID.batteryChemistry, "BatteryChemistry"),
      // IDTA P4 uses TechnicalProperties collection for many fields
      cellType:    getPropByPath(td, "TechnicalProperties.CellType")
                || getPropByPath(td, "CellType"),
      cells:       getPropByPath(td, "TechnicalProperties.NumberOfCells")
                || getPropByPath(td, "NumberOfCells"),
      weight:      get(td, SID.weightBattery,    "WeightOfBattery"),
      protection:  getPropByPath(td, "TechnicalProperties.IPCode")
                || getPropByPath(td, "IPCode"),
    },

    carbonFootprint: {
      // IDTA P3 wraps each footprint entry in a ProductCarbonFootprints list
      total:         get(cf, SID.pcfCO2eq,            "PCFCO2eq")
                  || getPropByPath(cf, "ProductCarbonFootprints.ProductCarbonFootprint00.PCFCO2eq"),
      unit:          "kg CO2e / kWh",
      class:         get(cf, SID.pcfPerformanceClass, "PCFPerformanceClass"),
      rawMaterial:   get(cf, SID.pcfRawMaterial,      "CarbonFootprintRawMaterial"),
      production:    get(cf, SID.pcfProduction,       "CarbonFootprintProduction"),
      distribution:  get(cf, SID.pcfDistribution,     "CarbonFootprintDistribution"),
      endOfLife:     get(cf, SID.pcfEndOfLife,        "CarbonFootprintEndOfLife"),
      methodology:   get(cf, SID.pcfCalculationMethod,"PCFCalculationMethod"),
      verifier:      get(cf, SID.pcfVerifier,         "ThirdPartyVerifiedPcf"),
      renewableShare:getPropByPath(cf, "RenewableEnergyShare"),
    },

    recycledContent: {
      cobalt:  get(mc, SID.cobaltRecycled,  "RecycledContentCobalt"),
      lithium: get(mc, SID.lithiumRecycled, "RecycledContentLithium"),
      nickel:  get(mc, SID.nickelRecycled,  "RecycledContentNickel"),
    },

    materials: {
      cathode:      get(mc, SID.cathodeMaterial,      "CathodeActiveMaterial"),
      anode:        get(mc, SID.anodeMaterial,        "AnodeActiveMaterial"),
      electrolyte:  get(mc, SID.electrolyteComposition,"ElectrolyteComposition"),
      cobaltOrigin: get(mc, SID.cobaltOrigin,         "PlaceOfMining_Cobalt"),
      lithiumOrigin:get(mc, SID.lithiumOrigin,        "PlaceOfMining_Lithium"),
      nickelOrigin: get(mc, SID.nickelOrigin,         "PlaceOfMining_Nickel"),
    },

    performance: {
      // IDTA P5 – Product Condition (dynamic data)
      soh:          get(pc, SID.stateOfHealth,     "BatteryStateOfHealth")
                 || get(pc, SID.stateOfHealth,     "StateOfHealth"),
      capacity:     get(pc, SID.remainingCapacity, "RemainingCapacity"),
      cycles:       get(pc, SID.fullChargeCycles,  "FullChargeCycles"),
      maxCycles:    get(td, SID.expectedLifetimeCycles, "ExpectedLifetimeCycles"),
      lifetimeYears:getPropByPath(td, "ExpectedLifetimeYears"),
      lastMeasured: get(pc, SID.lastMeasurement,   "LastMeasurementDate"),
      // Temperature in P5 or P4
      maxTemp:      getPropByPath(pc, "MaxTemperature")
                 || get(td, SID.operatingTempMax,  "TemperatureRangeMax"),
      avgTemp:      getPropByPath(pc, "AverageOperatingTemperature"),
      thermalEvents:getPropByPath(pc, "ThermalEventsCount"),
    },

    lifecycle: {
      // Status is in P1 Nameplate AND P7 Circularity
      status:         get(np, SID.batteryStatus,    "BatteryStatus")
                   || get(ci, SID.batteryStatusCirc, "BatteryStatus"),
      statusDate:     getPropByPath(ci, "StatusChangeDate"),
      dismantlingRef: get(ci, SID.dismantlingManual, "DismantlingInformation"),
      recyclability:  get(ci, SID.recyclabilityRate, "RecyclabilityRate"),
      recyclingTarget:get(ci, SID.recyclingEfficiency,"RecyclingEfficiency"),
    },

    ownership: {
      // IDTA P2 – Handover Documentation contains economic operator info
      operatorName: getPropByPath(hd, "EconomicOperator.OperatorName")
                 || getPropByPath(hd, "ResponsibleEconomicOperator"),
      operatorRole: getPropByPath(hd, "EconomicOperator.OperatorRole"),
      since:        getPropByPath(hd, "EconomicOperator.ResponsibilityStartDate"),
    },

    certification: {
      // P2 – Handover Documentation contains CE Declaration, certificates
      ceRef:        getPropByPath(hd, "CEDeclaration")
                 || getPropByPath(hd, "DeclarationOfConformity"),
      un383Ref:     getPropByPath(hd, "UN383TestReport"),
      iecStandard:  getPropByPath(hd, "IECTestStandard")
                 || getPropByPath(td, "ApplicableStandards"),
      co2Class:     get(cf, SID.pcfPerformanceClass, "PCFPerformanceClass"),
    },

    // IDTA-02035 does not define a Governance submodel –
    // administrative data lives in the AAS shell itself.
    governance: {
      version:     null,
      createdAt:   null,
      updatedAt:   null,
      responsible: getPropByPath(hd, "EconomicOperator.OperatorName"),
      quality:     null,
    },
  };
}

module.exports = { detect, role, extract };
