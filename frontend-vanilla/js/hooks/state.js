import { signOut as apiSignOut } from '../api/auth.js';

/**
 * Global In-Memory State Manager (Pub/Sub pattern for reactive renders)
 */

function computeDefaultPanels() {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;

  // Panel dimensions.
  //
  // One shared height for all three. They sit in a row, so differing heights
  // left a ragged bottom edge that read as misalignment rather than as
  // deliberate sizing.
  //
  // The height is set by the scanner, which is the tallest requirement: the
  // upload target, the photography tip and all three demo buttons have to be
  // visible without scrolling, or the demos - the fastest way to show the app
  // working - are hidden below the fold on first load. The other two panels
  // simply show more rows at this height, which costs them nothing.
  //
  // Clamped to the viewport below, so a short screen still gets a usable
  // layout rather than panels running off the bottom.
  const panelH = 566;
  const scannerW = 400;
  const inventoryW = 561;
  const buildsW = 384;
  const scannerH = panelH, inventoryH = panelH, buildsH = panelH;

  const totalW = scannerW + inventoryW + buildsW;
  const gap = 24;
  const totalWithGaps = totalW + gap * 2;

  // Compute starting X so all 3 panels are centered horizontally
  let startX = Math.max(16, Math.floor((vw - totalWithGaps) / 2));
  // Center vertically with some top padding
  let startY = Math.max(16, Math.floor((vh - Math.max(scannerH, inventoryH, buildsH)) / 2));

  return {
    scanner: {
      id: 'scanner',
      name: 'Scanner Panel',
      x: startX,
      y: startY,
      width: scannerW,
      height: scannerH,
      zIndex: 10,
      isOpen: true,
      isCollapsed: false,
      accentClass: 'border-scanner',
    },
    inventory: {
      id: 'inventory',
      name: 'Inventory',
      x: startX + scannerW + gap,
      y: startY,
      width: inventoryW,
      height: inventoryH,
      zIndex: 10,
      isOpen: true,
      isCollapsed: false,
      accentClass: 'border-inventory',
    },
    buildIdeas: {
      id: 'buildIdeas',
      name: 'Build Ideas',
      x: startX + scannerW + gap + inventoryW + gap,
      y: startY,
      width: buildsW,
      height: buildsH,
      zIndex: 10,
      isOpen: true,
      isCollapsed: false,
      accentClass: 'border-builds',
    },
  };
}

const state = {
  user: null,
  idToken: null,
  isLoading: false,
  panels: computeDefaultPanels(),
  maxZIndex: 10,
  theme: 'classic',
  studStyle: 'circular',
  hctPatternEnabled: false,
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

export function notify(isPositionOnly = false) {
  listeners.forEach((cb) => cb(state, isPositionOnly));
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
  if (id.startsWith('standalone-')) {
    delete state.panels[id];
  } else {
    state.panels[id].isOpen = false;
  }
  notify();
}

/**
 * Readable text colour for a given background, chosen by relative luminance
 * so a tag stays legible on both a black brick and a white one.
 */
export function contrastTextFor(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 'var(--ink-900)';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? 'var(--ink-900)' : '#FFFFFF';
}

/**
 * Colour tag for a part. Prefers the official LEGO colour name and its real
 * hex, which the API now returns from the Rebrickable colours table. Falls
 * back to parsing the part name only for mock mode, where there is no server
 * to ask - that guesswork is what produced wrong swatches and informal names
 * like "Grey" in place of "Dark Bluish Gray".
 */
export function resolveColorTag(item) {
  if (item && item.color_name) {
    return { label: item.color_name, hex: item.color_hex || null };
  }
  const parsed = parsePartNameAndColor(item && item.part_name);
  return { label: parsed.color, hex: null };
}

export function parsePartNameAndColor(fullName) {
  if (!fullName) return { name: 'Part', color: 'Generic' };
  const match = fullName.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    return {
      name: match[1],
      color: match[2]
    };
  }
  return {
    name: fullName,
    color: 'Generic'
  };
}

export function spawnStandalonePanel(type, data) {
  const rawId = data.build_id !== undefined ? data.build_id : (data.part_id || data.part_num || data.id || Math.random().toString(36).substr(2, 9));
  const cleanId = String(rawId).replace(/[^a-zA-Z0-9-]/g, '_');
  const id = `standalone-${type}-${cleanId}`;
  
  if (state.panels[id]) {
    state.panels[id].isOpen = true;
    bringToFront(id);
    notify();
    return;
  }
  
  const count = Object.keys(state.panels).filter(k => k.startsWith('standalone-')).length;
  const x = 200 + (count * 32) % 400;
  const y = 100 + (count * 32) % 300;
  
  // Add Part now holds a shape grid, a colour grid, a preview and a footer,
  // so 330x360 squashed every one of them. Opens large enough that a few rows
  // of each grid are visible without scrolling; renderWorkspace clamps this
  // to the viewport on smaller screens.
  const width = type === 'build' ? 420 : (type === 'addPart' ? 600 : 310);
  const height = type === 'build' ? 480 : (type === 'addPart' ? 720 : 250);
  
  const accentClass = type === 'build' ? 'border-builds' : 'border-inventory';
  const parsed = type === 'part' ? parsePartNameAndColor(data.part_name) : null;
  const name = type === 'build' ? `Build Reference: ${data.name}` : (type === 'addPart' ? 'Add Piece Manually' : `${parsed ? parsed.name : 'Part ' + data.part_num}`);
  
  state.maxZIndex++;
  state.panels[id] = {
    id,
    type,
    name,
    data,
    x,
    y,
    width,
    height,
    zIndex: state.maxZIndex,
    isOpen: true,
    isCollapsed: false,
    accentClass
  };
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
  if (!panel) return;
  if (geom.x !== undefined) panel.x = geom.x;
  if (geom.y !== undefined) panel.y = geom.y;
  if (geom.width !== undefined) panel.width = geom.width;
  if (geom.height !== undefined) panel.height = geom.height;
  notify(true);
}

export function resetWorkspace() {
  state.panels = computeDefaultPanels();
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
    resetWorkspace();
    setUser(null);
  }
}

export function openAllPanels() {
  state.maxZIndex++;
  state.panels['scanner'].isOpen = true;
  state.panels['scanner'].zIndex = state.maxZIndex;
  state.panels['scanner'].isCollapsed = false;

  state.maxZIndex++;
  state.panels['inventory'].isOpen = true;
  state.panels['inventory'].zIndex = state.maxZIndex;
  state.panels['inventory'].isCollapsed = false;

  state.maxZIndex++;
  state.panels['buildIdeas'].isOpen = true;
  state.panels['buildIdeas'].zIndex = state.maxZIndex;
  state.panels['buildIdeas'].isCollapsed = false;

  notify();
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

export function toggleHctPattern() {
  state.hctPatternEnabled = !state.hctPatternEnabled;
  notify(true);
}

export function toggleSnapEnabled() {
  state.snapEnabled = !state.snapEnabled;
  notify();
}

export function toggleSoundEnabled() {
  state.soundEnabled = !state.soundEnabled;
  notify();
}
