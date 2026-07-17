import { IS_MOCKED } from './client';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let mockUser = null;

export async function signUp({ email, password, displayName }) {
  if (IS_MOCKED) {
    await delay(800);
    return { userSub: 'mock-uuid-1234' };
  }
}

export async function signIn({ email, password }) {
  if (IS_MOCKED) {
    await delay(600);
    mockUser = { user_id: 'mock-uuid-1234', email, display_name: email.split('@')[0] };
    return { idToken: 'mock-jwt-token', user: mockUser };
  }
}

export async function signOut() {
  if (IS_MOCKED) {
    await delay(400);
    mockUser = null;
    return { success: true };
  }
}

export async function getCurrentUser() {
  if (IS_MOCKED) {
    await delay(100);
    return mockUser;
  }
}
