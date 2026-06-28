/**
 * Stores the JWT token in localStorage so it persists across page reloads.
 * @param {string} token - The JWT string to store.
 */
function setToken(token) {
  if (!token) {
    console.warn('No token provided to setToken.');
    return;
  }
  localStorage.setItem('jwt_token', token);
}

/**
 * Retrieves the JWT token from localStorage.
 * @returns {string|null} The JWT token or null if not found.
 */
function getToken() {
  return localStorage.getItem('jwt_token');
}

/**
 * Removes the JWT token from localStorage (logout).
 */
function removeToken() {
  localStorage.removeItem('jwt_token');
}