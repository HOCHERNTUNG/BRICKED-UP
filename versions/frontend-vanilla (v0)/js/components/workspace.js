import { createPanel } from './panel.js';
import { createActionBar } from './actionbar.js';
import { renderScanner } from './scanner.js';
import { renderInventory } from './inventory.js';
import { renderBuilds } from './builds.js';

/**
 * Main Workspace Layout in Vanilla JS
 * Binds themes and mounts active panels and actionbar
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

  parentEl.appendChild(container);
}
export default renderWorkspace;
