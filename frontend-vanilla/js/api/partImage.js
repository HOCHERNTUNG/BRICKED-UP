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
  // Preference order, best first:
  //   BrickLink photo  real part, right colour - but a third-party hotlink
  //   generated SVG    right colour, approximate shape; only exists for the
  //                    handful of shapes the renderer can actually draw
  //   label image      exact geometry for every known part number, but line
  //                    art with no colour - the catch-all as the catalogue grows
  const chain = [
    part?.reference_image_url,
    part?.fallback_image_svg,
    part?.label_image_url
  ].filter(Boolean);

  if (chain.length === 0) return `src="" alt="${escapeAttr(alt)}"`;

  // Walk the remaining sources on each failure rather than giving up after
  // one. The SVG is a data: URI so it needs no network and cannot itself
  // 404, which makes it a safe place for the chain to come to rest.
  const rest = chain.slice(1).map(encodeForAttr);
  const onerror = rest.length
    ? ` onerror="${buildFallbackChain(rest)}"`
    : '';

  return `src="${chain[0]}"${onerror} alt="${escapeAttr(alt)}"`;
}

function buildFallbackChain(sources) {
  // Each step installs the next one, so a broken hotlink degrades to the SVG,
  // and a missing SVG degrades to the label.
  let handler = 'this.onerror=null;';
  for (let i = sources.length - 1; i >= 0; i--) {
    handler = i === sources.length - 1
      ? `this.onerror=null; this.src='${sources[i]}';`
      : `this.onerror=function(){${handler}}; this.src='${sources[i]}';`;
  }
  return handler;
}

// The SVG data URI is encodeURIComponent output, which leaves ' unescaped,
// and these handlers are delimited by single quotes.
function encodeForAttr(url) {
  return String(url).replace(/'/g, '%27');
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
