import { IS_MOCKED } from './client';
import { MOCK_BUILDS, mockInventory, MOCK_PARTS } from './mockData/fixtures';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to compute percentage of parts owned dynamically based on current inventory contents
function calculatePctOwned(build) {
  let totalRequired = 0;
  let totalOwned = 0;

  build.parts.forEach(req => {
    totalRequired += req.quantity_required;
    const invItem = mockInventory.find(i => i.part_id === req.part_id);
    const ownedCount = invItem ? invItem.quantity : 0;
    totalOwned += Math.min(ownedCount, req.quantity_required);
  });

  if (totalRequired === 0) return 100;
  return Math.round((totalOwned / totalRequired) * 100);
}

export async function getBuilds() {
  await sleep(700); // Simulate network load
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }

  // Map templates, calculating % owned dynamically based on current inventory
  return MOCK_BUILDS.map(build => ({
    build_id: build.build_id,
    build_name: build.build_name,
    description: build.description,
    difficulty: build.difficulty,
    hero_image_url: build.hero_image_url,
    pct_owned: calculatePctOwned(build)
  }));
}

export async function getBuildDetail(build_id) {
  await sleep(500);
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }

  const build = MOCK_BUILDS.find(b => b.build_id === build_id);
  if (!build) {
    throw new Error(`Build idea ${build_id} not found`);
  }

  // Populate parts with reference details and current owned amounts dynamically
  const detailedParts = build.parts.map(req => {
    const partRef = MOCK_PARTS.find(p => p.part_id === req.part_id);
    const invItem = mockInventory.find(i => i.part_id === req.part_id);
    const quantity_owned = invItem ? invItem.quantity : 0;

    return {
      part_id: req.part_id,
      part_name: partRef ? partRef.part_name : req.part_name,
      reference_image_url: partRef ? partRef.reference_image_url : '',
      quantity_required: req.quantity_required,
      quantity_owned
    };
  });

  return {
    build_id: build.build_id,
    build_name: build.build_name,
    description: build.description,
    difficulty: build.difficulty,
    hero_image_url: build.hero_image_url,
    parts: detailedParts
  };
}
