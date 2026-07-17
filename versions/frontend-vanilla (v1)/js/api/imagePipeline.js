// js/api/imagePipeline.js

// ==============================================================================
// CONFIGURATION: Configure your S3 Bucket name here to match generate_manifest.py
// ==============================================================================
export const BUCKET_NAME = "brickedup-training-data-[yourname]";

/**
 * Generates the direct BrickLink 3D high-fidelity render URL template.
 * @param {string} partNum - The LEGO part number string (e.g. "3001", "3062b").
 * @returns {string} The BrickLink image URL.
 */
export function getImageUrl(partNum) {
  if (!partNum) {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect x="5" y="5" width="50" height="50" rx="8" fill="%235B5B66" stroke="%2322222A" stroke-width="4"/></svg>';
  }
  return `https://img.bricklink.com/ItemImage/PL/${partNum}.png`;
}

/**
 * Asynchronous network error handler that switches the image source path
 * to the self-hosted Amazon S3 backup storage directory.
 * Used as an HTML onerror callback.
 * 
 * @param {HTMLImageElement} imgElement - The img element that failed to load.
 * @param {string} partNum - The LEGO part number string.
 */
export async function fallbackToS3(imgElement, partNum) {
  // Prevent infinite retry loops if the S3 backup image also fails to load
  if (imgElement.dataset.fallbackAttempted === 'true') {
    console.warn(`S3 fallback image also failed to load for part: ${partNum}. Applying static SVG placeholder.`);
    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect x="5" y="5" width="50" height="50" rx="8" fill="%235B5B66" stroke="%2322222A" stroke-width="4"/></svg>';
    return;
  }
  
  imgElement.dataset.fallbackAttempted = 'true';
  
  // Extract parent part number by stripping trailing alphabetical character suffixes (e.g. "3062b" -> "3062")
  const parentPartNum = partNum.replace(/[a-zA-Z]+$/, '');
  
  const bucket = BUCKET_NAME.includes('[yourname]') ? 'brickedup-training-data-user' : BUCKET_NAME;
  const fallbackUrl = `https://${bucket}.s3.amazonaws.com/backup-icons/${parentPartNum}.png`;
  
  console.log(`BrickLink image failed to load for part ${partNum}. Falling back to S3 backup: ${fallbackUrl}`);
  
  // Asynchronously swap source
  imgElement.src = fallbackUrl;
}

// Bind to window context if running in browser to support direct inline HTML onerror handlers
if (typeof window !== 'undefined') {
  window.fallbackToS3 = fallbackToS3;
}
