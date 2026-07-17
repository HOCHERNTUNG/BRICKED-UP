import { getDockPosition } from '../hooks/snap.js';
import { togglePanel, getState, notify } from '../hooks/state.js';
import { playSound } from '../hooks/sound.js';

let currentDockedEdge = 'bottom';
let actionbarX = 0;
let actionbarY = 0;
let actionbarLength = 320; // Length-wise size parameter (width or height)
let isFirstRender = true;
let isPlusMenuOpen = false;

/**
 * Creates and renders the draggable, length-wise resizable navigation bar
 */
export function createActionBar(state) {
  const container = document.createElement('div');
  container.className = 'action-bar-wrapper';

  const isHorizontal = currentDockedEdge === 'top' || currentDockedEdge === 'bottom';
  
  // Set dimensions based on current length and docked edge orientation
  const barWidth = isHorizontal ? actionbarLength : 72;
  const barHeight = isHorizontal ? 72 : actionbarLength;

  // Initialize centered at the bottom on the first render
  if (isFirstRender) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    actionbarX = (windowWidth - 320) / 2;
    actionbarY = windowHeight - 72 - 16;
    isFirstRender = false;
  }

  container.style.left = `${actionbarX}px`;
  container.style.top = `${actionbarY}px`;
  container.style.width = `${barWidth}px`;
  container.style.height = `${barHeight}px`;

  const bar = document.createElement('div');
  bar.className = `action-bar-container docked-${currentDockedEdge} ${isHorizontal ? 'layout-row' : 'layout-col'}`;

  // 1. Drag Handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'action-bar-drag';
  dragHandle.title = 'Drag to Dock at Edges';
  dragHandle.innerHTML = '<div class="drag-studs"></div>';
  bar.appendChild(dragHandle);

  // 2. Buttons Group or Collapsed Plus Button
  const buttonsGroup = document.createElement('div');
  buttonsGroup.className = 'action-bar-buttons';

  const navItems = [
    { 
      id: 'scanner', 
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="M14 13l-3-3-5 5"></path><path d="M5 21l6-6 4 4 6-6"></path><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3"></line></svg>`, 
      label: 'Scan' 
    },
    { 
      id: 'inventory', 
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="2" ry="2"></rect><rect x="6" y="3" width="4" height="2" rx="0.5" fill="currentColor"/><rect x="14" y="3" width="4" height="2" rx="0.5" fill="currentColor"/></svg>`, 
      label: 'Inventory' 
    },
    { 
      id: 'buildIdeas', 
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`, 
      label: 'Ideas' 
    },
  ];

  function renderButtonsContent() {
    buttonsGroup.innerHTML = '';
    
    // Check if the size is collapsed (below 220px)
    if (actionbarLength < 220) {
      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = `action-btn plus-toggle ${isPlusMenuOpen ? 'active' : ''}`;
      plusBtn.title = 'Toggle Navigation Menu';
      plusBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span class="tooltip font-display">Navigation</span>
      `;
      
      plusBtn.onclick = (e) => {
        e.stopPropagation();
        playSound('click');
        isPlusMenuOpen = !isPlusMenuOpen;
        notify();
      };
      
      buttonsGroup.appendChild(plusBtn);

      // Render the floating flyout popover menu if open
      if (isPlusMenuOpen) {
        const popover = document.createElement('div');
        popover.className = 'action-bar-collapsed-popover';
        
        navItems.forEach(item => {
          const isActive = state.panels[item.id].isOpen;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `action-btn ${isActive ? 'active' : ''}`;
          btn.title = `${isActive ? 'Close' : 'Open'} ${item.label}`;
          btn.innerHTML = `${item.icon} <span class="tooltip font-display">${item.label}</span>`;
          btn.onclick = () => {
            playSound('click');
            togglePanel(item.id);
            isPlusMenuOpen = false;
            notify();
          };
          popover.appendChild(btn);
        });

        container.appendChild(popover);
      }
    } else {
      // Normal expanded layout showing all three tabs
      navItems.forEach(item => {
        const isActive = state.panels[item.id].isOpen;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `action-btn ${isActive ? 'active' : ''}`;
        btn.title = `${isActive ? 'Close' : 'Open'} ${item.label}`;
        btn.innerHTML = `${item.icon} <span class="tooltip font-display">${item.label}</span>`;
        btn.onclick = () => {
          playSound('click');
          togglePanel(item.id);
        };
        buttonsGroup.appendChild(btn);
      });
    }
  }

  renderButtonsContent();
  bar.appendChild(buttonsGroup);

  // 3. Trailing Resize Handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'action-bar-resize-handle';
  resizeHandle.title = 'Drag to Resize Lengthwise';
  bar.appendChild(resizeHandle);

  container.appendChild(bar);

  // Close plus flyout popovers when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (isPlusMenuOpen && !container.contains(e.target)) {
      isPlusMenuOpen = false;
      notify();
    }
  });

  // Resizing mouse events
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startLength = actionbarLength;

    function onMouseMoveResize(moveEvent) {
      let delta = 0;
      if (isHorizontal) {
        delta = moveEvent.clientX - startX;
      } else {
        delta = moveEvent.clientY - startY;
      }

      // Clamp resizing size range between 120px and 600px
      actionbarLength = Math.max(120, Math.min(600, startLength + delta));

      if (isHorizontal) {
        container.style.width = `${actionbarLength}px`;
      } else {
        container.style.height = `${actionbarLength}px`;
      }

      // Update button elements dynamically during drag without workspace notify overhead
      renderButtonsContent();
    }

    function onMouseUpResize() {
      document.removeEventListener('mousemove', onMouseMoveResize);
      document.removeEventListener('mouseup', onMouseUpResize);
      playSound('click');
      notify(); // Final state lock
    }

    document.addEventListener('mousemove', onMouseMoveResize);
    document.addEventListener('mouseup', onMouseUpResize);
  });

  // Draggable action bar docking code
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

      // Snapping check
      const tempDock = getDockPosition(actionbarX, actionbarY, barWidth, barHeight, windowWidth, windowHeight);
      const nextIsHorizontal = tempDock.edge === 'top' || tempDock.edge === 'bottom';
      const nextBarWidth = nextIsHorizontal ? actionbarLength : 72;
      const nextBarHeight = nextIsHorizontal ? 72 : actionbarLength;

      const dock = getDockPosition(actionbarX, actionbarY, nextBarWidth, nextBarHeight, windowWidth, windowHeight);

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

      playSound('click');
      notify();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  return container;
}
export default createActionBar;
