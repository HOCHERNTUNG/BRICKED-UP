import { IS_MOCKED, API_BASE_URL, authHeader , ensureFreshToken } from './client.js';
import { MOCK_PARTS } from './fixtures.js';
import { toUploadableJpeg, UPLOAD_CONTENT_TYPE } from './imagePrep.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Surface the server's own message instead of a generic one.
 * The API returns useful, user-facing text - "The scanner model isn't running
 * right now", "Spread the pieces out on a plain surface" - and throwing a
 * fixed string threw all of that away.
 */
async function apiError(res, fallback) {
  try {
    const body = await res.json();
    if (body && body.message) return new Error(body.message);
  } catch (_) { /* not JSON */ }
  return new Error(fallback);
}


export async function getUploadUrl(fileName) {
  if (!IS_MOCKED) {
    await ensureFreshToken();
    const res = await fetch(`${API_BASE_URL}/scanner/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader()
      },
      body: JSON.stringify({ fileName })
    });
    if (!res.ok) throw await apiError(res, 'Failed to get upload URL');
    return await res.json();
  }

  await sleep(400);
  const key = 'uploads/' + Math.random().toString(36).substr(2, 9) + '_' + fileName;
  const uploadUrl = `https://mock-s3-bucket.amazonaws.com/${key}?signature=fake_s3_presigned_signature`;
  return { uploadUrl, key };
}

export async function uploadImage(uploadUrl, file) {
  if (!IS_MOCKED) {
    await ensureFreshToken();
    // The URL is signed with Content-Type image/jpeg in SignedHeaders, so the
    // PUT must carry exactly that header or S3 answers SignatureDoesNotMatch.
    // toUploadableJpeg guarantees the body really is a JPEG (see imagePrep.js).
    const body = await toUploadableJpeg(file);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': UPLOAD_CONTENT_TYPE },
      body
    });
    if (!res.ok) throw new Error(`Upload to S3 failed (${res.status}). Try a different photo.`);
    return { success: true };
  }

  await sleep(1000);
  return { success: true };
}

export async function scanBrick(key, model) {
  if (!IS_MOCKED) {
    await ensureFreshToken();
    const res = await fetch(`${API_BASE_URL}/scanner/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader()
      },
      body: JSON.stringify(model ? { key, model } : { key })
    });
    if (!res.ok) throw await apiError(res, 'Failed to scan brick');
    return await res.json();
  }

  await sleep(1200);
  let selectedPart = MOCK_PARTS[0];
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes('blue')) {
    // Specifically return blue plate (part_id 7) if the demo button for blue plate was clicked
    const bluePlate = MOCK_PARTS.find(p => p.part_id === 7);
    selectedPart = bluePlate || MOCK_PARTS[1]; // Fallback to blue brick if not found
  } else if (lowerKey.includes('red')) {
    // Specifically return red brick (part_id 1) if the demo button for red brick was clicked
    const redBrick = MOCK_PARTS.find(p => p.part_id === 1);
    selectedPart = redBrick || MOCK_PARTS[0];
  } else if (lowerKey.includes('yellow')) {
    const yellowParts = MOCK_PARTS.filter(p => p.part_name.toLowerCase().includes('yellow'));
    if (yellowParts.length > 0) selectedPart = yellowParts[Math.floor(Math.random() * yellowParts.length)];
  } else if (lowerKey.includes('grey') || lowerKey.includes('gray')) {
    const greyParts = MOCK_PARTS.filter(p => p.part_name.toLowerCase().includes('grey'));
    if (greyParts.length > 0) selectedPart = greyParts[Math.floor(Math.random() * greyParts.length)];
  } else {
    selectedPart = MOCK_PARTS[Math.floor(Math.random() * MOCK_PARTS.length)];
  }

  const confidence = parseFloat((82 + Math.random() * 17.5).toFixed(1));

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

export async function scanBatch(key, model) {
  if (!IS_MOCKED) {
    await ensureFreshToken();
    const res = await fetch(`${API_BASE_URL}/scanner/scan-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader()
      },
      body: JSON.stringify(model ? { key, model } : { key })
    });
    if (!res.ok) throw await apiError(res, 'Failed to scan batch');
    return await res.json();
  }

  await sleep(1500);
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes('batch')) {
    // Return a fixed representative batch: Red Brick (1), Yellow Brick (3), Blue Plate (7)
    const list = [
      MOCK_PARTS.find(p => p.part_id === 1) || MOCK_PARTS[0],
      MOCK_PARTS.find(p => p.part_id === 3) || MOCK_PARTS[2],
      MOCK_PARTS.find(p => p.part_id === 7) || MOCK_PARTS[6]
    ];
    return {
      candidates: list.map((part, idx) => ({
        boxIndex: idx,
        label: part.type + '_' + part.part_id,
        confidence: parseFloat((88 + Math.random() * 10).toFixed(1)),
        part: {
          part_id: part.part_id,
          part_name: part.part_name,
          category: part.category,
          reference_image_url: part.reference_image_url
        }
      }))
    };
  }

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
