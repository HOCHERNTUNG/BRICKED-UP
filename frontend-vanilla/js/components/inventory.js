import { getInventory, updateInventoryItem, deleteInventoryItem } from '../api/inventory.js';
import { triggerInventoryUpdate, spawnStandalonePanel, parsePartNameAndColor , resolveColorTag, contrastTextFor } from '../hooks/state.js';
import { partImageAttrs } from '../api/partImage.js';

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

let inventoryItems = [];
let inventoryLoading = true;
let inventoryError = null;

let searchQuery = '';
let selectedCategory = 'All';
let selectedColor = 'All';

let resizeObserver = null;
let currentWidthClass = 'width-wide';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const RAINBOW = 'linear-gradient(135deg,#D01012 0 25%,#FFD500 25% 50%,#1E7A34 50% 75%,#0057A6 75% 100%)';

/**
 * Sort key that puts colours in spectrum order rather than alphabetical.
 *
 * Alphabetical is actively unhelpful for colour: it separates "Bright Light
 * Blue" from "Blue" by twenty entries and interleaves greys through the
 * middle. Sorting by hue groups the blues together, so scanning for a colour
 * means looking at the part of the grid where that colour lives.
 *
 * Greys and near-blacks/whites have no meaningful hue, so they are pushed to
 * the end as a neutrals run, ordered light to dark.
 */
function hueKey(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return [3, 0, 0];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (sat < 0.15) return [2, -l, 0];          // neutral: light -> dark
  let hue;
  if (max === r) hue = ((g - b) / d + 6) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [1, hue * 60, -l];
}

function bySpectrum(a, b) {
  const ka = hueKey(a.hex), kb = hueKey(b.hex);
  for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a.label.localeCompare(b.label);
}

/**
 * Colour filter: a button that opens a grid of real swatches.
 *
 * Two things were wrong with the previous version.
 *
 * It was a vertical LIST - one full-width row per colour - so a bin spanning
 * thirty colours meant thirty rows of scrolling inside a 230px popover. A
 * grid of swatches shows the same thirty in four rows, and colour is a thing
 * you recognise by sight, so the name is secondary and belongs on the tooltip
 * and the footer rather than taking a row each.
 *
 * More seriously, it could get stuck open permanently. The dismiss handler was
 * registered once per render with { once: true }, so the first click anywhere
 * - the search box, a part card, anything - consumed it while the popover was
 * still closed. From then on nothing was listening, and the next time the
 * popover opened there was no handler left to close it. The listener is now
 * bound when the popover opens and removed when it closes, so its lifetime
 * matches the thing it dismisses.
 */
function colorFilterControl(parentEl) {
  const wrap = document.createElement('div');
  wrap.className = 'color-filter-wrapper';

  const colors = [];
  const seen = new Set();
  inventoryItems.forEach(i => {
    const tag = resolveColorTag(i);
    if (tag.label && !seen.has(tag.label)) {
      seen.add(tag.label);
      colors.push(tag);
    }
  });
  colors.sort(bySpectrum);

  const active = colors.find(c => c.label === selectedColor);
  const dotStyle = (hex) => `background:${hex || 'transparent'};${hex ? '' : `background:${RAINBOW};`}`;

  wrap.innerHTML = `
    <button type="button" class="color-filter-btn font-display" id="inv-color-btn"
            aria-haspopup="dialog" aria-expanded="false">
      <span class="color-filter-dot" style="${dotStyle(active ? active.hex : null)}"></span>
      <span class="color-filter-label">${selectedColor === 'All' ? 'Any colour' : escapeHtml(selectedColor)}</span>
      <svg class="color-filter-caret" width="10" height="10" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="4" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="color-filter-pop" hidden role="dialog" aria-label="Filter by colour">
      <input type="search" class="color-filter-search font-body" placeholder="Search colours..." />
      <div class="color-filter-grid" role="listbox" aria-label="Colours in your bin"></div>
      <div class="color-filter-foot font-body"><span class="cf-hint">${colors.length} colours in your bin</span></div>
    </div>
  `;

  const btn = wrap.querySelector('#inv-color-btn');
  const pop = wrap.querySelector('.color-filter-pop');
  const grid = wrap.querySelector('.color-filter-grid');
  const search = wrap.querySelector('.color-filter-search');
  const foot = wrap.querySelector('.cf-hint');

  const choose = (label) => {
    selectedColor = label;
    close();
    renderInventory(parentEl);
  };

  function renderGrid() {
    const q = search.value.trim().toLowerCase();
    const matches = colors.filter(c => !q || c.label.toLowerCase().includes(q));
    grid.innerHTML = '';

    // "Any colour" is a tile in the grid rather than a separate row, so
    // clearing the filter is in the same place as setting it.
    const all = document.createElement('button');
    all.type = 'button';
    all.className = `color-filter-swatch is-all ${selectedColor === 'All' ? 'is-selected' : ''}`;
    all.setAttribute('role', 'option');
    all.setAttribute('aria-selected', String(selectedColor === 'All'));
    all.title = 'Any colour';
    all.style.background = RAINBOW;
    all.onclick = () => choose('All');
    grid.appendChild(all);

    matches.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      const on = selectedColor === c.label;
      b.className = `color-filter-swatch ${on ? 'is-selected' : ''}`;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(on));
      b.title = c.label;
      b.style.background = c.hex || '#CCC';
      b.onclick = () => choose(c.label);
      // Hovering names the colour without needing a row of its own.
      b.onmouseenter = () => { foot.textContent = c.label; };
      b.onfocus = () => { foot.textContent = c.label; };
      grid.appendChild(b);
    });

    if (!matches.length && q) {
      const p = document.createElement('p');
      p.className = 'color-filter-empty font-body';
      p.textContent = `No colour matches "${search.value}"`;
      grid.appendChild(p);
    }
  }

  // Bound only while the popover is open. See the note above: tying these to
  // the render instead is what made it possible to strand it open.
  const onDocClick = (e) => { if (!wrap.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { close(); btn.focus(); } };

  function open() {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    search.value = '';
    renderGrid();
    search.focus();
  }
  function close() {
    if (pop.hidden) return;
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKey);
  }

  btn.onclick = () => { pop.hidden ? open() : close(); };
  search.oninput = renderGrid;
  grid.onmouseleave = () => {
    foot.textContent = selectedColor === 'All'
      ? `${colors.length} colours in your bin` : selectedColor;
  };

  renderGrid();
  return wrap;
}

/**
 * Renders the Inventory Panel in Vanilla JS
 * Binds search hooks and category selects
 */
export function renderInventory(parentEl) {
  parentEl.innerHTML = '';

  const container = document.createElement('div');
  container.className = `inventory-panel-container ${currentWidthClass}`;
  
  // Set up width monitoring ResizeObserver on the outer panel container
  // We apply the classes directly to the container div
  if (resizeObserver) resizeObserver.disconnect();
  
  resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      const width = entry.contentRect.width;
      let nextClass = 'width-wide';
      if (width < 360) {
        nextClass = 'width-narrow';
      } else if (width < 480) {
        nextClass = 'width-medium';
      }
      
      if (nextClass !== currentWidthClass) {
        currentWidthClass = nextClass;
        container.className = `inventory-panel-container ${currentWidthClass}`;
      }
    }
  });
  
  // Delay observation slightly to let panel mount in DOM
  setTimeout(() => {
    const panelDom = document.getElementById('panel-inventory');
    if (panelDom) resizeObserver.observe(panelDom);
  }, 100);

  // Load inventory items if first load
  if (inventoryLoading && inventoryItems.length === 0) {
    loadInventoryData(parentEl);
    return;
  }

  // Header Filters HTML
  const headerSearch = document.createElement('div');
  headerSearch.className = 'inventory-header-search';

  // Search box
  const searchBox = document.createElement('div');
  searchBox.className = 'search-box-wrapper';
  searchBox.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    <input type="text" class="search-input" placeholder="Search parts bin..." id="inv-search-input" value="${searchQuery}" />
  `;
  const searchInput = searchBox.querySelector('#inv-search-input');
  searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    renderListBody(container);
  };
  headerSearch.appendChild(searchBox);

  headerSearch.appendChild(colorFilterControl(parentEl));
  container.appendChild(headerSearch);

  // Type filter.
  //
  // Was a native <select> reading "Type: All". It gave no sense of how much
  // was in each category, took two clicks to change, and looked like a form
  // control dropped into a workspace that has none anywhere else. Chips show
  // every category and its count at a glance, change filter in one click, and
  // match the shape picker in the Add Part panel.
  const typeRow = document.createElement('div');
  typeRow.className = 'inv-type-chips';
  typeRow.setAttribute('role', 'tablist');
  typeRow.setAttribute('aria-label', 'Filter by part type');

  const catCounts = new Map();
  inventoryItems.forEach(i => {
    catCounts.set(i.category, (catCounts.get(i.category) || 0) + (i.quantity || 0));
  });
  const totalQty = [...catCounts.values()].reduce((a, b) => a + b, 0);

  const mkChip = (label, count) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const on = selectedCategory === label;
    chip.className = `inv-type-chip font-display ${on ? 'is-active' : ''}`;
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', String(on));
    chip.innerHTML = `${escapeHtml(label)} <span class="inv-chip-count">${count}</span>`;
    chip.onclick = () => {
      selectedCategory = label;
      renderInventory(parentEl);
    };
    return chip;
  };
  typeRow.appendChild(mkChip('All', totalQty));
  [...catCounts.keys()].sort().forEach(cat => typeRow.appendChild(mkChip(cat, catCounts.get(cat))));
  container.appendChild(typeRow);


  // Running totals bar
  const totalsBar = document.createElement('div');
  totalsBar.className = 'inventory-running-totals font-display';
  totalsBar.id = 'inv-totals-bar';
  container.appendChild(totalsBar);

  // List body placeholder
  const listPlaceholder = document.createElement('div');
  listPlaceholder.id = 'inv-list-placeholder';
  listPlaceholder.style.flex = '1';
  listPlaceholder.style.display = 'flex';
  listPlaceholder.style.flexDirection = 'column';
  container.appendChild(listPlaceholder);

  // Floating manual add button
  const floatingAddBtn = document.createElement('button');
  floatingAddBtn.type = 'button';
  floatingAddBtn.className = 'inventory-floating-add-btn';
  floatingAddBtn.title = 'Add Piece Manually';
  floatingAddBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  `;
  floatingAddBtn.onclick = (e) => {
    e.stopPropagation();
    spawnStandalonePanel('addPart', {});
  };
  container.appendChild(floatingAddBtn);

  parentEl.appendChild(container);

  // Render initial list contents
  renderListBody(container);
}

async function loadInventoryData(parent) {
  inventoryLoading = true;
  inventoryError = null;
  renderSpinner(parent, 'Retrieving catalogued parts...');
  try {
    const data = await getInventory();
    inventoryItems = data;
    inventoryLoading = false;
    renderInventory(parent);
  } catch (err) {
    inventoryError = 'Could not retrieve your brick inventory.';
    inventoryLoading = false;
    renderErrorState(parent);
  }
}

function renderListBody(container) {
  const listPlaceholder = container.querySelector('#inv-list-placeholder');
  const totalsBar = container.querySelector('#inv-totals-bar');
  if (!listPlaceholder) return;

  listPlaceholder.innerHTML = '';

  const filtered = inventoryItems.filter(item => {
    const q = searchQuery.trim().toLowerCase();
    const tag = resolveColorTag(item);
    // Search across the full name, the colour and the element id - the id is
    // how a part is identified everywhere else in the app, so it should be
    // searchable here too.
    const haystack = [item.part_name, tag.label, item.element_id, item.part_num]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !q || haystack.includes(q);
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesColor = selectedColor === 'All' || tag.label === selectedColor;
    return matchesSearch && matchesCat && matchesColor;
  });

  // Calculate totals
  const totalCount = inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const categories = ['All', ...new Set(inventoryItems.map(i => i.category))];
  totalsBar.innerHTML = `
    <span>Bricks Catalogued: ${totalCount} total</span>
    <span>Categories: ${categories.length - 1}</span>
  `;

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'brick-feedback-state empty';
    emptyState.innerHTML = `
      <div class="feedback-icon-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </div>
      <h3 class="feedback-title font-display">${searchQuery ? 'No filter matches' : 'Inventory is empty'}</h3>
      <p class="feedback-desc">
        ${searchQuery 
          ? 'Try widening your search terms or category filter.' 
          : 'Add parts from the Scanner Panel to compile your inventory!'}
      </p>
    `;
    listPlaceholder.appendChild(emptyState);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'inventory-items-grid';

  filtered.forEach(item => {
    const parsed = parsePartNameAndColor(item.part_name);
    // Official colour name + its true hex when the server supplied them;
    // the old palette guess only knew six colours.
    const tag = resolveColorTag(item);
    const colorStyles = tag.hex
      ? { bg: tag.hex, text: contrastTextFor(tag.hex) }
      : getBrickColorStyles(tag.label);
    const card = document.createElement('div');
    card.className = 'brick-card inventory-part-card';
    card.innerHTML = `
      <div class="part-card-inner">
        <div class="part-img-holder">
          <img ${partImageAttrs(item, parsed.name)} />
        </div>
        <div class="part-card-content">
          <div class="part-meta-row font-display" style="display:flex; gap:5px; margin-bottom:4px">
            <span class="part-badge-cat" style="background-color: var(--cream-200); border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 1px 4px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--ink-900);">${item.category}</span>
            <span class="part-badge-color" style="background-color: ${colorStyles.bg}; color: ${colorStyles.text}; border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 1px 4px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase;">${tag.label}</span>
          </div>
          <h6 class="part-display-name font-display" title="${parsed.name}">${parsed.name}</h6>
          
          <div class="part-card-footer-actions" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: auto; width: 100%;">
            <div class="qty-picker" style="display: flex; align-items: center; border: 2px solid var(--ink-900); border-radius: 6px; background-color: var(--white); overflow: hidden; flex-shrink: 0; height: 22px;">
              <button type="button" class="qty-picker-btn font-display decrease-btn" style="background: transparent; border: none; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink-900); padding: 0;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              <input type="number" class="qty-value font-display qty-input" value="${item.quantity}" style="width: 26px; text-align: center; border: none; background: transparent; padding: 0; outline: none; font-weight: 800; font-size: 0.75rem; -moz-appearance: textfield; color: var(--ink-900); margin: 0; border-left: 2px solid var(--ink-900); border-right: 2px solid var(--ink-900); height: 22px;" />
              <button type="button" class="qty-picker-btn font-display increase-btn" style="background: transparent; border: none; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink-900); padding: 0;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
            </div>
            <button type="button" class="part-popout-btn popout-btn" title="Drag out to Workspace" style="padding: 0; border: 2px solid var(--ink-900); background-color: var(--white); border-radius: 6px; box-shadow: 0 2px 0 var(--ink-900); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--grey-600); width: 22px; height: 22px; box-sizing: border-box; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
            <button type="button" class="part-delete-btn delete-btn" title="Remove item" style="padding: 0; border: 2px solid var(--ink-900); background-color: var(--white); border-radius: 6px; box-shadow: 0 2px 0 var(--ink-900); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--grey-600); width: 22px; height: 22px; box-sizing: border-box; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind Quantity selectors
    card.querySelector('.decrease-btn').onclick = (e) => { e.stopPropagation(); adjustQuantity(item.inventory_id, item.quantity - 1, container); };
    card.querySelector('.increase-btn').onclick = (e) => { e.stopPropagation(); adjustQuantity(item.inventory_id, item.quantity + 1, container); };
    card.querySelector('.delete-btn').onclick = (e) => { e.preventDefault(); e.stopPropagation(); removePiece(item.inventory_id, container); };
    card.querySelector('.popout-btn').onclick = (e) => { e.preventDefault(); e.stopPropagation(); spawnStandalonePanel('part', item); };
    card.querySelector('.qty-input').onchange = (e) => {
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      adjustQuantity(item.inventory_id, val, container);
    };
    card.querySelector('.qty-input').onclick = (e) => { e.preventDefault(); e.stopPropagation(); };

    grid.appendChild(card);
  });

  listPlaceholder.appendChild(grid);
}

async function adjustQuantity(inventory_id, newQty, container) {
  try {
    if (newQty <= 0) {
      if (confirm("Are you sure you want to remove this part from your inventory?")) {
        await deleteInventoryItem(inventory_id);
      } else {
        const data = await getInventory();
        inventoryItems = data;
        triggerInventoryUpdate();
        renderListBody(container);
        return;
      }
    } else {
      await updateInventoryItem(inventory_id, { quantity: newQty });
    }
    // Refresh local lists
    const data = await getInventory();
    inventoryItems = data;
    triggerInventoryUpdate();
    renderListBody(container);
  } catch (err) {
    alert('Failed to update brick count');
  }
}

async function removePiece(inventory_id, container) {
  const confirmation = confirm("Are you sure you want to remove this part from your inventory?");
  if (!confirmation) {
    return;
  }

  try {
    await deleteInventoryItem(inventory_id);
    const data = await getInventory();
    inventoryItems = data;
    triggerInventoryUpdate();
    renderListBody(container);
  } catch (err) {
    alert('Failed to remove piece');
  }
}

function renderSpinner(parent, message) {
  parent.innerHTML = `
    <div class="brick-spinner-container" style="height:100%">
      <div class="brick-stud-spinner">
        <div class="stud-spinner-top"></div>
        <div class="stud-spinner-body"></div>
      </div>
      <p class="brick-spinner-message font-display">${message}</p>
    </div>
  `;
}

function renderErrorState(parent) {
  parent.innerHTML = `
    <div class="brick-feedback-state error">
      <div class="feedback-icon-wrapper error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <h3 class="feedback-title font-display text-danger">Inventory Load Failed</h3>
      <p class="feedback-desc">${inventoryError}</p>
      <button type="button" class="brick-btn brick-btn-danger brick-btn-small" id="inv-retry-btn">Retry</button>
    </div>
  `;
  parent.querySelector('#inv-retry-btn').onclick = () => {
    loadInventoryData(parent);
  };
}

// Public API trigger to force reload inventory data when scanner adds elements
export function forceReloadInventory() {
  inventoryLoading = true;
  inventoryItems = [];
}
