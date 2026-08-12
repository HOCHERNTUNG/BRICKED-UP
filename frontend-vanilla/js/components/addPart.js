import { addInventoryItem } from '../api/inventory.js';
import { showToast } from '../hooks/toast.js';
import { IS_MOCKED } from '../api/client.js';
import { getCatalogue, previewPart } from '../api/catalogue.js';
import { createShapePicker, createColorPicker, createPartPreview } from './pickers.js';
import { triggerInventoryUpdate, closePanel } from '../hooks/state.js';
import { MOCK_PARTS, getBrickSvg } from '../api/fixtures.js';

/**
 * Manual cataloguing panel.
 *
 * Replaces two dropdowns (7 shapes, 6 colour names) with searchable visual
 * pickers driven by the live catalogue. Colours are limited to those the
 * chosen shape is actually manufactured in, and the exact element - photo,
 * official name, element id - is previewed before anything is saved.
 */
export function renderAddPartPanel(bodyEl, panelId) {
  bodyEl.innerHTML = '';
  bodyEl.className = 'panel-body-content add-part-panel';

  const loading = document.createElement('div');
  loading.className = 'add-part-loading font-body';
  loading.textContent = 'Loading the part catalogue…';
  bodyEl.appendChild(loading);

  getCatalogue()
    .then(catalogue => build(bodyEl, panelId, catalogue))
    .catch(err => {
      bodyEl.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'picker-empty font-body';
      msg.textContent = err.message || 'Could not load the part catalogue.';
      bodyEl.appendChild(msg);
    });
}

function build(bodyEl, panelId, catalogue) {
  bodyEl.innerHTML = '';

  const form = document.createElement('div');
  form.className = 'add-part-form';

  const shapePicker = createShapePicker(catalogue, { onChange: onShapeChange });
  const colorPicker = createColorPicker(catalogue, {
    type: shapePicker.get(),
    onChange: () => refreshPreview()
  });
  const preview = createPartPreview(catalogue, {
    type: shapePicker.get(),
    colorId: colorPicker.get()
  });

  function onShapeChange(type) {
    // Re-scope the colours first: the new shape may not come in the colour
    // currently selected, and the picker resolves that before we preview.
    colorPicker.setShape(type);
    refreshPreview();
  }
  function refreshPreview() {
    preview.update(shapePicker.get(), colorPicker.get());
  }

  form.appendChild(shapePicker.el);
  form.appendChild(colorPicker.el);

  const footer = document.createElement('div');
  footer.className = 'add-part-footer';
  footer.innerHTML = `
    <div class="qty-picker add-part-qty">
      <button type="button" class="manual-qty-btn dec-qty" aria-label="Decrease quantity">-</button>
      <input type="number" class="manual-qty-val font-body" value="1" min="1" aria-label="Quantity" />
      <button type="button" class="manual-qty-btn inc-qty" aria-label="Increase quantity">+</button>
    </div>
    <button type="button" class="brick-btn brick-btn-primary add-part-submit-btn font-display">Add to Bin</button>
  `;

  form.appendChild(preview.el);
  form.appendChild(footer);
  bodyEl.appendChild(form);

  const qtyInput = footer.querySelector('.manual-qty-val');
  footer.querySelector('.dec-qty').onclick = () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) - 1);
  };
  footer.querySelector('.inc-qty').onclick = () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) + 1);
  };

  const submitBtn = footer.querySelector('.add-part-submit-btn');
  submitBtn.onclick = async () => {
    const type = shapePicker.get();
    const colorId = colorPicker.get();
    const qty = Math.max(1, parseInt(qtyInput.value) || 1);
    const p = previewPart(catalogue, type, colorId);
    if (!p) {
      showToast('Choose a shape and a colour first.');
      return;
    }

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Adding…';
    try {
      if (IS_MOCKED) {
        let existing = MOCK_PARTS.find(x => x.type === type && x.color === p.color_hex);
        let partId;
        if (existing) {
          partId = existing.part_id;
        } else {
          partId = Math.max(...MOCK_PARTS.map(x => x.part_id), 0) + 1;
          MOCK_PARTS.push({
            part_id: partId, part_name: p.part_name, category: p.category,
            color: p.color_hex, type, reference_image_url: getBrickSvg(p.color_hex, type)
          });
        }
        await addInventoryItem({ part_id: partId, quantity: qty, source_image_key: null });
      } else {
        // color_id, not a hex string: the server treats the id as
        // authoritative and does not have to guess which colour was meant.
        // part_name is deliberately omitted so the server names the part from
        // the official colour, keeping manual adds identical to scanned ones.
        await addInventoryItem({
          type,
          color_id: colorId,
          category: p.category,
          quantity: qty,
          source_image_key: null
        });
      }
      triggerInventoryUpdate();
      showToast(`Added ${qty} × ${p.part_name} to your inventory`);
      closePanel(panelId);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
      showToast(err.message || 'Could not add that part.');
    }
  };
}
