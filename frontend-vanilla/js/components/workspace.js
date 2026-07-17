import { createPanel } from './panel.js';
import { createActionBar } from './actionbar.js';
import { renderScanner } from './scanner.js';
import { renderInventory } from './inventory.js';
import { renderBuilds } from './builds.js';
import { renderAddPartPanel } from './addPart.js';
import { 
  setTheme, 
  setStudStyle, 
  signOut, 
  closeSettings, 
  toggleSettings,
  toggleSnapEnabled,
  toggleSoundEnabled,
  setUser,
  parsePartNameAndColor,
  closePanel,
  triggerInventoryUpdate,
  openAllPanels
} from '../hooks/state.js';
import { mockInventory } from '../api/fixtures.js';
import { playSound } from '../hooks/sound.js';
import { getBuildDetail } from '../api/builds.js';
import { getInventory, updateInventoryItem, deleteInventoryItem } from '../api/inventory.js';

/**
 * Main Workspace Layout in Vanilla JS
 * Binds themes and mounts active panels, standalone settings overlay, and actionbar
 */
export function renderWorkspace(parentEl, state, isPositionOnly = false) {
  // Check if workspace is already mounted
  const existingContainer = parentEl.querySelector('.workspace-container');

  if (existingContainer) {
    // 1. Sync theme attributes
    existingContainer.setAttribute('data-theme', state.theme);
    existingContainer.setAttribute('data-studs', state.studStyle);
    existingContainer.classList.toggle('hct-pattern-active', state.hctPatternEnabled);

    const baseplate = existingContainer.querySelector('.workspace-baseplate');

    // Clean up panels in DOM that are closed or deleted in state (standalone panels)
    const mountedPanelEls = baseplate.querySelectorAll('.panel-container');
    mountedPanelEls.forEach(panelEl => {
      const domId = panelEl.id.replace('panel-', '');
      const panelState = state.panels[domId];
      if (!panelState || !panelState.isOpen) {
        panelEl.remove();
      }
    });

    // 2. Sync panels
    Object.keys(state.panels).forEach(key => {
      const panelState = state.panels[key];
      const panelEl = document.getElementById(`panel-${panelState.id}`);

      if (panelState.isOpen) {
        // Clamping boundaries for responsiveness
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const clampedWidth = Math.min(panelState.width, viewportW - 16);
        const clampedHeight = Math.min(panelState.height, viewportH - 80);
        const clampedX = Math.max(8, Math.min(panelState.x, viewportW - clampedWidth - 8));
        const clampedY = Math.max(8, Math.min(panelState.y, viewportH - clampedHeight - 80));

        if (panelEl) {
          // Sync coordinates, dimensions, and stack order
          panelEl.style.left = `${clampedX}px`;
          panelEl.style.top = `${clampedY}px`;
          panelEl.style.width = `${clampedWidth}px`;
          panelEl.style.height = panelState.isCollapsed ? '54px' : `${clampedHeight}px`;
          panelEl.style.zIndex = panelState.zIndex;

          const chrome = panelEl.querySelector('.panel-chrome');
          if (chrome) {
            if (panelState.isCollapsed) {
              chrome.classList.add('is-collapsed');
            } else {
              chrome.classList.remove('is-collapsed');
            }
          }

          // Sync studs count
          const studsRow = panelEl.querySelector('.panel-studs-row');
          if (studsRow) {
            const numStuds = Math.max(4, Math.floor((clampedWidth - 32) / 60));
            studsRow.innerHTML = '';
            for (let i = 0; i < numStuds; i++) {
              const stud = document.createElement('div');
              stud.className = 'panel-stud';
              studsRow.appendChild(stud);
            }
          }

          // If it is NOT a position-only move, update content body (information changed)
          if (!isPositionOnly) {
            const bodyContent = panelEl.querySelector('.panel-body-content');
            if (bodyContent) {
              if (panelState.id === 'scanner') {
                // Don't re-render scanner body to avoid resetting video capture camera stream!
              } else if (panelState.id === 'inventory') {
                renderInventory(bodyContent);
              } else if (panelState.id === 'buildIdeas') {
                renderBuilds(bodyContent);
              } else if (panelState.type === 'part') {
                renderStandalonePart(bodyContent, panelState.data, panelState.id);
              } else if (panelState.type === 'build') {
                renderStandaloneBuild(bodyContent, panelState.data);
              } else if (panelState.type === 'addPart') {
                renderAddPartPanel(bodyContent, panelState.id);
              }
            }
          }
        } else {
          // Clamping boundaries for responsiveness
          const clampedPanelState = {
            ...panelState,
            x: clampedX,
            y: clampedY,
            width: clampedWidth,
            height: clampedHeight
          };

          // Create new panel if it wasn't mounted
          const newEl = createPanel(clampedPanelState, (body) => {
            if (panelState.id === 'scanner') renderScanner(body);
            else if (panelState.id === 'inventory') renderInventory(body);
            else if (panelState.id === 'buildIdeas') renderBuilds(body);
            else if (panelState.type === 'part') renderStandalonePart(body, panelState.data, panelState.id);
            else if (panelState.type === 'build') renderStandaloneBuild(body, panelState.data);
            else if (panelState.type === 'addPart') renderAddPartPanel(body, panelState.id);
          });
          if (newEl) baseplate.appendChild(newEl);
        }
      }
    });

    // Sync Action Bar Edge Snap and Button States
    const existingActionBar = existingContainer.querySelector('.action-bar-wrapper');
    if (existingActionBar) {
      const newActionBar = createActionBar(state);
      existingActionBar.replaceWith(newActionBar);
    }

    // 3. Sync Settings Modal
    const settingsBackdrop = existingContainer.querySelector('.settings-overlay-backdrop');
    if (state.isSettingsOpen) {
      renderSettingsModal(existingContainer, state);
    } else {
      if (settingsBackdrop) settingsBackdrop.remove();
    }

    return;
  }

  // First-time mount:
  parentEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'workspace-container';
  container.setAttribute('data-theme', state.theme);
  container.setAttribute('data-studs', state.studStyle);
  container.classList.toggle('hct-pattern-active', state.hctPatternEnabled);

  // Floating Logo Icon at top left
  const logoIcon = document.createElement('button');
  logoIcon.type = 'button';
  logoIcon.className = 'workspace-logo-icon';
  logoIcon.title = 'Open All Panels';
  logoIcon.innerHTML = `<img src="assets/logo_icon.png" alt="Logo" />`;
  logoIcon.onclick = (e) => {
    e.stopPropagation();
    openAllPanels();
  };
  container.appendChild(logoIcon);

  const baseplate = document.createElement('div');
  baseplate.className = 'workspace-baseplate';

  const dots = document.createElement('div');
  dots.className = 'workspace-dots';
  baseplate.appendChild(dots);

  // Mount panels
  Object.keys(state.panels).forEach(key => {
    const panelState = state.panels[key];
    if (panelState.isOpen) {
      // Clamping bounds for responsiveness on mount
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const clampedWidth = Math.min(panelState.width, viewportW - 16);
      const clampedHeight = Math.min(panelState.height, viewportH - 80);
      const clampedX = Math.max(8, Math.min(panelState.x, viewportW - clampedWidth - 8));
      const clampedY = Math.max(8, Math.min(panelState.y, viewportH - clampedHeight - 80));

      const clampedPanelState = {
        ...panelState,
        x: clampedX,
        y: clampedY,
        width: clampedWidth,
        height: clampedHeight
      };

      const el = createPanel(clampedPanelState, (body) => {
        if (panelState.id === 'scanner') renderScanner(body);
        else if (panelState.id === 'inventory') renderInventory(body);
        else if (panelState.id === 'buildIdeas') renderBuilds(body);
        else if (panelState.type === 'part') renderStandalonePart(body, panelState.data, panelState.id);
        else if (panelState.type === 'build') renderStandaloneBuild(body, panelState.data);
        else if (panelState.type === 'addPart') renderAddPartPanel(body, panelState.id);
      });
      if (el) baseplate.appendChild(el);
    }
  });

  container.appendChild(baseplate);

  // Action Bar
  const actionbarEl = createActionBar(state);
  container.appendChild(actionbarEl);

  // Profile slide-out menu
  const menuContainer = document.createElement('div');
  menuContainer.className = 'profile-menu-container';

  const profileBtn = document.createElement('button');
  profileBtn.type = 'button';
  profileBtn.className = 'workspace-profile-btn';
  profileBtn.title = 'Profile & Options';
  profileBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32" style="display:block">
      <rect x="38" y="5" width="24" height="10" rx="2" fill="#FFD500" stroke="#22222A" stroke-width="6"/>
      <rect x="25" y="15" width="50" height="52" rx="14" fill="#FFD500" stroke="#22222A" stroke-width="6"/>
      <circle cx="40" cy="35" r="4.5" fill="#22222A"/>
      <circle cx="60" cy="35" r="4.5" fill="#22222A"/>
      <path d="M 38,48 C 43,54 57,54 62,48" fill="none" stroke="#22222A" stroke-width="5" stroke-linecap="round"/>
      <rect x="32" y="67" width="36" height="10" fill="#FFD500" stroke="#22222A" stroke-width="6"/>
    </svg>
    <div class="profile-cog-badge">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    </div>
  `;

  const slideMenu = document.createElement('div');
  slideMenu.className = 'profile-sliding-menu';

  const subSettingsBtn = document.createElement('button');
  subSettingsBtn.type = 'button';
  subSettingsBtn.className = 'profile-menu-opt-btn settings';
  subSettingsBtn.title = 'Open Settings Modal';
  subSettingsBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
  `;
  subSettingsBtn.onclick = (e) => {
    e.stopPropagation();
    toggleSettings();
  };
  slideMenu.appendChild(subSettingsBtn);

  const subLogoutBtn = document.createElement('button');
  subLogoutBtn.type = 'button';
  subLogoutBtn.className = 'profile-menu-opt-btn logout';
  subLogoutBtn.title = 'Sign Out';
  subLogoutBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
  `;
  subLogoutBtn.onclick = (e) => {
    e.stopPropagation();
    signOut();
  };
  slideMenu.appendChild(subLogoutBtn);

  profileBtn.onclick = (e) => {
    e.stopPropagation();
    menuContainer.classList.toggle('is-open');
  };

  document.addEventListener('mousedown', (e) => {
    if (!menuContainer.contains(e.target)) {
      menuContainer.classList.remove('is-open');
    }
  });

  menuContainer.appendChild(profileBtn);
  menuContainer.appendChild(slideMenu);
  container.appendChild(menuContainer);

  if (state.isSettingsOpen) {
    renderSettingsModal(container, state);
  }

  parentEl.appendChild(container);
}

function renderSettingsModal(container, state) {
  let backdrop = container.querySelector('.settings-overlay-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'settings-overlay-backdrop';
    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        playSound('click');
        closeSettings();
      }
    };
    container.appendChild(backdrop);
  }
  backdrop.innerHTML = '';

  const totalBricksCount = mockInventory.reduce((acc, curr) => acc + curr.quantity, 0);
  let builderRank = 'Apprentice Builder';
  if (totalBricksCount > 20) {
    builderRank = 'Master Designer';
  } else if (totalBricksCount > 10) {
    builderRank = 'Senior Builder';
  }

  const card = document.createElement('div');
  card.className = 'brick-card settings-modal-card';
  card.innerHTML = `
    <div class="panel-header">
      <span class="panel-title font-display" style="color:var(--white)">Workspace &amp; Profile Settings</span>
      <button type="button" class="panel-btn close" id="modal-settings-close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="panel-body-content" style="padding: 20px">
      <h4 class="settings-section-title">User Profile Details</h4>
      
      <div class="profile-badge-row font-body">
        <span class="profile-badge-label">Builder Rank</span>
        <span class="profile-rank-tag font-display">${builderRank}</span>
      </div>

      <div class="profile-field-group font-body" style="margin-bottom: 10px">
        <label class="profile-field-label">Display Username</label>
        <input type="text" class="profile-field-input" id="profile-username-input" value="${state.user?.display_name || 'MasterBuilder'}" />
      </div>

      <div class="profile-field-group font-body" style="margin-bottom: 16px">
        <label class="profile-field-label">User Email Address</label>
        <div class="profile-field-input" style="background: rgba(34,34,42,0.06); color: var(--grey-600); border-style: solid; font-weight: bold; pointer-events: none; user-select: text;">
          ${state.user?.email || 'builder@lego.com'}
        </div>
      </div>

      <h4 class="settings-section-title">Workspace Color Themes</h4>
      <div class="theme-studs-picker-container">
        <button type="button" class="theme-stud-selector ${state.theme === 'classic' ? 'active' : ''}" data-theme-opt="classic" style="--stud-color: #FFD500" title="Classic Yellow"></button>
        <button type="button" class="theme-stud-selector ${state.theme === 'space-explorer' ? 'active' : ''}" data-theme-opt="space-explorer" style="--stud-color: #38BDF8" title="Space Explorer Blue"></button>
        <button type="button" class="theme-stud-selector ${state.theme === 'neon-cyber' ? 'active' : ''}" data-theme-opt="neon-cyber" style="--stud-color: #FF007F" title="Neon Cyber Pink"></button>
        <button type="button" class="theme-stud-selector ${state.theme === 'forest-ranger' ? 'active' : ''}" data-theme-opt="forest-ranger" style="--stud-color: #3D7A44" title="Forest Ranger Moss"></button>
        <button type="button" class="theme-stud-selector ${state.theme === 'royal-knight' ? 'active' : ''}" data-theme-opt="royal-knight" style="--stud-color: #E9C46A" title="Royal Knight Gold"></button>
      </div>

      <h4 class="settings-section-title">Baseplate Stud Patterns</h4>
      <div class="stud-preview-grid">
        <div class="stud-preview-box ${state.studStyle === 'circular' ? 'active' : ''}" data-stud-opt="circular">
          <div class="preview-pattern"></div>
          <span class="preview-label font-display">Circular</span>
        </div>
        <div class="stud-preview-box ${state.studStyle === 'rounded-square' ? 'active' : ''}" data-stud-opt="rounded-square">
          <div class="preview-pattern"></div>
          <span class="preview-label font-display">Square</span>
        </div>
        <div class="stud-preview-box ${state.studStyle === 'dense-lego' ? 'active' : ''}" data-stud-opt="dense-lego">
          <div class="preview-pattern"></div>
          <span class="preview-label font-display">Dense LEGO</span>
        </div>
      </div>

      <h4 class="settings-section-title">Controls Configuration</h4>
      <div class="settings-options-grid">
        <button type="button" class="option-btn ${state.snapEnabled ? 'active' : ''}" id="modal-snap-toggle-btn">
          ${state.snapEnabled ? 'Grid Snapping: ON' : 'Grid Snapping: OFF'}
        </button>
        <button type="button" class="option-btn ${state.soundEnabled ? 'active' : ''}" id="modal-sound-toggle-btn">
          ${state.soundEnabled ? 'Sound Effects: ON' : 'Sound Effects: OFF'}
        </button>
      </div>

      <div class="settings-footnote font-display" style="font-size:0.75rem; color:var(--grey-600); text-align:center; margin-top:24px; opacity:0.65; font-weight:500;">
        Cloud Technologies for AI (CAI2C09), BRICKED-UP
      </div>
    </div>
  `;

  card.querySelector('#modal-settings-close').onclick = () => {
    playSound('click');
    closeSettings();
  };

  const usernameInput = card.querySelector('#profile-username-input');
  usernameInput.onchange = (e) => {
    const newName = e.target.value.trim();
    if (newName) {
      playSound('click');
      const updatedUser = { ...state.user, display_name: newName };
      setUser(updatedUser, state.idToken);
    }
  };

  card.querySelector('#modal-snap-toggle-btn').onclick = () => {
    playSound('click');
    toggleSnapEnabled();
  };
  card.querySelector('#modal-sound-toggle-btn').onclick = () => {
    playSound('click');
    toggleSoundEnabled();
  };

  card.querySelectorAll('[data-theme-opt]').forEach(btn => {
    btn.onclick = () => {
      playSound('click');
      setTheme(btn.getAttribute('data-theme-opt'));
    };
  });

  card.querySelectorAll('[data-stud-opt]').forEach(btn => {
    btn.onclick = () => {
      playSound('click');
      setStudStyle(btn.getAttribute('data-stud-opt'));
    };
  });

  backdrop.appendChild(card);
}


function getBrickColorStyles(colorName) {
  const colors = {
    'Red': { bg: '#D01012', text: '#FFFFFF' },
    'Blue': { bg: '#0057A6', text: '#FFFFFF' },
    'Yellow': { bg: '#FFD500', text: '#22222A' },
    'White': { bg: '#FFFFFF', text: '#22222A' },
    'Grey': { bg: '#5B5B66', text: '#FFFFFF' },
    'Green': { bg: '#1E7A34', text: '#FFFFFF' }
  };
  return colors[colorName] || { bg: '#E2E8F0', text: '#22222A' };
}

function renderStandalonePart(body, item, panelId) {
  body.innerHTML = '';
  
  // Show spinner first
  const spinner = document.createElement('div');
  spinner.className = 'brick-spinner-container';
  spinner.style.height = '100%';
  spinner.style.display = 'flex';
  spinner.style.flexDirection = 'column';
  spinner.style.alignItems = 'center';
  spinner.style.justifyContent = 'center';
  spinner.innerHTML = `
    <div class="brick-stud-spinner">
      <div class="stud-spinner-top"></div>
      <div class="stud-spinner-body"></div>
    </div>
  `;
  body.appendChild(spinner);

  getInventory().then(items => {
    const freshItem = items.find(i => i.inventory_id === item.inventory_id);
    if (!freshItem) {
      closePanel(panelId);
      return;
    }

    body.innerHTML = '';
    const parsed = parsePartNameAndColor(freshItem.part_name);
    const colorStyles = getBrickColorStyles(parsed.color);

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.padding = '16px';
    container.style.height = '100%';
    container.style.boxSizing = 'border-box';

    container.innerHTML = `
      <div class="part-img-holder" style="width: 100px; height: 100px; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.75); border: 2.5px solid var(--ink-900); border-radius: var(--radius-card); box-shadow: inset 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 8px; box-sizing: border-box; padding: 8px;">
        <img src="${freshItem.reference_image_url}" alt="${parsed.name}" style="max-width:90%; max-height:90%; object-fit:contain;" />
      </div>
      <div style="text-align: center; width: 100%;">
        <div style="display:flex; justify-content:center; gap:6px; margin-bottom:6px">
          <span class="part-badge-cat font-display" style="background-color: var(--cream-200); border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">${freshItem.category}</span>
          <span class="part-badge-color font-display" style="background-color: ${colorStyles.bg}; color: ${colorStyles.text}; border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">${parsed.color}</span>
        </div>
        <h4 class="font-display" style="font-size: 0.95rem; margin: 4px 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-900);" title="${parsed.name}">${parsed.name}</h4>
        <p style="font-family: var(--font-body); font-size: 0.8rem; color: var(--grey-600); margin: 0 0 8px 0;">Part ID: <strong>${freshItem.part_id}</strong></p>
        
        <div class="part-card-footer-actions" style="justify-content: center; gap: 12px; display: flex; align-items: center; margin-top: 4px;">
          <div class="qty-picker">
            <button type="button" class="qty-picker-btn font-display decrease-btn"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
            <input type="number" class="qty-value font-display qty-input" value="${freshItem.quantity}" style="width: 28px; text-align: center; border: none; background: transparent; padding: 0; outline: none; font-weight: 800; font-size: 0.8rem; -moz-appearance: textfield; color: var(--ink-900);" />
            <button type="button" class="qty-picker-btn font-display increase-btn"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
          </div>
          <button type="button" class="part-delete-btn delete-btn" title="Remove item" style="padding: 6px; border: 2px solid var(--ink-900); background-color: var(--white); border-radius: 6px; box-shadow: 0 2px 0 var(--ink-900); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--grey-600);">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    `;

    // Bind Quantity selectors
    const decreaseBtn = container.querySelector('.decrease-btn');
    const increaseBtn = container.querySelector('.increase-btn');
    const deleteBtn = container.querySelector('.delete-btn');
    const qtyInput = container.querySelector('.qty-input');

    const updateQty = async (newQty) => {
      try {
        if (newQty <= 0) {
          if (confirm("Are you sure you want to remove this part from your inventory?")) {
            await deleteInventoryItem(freshItem.inventory_id);
            closePanel(panelId);
            triggerInventoryUpdate();
          } else {
            qtyInput.value = freshItem.quantity;
          }
        } else {
          await updateInventoryItem(freshItem.inventory_id, { quantity: newQty });
          triggerInventoryUpdate();
        }
      } catch (err) {
        alert('Failed to update brick count');
      }
    };

    decreaseBtn.onclick = () => updateQty(freshItem.quantity - 1);
    increaseBtn.onclick = () => updateQty(freshItem.quantity + 1);
    qtyInput.onchange = (e) => {
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      updateQty(val);
    };

    deleteBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm("Are you sure you want to remove this part from your inventory?")) {
        try {
          await deleteInventoryItem(freshItem.inventory_id);
          closePanel(panelId);
          triggerInventoryUpdate();
        } catch (err) {
          alert('Failed to remove piece');
        }
      }
    };

    body.appendChild(container);
  }).catch(err => {
    body.innerHTML = `<div style="padding:16px; text-align:center; color:var(--brick-red)" class="font-display">Error loading part details.</div>`;
  });
}

function renderStandaloneBuild(body, build) {
  body.style.height = '100%';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.boxSizing = 'border-box';

  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'brick-spinner-container';
  spinnerContainer.style.height = '100%';
  spinnerContainer.style.display = 'flex';
  spinnerContainer.style.flexDirection = 'column';
  spinnerContainer.style.alignItems = 'center';
  spinnerContainer.style.justifyContent = 'center';
  spinnerContainer.innerHTML = `
    <div class="brick-stud-spinner">
      <div class="stud-spinner-top"></div>
      <div class="stud-spinner-body"></div>
    </div>
    <p class="brick-spinner-message font-display">Retrieving schematic checklist...</p>
  `;
  body.appendChild(spinnerContainer);

  getBuildDetail(build.build_id).then(detail => {
    body.innerHTML = '';
    const detailContent = document.createElement('div');
    detailContent.className = 'detail-content-scroll';
    detailContent.style.height = '100%';
    detailContent.style.overflowY = 'auto';
    detailContent.style.padding = '12px';
    detailContent.style.boxSizing = 'border-box';

    // Hero banner
    const hero = document.createElement('img');
    hero.className = 'detail-hero';
    hero.src = detail.hero_image_url;
    hero.alt = detail.build_name;
    hero.style.width = '100%';
    hero.style.height = '140px';
    hero.style.objectFit = 'cover';
    hero.style.borderRadius = 'var(--radius-card)';
    hero.style.border = '2.5px solid var(--ink-900)';
    hero.style.boxSizing = 'border-box';
    detailContent.appendChild(hero);

    // Title & Desc
    const title = document.createElement('h4');
    title.className = 'detail-title font-display';
    title.style.margin = '10px 0 4px 0';
    title.style.fontSize = '1.1rem';
    title.style.color = 'var(--ink-900)';
    title.textContent = detail.build_name;
    detailContent.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'detail-desc';
    desc.style.fontSize = '0.82rem';
    desc.style.color = 'var(--grey-600)';
    desc.style.margin = '0 0 12px 0';
    desc.textContent = detail.description;
    detailContent.appendChild(desc);

    // Required parts checklist
    const listTitle = document.createElement('h5');
    listTitle.className = 'parts-title font-display';
    listTitle.style.fontSize = '0.9rem';
    listTitle.style.margin = '0 0 8px 0';
    listTitle.textContent = 'Required Parts';
    detailContent.appendChild(listTitle);

    const partsList = document.createElement('div');
    partsList.className = 'parts-list';

    detail.parts.forEach(part => {
      const isComplete = part.quantity_owned >= part.quantity_required;
      const missingCount = part.quantity_required - part.quantity_owned;

      const partRow = document.createElement('div');
      partRow.className = `part-req-row ${isComplete ? 'complete' : ''}`;
      
      partRow.innerHTML = `
        <img src="${part.reference_image_url}" alt="${part.part_name}" class="part-req-img" />
        <div class="part-req-info font-body" style="flex:1; display:flex; align-items:center; justify-content:space-between">
          <div style="flex:1">
            <span class="part-req-name font-display" style="display:block; font-size:0.8rem; color: var(--ink-900);">${part.part_name}</span>
            <span style="font-size:0.72rem;color:var(--grey-600)">Owned: ${part.quantity_owned} / Required: ${part.quantity_required}</span>
          </div>
          <div class="part-req-qty">
            ${isComplete 
              ? `<span style="color:var(--brick-green); display:flex; align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>`
              : `<span class="status-indicator warning font-display" style="background-color:rgba(255,213,0,0.15);border:1.5px solid var(--ink-900);border-radius:6px;font-size:0.65rem;font-weight:800;color:var(--ink-900);padding:1px 5px;display:flex;align-items:center;gap:3px">
                  <span>+${missingCount}</span>
                 </span>`
            }
          </div>
        </div>
      `;
      partsList.appendChild(partRow);
    });

    detailContent.appendChild(partsList);

    // Custom steps checklist
    const stepsTitle = document.createElement('h5');
    stepsTitle.className = 'parts-title font-display';
    stepsTitle.style.fontSize = '0.9rem';
    stepsTitle.style.margin = '16px 0 8px 0';
    stepsTitle.style.borderTop = '2px dashed var(--ink-900)';
    stepsTitle.style.paddingTop = '12px';
    stepsTitle.textContent = 'Assembly Instructions';
    detailContent.appendChild(stepsTitle);

    const stepsList = document.createElement('div');
    stepsList.className = 'steps-checklist';
    stepsList.style.display = 'flex';
    stepsList.style.flexDirection = 'column';
    stepsList.style.gap = '8px';

    const steps = detail.steps || [];
    steps.forEach((step, idx) => {
      const stepRow = document.createElement('label');
      stepRow.className = 'step-row font-body';
      stepRow.style.display = 'flex';
      stepRow.style.alignItems = 'flex-start';
      stepRow.style.gap = '8px';
      stepRow.style.cursor = 'pointer';
      stepRow.style.fontSize = '0.8rem';
      stepRow.style.color = 'var(--ink-900)';

      stepRow.innerHTML = `
        <input type="checkbox" class="step-checkbox" style="margin-top: 2px; cursor: pointer;" />
        <span class="step-text" style="transition: opacity 120ms ease, text-decoration 120ms ease;">${step}</span>
      `;

      // Visual strikethrough toggle on check
      const cb = stepRow.querySelector('.step-checkbox');
      const txt = stepRow.querySelector('.step-text');
      cb.onchange = () => {
        if (cb.checked) {
          txt.style.textDecoration = 'line-through';
          txt.style.opacity = '0.5';
        } else {
          txt.style.textDecoration = 'none';
          txt.style.opacity = '1';
        }
      };

      stepsList.appendChild(stepRow);
    });

    detailContent.appendChild(stepsList);
    body.appendChild(detailContent);
  }).catch(err => {
    body.innerHTML = `<div style="padding:16px; text-align:center; color:var(--brick-red)" class="font-display">Error loading blueprint specs.</div>`;
  });
}

export default renderWorkspace;
