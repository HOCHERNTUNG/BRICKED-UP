import { signOut as apiSignOut } from '../api/auth.js';

/**
 * Global In-Memory State Manager (Pub/Sub pattern for reactive renders)
 */

const DEFAULT_PANELS = {
  scanner: {
    id: 'scanner',
    name: 'Scanner Panel',
    x: 64,
    y: 64,
    width: 384,
    height: 480,
    zIndex: 10,
    isOpen: true,
    isCollapsed: false,
    accentClass: 'border-scanner',
  },
  inventory: {
    id: 'inventory',
    name: 'User Inventory',
    x: 480,
    y: 64,
    width: 512,
    height: 512,
    zIndex: 10,
    isOpen: true,
    isCollapsed: false,
    accentClass: 'border-inventory',
  },
  buildIdeas: {
    id: 'buildIdeas',
    name: 'Build Ideas',
    x: 1024,
    y: 64,
    width: 384,
    height: 512,
    zIndex: 10,
    isOpen: true,
    isCollapsed: false,
    accentClass: 'border-builds',
  },
};

const state = {
  user: null,
  idToken: null,
  isLoading: false,
  panels: JSON.parse(JSON.stringify(DEFAULT_PANELS)),
  maxZIndex: 10,
  theme: 'classic',
  studStyle: 'circular',
  inventoryRefreshKey: 0,
  isSettingsOpen: false,
  snapEnabled: true,
  soundEnabled: true,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function notify() {
  listeners.forEach((cb) => cb(state));
}

// State Mutators
export function setUser(user, idToken = null) {
  state.user = user;
  state.idToken = idToken;
  notify();
}

export function setIsLoading(loading) {
  state.isLoading = loading;
  notify();
}

export function setTheme(newTheme) {
  state.theme = newTheme;
  notify();
}

export function setStudStyle(newStyle) {
  state.studStyle = newStyle;
  notify();
}

export function triggerInventoryUpdate() {
  state.inventoryRefreshKey++;
  notify();
}

export function bringToFront(id) {
  let highestZ = 0;
  for (const key in state.panels) {
    if (state.panels[key].isOpen && state.panels[key].zIndex > highestZ) {
      highestZ = state.panels[key].zIndex;
    }
  }

  if (state.panels[id].zIndex >= highestZ && highestZ > 0) {
    return; // Already in front
  }

  state.maxZIndex = highestZ + 1;
  state.panels[id].zIndex = state.maxZIndex;

  const panelDom = document.getElementById(`panel-${id}`);
  if (panelDom) {
    panelDom.style.zIndex = state.maxZIndex;
  }
}

export function openPanel(id) {
  state.maxZIndex++;
  state.panels[id].isOpen = true;
  state.panels[id].zIndex = state.maxZIndex;
  notify();
}

export function closePanel(id) {
  state.panels[id].isOpen = false;
  notify();
}

export function togglePanel(id) {
  if (state.panels[id].isOpen) {
    closePanel(id);
  } else {
    openPanel(id);
  }
}

export function toggleCollapse(id) {
  state.panels[id].isCollapsed = !state.panels[id].isCollapsed;
  notify();
}

export function updatePanelGeometry(id, geom) {
  const panel = state.panels[id];
  if (geom.x !== undefined) panel.x = geom.x;
  if (geom.y !== undefined) panel.y = geom.y;
  if (geom.width !== undefined) panel.width = geom.width;
  if (geom.height !== undefined) panel.height = geom.height;
  notify();
}

export function resetWorkspace() {
  state.panels = JSON.parse(JSON.stringify(DEFAULT_PANELS));
  state.maxZIndex = 10;
  state.theme = 'classic';
  state.studStyle = 'circular';
  notify();
}

export async function signOut() {
  try {
    await apiSignOut();
  } catch (err) {
    console.error(err);
  } finally {
    setUser(null);
  }
}

export function openSettings() {
  state.isSettingsOpen = true;
  notify();
}

export function closeSettings() {
  state.isSettingsOpen = false;
  notify();
}

export function toggleSettings() {
  state.isSettingsOpen = !state.isSettingsOpen;
  notify();
}

export function toggleSnapEnabled() {
  state.snapEnabled = !state.snapEnabled;
  notify();
}

export function toggleSoundEnabled() {
  state.soundEnabled = !state.soundEnabled;
  notify();
}
