// js/api/partImage.js
//
// Part artwork comes from two sources, and both need handling:
//
//   reference_image_url  a BrickLink catalogue hotlink. Real photography, but
//                        a third-party dependency: it can rate-limit, move or
//                        be briefly unreachable. Seeded rows have one.
//   fallback_image_svg   a locally generated SVG data URI. Needs no network
//                        request, so it can never itself fail to load - which
//                        is what makes it a safe terminal fallback. Every row
//                        has one, including rows created at scan time.
//
// Rendering reference_image_url on its own produces src="null" and a broken
// image icon for any part without a hotlink. This helper picks the best
// available source up front and still guards the hotlink with onerror.

/**
 * Attribute string for an <img> inside a template literal.
 * @param {object} part - needs reference_image_url and/or fallback_image_svg
 * @param {string} alt
 * @returns {string} src, onerror and alt attributes, ready to interpolate
 */
export function partImageAttrs(part, alt = '') {
  const fallback = part?.fallback_image_svg || '';
  const primary = part?.reference_image_url || fallback;

  // The data URI is encodeURIComponent output, which leaves ' unescaped -
  // and the onerror handler below is delimited by single quotes. Re-encode
  // just that character so the attribute cannot be broken out of.
  const safeFallback = fallback.replace(/'/g, '%27');

  const escAlt = String(alt).replace(/"/g, '&quot;');
  const onerror = safeFallback
    ? ` onerror="this.onerror=null; this.src='${safeFallback}';"`
    : '';

  return `src="${primary}"${onerror} alt="${escAlt}"`;
}
