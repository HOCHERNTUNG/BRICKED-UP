// js/hooks/toast.js
//
// Brief confirmation messages. Adding a part used to happen silently - the
// panel just closed - which left the user unsure whether anything had been
// saved, especially when the inventory panel was minimised or scrolled away.

const HOST_ID = 'bu-toast-host';
const DEFAULT_MS = 2600;

function host() {
  let el = document.getElementById(HOST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = HOST_ID;
    el.className = 'bu-toast-host';
    // Appended to <body>, not #app: the app root is re-rendered wholesale on
    // every state change, which would tear a toast out mid-animation.
    document.body.appendChild(el);
  }
  return el;
}

/**
 * @param {string} message
 * @param {{duration?: number}} [opts]
 */
export function showToast(message, opts = {}) {
  const el = document.createElement('div');
  el.className = 'bu-toast';
  el.setAttribute('role', 'status');       // announced by screen readers
  el.innerHTML = `<span class="bu-toast-dot"></span><span></span>`;
  el.lastElementChild.textContent = message;   // textContent: never inject markup
  host().appendChild(el);

  const ms = opts.duration || DEFAULT_MS;
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }, ms);
}

/** "1 part" / "3 parts" - avoids "1 parts" in the confirmation text. */
export function pluralParts(n) {
  return `${n} part${n === 1 ? '' : 's'}`;
}
