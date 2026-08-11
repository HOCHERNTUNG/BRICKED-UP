// js/api/client.js

// Set IS_MOCKED = true to run the UI standalone against js/api/fixtures.js
// with no backend (how Deliverable 1 was demonstrated).
// Set it to false to talk to the deployed AWS backend.
export const IS_MOCKED = false;
export const API_BASE_URL = 'https://w45s12yx64.execute-api.ap-southeast-1.amazonaws.com/prod';

// ---------------------------------------------------------------------------
// Session
//
// The token used to live only in the module variable below, so a page refresh
// signed the user out. It is now mirrored into sessionStorage and restored on
// load.
//
// sessionStorage rather than localStorage on purpose: it survives refreshes
// and in-tab navigation (the actual complaint) but is discarded when the tab
// closes, so the token is not left sitting on a shared or lab machine.
//
// Cognito ID tokens expire after an hour. Rather than let the user discover
// that through a wall of failed requests, the refresh token is kept too and
// exchanged for a fresh ID token shortly before expiry.
// ---------------------------------------------------------------------------

const STORE_KEY = 'brickedup.session';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;   // renew when under 5 minutes remain

export let activeToken = null;
let refreshToken = null;
let expiresAt = 0;
let cachedUser = null;
let inFlightRefresh = null;

function persist() {
  try {
    if (!activeToken) {
      sessionStorage.removeItem(STORE_KEY);
      return;
    }
    sessionStorage.setItem(STORE_KEY, JSON.stringify({
      idToken: activeToken, refreshToken, expiresAt, user: cachedUser
    }));
  } catch (_) {
    // Private browsing can refuse storage; the app still works for this tab.
  }
}

/** Reads any stored session back into memory. Called once at start-up. */
export function restoreSession() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // A stored session with no way to renew and no time left is useless.
    if (!s.refreshToken && (!s.expiresAt || s.expiresAt <= Date.now())) {
      sessionStorage.removeItem(STORE_KEY);
      return null;
    }
    activeToken = s.idToken || null;
    refreshToken = s.refreshToken || null;
    expiresAt = s.expiresAt || 0;
    cachedUser = s.user || null;
    return cachedUser;
  } catch (_) {
    return null;
  }
}

export function setActiveToken(token, opts = {}) {
  activeToken = token;
  if (opts.refreshToken !== undefined) refreshToken = opts.refreshToken;
  if (opts.expiresIn) expiresAt = Date.now() + opts.expiresIn * 1000;
  if (opts.user !== undefined) cachedUser = opts.user;
  persist();
}

export function getCachedUser() {
  return cachedUser;
}

export function clearSession() {
  activeToken = null;
  refreshToken = null;
  expiresAt = 0;
  cachedUser = null;
  persist();
}

/**
 * Renew the ID token if it is close to expiring. Safe to call before every
 * request; it is a no-op unless renewal is actually due, and concurrent
 * callers share a single in-flight refresh rather than stampeding Cognito.
 */
export async function ensureFreshToken() {
  if (IS_MOCKED || !activeToken || !refreshToken) return activeToken;
  if (expiresAt - Date.now() > REFRESH_MARGIN_MS) return activeToken;

  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (!res.ok) throw new Error('refresh rejected');
        const data = await res.json();
        setActiveToken(data.idToken, { expiresIn: data.expiresIn });
        return activeToken;
      } catch (err) {
        // The refresh token is gone or revoked - a real sign-out, not a glitch.
        clearSession();
        throw err;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }
  return inFlightRefresh;
}

/**
 * Creates Authorization header helper
 * @param {string} [idToken] - Cognito token
 * @returns {object} Auth headers
 */
export function authHeader(idToken) {
  const token = idToken || activeToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
