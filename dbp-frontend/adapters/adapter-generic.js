/**
 * adapter-generic.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fallback adapter for AAS submodels that don't match any known format.
 *
 * Strategy:
 *   - Flattens ALL submodel elements into a key→value map
 *   - Tries to match fields by common naming heuristics
 *     (e.g. any field whose idShort contains "Serial" → batteryId)
 *   - Everything that can't be matched is exposed as-is in a
 *     "unknownFields" object so the frontend can still show something
 *
 * This adapter always matches (it's the final fallback).
 */

const { flatElements, getSubmodelSemanticId } = require("./aas-utils");

// ─── Heuristic idShort patterns → canonical field names ──────────────────────
// Each entry: [canonicalName, [regex patterns to test against idShort]]
const HEURISTICS = [
  ["batteryId",      [/serial.*number|batteryid|battery.*id/i]],
  ["modelId",        [/model.*id|product.*design|partnumber/i]],
  ["batchId",        [/batch.*id|batch.*num/i]],
  ["category",       [/category|batterytype/i]],
  ["status",         [/battery.*status|lifecycle.*status|current.*status/i]],
  ["manufacturerName",[/manufacturer.*name|mfr.*name/i]],
  ["manufacturingDate",[/manufacturing.*date|mfg.*date|year.*construction/i]],
  ["nominalVoltage", [/nominal.*volt|volt/i]],
  ["nominalCapacity",[/nominal.*cap|capacity/i]],
  ["chemistry",      [/chemistry|cathode.*material|electrochem/i]],
  ["weight",         [/weight/i]],
  ["soh",            [/state.*health|soh/i]],
  ["cycles",         [/charge.*cycle|full.*cycle/i]],
  ["co2Total",       [/co2.*eq|pcf.*co2|carbon.*total/i]],
  ["co2Class",       [/pcf.*class|carbon.*class|performance.*class/i]],
];

function detect() {
  return true; // always matches as fallback
}

function role() {
  return "generic";
}

function extract(submodelsByRole) {
  // Flatten all submodels into one combined field list
  const allFields = [];
  for (const [roleName, sm] of Object.entries(submodelsByRole)) {
    const flat = flatElements(sm?.submodelElements || [], roleName);
    allFields.push(...flat);
  }

  // Build a lookup map by idShort (case-insensitive)
  const byIdShort = {};
  for (const f of allFields) {
    byIdShort[f.idShort?.toLowerCase()] = f.value;
  }

  // Apply heuristics
  const matched = {};
  for (const [canonical, patterns] of HEURISTICS) {
    for (const f of allFields) {
      if (patterns.some(rx => rx.test(f.idShort))) {
        matched[canonical] = f.value;
        break;
      }
    }
  }

  // Expose all fields that couldn't be mapped for raw display
  const mappedKeys = new Set(
    allFields
      .filter(f => HEURISTICS.some(([, pats]) => pats.some(rx => rx.test(f.idShort))))
      .map(f => f.idShort)
  );
  const unknownFields = allFields
    .filter(f => !mappedKeys.has(f.idShort))
    .map(f => ({ path: f.path, idShort: f.idShort, value: f.value, semanticId: f.semanticId }));

  return {
    _adapter: "generic",

    identification: {
      batteryId:  matched.batteryId  || null,
      modelId:    matched.modelId    || null,
      batchId:    matched.batchId    || null,
      category:   matched.category   || null,
      status:     matched.status     || null,
      qrCodeLink: null,
      aasEndpoint:null,
      passportId: null,
    },

    manufacturer: {
      name:    matched.manufacturerName    || null,
      address: null,
      date:    matched.manufacturingDate   || null,
      plant:   null,
      contact: null,
      website: null,
    },

    technical: {
      voltage:   matched.nominalVoltage   || null,
      capacity:  matched.nominalCapacity  || null,
      energy:    null,
      chemistry: matched.chemistry        || null,
      cellType:  null,
      cells:     null,
      weight:    matched.weight           || null,
      protection:null,
    },

    carbonFootprint: {
      total:         matched.co2Total || null,
      unit:          "kg CO2e / kWh",
      class:         matched.co2Class || null,
      rawMaterial:   null,
      production:    null,
      distribution:  null,
      endOfLife:     null,
      methodology:   null,
      verifier:      null,
      renewableShare:null,
    },

    recycledContent: { cobalt: null, lithium: null, nickel: null },
    materials: {
      cathode: matched.chemistry || null,
      anode: null, electrolyte: null,
      cobaltOrigin: null, lithiumOrigin: null, nickelOrigin: null,
    },

    performance: {
      soh:          matched.soh    || null,
      capacity:     null,
      cycles:       matched.cycles || null,
      maxCycles:    null,
      lifetimeYears:null,
      lastMeasured: null,
      maxTemp:      null,
      avgTemp:      null,
      thermalEvents:null,
    },

    lifecycle: {
      status:         matched.status || null,
      statusDate:     null,
      dismantlingRef: null,
      recyclability:  null,
      recyclingTarget:null,
    },

    ownership:   { operatorName: null, operatorRole: null, since: null },
    certification:{ ceRef: null, un383Ref: null, iecStandard: null, co2Class: matched.co2Class || null },
    governance:  { version: null, createdAt: null, updatedAt: null, responsible: null, quality: null },

    // Extra: expose all unknown fields for the Raw tab in the UI
    _unknownFields: unknownFields,
  };
}

module.exports = { detect, role, extract };
