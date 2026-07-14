/**
 * Stores the JWT in localStorage to persist authentication across page reloads.
 * @param {string} token - The JWT string received after login.
 * @returns {boolean} - Returns true if the token was stored successfully, false otherwise.
 */
function setAuthToken(token) {
  if (!token) {
    return false;
  }

  try {
    localStorage.setItem('auth_token', token);
    return true;
  } catch (error) {
    console.error('Failed to save authentication token:', error);
    return false;
  }
}