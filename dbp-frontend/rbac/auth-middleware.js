/**
 * rbac/auth-middleware.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Express-Middleware für OAuth2 / OIDC Token-Validierung gegen Keycloak.
 *
 * Ablauf:
 *   1. Authorization-Header auslesen (Bearer <JWT>)
 *   2. JWT-Signatur über Keycloak JWKS-Endpoint verifizieren
 *   3. Rolle aus Token-Claims extrahieren (konfigurierbar per ROLE_CLAIM_PATH)
 *   4. req.userRole und req.userInfo setzen
 *   5. Bei fehlendem/ungültigem Token → role = "public" (kein Hard-Fail)
 *
 * Konfiguration:
 *   Alle Einstellungen über Umgebungsvariablen (siehe .env.example) oder
 *   direkt über die AUTH_CONFIG-Konstante am Anfang dieser Datei.
 *
 * Keycloak-Setup:
 *   Client: dbp-frontend (public client, PKCE)
 *   Realm:  dbp-realm
 *   Rollen: manufacturer, operator, recycler, authority,
 *           secondLifeOperator, remanufacturer
 *   → siehe keycloak/realm-export.json für den vollständigen Import
 */

const https   = require("https");
const http    = require("http");
const crypto  = require("crypto");

// ─── Konfiguration (aus ENV geladen, mit Defaults) ────────────────────────────
const AUTH_CONFIG = {
  // Keycloak-Basis-URL
  // ── Interne URL (Server → Keycloak, container-intern) ─────────────────────
  // Für JWKS-Abruf + Token-Validierung – nie vom Browser gesehen.
  keycloakUrl:   process.env.KEYCLOAK_URL   || "http://keycloak:8080",

  // ── Externe URL (Browser → Keycloak, via INTERNAL_HOST) ──────────────────
  // Wird über /api/auth/config ans Frontend geliefert für korrekte Redirects.
  // Wenn nicht gesetzt, fällt es auf keycloakUrl zurück (lokal ohne Docker OK).
  keycloakExternalUrl: process.env.KEYCLOAK_EXTERNAL_URL || null,

  // Realm-Name in Keycloak
  realm:         process.env.KEYCLOAK_REALM || "dbp-realm",

  // Client-ID (muss in Keycloak angelegt sein)
  clientId:      process.env.KEYCLOAK_CLIENT_ID || "dbp-frontend",

  // Wo im JWT-Token stehen die Rollen?
  // Keycloak-Standard: "realm_access.roles"
  // Manche Setups nutzen: "resource_access.dbp-frontend.roles"
  roleClaimPath: process.env.KEYCLOAK_ROLE_CLAIM || "realm_access.roles",

  // RBAC aktiviert? Bei false → alle Anfragen als "public" behandeln
  enabled:       process.env.RBAC_ENABLED !== "false",

  // JWKS-Cache-TTL in Millisekunden (Standard: 5 Minuten)
  jwksCacheTtl:  parseInt(process.env.JWKS_CACHE_TTL || "300000", 10),
};

// ─── JWKS-Cache ───────────────────────────────────────────────────────────────
let jwksCache = null;
let jwksCachedAt = 0;

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCachedAt < AUTH_CONFIG.jwksCacheTtl) {
    return jwksCache;
  }

  const url = `${AUTH_CONFIG.keycloakUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/certs`;
  const data = await fetchJson(url);
  jwksCache = data;
  jwksCachedAt = now;
  return data;
}

// ─── HTTP/HTTPS fetch (ohne externe Abhängigkeit) ────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Invalid JSON from ${url}: ${e.message}`)); }
      });
    }).on("error", reject);
  });
}

// ─── JWT manuell verifizieren (ohne jsonwebtoken-Paket) ──────────────────────
// Unterstützt RS256 (Keycloak-Standard).
// Für Produktionseinsatz: 'jsonwebtoken' + 'jwks-rsa' npm-Pakete empfohlen.

function base64urlDecode(str) {
  const padded = str + "=".repeat((4 - str.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return JSON.parse(base64urlDecode(parts[1]).toString("utf8"));
}

function parseJwtHeader(token) {
  const parts = token.split(".");
  return JSON.parse(base64urlDecode(parts[0]).toString("utf8"));
}

async function verifyJwt(token) {
  const header  = parseJwtHeader(token);
  const payload = parseJwtPayload(token);

  // Ablauf prüfen
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new Error("Token expired");
  }

  // Audience prüfen
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (AUTH_CONFIG.clientId && !aud.includes(AUTH_CONFIG.clientId) && payload.azp !== AUTH_CONFIG.clientId) {
    // Soft-check: Warnung statt Hard-Fail (Keycloak sendet manchmal "account" als aud)
    console.warn(`[RBAC] Token audience mismatch: ${aud.join(", ")} vs ${AUTH_CONFIG.clientId}`);
  }

  // Signatur verifizieren
  const jwks = await getJwks();
  const jwk = jwks.keys?.find(k => k.kid === header.kid);
  if (!jwk) throw new Error(`No matching key found for kid: ${header.kid}`);

  const pem = jwkToPem(jwk);
  const parts = token.split(".");
  const signature = base64urlDecode(parts[2]);
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(data);
  if (!verify.verify(pem, signature)) {
    throw new Error("Invalid token signature");
  }

  return payload;
}

// ─── JWK → PEM konvertieren (RSA) ─────────────────────────────────────────────
function jwkToPem(jwk) {
  const n = base64urlDecode(jwk.n);
  const e = base64urlDecode(jwk.e);

  // DER-Encoding für RSA Public Key
  function encodeLength(len) {
    if (len < 128) return Buffer.from([len]);
    const hex = len.toString(16).padStart(len > 255 ? 4 : 2, "0");
    const bytes = Buffer.from(hex, "hex");
    return Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
  }

  function encodeInteger(buf) {
    // Führendes 0x00 wenn höchstes Bit gesetzt
    const prefix = (buf[0] & 0x80) ? Buffer.from([0x00]) : Buffer.alloc(0);
    const value = Buffer.concat([prefix, buf]);
    return Buffer.concat([Buffer.from([0x02]), encodeLength(value.length), value]);
  }

  const modulus  = encodeInteger(n);
  const exponent = encodeInteger(e);
  const seq = Buffer.concat([modulus, exponent]);
  const seqEncoded = Buffer.concat([
    Buffer.from([0x30]), encodeLength(seq.length), seq
  ]);

  // SubjectPublicKeyInfo wrapper
  const algoId = Buffer.from("300d06092a864886f70d0101010500", "hex");
  const bitString = Buffer.concat([
    Buffer.from([0x03]),
    encodeLength(seqEncoded.length + 1),
    Buffer.from([0x00]),
    seqEncoded,
  ]);
  const spki = Buffer.concat([algoId, bitString]);
  const spkiEncoded = Buffer.concat([
    Buffer.from([0x30]), encodeLength(spki.length), spki
  ]);

  const b64 = spkiEncoded.toString("base64").replace(/.{64}/g, "$&\n");
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
}

// ─── Rolle aus Token-Payload extrahieren ─────────────────────────────────────
function extractRole(payload) {
  // roleClaimPath navigiert tief: "realm_access.roles" → payload.realm_access.roles
  const parts = AUTH_CONFIG.roleClaimPath.split(".");
  let current = payload;
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = current[part];
  }

  if (!Array.isArray(current)) return null;

  // Priorität: authority > manufacturer > secondLifeOperator > remanufacturer > recycler > operator
  const PRIORITY = [
    "authority",
    "manufacturer",
    "secondLifeOperator",
    "remanufacturer",
    "recycler",
    "operator",
  ];
  for (const role of PRIORITY) {
    if (current.includes(role)) return role;
  }

  return null;
}

// ─── Express-Middleware ───────────────────────────────────────────────────────
async function authMiddleware(req, res, next) {
  // RBAC deaktiviert → immer als manufacturer behandeln (Dev-Modus)
  if (!AUTH_CONFIG.enabled) {
    req.userRole = process.env.DEV_ROLE || "manufacturer";
    req.userInfo = { sub: "dev-user", name: "Dev User (RBAC disabled)" };
    return next();
  }

  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.userRole = "public";
    req.userInfo = null;
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await verifyJwt(token);
    const role = extractRole(payload);

    req.userRole = role || "public";
    req.userInfo = {
      sub:      payload.sub,
      name:     payload.name || payload.preferred_username || payload.sub,
      email:    payload.email,
      username: payload.preferred_username,
    };
  } catch (err) {
    console.warn(`[RBAC] Token validation failed: ${err.message}`);
    req.userRole = "public";
    req.userInfo = null;
  }

  next();
}

// ─── OIDC-Konfiguration für das Frontend (wird an /api/auth/config geliefert) ─
function getOidcConfig() {
  // Browser-facing URLs nutzen externalUrl (via INTERNAL_HOST erreichbar)
  // Server-seitige Validierung läuft weiter über keycloakUrl (container-intern)
  const extUrl = AUTH_CONFIG.keycloakExternalUrl || AUTH_CONFIG.keycloakUrl;
  return {
    enabled:    AUTH_CONFIG.enabled,
    // issuer muss mit dem iss-Claim im JWT übereinstimmen → interne URL
    issuer:     `${AUTH_CONFIG.keycloakUrl}/realms/${AUTH_CONFIG.realm}`,
    // Browser-Redirects → externe URL (INTERNAL_HOST)
    authUrl:    `${extUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/auth`,
    tokenUrl:   `${extUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/token`,
    logoutUrl:  `${extUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/logout`,
    clientId:   AUTH_CONFIG.clientId,
    scope:      "openid profile email",
  };
}

module.exports = { authMiddleware, getOidcConfig, AUTH_CONFIG };
