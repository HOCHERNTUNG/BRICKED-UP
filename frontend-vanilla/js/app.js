import { getCurrentUser } from './api/auth.js';
import { restoreSession } from './api/client.js';
import { renderAuth } from './components/auth.js';
import { renderWorkspace } from './components/workspace.js';
import { forceReloadInventory } from './components/inventory.js';
import { forceReloadBuilds, closeBuildDetails } from './components/builds.js';
import { getState, subscribe, setUser, setIsLoading, notify, toggleHctPattern } from './hooks/state.js';

let prevUser = null;
let prevRefreshKey = 0;

/**
 * Entry Point bootstrap
 */
async function init() {
  const root = document.getElementById('app');

  // Route: Large Favicon Logo Display
  if (window.location.hash === '#logo') {
    root.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100vw; height: 100vh; background-color: #FFFFFF; font-family: var(--font-display);">
        <img src="favicon.png" style="width: 512px; height: 512px; border: 6px solid #22222A; border-radius: 28px; box-shadow: 0 12px 0 #22222A; animation: logo-bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);" alt="Favicon Logo" />
        <h2 style="margin-top: 24px; color: #22222A; font-size: 2.2rem; font-weight: 900; letter-spacing: 0.5px;">BRICKED-UP Logo</h2>
        <a href="#" style="margin-top: 16px; font-family: var(--font-body); font-size: 0.95rem; font-weight: bold; color: var(--brick-blue); text-decoration: none; border-bottom: 2px dashed var(--brick-blue); padding-bottom: 2px;" onclick="window.location.hash=''; window.location.reload();">← Back to Workspace</a>
        <style>
          @keyframes logo-bounce-in {
            0% { transform: scale(0.6); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>
      </div>
    `;
    return;
  }

  window.addEventListener('hashchange', () => {
    window.location.reload();
  });

  // React-like render loop driven by global state subscriptions
  subscribe((state, isPositionOnly) => {
    // 1. Loader screen
    if (state.isLoading) {
      root.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; background-color: var(--cream-100);">
          <div class="brick-spinner-container">
            <div class="brick-stud-spinner large">
              <div class="stud-spinner-top"></div>
              <div class="stud-spinner-body"></div>
            </div>
            <p class="brick-spinner-message font-display">Building Workspace...</p>
          </div>
        </div>
      `;
      return;
    }

    // 2. Gate workspace by Auth check
    if (!state.user) {
      // Clear panel details on logout to prevent state leaks
      if (prevUser !== null) {
        forceReloadInventory();
        forceReloadBuilds();
        closeBuildDetails();
        prevUser = null;
      }
      renderAuth(root);
      return;
    }

    prevUser = state.user;

    // 3. React on data refreshes when items are added from scanner
    if (state.inventoryRefreshKey !== prevRefreshKey) {
      prevRefreshKey = state.inventoryRefreshKey;
      forceReloadInventory();
      forceReloadBuilds();
    }

    // 4. Render main workspace baseplate
    renderWorkspace(root, state, isPositionOnly);
  });

  // Restore session from cache.
  //
  // restoreSession() must run FIRST and synchronously: it pulls the stored
  // token back into memory so the getCurrentUser() call below has something
  // to authenticate with. Without it every reload started tokenless, /auth/me
  // returned 401, and the user was bounced to the login screen - which is
  // exactly the "logged out on refresh" behaviour reported in testing.
  setIsLoading(true);
  try {
    const stored = restoreSession();
    if (stored) {
      // Show the workspace immediately from the cached profile, then confirm
      // with the server so a revoked session still gets caught.
      setUser(stored, 'restored_session');
    }
    const cachedUser = await getCurrentUser();
    setUser(cachedUser || null, cachedUser ? 'jwt_cached_session' : undefined);
  } catch (err) {
    console.error('Session restoration failed:', err);
    setUser(null);
  } finally {
    setIsLoading(false);
  }

  // Handle dynamic viewport scale response during resize
  window.addEventListener('resize', () => {
    if (getState().user) {
      notify(true);
    }
  });

  // HCT secret shortcut toggles workspace baseplate pattern
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'h') {
      event.preventDefault();
      toggleHctPattern();
    }
  });
}

// Fire on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
