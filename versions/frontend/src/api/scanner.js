import { IS_MOCKED } from './client';
import { MOCK_PARTS } from './mockData/fixtures';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getUploadUrl(fileName) {
  await sleep(400);
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }
  const key = 'uploads/' + Math.random().toString(36).substr(2, 9) + '_' + fileName;
  const uploadUrl = `https://mock-s3-bucket.amazonaws.com/${key}?signature=fake_s3_presigned_signature`;
  return { uploadUrl, key };
}

export async function uploadImage(uploadUrl, file) {
  await sleep(1000); // Simulate image upload time
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }
  return { success: true };
}

export async function scanBrick(key) {
  await sleep(1200); // Simulate image recognition processing time
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }

  // Pick a random part from our fixture catalog, prioritizing red/blue if in filename
  let selectedPart = MOCK_PARTS[0];
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes('blue')) {
    const blueParts = MOCK_PARTS.filter(p => p.part_name.toLowerCase().includes('blue'));
    if (blueParts.length > 0) selectedPart = blueParts[Math.floor(Math.random() * blueParts.length)];
  } else if (lowerKey.includes('yellow')) {
    const yellowParts = MOCK_PARTS.filter(p => p.part_name.toLowerCase().includes('yellow'));
    if (yellowParts.length > 0) selectedPart = yellowParts[Math.floor(Math.random() * yellowParts.length)];
  } else if (lowerKey.includes('grey') || lowerKey.includes('gray')) {
    const greyParts = MOCK_PARTS.filter(p => p.part_name.toLowerCase().includes('grey'));
    if (greyParts.length > 0) selectedPart = greyParts[Math.floor(Math.random() * greyParts.length)];
  } else {
    selectedPart = MOCK_PARTS[Math.floor(Math.random() * MOCK_PARTS.length)];
  }

  const confidence = parseFloat((82 + Math.random() * 17.5).toFixed(1)); // 82% to 99.5%

  return {
    label: selectedPart.type + '_' + selectedPart.part_id,
    confidence,
    part: {
      part_id: selectedPart.part_id,
      part_name: selectedPart.part_name,
      category: selectedPart.category,
      reference_image_url: selectedPart.reference_image_url
    }
  };
}

export async function scanBatch(key) {
  await sleep(1500); // Simulate processing multiple bricks
  if (!IS_MOCKED) {
    throw new Error('Real backend not configured');
  }

  // Generate 2 or 3 distinct random candidates
  const count = Math.random() > 0.5 ? 3 : 2;
  const candidates = [];
  const chosenIndices = new Set();

  while (chosenIndices.size < count) {
    const idx = Math.floor(Math.random() * MOCK_PARTS.length);
    chosenIndices.add(idx);
  }

  Array.from(chosenIndices).forEach((partIndex, idx) => {
    const part = MOCK_PARTS[partIndex];
    candidates.push({
      boxIndex: idx,
      label: part.type + '_' + part.part_id,
      confidence: parseFloat((78 + Math.random() * 21).toFixed(1)),
      part: {
        part_id: part.part_id,
        part_name: part.part_name,
        category: part.category,
        reference_image_url: part.reference_image_url
      }
    });
  });

  return { candidates };
}
