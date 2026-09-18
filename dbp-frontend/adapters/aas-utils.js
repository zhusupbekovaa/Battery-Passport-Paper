/**
 * aas-utils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared low-level helpers for navigating AAS SubmodelElement trees.
 * Used by all format adapters (prototype, IDTA-02035, etc.)
 *
 * Key concepts
 * ────────────
 * • getPropByPath(elements, "Parent.Child.Leaf")
 *     Walks the tree by idShort. Used by the prototype adapter.
 *
 * • getPropBySemanticId(elements, "https://admin-shell.io/...")
 *     Searches recursively for the FIRST element whose semanticId matches.
 *     Used by the IDTA adapter (robust, idShort-independent).
 *
 * • flatElements(elements)
 *     Returns a flat list of ALL leaf Property elements with their paths.
 *     Used as fallback / for the "unknown" generic adapter.
 */

// ─── Walk by idShort path ("A.B.C") ──────────────────────────────────────────
function getPropByPath(elements, dotPath) {
  if (!elements || !dotPath) return null;
  const parts = dotPath.split(".");
  let current = elements;

  for (const part of parts) {
    if (!Array.isArray(current)) return null;
    const found = current.find(e => e.idShort === part);
    if (!found) return null;

    if (
      found.modelType === "SubmodelElementCollection" ||
      found.modelType === "SubmodelElementList"
    ) {
      current = found.value || [];
    } else {
      // Return as soon as we hit a leaf – remaining path parts are ignored
      return found.value ?? null;
    }
  }
  return null;
}

// ─── Walk by semanticId (recursive, depth-first) ─────────────────────────────
function getPropBySemanticId(elements, targetId, _depth = 0) {
  if (!elements || _depth > 12) return null;

  for (const el of elements) {
    // Check this element's semanticId (supports both ExternalReference and LocalReference)
    const semId = extractSemanticIdValue(el.semanticId);
    if (semId && normalizeId(semId) === normalizeId(targetId)) {
      // Return the value for leaf properties, or the element itself for collections
      if (
        el.modelType === "SubmodelElementCollection" ||
        el.modelType === "SubmodelElementList"
      ) {
        return el; // caller gets the whole collection
      }
      return el.value ?? null;
    }

    // Recurse into collections and lists
    if (
      (el.modelType === "SubmodelElementCollection" ||
        el.modelType === "SubmodelElementList") &&
      Array.isArray(el.value)
    ) {
      const found = getPropBySemanticId(el.value, targetId, _depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

// ─── Extract the string value from a semanticId reference object ─────────────
function extractSemanticIdValue(semanticId) {
  if (!semanticId) return null;
  // AAS V3 format: { type: "ExternalReference", keys: [{ type, value }] }
  if (semanticId.keys && Array.isArray(semanticId.keys) && semanticId.keys.length > 0) {
    return semanticId.keys[0].value ?? null;
  }
  // Flat string (older formats)
  if (typeof semanticId === "string") return semanticId;
  return null;
}

// ─── Normalize an IRI/IRDI for comparison (trim, lowercase, strip trailing /) ─
function normalizeId(id) {
  if (!id) return "";
  return id.trim().toLowerCase().replace(/\/$/, "");
}

// ─── Find a SubmodelElementCollection/List by idShort ────────────────────────
function getCollection(elements, idShort) {
  if (!elements) return [];
  const col = elements.find(e => e.idShort === idShort);
  return col?.value || [];
}

// ─── Find a SubmodelElementCollection by semanticId ──────────────────────────
function getCollectionBySemanticId(elements, targetId) {
  const found = getPropBySemanticId(elements, targetId);
  if (found && typeof found === "object" && Array.isArray(found.value)) {
    return found.value;
  }
  return [];
}

// ─── Flatten all leaf properties (for generic / unknown adapter) ──────────────
function flatElements(elements, prefix = "") {
  const result = [];
  if (!Array.isArray(elements)) return result;

  for (const el of elements) {
    const path = prefix ? `${prefix}.${el.idShort}` : el.idShort;
    if (
      el.modelType === "SubmodelElementCollection" ||
      el.modelType === "SubmodelElementList"
    ) {
      result.push(...flatElements(el.value || [], path));
    } else if (el.value !== undefined) {
      result.push({
        path,
        idShort: el.idShort,
        value: el.value,
        semanticId: extractSemanticIdValue(el.semanticId),
        modelType: el.modelType,
        description: el.description,
      });
    }
  }
  return result;
}

// ─── Detect the semanticId of a submodel itself ───────────────────────────────
function getSubmodelSemanticId(submodel) {
  return extractSemanticIdValue(submodel?.semanticId) ?? null;
}

module.exports = {
  getPropByPath,
  getPropBySemanticId,
  getCollection,
  getCollectionBySemanticId,
  extractSemanticIdValue,
  normalizeId,
  flatElements,
  getSubmodelSemanticId,
};
