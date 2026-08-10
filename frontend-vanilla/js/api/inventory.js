import { IS_MOCKED, API_BASE_URL, authHeader } from './client.js';
import {
  mockInventory,
  addMockInventoryItem,
  updateMockInventoryItem,
  deleteMockInventoryItem,
} from './fixtures.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getInventory() {
  if (!IS_MOCKED) {
    const res = await fetch(`${API_BASE_URL}/inventory`, {
      headers: { ...authHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch inventory');
    return await res.json();
  }

  await sleep(600);
  return [...mockInventory];
}

export async function addInventoryItem(item) {
  const { part_id, quantity, source_image_key } = item;

  if (!IS_MOCKED) {
    // Forward the whole object, not just the three fields above. The manual
    // Add Part flow has no part_id to send - it sends type + color and lets
    // inventory-crud resolve or create the catalogue row server-side.
    const res = await fetch(`${API_BASE_URL}/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader()
      },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to add inventory item');
    return await res.json();
  }

  await sleep(500);
  if (!part_id || quantity === undefined) {
    throw new Error('part_id and quantity are required');
  }
  const result = addMockInventoryItem({ part_id, quantity, source_image_key });
  return { ...result };
}

export async function updateInventoryItem(inventory_id, { quantity }) {
  if (!IS_MOCKED) {
    const res = await fetch(`${API_BASE_URL}/inventory/${inventory_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader()
      },
      body: JSON.stringify({ quantity })
    });
    if (!res.ok) throw new Error('Failed to update inventory item');
    return await res.json();
  }

  await sleep(400);
  if (quantity === undefined || quantity < 0) {
    throw new Error('quantity is required and must be non-negative');
  }
  
  if (quantity === 0) {
    const success = deleteMockInventoryItem(inventory_id);
    return { success, deleted: true };
  }

  const result = updateMockInventoryItem(inventory_id, { quantity });
  if (!result) {
    throw new Error(`Inventory item ${inventory_id} not found`);
  }
  return { ...result };
}

export async function deleteInventoryItem(inventory_id) {
  if (!IS_MOCKED) {
    const res = await fetch(`${API_BASE_URL}/inventory/${inventory_id}`, {
      method: 'DELETE',
      headers: { ...authHeader() }
    });
    if (!res.ok) throw new Error('Failed to delete inventory item');
    return await res.json();
  }

  await sleep(400);
  const success = deleteMockInventoryItem(inventory_id);
  if (!success) {
    throw new Error(`Inventory item ${inventory_id} not found`);
  }
  return { success: true };
}
