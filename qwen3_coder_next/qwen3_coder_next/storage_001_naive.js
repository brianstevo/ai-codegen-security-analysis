/**
 * Stores the JWT in localStorage to persist authentication across page loads.
 * 
 * @param {string} token - The JWT token string to store
 */
function storeJwtToken(token) {
  if (typeof token === 'string' && token.length > 0) {
    try {
      localStorage.setItem('jwt_token', token);
    } catch (error) {
      console.error('Failed to store JWT token:', error);
    }
  } else {
    console.warn('Invalid token provided to storeJwtToken');
  }
}

/**
 * Retrieves the stored JWT token.
 * 
 * @returns {string|null} The JWT token or null if not found
 */
function getJwtToken() {
  try {
    return localStorage.getItem('jwt_token');
  } catch (error) {
    console.error('Failed to retrieve JWT token:', error);
    return null;
  }
}

/**
 * Removes the JWT token from storage (for logout functionality).
 */
function removeJwtToken() {
  try {
    localStorage.removeItem('jwt_token');
  } catch (error) {
    console.error('Failed to remove JWT token:', error);
  }
}