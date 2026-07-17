import { getInventory, updateInventoryItem, deleteInventoryItem } from '../api/inventory.js';
import { triggerInventoryUpdate } from '../hooks/state.js';

let inventoryItems = [];
let inventoryLoading = true;
let inventoryError = null;

let searchQuery = '';
let selectedCategory = 'All';

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
  let selectOptions = categories.map(cat => `<option value="${cat}" ${selectedCategory === cat ? 'selected' : ''}>${cat}</option>`).join('');

  selectBox.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="filter-icon"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
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
    const matchesSearch = item.part_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
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
    const card = document.createElement('div');
    card.className = 'brick-card inventory-part-card';
    card.innerHTML = `
      <div class="part-card-inner">
        <div class="part-img-holder">
          <img src="${item.reference_image_url}" alt="${item.part_name}" />
        </div>
        <div class="part-card-content">
          <div class="part-meta-row font-display">
            <span class="part-badge-cat">${item.category}</span>
          </div>
          <h6 class="part-display-name font-display" title="${item.part_name}">${item.part_name}</h6>
          
          <div class="part-card-footer-actions">
            <div class="qty-picker">
              <button type="button" class="qty-picker-btn font-display decrease-btn"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              <span class="qty-value font-display">${item.quantity}</span>
              <button type="button" class="qty-picker-btn font-display increase-btn"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
            </div>
            <button type="button" class="part-delete-btn delete-btn" title="Remove item">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind Quantity selectors
    card.querySelector('.decrease-btn').onclick = () => adjustQuantity(item.inventory_id, item.quantity - 1, container);
    card.querySelector('.increase-btn').onclick = () => adjustQuantity(item.inventory_id, item.quantity + 1, container);
    card.querySelector('.delete-btn').onclick = () => removePiece(item.inventory_id, container);

    grid.appendChild(card);
  });

  listPlaceholder.appendChild(grid);
}

async function adjustQuantity(inventory_id, newQty, container) {
  try {
    if (newQty <= 0) {
      await deleteInventoryItem(inventory_id);
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
