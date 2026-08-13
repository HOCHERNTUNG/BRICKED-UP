// js/api/imagePrep.js
//
// Normalise any picked image to a JPEG before uploading.
//
// Three problems this solves at once:
//
//  1. Signature mismatch. The pre-signed upload URL is signed with
//     Content-Type "image/jpeg" as part of SignedHeaders. The browser sets
//     Content-Type from the file itself, so a PNG uploaded as image/png made
//     S3 reject the PUT with SignatureDoesNotMatch. Converting first means
//     the header always matches what was signed.
//  2. Unsupported formats. iPhones hand over HEIC, which Rekognition cannot
//     read at all. Drawing to a canvas and re-encoding produces a JPEG
//     regardless of what came in.
//  3. Size. A modern phone photo is 3-6MB and 4000px wide. Rekognition gains
//     nothing from that, and it makes the upload slow on venue wifi.
//     Downscaling to 1600px keeps plenty of detail for shape recognition.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.9;

/** The exact type the upload URL is signed for. Keep in step with scanner_upload_url.py. */
export const UPLOAD_CONTENT_TYPE = 'image/jpeg';

/**
 * Convert any image File/Blob into a downscaled JPEG Blob.
 * Falls back to the original file if decoding fails, so an odd format still
 * gets an attempt rather than blocking the user outright.
 * @param {File|Blob} file
 * @returns {Promise<Blob>}
 */
export async function toUploadableJpeg(file) {
  try {
    const bitmap = await loadBitmap(file);

    let { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // White backdrop: JPEG has no alpha, and without this a transparent PNG
    // would flatten onto black and wreck the colour sampling.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (bitmap.close) bitmap.close();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, UPLOAD_CONTENT_TYPE, JPEG_QUALITY)
    );
    return blob || file;
  } catch (err) {
    console.warn('Image conversion failed, uploading original:', err);
    return file;
  }
}

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation: 'from-image' applies the EXIF rotation tag.
    //
    // Phone cameras record the sensor image plus an orientation tag rather
    // than rotating the pixels; six of nine test photos from a real phone
    // carried orientation 6 (rotate 90 degrees). The default here has varied
    // across browser versions, so an upload could arrive at the classifier
    // lying on its side. Shape training includes quarter-turns, so this was
    // survivable for classification, but it also rotated the segmentation's
    // idea of where the image borders are - and the preview the user saw did
    // not match the bytes being scanned.
    return createImageBitmap(file, { imageOrientation: 'from-image' })
      .catch(() => createImageBitmap(file));
  }
  // Safari fallback
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
