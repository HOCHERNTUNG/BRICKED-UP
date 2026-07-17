import { IS_MOCKED, API_BASE_URL, authHeader } from './client';
import { inventoryFixtures } from './mockData/fixtures';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Keep some state in memory for the mock
let mockInventory = [...inventoryFixtures];

export async function getInventory() {
  if (IS_MOCKED) {
    await delay(500);
    return [...mockInventory];
  }
  // Real implementation
}

export async function addInventoryItem({ part_id, quantity, source_image_key }) {
  if (IS_MOCKED) {
    await delay(400);
    const newItem = {
      inventory_id: Date.now(),
      part_id,
      part_name: "Mock Part " + part_id,
      reference_image_url: "https://via.placeholder.com/150",
      category: "Unknown",
      quantity,
      date_added: new Date().toISOString(),
      source_image_key
    };
    mockInventory.push(newItem);
    return newItem;
  }
  // Real implementation
}

export async function updateInventoryItem(inventory_id, { quantity }) {
  if (IS_MOCKED) {
    await delay(400);
    const idx = mockInventory.findIndex(i => i.inventory_id === inventory_id);
    if (idx > -1) {
      mockInventory[idx] = { ...mockInventory[idx], quantity };
      return mockInventory[idx];
    }
    throw new Error('Not found');
  }
  // Real implementation
}

export async function deleteInventoryItem(inventory_id) {
  if (IS_MOCKED) {
    await delay(300);
    mockInventory = mockInventory.filter(i => i.inventory_id !== inventory_id);
    return { success: true };
  }
  // Real implementation
}
