# BRICKED-UP Vanilla Frontend

## Overview
`frontend-vanilla` is the original vanilla JavaScript web application for the BRICKED-UP project. It provides an interactive LEGO parts scanning experience, inventory management, build idea recommendations, and a polished, brick-inspired UI built without frameworks.

This folder contains:
- `index.html` — core application shell and stylesheet includes
- `css/` — vanilla application styles, including tokens, panels, auth screen, and workspace layout
- `js/` — application logic and UI rendering code
- `assets/` — static image and icon assets used by the app
- `build.js` — simple bundling script to prepare `frontend-vanilla-bundle`
- `tests/` — lightweight regression tests for critical UI expectations

## Application Structure

### Entry point
- `js/app.js`
  - Initializes the app, loads the current user session, and chooses between the auth screen and workspace.
  - Uses a global state subscription model to re-render UI portions when application state changes.
  - Handles the `Ctrl+Shift+H` shortcut to toggle the HCT baseplate pattern in the workspace.

### State management
- `js/hooks/state.js`
  - Maintains global app state: user session, workspace panels, theme, stud style, inventory refresh key, and HCT pattern toggle.
  - Exposes helper methods such as `setUser`, `setTheme`, `setStudStyle`, `toggleHctPattern`, `toggleSettings`, `openAllPanels`, and `notify`.
  - `computeDefaultPanels` defines default panel sizes and positions for scanner, inventory, and build ideas.

### Auth UI
- `js/components/auth.js`
  - Renders the sign-in/sign-up screen with a canvas-based warp tunnel background animation.
  - Supports both sign-in and sign-up flows with validation, result messages, and password show/hide toggling.
  - Uses `initBrickTunnelAnimation` to draw an animated LEGO brick tunnel background on a full-screen canvas.
  - The auth screen no longer exposes HCT shortcut branding directly.

### Workspace UI
- `js/components/workspace.js`
  - Renders the main workspace layout with draggable panels, the action bar, and a baseplate background.
  - Mounts scanner, inventory, and build ideas panels dynamically based on current state.
  - Applies `data-theme`, `data-studs`, and `hct-pattern-active` classes to the workspace container to drive visual styles.
  - Includes a floating logo button and profile slide-out menu.

### Panel system
- `js/components/panel.js`
  - Creates draggable and collapsible panels with LEGO-inspired chrome and studs.
  - Handles drag operations, snapping, and panel stacking.
  - Prevents drag interactions from interfering with buttons, inputs, and other interactive widgets inside panels.

### Inventory
- `js/components/inventory.js`
  - Renders the inventory panel UI, item list, filtering controls, and manual add button.
  - Supports quantity adjustment, deletion, and real-time list refresh.
  - Includes a delete confirmation prompt before removing an inventory item.

### Scanner and Builds
- `js/components/scanner.js`
  - Builds the LEGO part scanning UI and upload pipeline controls.
- `js/components/builds.js`
  - Renders build idea cards and build detail views.

### API layer
- `js/api/` contains basic API wrappers and mock data for development:
  - `auth.js` — sign-in/sign-up/auth session functions
  - `inventory.js` — inventory CRUD API wrappers
  - `builds.js` — build idea data
  - `fixtures.js` — mock inventory data and helper factories

## Styling
- `css/tokens.css` — design tokens and CSS variables for colors, fonts, spacing, and effects
- `css/global.css` — global reset, typography, base page styles, and common utility classes
- `css/workspace.css` — workspace canvas, baseplate stud patterns, and theme-specific backgrounds
- `css/panel.css` — panel chrome, studs, headers, and interaction styling
- `css/actionbar.css` — action bar and top toolbar styling
- `css/auth.css` — auth screen layout, form styles, and input controls
- `css/components.css` — reusable component styles, buttons, cards, and visual helpers

## Build process
- `build.js`
  - Copies CSS and assets to `frontend-vanilla-bundle`
  - Processes `index.html` to remove `type="module"` from the script tag
  - Uses `esbuild` to bundle `js/app.js` into `frontend-vanilla-bundle/js/app.js`
  - Keeps the bundle self-contained for deployment or static hosting

## How to run
1. Open `frontend-vanilla/index.html` in a browser for development.
2. Run `node build.js` from the `frontend-vanilla` folder to regenerate the bundled output in `frontend-vanilla-bundle`.
3. Serve `frontend-vanilla-bundle` from a static host if needed.

## Notes
- `Ctrl+Shift+H` toggles a subtle HCT-themed workspace pattern in the rendered workspace.
- The auth screen animation uses canvas rendering, so the browser must support Canvas APIs.
- The app uses a state subscription model instead of a framework for reactive rendering.

## Recent Fixes
- Removed HCT branding text from the auth screen.
- Fixed delete confirmation handling so the prompt appears immediately and does not wait on async flow.
- Ensured `frontend-vanilla-bundle` is rebuilt after updates.
