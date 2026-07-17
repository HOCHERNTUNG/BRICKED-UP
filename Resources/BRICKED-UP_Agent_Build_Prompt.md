# BRICKED-UP — Agent Build Prompt

**Paste this entire document as your instructions to a coding agent (e.g. Claude Code) to scaffold the BRICKED-UP frontend.** It is self-contained: the agent should not need any other file to start, though it may also be given the companion "BRICKED-UP Implementation Master Guide.docx" for deeper background. Follow every section — this prompt encodes both the product vision and the technical constraints needed for the result to satisfy the Temasek Polytechnic CAI2C09 Project Specifications and marking rubrics, and to plug cleanly into a real AWS backend later without a rewrite.

---

## 0. Mission

Build **BRICKED-UP**: a single-page web app where a user photographs LEGO bricks, gets them identified, catalogues them into a personal inventory, and sees which "build ideas" they have enough parts for. The interface is not a conventional stacked page — it is a **freeform workspace of draggable, resizable panels that snap to a LEGO-stud grid**, with a pill-shaped **action bar that docks to whichever screen edge it's dragged near**. This panel-workspace interaction is the single most important, most graded, most original part of this build — spend your care there first.

Right now you are building **Deliverable 1 only**: a visually complete, fully interactive frontend running entirely on mocked data. No real AWS calls. Every network call must nonetheless be written as a real, isolated async function with the exact name and return shape specified in Section 6, so that swapping mock bodies for real `fetch()` calls later is a one-line change per function, not a rewrite.

Treat this as an **original, personal, portfolio-quality product** — not a generic admin dashboard template. Avoid anything that reads as a stock AI-generated layout (centered hero + three feature cards + cream/terracotta palette, or a near-black page with one neon accent). The signature element of this design is the panel-snap workspace itself; let everything else stay quiet and disciplined around it.

---

## 1. Non-negotiable constraints

1. **No backend calls.** All data comes from mock functions that return `Promise`s resolving after a short simulated delay (300–1200ms), from fixed local data. No `fetch()` to any real external endpoint.
2. **Function names/shapes must match Section 6 exactly.** A future phase deletes only the *inside* of these functions.
3. **Must build cleanly for static hosting on Amazon S3 behind CloudFront** (Section 9): relative asset paths, no server-only APIs (no Node `fs`, no server components), a single `index.html` entry, hash-free client routing (or no routing library at all — this app is one page with panels, it does not need a router).
4. **No hardcoded secrets, ever** — not even fake ones. If you need a placeholder API key for a mock, name it clearly as a placeholder and read it from an env variable, never inline it.
5. **Original code.** Do not copy boilerplate from generic admin/dashboard templates. Every component here should look and behave like it was designed specifically for this product.
6. **Accessible by default.** Visible keyboard focus states, reduced-motion respected (`prefers-reduced-motion`), sufficient color contrast, alt text on meaningful images.

---

## 2. Tech stack & setup

- **Vite + React 18**, functional components and hooks only (no class components).
- **react-rnd** for the low-level draggable/resizable primitive — wrap it, don't use its default snap behavior; implement the exact 32px snap math in Section 5.
- Plain **CSS** (CSS Modules or a single well-organised set of stylesheets) implementing the design tokens in Section 4 as CSS custom properties. Do not pull in a heavy component library (no MUI/Ant/Chakra) — this product's whole point is a bespoke interaction model that off-the-shelf component kits fight against.
- No TypeScript requirement either way — use it if you're faster in it, plain JS is equally fine.

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-rnd clsx
```

Folder structure to produce:

```
frontend/
  src/
    main.jsx
    App.jsx
    styles/
      tokens.css        (CSS custom properties from Section 4)
      global.css
    components/
      Workspace/         (dot-grid background + panel host + z-order state)
      Panel/              (base draggable/resizable panel chrome + snap logic)
      ActionBar/          (docking action bar)
      Scanner/            (Scanner Panel)
      Inventory/          (Inventory Panel)
      BuildIdeas/         (Build Ideas Panel + Build Detail)
      Auth/               (Sign in / Sign up screens)
      common/             (Button, Card, ProgressBar, EmptyState, ErrorState, Spinner)
    api/
      client.js           (shared config: API_BASE_URL, auth header helper — see Section 7/8)
      scanner.js           (uploadImage, scanBrick, scanBatch)
      inventory.js          (getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem)
      builds.js             (getBuilds, getBuildDetail)
      auth.js                (signUp, signIn, signOut, getCurrentUser)
      mockData/               (fixed JSON used only by the mock implementations)
    hooks/
      usePanels.js          (panel position/size/z-order/open-closed state, persisted in-memory)
      useSnap.js             (the 32px snap-to-grid math, shared by Panel and ActionBar)
  index.html
  package.json
  vite.config.js
```

---

## 3. The concept, restated precisely

- Users sign in, land on an empty **workspace**: a large scrollable/zoomable canvas with a subtle dot-grid background (the "LEGO baseplate").
- An **action bar** (a dark pill) floats over the workspace, initially docked to the bottom edge, centred. It has icon buttons: **Scan**, **Inventory**, **Build Ideas**, **Profile**. Tapping one opens (or focuses) the matching panel.
- **Panels** are floating cards with a colored header (title + collapse + close), a bordered body, and a resize handle at the bottom-right corner. Users drag by the header and resize by the handle; both **snap to a 32px grid** on release, with a faint "ghost" outline shown while dragging to telegraph the snap target.
- The **Scanner panel**: capture/upload a brick photo → simulated "scanning…" state → a result card (or a short list of result cards — see the note at the end of Section 5) showing the identified part, a confidence score, and **Add to bin** / **Rescan** actions.
- The **Inventory panel**: a responsive grid/list of owned pieces with quantity badges, a running total, and simple filter/search. Its internal layout must reflow based on the panel's *current* width/height, not the viewport — this is graded as part of "internal layout responsive to whatever size it's been set to."
- The **Build Ideas panel**: cards per build idea showing "% of parts owned," opening into a **Build Detail** view listing every required part with an owned/needed indicator.
- **Auth screens**: sign-in / sign-up forms, validated client-side, gating access to the workspace.

---

## 4. Design tokens (implement as CSS custom properties)

```css
:root {
  /* Color */
  --ink-900:   #22222A;   /* top bar, panel borders, primary text, docked action bar */
  --cream-100: #F6F1E4;   /* workspace background */
  --dot-grid:  #DCD4C0;   /* background stud pattern, low contrast on cream-100 */
  --brick-red:    #D01012; /* primary accent — important actions, Scanner header */
  --brick-yellow: #FFD500; /* highlight accent — logo mark, active/selected states */
  --brick-blue:   #0057A6; /* Inventory header, informational accents */
  --brick-green:  #1E7A34; /* success, "add to bin" confirm, progress fills */
  --brick-purple: #5E1E9A; /* Build Ideas accent, tags/badges */
  --grey-600: #5B5B66;    /* secondary/help text */
  --white:    #FFFFFF;

  /* Type */
  --font-display: "Baloo 2", "Nunito", system-ui, sans-serif;  /* headings, panel titles, action bar */
  --font-body: "Inter", system-ui, sans-serif;                  /* dense text: inventory lists, forms */

  /* Grid & spacing */
  --grid-unit: 8px;
  --snap-unit: 32px;       /* panel position/size snap increment — matches dot spacing */
  --dot-spacing: 32px;

  /* Radius */
  --radius-panel: 22px;
  --radius-card: 14px;
  --radius-pill: 999px;

  /* Motion */
  --snap-ease: 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

Panel border style: **"thicc" LEGO border** — flat color, 3–4px solid `--ink-900` (or the panel's accent color), `--radius-panel` corners, no gradients/bevels, paired with a soft `box-shadow` (`0 6px 20px rgba(34,34,42,0.15)`). This chunky-but-flat treatment is the deliberate "modern toy" signature — do not soften it into a generic SaaS card style.

Dot-grid background: a repeating pattern of small circles (`--dot-grid` color, ~3–4px radius) spaced at `--dot-spacing`, low enough contrast against `--cream-100` that it reads as a guide, not noise. Implement with a CSS `radial-gradient` repeating background — no image asset needed:

```css
.workspace {
  background-color: var(--cream-100);
  background-image: radial-gradient(var(--dot-grid) 1.6px, transparent 1.6px);
  background-size: var(--dot-spacing) var(--dot-spacing);
}
```

Respect `prefers-reduced-motion: reduce` by disabling the snap-ease transition and any decorative animation for users who request it.

---

## 5. Panel & action bar interaction spec (the core engineering task)

### Panel drag/resize/snap

- Wrap `react-rnd` per panel. On `onDragStop(e, data)` and `onResizeStop(e, dir, ref, delta, position)`, round `x`, `y`, `width`, `height` to the nearest multiple of `var(--snap-unit)` (32) **before** committing to React state — this rounding *is* the entire snap mechanic, keep it in one small shared `useSnap.js` hook so Panel and ActionBar both use identical math:

```js
export function snapToGrid(value, unit = 32) {
  return Math.round(value / unit) * unit;
}
```

- While dragging (not yet released), render a low-opacity outline at the *would-snap-to* position so the snap feels intentional (a "magnetic" affordance), using the same `snapToGrid` call on the live drag position.
- Enforce a minimum panel size (e.g. 280×220px, itself a multiple of 32) so content never collapses unusably.
- Clicking/starting a drag on any panel brings it to the front (highest z-index) — track z-order centrally in `usePanels.js`, not per-component.
- Each panel header has a **collapse** control (minimize to just the title bar, click again to restore) and a **close** control (removes it from the workspace; reopen via the action bar).
- Panel state shape (per panel id) to keep in `usePanels.js`: `{ id, x, y, width, height, zIndex, isOpen, isCollapsed }`. In-memory React state is sufficient for Deliverable 1; do not implement browser storage for this (see Section 1's secrets rule, and note `localStorage`/`sessionStorage` should be avoided generally, so keep this in plain React state).

### Action bar docking

- The action bar is draggable by its whole body (it's small). On release, compute distance from the drop point to each of the four workspace edges and dock to the nearest one, animating into place with `--snap-ease`.
- When docked top/bottom, lay out icons in a horizontal row; when docked left/right, switch to a vertical column. This reflow must actually change the flex direction, not just visually rotate.
- Tapping an icon opens its panel at a sensible default position if closed, or brings it to front if already open.

### Forward-compatibility note for the Scanner result

Build the Scanner Panel's result state as **a list of 1 or more result cards**, not a single hardcoded card, even though the mock in Deliverable 1 will usually resolve to a list of length 1. A possible later backend enhancement scans several bricks from one photo at once; designing the list-of-N shape now means zero UI rework if that lands. Each result card independently supports **Add to bin** / **discard**, and a bulk **Add all** action above the list when there's more than one candidate.

---

## 6. Mock data contracts — implement exactly these shapes

Every function below lives in `src/api/*.js`, returns a `Promise`, and resolves to **exactly this shape**. A later phase will replace only the function body (swap the mock resolution for a real `fetch()` call) — the calling code in your components must never need to change.

```js
// src/api/scanner.js

// Request a place to upload a photo. Real version: presigned S3 URL from Lambda.
// Mock: resolve a fake URL/key pair after a short delay.
export async function getUploadUrl(fileName) {
  // -> { uploadUrl: string, key: string }
}

// Upload the actual file bytes. Real version: PUT to the presigned URL.
// Mock: resolve true after a short delay, ignore the bytes.
export async function uploadImage(uploadUrl, file) {
  // -> { success: true }
}

// Classify one uploaded photo. Real version: Lambda calls Rekognition Custom Labels.
export async function scanBrick(key) {
  // -> {
  //   label: string,            // e.g. "2x4_brick_red"
  //   confidence: number,       // 0-100
  //   part: {
  //     part_id: number,
  //     part_name: string,      // e.g. "2x4 Brick"
  //     category: string,
  //     reference_image_url: string
  //   }
  // }
}

// Optional multi-brick variant (Section 3.6 of the Master Guide). Same shape, N results.
export async function scanBatch(key) {
  // -> { candidates: Array<{ boxIndex: number, label: string, confidence: number, part: {...} }> }
}
```

```js
// src/api/inventory.js

export async function getInventory() {
  // -> Array<{
  //   inventory_id: number,
  //   part_id: number,
  //   part_name: string,
  //   reference_image_url: string,
  //   category: string,
  //   quantity: number,
  //   date_added: string,        // ISO date
  //   source_image_key: string | null
  // }>
}

export async function addInventoryItem({ part_id, quantity, source_image_key }) {
  // -> the created inventory row (same shape as one element of getInventory())
}

export async function updateInventoryItem(inventory_id, { quantity }) {
  // -> the updated inventory row
}

export async function deleteInventoryItem(inventory_id) {
  // -> { success: true }
}
```

```js
// src/api/builds.js

export async function getBuilds() {
  // -> Array<{
  //   build_id: number,
  //   build_name: string,
  //   description: string,
  //   difficulty: 'Easy' | 'Medium' | 'Hard',
  //   hero_image_url: string,
  //   pct_owned: number          // 0-100
  // }>
}

export async function getBuildDetail(build_id) {
  // -> {
  //   build_id: number, build_name: string, description: string,
  //   difficulty: string, hero_image_url: string,
  //   parts: Array<{ part_id: number, part_name: string, reference_image_url: string,
  //                  quantity_required: number, quantity_owned: number }>
  // }
}
```

```js
// src/api/auth.js — UI-only for Deliverable 1, shaped to match a future Cognito integration

export async function signUp({ email, password, displayName }) {
  // -> { userSub: string }  (mock: return a fake uuid)
}

export async function signIn({ email, password }) {
  // -> { idToken: string, user: { user_id: string, email: string, display_name: string } }
  // mock: accept any well-formed input, "log in" instantly after the simulated delay
}

export async function signOut() {
  // -> { success: true }
}

export async function getCurrentUser() {
  // -> user object or null — mock: read from an in-memory module-level variable set by signIn/signOut
}
```

Put realistic, varied fixture data in `src/api/mockData/` (≥10 inventory items across several categories, 3–4 builds with different `pct_owned` values including at least one at 100%, a handful of scan results with varying confidence) — believable data makes the UI genuinely easier to evaluate and demo.

---

## 7. Auth abstraction (so Cognito slots in later without a rewrite)

Never call `signIn`/`signUp`/`signOut`/`getCurrentUser` directly from components — go through a small `AuthProvider` React context that wraps `src/api/auth.js` and exposes `{ user, signIn, signUp, signOut, isLoading }`. When Phase 4 (real AWS) replaces the mock bodies with real Amazon Cognito calls, only `src/api/auth.js` changes; `AuthProvider` and every component using it stay untouched. Every panel/component that needs "the current user" reads it from this context, never by re-implementing its own auth state.

---

## 8. Config for the future AWS swap

Add a single `src/api/client.js` that centralises what changes when this app goes from mocked to live:

```js
// src/api/client.js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const IS_MOCKED = import.meta.env.VITE_USE_MOCKS !== 'false';

export function authHeader(idToken) {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}
```

Every `src/api/*.js` file should branch on `IS_MOCKED` at the top of each exported function (mock body vs. a `fetch(`${API_BASE_URL}/...`, { headers: authHeader(...) })` real body), even though only the mock branch needs to work correctly right now. This means Phase 4 of the Master Guide is "flip an env var and fill in fetch calls," not "find every place a mock was used." Create a `.env.example` documenting `VITE_API_BASE_URL` and `VITE_USE_MOCKS`.

---

## 9. Deployment readiness (must hold even though you won't deploy yet)

- `vite.config.js`: keep `base: './'` (relative asset paths) so the built app works when served from any S3/CloudFront path, not just the domain root.
- Production build is `npm run build` → static output in `dist/` → this is what later gets synced to S3. Confirm `npm run build && npx serve dist` (or equivalent) works and the app loads correctly from the built output, not just from the Vite dev server.
- No server-side rendering, no Node-only APIs (`fs`, `path`, etc.) anywhere in `src/`.
- This is a single logical "page" (the workspace) with panels toggling visibility/focus — do not add a routing library; it adds SPA-refresh/CloudFront-error-page complexity (documented in the Master Guide §8.6) for no benefit here.
- All images referenced in mock data should be either bundled assets or externally hosted URLs (e.g. placeholder image services) — never `file://` or localhost-only paths.

---

## 10. Accessibility & responsiveness floor

- Every interactive element (panel drag handle, resize handle, action bar buttons, form fields, buttons) has a visible `:focus-visible` outline using `--brick-yellow` or `--ink-900` at sufficient contrast.
- Respect `prefers-reduced-motion`: skip/shorten the snap-ease transition and any panel-open animation.
- Test the workspace at a narrow (~375px) and a wide (~1440px) viewport: panels should remain usable (stack/scroll sensibly on narrow, keep sensible default sizes on wide), and the Inventory panel's internal grid should visibly reflow when a panel is resized narrow vs. wide.
- Every panel has loading, empty, and error states — write error copy in the interface's own voice ("Couldn't load your inventory. Try again." with a retry action), never a raw stack trace or "undefined."

---

## 11. Acceptance checklist — verify all of this before calling it done

Rubric line items this build is graded against (Deliverable 1, 10%):

- [ ] Aesthetically distinctive, cohesive design that doesn't read as a generic template — the dot-grid workspace and chunky panel borders are visibly, deliberately "BRICKED-UP," not a reskinned admin dashboard.
- [ ] Every panel drags and resizes, snapping crisply to the 32px grid, with a visible snap-target ghost while dragging.
- [ ] Action bar docks correctly to all four edges and its icon layout actually reflows orientation.
- [ ] Scanner → mock "scanning…" → result card(s) → Add to bin works, with Rescan and (if list length > 1) Add all.
- [ ] Inventory panel shows mock data, reflows its internal grid when the panel is resized, and has working search/filter.
- [ ] Build Ideas panel shows mock `pct_owned` per build and opens a working Build Detail view.
- [ ] Auth screens gate the workspace, validate input, and route through the `AuthProvider` context described in Section 7.
- [ ] Every panel has real loading/empty/error states, not just a happy path.
- [ ] No console errors on load or during normal interaction.
- [ ] `npm run build` succeeds and the built `dist/` output runs correctly when served statically.
- [ ] Nothing is hardcoded that should be config (`API_BASE_URL` via env, no secrets anywhere).
- [ ] Code contains zero leftover boilerplate comments/branding from `create vite` or any starter template.

---

## 12. What not to do

- Don't reach for Tailwind/MUI/Bootstrap "for speed" — this product's differentiation is the bespoke panel-snap interaction and LEGO-inspired chrome; generic component kits actively fight that.
- Don't call any real AWS endpoint, even "just to test" — Deliverable 1 is explicitly graded as mock-only, and a stray real call is also a stray untracked cost later.
- Don't skip the `src/api/*.js` isolation "just this once" by calling mock data directly from a component — that shortcut is exactly what makes the later AWS-wiring phase painful.
- Don't implement browser `localStorage`/`sessionStorage` for panel layout or auth state — keep it in React state for now.
- Don't add a client-side router — there is exactly one workspace view with panels.
- Don't hand back a single component containing everything — follow the file structure in Section 2 so each panel is independently reviewable and extensible.

---

## 13. When it's time to wire up real AWS (Phases 2–5)

This section is for later — do not act on it until the Deliverable 1 build above is complete and approved. It exists so the same agent (or a future session) has the full picture without needing to re-derive it.

- Real endpoints will be an **Amazon API Gateway REST API** in front of **AWS Lambda** functions named `get-upload-url`, `scan-brick`, `scan-batch` (optional), `inventory-crud`, `builds-query` — one Lambda per concern, matching Section 6's function groupings 1:1.
- Auth becomes **Amazon Cognito**: `signUp`/`signIn` call the Cognito SDK (or Hosted UI) instead of returning mock tokens; `idToken` becomes a real JWT that `authHeader()` (Section 8) already knows how to attach.
- Image upload becomes a real **S3 pre-signed URL** flow: `getUploadUrl` calls the real API, `uploadImage` does a real `PUT` to that URL — the calling code in the Scanner panel does not change at all.
- `scanBrick` calls a Lambda that runs **Amazon Rekognition Custom Labels** against the uploaded image and looks up the result in **Amazon RDS (MySQL)**.
- The production build (`dist/`) gets synced to a private **Amazon S3** bucket served through **Amazon CloudFront** (Origin Access Control, HTTPS by default) — this is exactly why Section 9's relative-path and no-router constraints matter now, before that's a problem to debug.
- Full architecture, database schema, Lambda pseudocode and step-by-step AWS console instructions are in the companion "BRICKED-UP — Implementation Master Guide" document, Sections 5, 6, 8.3–8.6, and Appendices A–B.

*This prompt is the Phase 1 companion to that guide (see its Section 8.2 for the day-by-day schedule this build should fit into, and Section 7 for the fuller design rationale).*
