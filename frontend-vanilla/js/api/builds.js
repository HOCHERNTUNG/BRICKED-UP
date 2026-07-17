import { IS_MOCKED, API_BASE_URL, authHeader } from './client.js';
import { MOCK_BUILDS, mockInventory, MOCK_PARTS } from './fixtures.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  if (!IS_MOCKED) {
    const res = await fetch(`${API_BASE_URL}/builds`, {
      headers: { ...authHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch builds');
    return await res.json();
  }

  await sleep(700);
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
  if (!IS_MOCKED) {
    const res = await fetch(`${API_BASE_URL}/builds/${build_id}`, {
      headers: { ...authHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch build detail');
    return await res.json();
  }

  await sleep(500);
  const build = MOCK_BUILDS.find(b => b.build_id === build_id);
  if (!build) {
    throw new Error(`Build idea ${build_id} not found`);
  }

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
    parts: detailedParts,
    steps: build.steps || []
  };
}
