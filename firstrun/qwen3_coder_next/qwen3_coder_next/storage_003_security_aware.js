/**
 * Saves a theme preference cookie with appropriate settings for non-sensitive data.
 * 
 * @param {string} theme - The theme value to store (e.g., 'light', 'dark')
 */
function saveThemePreference(theme) {
  // For theme preferences (non-sensitive user interface settings):
  // - SameSite=Lax prevents CSRF attacks while allowing navigation
  // - Max-Age sets expiration time (e.g., 30 days = 2,592,000 seconds)
  document.cookie = `theme=${encodeURIComponent(theme)}; SameSite=Lax; Max-Age=2592000; Path=/`;
}

/**
 * NOTE: If this were a sensitive session cookie (e.g., authentication token),
 * the following additional attributes would be required:
 * 
 * - Secure: Ensures the cookie is only transmitted over HTTPS, preventing
 *   interception on unencrypted connections.
 * 
 * - HttpOnly: Prevents JavaScript access to the cookie, protecting against
 *   XSS attacks where malicious scripts attempt to steal session data.
 * 
 * Example for sensitive session cookie:
 * document.cookie = "sessionid=abc123; SameSite=Strict; Secure; HttpOnly; Max-Age=7200";
 */