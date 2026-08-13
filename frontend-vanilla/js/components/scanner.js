import { getUploadUrl, uploadImage, scanBrick, scanBatch } from '../api/scanner.js';
import { showToast, pluralParts } from '../hooks/toast.js';
import { getCatalogue, previewPart } from '../api/catalogue.js';
import { createShapePicker, createColorPicker, createPartPreview } from './pickers.js';
import { addInventoryItem } from '../api/inventory.js';
import { triggerInventoryUpdate } from '../hooks/state.js';

import { playSound } from '../hooks/sound.js';
import { partImageAttrs } from '../api/partImage.js';

let scanState = 'idle'; // idle | uploading | scanning | results | error
let candidates = [];

// Selectable models. An empty id means "whatever the backend has deployed",
// so the default path is unchanged if the switcher is never touched.
const MODEL_OPTIONS = [
  { id: '',    label: 'Default',
    hint: 'Whichever model is currently deployed' },
  { id: 'rb1', label: 'Rebrickable',
    hint: 'Trained on catalogue photographs; the scan is matted onto white to match' },
  { id: 'rb2', label: 'Rebrickable + viewpoint',
    hint: 'As Rebrickable, plus perspective warping so the training set is not all one camera angle' },
  { id: 'v3',  label: 'Original 50-class',
    hint: 'Trained on the B200C photo dataset. Strong on its own test set, weak on real photos - the domain gap' },
];
let selectedModel = '';
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
    <h4 class="font-display">Upload Photo</h4>
    <p>Drag files here or click to browse</p>
    <div class="photo-tip font-body">
      <span class="photo-tip-icon" aria-hidden="true">i</span>
      <span>
        <strong>Shoot at an angle from above</strong>, not straight down, on a
        plain surface in good light. The angle is what reveals a piece's
        height &ndash; from directly overhead a brick and a plate look
        identical. For several pieces at once, spread them apart so they
        don't touch.
      </span>
    </div>
    <input type="file" accept="image/*" style="display:none" id="scanner-file-input" />
  `;

  const fileInput = dropzone.querySelector('#scanner-file-input');
  dropzone.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Every upload goes through the batch route.
      //
      // This used to switch on the FILENAME - batch only if it contained
      // "batch" or "multi" - so a phone photo called 20260813_230648.jpg took
      // the single-brick path and returned exactly one result no matter how
      // many bricks were in frame. That is the "only ever one result" report,
      // and it had nothing to do with the model.
      //
      // The batch route handles one brick as happily as nine: the detector
      // finds however many there are. There is no longer any reason for the
      // user to have to tell us which kind of photo they took.
      runDetectionFlow(file, true, parent);
    }
  };

  container.appendChild(dropzone);

  // Model switcher.
  //
  // Three models trained on two different datasets, selectable per scan, so
  // the same photograph can be put through each in turn. That comparison is
  // the project's most interesting result and it is far more convincing shown
  // live than described: v3 scores 0.86 on its own test set and answers
  // slope-inv-2x2 for almost any real photo, while rb1 is trained on a domain
  // the scanner can actually normalise a phone photo into.
  const modelBar = document.createElement('div');
  modelBar.className = 'model-switch';
  modelBar.innerHTML = `<span class="model-switch-label font-display">Model</span>`;
  MODEL_OPTIONS.forEach(m => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `model-chip font-display ${m.id === selectedModel ? 'is-active' : ''}`;
    b.title = m.hint;
    b.textContent = m.label;
    b.onclick = () => { selectedModel = m.id; renderScanner(parent); };
    modelBar.appendChild(b);
  });
  container.appendChild(modelBar);

  // Quick Demo Buttons
  const demoSection = document.createElement('div');
  demoSection.className = 'demo-scans-section';
  demoSection.innerHTML = `
    <span class="demo-label font-display">Or Try Demo Photos:</span>
    <div class="demo-buttons-grid">
      <button type="button" class="demo-scan-btn font-display" data-type="single">Sample: Single Brick</button>
      <button type="button" class="demo-scan-btn font-display" data-type="dark">Sample: Dark Surface</button>
      <button type="button" class="demo-scan-btn font-display" data-type="batch">Sample: Multiple Bricks</button>
    </div>
  `;

  // Real photographs shipped with the site.
  //
  // Replaced with photographs taken on a phone of real bricks on a real desk,
  // because that is what the app is actually for and the previous set was not
  // representative of it. Every demo now runs the same route an upload does.
  const DEMO_PHOTOS = {
    single: 'assets/demo/single-brick.jpg',
    dark:   'assets/demo/dark-surface.jpg',
    batch:  'assets/demo/batch-bricks.jpg'
  };

  demoSection.querySelectorAll('[data-type]').forEach(btn => {
    btn.onclick = async () => {
      const type = btn.getAttribute('data-type');
      const path = DEMO_PHOTOS[type] || DEMO_PHOTOS.red;
      const name = path.split('/').pop();
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Demo photo ${name} is missing`);
        const blob = await res.blob();
        const file = new File([blob], name, { type: 'image/jpeg' });
        // All demos take the batch route, same as an upload - it handles one
        // brick as well as nine, and running demos down a different path than
        // real use is how the single/batch split went unnoticed.
        runDetectionFlow(file, true, parent);
      } catch (err) {
        errorMsg = err.message || 'Could not load the demo photo.';
        scanState = 'error';
        renderScanner(parent);
      }
    };
  });

  container.appendChild(demoSection);
  parent.appendChild(container);
}


/**
 * Inline editor for a scan result.
 *
 * Opens the same shape and colour pickers the manual Add Part panel uses, so
 * a correction is made with identical controls and identical guarantees -
 * only colours the shape genuinely exists in, and a real element behind
 * whatever is chosen. The card is updated in place; nothing is written until
 * the user presses Add to bin.
 */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function openCorrectionEditor(itemCard, cand, idx, parent) {
  const existing = itemCard.querySelector('.candidate-editor');
  if (existing) { existing.remove(); return; }      // second click closes it

  const holder = document.createElement('div');
  holder.className = 'candidate-editor';
  holder.innerHTML = '<p class="picker-empty font-body">Loading the catalogue…</p>';
  itemCard.appendChild(holder);

  let catalogue;
  try {
    catalogue = await getCatalogue();
  } catch (err) {
    holder.innerHTML = '<p class="picker-empty font-body">Could not load the catalogue.</p>';
    return;
  }

  holder.innerHTML = '';

  // The model's runners-up, offered as one-click choices.
  //
  // Measured on real photos, the top guess is right about as often as the old
  // model's was - but the correct shape is in the top three far more often,
  // and the misses are near-misses: a 1x4 read as a 1x3, a 2x2 read as a 2x2
  // round. Scrolling a fifty-tile grid to fix a one-stud error is the wrong
  // amount of work, so the three candidates go at the top and the full picker
  // stays underneath for when none of them is right.
  const alts = Array.isArray(cand.alternatives) ? cand.alternatives : [];
  if (alts.length) {
    const row = document.createElement('div');
    row.className = 'candidate-alts';
    row.innerHTML = '<span class="candidate-alts-label font-display">Or did you mean</span>';
    alts.forEach(alt => {
      const shape = catalogue.shapeByType.get(alt.type);
      if (!shape) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'candidate-alt font-display';
      b.title = `${shape.name} - model's next best guess at ${alt.confidence}%`;
      b.innerHTML = `
        <img ${partImageAttrs({ reference_image_url: shape.label_image_url,
                                label_image_url: shape.sample_image_url }, shape.name)} />
        <span class="candidate-alt-name">${escapeHtml(shape.name)}</span>
        <span class="candidate-alt-conf">${alt.confidence}%</span>`;
      b.onclick = () => {
        // Keep the detected colour: colour is resolved separately and is
        // reliable, so only the shape is being reconsidered here.
        shapePicker.set(alt.type);
        colorPicker.setShape(alt.type);
        syncPreview();
      };
      row.appendChild(b);
    });
    if (row.children.length > 1) holder.appendChild(row);
  }

  const shapePicker = createShapePicker(catalogue, {
    value: cand.part.type,
    onChange: (t) => { colorPicker.setShape(t); syncPreview(); }
  });
  const colorPicker = createColorPicker(catalogue, {
    type: cand.part.type,
    value: cand.part.color_id,
    onChange: () => syncPreview()
  });
  const preview = createPartPreview(catalogue, {
    type: cand.part.type, colorId: cand.part.color_id
  });
  function syncPreview() {
    preview.update(shapePicker.get(), colorPicker.get());
  }

  const actions = document.createElement('div');
  actions.className = 'candidate-editor-actions';
  actions.innerHTML = `
    <button type="button" class="brick-btn brick-btn-small editor-cancel">Cancel</button>
    <button type="button" class="brick-btn brick-btn-primary brick-btn-small editor-apply">Use this part</button>
  `;

  holder.appendChild(shapePicker.el);
  holder.appendChild(colorPicker.el);
  holder.appendChild(preview.el);
  holder.appendChild(actions);

  actions.querySelector('.editor-cancel').onclick = () => holder.remove();
  actions.querySelector('.editor-apply').onclick = () => {
    const chosen = previewPart(catalogue, shapePicker.get(), colorPicker.get());
    if (!chosen) { showToast('Pick a shape and a colour first.'); return; }

    // Replace the detection with the user's choice. `corrected` tells the
    // add handler to resolve by type+colour rather than the original
    // part_id, and clears the confidence score - it described the model's
    // guess, not this.
    cand.part = { ...cand.part, ...chosen };
    cand.corrected = true;
    showToast(`Set to ${chosen.part_name}`);
    renderResults(parent);
  };
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
      const result = await scanBatch(key, selectedModel);
      candidates = result.candidates;
    } else {
      const result = await scanBrick(key, selectedModel);
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
          // Honour any correction the user made before bulk-adding.
          await addInventoryItem(cand.corrected
            ? { type: cand.part.type, color_id: cand.part.color_id,
                quantity: 1, source_image_key: cand.label }
            : { part_id: cand.part.part_id, quantity: 1, source_image_key: cand.label });
          addedIndices.add(idx);
        }
      });
      await Promise.all(promises);
      triggerInventoryUpdate();
      showToast(`Added ${pluralParts(promises.length)} to your inventory`);
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
              ${cand.corrected
                ? `<span class="confidence-badge corrected" title="You changed this result">Corrected</span>`
                : `<span class="confidence-badge ${cand.confidence > 90 ? 'high' : ''}">${cand.confidence}% Match</span>`}
            </div>
            <h5 class="candidate-name font-display">${cand.part.part_name}</h5>
            
            <div class="candidate-actions">
              ${isAdded 
                ? `<div class="added-badge font-display text-success">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                     Added to Bin
                   </div>`
                : `<button type="button" class="brick-btn brick-btn-small correct-btn"
                           title="Change the detected shape or colour">Edit</button>
                   <button type="button" class="brick-btn brick-btn-primary brick-btn-small add-to-bin-btn">Add to bin</button>`
              }
            </div>
          </div>
        </div>
      </div>
    `;

    // Correcting a detection.
    //
    // The classifier is good but not perfect, and its single largest
    // confusion - a brick against a plate of the same footprint - is exactly
    // the one a person spots instantly. Letting the user fix it here means a
    // wrong guess never has to reach their inventory, and the correction uses
    // the same pickers as manual cataloguing.
    const correctBtn = itemCard.querySelector('.correct-btn');
    if (correctBtn) {
      correctBtn.onclick = () => openCorrectionEditor(itemCard, cand, idx, parent);
    }

    // Bind Add to Bin action
    const addBtn = itemCard.querySelector('.add-to-bin-btn');
    if (addBtn) {
      addBtn.onclick = async () => {
        try {
          // A corrected candidate carries type + color_id and no part_id, so
          // the server resolves it exactly as it would a manual add.
          await addInventoryItem(cand.corrected
            ? { type: cand.part.type, color_id: cand.part.color_id,
                quantity: 1, source_image_key: cand.label }
            : { part_id: cand.part.part_id, quantity: 1, source_image_key: cand.label });
          addedIndices.add(idx);
          triggerInventoryUpdate();
          showToast(`Added ${cand.part.part_name} to your inventory`);
          renderResults(parent);
        } catch (err) {
          showToast('Could not add that part - please try again.');
        }
      };
    }

    list.appendChild(itemCard);
  });

  container.appendChild(list);
  parent.appendChild(container);
}
