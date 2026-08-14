import { signIn, signUp } from '../api/auth.js';
import { setUser, getState } from '../hooks/state.js';

let isSignUpMode = false;
let authLoading = false;
let authErrorMsg = null;
let authSuccessMsg = null;

let emailValue = '';
let passwordValue = '';
let displayNameValue = '';

let activeCancelAnimation = null;

/**
 * Renders the Auth Screen layout in Vanilla JS
 */
/**
 * The sign-in transition: a point of light expands until it fills the screen,
 * and the workspace is revealed behind it as it fades.
 *
 * Resolves when the aperture has covered the viewport, which is the moment
 * the workspace can be mounted unseen. The overlay then fades and removes
 * itself. It lives on <body>, not inside #app, because #app is replaced
 * wholesale when the app switches from the auth screen to the workspace and
 * anything inside it would be destroyed mid-animation.
 *
 * Honours prefers-reduced-motion by resolving immediately.
 */
// Set by initBrickTunnelAnimation while the login screen's canvas is alive.
// Null once it is torn down, which is why every use is guarded.
let tunnelWarp = null;

const WARP_CHARGE_MS = 780;   // accelerating toward the singularity
const WARP_PEAK = 16;         // multiple of idle tunnel speed at the end
const WARP_OPEN_MS = 620;     // aperture expanding into the workspace

// The long charge plays once per session; later sign-ins get a short one.
//
// Tying the length to the request alone made it accidental rather than
// designed: the first sign-in hits a cold Lambda and takes seconds, so the
// charge ran long, while every later one returned in a few hundred
// milliseconds and the acceleration was over before it registered. It looked
// like the animation had been switched off.
//
// Once per session is also the right behaviour on its own terms. The full
// sequence is worth watching the first time and becomes an obstacle between
// you and your inventory by the third, so a returning user gets the same
// motion at a fraction of the length rather than a different effect.
//
// sessionStorage, not localStorage: a new tab or a new day should feel like
// arriving again.
const WARP_SEEN_KEY = 'brickedup.warpSeen';
const WARP_MIN_FIRST_MS = 1500;   // hold the fall even if auth returns sooner
const WARP_MIN_REPEAT_MS = 320;   // enough to read as motion, not as a stall

function warpSeenThisSession() {
  try {
    return sessionStorage.getItem(WARP_SEEN_KEY) === '1';
  } catch (_) {
    return false;                 // private mode: treat every sign-in as first
  }
}

function markWarpSeen() {
  try {
    sessionStorage.setItem(WARP_SEEN_KEY, '1');
  } catch (_) { /* nothing to do; the animation still played */ }
}

/**
 * Sign-in transition: fly into the tunnel, then open out of it.
 *
 * The first version simply grew a white circle. That read as a wipe rather
 * than as movement, because nothing in the scene changed to suggest travel -
 * the tunnel behind it carried on drifting at the same idle speed.
 *
 * Now it runs in two phases against the tunnel the user is already watching:
 *
 *   1. Charge (780ms). The warp multiplier ramps 1 -> 16 on a cubic curve, so
 *      it starts almost imperceptibly and ends violently. Bricks accelerate
 *      past, the radial streaks stretch to nine times their length, and the
 *      vanishing point swells into a white core. Cubic rather than linear
 *      matters: a linear ramp feels like a speed change, an accelerating one
 *      feels like falling.
 *
 *   2. Open (620ms). The core - already bright and centred on the vanishing
 *      point - expands past the viewport, revealing the workspace. Because it
 *      grows out of exactly the point everything has been rushing toward, it
 *      reads as arriving somewhere rather than as a new layer covering things.
 */
export function beginLoginWarp() {
  const reduce = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    if (tunnelWarp) tunnelWarp(1);
    return { open: () => Promise.resolve(), cancel: () => {} };
  }

  const overlay = document.createElement('div');
  overlay.className = 'login-warp';
  overlay.innerHTML = '<span class="login-warp-core"></span>';
  document.body.appendChild(overlay);
  const core = overlay.firstElementChild;

  // Decided once, at the start, so the length is a property of the session
  // rather than of however long the network happened to take.
  const firstOfSession = !warpSeenThisSession();
  const minCharge = firstOfSession ? WARP_MIN_FIRST_MS : WARP_MIN_REPEAT_MS;
  // A repeat sign-in reaches full speed quickly, so the same acceleration is
  // compressed rather than replaced by a different, flatter effect.
  const chargeMs = firstOfSession ? WARP_CHARGE_MS : 260;

  let charging = true;
  let finished = false;
  let resolveOpen = null;

  const teardown = () => {
    charging = false;
    if (tunnelWarp) tunnelWarp(1);        // leave the tunnel as we found it
    overlay.classList.add('is-clearing');
    setTimeout(() => overlay.remove(), 620);
  };

  const done = () => {
    if (finished) return;
    finished = true;
    teardown();
    if (resolveOpen) resolveOpen();
  };

  // Phase 1, driven from JS because it has to steer the canvas, which no CSS
  // animation can reach. It runs for as long as the request takes: once the
  // ramp reaches its peak it HOLDS there rather than stopping, so a slow
  // network reads as a longer fall instead of an animation that finished and
  // is waiting around.
  const start = performance.now();
  const step = (now) => {
    if (!charging) return;
    const t = Math.min(1, (now - start) / chargeMs);
    const eased = t * t * t;                      // slow build, hard finish
    if (tunnelWarp) tunnelWarp(1 + eased * (WARP_PEAK - 1));
    core.style.setProperty('--charge', String(eased));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  const openAperture = () => {
    charging = false;
    // Phase 2 is a CSS animation so the browser can run the scale on the
    // compositor, which stays smooth even while the canvas is busy.
    core.classList.add('is-opening');
    core.addEventListener('animationend', done, { once: true });
    // rAF does not run in a hidden tab, and a dropped animationend would
    // otherwise strand the user on the login screen for good.
    setTimeout(done, WARP_OPEN_MS + 350);
  };

  return {
    /** Sign-in succeeded: open the aperture onto the workspace. */
    open() {
      if (finished) return Promise.resolve();
      markWarpSeen();
      // Hold for the rest of the minimum if the request beat it. Without this
      // the whole sequence lasts exactly as long as the network did, so a warm
      // backend cut the acceleration off before it was visible - which is why
      // it appeared to only work on the very first sign-in, when the Lambda
      // was cold and slow.
      const remaining = Math.max(0, minCharge - (performance.now() - start));
      return new Promise((resolve) => {
        resolveOpen = resolve;
        if (remaining > 0) setTimeout(openAperture, remaining);
        else openAperture();
      });
    },
    /** Sign-in failed: unwind without revealing anything. */
    cancel() {
      if (finished) return;
      finished = true;
      teardown();
    },
  };
}

export function renderAuth(parentEl) {
  if (activeCancelAnimation) {
    activeCancelAnimation();
    activeCancelAnimation = null;
  }
  parentEl.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.className = 'auth-bg-canvas';
  parentEl.appendChild(canvas);
  activeCancelAnimation = initBrickTunnelAnimation(canvas);

  const container = document.createElement('div');
  container.className = 'auth-screen-container';

  // Form Card
  const card = document.createElement('div');
  card.className = 'brick-card auth-card';

  const cardBody = document.createElement('div');
  cardBody.className = 'brick-card-body';

  // Logo
  const logo = document.createElement('div');
  logo.className = 'auth-logo-section';
  logo.innerHTML = `
    <img src="assets/logo_name.png" alt="BRICKED-UP" class="auth-logo-image" style="max-height: 90px; width: auto; display: block; margin: 0 auto 20px auto;" />
    <p class="logo-subtitle font-display" style="font-size: 0.95rem; letter-spacing: 0.5px; opacity: 0.85;">LEGO Parts Scanner &amp; Bin Manager</p>
  `;
  cardBody.appendChild(logo);

  if (authLoading) {
    // Spinner
    const spinner = document.createElement('div');
    spinner.className = 'brick-spinner-container';
    spinner.innerHTML = `
      <div class="brick-stud-spinner">
        <div class="stud-spinner-top"></div>
        <div class="stud-spinner-body"></div>
      </div>
      <p class="brick-spinner-message font-display">${isSignUpMode ? 'Building account...' : 'Logging in...'}</p>
    `;
    cardBody.appendChild(spinner);
  } else {
    // Auth Form
    const form = document.createElement('form');
    form.className = 'auth-form font-body';

    // Error Alert Box
    if (authErrorMsg) {
      const errBox = document.createElement('div');
      errBox.className = 'auth-error font-display';
      errBox.textContent = authErrorMsg;
      form.appendChild(errBox);
    }

    // Success Alert Box
    if (authSuccessMsg) {
      const succBox = document.createElement('div');
      succBox.className = 'auth-success font-display';
      succBox.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${authSuccessMsg}`;
      form.appendChild(succBox);
    }

    // Display Name input (only for Sign Up)
    if (isSignUpMode) {
      form.appendChild(createInputGroup('Display Name', 'text', 'displayName', 'MasterBuilder', displayNameValue, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`));
    }

    // Email Input
    form.appendChild(createInputGroup('Email Address', 'email', 'email', 'builder@lego.com', emailValue, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`));

    // Password Input
    form.appendChild(createInputGroup('Password', 'password', 'password', '******', passwordValue, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`));

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'brick-btn brick-btn-primary auth-submit-btn font-display';
    submitBtn.textContent = isSignUpMode ? 'Build Account' : 'Sign In';
    form.appendChild(submitBtn);

    // Toggle Mode link
    const togglePrompt = document.createElement('div');
    togglePrompt.className = 'auth-toggle-prompt';
    togglePrompt.innerHTML = `
      <span>${isSignUpMode ? 'Already a builder?' : 'New to Bricked-Up?'}</span>
      <button type="button" class="auth-toggle-link font-display" id="auth-mode-toggle-link">
        ${isSignUpMode ? 'Login Here' : 'Create Account'}
      </button>
    `;
    form.appendChild(togglePrompt);

    // Bind form submit
    form.onsubmit = async (e) => {
      e.preventDefault();
      authErrorMsg = null;
      authSuccessMsg = null;

      // Extract values
      emailValue = form.querySelector('[name="email"]').value;
      passwordValue = form.querySelector('[name="password"]').value;
      if (isSignUpMode) {
        displayNameValue = form.querySelector('[name="displayName"]').value;
      }

      // Validations
      if (!emailValue || !passwordValue || (isSignUpMode && !displayNameValue)) {
        authErrorMsg = 'Please fill in all bricks of the form.';
        renderAuth(parentEl);
        return;
      }

      // Mirrors the Cognito password policy: 8+ characters, with at least
      // one lowercase letter and one digit. Checking it here means the user
      // gets a friendly message instead of a raw server rejection.
      if (passwordValue.length < 8) {
        authErrorMsg = 'Password must be at least 8 blocks long.';
        renderAuth(parentEl);
        return;
      }

      if (!/[a-z]/.test(passwordValue) || !/[0-9]/.test(passwordValue)) {
        authErrorMsg = 'Password needs at least one letter and one number.';
        renderAuth(parentEl);
        return;
      }

      authLoading = true;
      renderAuth(parentEl);

      try {
        if (isSignUpMode) {
          await signUp({ email: emailValue, password: passwordValue, displayName: displayNameValue });
          authSuccessMsg = 'Account created successfully! Please sign in.';
          isSignUpMode = false;
          passwordValue = '';
          authErrorMsg = null;
        } else {
          // Start the warp BEFORE the request, not after it.
          //
          // Waiting for sign-in to return meant the charge could only begin
          // once the network was already done, so the acceleration had to be
          // squeezed into the moment before the workspace appeared. Starting
          // it here spends the request's own latency on the zoom - which is
          // dead time otherwise - and the aperture opens when the credentials
          // come back. The charge loops until then, so a slow connection
          // gives a longer fall rather than a stutter.
          const warp = beginLoginWarp();
          try {
            const result = await signIn({ email: emailValue, password: passwordValue });
            // Opens the aperture over the render, so the workspace is revealed
            // by the animation rather than appearing beside it.
            await warp.open();
            setUser(result.user, result.idToken);
          } catch (err) {
            warp.cancel();
            throw err;
          }
        }
      } catch (err) {
        console.error("Auth or rendering error:", err);
        authErrorMsg = err.message || 'Authentication failed. Please verify credentials.';
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

    // Bind Toggle link
    form.querySelector('#auth-mode-toggle-link').onclick = () => {
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
  const group = document.createElement('div');
  group.className = 'input-group';
  const isPassword = name === 'password';
  group.innerHTML = `
    <label class="input-label font-display">${label}</label>
    <div class="input-wrapper">
      <span class="input-icon">${iconHtml}</span>
      <input type="${type}" name="${name}" class="auth-input" placeholder="${placeholder}" value="${value}" />
      ${isPassword ? '<button type="button" class="password-peek-btn" aria-label="Show password" title="Show password">👁</button>' : ''}
    </div>
  `;
  if (isPassword) {
    const input = group.querySelector('input');
    const button = group.querySelector('.password-peek-btn');
    button.addEventListener('click', () => {
      const nextType = input.type === 'password' ? 'text' : 'password';
      input.type = nextType;
      button.setAttribute('aria-label', nextType === 'password' ? 'Show password' : 'Hide password');
      button.title = nextType === 'password' ? 'Show password' : 'Hide password';
      button.textContent = nextType === 'password' ? '👁' : '🙈';
    });
  }
  return group;
}

function initBrickTunnelAnimation(canvas) {
  const ctx = canvas.getContext('2d');
  let animationFrameId = null;

  // Warp multiplier, driven by beginLoginWarp. 1 is the idle drift the
  // login screen sits at; the sign-in transition ramps it up so the tunnel
  // the user has been looking at all along is the thing that accelerates,
  // rather than a separate effect appearing on top of it.
  let warp = 1;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();
  
  const numParticles = 120;
  const particles = [];
  const speedLines = [];
  const colors = ['#D01012', '#0057A6', '#FFD500', '#FFFFFF', '#5B5B66', '#1E7A34', '#F97316', '#8B5CF6'];
  
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
  
  // Speed lines - radial streaks from center
  const numSpeedLines = 60;
  for (let i = 0; i < numSpeedLines; i++) {
    speedLines.push({
      angle: Math.random() * Math.PI * 2,
      innerRadius: 30 + Math.random() * 80,
      length: 60 + Math.random() * 200,
      alpha: 0.05 + Math.random() * 0.12,
      width: 0.5 + Math.random() * 1.5,
      speed: 0.003 + Math.random() * 0.008
    });
  }
  
  // Track mouse coordinates for interactive parallax tilt
  let targetCenterX = window.innerWidth / 2;
  let targetCenterY = window.innerHeight / 2;
  let currentCenterX = targetCenterX;
  let currentCenterY = targetCenterY;
  
  const onMouseMove = (e) => {
    const rx = (e.clientX - window.innerWidth / 2);
    const ry = (e.clientY - window.innerHeight / 2);
    targetCenterX = window.innerWidth / 2 + rx * 0.3;
    targetCenterY = window.innerHeight / 2 + ry * 0.3;
  };
  window.addEventListener('mousemove', onMouseMove);
  
  let frameCount = 0;
  
  const draw = () => {
    frameCount++;
    
    // Smoothly lerp center point for natural responsiveness
    currentCenterX += (targetCenterX - currentCenterX) * 0.05;
    currentCenterY += (targetCenterY - currentCenterY) * 0.05;
    
    // Draw background base - deep dark tunnel
    const grad = ctx.createRadialGradient(
      currentCenterX, 
      currentCenterY, 
      5, 
      currentCenterX, 
      currentCenterY, 
      Math.max(canvas.width, canvas.height)
    );
    grad.addColorStop(0, '#1E1E28');
    grad.addColorStop(0.4, '#111117');
    grad.addColorStop(1, '#060608');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw pulsating glow ring at vanishing point. Under warp this swells
    // into the bright core the aperture then opens out of, so the point the
    // user appears to be flying toward is the point the workspace unfolds
    // from - one continuous movement rather than two separate effects.
    const warpT = Math.min(1, (warp - 1) / 15);
    const pulseScale = 1 + Math.sin(frameCount * 0.04) * 0.3 + warpT * 3.2;
    const glowGrad = ctx.createRadialGradient(
      currentCenterX, currentCenterY, 0,
      currentCenterX, currentCenterY, 90 * pulseScale
    );
    glowGrad.addColorStop(0, `rgba(255, 250, 224, ${0.25 + warpT * 0.75})`);
    glowGrad.addColorStop(0.4, `rgba(255, 213, 0, ${0.1 + warpT * 0.4})`);
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw speed lines (radial streaks). They stretch and brighten with warp,
    // which is what actually sells the acceleration - individual bricks move
    // too fast to track, so the streaks carry the sense of speed.
    ctx.save();
    ctx.translate(currentCenterX, currentCenterY);
    const lineStretch = 1 + warpT * 9;
    speedLines.forEach(line => {
      line.angle += line.speed;
      const cos = Math.cos(line.angle);
      const sin = Math.sin(line.angle);

      ctx.beginPath();
      ctx.moveTo(cos * line.innerRadius, sin * line.innerRadius);
      ctx.lineTo(cos * (line.innerRadius + line.length * lineStretch),
                 sin * (line.innerRadius + line.length * lineStretch));
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.9, line.alpha * (1 + warpT * 5))})`;
      ctx.lineWidth = line.width * (1 + warpT * 1.5);
      ctx.stroke();
    });
    ctx.restore();
    
    // Sort particles by Z depth (back to front)
    particles.sort((a, b) => b.z - a.z);
    
    particles.forEach(p => {
      // Accelerate as bricks get closer (warp speed effect), then multiply
      // the whole field by the transition's warp ramp.
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
      
      // Opacity fade: transparent in distance, fully opaque up close
      const alphaFactor = Math.min(1, Math.max(0.15, 1 - (p.z / 1200)));
      
      ctx.save();
      ctx.globalAlpha = alphaFactor;
      ctx.translate(px, py);
      ctx.rotate(p.angle);
      
      // Shadow effects for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = Math.max(3, 10 * perspective);
      ctx.shadowOffsetX = Math.max(1, 4 * perspective);
      ctx.shadowOffsetY = Math.max(1, 5 * perspective);
      
      // Draw 2D LEGO brick body
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, 2.5 * perspective);
      
      ctx.beginPath();
      const r = Math.max(2, 4 * perspective);
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
      } else {
        ctx.rect(-pw / 2, -ph / 2, pw, ph);
      }
      ctx.fill();
      ctx.stroke();
      
      // Clear shadow before drawing studs
      ctx.shadowColor = 'transparent';
      
      // Brick top highlight (3D sheen)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-pw / 2, -ph / 2, pw, ph * 0.4, [r, r, 0, 0]);
      } else {
        ctx.rect(-pw / 2, -ph / 2, pw, ph * 0.4);
      }
      ctx.fill();
      
      // Add studs (projections)
      const numStuds = p.size.w > 24 ? 4 : 2;
      const studRadius = 3.8 * perspective;
      const spacing = pw / numStuds;
      
      for (let s = 0; s < numStuds; s++) {
        const sx = -pw / 2 + spacing * (s + 0.5);
        const sy = -ph / 2;
        
        // Stud body
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy - studRadius * 0.4, studRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(0.5, 1.5 * perspective);
        ctx.stroke();
        
        // Stud highlight dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(sx - studRadius * 0.2, sy - studRadius * 0.6, studRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    });
    
    // Atmospheric vignette overlay
    const vignette = ctx.createRadialGradient(
      canvas.width / 2, 
      canvas.height / 2, 
      Math.min(canvas.width, canvas.height) * 0.35, 
      canvas.width / 2, 
      canvas.height / 2, 
      Math.max(canvas.width, canvas.height) * 0.75
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    animationFrameId = requestAnimationFrame(draw);
  };
  
  draw();

  tunnelWarp = (v) => { warp = v; };

  return () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouseMove);
    if (tunnelWarp) tunnelWarp = null;
  };
}

export default renderAuth;
