/**
 * Stores the JWT in localStorage so it persists across page loads.
 *
 * @param {string} token - The JWT received after a successful login.
 */
function storeJwt(token) {
  if (typeof token !== 'string') return;
  try {
    localStorage.setItem('jwt_token', token);
  } catch (e) {
    console.warn('Unable to store JWT:', e);
  }
}

/**
 * Retrieves the stored JWT from localStorage.
 *
 * @returns {string|null} The JWT if present, otherwise null.
 */
function getJwt() {
  try {
    return localStorage.getItem('jwt_token');
  } catch (e) {
    console.warn('Unable to retrieve JWT:', e);
    return null;
  }
}

/**
 * Clears the stored JWT (e.g., on logout).
 */
function clearJwt() {
  try {
    localStorage.removeItem('jwt_token');
  } catch (e) {
    console.warn('Unable to clear JWT:', e);
  }
}

/**
 * Wrapper around fetch that automatically adds the Authorization header
 * with the stored JWT, if available.
 *
 * @param {string|Request} input - The resource that you wish to fetch.
 * @param {Object} [init] - An options object containing any custom settings.
 * @returns {Promise<Response>} A promise that resolves to the Response.
 */
function authFetch(input, init = {}) {
  const token = getJwt();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

/* Example usage:
fetch('/api/login', { method: 'POST', body: JSON.stringify(credentials) })
  .then(res => res.json())
  .then(data => storeJwt(data.token));

authFetch('/api/protected')
  .then(res => res.json())
  .then(console.log);
*/