/**
 * Stores the JWT in localStorage to maintain authentication state.
 * 
 * @param {string} token - The JWT string to store
 */
function storeJwtToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Invalid token provided');
  }
  
  // Use localStorage for persistence across page loads and browser restarts
  // Note: For highly sensitive applications, consider httpOnly cookies instead
  try {
    localStorage.setItem('jwt_token', token);
  } catch (error) {
    console.error('Failed to store JWT:', error);
    throw new Error('Could not save authentication token');
  }
}

/**
 * Retrieves the stored JWT token
 * 
 * @returns {string|null} The JWT token or null if not found
 */
function getJwtToken() {
  try {
    return localStorage.getItem('jwt_token');
  } catch (error) {
    console.error('Failed to retrieve JWT:', error);
    return null;
  }
}

/**
 * Removes the JWT token (for logout functionality)
 */
function removeJwtToken() {
  try {
    localStorage.removeItem('jwt_token');
  } catch (error) {
    console.error('Failed to clear JWT:', error);
  }
}