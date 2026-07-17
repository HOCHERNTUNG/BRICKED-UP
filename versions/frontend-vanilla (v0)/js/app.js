import { getCurrentUser } from './api/auth.js';
import { renderAuth } from './components/auth.js';
import { renderWorkspace } from './components/workspace.js';
import { forceReloadInventory } from './components/inventory.js';
import { forceReloadBuilds, closeBuildDetails } from './components/builds.js';
import { getState, subscribe, setUser, setIsLoading } from './hooks/state.js';

let prevUser = null;
let prevRefreshKey = 0;

/**
 * Entry Point bootstrap
 */
async function init() {
  const root = document.getElementById('app');

  // React-like render loop driven by global state subscriptions
  subscribe((state) => {
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
    renderWorkspace(root, state);
  });

  // Restore session from cache
  setIsLoading(true);
  try {
    const cachedUser = await getCurrentUser();
    if (cachedUser) {
      setUser(cachedUser, 'jwt_cached_session');
    } else {
      setUser(null);
    }
  } catch (err) {
    console.error('Session restoration failed:', err);
    setUser(null);
  } finally {
    setIsLoading(false);
  }
}

// Fire on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
