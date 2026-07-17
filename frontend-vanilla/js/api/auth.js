import { IS_MOCKED, API_BASE_URL, setActiveToken, authHeader } from './client.js';

let currentUser = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function signUp({ email, password, displayName }) {
  if (!IS_MOCKED) {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Registration failed');
    }
    return await res.json();
  }

  await sleep(800);
  if (!email || !password || !displayName) {
    throw new Error('Please fill in all details');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const userSub = 'usr_' + Math.random().toString(36).substr(2, 9);
  return { userSub };
}

export async function signIn({ email, password }) {
  if (!IS_MOCKED) {
    const res = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }
    const result = await res.json();
    currentUser = result.user;
    setActiveToken(result.idToken);
    return result;
  }

  await sleep(1000);
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  if (!email.includes('@')) {
    throw new Error('Invalid email address');
  }

  const user_id = 'usr_mocked_id_99';
  const display_name = email.split('@')[0];

  currentUser = {
    user_id,
    email,
    display_name: display_name.charAt(0).toUpperCase() + display_name.slice(1),
  };

  const idToken = 'jwt_mocked_token_' + Math.random().toString(36).substr(2, 9);
  setActiveToken(idToken);
  return {
    idToken,
    user: currentUser,
  };
}

export async function signOut() {
  if (!IS_MOCKED) {
    try {
      await fetch(`${API_BASE_URL}/auth/signout`, {
        method: 'POST',
        headers: { ...authHeader() }
      });
    } catch (e) {
      // Ignore network errors on signout
    }
    currentUser = null;
    setActiveToken(null);
    return { success: true };
  }

  await sleep(400);
  currentUser = null;
  setActiveToken(null);
  return { success: true };
}

export async function getCurrentUser() {
  if (!IS_MOCKED) {
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
      // Ignore fetch failures on restore
    }
    return null;
  }

  await sleep(200);
  return currentUser;
}
