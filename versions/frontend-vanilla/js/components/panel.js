import { snapToGrid } from '../hooks/snap.js';
import { bringToFront, toggleCollapse, closePanel, updatePanelGeometry, getState } from '../hooks/state.js';

/**
 * Creates and binds drag/resize mouse events for a workspace panel in Vanilla JS
 * Handles 8-directional resizing (N, S, E, W, NW, NE, SW, SE)
 */
export function createPanel(panelState, contentRenderer) {
  const { id, name, x, y, width, height, zIndex, isOpen, isCollapsed, accentClass } = panelState;

  if (!isOpen) return null;

  // Create absolute positioned outer container
  const container = document.createElement('div');
  container.className = `panel-container ${isCollapsed ? 'is-collapsed' : ''}`;
  container.id = `panel-${id}`;
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
  container.style.width = `${width}px`;
  container.style.height = isCollapsed ? '54px' : `${height}px`;
  container.style.zIndex = zIndex;

  // Create inner chrome
  const chrome = document.createElement('div');
  chrome.className = `panel-chrome ${accentClass} ${isCollapsed ? 'is-collapsed' : ''}`;

  // Header Bar
  const header = document.createElement('div');
  header.className = 'panel-header';
  
  const title = document.createElement('span');
  title.className = 'panel-title font-display';
  title.textContent = name;
  header.appendChild(title);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'panel-controls';

  // Collapse button
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'panel-btn';
  collapseBtn.innerHTML = isCollapsed 
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  collapseBtn.onclick = (e) => {
    e.stopPropagation();
    toggleCollapse(id);
  };
  controls.appendChild(collapseBtn);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'panel-btn close';
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closePanel(id);
  };
  controls.appendChild(closeBtn);

  header.appendChild(controls);
  chrome.appendChild(header);

  // Content body
  if (!isCollapsed) {
    const bodyContent = document.createElement('div');
    bodyContent.className = 'panel-body-content';
    // Let panel specific interior renderer populate the body
    contentRenderer(bodyContent);
    chrome.appendChild(bodyContent);
  }

  container.appendChild(chrome);

  // Create studs row on top of the panel container
  const studsRow = document.createElement('div');
  studsRow.className = 'panel-studs-row';
  updateStudsForWidth(studsRow, width);
  container.appendChild(studsRow);

  // Bind Mouse events for dragging panel (on header or any white space inside body)
  chrome.addEventListener('mousedown', (e) => {
    // Ignore interactive element clicks
    if (e.target.closest('button, input, select, textarea, a, .panel-btn, .qty-picker, .part-delete-btn, .build-card, .scanner-dropzone, .demo-scan-btn, .candidate-card, .back-btn')) {
      return;
    }

    // Ignore scrollbar clicks inside the scrollable body
    const bodyContent = chrome.querySelector('.panel-body-content');
    if (bodyContent) {
      const rect = bodyContent.getBoundingClientRect();
      if (e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom) {
        if (e.clientX > rect.left + bodyContent.clientWidth) {
          return; // scrollbar click
        }
      }
    }

    e.preventDefault();
    bringToFront(id);
    chrome.classList.add('is-dragging');

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(container.style.left);
    const startTop = parseInt(container.style.top);

    const snapUnit = getState().snapEnabled ? 16 : 1;

    // Retrieve state dynamically to avoid stale closures
    const currentPanel = getState().panels[id] || panelState;
    const currentWidth = currentPanel.width;
    const currentHeight = currentPanel.height;
    const currentIsCollapsed = currentPanel.isCollapsed;

    // Render snap ghost
    const ghost = document.createElement('div');
    ghost.className = 'panel-snap-ghost';
    ghost.style.transform = `translate(${snapToGrid(startLeft, snapUnit)}px, ${snapToGrid(startTop, snapUnit)}px)`;
    ghost.style.width = `${currentWidth}px`;
    ghost.style.height = currentIsCollapsed ? '54px' : `${currentHeight}px`;
    ghost.style.zIndex = zIndex - 1;
    container.parentElement.appendChild(ghost);

    let finalLeft = startLeft;
    let finalTop = startTop;

    function onMouseMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      finalLeft = startLeft + dx;
      finalTop = startTop + dy;

      // Clamping to screen boundaries (responsive)
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const panelWidth = currentWidth;
      const panelHeight = currentIsCollapsed ? 54 : currentHeight;

      finalLeft = Math.max(8, Math.min(finalLeft, windowWidth - panelWidth - 8));
      finalTop = Math.max(8, Math.min(finalTop, windowHeight - panelHeight - 8));

      if (getState().snapEnabled) {
        container.style.left = `${snapToGrid(finalLeft, snapUnit)}px`;
        container.style.top = `${snapToGrid(finalTop, snapUnit)}px`;
      } else {
        container.style.left = `${finalLeft}px`;
        container.style.top = `${finalTop}px`;
      }

      // Update snap ghost target position
      ghost.style.transform = `translate(${snapToGrid(finalLeft, snapUnit)}px, ${snapToGrid(finalTop, snapUnit)}px)`;
    }

    function onMouseUp() {
      chrome.classList.remove('is-dragging');
      ghost.remove();
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Lock geometry to grid
      const snappedLeft = snapToGrid(finalLeft, snapUnit);
      const snappedTop = snapToGrid(finalTop, snapUnit);
      
      updatePanelGeometry(id, { x: snappedLeft, y: snappedTop });
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // Attach 8-directional invisible resize handles
  if (!isCollapsed) {
    const directions = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
    directions.forEach((dir) => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${dir}`;
      container.appendChild(handle);

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        bringToFront(id);
        chrome.classList.add('is-resizing');

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(container.style.left);
        const startTop = parseInt(container.style.top);
        const startW = parseInt(container.style.width);
        const startH = parseInt(container.style.height);

        const snapUnit = getState().snapEnabled ? 16 : 1;

        // Render snap ghost
        const ghost = document.createElement('div');
        ghost.className = 'panel-snap-ghost';
        ghost.style.transform = `translate(${snapToGrid(startLeft, snapUnit)}px, ${snapToGrid(startTop, snapUnit)}px)`;
        ghost.style.width = `${snapToGrid(startW, snapUnit)}px`;
        ghost.style.height = `${snapToGrid(startH, snapUnit)}px`;
        ghost.style.zIndex = zIndex - 1;
        container.parentElement.appendChild(ghost);

        let finalLeft = startLeft;
        let finalTop = startTop;
        let finalW = startW;
        let finalH = startH;

        function onMouseMove(moveEvent) {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;

          const windowW = window.innerWidth;
          const windowH = window.innerHeight;

          // Compute size adjustments based on drag handle direction
          if (dir.includes('e')) {
            const maxW = windowW - startLeft - 8;
            finalW = Math.max(288, Math.min(startW + dx, maxW));
          }
          if (dir.includes('w')) {
            let potentialLeft = startLeft + dx;
            if (potentialLeft < 8) potentialLeft = 8;
            const potentialW = startW + (startLeft - potentialLeft);
            if (potentialW >= 288) {
              finalW = potentialW;
              finalLeft = potentialLeft;
            }
          }
          if (dir.includes('s')) {
            const maxH = windowH - startTop - 8;
            finalH = Math.max(224, Math.min(startH + dy, maxH));
          }
          if (dir.includes('n')) {
            let potentialTop = startTop + dy;
            if (potentialTop < 8) potentialTop = 8;
            const potentialH = startH + (startTop - potentialTop);
            if (potentialH >= 224) {
              finalH = potentialH;
              finalTop = potentialTop;
            }
          }

          if (getState().snapEnabled) {
            const snapLeft = snapToGrid(finalLeft, snapUnit);
            const snapTop = snapToGrid(finalTop, snapUnit);
            const snapW = snapToGrid(finalW, snapUnit);
            const snapH = snapToGrid(finalH, snapUnit);
            
            container.style.left = `${snapLeft}px`;
            container.style.top = `${snapTop}px`;
            container.style.width = `${snapW}px`;
            container.style.height = `${snapH}px`;
            
            updateStudsForWidth(studsRow, snapW);
          } else {
            container.style.left = `${finalLeft}px`;
            container.style.top = `${finalTop}px`;
            container.style.width = `${finalW}px`;
            container.style.height = `${finalH}px`;
            
            updateStudsForWidth(studsRow, finalW);
          }

          // Update snap ghost target position and dimensions
          ghost.style.transform = `translate(${snapToGrid(finalLeft, snapUnit)}px, ${snapToGrid(finalTop, snapUnit)}px)`;
          ghost.style.width = `${snapToGrid(finalW, snapUnit)}px`;
          ghost.style.height = `${snapToGrid(finalH, snapUnit)}px`;
        }

        function onMouseUp() {
          chrome.classList.remove('is-resizing');
          ghost.remove();

          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);

          // Lock sizes and coordinates to grid
          updatePanelGeometry(id, {
            x: snapToGrid(finalLeft, snapUnit),
            y: snapToGrid(finalTop, snapUnit),
            width: snapToGrid(finalW, snapUnit),
            height: snapToGrid(finalH, snapUnit),
          });
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  // Focus panel on container clicks
  container.addEventListener('mousedown', () => {
    bringToFront(id);
  });

  return container;
}

export function updateStudsForWidth(studsRow, width) {
  const numStuds = Math.max(4, Math.floor((width - 32) / 60));
  studsRow.innerHTML = '';
  for (let i = 0; i < numStuds; i++) {
    const stud = document.createElement('div');
    stud.className = 'panel-stud';
    studsRow.appendChild(stud);
  }
}
