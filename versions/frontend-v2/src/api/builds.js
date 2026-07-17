import { IS_MOCKED, API_BASE_URL, authHeader } from './client';
import { buildFixtures, buildDetailFixtures } from './mockData/fixtures';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function getBuilds() {
  if (IS_MOCKED) {
    await delay(600);
    return buildFixtures;
  }
  // Real implementation
}

export async function getBuildDetail(build_id) {
  if (IS_MOCKED) {
    await delay(500);
    return buildDetailFixtures[build_id] || null;
  }
  // Real implementation
}
