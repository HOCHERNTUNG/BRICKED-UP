import { addInventoryItem } from '../api/inventory.js';
import { showToast } from '../hooks/toast.js';
import { IS_MOCKED } from '../api/client.js';
import { triggerInventoryUpdate, closePanel } from '../hooks/state.js';
import { MOCK_PARTS, getBrickSvg } from '../api/fixtures.js';

export function renderAddPartPanel(bodyEl, panelId) {
  bodyEl.innerHTML = '';
  bodyEl.style.padding = '16px';
  bodyEl.style.boxSizing = 'border-box';
  bodyEl.style.display = 'flex';
  bodyEl.style.flexDirection = 'column';
  bodyEl.style.gap = '12px';

  const form = document.createElement('div');
  form.className = 'add-part-form';
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '12px';

  form.innerHTML = `
    <div class="input-group" style="display:flex; flex-direction:column; gap:4px;">
      <label class="input-label font-display" style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:var(--ink-900);">Part Shape</label>
      <select class="part-shape-select font-body" style="width:100%; height:36px; border:2.5px solid var(--ink-900); border-radius:6px; font-weight:800; padding:0 8px; background:var(--white); outline:none; box-sizing:border-box; color:var(--ink-900);">
        <option value="1x1 Brick|brick-1x1|Brick">1x1 Brick</option>
        <option value="1x2 Brick|brick-1x2|Brick">1x2 Brick</option>
        <option value="1x4 Brick|brick-1x4|Brick">1x4 Brick</option>
        <option value="2x2 Brick|brick-2x2|Brick">2x2 Brick</option>
        <option value="2x3 Brick|brick-2x3|Brick">2x3 Brick</option>
        <option value="2x4 Brick|brick-2x4|Brick">2x4 Brick</option>
        <option value="1x1 Round Brick|brick-1x1-round|Brick">1x1 Round Brick</option>
        <option value="2x2 Round Brick|brick-2x2-round|Brick">2x2 Round Brick</option>
        <option value="1x1 Plate|plate-1x1|Plate">1x1 Plate</option>
        <option value="1x2 Plate|plate-1x2|Plate">1x2 Plate</option>
        <option value="2x2 Plate|plate-2x2|Plate">2x2 Plate</option>
        <option value="2x4 Plate|plate-2x4|Plate">2x4 Plate</option>
        <option value="4x4 Plate|plate-4x4|Plate">4x4 Plate</option>
        <option value="1x1 Round Plate|plate-1x1-round|Plate">1x1 Round Plate</option>
        <option value="1x2 Tile|tile-1x2|Tile">1x2 Tile</option>
        <option value="2x2 Tile|tile-2x2|Tile">2x2 Tile</option>
        <option value="2x2 Slope 45°|slope-2x2|Slope">2x2 Slope 45°</option>
        <option value="2x2 Inverted Slope 45°|slope-inv-2x2|Slope">2x2 Inverted Slope 45°</option>
        <option value="Technic 1x1 Brick|technic-1x1|Technic">Technic 1x1 Brick</option>
        <option value="Technic 1x2 Brick|technic-1x2|Technic">Technic 1x2 Brick</option>
      </select>
    </div>

    <div class="input-group" style="display:flex; flex-direction:column; gap:4px;">
      <label class="input-label font-display" style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:var(--ink-900);">Part Color</label>
      <select class="part-color-select font-body" style="width:100%; height:36px; border:2.5px solid var(--ink-900); border-radius:6px; font-weight:800; padding:0 8px; background:var(--white); outline:none; box-sizing:border-box; color:var(--ink-900);">
        <option value="Red|#D01012">Red</option>
        <option value="Blue|#0057A6">Blue</option>
        <option value="Yellow|#FFD500">Yellow</option>
        <option value="Green|#1E7A34">Green</option>
        <option value="Grey|#5B5B66">Grey</option>
        <option value="White|#FFFFFF">White</option>
      </select>
    </div>

    <div class="input-group" style="display:flex; flex-direction:column; gap:4px;">
      <label class="input-label font-display" style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:var(--ink-900);">Quantity</label>
      <div class="qty-picker" style="display:inline-flex; align-items:center; border:2.5px solid var(--ink-900); border-radius:6px; background:var(--white); overflow:hidden; height:32px; width: fit-content;">
        <button type="button" class="manual-qty-btn dec-qty" style="width:32px; height:100%; border:none; background:transparent; font-size:1.1rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; color:var(--ink-900);">-</button>
        <input type="number" class="manual-qty-val font-body" value="1" style="width:40px; text-align:center; border:none; background:transparent; font-weight:800; outline:none; border-left:2.5px solid var(--ink-900); border-right:2.5px solid var(--ink-900); height:100%; margin:0; color:var(--ink-900); -moz-appearance: textfield;" />
        <button type="button" class="manual-qty-btn inc-qty" style="width:32px; height:100%; border:none; background:transparent; font-size:1.1rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; color:var(--ink-900);">+</button>
      </div>
    </div>

    <button type="button" class="brick-btn brick-btn-primary add-part-submit-btn font-display" style="width:100%; margin-top:12px; height:40px; border:2.5px solid var(--ink-900); box-shadow:0 3px 0 var(--ink-900);">Add to Bin</button>
  `;

  // Bind actions
  const decBtn = form.querySelector('.dec-qty');
  const incBtn = form.querySelector('.inc-qty');
  const qtyInput = form.querySelector('.manual-qty-val');
  const submitBtn = form.querySelector('.add-part-submit-btn');

  decBtn.onclick = () => {
    let val = parseInt(qtyInput.value);
    if (isNaN(val) || val <= 1) val = 1;
    else val--;
    qtyInput.value = val;
  };

  incBtn.onclick = () => {
    let val = parseInt(qtyInput.value);
    if (isNaN(val)) val = 1;
    else val++;
    qtyInput.value = val;
  };

  submitBtn.onclick = async () => {
    const shapeVal = form.querySelector('.part-shape-select').value.split('|');
    const colorVal = form.querySelector('.part-color-select').value.split('|');
    const qty = parseInt(qtyInput.value) || 1;

    const shapeName = shapeVal[0];
    const shapeType = shapeVal[1];
    const shapeCategory = shapeVal[2];

    const colorName = colorVal[0];
    const colorHex = colorVal[1];

    const partName = `${shapeName} (${colorName})`;

    try {
      if (IS_MOCKED) {
        // Standalone mode: resolve or register the part in the local fixture
        // array, since there is no server to do it.
        let existingPart = MOCK_PARTS.find(p => p.type === shapeType && p.color === colorHex);
        let partId;
        if (existingPart) {
          partId = existingPart.part_id;
        } else {
          partId = Math.max(...MOCK_PARTS.map(p => p.part_id), 0) + 1;
          MOCK_PARTS.push({
            part_id: partId,
            part_name: partName,
            category: shapeCategory,
            color: colorHex,
            type: shapeType,
            reference_image_url: getBrickSvg(colorHex, shapeType)
          });
        }
        await addInventoryItem({
          part_id: partId,
          quantity: qty,
          source_image_key: null
        });
      } else {
        // Real mode: there is no client-side catalogue. Send the shape and
        // colour and let inventory-crud look up the matching parts_catalog
        // row, creating one if this pair has not been seen before - the same
        // resolution path the scan flow uses.
        // part_name is deliberately NOT sent. The server resolves the swatch
        // to the nearest official LEGO colour and names the part from that,
        // so the catalogue reads "Dark Bluish Gray" rather than our informal
        // "Grey" - and manual adds match scanned ones exactly.
        await addInventoryItem({
          type: shapeType,
          color: colorHex,
          category: shapeCategory,
          quantity: qty,
          source_image_key: null
        });
      }
      triggerInventoryUpdate();
      showToast(`Added ${qty} × ${shapeName} to your inventory`);
      closePanel(panelId);
    } catch (err) {
      alert('Failed to add part: ' + err.message);
    }
  };

  bodyEl.appendChild(form);
}
