// js/api/client.js

// Where the app gets its data. Decided at load, not hard-coded, so the same
// build can be marked, demonstrated and deployed without editing source.
//
//   offline   everything from js/api/fixtures.js, no network at all. This is
//             what a marker gets by opening the folder locally: sign-in,
//             cataloguing, inventory, builds and emails all work, and the
//             scanner returns a fixed sample result instead of calling
//             Rekognition. Nothing needs AWS credentials or a running model.
//   live      the deployed AWS backend.
//
// Chosen by, in order:
//   ?mock=1 / ?live=1     explicit, and wins over everything
//   a known AWS-backed host   live
//   anything else             offline
//
// The default is offline ON PURPOSE, and it used to be the other way round.
// Only the CloudFront distribution and localhost are on the API's CORS
// allowlist, so any other host - Netlify, GitHub Pages, a colleague's laptop,
// a file:// copy - cannot reach the backend even though the code will happily
// try. The browser then blocks the request and the user sees nothing but
// "Failed to fetch" on the sign-in screen, which looks like a broken site
// rather than a deliberately self-contained one.
//
// Defaulting to offline means the same bundle can be dropped on ANY static
// host and just work, using the bundled sample data. Somewhere that genuinely
// is wired to AWS says so explicitly, either by being on the list below or by
// carrying ?live=1.
const LIVE_HOSTS = [
  'dic4bftd9x6zp.cloudfront.net',   // the deployed distribution
];
export const LIVE_SITE_URL = 'https://dic4bftd9x6zp.cloudfront.net';

function resolveMockMode() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('mock') === '1') return true;
    if (q.get('live') === '1') return false;
    const h = window.location.hostname;
    if (LIVE_HOSTS.includes(h)) return false;
    // localhost is a developer, who may want either; default it to offline and
    // let ?live=1 opt in, which is what RUNNING_LOCALLY.md documents.
    return true;
  } catch (_) {
    return true;
  }
}

export const IS_MOCKED = resolveMockMode();
export const API_BASE_URL = 'https://w45s12yx64.execute-api.ap-southeast-1.amazonaws.com/prod';

if (IS_MOCKED) {
  console.info('BRICKED-UP: offline mode - sample data, no AWS calls. ' +
               'Add ?live=1 to use the deployed backend.');
  showOfflineBanner();
}

/**
 * Say plainly, on screen, that this is sample data.
 *
 * Offline mode returns a fixed scan result instead of calling Rekognition.
 * That is the whole point of it - the app has to be runnable with no AWS
 * account - but on screen it is indistinguishable from a real recognition,
 * and anyone opening the file to assess the project could reasonably conclude
 * the results were hardcoded and the integration faked. Nothing else in the
 * app corrects that impression, so it has to be stated where it cannot be
 * missed, with a one-click way to switch to the real thing.
 */
function showOfflineBanner() {
  // Where "see the real thing" should point depends on whether this host can
  // actually reach the backend. Only localhost is on the CORS allowlist
  // alongside the distribution itself, so offering ?live=1 anywhere else just
  // swaps working sample data for "Failed to fetch". Everywhere else is sent
  // to the deployed site instead.
  const h = window.location.hostname;
  const canReachApi = h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  const link = canReachApi
    ? '<a class="offline-banner-live" href="?live=1">Use the live AWS backend</a>'
    : '<a class="offline-banner-live" href="' + LIVE_SITE_URL +
      '" target="_blank" rel="noopener">See the live AWS version</a>';

  const mount = () => {
    if (document.querySelector('.offline-banner')) return;
    const el = document.createElement('div');
    el.className = 'offline-banner';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<strong>Offline demo mode</strong>' +
      '<span>Sample data &mdash; scan results are fixed examples, not AWS Rekognition. ' +
      'Everything else behaves normally.</span>' + link;
    document.body.appendChild(el);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
}

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
