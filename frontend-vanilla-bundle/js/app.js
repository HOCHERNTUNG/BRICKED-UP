(() => {
  // js/api/client.js
  var IS_MOCKED = false;
  var API_BASE_URL = "https://w45s12yx64.execute-api.ap-southeast-1.amazonaws.com/prod";
  var STORE_KEY = "brickedup.session";
  var REFRESH_MARGIN_MS = 5 * 60 * 1e3;
  var activeToken = null;
  var refreshToken = null;
  var expiresAt = 0;
  var cachedUser = null;
  var inFlightRefresh = null;
  function persist() {
    try {
      if (!activeToken) {
        sessionStorage.removeItem(STORE_KEY);
        return;
      }
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        idToken: activeToken,
        refreshToken,
        expiresAt,
        user: cachedUser
      }));
    } catch (_) {
    }
  }
  function restoreSession() {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s.refreshToken && (!s.expiresAt || s.expiresAt <= Date.now())) {
        sessionStorage.removeItem(STORE_KEY);
        return null;
      }
      activeToken = s.idToken || null;
      refreshToken = s.refreshToken || null;
      expiresAt = s.expiresAt || 0;
      cachedUser = s.user || null;
      return cachedUser;
    } catch (_) {
      return null;
    }
  }
  function setActiveToken(token, opts = {}) {
    activeToken = token;
    if (opts.refreshToken !== void 0) refreshToken = opts.refreshToken;
    if (opts.expiresIn) expiresAt = Date.now() + opts.expiresIn * 1e3;
    if (opts.user !== void 0) cachedUser = opts.user;
    persist();
  }
  function clearSession() {
    activeToken = null;
    refreshToken = null;
    expiresAt = 0;
    cachedUser = null;
    persist();
  }
  async function ensureFreshToken() {
    if (IS_MOCKED || !activeToken || !refreshToken) return activeToken;
    if (expiresAt - Date.now() > REFRESH_MARGIN_MS) return activeToken;
    if (!inFlightRefresh) {
      inFlightRefresh = (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
          });
          if (!res.ok) throw new Error("refresh rejected");
          const data = await res.json();
          setActiveToken(data.idToken, { expiresIn: data.expiresIn });
          return activeToken;
        } catch (err) {
          clearSession();
          throw err;
        } finally {
          inFlightRefresh = null;
        }
      })();
    }
    return inFlightRefresh;
  }
  function authHeader(idToken) {
    const token = idToken || activeToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // js/api/auth.js
  var currentUser = null;
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function signUp({ email, password, displayName }) {
    if (!IS_MOCKED) {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      return await res.json();
    }
    await sleep(800);
    if (!email || !password || !displayName) {
      throw new Error("Please fill in all details");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const userSub = "usr_" + Math.random().toString(36).substr(2, 9);
    return { userSub };
  }
  async function signIn({ email, password }) {
    if (!IS_MOCKED) {
      const res = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }
      const result = await res.json();
      currentUser = result.user;
      setActiveToken(result.idToken, {
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user
      });
      return result;
    }
    await sleep(1e3);
    if (!email || !password) {
      throw new Error("Email and password are required");
    }
    if (!email.includes("@")) {
      throw new Error("Invalid email address");
    }
    const user_id = "usr_mocked_id_99";
    const display_name = email.split("@")[0];
    currentUser = {
      user_id,
      email,
      display_name: display_name.charAt(0).toUpperCase() + display_name.slice(1)
    };
    const idToken = "jwt_mocked_token_" + Math.random().toString(36).substr(2, 9);
    setActiveToken(idToken);
    return {
      idToken,
      user: currentUser
    };
  }
  async function signOut() {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      try {
        await fetch(`${API_BASE_URL}/auth/signout`, {
          method: "POST",
          headers: { ...authHeader() }
        });
      } catch (e) {
      }
      currentUser = null;
      clearSession();
      return { success: true };
    }
    await sleep(400);
    currentUser = null;
    setActiveToken(null);
    return { success: true };
  }
  async function getCurrentUser() {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      if (currentUser) return currentUser;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { ...authHeader() }
        });
        if (res.ok) {
          currentUser = await res.json();
          return currentUser;
        }
      } catch (e) {
      }
      return null;
    }
    await sleep(200);
    return currentUser;
  }

  // js/hooks/state.js
  function computeDefaultPanels() {
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const panelH = 566;
    const scannerW = 400;
    const inventoryW = 561;
    const buildsW = 384;
    const scannerH = panelH, inventoryH = panelH, buildsH = panelH;
    const totalW = scannerW + inventoryW + buildsW;
    const gap = 24;
    const totalWithGaps = totalW + gap * 2;
    let startX = Math.max(16, Math.floor((vw - totalWithGaps) / 2));
    let startY = Math.max(16, Math.floor((vh - Math.max(scannerH, inventoryH, buildsH)) / 2));
    return {
      scanner: {
        id: "scanner",
        name: "Scanner Panel",
        x: startX,
        y: startY,
        width: scannerW,
        height: scannerH,
        zIndex: 10,
        isOpen: true,
        isCollapsed: false,
        accentClass: "border-scanner"
      },
      inventory: {
        id: "inventory",
        name: "Inventory",
        x: startX + scannerW + gap,
        y: startY,
        width: inventoryW,
        height: inventoryH,
        zIndex: 10,
        isOpen: true,
        isCollapsed: false,
        accentClass: "border-inventory"
      },
      buildIdeas: {
        id: "buildIdeas",
        name: "Build Ideas",
        x: startX + scannerW + gap + inventoryW + gap,
        y: startY,
        width: buildsW,
        height: buildsH,
        zIndex: 10,
        isOpen: true,
        isCollapsed: false,
        accentClass: "border-builds"
      }
    };
  }
  var state = {
    user: null,
    idToken: null,
    isLoading: false,
    panels: computeDefaultPanels(),
    maxZIndex: 10,
    theme: "classic",
    studStyle: "circular",
    hctPatternEnabled: false,
    inventoryRefreshKey: 0,
    isSettingsOpen: false,
    snapEnabled: true,
    soundEnabled: true
  };
  var listeners = /* @__PURE__ */ new Set();
  function getState() {
    return state;
  }
  function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
  function notify(isPositionOnly = false) {
    listeners.forEach((cb) => cb(state, isPositionOnly));
  }
  function setUser(user, idToken = null) {
    state.user = user;
    state.idToken = idToken;
    notify();
  }
  function setIsLoading(loading) {
    state.isLoading = loading;
    notify();
  }
  function setTheme(newTheme) {
    state.theme = newTheme;
    notify();
  }
  function setStudStyle(newStyle) {
    state.studStyle = newStyle;
    notify();
  }
  function triggerInventoryUpdate() {
    state.inventoryRefreshKey++;
    notify();
  }
  function bringToFront(id) {
    let highestZ = 0;
    for (const key in state.panels) {
      if (state.panels[key].isOpen && state.panels[key].zIndex > highestZ) {
        highestZ = state.panels[key].zIndex;
      }
    }
    if (state.panels[id].zIndex >= highestZ && highestZ > 0) {
      return;
    }
    state.maxZIndex = highestZ + 1;
    state.panels[id].zIndex = state.maxZIndex;
    const panelDom = document.getElementById(`panel-${id}`);
    if (panelDom) {
      panelDom.style.zIndex = state.maxZIndex;
    }
  }
  function openPanel(id) {
    state.maxZIndex++;
    state.panels[id].isOpen = true;
    state.panels[id].zIndex = state.maxZIndex;
    notify();
  }
  function closePanel(id) {
    if (id.startsWith("standalone-")) {
      delete state.panels[id];
    } else {
      state.panels[id].isOpen = false;
    }
    notify();
  }
  function contrastTextFor(hex) {
    const h = String(hex || "").replace("#", "");
    if (h.length !== 6) return "var(--ink-900)";
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.45 ? "var(--ink-900)" : "#FFFFFF";
  }
  function resolveColorTag(item) {
    if (item && item.color_name) {
      return { label: item.color_name, hex: item.color_hex || null };
    }
    const parsed = parsePartNameAndColor(item && item.part_name);
    return { label: parsed.color, hex: null };
  }
  function parsePartNameAndColor(fullName) {
    if (!fullName) return { name: "Part", color: "Generic" };
    const match = fullName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      return {
        name: match[1],
        color: match[2]
      };
    }
    return {
      name: fullName,
      color: "Generic"
    };
  }
  function spawnStandalonePanel(type, data) {
    const rawId = data.build_id !== void 0 ? data.build_id : data.part_id || data.part_num || data.id || Math.random().toString(36).substr(2, 9);
    const cleanId = String(rawId).replace(/[^a-zA-Z0-9-]/g, "_");
    const id = `standalone-${type}-${cleanId}`;
    if (state.panels[id]) {
      state.panels[id].isOpen = true;
      bringToFront(id);
      notify();
      return;
    }
    const count = Object.keys(state.panels).filter((k) => k.startsWith("standalone-")).length;
    const x = 200 + count * 32 % 400;
    const y = 100 + count * 32 % 300;
    const width = type === "build" ? 420 : type === "addPart" ? 600 : 310;
    const height = type === "build" ? 480 : type === "addPart" ? 720 : 250;
    const accentClass = type === "build" ? "border-builds" : "border-inventory";
    const parsed = type === "part" ? parsePartNameAndColor(data.part_name) : null;
    const name = type === "build" ? `Build Reference: ${data.name}` : type === "addPart" ? "Add Piece Manually" : `${parsed ? parsed.name : "Part " + data.part_num}`;
    state.maxZIndex++;
    state.panels[id] = {
      id,
      type,
      name,
      data,
      x,
      y,
      width,
      height,
      zIndex: state.maxZIndex,
      isOpen: true,
      isCollapsed: false,
      accentClass
    };
    notify();
  }
  function togglePanel(id) {
    if (state.panels[id].isOpen) {
      closePanel(id);
    } else {
      openPanel(id);
    }
  }
  function toggleCollapse(id) {
    state.panels[id].isCollapsed = !state.panels[id].isCollapsed;
    notify();
  }
  function updatePanelGeometry(id, geom) {
    const panel = state.panels[id];
    if (!panel) return;
    if (geom.x !== void 0) panel.x = geom.x;
    if (geom.y !== void 0) panel.y = geom.y;
    if (geom.width !== void 0) panel.width = geom.width;
    if (geom.height !== void 0) panel.height = geom.height;
    notify(true);
  }
  function resetWorkspace() {
    state.panels = computeDefaultPanels();
    state.maxZIndex = 10;
    state.theme = "classic";
    state.studStyle = "circular";
    notify();
  }
  async function signOut2() {
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    } finally {
      resetWorkspace();
      setUser(null);
    }
  }
  function openAllPanels() {
    state.maxZIndex++;
    state.panels["scanner"].isOpen = true;
    state.panels["scanner"].zIndex = state.maxZIndex;
    state.panels["scanner"].isCollapsed = false;
    state.maxZIndex++;
    state.panels["inventory"].isOpen = true;
    state.panels["inventory"].zIndex = state.maxZIndex;
    state.panels["inventory"].isCollapsed = false;
    state.maxZIndex++;
    state.panels["buildIdeas"].isOpen = true;
    state.panels["buildIdeas"].zIndex = state.maxZIndex;
    state.panels["buildIdeas"].isCollapsed = false;
    notify();
  }
  function closeSettings() {
    state.isSettingsOpen = false;
    notify();
  }
  function toggleSettings() {
    state.isSettingsOpen = !state.isSettingsOpen;
    notify();
  }
  function toggleHctPattern() {
    state.hctPatternEnabled = !state.hctPatternEnabled;
    notify(true);
  }
  function toggleSnapEnabled() {
    state.snapEnabled = !state.snapEnabled;
    notify();
  }
  function toggleSoundEnabled() {
    state.soundEnabled = !state.soundEnabled;
    notify();
  }

  // js/components/auth.js
  var isSignUpMode = false;
  var authLoading = false;
  var authErrorMsg = null;
  var authSuccessMsg = null;
  var emailValue = "";
  var passwordValue = "";
  var displayNameValue = "";
  var activeCancelAnimation = null;
  var tunnelWarp = null;
  var WARP_CHARGE_MS = 780;
  var WARP_PEAK = 16;
  var WARP_OPEN_MS = 620;
  function playLoginTransition() {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      if (tunnelWarp) tunnelWarp(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "login-warp";
      overlay.innerHTML = '<span class="login-warp-core"></span>';
      document.body.appendChild(overlay);
      const core = overlay.firstElementChild;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        if (tunnelWarp) tunnelWarp(1);
        overlay.classList.add("is-clearing");
        setTimeout(() => overlay.remove(), 620);
        resolve();
      };
      const openAperture = () => {
        core.classList.add("is-opening");
        core.addEventListener("animationend", done, { once: true });
        setTimeout(done, WARP_OPEN_MS + 350);
      };
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / WARP_CHARGE_MS);
        const eased = t * t * t;
        if (tunnelWarp) tunnelWarp(1 + eased * (WARP_PEAK - 1));
        core.style.setProperty("--charge", String(eased));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          openAperture();
        }
      };
      requestAnimationFrame(step);
      setTimeout(done, WARP_CHARGE_MS + WARP_OPEN_MS + 700);
    });
  }
  function renderAuth(parentEl) {
    if (activeCancelAnimation) {
      activeCancelAnimation();
      activeCancelAnimation = null;
    }
    parentEl.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.className = "auth-bg-canvas";
    parentEl.appendChild(canvas);
    activeCancelAnimation = initBrickTunnelAnimation(canvas);
    const container = document.createElement("div");
    container.className = "auth-screen-container";
    const card = document.createElement("div");
    card.className = "brick-card auth-card";
    const cardBody = document.createElement("div");
    cardBody.className = "brick-card-body";
    const logo = document.createElement("div");
    logo.className = "auth-logo-section";
    logo.innerHTML = `
    <img src="assets/logo_name.png" alt="BRICKED-UP" class="auth-logo-image" style="max-height: 90px; width: auto; display: block; margin: 0 auto 20px auto;" />
    <p class="logo-subtitle font-display" style="font-size: 0.95rem; letter-spacing: 0.5px; opacity: 0.85;">LEGO Parts Scanner &amp; Bin Manager</p>
  `;
    cardBody.appendChild(logo);
    if (authLoading) {
      const spinner = document.createElement("div");
      spinner.className = "brick-spinner-container";
      spinner.innerHTML = `
      <div class="brick-stud-spinner">
        <div class="stud-spinner-top"></div>
        <div class="stud-spinner-body"></div>
      </div>
      <p class="brick-spinner-message font-display">${isSignUpMode ? "Building account..." : "Logging in..."}</p>
    `;
      cardBody.appendChild(spinner);
    } else {
      const form = document.createElement("form");
      form.className = "auth-form font-body";
      if (authErrorMsg) {
        const errBox = document.createElement("div");
        errBox.className = "auth-error font-display";
        errBox.textContent = authErrorMsg;
        form.appendChild(errBox);
      }
      if (authSuccessMsg) {
        const succBox = document.createElement("div");
        succBox.className = "auth-success font-display";
        succBox.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${authSuccessMsg}`;
        form.appendChild(succBox);
      }
      if (isSignUpMode) {
        form.appendChild(createInputGroup("Display Name", "text", "displayName", "MasterBuilder", displayNameValue, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`));
      }
      form.appendChild(createInputGroup("Email Address", "email", "email", "builder@lego.com", emailValue, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`));
      form.appendChild(createInputGroup("Password", "password", "password", "******", passwordValue, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`));
      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.className = "brick-btn brick-btn-primary auth-submit-btn font-display";
      submitBtn.textContent = isSignUpMode ? "Build Account" : "Sign In";
      form.appendChild(submitBtn);
      const togglePrompt = document.createElement("div");
      togglePrompt.className = "auth-toggle-prompt";
      togglePrompt.innerHTML = `
      <span>${isSignUpMode ? "Already a builder?" : "New to Bricked-Up?"}</span>
      <button type="button" class="auth-toggle-link font-display" id="auth-mode-toggle-link">
        ${isSignUpMode ? "Login Here" : "Create Account"}
      </button>
    `;
      form.appendChild(togglePrompt);
      form.onsubmit = async (e) => {
        e.preventDefault();
        authErrorMsg = null;
        authSuccessMsg = null;
        emailValue = form.querySelector('[name="email"]').value;
        passwordValue = form.querySelector('[name="password"]').value;
        if (isSignUpMode) {
          displayNameValue = form.querySelector('[name="displayName"]').value;
        }
        if (!emailValue || !passwordValue || isSignUpMode && !displayNameValue) {
          authErrorMsg = "Please fill in all bricks of the form.";
          renderAuth(parentEl);
          return;
        }
        if (passwordValue.length < 8) {
          authErrorMsg = "Password must be at least 8 blocks long.";
          renderAuth(parentEl);
          return;
        }
        if (!/[a-z]/.test(passwordValue) || !/[0-9]/.test(passwordValue)) {
          authErrorMsg = "Password needs at least one letter and one number.";
          renderAuth(parentEl);
          return;
        }
        authLoading = true;
        renderAuth(parentEl);
        try {
          if (isSignUpMode) {
            await signUp({ email: emailValue, password: passwordValue, displayName: displayNameValue });
            authSuccessMsg = "Account created successfully! Please sign in.";
            isSignUpMode = false;
            passwordValue = "";
            authErrorMsg = null;
          } else {
            const result = await signIn({ email: emailValue, password: passwordValue });
            await playLoginTransition();
            setUser(result.user, result.idToken);
          }
        } catch (err) {
          console.error("Auth or rendering error:", err);
          authErrorMsg = err.message || "Authentication failed. Please verify credentials.";
          authLoading = false;
          setUser(null);
          renderAuth(parentEl);
        } finally {
          if (!getState().user) {
            authLoading = false;
            renderAuth(parentEl);
          }
        }
      };
      form.querySelector("#auth-mode-toggle-link").onclick = () => {
        isSignUpMode = !isSignUpMode;
        authErrorMsg = null;
        authSuccessMsg = null;
        renderAuth(parentEl);
      };
      cardBody.appendChild(form);
    }
    card.appendChild(cardBody);
    container.appendChild(card);
    parentEl.appendChild(container);
  }
  function createInputGroup(label, type, name, placeholder, value, iconHtml) {
    const group = document.createElement("div");
    group.className = "input-group";
    const isPassword = name === "password";
    group.innerHTML = `
    <label class="input-label font-display">${label}</label>
    <div class="input-wrapper">
      <span class="input-icon">${iconHtml}</span>
      <input type="${type}" name="${name}" class="auth-input" placeholder="${placeholder}" value="${value}" />
      ${isPassword ? '<button type="button" class="password-peek-btn" aria-label="Show password" title="Show password">\u{1F441}</button>' : ""}
    </div>
  `;
    if (isPassword) {
      const input = group.querySelector("input");
      const button = group.querySelector(".password-peek-btn");
      button.addEventListener("click", () => {
        const nextType = input.type === "password" ? "text" : "password";
        input.type = nextType;
        button.setAttribute("aria-label", nextType === "password" ? "Show password" : "Hide password");
        button.title = nextType === "password" ? "Show password" : "Hide password";
        button.textContent = nextType === "password" ? "\u{1F441}" : "\u{1F648}";
      });
    }
    return group;
  }
  function initBrickTunnelAnimation(canvas) {
    const ctx = canvas.getContext("2d");
    let animationFrameId = null;
    let warp = 1;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();
    const numParticles = 120;
    const particles = [];
    const speedLines = [];
    const colors = ["#D01012", "#0057A6", "#FFD500", "#FFFFFF", "#5B5B66", "#1E7A34", "#F97316", "#8B5CF6"];
    const createParticle = (initZ = false) => {
      const spreadRadius = 1600;
      return {
        x: (Math.random() - 0.5) * spreadRadius,
        y: (Math.random() - 0.5) * spreadRadius,
        z: initZ ? Math.random() * 1200 : 1200,
        size: Math.random() > 0.6 ? { w: 48, h: 24 } : { w: 24, h: 24 },
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05
      };
    };
    for (let i = 0; i < numParticles; i++) {
      particles.push(createParticle(true));
    }
    const numSpeedLines = 60;
    for (let i = 0; i < numSpeedLines; i++) {
      speedLines.push({
        angle: Math.random() * Math.PI * 2,
        innerRadius: 30 + Math.random() * 80,
        length: 60 + Math.random() * 200,
        alpha: 0.05 + Math.random() * 0.12,
        width: 0.5 + Math.random() * 1.5,
        speed: 3e-3 + Math.random() * 8e-3
      });
    }
    let targetCenterX = window.innerWidth / 2;
    let targetCenterY = window.innerHeight / 2;
    let currentCenterX = targetCenterX;
    let currentCenterY = targetCenterY;
    const onMouseMove = (e) => {
      const rx = e.clientX - window.innerWidth / 2;
      const ry = e.clientY - window.innerHeight / 2;
      targetCenterX = window.innerWidth / 2 + rx * 0.3;
      targetCenterY = window.innerHeight / 2 + ry * 0.3;
    };
    window.addEventListener("mousemove", onMouseMove);
    let frameCount = 0;
    const draw = () => {
      frameCount++;
      currentCenterX += (targetCenterX - currentCenterX) * 0.05;
      currentCenterY += (targetCenterY - currentCenterY) * 0.05;
      const grad = ctx.createRadialGradient(
        currentCenterX,
        currentCenterY,
        5,
        currentCenterX,
        currentCenterY,
        Math.max(canvas.width, canvas.height)
      );
      grad.addColorStop(0, "#1E1E28");
      grad.addColorStop(0.4, "#111117");
      grad.addColorStop(1, "#060608");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const warpT = Math.min(1, (warp - 1) / 15);
      const pulseScale = 1 + Math.sin(frameCount * 0.04) * 0.3 + warpT * 3.2;
      const glowGrad = ctx.createRadialGradient(
        currentCenterX,
        currentCenterY,
        0,
        currentCenterX,
        currentCenterY,
        90 * pulseScale
      );
      glowGrad.addColorStop(0, `rgba(255, 250, 224, ${0.25 + warpT * 0.75})`);
      glowGrad.addColorStop(0.4, `rgba(255, 213, 0, ${0.1 + warpT * 0.4})`);
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(currentCenterX, currentCenterY);
      const lineStretch = 1 + warpT * 9;
      speedLines.forEach((line) => {
        line.angle += line.speed;
        const cos = Math.cos(line.angle);
        const sin = Math.sin(line.angle);
        ctx.beginPath();
        ctx.moveTo(cos * line.innerRadius, sin * line.innerRadius);
        ctx.lineTo(
          cos * (line.innerRadius + line.length * lineStretch),
          sin * (line.innerRadius + line.length * lineStretch)
        );
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.9, line.alpha * (1 + warpT * 5))})`;
        ctx.lineWidth = line.width * (1 + warpT * 1.5);
        ctx.stroke();
      });
      ctx.restore();
      particles.sort((a, b) => b.z - a.z);
      particles.forEach((p) => {
        const zSpeed = (6 + (1 - p.z / 1200) * 10) * warp;
        p.z -= zSpeed;
        p.angle += p.rotSpeed;
        if (p.z <= 1) {
          Object.assign(p, createParticle(false));
        }
        const perspective = 280 / p.z;
        const px = currentCenterX + p.x * perspective;
        const py = currentCenterY + p.y * perspective;
        const pw = p.size.w * perspective;
        const ph = p.size.h * perspective;
        if (px < -pw * 2 || px > canvas.width + pw * 2 || py < -ph * 2 || py > canvas.height + ph * 2) {
          return;
        }
        const alphaFactor = Math.min(1, Math.max(0.15, 1 - p.z / 1200));
        ctx.save();
        ctx.globalAlpha = alphaFactor;
        ctx.translate(px, py);
        ctx.rotate(p.angle);
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = Math.max(3, 10 * perspective);
        ctx.shadowOffsetX = Math.max(1, 4 * perspective);
        ctx.shadowOffsetY = Math.max(1, 5 * perspective);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(1, 2.5 * perspective);
        ctx.beginPath();
        const r = Math.max(2, 4 * perspective);
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
        } else {
          ctx.rect(-pw / 2, -ph / 2, pw, ph);
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(-pw / 2, -ph / 2, pw, ph * 0.4, [r, r, 0, 0]);
        } else {
          ctx.rect(-pw / 2, -ph / 2, pw, ph * 0.4);
        }
        ctx.fill();
        const numStuds = p.size.w > 24 ? 4 : 2;
        const studRadius = 3.8 * perspective;
        const spacing = pw / numStuds;
        for (let s = 0; s < numStuds; s++) {
          const sx = -pw / 2 + spacing * (s + 0.5);
          const sy = -ph / 2;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy - studRadius * 0.4, studRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = Math.max(0.5, 1.5 * perspective);
          ctx.stroke();
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.beginPath();
          ctx.arc(sx - studRadius * 0.2, sy - studRadius * 0.6, studRadius * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      const vignette = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        Math.min(canvas.width, canvas.height) * 0.35,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) * 0.75
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();
    tunnelWarp = (v) => {
      warp = v;
    };
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      if (tunnelWarp) tunnelWarp = null;
    };
  }

  // js/hooks/snap.js
  function snapToGrid(value, unit = 16) {
    return Math.round(value / unit) * unit;
  }
  function getDockPosition(x, y, barWidth, barHeight, windowWidth, windowHeight) {
    const distLeft = x;
    const distRight = windowWidth - (x + barWidth);
    const distTop = y;
    const distBottom = windowHeight - (y + barHeight);
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    let edge = "bottom";
    let snappedX = x;
    let snappedY = y;
    if (minDist === distLeft) {
      edge = "left";
      snappedX = 0;
      snappedY = Math.max(16, Math.min(y, windowHeight - barHeight - 16));
    } else if (minDist === distRight) {
      edge = "right";
      snappedX = windowWidth - barWidth;
      snappedY = Math.max(16, Math.min(y, windowHeight - barHeight - 16));
    } else if (minDist === distTop) {
      edge = "top";
      snappedX = Math.max(16, Math.min(x, windowWidth - barWidth - 16));
      snappedY = 0;
    } else {
      edge = "bottom";
      snappedX = Math.max(16, Math.min(x, windowWidth - barWidth - 16));
      snappedY = windowHeight - barHeight;
    }
    return { edge, x: snappedX, y: snappedY };
  }

  // js/components/panel.js
  function createPanel(panelState, contentRenderer) {
    const { id, name, x, y, width, height, zIndex, isOpen, isCollapsed, accentClass } = panelState;
    if (!isOpen) return null;
    const container = document.createElement("div");
    container.className = `panel-container ${isCollapsed ? "is-collapsed" : ""}`;
    container.id = `panel-${id}`;
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.width = `${width}px`;
    container.style.height = isCollapsed ? "54px" : `${height}px`;
    container.style.zIndex = zIndex;
    const chrome = document.createElement("div");
    chrome.className = `panel-chrome ${accentClass} ${isCollapsed ? "is-collapsed" : ""}`;
    const header = document.createElement("div");
    header.className = "panel-header";
    const title = document.createElement("span");
    title.className = "panel-title font-display";
    title.textContent = name;
    header.appendChild(title);
    const controls = document.createElement("div");
    controls.className = "panel-controls";
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "panel-btn";
    collapseBtn.innerHTML = isCollapsed ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    collapseBtn.onclick = (e) => {
      e.stopPropagation();
      toggleCollapse(id);
    };
    controls.appendChild(collapseBtn);
    const closeBtn = document.createElement("button");
    closeBtn.className = "panel-btn close";
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closePanel(id);
    };
    controls.appendChild(closeBtn);
    header.appendChild(controls);
    chrome.appendChild(header);
    if (!isCollapsed) {
      const bodyContent = document.createElement("div");
      bodyContent.className = "panel-body-content";
      contentRenderer(bodyContent);
      chrome.appendChild(bodyContent);
    }
    container.appendChild(chrome);
    const studsRow = document.createElement("div");
    studsRow.className = "panel-studs-row";
    updateStudsForWidth(studsRow, width);
    container.appendChild(studsRow);
    chrome.addEventListener("mousedown", (e) => {
      if (e.target.closest("button, input, select, textarea, a, .panel-btn, .qty-picker, .part-delete-btn, .build-card, .scanner-dropzone, .demo-scan-btn, .candidate-card, .back-btn")) {
        return;
      }
      const bodyContent = chrome.querySelector(".panel-body-content");
      if (bodyContent) {
        const rect = bodyContent.getBoundingClientRect();
        if (e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom) {
          if (e.clientX > rect.left + bodyContent.clientWidth) {
            return;
          }
        }
      }
      e.preventDefault();
      bringToFront(id);
      chrome.classList.add("is-dragging");
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseInt(container.style.left);
      const startTop = parseInt(container.style.top);
      const snapUnit = getState().snapEnabled ? 16 : 1;
      const currentPanel = getState().panels[id] || panelState;
      const currentWidth = currentPanel.width;
      const currentHeight = currentPanel.height;
      const currentIsCollapsed = currentPanel.isCollapsed;
      const ghost = document.createElement("div");
      ghost.className = "panel-snap-ghost";
      ghost.style.transform = `translate(${snapToGrid(startLeft, snapUnit)}px, ${snapToGrid(startTop, snapUnit)}px)`;
      ghost.style.width = `${currentWidth}px`;
      ghost.style.height = currentIsCollapsed ? "54px" : `${currentHeight}px`;
      ghost.style.zIndex = zIndex - 1;
      container.parentElement.appendChild(ghost);
      let finalLeft = startLeft;
      let finalTop = startTop;
      function onMouseMove(moveEvent) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        finalLeft = startLeft + dx;
        finalTop = startTop + dy;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const panelWidth = currentWidth;
        const panelHeight = currentIsCollapsed ? 54 : currentHeight;
        finalLeft = Math.max(8, Math.min(finalLeft, windowWidth - panelWidth - 8));
        finalTop = Math.max(8, Math.min(finalTop, windowHeight - panelHeight - 8));
        if (getState().snapEnabled) {
          container.style.left = `${snapToGrid(finalLeft, snapUnit)}px`;
          container.style.top = `${snapToGrid(finalTop, snapUnit)}px`;
        } else {
          container.style.left = `${finalLeft}px`;
          container.style.top = `${finalTop}px`;
        }
        ghost.style.transform = `translate(${snapToGrid(finalLeft, snapUnit)}px, ${snapToGrid(finalTop, snapUnit)}px)`;
      }
      function onMouseUp() {
        chrome.classList.remove("is-dragging");
        ghost.remove();
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        const snappedLeft = snapToGrid(finalLeft, snapUnit);
        const snappedTop = snapToGrid(finalTop, snapUnit);
        updatePanelGeometry(id, { x: snappedLeft, y: snappedTop });
      }
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
    if (!isCollapsed) {
      const directions = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
      directions.forEach((dir) => {
        const handle = document.createElement("div");
        handle.className = `resize-handle ${dir}`;
        container.appendChild(handle);
        handle.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          bringToFront(id);
          chrome.classList.add("is-resizing");
          const startX = e.clientX;
          const startY = e.clientY;
          const startLeft = parseInt(container.style.left);
          const startTop = parseInt(container.style.top);
          const startW = parseInt(container.style.width);
          const startH = parseInt(container.style.height);
          const snapUnit = getState().snapEnabled ? 16 : 1;
          const ghost = document.createElement("div");
          ghost.className = "panel-snap-ghost";
          ghost.style.transform = `translate(${snapToGrid(startLeft, snapUnit)}px, ${snapToGrid(startTop, snapUnit)}px)`;
          ghost.style.width = `${snapToGrid(startW, snapUnit)}px`;
          ghost.style.height = `${snapToGrid(startH, snapUnit)}px`;
          ghost.style.zIndex = zIndex - 1;
          container.parentElement.appendChild(ghost);
          let finalLeft = startLeft;
          let finalTop = startTop;
          let finalW = startW;
          let finalH = startH;
          function onMouseMove(moveEvent) {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            const windowW = window.innerWidth;
            const windowH = window.innerHeight;
            if (dir.includes("e")) {
              const maxW = windowW - startLeft - 8;
              finalW = Math.max(288, Math.min(startW + dx, maxW));
            }
            if (dir.includes("w")) {
              let potentialLeft = startLeft + dx;
              if (potentialLeft < 8) potentialLeft = 8;
              const potentialW = startW + (startLeft - potentialLeft);
              if (potentialW >= 288) {
                finalW = potentialW;
                finalLeft = potentialLeft;
              }
            }
            if (dir.includes("s")) {
              const maxH = windowH - startTop - 8;
              finalH = Math.max(224, Math.min(startH + dy, maxH));
            }
            if (dir.includes("n")) {
              let potentialTop = startTop + dy;
              if (potentialTop < 8) potentialTop = 8;
              const potentialH = startH + (startTop - potentialTop);
              if (potentialH >= 224) {
                finalH = potentialH;
                finalTop = potentialTop;
              }
            }
            if (getState().snapEnabled) {
              const snapLeft = snapToGrid(finalLeft, snapUnit);
              const snapTop = snapToGrid(finalTop, snapUnit);
              const snapW = snapToGrid(finalW, snapUnit);
              const snapH = snapToGrid(finalH, snapUnit);
              container.style.left = `${snapLeft}px`;
              container.style.top = `${snapTop}px`;
              container.style.width = `${snapW}px`;
              container.style.height = `${snapH}px`;
              updateStudsForWidth(studsRow, snapW);
            } else {
              container.style.left = `${finalLeft}px`;
              container.style.top = `${finalTop}px`;
              container.style.width = `${finalW}px`;
              container.style.height = `${finalH}px`;
              updateStudsForWidth(studsRow, finalW);
            }
            ghost.style.transform = `translate(${snapToGrid(finalLeft, snapUnit)}px, ${snapToGrid(finalTop, snapUnit)}px)`;
            ghost.style.width = `${snapToGrid(finalW, snapUnit)}px`;
            ghost.style.height = `${snapToGrid(finalH, snapUnit)}px`;
          }
          function onMouseUp() {
            chrome.classList.remove("is-resizing");
            ghost.remove();
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            updatePanelGeometry(id, {
              x: snapToGrid(finalLeft, snapUnit),
              y: snapToGrid(finalTop, snapUnit),
              width: snapToGrid(finalW, snapUnit),
              height: snapToGrid(finalH, snapUnit)
            });
          }
          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        });
      });
    }
    container.addEventListener("mousedown", () => {
      bringToFront(id);
    });
    return container;
  }
  function updateStudsForWidth(studsRow, width) {
    const numStuds = Math.max(4, Math.floor((width - 32) / 60));
    studsRow.innerHTML = "";
    for (let i = 0; i < numStuds; i++) {
      const stud = document.createElement("div");
      stud.className = "panel-stud";
      studsRow.appendChild(stud);
    }
  }

  // js/hooks/sound.js
  function playSound(type) {
    const state2 = getState();
    if (!state2.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === "success") {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const time = ctx.currentTime + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0.04, time);
          gain.gain.exponentialRampToValueAtTime(1e-3, time + 0.25);
          osc.start(time);
          osc.stop(time + 0.25);
        });
      } else if (type === "scan") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (err) {
      console.error("Synthesized sound playing failed:", err);
    }
  }

  // js/components/actionbar.js
  var currentDockedEdge = "bottom";
  var actionbarX = 0;
  var actionbarY = 0;
  var actionbarLength = 320;
  var isFirstRender = true;
  var isPlusMenuOpen = false;
  function createActionBar(state2) {
    const container = document.createElement("div");
    container.className = "action-bar-wrapper";
    const isHorizontal = currentDockedEdge === "top" || currentDockedEdge === "bottom";
    const barWidth = isHorizontal ? actionbarLength : 72;
    const barHeight = isHorizontal ? 72 : actionbarLength;
    if (isFirstRender) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      actionbarX = (windowWidth - 320) / 2;
      actionbarY = windowHeight - 72 - 16;
      isFirstRender = false;
    }
    container.style.left = `${actionbarX}px`;
    container.style.top = `${actionbarY}px`;
    container.style.width = `${barWidth}px`;
    container.style.height = `${barHeight}px`;
    const bar = document.createElement("div");
    bar.className = `action-bar-container docked-${currentDockedEdge} ${isHorizontal ? "layout-row" : "layout-col"}`;
    const dragHandle = document.createElement("div");
    dragHandle.className = "action-bar-drag";
    dragHandle.title = "Drag to Dock at Edges";
    dragHandle.innerHTML = '<div class="drag-studs"></div>';
    bar.appendChild(dragHandle);
    const buttonsGroup = document.createElement("div");
    buttonsGroup.className = "action-bar-buttons";
    const navItems = [
      {
        id: "scanner",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="M14 13l-3-3-5 5"></path><path d="M5 21l6-6 4 4 6-6"></path><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3"></line></svg>`,
        label: "Scan"
      },
      {
        id: "inventory",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="2" ry="2"></rect><rect x="6" y="3" width="4" height="2" rx="0.5" fill="currentColor"/><rect x="14" y="3" width="4" height="2" rx="0.5" fill="currentColor"/></svg>`,
        label: "Inventory"
      },
      {
        id: "buildIdeas",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`,
        label: "Ideas"
      }
    ];
    function renderButtonsContent() {
      buttonsGroup.innerHTML = "";
      if (actionbarLength < 220) {
        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = `action-btn plus-toggle ${isPlusMenuOpen ? "active" : ""}`;
        plusBtn.title = "Toggle Navigation Menu";
        plusBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span class="tooltip font-display">Navigation</span>
      `;
        plusBtn.onclick = (e) => {
          e.stopPropagation();
          playSound("click");
          isPlusMenuOpen = !isPlusMenuOpen;
          notify();
        };
        buttonsGroup.appendChild(plusBtn);
        if (isPlusMenuOpen) {
          const popover = document.createElement("div");
          popover.className = "action-bar-collapsed-popover";
          navItems.forEach((item) => {
            const isActive = state2.panels[item.id].isOpen;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `action-btn ${isActive ? "active" : ""}`;
            btn.title = `${isActive ? "Close" : "Open"} ${item.label}`;
            btn.innerHTML = `${item.icon} <span class="tooltip font-display">${item.label}</span>`;
            btn.onclick = () => {
              playSound("click");
              togglePanel(item.id);
              isPlusMenuOpen = false;
              notify();
            };
            popover.appendChild(btn);
          });
          container.appendChild(popover);
        }
      } else {
        navItems.forEach((item) => {
          const isActive = state2.panels[item.id].isOpen;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `action-btn ${isActive ? "active" : ""}`;
          btn.title = `${isActive ? "Close" : "Open"} ${item.label}`;
          btn.innerHTML = `${item.icon} <span class="tooltip font-display">${item.label}</span>`;
          btn.onclick = () => {
            playSound("click");
            togglePanel(item.id);
          };
          buttonsGroup.appendChild(btn);
        });
      }
    }
    renderButtonsContent();
    bar.appendChild(buttonsGroup);
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "action-bar-resize-handle";
    resizeHandle.title = "Drag to Resize Lengthwise";
    bar.appendChild(resizeHandle);
    container.appendChild(bar);
    document.addEventListener("mousedown", (e) => {
      if (isPlusMenuOpen && !container.contains(e.target)) {
        isPlusMenuOpen = false;
        notify();
      }
    });
    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startLength = actionbarLength;
      function onMouseMoveResize(moveEvent) {
        let delta = 0;
        if (isHorizontal) {
          delta = moveEvent.clientX - startX;
        } else {
          delta = moveEvent.clientY - startY;
        }
        actionbarLength = Math.max(120, Math.min(600, startLength + delta));
        if (isHorizontal) {
          container.style.width = `${actionbarLength}px`;
        } else {
          container.style.height = `${actionbarLength}px`;
        }
        renderButtonsContent();
      }
      function onMouseUpResize() {
        document.removeEventListener("mousemove", onMouseMoveResize);
        document.removeEventListener("mouseup", onMouseUpResize);
        playSound("click");
        notify();
      }
      document.addEventListener("mousemove", onMouseMoveResize);
      document.addEventListener("mouseup", onMouseUpResize);
    });
    dragHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseInt(container.style.left);
      const startTop = parseInt(container.style.top);
      function onMouseMove(moveEvent) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        actionbarX = startLeft + dx;
        actionbarY = startTop + dy;
        container.style.left = `${actionbarX}px`;
        container.style.top = `${actionbarY}px`;
      }
      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const tempDock = getDockPosition(actionbarX, actionbarY, barWidth, barHeight, windowWidth, windowHeight);
        const nextIsHorizontal = tempDock.edge === "top" || tempDock.edge === "bottom";
        const nextBarWidth = nextIsHorizontal ? actionbarLength : 72;
        const nextBarHeight = nextIsHorizontal ? 72 : actionbarLength;
        const dock = getDockPosition(actionbarX, actionbarY, nextBarWidth, nextBarHeight, windowWidth, windowHeight);
        let targetX = dock.x;
        let targetY = dock.y;
        const margin = 12;
        if (dock.edge === "bottom") {
          targetY = windowHeight - nextBarHeight - margin;
        } else if (dock.edge === "top") {
          targetY = margin;
        } else if (dock.edge === "left") {
          targetX = margin;
        } else if (dock.edge === "right") {
          targetX = windowWidth - nextBarWidth - margin;
        }
        currentDockedEdge = dock.edge;
        actionbarX = targetX;
        actionbarY = targetY;
        playSound("click");
        notify();
      }
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
    return container;
  }

  // js/api/fixtures.js
  function getBrickSvg(color, type = "brick-2x4") {
    let innerElements = "";
    let view = "0 0 120 80";
    const border = "#22222A";
    if (type === "brick-2x4" || type === "plate-2x4") {
      view = "0 0 160 90";
      const isPlate = type.includes("plate");
      innerElements = `
      <rect x="5" y="5" width="150" height="80" rx="10" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Studs -->
      <circle cx="25" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="105" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="105" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="145" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="145" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="25" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="105" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="105" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="145" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="145" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      ${isPlate ? '<line x1="5" y1="45" x2="155" y2="45" stroke="' + border + '" stroke-dasharray="4 4" stroke-width="2"/>' : ""}
    `;
    } else if (type === "brick-2x2" || type === "plate-2x2") {
      view = "0 0 90 90";
      const isPlate = type.includes("plate");
      innerElements = `
      <rect x="5" y="5" width="80" height="80" rx="10" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Studs -->
      <circle cx="25" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="25" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      ${isPlate ? '<line x1="5" y1="45" x2="85" y2="45" stroke="' + border + '" stroke-dasharray="4 4" stroke-width="2"/>' : ""}
    `;
    } else if (type === "plate-1x2" || type === "brick-1x2") {
      view = "0 0 90 50";
      innerElements = `
      <rect x="5" y="5" width="80" height="40" rx="8" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Studs -->
      <circle cx="25" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
    `;
    } else if (type === "slope-2x2") {
      view = "0 0 90 90";
      innerElements = `
      <rect x="5" y="5" width="80" height="80" rx="10" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Slope Angle -->
      <path d="M 5,45 L 85,85" stroke="${border}" stroke-width="3"/>
      <circle cx="25" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
    `;
    } else if (type === "technic-1x1") {
      view = "0 0 50 50";
      innerElements = `
      <rect x="5" y="5" width="40" height="40" rx="8" fill="${color}" stroke="${border}" stroke-width="4"/>
      <circle cx="25" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="25" r="4" fill="#22222A"/>
    `;
    } else if (type === "minifig-torso") {
      view = "0 0 80 80";
      innerElements = `
      <rect x="34" y="5" width="12" height="10" rx="2" fill="#FFD500" stroke="${border}" stroke-width="3"/>
      <path d="M 20,15 L 60,15 L 68,70 L 12,70 Z" fill="${color}" stroke="${border}" stroke-width="4"/>
      <path d="M 12,18 C 5,25 2,35 5,45" stroke="${color}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M 68,18 C 75,25 78,35 75,45" stroke="${color}" stroke-width="10" stroke-linecap="round" fill="none"/>
    `;
    } else {
      view = "0 0 60 60";
      innerElements = `<rect x="5" y="5" width="50" height="50" rx="8" fill="${color}" stroke="${border}" stroke-width="4"/>`;
    }
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">${innerElements}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }
  var MOCK_PARTS = [
    { part_id: 1, part_name: "2x4 Brick (Red)", category: "Brick", color: "#D01012", type: "brick-2x4", reference_image_url: getBrickSvg("#D01012", "brick-2x4") },
    { part_id: 2, part_name: "2x4 Brick (Blue)", category: "Brick", color: "#0057A6", type: "brick-2x4", reference_image_url: getBrickSvg("#0057A6", "brick-2x4") },
    { part_id: 3, part_name: "2x2 Brick (Yellow)", category: "Brick", color: "#FFD500", type: "brick-2x2", reference_image_url: getBrickSvg("#FFD500", "brick-2x2") },
    { part_id: 4, part_name: "2x2 Slope 45\xB0 (Yellow)", category: "Slope", color: "#FFD500", type: "slope-2x2", reference_image_url: getBrickSvg("#FFD500", "slope-2x2") },
    { part_id: 5, part_name: "2x2 Plate (Red)", category: "Plate", color: "#D01012", type: "plate-2x2", reference_image_url: getBrickSvg("#D01012", "plate-2x2") },
    { part_id: 6, part_name: "1x2 Plate (Yellow)", category: "Plate", color: "#FFD500", type: "plate-1x2", reference_image_url: getBrickSvg("#FFD500", "plate-1x2") },
    { part_id: 7, part_name: "2x4 Plate (Blue)", category: "Plate", color: "#0057A6", type: "plate-2x4", reference_image_url: getBrickSvg("#0057A6", "plate-2x4") },
    { part_id: 8, part_name: "1x2 Plate (Red)", category: "Plate", color: "#D01012", type: "plate-1x2", reference_image_url: getBrickSvg("#D01012", "plate-1x2") },
    { part_id: 9, part_name: "2x2 Slope 45\xB0 (Blue)", category: "Slope", color: "#0057A6", type: "slope-2x2", reference_image_url: getBrickSvg("#0057A6", "slope-2x2") },
    { part_id: 10, part_name: "1x4 Plate (White)", category: "Plate", color: "#FFFFFF", type: "plate-2x4", reference_image_url: getBrickSvg("#FFFFFF", "plate-2x4") },
    { part_id: 11, part_name: "Technic 1x1 Brick (Grey)", category: "Technic", color: "#5B5B66", type: "technic-1x1", reference_image_url: getBrickSvg("#5B5B66", "technic-1x1") },
    { part_id: 12, part_name: "Minifig Torso (Blue)", category: "Minifig", color: "#0057A6", type: "minifig-torso", reference_image_url: getBrickSvg("#0057A6", "minifig-torso") },
    { part_id: 13, part_name: "2x4 Plate (Green)", category: "Plate", color: "#1E7A34", type: "plate-2x4", reference_image_url: getBrickSvg("#1E7A34", "plate-2x4") },
    { part_id: 14, part_name: "2x4 Brick (Grey)", category: "Brick", color: "#5B5B66", type: "brick-2x4", reference_image_url: getBrickSvg("#5B5B66", "brick-2x4") }
  ];
  var mockInventory = [
    { inventory_id: 101, part_id: 1, part_name: "2x4 Brick (Red)", reference_image_url: getBrickSvg("#D01012", "brick-2x4"), category: "Brick", quantity: 6, date_added: "2026-07-01T12:00:00Z", source_image_key: null },
    { inventory_id: 102, part_id: 3, part_name: "2x2 Brick (Yellow)", reference_image_url: getBrickSvg("#FFD500", "brick-2x2"), category: "Brick", quantity: 3, date_added: "2026-07-02T14:30:00Z", source_image_key: null },
    { inventory_id: 103, part_id: 4, part_name: "2x2 Slope 45\xB0 (Yellow)", reference_image_url: getBrickSvg("#FFD500", "slope-2x2"), category: "Slope", quantity: 2, date_added: "2026-07-03T10:15:00Z", source_image_key: null },
    { inventory_id: 104, part_id: 5, part_name: "2x2 Plate (Red)", reference_image_url: getBrickSvg("#D01012", "plate-2x2"), category: "Plate", quantity: 2, date_added: "2026-07-04T09:00:00Z", source_image_key: null },
    { inventory_id: 105, part_id: 6, part_name: "1x2 Plate (Yellow)", reference_image_url: getBrickSvg("#FFD500", "plate-1x2"), category: "Plate", quantity: 5, date_added: "2026-07-05T16:45:00Z", source_image_key: null },
    { inventory_id: 106, part_id: 7, part_name: "2x4 Plate (Blue)", reference_image_url: getBrickSvg("#0057A6", "plate-2x4"), category: "Plate", quantity: 1, date_added: "2026-07-06T11:20:00Z", source_image_key: null },
    { inventory_id: 107, part_id: 8, part_name: "1x2 Plate (Red)", reference_image_url: getBrickSvg("#D01012", "plate-1x2"), category: "Plate", quantity: 4, date_added: "2026-07-07T15:10:00Z", source_image_key: null }
  ];
  var MOCK_BUILDS = [
    {
      build_id: 1,
      build_name: "Classic Yellow Duck",
      description: "The timeless LEGO mascot model. Extremely easy to build and requires just five yellow and red parts.",
      difficulty: "Easy",
      hero_image_url: "assets/builds/duck.png",
      parts: [
        { part_id: 3, part_name: "2x2 Brick (Yellow)", quantity_required: 1 },
        { part_id: 4, part_name: "2x2 Slope 45\xB0 (Yellow)", quantity_required: 1 },
        { part_id: 5, part_name: "2x2 Plate (Red)", quantity_required: 1 },
        { part_id: 6, part_name: "1x2 Plate (Yellow)", quantity_required: 2 }
      ],
      steps: [
        "Base Connection: Attach the red 2x2 plate underneath the yellow 2x2 brick to form the duck's webbed feet.",
        "Head and Beak: Mount the yellow 2x2 slope on top of the yellow brick facing forward to establish the head profile.",
        "Wings Assembly: Align the two yellow 1x2 plates on each side of the main brick structure to complete the wings."
      ]
    },
    {
      build_id: 2,
      build_name: "Micro Shuttle Fighter",
      description: "Launch into deep orbit with this compact galactic explorer. Complete with folding wings and rear engine block.",
      difficulty: "Medium",
      hero_image_url: "assets/builds/shuttle.png",
      parts: [
        { part_id: 7, part_name: "2x4 Plate (Blue)", quantity_required: 2 },
        { part_id: 8, part_name: "1x2 Plate (Red)", quantity_required: 2 },
        { part_id: 9, part_name: "2x2 Slope 45\xB0 (Blue)", quantity_required: 2 },
        { part_id: 10, part_name: "1x4 Plate (White)", quantity_required: 1 },
        { part_id: 11, part_name: "Technic 1x1 Brick (Grey)", quantity_required: 1 }
      ],
      steps: [
        "Wings Foundation: Connect the two blue 2x4 plates side-by-side using the white 1x4 plate across the bottom.",
        "Thruster Engine: Install the grey Technic 1x1 brick at the rear center of the baseplate layout.",
        "Cockpit Slopes: Attach the two blue 2x2 slopes facing forward on the front section of the wing structure.",
        "Exhaust Trails: Mount the two red 1x2 plates to the rear of the engine block to represent roaring rocket thrusters."
      ]
    },
    {
      build_id: 3,
      build_name: "Tiny Castle Guard Gate",
      description: "A defensive fortress segment with two arch towers, perfect for protecting your LEGO kingdoms.",
      difficulty: "Hard",
      hero_image_url: "assets/builds/castle.png",
      parts: [
        { part_id: 14, part_name: "2x4 Brick (Grey)", quantity_required: 4 },
        { part_id: 11, part_name: "Technic 1x1 Brick (Grey)", quantity_required: 2 },
        { part_id: 8, part_name: "1x2 Plate (Red)", quantity_required: 4 },
        { part_id: 13, part_name: "2x4 Plate (Green)", quantity_required: 2 }
      ],
      steps: [
        "Ground Level: Align the two green 2x4 plates flat side-by-side on your workspace to build the gate lawn.",
        "Pillar Columns: Stack the grey 2x4 bricks on both sides to erect the sturdy castle guard pillars.",
        "Arch Gate: Connect the towers at the top by securing the grey Technic 1x1 bricks across the center opening.",
        "Battle Banners: Crown the top of the columns with red 1x2 plates to display the royal kingdom guard flags."
      ]
    },
    {
      build_id: 4,
      build_name: "Desktop Phone Cradle",
      description: "An angled brick stand that keeps your smartphone steady on your desk. Customizable and very sturdy.",
      difficulty: "Easy",
      hero_image_url: "assets/builds/cradle.png",
      parts: [
        { part_id: 1, part_name: "2x4 Brick (Red)", quantity_required: 4 },
        { part_id: 2, part_name: "2x4 Brick (Blue)", quantity_required: 2 },
        { part_id: 3, part_name: "2x2 Brick (Yellow)", quantity_required: 2 },
        { part_id: 7, part_name: "2x4 Plate (Blue)", quantity_required: 2 }
      ],
      steps: [
        "Stand Footing: Place the two blue 2x4 plates flat as the solid resting base plate for the stand.",
        "Support Wall: Stack the red and blue 2x4 bricks horizontally to assemble the supportive back wall panel.",
        "Front Cradle Lip: Place the yellow 2x2 bricks at the front lip to prevent your smartphone from sliding."
      ]
    },
    {
      build_id: 5,
      build_name: "Mini Rainbow Flower",
      description: "A colorful miniature LEGO flower sitting on a green grass leaf plate. Brings joy to any desk workspace.",
      difficulty: "Easy",
      hero_image_url: "assets/builds/flower.png",
      parts: [
        { part_id: 6, part_name: "1x2 Plate (Yellow)", quantity_required: 2 },
        { part_id: 5, part_name: "2x2 Plate (Red)", quantity_required: 1 },
        { part_id: 7, part_name: "2x4 Plate (Blue)", quantity_required: 1 },
        { part_id: 13, part_name: "2x4 Plate (Green)", quantity_required: 1 }
      ],
      steps: [
        "Stem & Leaf: Place the green 2x4 plate flat as the leaf foundation representing the flower's stem and green leaf.",
        "Soil Bed: Attach the blue 2x4 plate on the leaf center to create the fertile soil bed base.",
        "Flower Bud: Mount the red 2x2 plate in the center to support the petals.",
        "Petals Bloom: Stack the two yellow 1x2 plates on the sides of the bud to finish the blooming rainbow petals."
      ]
    }
  ];
  function addMockInventoryItem(item) {
    const newId = Math.max(...mockInventory.map((i) => i.inventory_id), 0) + 1;
    const part = MOCK_PARTS.find((p) => p.part_id === item.part_id);
    const newItem = {
      inventory_id: newId,
      part_id: item.part_id,
      part_name: part ? part.part_name : "Unknown Part",
      reference_image_url: part ? part.reference_image_url : getBrickSvg("#5B5B66"),
      category: part ? part.category : "Misc",
      quantity: item.quantity,
      date_added: (/* @__PURE__ */ new Date()).toISOString(),
      source_image_key: item.source_image_key || null
    };
    const existingIndex = mockInventory.findIndex((i) => i.part_id === item.part_id);
    if (existingIndex !== -1) {
      mockInventory[existingIndex].quantity += item.quantity;
      return mockInventory[existingIndex];
    }
    mockInventory.push(newItem);
    return newItem;
  }
  function updateMockInventoryItem(inventory_id, { quantity }) {
    const index = mockInventory.findIndex((i) => i.inventory_id === inventory_id);
    if (index !== -1) {
      mockInventory[index].quantity = quantity;
      return mockInventory[index];
    }
    return null;
  }
  function deleteMockInventoryItem(inventory_id) {
    const index = mockInventory.findIndex((i) => i.inventory_id === inventory_id);
    if (index !== -1) {
      mockInventory.splice(index, 1);
      return true;
    }
    return false;
  }

  // js/api/imagePrep.js
  var MAX_DIMENSION = 1600;
  var JPEG_QUALITY = 0.9;
  var UPLOAD_CONTENT_TYPE = "image/jpeg";
  async function toUploadableJpeg(file) {
    try {
      const bitmap = await loadBitmap(file);
      let { width, height } = bitmap;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      if (bitmap.close) bitmap.close();
      const blob = await new Promise(
        (resolve) => canvas.toBlob(resolve, UPLOAD_CONTENT_TYPE, JPEG_QUALITY)
      );
      return blob || file;
    } catch (err) {
      console.warn("Image conversion failed, uploading original:", err);
      return file;
    }
  }
  function loadBitmap(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  // js/api/scanner.js
  var sleep2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function apiError(res, fallback) {
    try {
      const body = await res.json();
      if (body && body.message) return new Error(body.message);
    } catch (_) {
    }
    return new Error(fallback);
  }
  async function getUploadUrl(fileName) {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/scanner/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify({ fileName })
      });
      if (!res.ok) throw await apiError(res, "Failed to get upload URL");
      return await res.json();
    }
    await sleep2(400);
    const key = "uploads/" + Math.random().toString(36).substr(2, 9) + "_" + fileName;
    const uploadUrl = `https://mock-s3-bucket.amazonaws.com/${key}?signature=fake_s3_presigned_signature`;
    return { uploadUrl, key };
  }
  async function uploadImage(uploadUrl, file) {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const body = await toUploadableJpeg(file);
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": UPLOAD_CONTENT_TYPE },
        body
      });
      if (!res.ok) throw new Error(`Upload to S3 failed (${res.status}). Try a different photo.`);
      return { success: true };
    }
    await sleep2(1e3);
    return { success: true };
  }
  async function scanBrick(key, model) {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/scanner/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify(model ? { key, model } : { key })
      });
      if (!res.ok) throw await apiError(res, "Failed to scan brick");
      return await res.json();
    }
    await sleep2(1200);
    let selectedPart = MOCK_PARTS[0];
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("blue")) {
      const bluePlate = MOCK_PARTS.find((p) => p.part_id === 7);
      selectedPart = bluePlate || MOCK_PARTS[1];
    } else if (lowerKey.includes("red")) {
      const redBrick = MOCK_PARTS.find((p) => p.part_id === 1);
      selectedPart = redBrick || MOCK_PARTS[0];
    } else if (lowerKey.includes("yellow")) {
      const yellowParts = MOCK_PARTS.filter((p) => p.part_name.toLowerCase().includes("yellow"));
      if (yellowParts.length > 0) selectedPart = yellowParts[Math.floor(Math.random() * yellowParts.length)];
    } else if (lowerKey.includes("grey") || lowerKey.includes("gray")) {
      const greyParts = MOCK_PARTS.filter((p) => p.part_name.toLowerCase().includes("grey"));
      if (greyParts.length > 0) selectedPart = greyParts[Math.floor(Math.random() * greyParts.length)];
    } else {
      selectedPart = MOCK_PARTS[Math.floor(Math.random() * MOCK_PARTS.length)];
    }
    const confidence = parseFloat((82 + Math.random() * 17.5).toFixed(1));
    return {
      label: selectedPart.type + "_" + selectedPart.part_id,
      confidence,
      part: {
        part_id: selectedPart.part_id,
        part_name: selectedPart.part_name,
        category: selectedPart.category,
        reference_image_url: selectedPart.reference_image_url
      }
    };
  }
  async function scanBatch(key, model) {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/scanner/scan-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify(model ? { key, model } : { key })
      });
      if (!res.ok) throw await apiError(res, "Failed to scan batch");
      return await res.json();
    }
    await sleep2(1500);
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("batch")) {
      const list = [
        MOCK_PARTS.find((p) => p.part_id === 1) || MOCK_PARTS[0],
        MOCK_PARTS.find((p) => p.part_id === 3) || MOCK_PARTS[2],
        MOCK_PARTS.find((p) => p.part_id === 7) || MOCK_PARTS[6]
      ];
      return {
        candidates: list.map((part, idx) => ({
          boxIndex: idx,
          label: part.type + "_" + part.part_id,
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
    const candidates2 = [];
    const chosenIndices = /* @__PURE__ */ new Set();
    while (chosenIndices.size < count) {
      const idx = Math.floor(Math.random() * MOCK_PARTS.length);
      chosenIndices.add(idx);
    }
    Array.from(chosenIndices).forEach((partIndex, idx) => {
      const part = MOCK_PARTS[partIndex];
      candidates2.push({
        boxIndex: idx,
        label: part.type + "_" + part.part_id,
        confidence: parseFloat((78 + Math.random() * 21).toFixed(1)),
        part: {
          part_id: part.part_id,
          part_name: part.part_name,
          category: part.category,
          reference_image_url: part.reference_image_url
        }
      });
    });
    return { candidates: candidates2 };
  }

  // js/hooks/toast.js
  var HOST_ID = "bu-toast-host";
  var DEFAULT_MS = 2600;
  function host() {
    let el = document.getElementById(HOST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = HOST_ID;
      el.className = "bu-toast-host";
      document.body.appendChild(el);
    }
    return el;
  }
  function showToast(message, opts = {}) {
    const el = document.createElement("div");
    el.className = "bu-toast";
    el.setAttribute("role", "status");
    el.innerHTML = `<span class="bu-toast-dot"></span><span></span>`;
    el.lastElementChild.textContent = message;
    host().appendChild(el);
    const ms = opts.duration || DEFAULT_MS;
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 220);
    }, ms);
  }
  function pluralParts(n) {
    return `${n} part${n === 1 ? "" : "s"}`;
  }

  // js/api/catalogue.js
  var ELEMENT_IMAGE_BASE = "https://cdn.rebrickable.com/media/parts/elements";
  var cache = null;
  var inFlight = null;
  async function getCatalogue() {
    if (cache) return cache;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      if (IS_MOCKED) {
        cache = mockCatalogue();
        return cache;
      }
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/catalogue`, { headers: { ...authHeader() } });
      if (!res.ok) throw new Error("Could not load the part catalogue");
      const data = await res.json();
      data.shapeByType = new Map(data.shapes.map((s) => [s.type, s]));
      data.colorById = new Map(data.colors.map((c) => [c.color_id, c]));
      cache = data;
      return cache;
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  function elementImageUrl(elementId) {
    return elementId ? `${ELEMENT_IMAGE_BASE}/${elementId}.jpg` : null;
  }
  function colorsForShape(catalogue, type) {
    const shape = catalogue.shapeByType.get(type);
    if (!shape) return [];
    return shape.colors.map((id) => catalogue.colorById.get(id)).filter(Boolean);
  }
  function elementFor(catalogue, type, colorId) {
    const shape = catalogue.shapeByType.get(type);
    return shape ? shape.element_ids[String(colorId)] || null : null;
  }
  function previewPart(catalogue, type, colorId) {
    const shape = catalogue.shapeByType.get(type);
    const color = catalogue.colorById.get(colorId);
    if (!shape || !color) return null;
    const elementId = elementFor(catalogue, type, colorId);
    return {
      type,
      color_id: colorId,
      element_id: elementId,
      part_num: shape.part_num,
      part_name: `${shape.name} (${color.name})`,
      category: shape.category,
      color_name: color.name,
      color_hex: color.hex,
      reference_image_url: elementImageUrl(elementId),
      label_image_url: shape.label_image_url,
      fallback_image_svg: null
    };
  }
  function contrastOn(hex) {
    const h = String(hex || "").replace("#", "");
    if (h.length !== 6) return "#22222A";
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.45 ? "#22222A" : "#FFFFFF";
  }
  function mockCatalogue() {
    const colors = [
      { color_id: 4, name: "Red", hex: "#D01012" },
      { color_id: 1, name: "Blue", hex: "#0057A6" },
      { color_id: 14, name: "Yellow", hex: "#FFD500" },
      { color_id: 2, name: "Green", hex: "#1E7A34" },
      { color_id: 72, name: "Dark Bluish Gray", hex: "#5B5B66" },
      { color_id: 15, name: "White", hex: "#FFFFFF" }
    ];
    const shapes = [
      ["brick-2x4", "2x4 Brick", "Brick", "3001"],
      ["brick-2x2", "2x2 Brick", "Brick", "3003"],
      ["plate-1x2", "1x2 Plate", "Plate", "3023"],
      ["plate-2x2", "2x2 Plate", "Plate", "3022"],
      ["plate-2x4", "2x4 Plate", "Plate", "3020"],
      ["slope-2x2", "2x2 Slope 45", "Slope", "3039"],
      ["technic-1x1", "Technic 1x1 Brick", "Technic", "6541"]
    ].map(([type, name, category, part_num]) => ({
      type,
      name,
      category,
      part_num,
      label_image_url: null,
      sample_element_id: null,
      sample_image_url: null,
      colors: colors.map((c) => c.color_id),
      element_ids: {}
    }));
    const data = { shapes, colors };
    data.shapeByType = new Map(shapes.map((s) => [s.type, s]));
    data.colorById = new Map(colors.map((c) => [c.color_id, c]));
    return data;
  }

  // js/api/partImage.js
  function partImageAttrs(part, alt = "") {
    const chain = [
      part?.reference_image_url,
      part?.fallback_image_svg,
      part?.label_image_url
    ].filter(Boolean);
    if (chain.length === 0) return `src="" alt="${escapeAttr(alt)}"`;
    const rest = chain.slice(1).map(encodeForAttr);
    const onerror = rest.length ? ` onerror="${buildFallbackChain(rest)}"` : "";
    return `src="${chain[0]}"${onerror} alt="${escapeAttr(alt)}"`;
  }
  function buildFallbackChain(sources) {
    let handler = "this.onerror=null;";
    for (let i = sources.length - 1; i >= 0; i--) {
      handler = i === sources.length - 1 ? `this.onerror=null; this.src='${sources[i]}';` : `this.onerror=function(){${handler}}; this.src='${sources[i]}';`;
    }
    return handler;
  }
  function encodeForAttr(url) {
    return String(url).replace(/'/g, "%27");
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  // js/components/pickers.js
  function createShapePicker(catalogue, { value = null, onChange } = {}) {
    let selected = value || catalogue.shapes[0] && catalogue.shapes[0].type;
    const categories = [...new Set(catalogue.shapes.map((s) => s.category))].sort();
    let activeCategory = "All";
    const wrap = document.createElement("div");
    wrap.className = "picker-block";
    wrap.innerHTML = `
    <div class="picker-head">
      <label class="picker-label font-display">Part Shape</label>
      <input type="search" class="picker-search font-body shape-search"
             placeholder="Search shapes or part number..." />
    </div>
    <div class="category-chips" role="tablist" aria-label="Filter by category"></div>
    <div class="picker-grid shape-grid" role="listbox" aria-label="Part shape"
         data-layout="flat-sorted"></div>
  `;
    const grid = wrap.querySelector(".shape-grid");
    const search = wrap.querySelector(".shape-search");
    const chipRow = wrap.querySelector(".category-chips");
    function renderChips() {
      chipRow.innerHTML = "";
      ["All", ...categories].forEach((cat) => {
        const count = cat === "All" ? catalogue.shapes.length : catalogue.shapes.filter((s) => s.category === cat).length;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `category-chip font-display ${cat === activeCategory ? "is-active" : ""}`;
        chip.setAttribute("role", "tab");
        chip.setAttribute("aria-selected", String(cat === activeCategory));
        chip.textContent = `${cat} ${count}`;
        chip.onclick = () => {
          activeCategory = cat;
          renderChips();
          render();
        };
        chipRow.appendChild(chip);
      });
    }
    function render() {
      const q = search.value.trim().toLowerCase();
      const matches = catalogue.shapes.filter((s) => {
        if (activeCategory !== "All" && s.category !== activeCategory) return false;
        return !q || s.name.toLowerCase().includes(q) || s.part_num.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      });
      grid.innerHTML = "";
      if (!matches.length) {
        grid.innerHTML = `<p class="picker-empty font-body">No ${activeCategory === "All" ? "" : activeCategory.toLowerCase() + " "}shapes match "${escapeHtml(search.value)}"</p>`;
        return;
      }
      matches.forEach((s) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `picker-tile shape-tile ${s.type === selected ? "is-selected" : ""}`;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", String(s.type === selected));
        btn.title = `${s.name} - ${s.category} - part ${s.part_num}`;
        btn.innerHTML = `
        <span class="shape-tile-img">
          <img ${partImageAttrs({
          reference_image_url: s.label_image_url,
          label_image_url: s.sample_image_url
        }, s.name)} />
        </span>
        <span class="shape-tile-name font-display">${escapeHtml(s.name)}</span>
        <span class="shape-tile-part font-body">${escapeHtml(s.part_num)}</span>
      `;
        btn.onclick = () => {
          selected = s.type;
          render();
          if (onChange) onChange(selected);
        };
        grid.appendChild(btn);
      });
    }
    search.oninput = render;
    renderChips();
    render();
    return {
      el: wrap,
      get: () => selected,
      set: (t) => {
        selected = t;
        render();
      }
    };
  }
  function createColorPicker(catalogue, { type, value = null, onChange } = {}) {
    let shapeType = type;
    let selected = value;
    const wrap = document.createElement("div");
    wrap.className = "picker-block";
    wrap.innerHTML = `
    <div class="picker-head">
      <label class="picker-label font-display">Colour <span class="picker-count font-body"></span></label>
      <input type="search" class="picker-search font-body color-search"
             placeholder="Search colours..." />
    </div>
    <div class="picker-grid color-grid" role="listbox" aria-label="Part colour"></div>
  `;
    const grid = wrap.querySelector(".color-grid");
    const search = wrap.querySelector(".color-search");
    const count = wrap.querySelector(".picker-count");
    let ready = false;
    function render() {
      const available = colorsForShape(catalogue, shapeType);
      if (selected != null && !available.some((c) => c.color_id === selected)) {
        selected = null;
      }
      if (selected == null && available.length) {
        selected = available[0].color_id;
        if (ready && onChange) onChange(selected);
      }
      const q = search.value.trim().toLowerCase();
      const matches = available.filter((c) => !q || c.name.toLowerCase().includes(q));
      count.textContent = `(${available.length} available for this shape)`;
      grid.innerHTML = "";
      if (!matches.length) {
        grid.innerHTML = `<p class="picker-empty font-body">No colours match "${escapeHtml(search.value)}"</p>`;
        return;
      }
      matches.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `color-swatch ${c.color_id === selected ? "is-selected" : ""}`;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", String(c.color_id === selected));
        btn.title = `${c.name} (colour ${c.color_id})`;
        btn.style.backgroundColor = c.hex;
        btn.style.color = contrastOn(c.hex);
        btn.innerHTML = `<span class="color-swatch-name">${escapeHtml(c.name)}</span>`;
        btn.onclick = () => {
          selected = c.color_id;
          render();
          if (onChange) onChange(selected);
        };
        grid.appendChild(btn);
      });
    }
    search.oninput = render;
    render();
    ready = true;
    return {
      el: wrap,
      get: () => selected,
      set: (id) => {
        selected = id;
        render();
      },
      setShape: (t) => {
        shapeType = t;
        render();
      }
    };
  }
  function createPartPreview(catalogue, { type, colorId } = {}) {
    const el = document.createElement("div");
    el.className = "part-preview brick-card";
    function render(t, cid) {
      const p = previewPart(catalogue, t, cid);
      if (!p) {
        el.innerHTML = `<p class="picker-empty font-body">Choose a shape and colour</p>`;
        return;
      }
      el.innerHTML = `
      <div class="part-preview-img">
        <img ${partImageAttrs(p, p.part_name)} />
      </div>
      <div class="part-preview-meta">
        <span class="part-preview-name font-display">${escapeHtml(p.part_name)}</span>
        <span class="part-preview-ids font-body">
          Element <strong>${p.element_id ? escapeHtml(p.element_id) : "\u2014"}</strong>
          &middot; Part ${escapeHtml(p.part_num)}
        </span>
      </div>
    `;
    }
    render(type, colorId);
    return { el, update: render };
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // js/api/inventory.js
  var sleep3 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function getInventory() {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/inventory`, {
        headers: { ...authHeader() }
      });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return await res.json();
    }
    await sleep3(600);
    return [...mockInventory];
  }
  async function addInventoryItem(item) {
    const { part_id, quantity, source_image_key } = item;
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/inventory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error("Failed to add inventory item");
      return await res.json();
    }
    await sleep3(500);
    if (!part_id || quantity === void 0) {
      throw new Error("part_id and quantity are required");
    }
    const result = addMockInventoryItem({ part_id, quantity, source_image_key });
    return { ...result };
  }
  async function updateInventoryItem(inventory_id, { quantity }) {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/inventory/${inventory_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify({ quantity })
      });
      if (!res.ok) throw new Error("Failed to update inventory item");
      return await res.json();
    }
    await sleep3(400);
    if (quantity === void 0 || quantity < 0) {
      throw new Error("quantity is required and must be non-negative");
    }
    if (quantity === 0) {
      const success = deleteMockInventoryItem(inventory_id);
      return { success, deleted: true };
    }
    const result = updateMockInventoryItem(inventory_id, { quantity });
    if (!result) {
      throw new Error(`Inventory item ${inventory_id} not found`);
    }
    return { ...result };
  }
  async function deleteInventoryItem(inventory_id) {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/inventory/${inventory_id}`, {
        method: "DELETE",
        headers: { ...authHeader() }
      });
      if (!res.ok) throw new Error("Failed to delete inventory item");
      return await res.json();
    }
    await sleep3(400);
    const success = deleteMockInventoryItem(inventory_id);
    if (!success) {
      throw new Error(`Inventory item ${inventory_id} not found`);
    }
    return { success: true };
  }

  // js/components/scanner.js
  var scanState = "idle";
  var candidates = [];
  var MODEL_OPTIONS = [
    {
      id: "",
      label: "Default",
      hint: "Whichever model is currently deployed"
    },
    {
      id: "rb1",
      label: "Rebrickable",
      hint: "Trained on catalogue photographs; the scan is matted onto white to match"
    },
    {
      id: "rb2",
      label: "Rebrickable + viewpoint",
      hint: "As Rebrickable, plus perspective warping so the training set is not all one camera angle"
    },
    {
      id: "v3",
      label: "Original 50-class",
      hint: "Trained on the B200C photo dataset. Strong on its own test set, weak on real photos - the domain gap"
    }
  ];
  var selectedModel = "";
  var addedIndices = /* @__PURE__ */ new Set();
  var errorMsg = "";
  var currentUploadedImageSrc = "";
  var minifigIntervalId = null;
  var minifigImages = [
    "FredFright.png",
    "FredSearching.png",
    "GlassMagnifyingDetective.png",
    "MagnifyingGlassKid.png",
    "TakingAPic.png"
  ];
  function startMinifigurePopups() {
    stopMinifigurePopups();
    minifigIntervalId = setInterval(() => {
      const container = document.querySelector(".scanner-image-preview-wrapper");
      if (!container) return;
      const minifig = document.createElement("div");
      minifig.className = "scanning-minifig";
      const randomImg = minifigImages[Math.floor(Math.random() * minifigImages.length)];
      minifig.style.backgroundImage = `url('assets/magnifier-minifigures/${randomImg}')`;
      minifig.style.width = "64px";
      minifig.style.height = "64px";
      const x = Math.random() * 75 + 10;
      const y = Math.random() * 45 + 15;
      minifig.style.left = `${x}%`;
      minifig.style.top = `${y}%`;
      container.appendChild(minifig);
      playSound("scan");
      setTimeout(() => {
        minifig.remove();
      }, 1600);
    }, 850);
  }
  function stopMinifigurePopups() {
    if (minifigIntervalId) {
      clearInterval(minifigIntervalId);
      minifigIntervalId = null;
    }
    document.querySelectorAll(".scanning-minifig").forEach((el) => el.remove());
  }
  function renderScanner(parentEl) {
    parentEl.innerHTML = "";
    addedIndices = /* @__PURE__ */ new Set();
    if (scanState === "idle") {
      renderIdleState(parentEl);
    } else if (scanState === "uploading") {
      renderSpinner(parentEl, "Uploading image to S3 bucket...");
    } else if (scanState === "scanning") {
      renderSpinner(parentEl, "AI Recognition identifying LEGO parts...");
    } else if (scanState === "error") {
      renderError(parentEl, errorMsg);
    } else if (scanState === "results") {
      renderResults(parentEl);
    }
  }
  function renderIdleState(parent) {
    const container = document.createElement("div");
    container.className = "scanner-panel-container";
    const dropzone = document.createElement("div");
    dropzone.className = "scanner-dropzone";
    dropzone.innerHTML = `
    <div class="dropzone-circle">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
    </div>
    <h4 class="font-display">Upload Photo</h4>
    <p>Drag files here or click to browse</p>
    <div class="photo-tip font-body">
      <span class="photo-tip-icon" aria-hidden="true">i</span>
      <span>
        <strong>Shoot at an angle from above</strong>, not straight down, on a
        plain surface in good light. The angle is what reveals a piece's
        height &ndash; from directly overhead a brick and a plate look
        identical. For several pieces at once, spread them apart so they
        don't touch.
      </span>
    </div>
    <input type="file" accept="image/*" style="display:none" id="scanner-file-input" />
  `;
    const fileInput = dropzone.querySelector("#scanner-file-input");
    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        runDetectionFlow(file, true, parent);
      }
    };
    container.appendChild(dropzone);
    const modelBar = document.createElement("div");
    modelBar.className = "model-switch";
    modelBar.innerHTML = `<span class="model-switch-label font-display">Model</span>`;
    MODEL_OPTIONS.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `model-chip font-display ${m.id === selectedModel ? "is-active" : ""}`;
      b.title = m.hint;
      b.textContent = m.label;
      b.onclick = () => {
        selectedModel = m.id;
        renderScanner(parent);
      };
      modelBar.appendChild(b);
    });
    container.appendChild(modelBar);
    const demoSection = document.createElement("div");
    demoSection.className = "demo-scans-section";
    demoSection.innerHTML = `
    <span class="demo-label font-display">Or Try Demo Photos:</span>
    <div class="demo-buttons-grid">
      <button type="button" class="demo-scan-btn font-display" data-type="single">Sample: Single Brick</button>
      <button type="button" class="demo-scan-btn font-display" data-type="dark">Sample: Dark Surface</button>
      <button type="button" class="demo-scan-btn font-display" data-type="batch">Sample: Multiple Bricks</button>
    </div>
  `;
    const DEMO_PHOTOS = {
      single: "assets/demo/single-brick.jpg",
      dark: "assets/demo/dark-surface.jpg",
      batch: "assets/demo/batch-bricks.jpg"
    };
    demoSection.querySelectorAll("[data-type]").forEach((btn) => {
      btn.onclick = async () => {
        const type = btn.getAttribute("data-type");
        const path = DEMO_PHOTOS[type] || DEMO_PHOTOS.red;
        const name = path.split("/").pop();
        try {
          const res = await fetch(path);
          if (!res.ok) throw new Error(`Demo photo ${name} is missing`);
          const blob = await res.blob();
          const file = new File([blob], name, { type: "image/jpeg" });
          runDetectionFlow(file, true, parent);
        } catch (err) {
          errorMsg = err.message || "Could not load the demo photo.";
          scanState = "error";
          renderScanner(parent);
        }
      };
    });
    container.appendChild(demoSection);
    parent.appendChild(container);
  }
  function escapeHtml2(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  async function openCorrectionEditor(itemCard, cand, idx, parent) {
    const existing = itemCard.querySelector(".candidate-editor");
    if (existing) {
      existing.remove();
      return;
    }
    const holder = document.createElement("div");
    holder.className = "candidate-editor";
    holder.innerHTML = '<p class="picker-empty font-body">Loading the catalogue\u2026</p>';
    itemCard.appendChild(holder);
    let catalogue;
    try {
      catalogue = await getCatalogue();
    } catch (err) {
      holder.innerHTML = '<p class="picker-empty font-body">Could not load the catalogue.</p>';
      return;
    }
    holder.innerHTML = "";
    const alts = Array.isArray(cand.alternatives) ? cand.alternatives : [];
    if (alts.length) {
      const row = document.createElement("div");
      row.className = "candidate-alts";
      row.innerHTML = '<span class="candidate-alts-label font-display">Or did you mean</span>';
      alts.forEach((alt) => {
        const shape = catalogue.shapeByType.get(alt.type);
        if (!shape) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "candidate-alt font-display";
        b.title = `${shape.name} - model's next best guess at ${alt.confidence}%`;
        b.innerHTML = `
        <img ${partImageAttrs({
          reference_image_url: shape.label_image_url,
          label_image_url: shape.sample_image_url
        }, shape.name)} />
        <span class="candidate-alt-name">${escapeHtml2(shape.name)}</span>
        <span class="candidate-alt-conf">${alt.confidence}%</span>`;
        b.onclick = () => {
          shapePicker.set(alt.type);
          colorPicker.setShape(alt.type);
          syncPreview();
        };
        row.appendChild(b);
      });
      if (row.children.length > 1) holder.appendChild(row);
    }
    const shapePicker = createShapePicker(catalogue, {
      value: cand.part.type,
      onChange: (t) => {
        colorPicker.setShape(t);
        syncPreview();
      }
    });
    const colorPicker = createColorPicker(catalogue, {
      type: cand.part.type,
      value: cand.part.color_id,
      onChange: () => syncPreview()
    });
    const preview = createPartPreview(catalogue, {
      type: cand.part.type,
      colorId: cand.part.color_id
    });
    function syncPreview() {
      preview.update(shapePicker.get(), colorPicker.get());
    }
    const actions = document.createElement("div");
    actions.className = "candidate-editor-actions";
    actions.innerHTML = `
    <button type="button" class="brick-btn brick-btn-small editor-cancel">Cancel</button>
    <button type="button" class="brick-btn brick-btn-primary brick-btn-small editor-apply">Use this part</button>
  `;
    holder.appendChild(shapePicker.el);
    holder.appendChild(colorPicker.el);
    holder.appendChild(preview.el);
    holder.appendChild(actions);
    actions.querySelector(".editor-cancel").onclick = () => holder.remove();
    actions.querySelector(".editor-apply").onclick = () => {
      const chosen = previewPart(catalogue, shapePicker.get(), colorPicker.get());
      if (!chosen) {
        showToast("Pick a shape and a colour first.");
        return;
      }
      cand.part = { ...cand.part, ...chosen };
      cand.corrected = true;
      showToast(`Set to ${chosen.part_name}`);
      renderResults(parent);
    };
  }
  async function runDetectionFlow(file, isBatch, parent) {
    try {
      currentUploadedImageSrc = URL.createObjectURL(file);
      scanState = "uploading";
      renderScanner(parent);
      const { uploadUrl, key } = await getUploadUrl(file.name);
      await uploadImage(uploadUrl, file);
      scanState = "scanning";
      renderScanner(parent);
      startMinifigurePopups();
      if (isBatch) {
        const result = await scanBatch(key, selectedModel);
        candidates = result.candidates;
      } else {
        const result = await scanBrick(key, selectedModel);
        candidates = [result];
      }
      await new Promise((resolve) => setTimeout(resolve, 3800));
      stopMinifigurePopups();
      playSound("success");
      scanState = "results";
      renderScanner(parent);
    } catch (err) {
      stopMinifigurePopups();
      errorMsg = err.message || "Detection failed. Please check your network.";
      scanState = "error";
      renderScanner(parent);
    }
  }
  function renderSpinner(parent, message) {
    parent.innerHTML = `
    <div class="brick-spinner-container">
      <div class="scanner-image-preview-wrapper" style="position:relative;width:100%;height:160px;border:3px solid var(--ink-900);border-radius:var(--radius-card);background-color:var(--white);overflow:hidden;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <img src="${currentUploadedImageSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" />
        <div class="scanner-scan-line"></div>
      </div>
      <div class="brick-stud-spinner">
        <div class="stud-spinner-top"></div>
        <div class="stud-spinner-body"></div>
      </div>
      <p class="brick-spinner-message font-display">${message}</p>
    </div>
  `;
  }
  function renderError(parent, message) {
    const container = document.createElement("div");
    container.className = "brick-feedback-state error";
    container.innerHTML = `
    <div class="feedback-icon-wrapper error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    </div>
    <h3 class="feedback-title font-display text-danger">Detection Failed</h3>
    <p class="feedback-desc">${message}</p>
    <button type="button" class="brick-btn brick-btn-danger brick-btn-small" id="rescan-retry-btn">Retry</button>
  `;
    container.querySelector("#rescan-retry-btn").onclick = () => {
      scanState = "idle";
      renderScanner(parent);
    };
    parent.appendChild(container);
  }
  function renderResults(parent) {
    parent.innerHTML = "";
    const container = document.createElement("div");
    container.className = "scanner-results-state";
    const headerActions = document.createElement("div");
    headerActions.className = "results-header-actions";
    const title = document.createElement("h4");
    title.className = "font-display";
    title.textContent = `Pieces Identified (${candidates.length})`;
    headerActions.appendChild(title);
    const actionsGroup = document.createElement("div");
    actionsGroup.className = "header-action-buttons";
    if (candidates.length > 1) {
      const addAllBtn = document.createElement("button");
      addAllBtn.type = "button";
      addAllBtn.className = "brick-btn brick-btn-success brick-btn-small";
      addAllBtn.innerHTML = `Add All`;
      addAllBtn.onclick = async () => {
        const promises = candidates.map(async (cand, idx) => {
          if (!addedIndices.has(idx)) {
            await addInventoryItem(cand.corrected ? {
              type: cand.part.type,
              color_id: cand.part.color_id,
              quantity: 1,
              source_image_key: cand.label
            } : { part_id: cand.part.part_id, quantity: 1, source_image_key: cand.label });
            addedIndices.add(idx);
          }
        });
        await Promise.all(promises);
        triggerInventoryUpdate();
        showToast(`Added ${pluralParts(promises.length)} to your inventory`);
        renderResults(parent);
      };
      actionsGroup.appendChild(addAllBtn);
    }
    const rescanBtn = document.createElement("button");
    rescanBtn.type = "button";
    rescanBtn.className = "brick-btn brick-btn-secondary brick-btn-small";
    rescanBtn.innerHTML = `Rescan`;
    rescanBtn.onclick = () => {
      scanState = "idle";
      candidates = [];
      renderScanner(parent);
    };
    actionsGroup.appendChild(rescanBtn);
    headerActions.appendChild(actionsGroup);
    container.appendChild(headerActions);
    const list = document.createElement("div");
    list.className = "candidates-list";
    candidates.forEach((cand, idx) => {
      const isAdded = addedIndices.has(idx);
      const itemCard = document.createElement("div");
      itemCard.className = "brick-card candidate-card";
      itemCard.innerHTML = `
      <div class="brick-card-body">
        <div class="candidate-card-layout">
          <div class="candidate-image-wrapper">
            <img ${partImageAttrs(cand.part, cand.part.part_name)} class="candidate-part-img" />
          </div>
          <div class="candidate-info-wrapper">
            <div class="candidate-header-row">
              <span class="candidate-category font-display">${cand.part.category}</span>
              ${cand.corrected ? `<span class="confidence-badge corrected" title="You changed this result">Corrected</span>` : `<span class="confidence-badge ${cand.confidence > 90 ? "high" : ""}">${cand.confidence}% Match</span>`}
            </div>
            <h5 class="candidate-name font-display">${cand.part.part_name}</h5>
            
            <div class="candidate-actions">
              ${isAdded ? `<div class="added-badge font-display text-success">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                     Added to Bin
                   </div>` : `<button type="button" class="brick-btn brick-btn-small correct-btn"
                           title="Change the detected shape or colour">Edit</button>
                   <button type="button" class="brick-btn brick-btn-primary brick-btn-small add-to-bin-btn">Add to bin</button>`}
            </div>
          </div>
        </div>
      </div>
    `;
      const correctBtn = itemCard.querySelector(".correct-btn");
      if (correctBtn) {
        correctBtn.onclick = () => openCorrectionEditor(itemCard, cand, idx, parent);
      }
      const addBtn = itemCard.querySelector(".add-to-bin-btn");
      if (addBtn) {
        addBtn.onclick = async () => {
          try {
            await addInventoryItem(cand.corrected ? {
              type: cand.part.type,
              color_id: cand.part.color_id,
              quantity: 1,
              source_image_key: cand.label
            } : { part_id: cand.part.part_id, quantity: 1, source_image_key: cand.label });
            addedIndices.add(idx);
            triggerInventoryUpdate();
            showToast(`Added ${cand.part.part_name} to your inventory`);
            renderResults(parent);
          } catch (err) {
            showToast("Could not add that part - please try again.");
          }
        };
      }
      list.appendChild(itemCard);
    });
    container.appendChild(list);
    parent.appendChild(container);
  }

  // js/components/inventory.js
  function getBrickColorStyles(colorName) {
    const colors = {
      "Red": { bg: "#D01012", text: "#FFFFFF" },
      "Blue": { bg: "#0057A6", text: "#FFFFFF" },
      "Yellow": { bg: "#FFD500", text: "#22222A" },
      "White": { bg: "#FFFFFF", text: "#22222A" },
      "Grey": { bg: "#5B5B66", text: "#FFFFFF" },
      "Green": { bg: "#1E7A34", text: "#FFFFFF" }
    };
    return colors[colorName] || { bg: "#E2E8F0", text: "#22222A" };
  }
  var inventoryItems = [];
  var inventoryLoading = true;
  var inventoryError = null;
  var searchQuery = "";
  var selectedCategory = "All";
  var selectedColor = "All";
  var resizeObserver = null;
  var currentWidthClass = "width-wide";
  function escapeHtml3(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var RAINBOW = "linear-gradient(135deg,#D01012 0 25%,#FFD500 25% 50%,#1E7A34 50% 75%,#0057A6 75% 100%)";
  function hueKey(hex) {
    const h = String(hex || "").replace("#", "");
    if (h.length !== 6) return [3, 0, 0];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (sat < 0.15) return [2, -l, 0];
    let hue;
    if (max === r) hue = ((g - b) / d + 6) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    return [1, hue * 60, -l];
  }
  function bySpectrum(a, b) {
    const ka = hueKey(a.hex), kb = hueKey(b.hex);
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.label.localeCompare(b.label);
  }
  function colorFilterControl(parentEl) {
    const wrap = document.createElement("div");
    wrap.className = "color-filter-wrapper";
    const colors = [];
    const seen = /* @__PURE__ */ new Set();
    inventoryItems.forEach((i) => {
      const tag = resolveColorTag(i);
      if (tag.label && !seen.has(tag.label)) {
        seen.add(tag.label);
        colors.push(tag);
      }
    });
    colors.sort(bySpectrum);
    const active = colors.find((c) => c.label === selectedColor);
    const dotStyle = (hex) => `background:${hex || "transparent"};${hex ? "" : `background:${RAINBOW};`}`;
    wrap.innerHTML = `
    <button type="button" class="color-filter-btn font-display" id="inv-color-btn"
            aria-haspopup="dialog" aria-expanded="false">
      <span class="color-filter-dot" style="${dotStyle(active ? active.hex : null)}"></span>
      <span class="color-filter-label">${selectedColor === "All" ? "Any colour" : escapeHtml3(selectedColor)}</span>
      <svg class="color-filter-caret" width="10" height="10" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="4" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="color-filter-pop" hidden role="dialog" aria-label="Filter by colour">
      <input type="search" class="color-filter-search font-body" placeholder="Search colours..." />
      <div class="color-filter-grid" role="listbox" aria-label="Colours in your bin"></div>
      <div class="color-filter-foot font-body"><span class="cf-hint">${colors.length} colours in your bin</span></div>
    </div>
  `;
    const btn = wrap.querySelector("#inv-color-btn");
    const pop = wrap.querySelector(".color-filter-pop");
    const grid = wrap.querySelector(".color-filter-grid");
    const search = wrap.querySelector(".color-filter-search");
    const foot = wrap.querySelector(".cf-hint");
    const choose = (label) => {
      selectedColor = label;
      close();
      renderInventory(parentEl);
    };
    function renderGrid() {
      const q = search.value.trim().toLowerCase();
      const matches = colors.filter((c) => !q || c.label.toLowerCase().includes(q));
      grid.innerHTML = "";
      const all = document.createElement("button");
      all.type = "button";
      all.className = `color-filter-swatch is-all ${selectedColor === "All" ? "is-selected" : ""}`;
      all.setAttribute("role", "option");
      all.setAttribute("aria-selected", String(selectedColor === "All"));
      all.title = "Any colour";
      all.style.background = RAINBOW;
      all.onclick = () => choose("All");
      grid.appendChild(all);
      matches.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        const on = selectedColor === c.label;
        b.className = `color-filter-swatch ${on ? "is-selected" : ""}`;
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(on));
        b.title = c.label;
        b.style.background = c.hex || "#CCC";
        b.onclick = () => choose(c.label);
        b.onmouseenter = () => {
          foot.textContent = c.label;
        };
        b.onfocus = () => {
          foot.textContent = c.label;
        };
        grid.appendChild(b);
      });
      if (!matches.length && q) {
        const p = document.createElement("p");
        p.className = "color-filter-empty font-body";
        p.textContent = `No colour matches "${search.value}"`;
        grid.appendChild(p);
      }
    }
    const onDocClick = (e) => {
      if (!wrap.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        btn.focus();
      }
    };
    function open() {
      pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
      search.value = "";
      renderGrid();
      search.focus();
    }
    function close() {
      if (pop.hidden) return;
      pop.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    }
    btn.onclick = () => {
      pop.hidden ? open() : close();
    };
    search.oninput = renderGrid;
    grid.onmouseleave = () => {
      foot.textContent = selectedColor === "All" ? `${colors.length} colours in your bin` : selectedColor;
    };
    renderGrid();
    return wrap;
  }
  function renderInventory(parentEl) {
    parentEl.innerHTML = "";
    const container = document.createElement("div");
    container.className = `inventory-panel-container ${currentWidthClass}`;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        let nextClass = "width-wide";
        if (width < 360) {
          nextClass = "width-narrow";
        } else if (width < 480) {
          nextClass = "width-medium";
        }
        if (nextClass !== currentWidthClass) {
          currentWidthClass = nextClass;
          container.className = `inventory-panel-container ${currentWidthClass}`;
        }
      }
    });
    setTimeout(() => {
      const panelDom = document.getElementById("panel-inventory");
      if (panelDom) resizeObserver.observe(panelDom);
    }, 100);
    if (inventoryLoading && inventoryItems.length === 0) {
      loadInventoryData(parentEl);
      return;
    }
    const headerSearch = document.createElement("div");
    headerSearch.className = "inventory-header-search";
    const searchBox = document.createElement("div");
    searchBox.className = "search-box-wrapper";
    searchBox.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    <input type="text" class="search-input" placeholder="Search parts bin..." id="inv-search-input" value="${searchQuery}" />
  `;
    const searchInput = searchBox.querySelector("#inv-search-input");
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      renderListBody(container);
    };
    headerSearch.appendChild(searchBox);
    headerSearch.appendChild(colorFilterControl(parentEl));
    container.appendChild(headerSearch);
    const typeRow = document.createElement("div");
    typeRow.className = "inv-type-chips";
    typeRow.setAttribute("role", "tablist");
    typeRow.setAttribute("aria-label", "Filter by part type");
    const catCounts = /* @__PURE__ */ new Map();
    inventoryItems.forEach((i) => {
      catCounts.set(i.category, (catCounts.get(i.category) || 0) + (i.quantity || 0));
    });
    const totalQty = [...catCounts.values()].reduce((a, b) => a + b, 0);
    const mkChip = (label, count) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const on = selectedCategory === label;
      chip.className = `inv-type-chip font-display ${on ? "is-active" : ""}`;
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-selected", String(on));
      chip.innerHTML = `${escapeHtml3(label)} <span class="inv-chip-count">${count}</span>`;
      chip.onclick = () => {
        selectedCategory = label;
        renderInventory(parentEl);
      };
      return chip;
    };
    typeRow.appendChild(mkChip("All", totalQty));
    [...catCounts.keys()].sort().forEach((cat) => typeRow.appendChild(mkChip(cat, catCounts.get(cat))));
    container.appendChild(typeRow);
    const totalsBar = document.createElement("div");
    totalsBar.className = "inventory-running-totals font-display";
    totalsBar.id = "inv-totals-bar";
    container.appendChild(totalsBar);
    const listPlaceholder = document.createElement("div");
    listPlaceholder.id = "inv-list-placeholder";
    listPlaceholder.style.flex = "1";
    listPlaceholder.style.display = "flex";
    listPlaceholder.style.flexDirection = "column";
    container.appendChild(listPlaceholder);
    const floatingAddBtn = document.createElement("button");
    floatingAddBtn.type = "button";
    floatingAddBtn.className = "inventory-floating-add-btn";
    floatingAddBtn.title = "Add Piece Manually";
    floatingAddBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  `;
    floatingAddBtn.onclick = (e) => {
      e.stopPropagation();
      spawnStandalonePanel("addPart", {});
    };
    container.appendChild(floatingAddBtn);
    parentEl.appendChild(container);
    renderListBody(container);
  }
  async function loadInventoryData(parent) {
    inventoryLoading = true;
    inventoryError = null;
    renderSpinner2(parent, "Retrieving catalogued parts...");
    try {
      const data = await getInventory();
      inventoryItems = data;
      inventoryLoading = false;
      renderInventory(parent);
    } catch (err) {
      inventoryError = "Could not retrieve your brick inventory.";
      inventoryLoading = false;
      renderErrorState(parent);
    }
  }
  function renderListBody(container) {
    const listPlaceholder = container.querySelector("#inv-list-placeholder");
    const totalsBar = container.querySelector("#inv-totals-bar");
    if (!listPlaceholder) return;
    listPlaceholder.innerHTML = "";
    const filtered = inventoryItems.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const tag = resolveColorTag(item);
      const haystack = [item.part_name, tag.label, item.element_id, item.part_num].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
      const matchesColor = selectedColor === "All" || tag.label === selectedColor;
      return matchesSearch && matchesCat && matchesColor;
    });
    const totalCount = inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0);
    const categories = ["All", ...new Set(inventoryItems.map((i) => i.category))];
    totalsBar.innerHTML = `
    <span>Bricks Catalogued: ${totalCount} total</span>
    <span>Categories: ${categories.length - 1}</span>
  `;
    if (filtered.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "brick-feedback-state empty";
      emptyState.innerHTML = `
      <div class="feedback-icon-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </div>
      <h3 class="feedback-title font-display">${searchQuery ? "No filter matches" : "Inventory is empty"}</h3>
      <p class="feedback-desc">
        ${searchQuery ? "Try widening your search terms or category filter." : "Add parts from the Scanner Panel to compile your inventory!"}
      </p>
    `;
      listPlaceholder.appendChild(emptyState);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "inventory-items-grid";
    filtered.forEach((item) => {
      const parsed = parsePartNameAndColor(item.part_name);
      const tag = resolveColorTag(item);
      const colorStyles = tag.hex ? { bg: tag.hex, text: contrastTextFor(tag.hex) } : getBrickColorStyles(tag.label);
      const card = document.createElement("div");
      card.className = "brick-card inventory-part-card";
      card.innerHTML = `
      <div class="part-card-inner">
        <div class="part-img-holder">
          <img ${partImageAttrs(item, parsed.name)} />
        </div>
        <div class="part-card-content">
          <div class="part-meta-row font-display" style="display:flex; gap:5px; margin-bottom:4px">
            <span class="part-badge-cat" style="background-color: var(--cream-200); border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 1px 4px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--ink-900);">${item.category}</span>
            <span class="part-badge-color" style="background-color: ${colorStyles.bg}; color: ${colorStyles.text}; border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 1px 4px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase;">${tag.label}</span>
          </div>
          <h6 class="part-display-name font-display" title="${parsed.name}">${parsed.name}</h6>
          
          <div class="part-card-footer-actions" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: auto; width: 100%;">
            <div class="qty-picker" style="display: flex; align-items: center; border: 2px solid var(--ink-900); border-radius: 6px; background-color: var(--white); overflow: hidden; flex-shrink: 0; height: 22px;">
              <button type="button" class="qty-picker-btn font-display decrease-btn" style="background: transparent; border: none; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink-900); padding: 0;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              <input type="number" class="qty-value font-display qty-input" value="${item.quantity}" style="width: 26px; text-align: center; border: none; background: transparent; padding: 0; outline: none; font-weight: 800; font-size: 0.75rem; -moz-appearance: textfield; color: var(--ink-900); margin: 0; border-left: 2px solid var(--ink-900); border-right: 2px solid var(--ink-900); height: 22px;" />
              <button type="button" class="qty-picker-btn font-display increase-btn" style="background: transparent; border: none; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink-900); padding: 0;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
            </div>
            <button type="button" class="part-popout-btn popout-btn" title="Drag out to Workspace" style="padding: 0; border: 2px solid var(--ink-900); background-color: var(--white); border-radius: 6px; box-shadow: 0 2px 0 var(--ink-900); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--grey-600); width: 22px; height: 22px; box-sizing: border-box; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
            <button type="button" class="part-delete-btn delete-btn" title="Remove item" style="padding: 0; border: 2px solid var(--ink-900); background-color: var(--white); border-radius: 6px; box-shadow: 0 2px 0 var(--ink-900); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--grey-600); width: 22px; height: 22px; box-sizing: border-box; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </div>
      </div>
    `;
      card.querySelector(".decrease-btn").onclick = (e) => {
        e.stopPropagation();
        adjustQuantity(item.inventory_id, item.quantity - 1, container);
      };
      card.querySelector(".increase-btn").onclick = (e) => {
        e.stopPropagation();
        adjustQuantity(item.inventory_id, item.quantity + 1, container);
      };
      card.querySelector(".delete-btn").onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removePiece(item.inventory_id, container);
      };
      card.querySelector(".popout-btn").onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        spawnStandalonePanel("part", item);
      };
      card.querySelector(".qty-input").onchange = (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        adjustQuantity(item.inventory_id, val, container);
      };
      card.querySelector(".qty-input").onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      grid.appendChild(card);
    });
    listPlaceholder.appendChild(grid);
  }
  async function adjustQuantity(inventory_id, newQty, container) {
    try {
      if (newQty <= 0) {
        if (confirm("Are you sure you want to remove this part from your inventory?")) {
          await deleteInventoryItem(inventory_id);
        } else {
          const data2 = await getInventory();
          inventoryItems = data2;
          triggerInventoryUpdate();
          renderListBody(container);
          return;
        }
      } else {
        await updateInventoryItem(inventory_id, { quantity: newQty });
      }
      const data = await getInventory();
      inventoryItems = data;
      triggerInventoryUpdate();
      renderListBody(container);
    } catch (err) {
      alert("Failed to update brick count");
    }
  }
  async function removePiece(inventory_id, container) {
    const confirmation = confirm("Are you sure you want to remove this part from your inventory?");
    if (!confirmation) {
      return;
    }
    try {
      await deleteInventoryItem(inventory_id);
      const data = await getInventory();
      inventoryItems = data;
      triggerInventoryUpdate();
      renderListBody(container);
    } catch (err) {
      alert("Failed to remove piece");
    }
  }
  function renderSpinner2(parent, message) {
    parent.innerHTML = `
    <div class="brick-spinner-container" style="height:100%">
      <div class="brick-stud-spinner">
        <div class="stud-spinner-top"></div>
        <div class="stud-spinner-body"></div>
      </div>
      <p class="brick-spinner-message font-display">${message}</p>
    </div>
  `;
  }
  function renderErrorState(parent) {
    parent.innerHTML = `
    <div class="brick-feedback-state error">
      <div class="feedback-icon-wrapper error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <h3 class="feedback-title font-display text-danger">Inventory Load Failed</h3>
      <p class="feedback-desc">${inventoryError}</p>
      <button type="button" class="brick-btn brick-btn-danger brick-btn-small" id="inv-retry-btn">Retry</button>
    </div>
  `;
    parent.querySelector("#inv-retry-btn").onclick = () => {
      loadInventoryData(parent);
    };
  }
  function forceReloadInventory() {
    inventoryLoading = true;
    inventoryItems = [];
  }

  // js/api/builds.js
  var sleep4 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function calculatePctOwned(build2) {
    let totalRequired = 0;
    let totalOwned = 0;
    build2.parts.forEach((req) => {
      totalRequired += req.quantity_required;
      const invItem = mockInventory.find((i) => i.part_id === req.part_id);
      const ownedCount = invItem ? invItem.quantity : 0;
      totalOwned += Math.min(ownedCount, req.quantity_required);
    });
    if (totalRequired === 0) return 100;
    return Math.round(totalOwned / totalRequired * 100);
  }
  async function getBuilds() {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/builds`, {
        headers: { ...authHeader() }
      });
      if (!res.ok) throw new Error("Failed to fetch builds");
      return await res.json();
    }
    await sleep4(700);
    return MOCK_BUILDS.map((build2) => ({
      build_id: build2.build_id,
      build_name: build2.build_name,
      description: build2.description,
      difficulty: build2.difficulty,
      hero_image_url: build2.hero_image_url,
      pct_owned: calculatePctOwned(build2)
    }));
  }
  async function getBuildDetail(build_id) {
    if (!IS_MOCKED) {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/builds/${build_id}`, {
        headers: { ...authHeader() }
      });
      if (!res.ok) throw new Error("Failed to fetch build detail");
      return await res.json();
    }
    await sleep4(500);
    const build2 = MOCK_BUILDS.find((b) => b.build_id === build_id);
    if (!build2) {
      throw new Error(`Build idea ${build_id} not found`);
    }
    const detailedParts = build2.parts.map((req) => {
      const partRef = MOCK_PARTS.find((p) => p.part_id === req.part_id);
      const invItem = mockInventory.find((i) => i.part_id === req.part_id);
      const quantity_owned = invItem ? invItem.quantity : 0;
      return {
        part_id: req.part_id,
        part_name: partRef ? partRef.part_name : req.part_name,
        reference_image_url: partRef ? partRef.reference_image_url : "",
        quantity_required: req.quantity_required,
        quantity_owned
      };
    });
    return {
      build_id: build2.build_id,
      build_name: build2.build_name,
      description: build2.description,
      difficulty: build2.difficulty,
      hero_image_url: build2.hero_image_url,
      parts: detailedParts,
      steps: build2.steps || []
    };
  }

  // js/components/builds.js
  async function requestMissingPartsEmail(buildId, btn) {
    const original = btn ? btn.textContent : null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending\u2026";
    }
    try {
      await ensureFreshToken();
      const res = await fetch(`${API_BASE_URL}/builds/${buildId}/email-missing-parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
      showToast(data.message || "Sent - check your inbox for the parts list");
      if (btn) btn.textContent = "Sent \u2713";
    } catch (err) {
      showToast(err.message || "Could not send that email.");
      if (btn) btn.textContent = original;
    } finally {
      if (btn) {
        btn.disabled = false;
        setTimeout(() => {
          if (btn.isConnected) btn.textContent = original;
        }, 2500);
      }
    }
  }
  var buildsList = [];
  var activeBuildId = null;
  var activeBuildDetail = null;
  var buildsPanelBody = null;
  var buildsLoading = true;
  var buildsError = null;
  var detailLoading = false;
  var detailError = null;
  function renderBuilds(parentEl) {
    buildsPanelBody = parentEl;
    parentEl.innerHTML = "";
    const container = document.createElement("div");
    container.className = "builds-panel-container";
    if (activeBuildId !== null) {
      renderDetailView(container);
    } else {
      renderCatalogView(container);
    }
    parentEl.appendChild(container);
  }
  function renderCatalogView(container) {
    const catalogView = document.createElement("div");
    catalogView.className = "build-catalog-view";
    if (buildsLoading && buildsList.length === 0) {
      loadBuildsCatalog(container);
      return;
    }
    if (buildsError) {
      renderError2(catalogView, buildsError, () => loadBuildsCatalog(container));
      container.appendChild(catalogView);
      return;
    }
    if (buildsList.length === 0) {
      renderEmpty(catalogView);
      container.appendChild(catalogView);
      return;
    }
    const list = document.createElement("div");
    list.className = "builds-list";
    buildsList.forEach((build2) => {
      const is100Percent = build2.pct_owned === 100;
      const card = document.createElement("div");
      card.className = "build-card";
      card.onclick = () => selectBuild(build2.build_id, container);
      card.innerHTML = `
      <img src="${build2.hero_image_url}" alt="${build2.build_name}" class="build-img" />
      <button type="button" class="build-popout-btn popout-btn" title="View Instructions" style="position: absolute; top: 8px; left: 8px; width: 28px; height: 28px; border-radius: 6px; border: 2.5px solid var(--ink-900); background-color: var(--brick-blue); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 5; box-shadow: 0 2.5px 0 var(--ink-900)">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--white)" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </button>
      <div class="build-info">
        <span class="build-difficulty-tag font-display">${build2.difficulty}</span>
        <h4>${build2.build_name}</h4>
        
        <div class="progress-container">
          <div class="progress-bar" style="width: ${build2.pct_owned}%; background-color: ${is100Percent ? "var(--brick-green)" : "var(--brick-purple)"}"></div>
        </div>
        <span class="pct-text font-display">${build2.pct_owned}% of parts owned</span>
        ${is100Percent ? "" : `
        <button type="button" class="build-email-btn font-display" data-build-id="${build2.build_id}"
                title="Email me the parts I'm missing for this build">
          Email missing parts
        </button>`}
      </div>
      ${is100Percent ? `<span class="build-ready-tag font-display">
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:2px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
             Ready!
           </span>` : ""}
    `;
      const emailBtn = card.querySelector(".build-email-btn");
      if (emailBtn) {
        emailBtn.onclick = (e) => {
          e.stopPropagation();
          requestMissingPartsEmail(build2.build_id, emailBtn);
        };
      }
      card.querySelector(".popout-btn").onclick = (e) => {
        e.stopPropagation();
        spawnStandalonePanel("build", {
          build_id: build2.build_id,
          name: build2.build_name,
          hero_image_url: build2.hero_image_url
        });
      };
      list.appendChild(card);
    });
    catalogView.appendChild(list);
    container.appendChild(catalogView);
  }
  function renderDetailView(container) {
    const detailView = document.createElement("div");
    detailView.className = "build-detail-view";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "back-btn font-display";
    backBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
    Back to builds
  `;
    backBtn.onclick = () => {
      activeBuildId = null;
      activeBuildDetail = null;
      renderBuilds(buildsPanelBody);
    };
    detailView.appendChild(backBtn);
    const popoutBtn = document.createElement("button");
    popoutBtn.type = "button";
    popoutBtn.className = "back-btn font-display";
    popoutBtn.style.marginLeft = "8px";
    popoutBtn.style.backgroundColor = "var(--brick-blue)";
    popoutBtn.style.color = "var(--white)";
    popoutBtn.style.border = "2.5px solid var(--ink-900)";
    popoutBtn.style.boxShadow = "0 2.5px 0 var(--ink-900)";
    popoutBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
    View Instructions
  `;
    popoutBtn.onclick = () => {
      spawnStandalonePanel("build", {
        build_id: activeBuildDetail.build_id,
        name: activeBuildDetail.build_name,
        hero_image_url: activeBuildDetail.hero_image_url
      });
    };
    detailView.appendChild(popoutBtn);
    if (detailLoading) {
      renderSpinner3(detailView, "Retrieving schematic parts checklist...");
      container.appendChild(detailView);
      return;
    }
    if (detailError) {
      renderError2(detailView, detailError, () => selectBuild(activeBuildId, container));
      container.appendChild(detailView);
      return;
    }
    if (activeBuildDetail) {
      const detailContent = document.createElement("div");
      detailContent.className = "detail-content-scroll";
      const hero = document.createElement("img");
      hero.className = "detail-hero";
      hero.src = activeBuildDetail.hero_image_url;
      hero.alt = activeBuildDetail.build_name;
      detailContent.appendChild(hero);
      const title = document.createElement("h4");
      title.className = "detail-title font-display";
      title.textContent = activeBuildDetail.build_name;
      detailContent.appendChild(title);
      const desc = document.createElement("p");
      desc.className = "detail-desc";
      desc.textContent = activeBuildDetail.description;
      detailContent.appendChild(desc);
      const listTitle = document.createElement("h5");
      listTitle.className = "parts-title font-display";
      listTitle.textContent = "Required Parts";
      detailContent.appendChild(listTitle);
      const partsList = document.createElement("div");
      partsList.className = "parts-list";
      activeBuildDetail.parts.forEach((part) => {
        const isComplete = part.quantity_owned >= part.quantity_required;
        const missingCount = part.quantity_required - part.quantity_owned;
        const partRow = document.createElement("div");
        partRow.className = `part-req-row ${isComplete ? "complete" : ""}`;
        partRow.innerHTML = `
        <img ${partImageAttrs(part, part.part_name)} class="part-req-img" />
        <div class="part-req-info font-body">
          <div style="flex:1">
            <span class="part-req-name font-display" style="display:block">${part.part_name}</span>
            <span style="font-size:0.75rem;color:var(--grey-600)">Owned: ${part.quantity_owned} / Required: ${part.quantity_required}</span>
          </div>
          <div class="part-req-qty">
            ${isComplete ? `<span style="color:var(--brick-green)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>` : `<span class="status-indicator warning font-display" style="background-color:rgba(255,213,0,0.15);border:1.5px solid var(--ink-900);border-radius:6px;font-size:0.7rem;font-weight:800;color:var(--ink-900);padding:2px 6px;display:flex;align-items:center;gap:4px">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <span>+${missingCount}</span>
                 </span>`}
          </div>
        </div>
      `;
        partsList.appendChild(partRow);
      });
      detailContent.appendChild(partsList);
      detailView.appendChild(detailContent);
    }
    container.appendChild(detailView);
  }
  async function loadBuildsCatalog(container) {
    buildsLoading = true;
    buildsError = null;
    renderSpinner3(container, "Calculating matching build plans...");
    try {
      const data = await getBuilds();
      buildsList = data;
      buildsLoading = false;
      renderBuilds(buildsPanelBody);
    } catch (err) {
      buildsError = "Could not retrieve build templates.";
      buildsLoading = false;
      renderBuilds(buildsPanelBody);
    }
  }
  async function selectBuild(buildId, container) {
    activeBuildId = buildId;
    detailLoading = true;
    detailError = null;
    renderBuilds(buildsPanelBody);
    try {
      const data = await getBuildDetail(buildId);
      activeBuildDetail = data;
      detailLoading = false;
      renderBuilds(buildsPanelBody);
    } catch (err) {
      detailError = "Could not fetch build instructions details.";
      detailLoading = false;
      renderBuilds(buildsPanelBody);
    }
  }
  function renderSpinner3(parent, message) {
    const spinner = document.createElement("div");
    spinner.className = "brick-spinner-container";
    spinner.style.height = "100%";
    spinner.innerHTML = `
    <div class="brick-stud-spinner">
      <div class="stud-spinner-top"></div>
      <div class="stud-spinner-body"></div>
    </div>
    <p class="brick-spinner-message font-display">${message}</p>
  `;
    parent.appendChild(spinner);
  }
  function renderError2(parent, message, onRetry) {
    const errState = document.createElement("div");
    errState.className = "brick-feedback-state error";
    errState.innerHTML = `
    <div class="feedback-icon-wrapper error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    </div>
    <h3 class="feedback-title font-display text-danger">Error Loading</h3>
    <p class="feedback-desc">${message}</p>
    <button type="button" class="brick-btn brick-btn-danger brick-btn-small" id="builds-retry-btn">Retry</button>
  `;
    errState.querySelector("#builds-retry-btn").onclick = onRetry;
    parent.appendChild(errState);
  }
  function renderEmpty(parent) {
    const empty = document.createElement("div");
    empty.className = "brick-feedback-state empty";
    empty.innerHTML = `
    <div class="feedback-icon-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    </div>
    <h3 class="feedback-title font-display">No builds discovered</h3>
    <p class="feedback-desc">No blueprints are matching the database.</p>
  `;
    parent.appendChild(empty);
  }
  async function reloadActiveBuildDetail() {
    if (activeBuildId === null) return;
    detailLoading = true;
    detailError = null;
    if (buildsPanelBody) {
      renderBuilds(buildsPanelBody);
    }
    try {
      const data = await getBuildDetail(activeBuildId);
      activeBuildDetail = data;
      detailLoading = false;
      if (buildsPanelBody) {
        renderBuilds(buildsPanelBody);
      }
    } catch (err) {
      detailError = "Could not fetch build instructions details.";
      detailLoading = false;
      if (buildsPanelBody) {
        renderBuilds(buildsPanelBody);
      }
    }
  }
  function forceReloadBuilds() {
    buildsLoading = true;
    buildsList = [];
    if (activeBuildId !== null) {
      reloadActiveBuildDetail();
    }
  }
  function closeBuildDetails() {
    activeBuildId = null;
    activeBuildDetail = null;
  }

  // js/components/addPart.js
  function renderAddPartPanel(bodyEl, panelId) {
    bodyEl.innerHTML = "";
    bodyEl.className = "panel-body-content add-part-panel";
    const loading = document.createElement("div");
    loading.className = "add-part-loading font-body";
    loading.textContent = "Loading the part catalogue\u2026";
    bodyEl.appendChild(loading);
    getCatalogue().then((catalogue) => build(bodyEl, panelId, catalogue)).catch((err) => {
      bodyEl.innerHTML = "";
      const msg = document.createElement("p");
      msg.className = "picker-empty font-body";
      msg.textContent = err.message || "Could not load the part catalogue.";
      bodyEl.appendChild(msg);
    });
  }
  function build(bodyEl, panelId, catalogue) {
    bodyEl.innerHTML = "";
    const form = document.createElement("div");
    form.className = "add-part-form";
    const shapePicker = createShapePicker(catalogue, { onChange: onShapeChange });
    const colorPicker = createColorPicker(catalogue, {
      type: shapePicker.get(),
      onChange: () => refreshPreview()
    });
    const preview = createPartPreview(catalogue, {
      type: shapePicker.get(),
      colorId: colorPicker.get()
    });
    function onShapeChange(type) {
      colorPicker.setShape(type);
      refreshPreview();
    }
    function refreshPreview() {
      preview.update(shapePicker.get(), colorPicker.get());
    }
    form.appendChild(shapePicker.el);
    form.appendChild(colorPicker.el);
    const footer = document.createElement("div");
    footer.className = "add-part-footer";
    footer.innerHTML = `
    <div class="qty-picker add-part-qty">
      <button type="button" class="manual-qty-btn dec-qty" aria-label="Decrease quantity">-</button>
      <input type="number" class="manual-qty-val font-body" value="1" min="1" aria-label="Quantity" />
      <button type="button" class="manual-qty-btn inc-qty" aria-label="Increase quantity">+</button>
    </div>
    <button type="button" class="brick-btn brick-btn-primary add-part-submit-btn font-display">Add to Bin</button>
  `;
    form.appendChild(preview.el);
    form.appendChild(footer);
    bodyEl.appendChild(form);
    const qtyInput = footer.querySelector(".manual-qty-val");
    footer.querySelector(".dec-qty").onclick = () => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) - 1);
    };
    footer.querySelector(".inc-qty").onclick = () => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) + 1);
    };
    const submitBtn = footer.querySelector(".add-part-submit-btn");
    submitBtn.onclick = async () => {
      const type = shapePicker.get();
      const colorId = colorPicker.get();
      const qty = Math.max(1, parseInt(qtyInput.value) || 1);
      const p = previewPart(catalogue, type, colorId);
      if (!p) {
        showToast("Choose a shape and a colour first.");
        return;
      }
      submitBtn.disabled = true;
      const original = submitBtn.textContent;
      submitBtn.textContent = "Adding\u2026";
      try {
        if (IS_MOCKED) {
          let existing = MOCK_PARTS.find((x) => x.type === type && x.color === p.color_hex);
          let partId;
          if (existing) {
            partId = existing.part_id;
          } else {
            partId = Math.max(...MOCK_PARTS.map((x) => x.part_id), 0) + 1;
            MOCK_PARTS.push({
              part_id: partId,
              part_name: p.part_name,
              category: p.category,
              color: p.color_hex,
              type,
              reference_image_url: getBrickSvg(p.color_hex, type)
            });
          }
          await addInventoryItem({ part_id: partId, quantity: qty, source_image_key: null });
        } else {
          await addInventoryItem({
            type,
            color_id: colorId,
            category: p.category,
            quantity: qty,
            source_image_key: null
          });
        }
        triggerInventoryUpdate();
        showToast(`Added ${qty} \xD7 ${p.part_name} to your inventory`);
        qtyInput.value = "1";
        submitBtn.disabled = false;
        submitBtn.textContent = "Added \u2713";
        setTimeout(() => {
          submitBtn.textContent = original;
        }, 1400);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = original;
        showToast(err.message || "Could not add that part.");
      }
    };
  }

  // js/components/workspace.js
  function renderWorkspace(parentEl, state2, isPositionOnly = false) {
    const existingContainer = parentEl.querySelector(".workspace-container");
    if (existingContainer) {
      existingContainer.setAttribute("data-theme", state2.theme);
      existingContainer.setAttribute("data-studs", state2.studStyle);
      existingContainer.classList.toggle("hct-pattern-active", state2.hctPatternEnabled);
      const baseplate2 = existingContainer.querySelector(".workspace-baseplate");
      const mountedPanelEls = baseplate2.querySelectorAll(".panel-container");
      mountedPanelEls.forEach((panelEl) => {
        const domId = panelEl.id.replace("panel-", "");
        const panelState = state2.panels[domId];
        if (!panelState || !panelState.isOpen) {
          panelEl.remove();
        }
      });
      Object.keys(state2.panels).forEach((key) => {
        const panelState = state2.panels[key];
        const panelEl = document.getElementById(`panel-${panelState.id}`);
        if (panelState.isOpen) {
          const viewportW = window.innerWidth;
          const viewportH = window.innerHeight;
          const clampedWidth = Math.min(panelState.width, viewportW - 16);
          const clampedHeight = Math.min(panelState.height, viewportH - 80);
          const clampedX = Math.max(8, Math.min(panelState.x, viewportW - clampedWidth - 8));
          const clampedY = Math.max(8, Math.min(panelState.y, viewportH - clampedHeight - 80));
          if (panelEl) {
            panelEl.style.left = `${clampedX}px`;
            panelEl.style.top = `${clampedY}px`;
            panelEl.style.width = `${clampedWidth}px`;
            panelEl.style.height = panelState.isCollapsed ? "54px" : `${clampedHeight}px`;
            panelEl.style.zIndex = panelState.zIndex;
            const chrome = panelEl.querySelector(".panel-chrome");
            if (chrome) {
              if (panelState.isCollapsed) {
                chrome.classList.add("is-collapsed");
              } else {
                chrome.classList.remove("is-collapsed");
              }
            }
            const studsRow = panelEl.querySelector(".panel-studs-row");
            if (studsRow) {
              const numStuds = Math.max(4, Math.floor((clampedWidth - 32) / 60));
              studsRow.innerHTML = "";
              for (let i = 0; i < numStuds; i++) {
                const stud = document.createElement("div");
                stud.className = "panel-stud";
                studsRow.appendChild(stud);
              }
            }
            if (!isPositionOnly) {
              const bodyContent = panelEl.querySelector(".panel-body-content");
              if (bodyContent) {
                if (panelState.id === "scanner") {
                } else if (panelState.id === "inventory") {
                  renderInventory(bodyContent);
                } else if (panelState.id === "buildIdeas") {
                  renderBuilds(bodyContent);
                } else if (panelState.type === "part") {
                  renderStandalonePart(bodyContent, panelState.data, panelState.id);
                } else if (panelState.type === "build") {
                  renderStandaloneBuild(bodyContent, panelState.data);
                } else if (panelState.type === "addPart") {
                  renderAddPartPanel(bodyContent, panelState.id);
                }
              }
            }
          } else {
            const clampedPanelState = {
              ...panelState,
              x: clampedX,
              y: clampedY,
              width: clampedWidth,
              height: clampedHeight
            };
            const newEl = createPanel(clampedPanelState, (body) => {
              if (panelState.id === "scanner") renderScanner(body);
              else if (panelState.id === "inventory") renderInventory(body);
              else if (panelState.id === "buildIdeas") renderBuilds(body);
              else if (panelState.type === "part") renderStandalonePart(body, panelState.data, panelState.id);
              else if (panelState.type === "build") renderStandaloneBuild(body, panelState.data);
              else if (panelState.type === "addPart") renderAddPartPanel(body, panelState.id);
            });
            if (newEl) baseplate2.appendChild(newEl);
          }
        }
      });
      const existingActionBar = existingContainer.querySelector(".action-bar-wrapper");
      if (existingActionBar) {
        const newActionBar = createActionBar(state2);
        existingActionBar.replaceWith(newActionBar);
      }
      const settingsBackdrop = existingContainer.querySelector(".settings-overlay-backdrop");
      if (state2.isSettingsOpen) {
        renderSettingsModal(existingContainer, state2);
      } else {
        if (settingsBackdrop) settingsBackdrop.remove();
      }
      return;
    }
    parentEl.innerHTML = "";
    const container = document.createElement("div");
    container.className = "workspace-container";
    container.setAttribute("data-theme", state2.theme);
    container.setAttribute("data-studs", state2.studStyle);
    container.classList.toggle("hct-pattern-active", state2.hctPatternEnabled);
    const logoIcon = document.createElement("button");
    logoIcon.type = "button";
    logoIcon.className = "workspace-logo-icon";
    logoIcon.title = "Open All Panels";
    logoIcon.innerHTML = `<img src="assets/logo_icon.png" alt="Logo" />`;
    logoIcon.onclick = (e) => {
      e.stopPropagation();
      openAllPanels();
    };
    container.appendChild(logoIcon);
    const baseplate = document.createElement("div");
    baseplate.className = "workspace-baseplate";
    const dots = document.createElement("div");
    dots.className = "workspace-dots";
    baseplate.appendChild(dots);
    Object.keys(state2.panels).forEach((key) => {
      const panelState = state2.panels[key];
      if (panelState.isOpen) {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const clampedWidth = Math.min(panelState.width, viewportW - 16);
        const clampedHeight = Math.min(panelState.height, viewportH - 80);
        const clampedX = Math.max(8, Math.min(panelState.x, viewportW - clampedWidth - 8));
        const clampedY = Math.max(8, Math.min(panelState.y, viewportH - clampedHeight - 80));
        const clampedPanelState = {
          ...panelState,
          x: clampedX,
          y: clampedY,
          width: clampedWidth,
          height: clampedHeight
        };
        const el = createPanel(clampedPanelState, (body) => {
          if (panelState.id === "scanner") renderScanner(body);
          else if (panelState.id === "inventory") renderInventory(body);
          else if (panelState.id === "buildIdeas") renderBuilds(body);
          else if (panelState.type === "part") renderStandalonePart(body, panelState.data, panelState.id);
          else if (panelState.type === "build") renderStandaloneBuild(body, panelState.data);
          else if (panelState.type === "addPart") renderAddPartPanel(body, panelState.id);
        });
        if (el) baseplate.appendChild(el);
      }
    });
    container.appendChild(baseplate);
    const actionbarEl = createActionBar(state2);
    container.appendChild(actionbarEl);
    const menuContainer = document.createElement("div");
    menuContainer.className = "profile-menu-container";
    const profileBtn = document.createElement("button");
    profileBtn.type = "button";
    profileBtn.className = "workspace-profile-btn";
    profileBtn.title = "Profile & Options";
    profileBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32" style="display:block">
      <rect x="38" y="5" width="24" height="10" rx="2" fill="#FFD500" stroke="#22222A" stroke-width="6"/>
      <rect x="25" y="15" width="50" height="52" rx="14" fill="#FFD500" stroke="#22222A" stroke-width="6"/>
      <circle cx="40" cy="35" r="4.5" fill="#22222A"/>
      <circle cx="60" cy="35" r="4.5" fill="#22222A"/>
      <path d="M 38,48 C 43,54 57,54 62,48" fill="none" stroke="#22222A" stroke-width="5" stroke-linecap="round"/>
      <rect x="32" y="67" width="36" height="10" fill="#FFD500" stroke="#22222A" stroke-width="6"/>
    </svg>
    <div class="profile-cog-badge">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    </div>
  `;
    const slideMenu = document.createElement("div");
    slideMenu.className = "profile-sliding-menu";
    const subSettingsBtn = document.createElement("button");
    subSettingsBtn.type = "button";
    subSettingsBtn.className = "profile-menu-opt-btn settings";
    subSettingsBtn.title = "Open Settings Modal";
    subSettingsBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
  `;
    subSettingsBtn.onclick = (e) => {
      e.stopPropagation();
      toggleSettings();
    };
    slideMenu.appendChild(subSettingsBtn);
    const subLogoutBtn = document.createElement("button");
    subLogoutBtn.type = "button";
    subLogoutBtn.className = "profile-menu-opt-btn logout";
    subLogoutBtn.title = "Sign Out";
    subLogoutBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
  `;
    subLogoutBtn.onclick = (e) => {
      e.stopPropagation();
      signOut2();
    };
    slideMenu.appendChild(subLogoutBtn);
    profileBtn.onclick = (e) => {
      e.stopPropagation();
      menuContainer.classList.toggle("is-open");
    };
    document.addEventListener("mousedown", (e) => {
      if (!menuContainer.contains(e.target)) {
        menuContainer.classList.remove("is-open");
      }
    });
    menuContainer.appendChild(profileBtn);
    menuContainer.appendChild(slideMenu);
    container.appendChild(menuContainer);
    if (state2.isSettingsOpen) {
      renderSettingsModal(container, state2);
    }
    parentEl.appendChild(container);
  }
  function renderSettingsModal(container, state2) {
    let backdrop = container.querySelector(".settings-overlay-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "settings-overlay-backdrop";
      backdrop.onclick = (e) => {
        if (e.target === backdrop) {
          playSound("click");
          closeSettings();
        }
      };
      container.appendChild(backdrop);
    }
    backdrop.innerHTML = "";
    const builderRank = "Loading\u2026";
    const card = document.createElement("div");
    card.className = "brick-card settings-modal-card";
    card.innerHTML = `
    <div class="panel-header">
      <span class="panel-title font-display" style="color:var(--white)">Workspace &amp; Profile Settings</span>
      <button type="button" class="panel-btn close" id="modal-settings-close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="panel-body-content" style="padding: 20px">
      <h4 class="settings-section-title">User Profile Details</h4>
      
      <div class="profile-badge-row font-body">
        <span class="profile-badge-label">Builder Rank</span>
        <span class="profile-rank-tag font-display">${builderRank}</span>
      </div>

      <div class="profile-field-group font-body" style="margin-bottom: 10px">
        <label class="profile-field-label">Display Username</label>
        <input type="text" class="profile-field-input" id="profile-username-input" value="${state2.user?.display_name || "MasterBuilder"}" />
      </div>

      <div class="profile-field-group font-body" style="margin-bottom: 16px">
        <label class="profile-field-label">User Email Address</label>
        <div class="profile-field-input" style="background: rgba(34,34,42,0.06); color: var(--grey-600); border-style: solid; font-weight: bold; pointer-events: none; user-select: text;">
          ${state2.user?.email || "builder@lego.com"}
        </div>
      </div>

      <h4 class="settings-section-title">Workspace Color Themes</h4>
      <div class="theme-studs-picker-container">
        <button type="button" class="theme-stud-selector ${state2.theme === "classic" ? "active" : ""}" data-theme-opt="classic" style="--stud-color: #FFD500" title="Classic Yellow"></button>
        <button type="button" class="theme-stud-selector ${state2.theme === "space-explorer" ? "active" : ""}" data-theme-opt="space-explorer" style="--stud-color: #38BDF8" title="Space Explorer Blue"></button>
        <button type="button" class="theme-stud-selector ${state2.theme === "neon-cyber" ? "active" : ""}" data-theme-opt="neon-cyber" style="--stud-color: #FF007F" title="Neon Cyber Pink"></button>
        <button type="button" class="theme-stud-selector ${state2.theme === "forest-ranger" ? "active" : ""}" data-theme-opt="forest-ranger" style="--stud-color: #3D7A44" title="Forest Ranger Moss"></button>
        <button type="button" class="theme-stud-selector ${state2.theme === "royal-knight" ? "active" : ""}" data-theme-opt="royal-knight" style="--stud-color: #E9C46A" title="Royal Knight Gold"></button>
      </div>

      <h4 class="settings-section-title">Baseplate Stud Patterns</h4>
      <div class="stud-preview-grid">
        <div class="stud-preview-box ${state2.studStyle === "circular" ? "active" : ""}" data-stud-opt="circular">
          <div class="preview-pattern"></div>
          <span class="preview-label font-display">Circular</span>
        </div>
        <div class="stud-preview-box ${state2.studStyle === "rounded-square" ? "active" : ""}" data-stud-opt="rounded-square">
          <div class="preview-pattern"></div>
          <span class="preview-label font-display">Square</span>
        </div>
        <div class="stud-preview-box ${state2.studStyle === "dense-lego" ? "active" : ""}" data-stud-opt="dense-lego">
          <div class="preview-pattern"></div>
          <span class="preview-label font-display">Dense LEGO</span>
        </div>
      </div>

      <h4 class="settings-section-title">Controls Configuration</h4>
      <div class="settings-options-grid">
        <button type="button" class="option-btn ${state2.snapEnabled ? "active" : ""}" id="modal-snap-toggle-btn">
          ${state2.snapEnabled ? "Grid Snapping: ON" : "Grid Snapping: OFF"}
        </button>
        <button type="button" class="option-btn ${state2.soundEnabled ? "active" : ""}" id="modal-sound-toggle-btn">
          ${state2.soundEnabled ? "Sound Effects: ON" : "Sound Effects: OFF"}
        </button>
      </div>

      <div class="settings-footnote font-display" style="font-size:0.75rem; color:var(--grey-600); text-align:center; margin-top:24px; opacity:0.65; font-weight:500;">
        Cloud Technologies for AI (CAI2C09), BRICKED-UP
      </div>
    </div>
  `;
    card.querySelector("#modal-settings-close").onclick = () => {
      playSound("click");
      closeSettings();
    };
    const usernameInput = card.querySelector("#profile-username-input");
    usernameInput.onchange = (e) => {
      const newName = e.target.value.trim();
      if (newName) {
        playSound("click");
        const updatedUser = { ...state2.user, display_name: newName };
        setUser(updatedUser, state2.idToken);
      }
    };
    card.querySelector("#modal-snap-toggle-btn").onclick = () => {
      playSound("click");
      toggleSnapEnabled();
    };
    card.querySelector("#modal-sound-toggle-btn").onclick = () => {
      playSound("click");
      toggleSoundEnabled();
    };
    card.querySelectorAll("[data-theme-opt]").forEach((btn) => {
      btn.onclick = () => {
        playSound("click");
        setTheme(btn.getAttribute("data-theme-opt"));
      };
    });
    card.querySelectorAll("[data-stud-opt]").forEach((btn) => {
      btn.onclick = () => {
        playSound("click");
        setStudStyle(btn.getAttribute("data-stud-opt"));
      };
    });
    getInventory().then((items) => {
      const total = (items || []).reduce((acc, curr) => acc + curr.quantity, 0);
      const rank = total > 20 ? "Master Designer" : total > 10 ? "Senior Builder" : "Apprentice Builder";
      const tag = card.querySelector(".profile-rank-tag");
      if (tag) tag.textContent = rank;
    }).catch(() => {
      const tag = card.querySelector(".profile-rank-tag");
      if (tag) tag.textContent = "Apprentice Builder";
    });
    backdrop.appendChild(card);
  }
  function getBrickColorStyles2(colorName) {
    const colors = {
      "Red": { bg: "#D01012", text: "#FFFFFF" },
      "Blue": { bg: "#0057A6", text: "#FFFFFF" },
      "Yellow": { bg: "#FFD500", text: "#22222A" },
      "White": { bg: "#FFFFFF", text: "#22222A" },
      "Grey": { bg: "#5B5B66", text: "#FFFFFF" },
      "Green": { bg: "#1E7A34", text: "#FFFFFF" }
    };
    return colors[colorName] || { bg: "#E2E8F0", text: "#22222A" };
  }
  function renderStandalonePart(body, item, panelId) {
    body.innerHTML = "";
    const spinner = document.createElement("div");
    spinner.className = "brick-spinner-container";
    spinner.style.height = "100%";
    spinner.style.display = "flex";
    spinner.style.flexDirection = "column";
    spinner.style.alignItems = "center";
    spinner.style.justifyContent = "center";
    spinner.innerHTML = `
    <div class="brick-stud-spinner">
      <div class="stud-spinner-top"></div>
      <div class="stud-spinner-body"></div>
    </div>
  `;
    body.appendChild(spinner);
    getInventory().then((items) => {
      const freshItem = items.find((i) => i.inventory_id === item.inventory_id);
      if (!freshItem) {
        closePanel(panelId);
        return;
      }
      body.innerHTML = "";
      const parsed = parsePartNameAndColor(freshItem.part_name);
      const colorStyles = getBrickColorStyles2(parsed.color);
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.padding = "16px";
      container.style.height = "100%";
      container.style.boxSizing = "border-box";
      const partTag = resolveColorTag(freshItem);
      container.innerHTML = `
      <div class="part-img-holder" style="width: 100px; height: 100px; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.75); border: 2.5px solid var(--ink-900); border-radius: var(--radius-card); box-shadow: inset 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 8px; box-sizing: border-box; padding: 8px;">
        <img ${partImageAttrs(freshItem, parsed.name)} style="max-width:90%; max-height:90%; object-fit:contain;" />
      </div>
      <div style="text-align: center; width: 100%;">
        <div style="display:flex; justify-content:center; gap:6px; margin-bottom:6px">
          <span class="part-badge-cat font-display" style="background-color: var(--cream-200); border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">${freshItem.category}</span>
          <span class="part-badge-color font-display" style="background-color: ${partTag.hex || colorStyles.bg}; color: ${partTag.hex ? contrastTextFor(partTag.hex) : colorStyles.text}; border: 1.5px solid var(--ink-900); border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">${partTag.label}</span>
        </div>
        <h4 class="font-display" style="font-size: 0.95rem; margin: 4px 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-900);" title="${parsed.name}">${parsed.name}</h4>
        <p style="font-family: var(--font-body); font-size: 0.78rem; color: var(--grey-600); margin: 0 0 8px 0;">
          Element <strong>${freshItem.element_id || "\u2014"}</strong>
          <span style="opacity:0.7"> &middot; Part ${freshItem.part_num || "\u2014"}</span>
        </p>
        
        <div class="part-card-footer-actions" style="justify-content: center; gap: 12px; display: flex; align-items: center; margin-top: 4px;">
          <div class="qty-picker">
            <button type="button" class="qty-picker-btn font-display decrease-btn"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
            <input type="number" class="qty-value font-display qty-input" value="${freshItem.quantity}" style="width: 28px; text-align: center; border: none; background: transparent; padding: 0; outline: none; font-weight: 800; font-size: 0.8rem; -moz-appearance: textfield; color: var(--ink-900);" />
            <button type="button" class="qty-picker-btn font-display increase-btn"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
          </div>
          <button type="button" class="part-delete-btn delete-btn" title="Remove item" style="padding: 6px; border: 2px solid var(--ink-900); background-color: var(--white); border-radius: 6px; box-shadow: 0 2px 0 var(--ink-900); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--grey-600);">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    `;
      const decreaseBtn = container.querySelector(".decrease-btn");
      const increaseBtn = container.querySelector(".increase-btn");
      const deleteBtn = container.querySelector(".delete-btn");
      const qtyInput = container.querySelector(".qty-input");
      const updateQty = async (newQty) => {
        try {
          if (newQty <= 0) {
            if (confirm("Are you sure you want to remove this part from your inventory?")) {
              await deleteInventoryItem(freshItem.inventory_id);
              closePanel(panelId);
              triggerInventoryUpdate();
            } else {
              qtyInput.value = freshItem.quantity;
            }
          } else {
            await updateInventoryItem(freshItem.inventory_id, { quantity: newQty });
            triggerInventoryUpdate();
          }
        } catch (err) {
          alert("Failed to update brick count");
        }
      };
      decreaseBtn.onclick = () => updateQty(freshItem.quantity - 1);
      increaseBtn.onclick = () => updateQty(freshItem.quantity + 1);
      qtyInput.onchange = (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        updateQty(val);
      };
      deleteBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you want to remove this part from your inventory?")) {
          try {
            await deleteInventoryItem(freshItem.inventory_id);
            closePanel(panelId);
            triggerInventoryUpdate();
          } catch (err) {
            alert("Failed to remove piece");
          }
        }
      };
      body.appendChild(container);
    }).catch((err) => {
      body.innerHTML = `<div style="padding:16px; text-align:center; color:var(--brick-red)" class="font-display">Error loading part details.</div>`;
    });
  }
  function renderStandaloneBuild(body, build2) {
    body.style.height = "100%";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.boxSizing = "border-box";
    const spinnerContainer = document.createElement("div");
    spinnerContainer.className = "brick-spinner-container";
    spinnerContainer.style.height = "100%";
    spinnerContainer.style.display = "flex";
    spinnerContainer.style.flexDirection = "column";
    spinnerContainer.style.alignItems = "center";
    spinnerContainer.style.justifyContent = "center";
    spinnerContainer.innerHTML = `
    <div class="brick-stud-spinner">
      <div class="stud-spinner-top"></div>
      <div class="stud-spinner-body"></div>
    </div>
    <p class="brick-spinner-message font-display">Retrieving schematic checklist...</p>
  `;
    body.appendChild(spinnerContainer);
    getBuildDetail(build2.build_id).then((detail) => {
      body.innerHTML = "";
      const detailContent = document.createElement("div");
      detailContent.className = "detail-content-scroll";
      detailContent.style.height = "100%";
      detailContent.style.overflowY = "auto";
      detailContent.style.padding = "12px";
      detailContent.style.boxSizing = "border-box";
      const hero = document.createElement("img");
      hero.className = "detail-hero";
      hero.src = detail.hero_image_url;
      hero.alt = detail.build_name;
      hero.style.width = "100%";
      hero.style.height = "140px";
      hero.style.objectFit = "cover";
      hero.style.borderRadius = "var(--radius-card)";
      hero.style.border = "2.5px solid var(--ink-900)";
      hero.style.boxSizing = "border-box";
      detailContent.appendChild(hero);
      const title = document.createElement("h4");
      title.className = "detail-title font-display";
      title.style.margin = "10px 0 4px 0";
      title.style.fontSize = "1.1rem";
      title.style.color = "var(--ink-900)";
      title.textContent = detail.build_name;
      detailContent.appendChild(title);
      const desc = document.createElement("p");
      desc.className = "detail-desc";
      desc.style.fontSize = "0.82rem";
      desc.style.color = "var(--grey-600)";
      desc.style.margin = "0 0 12px 0";
      desc.textContent = detail.description;
      detailContent.appendChild(desc);
      const listTitle = document.createElement("h5");
      listTitle.className = "parts-title font-display";
      listTitle.style.fontSize = "0.9rem";
      listTitle.style.margin = "0 0 8px 0";
      listTitle.textContent = "Required Parts";
      detailContent.appendChild(listTitle);
      const partsList = document.createElement("div");
      partsList.className = "parts-list";
      detail.parts.forEach((part) => {
        const isComplete = part.quantity_owned >= part.quantity_required;
        const missingCount = part.quantity_required - part.quantity_owned;
        const partRow = document.createElement("div");
        partRow.className = `part-req-row ${isComplete ? "complete" : ""}`;
        partRow.innerHTML = `
        <img ${partImageAttrs(part, part.part_name)} class="part-req-img" />
        <div class="part-req-info font-body" style="flex:1; display:flex; align-items:center; justify-content:space-between">
          <div style="flex:1">
            <span class="part-req-name font-display" style="display:block; font-size:0.8rem; color: var(--ink-900);">${part.part_name}</span>
            <span style="font-size:0.72rem;color:var(--grey-600)">Owned: ${part.quantity_owned} / Required: ${part.quantity_required}</span>
          </div>
          <div class="part-req-qty">
            ${isComplete ? `<span style="color:var(--brick-green); display:flex; align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>` : `<span class="status-indicator warning font-display" style="background-color:rgba(255,213,0,0.15);border:1.5px solid var(--ink-900);border-radius:6px;font-size:0.65rem;font-weight:800;color:var(--ink-900);padding:1px 5px;display:flex;align-items:center;gap:3px">
                  <span>+${missingCount}</span>
                 </span>`}
          </div>
        </div>
      `;
        partsList.appendChild(partRow);
      });
      detailContent.appendChild(partsList);
      const missingParts = detail.parts.filter((p) => p.quantity_owned < p.quantity_required);
      if (missingParts.length > 0) {
        const emailBtn = document.createElement("button");
        emailBtn.type = "button";
        emailBtn.className = "brick-btn email-missing-btn font-display";
        emailBtn.style.cssText = "margin-top:12px;width:100%;padding:8px;font-size:0.78rem;cursor:pointer;";
        emailBtn.textContent = `Email me the ${missingParts.length} missing part${missingParts.length === 1 ? "" : "s"}`;
        emailBtn.onclick = async () => {
          const original = emailBtn.textContent;
          emailBtn.disabled = true;
          emailBtn.textContent = "Sending\u2026";
          try {
            const res = await fetch(
              `${API_BASE_URL}/builds/${detail.build_id}/email-missing-parts`,
              { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() } }
            );
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            emailBtn.textContent = "Sent \u2014 check your inbox";
          } catch (err) {
            emailBtn.textContent = "Could not send \u2014 try again";
            emailBtn.disabled = false;
            console.error("email-missing-parts failed:", err);
            setTimeout(() => {
              emailBtn.textContent = original;
            }, 4e3);
          }
        };
        detailContent.appendChild(emailBtn);
      }
      const stepsTitle = document.createElement("h5");
      stepsTitle.className = "parts-title font-display";
      stepsTitle.style.fontSize = "0.9rem";
      stepsTitle.style.margin = "16px 0 8px 0";
      stepsTitle.style.borderTop = "2px dashed var(--ink-900)";
      stepsTitle.style.paddingTop = "12px";
      stepsTitle.textContent = "Assembly Instructions";
      detailContent.appendChild(stepsTitle);
      const stepsList = document.createElement("div");
      stepsList.className = "steps-checklist";
      stepsList.style.display = "flex";
      stepsList.style.flexDirection = "column";
      stepsList.style.gap = "8px";
      const steps = detail.steps || [];
      steps.forEach((step, idx) => {
        const stepRow = document.createElement("label");
        stepRow.className = "step-row font-body";
        stepRow.style.display = "flex";
        stepRow.style.alignItems = "flex-start";
        stepRow.style.gap = "8px";
        stepRow.style.cursor = "pointer";
        stepRow.style.fontSize = "0.8rem";
        stepRow.style.color = "var(--ink-900)";
        stepRow.innerHTML = `
        <input type="checkbox" class="step-checkbox" style="margin-top: 2px; cursor: pointer;" />
        <span class="step-text" style="transition: opacity 120ms ease, text-decoration 120ms ease;">${step}</span>
      `;
        const cb = stepRow.querySelector(".step-checkbox");
        const txt = stepRow.querySelector(".step-text");
        cb.onchange = () => {
          if (cb.checked) {
            txt.style.textDecoration = "line-through";
            txt.style.opacity = "0.5";
          } else {
            txt.style.textDecoration = "none";
            txt.style.opacity = "1";
          }
        };
        stepsList.appendChild(stepRow);
      });
      detailContent.appendChild(stepsList);
      body.appendChild(detailContent);
    }).catch((err) => {
      body.innerHTML = `<div style="padding:16px; text-align:center; color:var(--brick-red)" class="font-display">Error loading blueprint specs.</div>`;
    });
  }

  // js/app.js
  var prevUser = null;
  var prevRefreshKey = 0;
  async function init() {
    const root = document.getElementById("app");
    if (window.location.hash === "#logo") {
      root.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100vw; height: 100vh; background-color: #FFFFFF; font-family: var(--font-display);">
        <img src="favicon.png" style="width: 512px; height: 512px; border: 6px solid #22222A; border-radius: 28px; box-shadow: 0 12px 0 #22222A; animation: logo-bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);" alt="Favicon Logo" />
        <h2 style="margin-top: 24px; color: #22222A; font-size: 2.2rem; font-weight: 900; letter-spacing: 0.5px;">BRICKED-UP Logo</h2>
        <a href="#" style="margin-top: 16px; font-family: var(--font-body); font-size: 0.95rem; font-weight: bold; color: var(--brick-blue); text-decoration: none; border-bottom: 2px dashed var(--brick-blue); padding-bottom: 2px;" onclick="window.location.hash=''; window.location.reload();">\u2190 Back to Workspace</a>
        <style>
          @keyframes logo-bounce-in {
            0% { transform: scale(0.6); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>
      </div>
    `;
      return;
    }
    window.addEventListener("hashchange", () => {
      window.location.reload();
    });
    subscribe((state2, isPositionOnly) => {
      if (state2.isLoading) {
        root.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; background-color: var(--cream-100);">
          <div class="brick-spinner-container">
            <div class="brick-stud-spinner large">
              <div class="stud-spinner-top"></div>
              <div class="stud-spinner-body"></div>
            </div>
            <p class="brick-spinner-message font-display">Building Workspace...</p>
          </div>
        </div>
      `;
        return;
      }
      if (!state2.user) {
        if (prevUser !== null) {
          forceReloadInventory();
          forceReloadBuilds();
          closeBuildDetails();
          prevUser = null;
        }
        renderAuth(root);
        return;
      }
      prevUser = state2.user;
      if (state2.inventoryRefreshKey !== prevRefreshKey) {
        prevRefreshKey = state2.inventoryRefreshKey;
        forceReloadInventory();
        forceReloadBuilds();
      }
      renderWorkspace(root, state2, isPositionOnly);
    });
    setIsLoading(true);
    try {
      const stored = restoreSession();
      if (stored) {
        setUser(stored, "restored_session");
      }
      const cachedUser2 = await getCurrentUser();
      setUser(cachedUser2 || null, cachedUser2 ? "jwt_cached_session" : void 0);
    } catch (err) {
      console.error("Session restoration failed:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
    window.addEventListener("resize", () => {
      if (getState().user) {
        notify(true);
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        toggleHctPattern();
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
