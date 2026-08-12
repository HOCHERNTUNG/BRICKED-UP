// js/api/catalogue.js
//
// The set of parts the app can express: every trained shape, and for each,
// the colours that shape is genuinely manufactured in.
//
// This used to be two hard-coded lists in addPart.js - seven shape names and
// six colour names - which is why the app could only ever describe a part in
// six colours regardless of what the scanner detected, and why adding shapes
// to the model did not add them to the UI.
//
// Fetched once and cached: it only changes when the model is retrained or the
// Rebrickable data is reimported.

import { API_BASE_URL, authHeader, ensureFreshToken, IS_MOCKED } from './client.js';

const ELEMENT_IMAGE_BASE = 'https://cdn.rebrickable.com/media/parts/elements';

let cache = null;
let inFlight = null;

/** @returns {Promise<{shapes: Array, colors: Array}>} */
export async function getCatalogue() {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (IS_MOCKED) {
      cache = mockCatalogue();
      return cache;
    }
    await ensureFreshToken();
    const res = await fetch(`${API_BASE_URL}/catalogue`, { headers: { ...authHeader() } });
    if (!res.ok) throw new Error('Could not load the part catalogue');
    const data = await res.json();

    // Index once here so every caller gets O(1) lookups instead of scanning.
    data.shapeByType = new Map(data.shapes.map(s => [s.type, s]));
    data.colorById = new Map(data.colors.map(c => [c.color_id, c]));
    cache = data;
    return cache;
  })().finally(() => { inFlight = null; });

  return inFlight;
}

export function elementImageUrl(elementId) {
  return elementId ? `${ELEMENT_IMAGE_BASE}/${elementId}.jpg` : null;
}

/** Colours this shape actually exists in, as full colour objects. */
export function colorsForShape(catalogue, type) {
  const shape = catalogue.shapeByType.get(type);
  if (!shape) return [];
  return shape.colors
    .map(id => catalogue.colorById.get(id))
    .filter(Boolean);
}

/** The official element id for a (shape, colour) pair, if one exists. */
export function elementFor(catalogue, type, colorId) {
  const shape = catalogue.shapeByType.get(type);
  return shape ? (shape.element_ids[String(colorId)] || null) : null;
}

/**
 * Everything the UI needs to show a chosen part, resolved locally.
 * Avoids a server round trip while the user is still adjusting the pickers.
 */
export function previewPart(catalogue, type, colorId) {
  const shape = catalogue.shapeByType.get(type);
  const color = catalogue.colorById.get(colorId);
  if (!shape || !color) return null;
  const elementId = elementFor(catalogue, type, colorId);
  return {
    type,
    color_id: colorId,
    element_id: elementId,
    part_num: shape.part_num,
    part_name: `${shape.name} (${color.name})`,
    category: shape.category,
    color_name: color.name,
    color_hex: color.hex,
    reference_image_url: elementImageUrl(elementId),
    label_image_url: shape.label_image_url,
    fallback_image_svg: null
  };
}

/** Readable text colour for a swatch background. */
export function contrastOn(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#22222A';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#22222A' : '#FFFFFF';
}

// Standalone mode has no server, so offer just enough to keep the pickers
// functional for a UI-only demo.
function mockCatalogue() {
  const colors = [
    { color_id: 4, name: 'Red', hex: '#D01012' },
    { color_id: 1, name: 'Blue', hex: '#0057A6' },
    { color_id: 14, name: 'Yellow', hex: '#FFD500' },
    { color_id: 2, name: 'Green', hex: '#1E7A34' },
    { color_id: 72, name: 'Dark Bluish Gray', hex: '#5B5B66' },
    { color_id: 15, name: 'White', hex: '#FFFFFF' }
  ];
  const shapes = [
    ['brick-2x4', '2x4 Brick', 'Brick', '3001'],
    ['brick-2x2', '2x2 Brick', 'Brick', '3003'],
    ['plate-1x2', '1x2 Plate', 'Plate', '3023'],
    ['plate-2x2', '2x2 Plate', 'Plate', '3022'],
    ['plate-2x4', '2x4 Plate', 'Plate', '3020'],
    ['slope-2x2', '2x2 Slope 45', 'Slope', '3039'],
    ['technic-1x1', 'Technic 1x1 Brick', 'Technic', '6541']
  ].map(([type, name, category, part_num]) => ({
    type, name, category, part_num,
    label_image_url: null, sample_element_id: null, sample_image_url: null,
    colors: colors.map(c => c.color_id),
    element_ids: {}
  }));
  const data = { shapes, colors };
  data.shapeByType = new Map(shapes.map(s => [s.type, s]));
  data.colorById = new Map(colors.map(c => [c.color_id, c]));
  return data;
}
