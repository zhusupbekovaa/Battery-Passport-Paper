/**
 * adapter-registry.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central dispatcher: given a map of submodels, selects the right adapter
 * and returns a normalised passport object.
 *
 * Adapter priority order:
 *   1. IDTA-02035  (official standard – detected via semanticId)
 *   2. Prototype   (thesis custom format – detected via idShort)
 *   3. Generic     (fallback – always matches, uses heuristics)
 *
 * How it works:
 *   1. Iterate every submodel in the shell.
 *   2. Ask each adapter "do you recognise this submodel?" (detect)
 *   3. Group submodels by [adapter → role] pairs.
 *   4. The adapter with the MOST matched submodels wins.
 *   5. Call that adapter's extract(submodelsByRole) function.
 *   6. Return { passport, adapterName, adapterDetails }.
 */

const adapterIdta   = require("./adapter-idta-02035");
const adapterProto  = require("./adapter-prototype");
const adapterGeneric= require("./adapter-generic");

// Ordered list – first match with highest score wins
const ADAPTERS = [
  { name: "idta-02035",  label: "IDTA-02035 (offiziell)", adapter: adapterIdta },
  { name: "prototype",   label: "Prototyp (Masterarbeit)", adapter: adapterProto },
  { name: "generic",     label: "Generisch (Fallback)",    adapter: adapterGeneric },
];

/**
 * resolve(submodels)
 *
 * @param {Object} submodels  – map of idShort → submodel object
 *                              (as returned by server.js fetchSubmodel loop)
 * @returns {{ passport, adapterName, adapterLabel, roleMap, unknownSubmodels }}
 */
function resolve(submodels) {
  const submodelList = Object.values(submodels);

  // ── Score each non-generic adapter ─────────────────────────────────────────
  const scores = {}; // adapterName → { score, roleMap }

  for (const { name, adapter } of ADAPTERS.filter(a => a.name !== "generic")) {
    let score = 0;
    const roleMap = {}; // role → submodel object

    for (const sm of submodelList) {
      if (adapter.detect(sm)) {
        const r = adapter.role(sm);
        if (r && !roleMap[r]) {
          // First match per role wins (avoid duplicates)
          roleMap[r] = sm;
          score++;
        }
      }
    }
    scores[name] = { score, roleMap };
  }

  // ── Pick winner (highest score > 0) ────────────────────────────────────────
  let winnerName = null;
  let winnerScore = 0;

  for (const [name, { score }] of Object.entries(scores)) {
    if (score > winnerScore) {
      winnerScore = score;
      winnerName = name;
    }
  }

  // ── If no adapter matched, fall back to generic ──────────────────────────
  if (!winnerName || winnerScore === 0) {
    // Generic adapter: put all submodels under their idShort as role
    const genericRoleMap = {};
    for (const sm of submodelList) {
      genericRoleMap[sm.idShort || `sm_${Object.keys(genericRoleMap).length}`] = sm;
    }
    const passport = adapterGeneric.extract(genericRoleMap);
    return {
      passport,
      adapterName: "generic",
      adapterLabel: "Generisch (Fallback)",
      roleMap: genericRoleMap,
      unmatchedSubmodels: [],
    };
  }

  // ── Extract with the winning adapter ────────────────────────────────────
  const { roleMap } = scores[winnerName];
  const winnerAdapter = ADAPTERS.find(a => a.name === winnerName);
  const passport = winnerAdapter.adapter.extract(roleMap);

  // Report submodels that weren't matched by the winning adapter
  const matchedIds = new Set(Object.values(roleMap).map(sm => sm.id));
  const unmatchedSubmodels = submodelList
    .filter(sm => !matchedIds.has(sm.id))
    .map(sm => ({ idShort: sm.idShort, id: sm.id, semanticId: sm.semanticId }));

  return {
    passport,
    adapterName: winnerName,
    adapterLabel: winnerAdapter.label,
    roleMap,
    unmatchedSubmodels,
  };
}

/**
 * diagnose(submodels)
 * Returns a full diagnostic report – useful for the /api/debug/:id endpoint.
 */
function diagnose(submodels) {
  const submodelList = Object.values(submodels);
  const report = [];

  for (const sm of submodelList) {
    const semId = sm.semanticId?.keys?.[0]?.value ?? null;
    const matches = [];

    for (const { name, adapter } of ADAPTERS) {
      if (adapter.detect(sm)) {
        matches.push({ adapter: name, role: adapter.role(sm) });
      }
    }

    report.push({
      idShort: sm.idShort,
      id: sm.id,
      semanticId: semId,
      adapterMatches: matches,
    });
  }

  return report;
}

module.exports = { resolve, diagnose };
