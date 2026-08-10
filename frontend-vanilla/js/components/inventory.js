import { getInventory, updateInventoryItem, deleteInventoryItem } from '../api/inventory.js';
import { triggerInventoryUpdate, spawnStandalonePanel, parsePartNameAndColor } from '../hooks/state.js';
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

  // Category select
  const selectBox = document.createElement('div');
  selectBox.className = 'category-select-wrapper';
  
  const categories = ['All', ...new Set(inventoryItems.map(i => i.category))];
  let selectOptions = categories.map(cat => `<option value="${cat}" ${selectedCategory === cat ? 'selected' : ''}>Type: ${cat}</option>`).join('');

  selectBox.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="filter-icon"><rect x="3" y="9" width="18" height="10" rx="2" ry="2"></rect><circle cx="8" cy="5" r="2" fill="currentColor"></circle><circle cx="16" cy="5" r="2" fill="currentColor"></circle></svg>
    <select class="category-select font-display" id="inv-category-select">
      ${selectOptions}
    </select>
  `;
  const categorySelect = selectBox.querySelector('#inv-category-select');
  categorySelect.onchange = (e) => {
    selectedCategory = e.target.value;
    renderListBody(container);
  };
  headerSearch.appendChild(selectBox);

  // Color select
  const colorSelectBox = document.createElement('div');
  colorSelectBox.className = 'category-select-wrapper color-select-wrapper';
  
  const colors = ['All', ...new Set(inventoryItems.map(i => parsePartNameAndColor(i.part_name).color))];
  let colorOptions = colors.map(col => `<option value="${col}" ${selectedColor === col ? 'selected' : ''}>Colour: ${col}</option>`).join('');

  colorSelectBox.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="filter-icon"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" fill="currentColor"></path></svg>
    <select class="category-select font-display" id="inv-color-select">
      ${colorOptions}
    </select>
  `;
  const colorSelect = colorSelectBox.querySelector('#inv-color-select');
  colorSelect.onchange = (e) => {
    selectedColor = e.target.value;
    renderListBody(container);
  };
  headerSearch.appendChild(colorSelectBox);

  container.appendChild(headerSearch);

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
    const parsed = parsePartNameAndColor(item.part_name);
    const matchesSearch = parsed.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesColor = selectedColor === 'All' || parsed.color === selectedColor;
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
    const colorStyles = getBrickColorStyles(parsed.color);
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
            <span class="part-badge-color" style="background-color: ${colorStyles.bg}; color: ${colorStyles.text}; border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 1px 4px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase;">${parsed.color}</span>
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
