/**
 * rbac/policies.js
 * Lädt RBAC-Konfiguration aus policies.json (JSON-konfigurierbar, hot-reloadable).
 */
const fs   = require("fs");
const path = require("path");

const POLICY_FILE = path.join(__dirname, "policies.json");
const HOT_RELOAD  = process.env.RBAC_HOT_RELOAD === "true";

let _cached = null;

function loadPolicy() {
  if (_cached && !HOT_RELOAD) return _cached;
  try {
    const raw = fs.readFileSync(POLICY_FILE, "utf8");
    _cached = JSON.parse(raw);
    if (HOT_RELOAD) console.log("[RBAC] policies.json reloaded");
    return _cached;
  } catch (err) {
    console.error(`[RBAC] Failed to load policies.json: ${err.message}`);
    return { roles: {}, rolePriority: [], summaryFields: {}, policies: {} };
  }
}

function detectLifecyclePhase(passport) {
  const status = (
    passport?.identification?.status ||
    passport?.lifecycle?.status || "original"
  ).toLowerCase();
  if (status.includes("repurposed") || status.includes("secondlife") || status.includes("second"))
    return "secondLife";
  return "original";
}

function applyPolicy(passport, role) {
  const config      = loadPolicy();
  const phase       = detectLifecyclePhase(passport);
  const phasePolicy = config.policies?.[phase] || config.policies?.original || {};
  const summaryDefs = config.summaryFields || {};
  const roleInfo    = config.roles?.[role] || config.roles?.public || {};
  const result      = {};

  for (const [field, roleMap] of Object.entries(phasePolicy)) {
    if (field.startsWith("_")) continue;
    const level = roleMap[role] ?? null;
    const value = passport[field];

    if (level === null) {
      const allowed = Object.entries(roleMap)
        .filter(([k, v]) => !k.startsWith("_") && v !== null)
        .map(([r]) => config.roles?.[r]?.label || r);
      result[field] = {
        _restricted: true,
        _reason: `Rolle "${roleInfo.label || role}" hat keinen Zugriff.`,
        _requiredRoles: allowed,
      };
    } else if (level === "summary" && summaryDefs[field]) {
      const summary = {};
      for (const k of summaryDefs[field]) {
        if (value?.[k] !== undefined) summary[k] = value[k];
      }
      result[field] = { ...summary, _summarized: true };
    } else {
      result[field] = value;
    }
  }

  for (const key of Object.keys(passport)) {
    if (!(key in result)) result[key] = passport[key];
  }

  const writeable = Object.entries(phasePolicy)
    .filter(([k, rm]) => !k.startsWith("_") && (rm[role] === "write" || rm[role] === "full"))
    .map(([f]) => f);

  result._rbac = {
    role,
    roleLabel:       roleInfo.label  || role,
    roleColor:       roleInfo.color  || "#7a9989",
    roleBorder:      roleInfo.border || "#2a3d32",
    roleBg:          roleInfo.bg     || "#1f2e27",
    lifecyclePhase:  phase,
    writeableFields: writeable,
  };

  return result;
}

function getPolicyMatrix() {
  const c = loadPolicy();
  return { roles: c.roles, rolePriority: c.rolePriority,
           policies: c.policies, summaryFields: c.summaryFields };
}

module.exports = { applyPolicy, getPolicyMatrix, detectLifecyclePhase, loadPolicy };
