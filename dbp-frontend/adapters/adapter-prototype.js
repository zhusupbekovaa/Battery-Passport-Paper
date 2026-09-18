/**
 * adapter-prototype.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Parser for the CUSTOM PROTOTYPE submodel structure defined in this thesis
 * (Masterarbeit Zhusupbekova, Uni Siegen, 2025).
 *
 * Submodel idShort names recognised:
 *   GeneralProductInformation  · CarbonFootprint  · MaterialComposition
 *   PerformanceDurability      · LifecycleCircularity
 *   OwnershipResponsibility    · LabelsAndCertification  · DueDiligence
 *
 * Detection: submodel.idShort matches one of the names above,
 *            OR semanticId contains "digitalBatteryPass" + a known part name.
 */

const { getPropByPath, getSubmodelSemanticId } = require("./aas-utils");

// ─── Submodel idShort → role mapping ─────────────────────────────────────────
const IDSHORT_MAP = {
  GeneralProductInformation:  "gpi",
  CarbonFootprint:            "cf",
  MaterialComposition:        "mat",
  PerformanceDurability:      "perf",
  LifecycleCircularity:       "lc",
  OwnershipResponsibility:    "own",
  LabelsAndCertification:     "labels",
  DueDiligence:               "dd",
};

// Also catch the Ref-Variant name used in the prototype JSONs
const IDSHORT_ALIASES = {
  GeneralProductInformation_RefVariant: "gpi",
};

function detect(submodel) {
  const id = submodel?.idShort;
  return !!(IDSHORT_MAP[id] || IDSHORT_ALIASES[id]);
}

function role(submodel) {
  return IDSHORT_MAP[submodel?.idShort] || IDSHORT_ALIASES[submodel?.idShort] || null;
}

// ─── Main extract function ────────────────────────────────────────────────────
function extract(submodelsByRole) {
  const g  = (role, path) => getPropByPath(submodelsByRole[role]?.submodelElements || [], path);

  return {
    _adapter: "prototype",

    identification: {
      batteryId:  g("gpi", "BatteryIdentification.BatteryId"),
      modelId:    g("gpi", "BatteryIdentification.ModelId"),
      batchId:    g("gpi", "BatteryIdentification.BatchId"),
      category:   g("gpi", "BatteryIdentification.BatteryCategory"),
      status:     g("gpi", "BatteryIdentification.BatteryStatus")
               || g("lc",  "LifecycleStatus.CurrentStatus"),
      qrCodeLink: g("gpi", "DigitalIdentifiers.QRCodeLink"),
      aasEndpoint:g("gpi", "DigitalIdentifiers.AASEndpoint"),
      passportId: g("gpi", "DigitalIdentifiers.DigitalPassportId"),
    },

    manufacturer: {
      name:    g("gpi", "ManufacturerInformation.ManufacturerName"),
      address: g("gpi", "ManufacturerInformation.ManufacturerAddress"),
      date:    g("gpi", "ManufacturerInformation.ManufacturingDate"),
      plant:   g("gpi", "ManufacturerInformation.ManufacturingPlant"),
      contact: g("gpi", "ManufacturerInformation.ManufacturerContact"),
      website: g("gpi", "ManufacturerInformation.ManufacturerWebsite"),
    },

    technical: {
      voltage:     g("gpi", "TechnicalSpecification.NominalVoltage"),
      capacity:    g("gpi", "TechnicalSpecification.NominalCapacity"),
      energy:      g("gpi", "TechnicalSpecification.NominalEnergy"),
      chemistry:   g("gpi", "TechnicalSpecification.BatteryChemistry"),
      cellType:    g("gpi", "TechnicalSpecification.CellType"),
      cells:       g("gpi", "TechnicalSpecification.NumberOfCells"),
      weight:      g("gpi", "TechnicalSpecification.WeightOfModule"),
      protection:  g("gpi", "TechnicalSpecification.ProtectionClass"),
    },

    carbonFootprint: {
      total:         g("cf", "TotalCarbonFootprint.CarbonFootprintTotal"),
      unit:          g("cf", "TotalCarbonFootprint.CarbonFootprintUnit"),
      class:         g("cf", "TotalCarbonFootprint.CarbonFootprintClass"),
      rawMaterial:   g("cf", "LifecyclePhaseBreakdown.RawMaterialAcquisition"),
      production:    g("cf", "LifecyclePhaseBreakdown.MainProduction"),
      distribution:  g("cf", "LifecyclePhaseBreakdown.Distribution"),
      endOfLife:     g("cf", "LifecyclePhaseBreakdown.EndOfLifeRecycling"),
      methodology:   g("cf", "CarbonFootprintStudy.LCAMethodology"),
      verifier:      g("cf", "CarbonFootprintStudy.ThirdPartyVerifier"),
      renewableShare:g("cf", "RenewableEnergyShare.RenewableEnergyShareProduction"),
    },

    recycledContent: {
      cobalt:  g("mat", "CriticalRawMaterials.Cobalt.RecycledContent"),
      lithium: g("mat", "CriticalRawMaterials.Lithium.RecycledContent"),
      nickel:  g("mat", "CriticalRawMaterials.Nickel.RecycledContent"),
    },

    materials: {
      cathode:       g("mat", "ActiveMaterials.CathodeMaterial"),
      anode:         g("mat", "ActiveMaterials.AnodeMaterial"),
      electrolyte:   g("mat", "ActiveMaterials.ElectrolyteMaterial"),
      cobaltOrigin:  g("mat", "CriticalRawMaterials.Cobalt.CountryOfOrigin"),
      lithiumOrigin: g("mat", "CriticalRawMaterials.Lithium.CountryOfOrigin"),
      nickelOrigin:  g("mat", "CriticalRawMaterials.Nickel.CountryOfOrigin"),
    },

    performance: {
      soh:          g("perf", "CurrentOperationalState.StateOfHealth"),
      capacity:     g("perf", "CurrentOperationalState.RemainingCapacity"),
      cycles:       g("perf", "CurrentOperationalState.FullChargeCycles"),
      maxCycles:    g("perf", "DesignParameters.ExpectedLifetimeCycles"),
      lifetimeYears:g("perf", "DesignParameters.ExpectedLifetimeYears"),
      lastMeasured: g("perf", "CurrentOperationalState.LastMeasurementDate"),
      maxTemp:      g("perf", "TemperatureHistory.MaxTemperatureRecorded"),
      avgTemp:      g("perf", "TemperatureHistory.AverageOperatingTemperature"),
      thermalEvents:g("perf", "TemperatureHistory.ThermalEventsCount"),
    },

    lifecycle: {
      status:         g("lc", "LifecycleStatus.CurrentStatus"),
      statusDate:     g("lc", "LifecycleStatus.StatusChangeDate"),
      dismantlingRef: g("lc", "DismantlingInformation.DismantlingManualRef"),
      recyclability:  g("lc", "DismantlingInformation.RecoverableMaterialsShare"),
      recyclingTarget:g("lc", "DismantlingInformation.RecyclingEfficiencyTarget"),
    },

    ownership: {
      operatorName: g("own", "CurrentResponsibleOperator.OperatorName"),
      operatorRole: g("own", "CurrentResponsibleOperator.OperatorRole"),
      since:        g("own", "CurrentResponsibleOperator.ResponsibilityStartDate"),
    },

    certification: {
      ceRef:       g("labels", "RegulatoryCompliance.CEDeclarationOfConformityRef"),
      un383Ref:    g("labels", "SafetyCertifications.UN383TestReportRef"),
      iecStandard: g("labels", "SafetyCertifications.IECTestStandard"),
      co2Class:    g("labels", "LabellingInformation.CarbonFootprintLabelClass"),
    },

    governance: {
      version:     g("gpi", "GovernanceMetadata.SubmodelVersion"),
      createdAt:   g("gpi", "GovernanceMetadata.CreatedAt"),
      updatedAt:   g("gpi", "GovernanceMetadata.LastUpdatedAt"),
      responsible: g("gpi", "GovernanceMetadata.ResponsibleOperator"),
      quality:     g("gpi", "GovernanceMetadata.DataQualityStatus"),
    },
  };
}

module.exports = { detect, role, extract };
