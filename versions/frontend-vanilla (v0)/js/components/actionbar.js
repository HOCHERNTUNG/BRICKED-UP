import { getDockPosition } from '../hooks/snap.js';
import { togglePanel, setTheme, setStudStyle, signOut, getState, notify } from '../hooks/state.js';

let currentDockedEdge = 'bottom';
let actionbarX = 0;
let actionbarY = 0;
let isFirstRender = true;

/**
 * Creates and renders the draggable edge-docking navigation bar
 */
export function createActionBar(state) {
  const container = document.createElement('div');
  container.className = 'action-bar-wrapper';

  const isHorizontal = currentDockedEdge === 'top' || currentDockedEdge === 'bottom';
  const barWidth = isHorizontal ? 280 : 64;
  const barHeight = isHorizontal ? 64 : 280;

  // Initialize centred at the bottom on the first render
  if (isFirstRender) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    actionbarX = (windowWidth - 280) / 2;
    actionbarY = windowHeight - 64 - 16;
    isFirstRender = false;
  }

  container.style.left = `${actionbarX}px`;
  container.style.top = `${actionbarY}px`;
  container.style.width = `${barWidth}px`;
  container.style.height = `${barHeight}px`;

  const bar = document.createElement('div');
  bar.className = `action-bar-container docked-${currentDockedEdge} ${isHorizontal ? 'layout-row' : 'layout-col'}`;

  // Drag Handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'action-bar-drag';
  dragHandle.title = 'Drag to re-dock navigation bar';
  dragHandle.innerHTML = `<div class="drag-studs"></div>`;
  bar.appendChild(dragHandle);

  // Buttons Container
  const buttonsGroup = document.createElement('div');
  buttonsGroup.className = 'action-bar-buttons';

  const navItems = [
    { id: 'scanner', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`, label: 'Scan' },
    { id: 'inventory', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`, label: 'Inventory' },
    { id: 'buildIdeas', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`, label: 'Ideas' },
  ];

  navItems.forEach(item => {
    const isActive = state.panels[item.id].isOpen;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `action-btn ${isActive ? 'active' : ''}`;
    btn.title = `${isActive ? 'Close' : 'Open'} ${item.label}`;
    btn.innerHTML = `${item.icon} <span class="tooltip font-display">${item.label}</span>`;
    btn.onclick = () => togglePanel(item.id);
    buttonsGroup.appendChild(btn);
  });

  // Settings Menu Button
  const settingsWrapper = document.createElement('div');
  settingsWrapper.className = 'settings-trigger-wrapper';

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'action-btn';
  settingsBtn.title = 'Settings & Workspace Options';
  settingsBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    <span class="tooltip font-display">Settings</span>
  `;
  settingsWrapper.appendChild(settingsBtn);

  // Popup Menu Container (Toggleable)
  let isMenuOpen = false;
  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    isMenuOpen = !isMenuOpen;
    renderMenu();
  };

  function renderMenu() {
    // Remove existing if any
    const existing = settingsWrapper.querySelector('.settings-popover');
    if (existing) existing.remove();

    if (!isMenuOpen) return;

    const popover = document.createElement('div');
    popover.className = `settings-popover popup-${currentDockedEdge}`;

    popover.innerHTML = `
      <div class="settings-header">
        <span class="settings-title font-display">Settings</span>
        <span class="user-email">${state.user?.email || 'MasterBuilder'}</span>
      </div>
      
      <div class="settings-section">
        <label class="section-label font-display">Workspace Theme</label>
        <div class="settings-options-grid">
          <button type="button" class="option-btn ${state.theme === 'classic' ? 'active' : ''}" data-t="classic">Classic</button>
          <button type="button" class="option-btn ${state.theme === 'space-explorer' ? 'active' : ''}" data-t="space-explorer">Space</button>
          <button type="button" class="option-btn ${state.theme === 'neon-cyber' ? 'active' : ''}" data-t="neon-cyber" style="grid-column: span 2">Neon Cyber</button>
        </div>
      </div>

      <div class="settings-section">
        <label class="section-label font-display">Baseplate Studs</label>
        <div class="settings-options-grid">
          <button type="button" class="option-btn ${state.studStyle === 'circular' ? 'active' : ''}" data-s="circular">Circular</button>
          <button type="button" class="option-btn ${state.studStyle === 'rounded-square' ? 'active' : ''}" data-s="rounded-square">Square</button>
        </div>
      </div>
      
      <button type="button" class="logout-action-btn font-display" id="settings-logout-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        Sign Out
      </button>
    `;

    // Bind Popover Menu Actions
    popover.querySelectorAll('[data-t]').forEach(btn => {
      btn.onclick = () => {
        setTheme(btn.getAttribute('data-t'));
        renderMenu();
      };
    });

    popover.querySelectorAll('[data-s]').forEach(btn => {
      btn.onclick = () => {
        setStudStyle(btn.getAttribute('data-s'));
        renderMenu();
      };
    });

    popover.querySelector('#settings-logout-btn').onclick = () => {
      signOut();
    };

    settingsWrapper.appendChild(popover);
  }

  // Close popup menu on clicking outside
  document.addEventListener('mousedown', (e) => {
    if (!settingsWrapper.contains(e.target)) {
      isMenuOpen = false;
      const existing = settingsWrapper.querySelector('.settings-popover');
      if (existing) existing.remove();
    }
  });

  buttonsGroup.appendChild(settingsWrapper);
  bar.appendChild(buttonsGroup);
  container.appendChild(bar);

  // Draggable action bar body logic
  dragHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(container.style.left);
    const startTop = parseInt(container.style.top);

    function onMouseMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      actionbarX = startLeft + dx;
      actionbarY = startTop + dy;

      container.style.left = `${actionbarX}px`;
      container.style.top = `${actionbarY}px`;
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Find closest edge first to see if orientation will change
      const tempDock = getDockPosition(
        actionbarX,
        actionbarY,
        barWidth,
        barHeight,
        windowWidth,
        windowHeight
      );

      const nextIsHorizontal = tempDock.edge === 'top' || tempDock.edge === 'bottom';
      const nextBarWidth = nextIsHorizontal ? 280 : 64;
      const nextBarHeight = nextIsHorizontal ? 64 : 280;

      // Snapping coordinates using the new target dimensions
      const dock = getDockPosition(
        actionbarX,
        actionbarY,
        nextBarWidth,
        nextBarHeight,
        windowWidth,
        windowHeight
      );

      let targetX = dock.x;
      let targetY = dock.y;
      const margin = 12;

      if (dock.edge === 'bottom') {
        targetY = windowHeight - nextBarHeight - margin;
      } else if (dock.edge === 'top') {
        targetY = margin;
      } else if (dock.edge === 'left') {
        targetX = margin;
      } else if (dock.edge === 'right') {
        targetX = windowWidth - nextBarWidth - margin;
      }

      currentDockedEdge = dock.edge;
      actionbarX = targetX;
      actionbarY = targetY;

      // Force rerender to update orientation
      notify();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  return container;
}
