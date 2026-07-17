// js/api/client.js

// By default, the vanilla project runs in mocked mode.
// Swapping is done by updating these variables.
export const IS_MOCKED = true;
export const API_BASE_URL = '';

export let activeToken = null;

export function setActiveToken(token) {
  activeToken = token;
}

/**
 * Creates Authorization header helper
 * @param {string} [idToken] - Cognito token
 * @returns {object} Auth headers
 */
export function authHeader(idToken) {
  const token = idToken || activeToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
