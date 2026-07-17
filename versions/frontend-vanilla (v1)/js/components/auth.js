import { signIn, signUp } from '../api/auth.js';
import { setUser, getState } from '../hooks/state.js';

let isSignUpMode = false;
let authLoading = false;
let authErrorMsg = null;
let authSuccessMsg = null;

let emailValue = '';
let passwordValue = '';
let displayNameValue = '';

/**
 * Renders the Auth Screen layout in Vanilla JS
 */
export function renderAuth(parentEl) {
  parentEl.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'auth-screen-container';

  // Floating background decorations
  const decor = document.createElement('div');
  decor.className = 'auth-background-decorations';
  decor.innerHTML = `
    <div class="auth-brick red bounce" style="animation-delay: 0.2s">🔴</div>
    <div class="auth-brick yellow bounce" style="animation-delay: 0.5s">🟡</div>
    <div class="auth-brick blue bounce" style="animation-delay: 0s">🔵</div>
    <div class="auth-brick green bounce" style="animation-delay: 0.8s">🟢</div>
  `;
  container.appendChild(decor);

  // Form Card
  const card = document.createElement('div');
  card.className = 'brick-card auth-card';

  const cardBody = document.createElement('div');
  cardBody.className = 'brick-card-body';

  // Logo
  const logo = document.createElement('div');
  logo.className = 'auth-logo-section';
  logo.innerHTML = `
    <div class="logo-brick-stack">
      <div class="logo-brick yellow-brick"></div>
      <div class="logo-brick blue-brick"></div>
      <div class="logo-brick red-brick"></div>
    </div>
    <h1 class="logo-title font-display">BRICKED-UP</h1>
    <p class="logo-subtitle">LEGO Parts Scanner & Bin Manager</p>
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

      if (passwordValue.length < 6) {
        authErrorMsg = 'Password must be at least 6 blocks long.';
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
          const result = await signIn({ email: emailValue, password: passwordValue });
          setUser(result.user, result.idToken);
        }
      } catch (err) {
        authErrorMsg = err.message || 'Authentication failed. Please verify credentials.';
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
  group.innerHTML = `
    <label class="input-label font-display">${label}</label>
    <div class="input-wrapper">
      <span class="input-icon">${iconHtml}</span>
      <input type="${type}" name="${name}" class="auth-input" placeholder="${placeholder}" value="${value}" />
    </div>
  `;
  return group;
}
export default renderAuth;
