/**
 * server.js – DBP Frontend
 * ─────────────────────────────────────────────────────────────────────────────
 * Supports multiple AAS submodel formats via the adapter registry:
 *   • IDTA-02035 (official 7-part battery passport standard)
 *   • Prototype  (custom format from Masterarbeit Zhusupbekova, Uni Siegen)
 *   • Generic    (fallback heuristics for unknown structures)
 *
 * Endpoints:
 *   GET  /                  → Landing page
 *   GET  /passport/:id      → Passport detail page
 *   GET  /api/passport/:id  → Normalised passport JSON
 *   GET  /api/debug/:id     → Adapter diagnostic report
 */
const express = require("express");
const axios   = require("axios");
const path    = require("path");

const { resolve, diagnose } = require("./adapters/adapter-registry");

const app    = express();
const PORT   = process.env.PORT   || 3000;
const AAS_API= process.env.AAS_API || "http://aas-env:8081";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Internal: fetch one submodel from BaSyx ──────────────────────────────────
async function fetchSubmodel(submodelId) {
  try {
    const encoded = Buffer.from(submodelId).toString("base64url");
    const res = await axios.get(`${AAS_API}/submodels/${encoded}`, { timeout: 5000 });
    return res.data;
  } catch {
    return null;
  }
}

// ─── Internal: fetch shell + all linked submodels in parallel ─────────────────
async function fetchPassportData(rawId) {
  const encodedId = Buffer.from(rawId).toString("base64url");
  const shellRes = await axios.get(`${AAS_API}/shells/${encodedId}`, { timeout: 5000 });
  const shell = shellRes.data;

  const submodelRefs = shell.submodels || [];
  const fetched = await Promise.all(
    submodelRefs.map(async (ref) => {
      const smId = ref?.keys?.[0]?.value;
      return smId ? fetchSubmodel(smId) : null;
    })
  );

  const submodels = {};
  for (const sm of fetched) {
    if (sm) submodels[sm.idShort] = sm;
  }
  return { shell, submodels };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/passport/:id", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "passport.html"))
);

app.get("/passport", (req, res) => {
  if (req.query.id)
    return res.redirect(`/passport/${encodeURIComponent(req.query.id)}`);
  res.redirect("/");
});

// ─── Main API: resolve passport via adapter registry ──────────────────────────
app.get("/api/passport/:id", async (req, res) => {
  const rawId = decodeURIComponent(req.params.id);
  let shell, submodels;

  try {
    ({ shell, submodels } = await fetchPassportData(rawId));
  } catch (err) {
    return res.status(404).json({ error: "Passport not found", details: err.message, id: rawId });
  }

  const { passport, adapterName, adapterLabel, unmatchedSubmodels } = resolve(submodels);

  res.json({
    id:            shell.id,
    idShort:       shell.idShort,
    assetKind:     shell.assetInformation?.assetKind,
    globalAssetId: shell.assetInformation?.globalAssetId,
    ...passport,
    _adapterName:        adapterName,
    _adapterLabel:       adapterLabel,
    _unmatchedSubmodels: unmatchedSubmodels,
    _raw: { shell, submodels },
  });
});

// ─── Debug API: adapter diagnostic ────────────────────────────────────────────
app.get("/api/debug/:id", async (req, res) => {
  const rawId = decodeURIComponent(req.params.id);
  let shell, submodels;
  try {
    ({ shell, submodels } = await fetchPassportData(rawId));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  const { adapterName, adapterLabel, roleMap, unmatchedSubmodels } = resolve(submodels);
  res.json({
    shellId:     shell.id,
    shellIdShort:shell.idShort,
    selectedAdapter: { name: adapterName, label: adapterLabel },
    submodelDiagnostics: diagnose(submodels),
    roleMap: Object.fromEntries(
      Object.entries(roleMap).map(([r, sm]) => [r, { idShort: sm.idShort, id: sm.id }])
    ),
    unmatchedSubmodels,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`DBP Frontend  →  http://localhost:${PORT}`);
  console.log(`AAS API       →  ${AAS_API}`);
  console.log(`Adapters      →  idta-02035 · prototype · generic`);
});
