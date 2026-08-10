import { getUploadUrl, uploadImage, scanBrick, scanBatch } from '../api/scanner.js';
import { addInventoryItem } from '../api/inventory.js';
import { triggerInventoryUpdate } from '../hooks/state.js';

import { playSound } from '../hooks/sound.js';
import { partImageAttrs } from '../api/partImage.js';

let scanState = 'idle'; // idle | uploading | scanning | results | error
let candidates = [];
let addedIndices = new Set();
let errorMsg = '';
let currentUploadedImageSrc = '';
let minifigIntervalId = null;

const minifigImages = [
  'FredFright.png',
  'FredSearching.png',
  'GlassMagnifyingDetective.png',
  'MagnifyingGlassKid.png',
  'TakingAPic.png'
];

function startMinifigurePopups() {
  stopMinifigurePopups();
  minifigIntervalId = setInterval(() => {
    const container = document.querySelector('.scanner-image-preview-wrapper');
    if (!container) return;

    const minifig = document.createElement('div');
    minifig.className = 'scanning-minifig';
    
    const randomImg = minifigImages[Math.floor(Math.random() * minifigImages.length)];
    minifig.style.backgroundImage = `url('assets/magnifier-minifigures/${randomImg}')`;
    
    // Fit size to fit the preview container card
    minifig.style.width = '64px';
    minifig.style.height = '64px';
    
    // Placements relative to preview wrapper bounding box
    const x = Math.random() * 75 + 10; // 10% to 85% width
    const y = Math.random() * 45 + 15; // 15% to 60% height
    minifig.style.left = `${x}%`;
    minifig.style.top = `${y}%`;
    
    container.appendChild(minifig);
    playSound('scan');

    setTimeout(() => {
      minifig.remove();
    }, 1600);
  }, 850);
}

function stopMinifigurePopups() {
  if (minifigIntervalId) {
    clearInterval(minifigIntervalId);
    minifigIntervalId = null;
  }
  document.querySelectorAll('.scanning-minifig').forEach(el => el.remove());
}

/**
 * Renders the Scanner Panel interior content in Vanilla JS
 */
export function renderScanner(parentEl) {
  parentEl.innerHTML = '';
  addedIndices = new Set();

  if (scanState === 'idle') {
    renderIdleState(parentEl);
  } else if (scanState === 'uploading') {
    renderSpinner(parentEl, 'Uploading image to S3 bucket...');
  } else if (scanState === 'scanning') {
    renderSpinner(parentEl, 'AI Recognition identifying LEGO parts...');
  } else if (scanState === 'error') {
    renderError(parentEl, errorMsg);
  } else if (scanState === 'results') {
    renderResults(parentEl);
  }
}

function renderIdleState(parent) {
  const container = document.createElement('div');
  container.className = 'scanner-panel-container';

  // Dropzone Box
  const dropzone = document.createElement('div');
  dropzone.className = 'scanner-dropzone';
  dropzone.innerHTML = `
    <div class="dropzone-circle">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
    </div>
    <h4 class="font-display">Upload Brick Photo</h4>
    <p>Drag files here or click to browse</p>
    <input type="file" accept="image/*" style="display:none" id="scanner-file-input" />
  `;

  const fileInput = dropzone.querySelector('#scanner-file-input');
  dropzone.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isBatch = file.name.toLowerCase().includes('batch') || file.name.toLowerCase().includes('multi');
      runDetectionFlow(file, isBatch, parent);
    }
  };

  container.appendChild(dropzone);

  // Quick Demo Buttons
  const demoSection = document.createElement('div');
  demoSection.className = 'demo-scans-section';
  demoSection.innerHTML = `
    <span class="demo-label font-display">Or Try Demo Photos:</span>
    <div class="demo-buttons-grid">
      <button type="button" class="demo-scan-btn font-display" data-type="red">🔴 Red Brick</button>
      <button type="button" class="demo-scan-btn font-display" data-type="blue">🔵 Blue Plate</button>
      <button type="button" class="demo-scan-btn font-display" data-type="batch">📦 Multi-Scan (Batch)</button>
    </div>
  `;

  demoSection.querySelectorAll('[data-type]').forEach(btn => {
    btn.onclick = () => {
      const type = btn.getAttribute('data-type');
      let dummyFile = new File([''], 'red_brick.jpg', { type: 'image/jpeg' });
      if (type === 'blue') {
        dummyFile = new File([''], 'blue_plate.jpg', { type: 'image/jpeg' });
      } else if (type === 'batch') {
        dummyFile = new File([''], 'batch_bricks.jpg', { type: 'image/jpeg' });
      }
      runDetectionFlow(dummyFile, type === 'batch', parent);
    };
  });

  container.appendChild(demoSection);
  parent.appendChild(container);
}

async function runDetectionFlow(file, isBatch, parent) {
  try {
    currentUploadedImageSrc = URL.createObjectURL(file);
    scanState = 'uploading';
    renderScanner(parent);

    const { uploadUrl, key } = await getUploadUrl(file.name);
    await uploadImage(uploadUrl, file);

    scanState = 'scanning';
    renderScanner(parent);
    startMinifigurePopups();

    if (isBatch) {
      const result = await scanBatch(key);
      candidates = result.candidates;
    } else {
      const result = await scanBrick(key);
      candidates = [result];
    }

    // Deliberate delay of 3.8s to let minifigures pop in/out satisfyingly inside scanner card
    await new Promise(resolve => setTimeout(resolve, 3800));

    stopMinifigurePopups();
    playSound('success');
    scanState = 'results';
    renderScanner(parent);
  } catch (err) {
    stopMinifigurePopups();
    errorMsg = err.message || 'Detection failed. Please check your network.';
    scanState = 'error';
    renderScanner(parent);
  }
}

function renderSpinner(parent, message) {
  parent.innerHTML = `
    <div class="brick-spinner-container">
      <div class="scanner-image-preview-wrapper" style="position:relative;width:100%;height:160px;border:3px solid var(--ink-900);border-radius:var(--radius-card);background-color:var(--white);overflow:hidden;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <img src="${currentUploadedImageSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" />
        <div class="scanner-scan-line"></div>
      </div>
      <div class="brick-stud-spinner">
        <div class="stud-spinner-top"></div>
        <div class="stud-spinner-body"></div>
      </div>
      <p class="brick-spinner-message font-display">${message}</p>
    </div>
  `;
}

function renderError(parent, message) {
  const container = document.createElement('div');
  container.className = 'brick-feedback-state error';
  container.innerHTML = `
    <div class="feedback-icon-wrapper error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    </div>
    <h3 class="feedback-title font-display text-danger">Detection Failed</h3>
    <p class="feedback-desc">${message}</p>
    <button type="button" class="brick-btn brick-btn-danger brick-btn-small" id="rescan-retry-btn">Retry</button>
  `;
  container.querySelector('#rescan-retry-btn').onclick = () => {
    scanState = 'idle';
    renderScanner(parent);
  };
  parent.appendChild(container);
}

function renderResults(parent) {
  parent.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'scanner-results-state';

  const headerActions = document.createElement('div');
  headerActions.className = 'results-header-actions';
  
  const title = document.createElement('h4');
  title.className = 'font-display';
  title.textContent = `Pieces Identified (${candidates.length})`;
  headerActions.appendChild(title);

  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'header-action-buttons';

  // Render "Add All" if multiple candidates
  if (candidates.length > 1) {
    const addAllBtn = document.createElement('button');
    addAllBtn.type = 'button';
    addAllBtn.className = 'brick-btn brick-btn-success brick-btn-small';
    addAllBtn.innerHTML = `Add All`;
    addAllBtn.onclick = async () => {
      const promises = candidates.map(async (cand, idx) => {
        if (!addedIndices.has(idx)) {
          await addInventoryItem({
            part_id: cand.part.part_id,
            quantity: 1,
            source_image_key: cand.label,
          });
          addedIndices.add(idx);
        }
      });
      await Promise.all(promises);
      triggerInventoryUpdate();
      renderResults(parent); // refresh view
    };
    actionsGroup.appendChild(addAllBtn);
  }

  // Rescan button
  const rescanBtn = document.createElement('button');
  rescanBtn.type = 'button';
  rescanBtn.className = 'brick-btn brick-btn-secondary brick-btn-small';
  rescanBtn.innerHTML = `Rescan`;
  rescanBtn.onclick = () => {
    scanState = 'idle';
    candidates = [];
    renderScanner(parent);
  };
  actionsGroup.appendChild(rescanBtn);

  headerActions.appendChild(actionsGroup);
  container.appendChild(headerActions);

  // Candidates List
  const list = document.createElement('div');
  list.className = 'candidates-list';

  candidates.forEach((cand, idx) => {
    const isAdded = addedIndices.has(idx);
    const itemCard = document.createElement('div');
    itemCard.className = 'brick-card candidate-card';
    
    itemCard.innerHTML = `
      <div class="brick-card-body">
        <div class="candidate-card-layout">
          <div class="candidate-image-wrapper">
            <img ${partImageAttrs(cand.part, cand.part.part_name)} class="candidate-part-img" />
          </div>
          <div class="candidate-info-wrapper">
            <div class="candidate-header-row">
              <span class="candidate-category font-display">${cand.part.category}</span>
              <span class="confidence-badge ${cand.confidence > 90 ? 'high' : ''}">${cand.confidence}% Match</span>
            </div>
            <h5 class="candidate-name font-display">${cand.part.part_name}</h5>
            
            <div class="candidate-actions">
              ${isAdded 
                ? `<div class="added-badge font-display text-success">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                     Added to Bin
                   </div>`
                : `<button type="button" class="brick-btn brick-btn-primary brick-btn-small add-to-bin-btn">Add to bin</button>`
              }
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind Add to Bin action
    const addBtn = itemCard.querySelector('.add-to-bin-btn');
    if (addBtn) {
      addBtn.onclick = async () => {
        try {
          await addInventoryItem({
            part_id: cand.part.part_id,
            quantity: 1,
            source_image_key: cand.label,
          });
          addedIndices.add(idx);
          triggerInventoryUpdate();
          renderResults(parent);
        } catch (err) {
          alert('Could not add item');
        }
      };
    }

    list.appendChild(itemCard);
  });

  container.appendChild(list);
  parent.appendChild(container);
}
