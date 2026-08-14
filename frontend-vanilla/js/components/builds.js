import { getBuilds, getBuildDetail } from '../api/builds.js';
import { spawnStandalonePanel } from '../hooks/state.js';
import { partImageAttrs } from '../api/partImage.js';
import { openLightbox } from '../hooks/lightbox.js';
import { API_BASE_URL, authHeader, ensureFreshToken } from '../api/client.js';
import { showToast } from '../hooks/toast.js';

/**
 * Ask the backend to email this build's shortfall.
 *
 * Shared by the Build Ideas cards and the build detail view, so the action is
 * reachable from wherever the user notices they are short of parts rather
 * than only after opening the instructions.
 */
export async function requestMissingPartsEmail(buildId, btn) {
  const original = btn ? btn.textContent : null;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    await ensureFreshToken();
    const res = await fetch(`${API_BASE_URL}/builds/${buildId}/email-missing-parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    showToast(data.message || 'Sent - check your inbox for the parts list');
    if (btn) btn.textContent = 'Sent ✓';
  } catch (err) {
    showToast(err.message || 'Could not send that email.');
    if (btn) btn.textContent = original;
  } finally {
    if (btn) {
      btn.disabled = false;
      setTimeout(() => { if (btn.isConnected) btn.textContent = original; }, 2500);
    }
  }
}

let buildsList = [];
let activeBuildId = null;
let activeBuildDetail = null;
let buildsPanelBody = null;

let buildsLoading = true;
let buildsError = null;

let detailLoading = false;
let detailError = null;

/**
 * Renders the Build Ideas Panel in Vanilla JS
 * Handles dynamic list vs detail views switching
 */
export function renderBuilds(parentEl) {
  buildsPanelBody = parentEl;
  parentEl.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'builds-panel-container';

  if (activeBuildId !== null) {
    renderDetailView(container);
  } else {
    renderCatalogView(container);
  }

  parentEl.appendChild(container);
}

function renderCatalogView(container) {
  const catalogView = document.createElement('div');
  catalogView.className = 'build-catalog-view';

  if (buildsLoading && buildsList.length === 0) {
    loadBuildsCatalog(container);
    return;
  }

  if (buildsError) {
    renderError(catalogView, buildsError, () => loadBuildsCatalog(container));
    container.appendChild(catalogView);
    return;
  }

  if (buildsList.length === 0) {
    renderEmpty(catalogView);
    container.appendChild(catalogView);
    return;
  }

  const list = document.createElement('div');
  list.className = 'builds-list';

  buildsList.forEach(build => {
    const is100Percent = build.pct_owned === 100;
    const card = document.createElement('div');
    card.className = 'build-card';
    card.onclick = () => selectBuild(build.build_id, container);

    card.innerHTML = `
      <img src="${build.hero_image_url}" alt="${build.build_name}" class="build-img" />
      <button type="button" class="build-zoom-btn" title="View this image full size"
              aria-label="View ${build.build_name} full size">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
      </button>
      <button type="button" class="build-popout-btn popout-btn" title="View Instructions" style="position: absolute; top: 8px; left: 8px; width: 28px; height: 28px; border-radius: 6px; border: 2.5px solid var(--ink-900); background-color: var(--brick-blue); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 5; box-shadow: 0 2.5px 0 var(--ink-900)">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--white)" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </button>
      <div class="build-info">
        <span class="build-difficulty-tag font-display">${build.difficulty}</span>
        <h4>${build.build_name}</h4>
        
        <div class="progress-container">
          <div class="progress-bar" style="width: ${build.pct_owned}%; background-color: ${is100Percent ? 'var(--brick-green)' : 'var(--brick-purple)'}"></div>
        </div>
        <span class="pct-text font-display">${build.pct_owned}% of parts owned</span>
        ${is100Percent ? '' : `
        <button type="button" class="build-email-btn font-display" data-build-id="${build.build_id}"
                title="Email me the parts I'm missing for this build">
          Email missing parts
        </button>`}
      </div>
      ${is100Percent 
        ? `<span class="build-ready-tag font-display">
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:2px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
             Ready!
           </span>`
        : ''
      }
    `;
    const emailBtn = card.querySelector('.build-email-btn');
    if (emailBtn) {
      emailBtn.onclick = (e) => {
        e.stopPropagation();     // the card itself opens the build
        requestMissingPartsEmail(build.build_id, emailBtn);
      };
    }

    card.querySelector('.build-zoom-btn').onclick = (e) => {
      e.stopPropagation();     // the card itself opens the build detail
      openLightbox(build.hero_image_url, build.build_name);
    };

    card.querySelector('.popout-btn').onclick = (e) => {
      e.stopPropagation();
      spawnStandalonePanel('build', {
        build_id: build.build_id,
        name: build.build_name,
        hero_image_url: build.hero_image_url
      });
    };
    list.appendChild(card);
  });

  catalogView.appendChild(list);
  container.appendChild(catalogView);
}

function renderDetailView(container) {
  const detailView = document.createElement('div');
  detailView.className = 'build-detail-view';

  // Back Button
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn font-display';
  backBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
    Back to builds
  `;
  backBtn.onclick = () => {
    activeBuildId = null;
    activeBuildDetail = null;
    renderBuilds(buildsPanelBody);
  };
  detailView.appendChild(backBtn);

  // Popout Reference Button
  const popoutBtn = document.createElement('button');
  popoutBtn.type = 'button';
  popoutBtn.className = 'back-btn font-display';
  popoutBtn.style.marginLeft = '8px';
  popoutBtn.style.backgroundColor = 'var(--brick-blue)';
  popoutBtn.style.color = 'var(--white)';
  popoutBtn.style.border = '2.5px solid var(--ink-900)';
  popoutBtn.style.boxShadow = '0 2.5px 0 var(--ink-900)';
  popoutBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
    View Instructions
  `;
  popoutBtn.onclick = () => {
    spawnStandalonePanel('build', {
      build_id: activeBuildDetail.build_id,
      name: activeBuildDetail.build_name,
      hero_image_url: activeBuildDetail.hero_image_url
    });
  };
  detailView.appendChild(popoutBtn);

  if (detailLoading) {
    renderSpinner(detailView, 'Retrieving schematic parts checklist...');
    container.appendChild(detailView);
    return;
  }

  if (detailError) {
    renderError(detailView, detailError, () => selectBuild(activeBuildId, container));
    container.appendChild(detailView);
    return;
  }

  if (activeBuildDetail) {
    const detailContent = document.createElement('div');
    detailContent.className = 'detail-content-scroll';

    // Hero banner. Clickable too - by the time someone has opened a build
    // they are more likely to want a proper look at it, not less.
    const hero = document.createElement('img');
    hero.className = 'detail-hero is-zoomable';
    hero.src = activeBuildDetail.hero_image_url;
    hero.alt = activeBuildDetail.build_name;
    hero.title = 'Click to view full size';
    hero.onclick = () => openLightbox(activeBuildDetail.hero_image_url,
                                      activeBuildDetail.build_name);
    detailContent.appendChild(hero);

    // Metadata
    const title = document.createElement('h4');
    title.className = 'detail-title font-display';
    title.textContent = activeBuildDetail.build_name;
    detailContent.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'detail-desc';
    desc.textContent = activeBuildDetail.description;
    detailContent.appendChild(desc);

    // Checklist
    const listTitle = document.createElement('h5');
    listTitle.className = 'parts-title font-display';
    listTitle.textContent = 'Required Parts';
    detailContent.appendChild(listTitle);

    const partsList = document.createElement('div');
    partsList.className = 'parts-list';

    activeBuildDetail.parts.forEach(part => {
      const isComplete = part.quantity_owned >= part.quantity_required;
      const missingCount = part.quantity_required - part.quantity_owned;

      const partRow = document.createElement('div');
      partRow.className = `part-req-row ${isComplete ? 'complete' : ''}`;
      
      partRow.innerHTML = `
        <img ${partImageAttrs(part, part.part_name)} class="part-req-img" />
        <div class="part-req-info font-body">
          <div style="flex:1">
            <span class="part-req-name font-display" style="display:block">${part.part_name}</span>
            <span style="font-size:0.75rem;color:var(--grey-600)">Owned: ${part.quantity_owned} / Required: ${part.quantity_required}</span>
          </div>
          <div class="part-req-qty">
            ${isComplete 
              ? `<span style="color:var(--brick-green)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>`
              : `<span class="status-indicator warning font-display" style="background-color:rgba(255,213,0,0.15);border:1.5px solid var(--ink-900);border-radius:6px;font-size:0.7rem;font-weight:800;color:var(--ink-900);padding:2px 6px;display:flex;align-items:center;gap:4px">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <span>+${missingCount}</span>
                 </span>`
            }
          </div>
        </div>
      `;
      partsList.appendChild(partRow);
    });

    detailContent.appendChild(partsList);
    detailView.appendChild(detailContent);
  }

  container.appendChild(detailView);
}

async function loadBuildsCatalog(container) {
  buildsLoading = true;
  buildsError = null;
  renderSpinner(container, 'Calculating matching build plans...');
  try {
    const data = await getBuilds();
    buildsList = data;
    buildsLoading = false;
    renderBuilds(buildsPanelBody);
  } catch (err) {
    buildsError = 'Could not retrieve build templates.';
    buildsLoading = false;
    renderBuilds(buildsPanelBody);
  }
}

async function selectBuild(buildId, container) {
  activeBuildId = buildId;
  detailLoading = true;
  detailError = null;
  renderBuilds(buildsPanelBody);
  try {
    const data = await getBuildDetail(buildId);
    activeBuildDetail = data;
    detailLoading = false;
    renderBuilds(buildsPanelBody);
  } catch (err) {
    detailError = 'Could not fetch build instructions details.';
    detailLoading = false;
    renderBuilds(buildsPanelBody);
  }
}

function renderSpinner(parent, message) {
  const spinner = document.createElement('div');
  spinner.className = 'brick-spinner-container';
  spinner.style.height = '100%';
  spinner.innerHTML = `
    <div class="brick-stud-spinner">
      <div class="stud-spinner-top"></div>
      <div class="stud-spinner-body"></div>
    </div>
    <p class="brick-spinner-message font-display">${message}</p>
  `;
  parent.appendChild(spinner);
}

function renderError(parent, message, onRetry) {
  const errState = document.createElement('div');
  errState.className = 'brick-feedback-state error';
  errState.innerHTML = `
    <div class="feedback-icon-wrapper error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    </div>
    <h3 class="feedback-title font-display text-danger">Error Loading</h3>
    <p class="feedback-desc">${message}</p>
    <button type="button" class="brick-btn brick-btn-danger brick-btn-small" id="builds-retry-btn">Retry</button>
  `;
  errState.querySelector('#builds-retry-btn').onclick = onRetry;
  parent.appendChild(errState);
}

function renderEmpty(parent) {
  const empty = document.createElement('div');
  empty.className = 'brick-feedback-state empty';
  empty.innerHTML = `
    <div class="feedback-icon-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    </div>
    <h3 class="feedback-title font-display">No builds discovered</h3>
    <p class="feedback-desc">No blueprints are matching the database.</p>
  `;
  parent.appendChild(empty);
}

async function reloadActiveBuildDetail() {
  if (activeBuildId === null) return;
  detailLoading = true;
  detailError = null;
  if (buildsPanelBody) {
    renderBuilds(buildsPanelBody);
  }
  try {
    const data = await getBuildDetail(activeBuildId);
    activeBuildDetail = data;
    detailLoading = false;
    if (buildsPanelBody) {
      renderBuilds(buildsPanelBody);
    }
  } catch (err) {
    detailError = 'Could not fetch build instructions details.';
    detailLoading = false;
    if (buildsPanelBody) {
      renderBuilds(buildsPanelBody);
    }
  }
}

// Public API trigger to force reload builds catalog when inventory changes
export function forceReloadBuilds() {
  buildsLoading = true;
  buildsList = [];
  if (activeBuildId !== null) {
    reloadActiveBuildDetail();
  }
}
export function closeBuildDetails() {
  activeBuildId = null;
  activeBuildDetail = null;
}
