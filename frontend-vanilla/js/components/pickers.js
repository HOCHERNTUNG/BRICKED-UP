// js/components/pickers.js
//
// Visual pickers for choosing a part.
//
// The old controls were two <select> dropdowns listing seven shape names and
// six colour names. That does not survive contact with a real catalogue:
// scrolling a flat list of twenty shapes is already tedious, and a colour
// dropdown reading "Bright Light Orange" tells you nothing about what the
// colour looks like. There are up to 132 colours per shape now.
//
// So: a searchable shape grid showing each part's line-art label, and a
// searchable colour grid of real swatches. Both are driven entirely by
// /catalogue, so retraining the model on more shapes adds them here with no
// frontend change.
//
// Only colours the selected shape is genuinely made in are offered, which
// means the user cannot construct a part that does not exist - and whatever
// they pick is guaranteed to have a photo.

import { colorsForShape, contrastOn, elementFor, elementImageUrl, previewPart }
  from '../api/catalogue.js';
import { partImageAttrs } from '../api/partImage.js';

/**
 * Shape grid with search.
 * @returns {{el: HTMLElement, get: () => string, set: (t: string) => void}}
 */
export function createShapePicker(catalogue, { value = null, onChange } = {}) {
  let selected = value || (catalogue.shapes[0] && catalogue.shapes[0].type);

  const wrap = document.createElement('div');
  wrap.className = 'picker-block';
  wrap.innerHTML = `
    <div class="picker-head">
      <label class="picker-label font-display">Part Shape</label>
      <input type="search" class="picker-search font-body shape-search"
             placeholder="Search shapes or part number..." />
    </div>
    <div class="picker-grid shape-grid" role="listbox" aria-label="Part shape"></div>
  `;
  const grid = wrap.querySelector('.shape-grid');
  const search = wrap.querySelector('.shape-search');

  function render() {
    const q = search.value.trim().toLowerCase();
    const matches = catalogue.shapes.filter(s =>
      !q || s.name.toLowerCase().includes(q) || s.part_num.toLowerCase().includes(q)
      || s.category.toLowerCase().includes(q));

    grid.innerHTML = '';
    if (!matches.length) {
      grid.innerHTML = `<p class="picker-empty font-body">No shapes match "${escapeHtml(search.value)}"</p>`;
      return;
    }

    let lastCategory = null;
    matches.forEach(s => {
      if (s.category !== lastCategory) {
        lastCategory = s.category;
        const h = document.createElement('div');
        h.className = 'picker-group-label font-display';
        h.textContent = s.category;
        grid.appendChild(h);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `picker-tile shape-tile ${s.type === selected ? 'is-selected' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(s.type === selected));
      btn.title = `${s.name} - part ${s.part_num}`;
      // Line art rather than a colour photo: this control chooses SHAPE, and
      // a coloured thumbnail here would imply the colour is being chosen too.
      btn.innerHTML = `
        <span class="shape-tile-img">
          <img ${partImageAttrs({ reference_image_url: s.label_image_url,
                                  label_image_url: s.sample_image_url }, s.name)} />
        </span>
        <span class="shape-tile-name font-display">${escapeHtml(s.name)}</span>
        <span class="shape-tile-part font-body">${escapeHtml(s.part_num)}</span>
      `;
      btn.onclick = () => {
        selected = s.type;
        render();
        if (onChange) onChange(selected);
      };
      grid.appendChild(btn);
    });
  }

  search.oninput = render;
  render();

  return {
    el: wrap,
    get: () => selected,
    set: (t) => { selected = t; render(); }
  };
}

/**
 * Colour swatch grid with search, limited to colours valid for `type`.
 */
export function createColorPicker(catalogue, { type, value = null, onChange } = {}) {
  let shapeType = type;
  let selected = value;

  const wrap = document.createElement('div');
  wrap.className = 'picker-block';
  wrap.innerHTML = `
    <div class="picker-head">
      <label class="picker-label font-display">Colour <span class="picker-count font-body"></span></label>
      <input type="search" class="picker-search font-body color-search"
             placeholder="Search colours..." />
    </div>
    <div class="picker-grid color-grid" role="listbox" aria-label="Part colour"></div>
  `;
  const grid = wrap.querySelector('.color-grid');
  const search = wrap.querySelector('.color-search');
  const count = wrap.querySelector('.picker-count');

  // No change events during construction. The first render auto-selects a
  // colour, and firing onChange then would call back into a caller that has
  // not finished building its own state yet - which threw
  // "Cannot access 'preview' before initialization". Callers read the
  // initial value with .get() instead.
  let ready = false;

  function render() {
    const available = colorsForShape(catalogue, shapeType);
    // Keep the selection only if the new shape is also made in that colour.
    if (selected != null && !available.some(c => c.color_id === selected)) {
      selected = null;
    }
    if (selected == null && available.length) {
      selected = available[0].color_id;
      if (ready && onChange) onChange(selected);
    }

    const q = search.value.trim().toLowerCase();
    const matches = available.filter(c => !q || c.name.toLowerCase().includes(q));
    count.textContent = `(${available.length} available for this shape)`;

    grid.innerHTML = '';
    if (!matches.length) {
      grid.innerHTML = `<p class="picker-empty font-body">No colours match "${escapeHtml(search.value)}"</p>`;
      return;
    }

    matches.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-swatch ${c.color_id === selected ? 'is-selected' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(c.color_id === selected));
      btn.title = `${c.name} (colour ${c.color_id})`;
      btn.style.backgroundColor = c.hex;
      btn.style.color = contrastOn(c.hex);
      btn.innerHTML = `<span class="color-swatch-name">${escapeHtml(c.name)}</span>`;
      btn.onclick = () => {
        selected = c.color_id;
        render();
        if (onChange) onChange(selected);
      };
      grid.appendChild(btn);
    });
  }

  search.oninput = render;
  render();
  ready = true;

  return {
    el: wrap,
    get: () => selected,
    set: (id) => { selected = id; render(); },
    setShape: (t) => { shapeType = t; render(); }
  };
}

/**
 * Live preview of the resolved part: the real element photo, its official
 * name, and the element id. Resolved client-side from the catalogue, so it
 * updates instantly as the pickers change rather than after a round trip.
 */
export function createPartPreview(catalogue, { type, colorId } = {}) {
  const el = document.createElement('div');
  el.className = 'part-preview brick-card';

  function render(t, cid) {
    const p = previewPart(catalogue, t, cid);
    if (!p) {
      el.innerHTML = `<p class="picker-empty font-body">Choose a shape and colour</p>`;
      return;
    }
    el.innerHTML = `
      <div class="part-preview-img">
        <img ${partImageAttrs(p, p.part_name)} />
      </div>
      <div class="part-preview-meta">
        <span class="part-preview-name font-display">${escapeHtml(p.part_name)}</span>
        <span class="part-preview-ids font-body">
          Element <strong>${p.element_id ? escapeHtml(p.element_id) : '—'}</strong>
          &middot; Part ${escapeHtml(p.part_num)}
        </span>
      </div>
    `;
  }

  render(type, colorId);
  return { el, update: render };
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
