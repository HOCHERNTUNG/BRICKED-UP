import { createPanel } from './panel.js';
import { createActionBar } from './actionbar.js';
import { renderScanner } from './scanner.js';
import { renderInventory } from './inventory.js';
import { renderBuilds } from './builds.js';
import { 
  setTheme, 
  setStudStyle, 
  signOut, 
  closeSettings, 
  toggleSettings,
  toggleSnapEnabled,
  toggleSoundEnabled,
  setUser
} from '../hooks/state.js';
import { mockInventory } from '../api/fixtures.js';
import { playSound } from '../hooks/sound.js';

/**
 * Main Workspace Layout in Vanilla JS
 * Binds themes and mounts active panels, standalone settings overlay, and actionbar
 */
export function renderWorkspace(parentEl, state) {
  parentEl.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'workspace-container';
  container.setAttribute('data-theme', state.theme);
  container.setAttribute('data-studs', state.studStyle);

  const baseplate = document.createElement('div');
  baseplate.className = 'workspace-baseplate';

  const dots = document.createElement('div');
  dots.className = 'workspace-dots';
  baseplate.appendChild(dots);

  // Mount Panel: Scanner
  if (state.panels.scanner.isOpen) {
    const scannerEl = createPanel(state.panels.scanner, (body) => {
      renderScanner(body);
    });
    if (scannerEl) baseplate.appendChild(scannerEl);
  }

  // Mount Panel: Inventory
  if (state.panels.inventory.isOpen) {
    const inventoryEl = createPanel(state.panels.inventory, (body) => {
      renderInventory(body);
    });
    if (inventoryEl) baseplate.appendChild(inventoryEl);
  }

  // Mount Panel: Build Ideas
  if (state.panels.buildIdeas.isOpen) {
    const buildsEl = createPanel(state.panels.buildIdeas, (body) => {
      renderBuilds(body);
    });
    if (buildsEl) baseplate.appendChild(buildsEl);
  }

  container.appendChild(baseplate);

  // Mount Action Bar Pill
  const actionbarEl = createActionBar(state);
  container.appendChild(actionbarEl);

  // Mount Standalone profile/settings menu container in the top right corner
  const menuContainer = document.createElement('div');
  menuContainer.className = 'profile-menu-container';

  // Profile icon button (Minifig head)
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

  // Sliding sub-menu wrapper (Settings then Sign Out)
  const slideMenu = document.createElement('div');
  slideMenu.className = 'profile-sliding-menu';

  // Sub-button 1: Settings Cog
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

  // Sub-button 2: Sign Out/Logout Icon
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

  // Toggle open/close of sliding menu
  profileBtn.onclick = (e) => {
    e.stopPropagation();
    menuContainer.classList.toggle('is-open');
  };

  // Close sliding menu on clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (!menuContainer.contains(e.target)) {
      menuContainer.classList.remove('is-open');
    }
  });

  menuContainer.appendChild(profileBtn);
  menuContainer.appendChild(slideMenu);
  container.appendChild(menuContainer);

  // Mount settings center modal overlay
  if (state.isSettingsOpen) {
    const backdrop = document.createElement('div');
    backdrop.className = 'settings-overlay-backdrop';
    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        playSound('click');
        closeSettings();
      }
    };

    // Calculate Rank dynamically based on inventory parts count
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
        <!-- 1. Profile details (Editable) -->
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

        <!-- 2. LEGO Stud Theme Selector Grid (Classic, Space, Cyber, Forest Ranger, Royal Knight) -->
        <h4 class="settings-section-title">Workspace Color Themes</h4>
        <div class="theme-studs-picker-container">
          <button type="button" class="theme-stud-selector ${state.theme === 'classic' ? 'active' : ''}" data-theme-opt="classic" style="--stud-color: #FFD500" title="Classic Yellow"></button>
          <button type="button" class="theme-stud-selector ${state.theme === 'space-explorer' ? 'active' : ''}" data-theme-opt="space-explorer" style="--stud-color: #38BDF8" title="Space Explorer Blue"></button>
          <button type="button" class="theme-stud-selector ${state.theme === 'neon-cyber' ? 'active' : ''}" data-theme-opt="neon-cyber" style="--stud-color: #FF007F" title="Neon Cyber Pink"></button>
          <button type="button" class="theme-stud-selector ${state.theme === 'forest-ranger' ? 'active' : ''}" data-theme-opt="forest-ranger" style="--stud-color: #3D7A44" title="Forest Ranger Moss"></button>
          <button type="button" class="theme-stud-selector ${state.theme === 'royal-knight' ? 'active' : ''}" data-theme-opt="royal-knight" style="--stud-color: #E9C46A" title="Royal Knight Gold"></button>
        </div>

        <!-- 3. Baseplate stud options (Circular, Square, Dense Lego) -->
        <h4 class="settings-section-title">Baseplate Stud Patterns</h4>
        <div class="stud-preview-grid">
          <div class="stud-preview-box ${state.studStyle === 'circular' ? 'active' : ''}" data-stud-opt="circular">
            <div class="preview-pattern" style="background-image: radial-gradient(var(--ink-900) 2.5px, transparent 2.5px); background-size: 10px 10px;"></div>
            <span class="preview-label font-display">Circular</span>
          </div>
          <div class="stud-preview-box ${state.studStyle === 'rounded-square' ? 'active' : ''}" data-stud-opt="rounded-square">
            <div class="preview-pattern" style="background-image: radial-gradient(var(--ink-900) 3px, transparent 3px); background-size: 10px 10px; border-radius: 1px;"></div>
            <span class="preview-label font-display">Square</span>
          </div>
          <div class="stud-preview-box ${state.studStyle === 'dense-lego' ? 'active' : ''}" data-stud-opt="dense-lego">
            <div class="preview-pattern" style="background-image: radial-gradient(var(--ink-900) 3.5px, transparent 3.5px); background-size: 7px 7px;"></div>
            <span class="preview-label font-display">Dense LEGO</span>
          </div>
        </div>

        <!-- 4. Interactive switches (Snapping, Sounds) -->
        <h4 class="settings-section-title">Controls Configuration</h4>
        <div class="settings-options-grid">
          <button type="button" class="option-btn ${state.snapEnabled ? 'active' : ''}" id="modal-snap-toggle-btn">
            ${state.snapEnabled ? 'Grid Snapping: ON' : 'Grid Snapping: OFF'}
          </button>
          <button type="button" class="option-btn ${state.soundEnabled ? 'active' : ''}" id="modal-sound-toggle-btn">
            ${state.soundEnabled ? 'Sound Effects: ON' : 'Sound Effects: OFF'}
          </button>
        </div>

        <!-- 5. Footnote Course Details -->
        <div class="settings-footnote font-display" style="font-size:0.75rem; color:var(--grey-600); text-align:center; margin-top:24px; opacity:0.65; font-weight:500;">
          Cloud Technologies for AI (CAI2C09), BRICKED-UP
        </div>
      </div>
    `;

    // Bind triggers
    card.querySelector('#modal-settings-close').onclick = () => {
      playSound('click');
      closeSettings();
    };

    // Username update on change / blur
    const usernameInput = card.querySelector('#profile-username-input');
    usernameInput.onchange = (e) => {
      const newName = e.target.value.trim();
      if (newName) {
        playSound('click');
        const updatedUser = { ...state.user, display_name: newName };
        setUser(updatedUser, state.idToken);
      }
    };

    // Toggles
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
    container.appendChild(backdrop);
  }

  parentEl.appendChild(container);
}
export default renderWorkspace;
