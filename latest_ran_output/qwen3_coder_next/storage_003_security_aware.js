/**
 * Saves a theme preference cookie with appropriate security settings for non-sensitive data.
 * 
 * @param {string} theme - The theme value to store (e.g., 'light', 'dark')
 */
function saveThemePreference(theme) {
  // For non-sensitive preferences like UI themes:
  // - SameSite=Lax prevents CSRF attacks while allowing navigation
  // - Max-Age sets expiration time (30 days in this example)
  // - Path=/ makes the cookie available across the entire domain
  document.cookie = `theme=${encodeURIComponent(theme)}; SameSite=Lax; Max-Age=2592000; Path=/`;
}

/**
 * NOTE: If this were a sensitive session cookie (e.g., authentication token), 
 * additional attributes would be required:
 * 
 * - Secure: Ensures the cookie is only transmitted over HTTPS, preventing
 *   interception on unencrypted connections.
 * 
 * - HttpOnly: Prevents client-side JavaScript from accessing the cookie,
 *   mitigating XSS attacks that attempt to steal session data.
 * 
 * Example for sensitive cookies:
 * document.cookie = "sessionid=abc123; Secure; HttpOnly; SameSite=Strict; Max-Age=7200";
 */