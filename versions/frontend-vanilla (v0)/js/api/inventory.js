import { IS_MOCKED } from './client.js';
import {
  mockInventory,
  addMockInventoryItem,
  updateMockInventoryItem,
  deleteMockInventoryItem,
} from './fixtures.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getInventory() {
  await sleep(600);
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }
  return [...mockInventory];
}

export async function addInventoryItem({ part_id, quantity, source_image_key }) {
  await sleep(500);
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }
  if (!part_id || quantity === undefined) {
    throw new Error('part_id and quantity are required');
  }
  const result = addMockInventoryItem({ part_id, quantity, source_image_key });
  return { ...result };
}

export async function updateInventoryItem(inventory_id, { quantity }) {
  await sleep(400);
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }
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
  await sleep(400);
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }
  const success = deleteMockInventoryItem(inventory_id);
  if (!success) {
    throw new Error(`Inventory item ${inventory_id} not found`);
  }
  return { success: true };
}
