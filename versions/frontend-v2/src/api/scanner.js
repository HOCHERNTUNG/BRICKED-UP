import { IS_MOCKED, API_BASE_URL, authHeader } from './client';
import { scanResultFixtures } from './mockData/fixtures';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function getUploadUrl(fileName) {
  if (IS_MOCKED) {
    await delay(400);
    return { uploadUrl: 'mock-url', key: 'mock-key-' + Date.now() };
  }
  // Real implementation
}

export async function uploadImage(uploadUrl, file) {
  if (IS_MOCKED) {
    await delay(600);
    return { success: true };
  }
  // Real implementation
}

export async function scanBrick(key) {
  if (IS_MOCKED) {
    await delay(1200);
    return scanResultFixtures;
  }
  // Real implementation
}

export async function scanBatch(key) {
  if (IS_MOCKED) {
    await delay(1200);
    return { candidates: [{ boxIndex: 0, ...scanResultFixtures }] };
  }
  // Real implementation
}
