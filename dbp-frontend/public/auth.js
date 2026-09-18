/**
 * auth.js – PKCE OAuth2/OIDC Client für DBP Frontend
 * Kein externes SDK – reines Vanilla-JS.
 *
 * Exports (window.auth):
 *   auth.init()        → { loggedIn, role, roleLabel, roleColor, userInfo }
 *   auth.login()       → Startet PKCE-Login-Flow
 *   auth.logout()      → Keycloak-Logout + Storage leeren
 *   auth.apiFetch(url) → fetch() mit Authorization-Header
 *   auth.getRole()     → Aktuelle Rolle
 *   auth.isLoggedIn()  → Boolean
 */
(function () {
  "use strict";

  const KEY_TOKEN   = "dbp_access_token";
  const KEY_REFRESH = "dbp_refresh_token";
  const KEY_USER    = "dbp_user_info";
  const KEY_VERIFIER= "dbp_pkce_verifier";
  const KEY_STATE   = "dbp_pkce_state";
  const KEY_BACK    = "dbp_redirect_back";

  let _oidc  = null;  // von /api/auth/config
  let _state = { loggedIn: false, role: "public", roleLabel: "Öffentlich",
                 roleColor: "#7a9989", roleBorder: "#2a3d32", roleBg: "#1f2e27",
                 userInfo: null };

  // ── PKCE-Hilfsfunktionen ──────────────────────────────────────────────────
  function rnd(n) {
    const b = crypto.getRandomValues(new Uint8Array(n));
    return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  }
  async function sha256b64url(s) {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  }

  // ── OIDC-Config vom Server laden ─────────────────────────────────────────
  async function loadOidcConfig() {
    if (_oidc) return _oidc;
    const res = await fetch("/api/auth/config");
    _oidc = await res.json();
    return _oidc;
  }

  // ── Login (PKCE Authorization Code Flow) ─────────────────────────────────
  async function login() {
    const oidc     = await loadOidcConfig();
    const verifier = rnd(64);
    const state    = rnd(16);
    const challenge= await sha256b64url(verifier);

    sessionStorage.setItem(KEY_VERIFIER, verifier);
    sessionStorage.setItem(KEY_STATE,    state);
    sessionStorage.setItem(KEY_BACK,     location.href);

    const params = new URLSearchParams({
      response_type:         "code",
      client_id:             oidc.clientId,
      redirect_uri:          location.origin + "/",
      scope:                 oidc.scope || "openid profile email",
      state,
      code_challenge:        challenge,
      code_challenge_method: "S256",
    });
    location.href = `${oidc.authUrl}?${params}`;
  }

  // ── Callback: Code gegen Token tauschen ──────────────────────────────────
  async function handleCallback() {
    const params   = new URLSearchParams(location.search);
    const code     = params.get("code");
    const stateIn  = params.get("state");
    if (!code) return false;

    const storedState = sessionStorage.getItem(KEY_STATE);
    if (stateIn !== storedState) {
      console.error("[Auth] State mismatch – possible CSRF");
      return false;
    }

    const oidc    = await loadOidcConfig();
    const verifier= sessionStorage.getItem(KEY_VERIFIER);

    const body = new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     oidc.clientId,
      redirect_uri:  location.origin + "/",
      code,
      code_verifier: verifier,
    });

    const res  = await fetch(oidc.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) { console.error("[Auth] Token exchange failed"); return false; }

    const data = await res.json();
    sessionStorage.setItem(KEY_TOKEN,   data.access_token);
    if (data.refresh_token)
      sessionStorage.setItem(KEY_REFRESH, data.refresh_token);

    // Redirect-Back
    const back = sessionStorage.getItem(KEY_BACK) || "/";
    [KEY_VERIFIER, KEY_STATE, KEY_BACK].forEach(k => sessionStorage.removeItem(k));

    // URL bereinigen
    const clean = new URL(location.href);
    clean.searchParams.delete("code");
    clean.searchParams.delete("state");
    clean.searchParams.delete("session_state");
    history.replaceState({}, "", clean.href);

    return back;
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async function logout() {
    const oidc = await loadOidcConfig();
    const token = sessionStorage.getItem(KEY_TOKEN);
    [KEY_TOKEN, KEY_REFRESH, KEY_USER].forEach(k => sessionStorage.removeItem(k));
    _state = { loggedIn: false, role: "public", roleLabel: "Öffentlich",
               roleColor: "#7a9989", roleBorder: "#2a3d32", roleBg: "#1f2e27",
               userInfo: null };
    if (oidc.logoutUrl) {
      location.href = `${oidc.logoutUrl}?client_id=${oidc.clientId}&post_logout_redirect_uri=${encodeURIComponent(location.origin)}`;
    } else {
      location.reload();
    }
  }

  // ── fetch() mit Bearer-Token ──────────────────────────────────────────────
  async function apiFetch(url, options = {}) {
    const token = sessionStorage.getItem(KEY_TOKEN);
    const headers = { ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  // ── Token-Info vom Server holen ───────────────────────────────────────────
  async function fetchMe() {
    try {
      const res  = await apiFetch("/api/auth/me");
      return await res.json();
    } catch { return { loggedIn: false, role: "public", userInfo: null }; }
  }

  // ── Initialisierung ───────────────────────────────────────────────────────
  async function init() {
    const oidc = await loadOidcConfig();

    // RBAC deaktiviert → gleich Server fragen
    if (!oidc.enabled) {
      const me = await fetchMe();
      _state = { loggedIn: true, ...me };
      return _state;
    }

    // Callback-Verarbeitung
    if (location.search.includes("code=")) {
      const back = await handleCallback();
      if (back && back !== location.href) {
        location.href = back;
        return _state;
      }
    }

    // Token im Storage?
    const token = sessionStorage.getItem(KEY_TOKEN);
    if (token) {
      const me = await fetchMe();
      _state = {
        loggedIn: me.loggedIn,
        role:     me.role      || "public",
        roleLabel:me.roleLabel || me.role || "Öffentlich",
        roleColor:me.roleColor || "#7a9989",
        roleBorder:me.roleBorder|| "#2a3d32",
        roleBg:   me.roleBg    || "#1f2e27",
        userInfo: me.userInfo,
      };
    }

    return _state;
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  window.auth = {
    init,
    login,
    logout,
    apiFetch,
    handleCallback,
    getRole:      () => _state.role,
    getRoleLabel: () => _state.roleLabel,
    getRoleColor: () => _state.roleColor,
    isLoggedIn:   () => _state.loggedIn,
    getUserInfo:  () => _state.userInfo,
    getState:     () => ({ ..._state }),
  };
})();
