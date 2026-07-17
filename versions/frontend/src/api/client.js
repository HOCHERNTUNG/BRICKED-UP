// src/api/client.js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const IS_MOCKED = import.meta.env.VITE_USE_MOCKS !== 'false';

/**
 * Creates Authorization header helper
 * @param {string} idToken - Amazon Cognito token
 * @returns {object} Auth headers
 */
export function authHeader(idToken) {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}
