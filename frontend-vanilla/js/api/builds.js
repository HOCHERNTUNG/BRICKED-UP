import { IS_MOCKED, API_BASE_URL, authHeader , ensureFreshToken } from './client.js';
import { MOCK_BUILDS, mockInventory, MOCK_PARTS } from './fixtures.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ask the backend to email the parts missing for a build.
 *
 * Lives here rather than in the components because it was written twice -
 * once in builds.js and once in workspace.js for the standalone panel - and
 * both copies called the API unconditionally. That made the feature the one
 * thing in the app that could not run offline: the button reported failure
 * with no backend, even though every other action worked from fixtures.
 *
 * @returns {Promise<string>} a message suitable for showing the user
 */
export async function emailMissingParts(buildId) {
  if (IS_MOCKED) {
    await sleep(700);
    const build = MOCK_BUILDS.find(b => b.build_id === Number(buildId));
    const short = build
      ? build.parts.reduce((n, req) => {
          const inv = mockInventory.find(i => i.part_id === req.part_id);
          return n + Math.max(0, req.quantity_required - (inv ? inv.quantity : 0));
        }, 0)
      : 0;
    // Says plainly that nothing was sent. Reporting a successful send while
    // offline would be a lie the user only discovers at an empty inbox.
    return short
      ? `Offline demo: ${short} missing part${short === 1 ? '' : 's'} would be emailed to you`
      : 'Offline demo: you already have every part for this build';
  }

  await ensureFreshToken();
  const res = await fetch(`${API_BASE_URL}/builds/${buildId}/email-missing-parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data.message || 'Sent - check your inbox for the parts list';
}

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
    await ensureFreshToken();
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
    await ensureFreshToken();
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
