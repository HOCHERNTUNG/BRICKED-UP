import { IS_MOCKED } from './client';

// Simple in-memory storage of current authenticated user, simulating Cognito state
let currentUser = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function signUp({ email, password, displayName }) {
  await sleep(800);
  if (!IS_MOCKED) {
    // Future Cognito SDK integration will be placed here
    throw new Error('Real backend not configured');
  }

  // Basic client-side validation
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
  await sleep(1000);
  if (!IS_MOCKED) {
    // Future Cognito SDK integration will be placed here
    throw new Error('Real backend not configured');
  }

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
  return {
    idToken,
    user: currentUser,
  };
}

export async function signOut() {
  await sleep(400);
  currentUser = null;
  return { success: true };
}

export async function getCurrentUser() {
  await sleep(200);
  return currentUser;
}
