// js/hooks/lightbox.js
//
// Full-size view of a single image.
//
// Build hero images are shown at card size, which is too small to judge what
// a model actually looks like - the thing a user is deciding on when they
// browse Build Ideas. Rather than grow the cards and fit fewer per panel,
// any image can be opened at the size the viewport allows.
//
// Lives outside #app so it survives the panel re-renders that happen whenever
// inventory changes, and is dismissed by click-away, the close button or
// Escape. The listeners are bound on open and removed on close, so the
// popover cannot outlive the thing it belongs to - the same mistake that once
// stranded the inventory colour filter permanently open.

let openEl = null;

export function openLightbox(src, caption) {
  closeLightbox();
  if (!src) return;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', caption || 'Image');
  box.innerHTML = `
    <div class="lightbox-inner">
      <button type="button" class="lightbox-close font-display" aria-label="Close">&times;</button>
      <img class="lightbox-img" src="${src}" alt="${escapeAttr(caption || '')}" />
      ${caption ? `<div class="lightbox-caption font-display">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
  document.body.appendChild(box);
  openEl = box;

  const onKey = (e) => { if (e.key === 'Escape') closeLightbox(); };
  // Click-away, but only on the backdrop - clicking the picture itself should
  // not dismiss the thing you opened to look at.
  const onDown = (e) => { if (e.target === box) closeLightbox(); };
  box._cleanup = () => {
    document.removeEventListener('keydown', onKey);
    box.removeEventListener('mousedown', onDown);
  };
  document.addEventListener('keydown', onKey);
  box.addEventListener('mousedown', onDown);
  box.querySelector('.lightbox-close').onclick = closeLightbox;
  box.querySelector('.lightbox-close').focus();
}

export function closeLightbox() {
  if (!openEl) return;
  if (openEl._cleanup) openEl._cleanup();
  openEl.remove();
  openEl = null;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
