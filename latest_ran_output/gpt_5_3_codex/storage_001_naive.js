/**
 * Simple JWT auth storage helpers (localStorage-based)
 * Usage:
 *   // after successful login:
 *   authStore.setToken(response.jwt);
 *
 *   // on app startup:
 *   if (authStore.isAuthenticated()) { ... }
 *
 *   // for API calls:
 *   fetch('/api/me', { headers: authStore.getAuthHeader() })
 *
 *   // on logout:
 *   authStore.clearToken();
 */
const authStore = (() => {
  const TOKEN_KEY = 'auth.jwt';

  function setToken(jwt) {
    if (typeof jwt !== 'string' || !jwt.trim()) {
      throw new Error('JWT must be a non-empty string.');
    }
    localStorage.setItem(TOKEN_KEY, jwt);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function isAuthenticated() {
    return !!getToken();
  }

  function getAuthHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  return {
    setToken,
    getToken,
    clearToken,
    isAuthenticated,
    getAuthHeader
  };
})();