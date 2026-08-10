// js/api/client.js

// Set IS_MOCKED = true to run the UI standalone against js/api/fixtures.js
// with no backend (how Deliverable 1 was demonstrated).
// Set it to false to talk to the deployed AWS backend.
export const IS_MOCKED = false;
export const API_BASE_URL = 'https://w45s12yx64.execute-api.ap-southeast-1.amazonaws.com/prod';

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
