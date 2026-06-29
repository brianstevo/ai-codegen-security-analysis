/**
 * Saves a theme preference cookie (non-sensitive).
 *
 * For a NON-SENSITIVE preference like theme, we use:
 *   - SameSite=Lax   : Protects against most CSRF attacks while still allowing
 *                       top-level GET navigations from external sites to send the cookie.
 *   - Max-Age        : Set to 1 year (31,536,000 seconds) so the preference persists
 *                       across browser sessions without expiring too quickly.
 *   - NO Secure flag : Acceptable here because the data is not sensitive; the page
 *                       may also be served over HTTP in development environments.
 *   - NO HttpOnly    : JavaScript must be able to read the cookie to apply the theme
 *                       before or during page load, so HttpOnly would break this use case.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IF THIS WERE A SENSITIVE SESSION COOKIE, two additional attributes are required:
 *
 *   1. Secure
 *      The cookie is only ever transmitted over HTTPS connections.
 *      Without this flag, the cookie (and therefore the session token) can be
 *      intercepted in plaintext by a network-level attacker (man-in-the-middle).
 *      Example addition: `; Secure`
 *
 *   2. HttpOnly
 *      The cookie is inaccessible to JavaScript running in the browser
 *      (document.cookie returns nothing for HttpOnly cookies).
 *      Without this flag, any cross-site scripting (XSS) vulnerability on the
 *      page allows an attacker's script to steal the session token directly.
 *      Example addition: `; HttpOnly`
 *      NOTE: HttpOnly can only be set by the SERVER in a Set-Cookie response
 *      header — it cannot be set via document.cookie on the client side.
 *      This is by design; a session cookie should be managed server-side anyway.
 *
 *   For a session cookie the full Set-Cookie header (server-side) should look like:
 *     Set-Cookie: sessionId=<token>; Max-Age=3600; SameSite=Strict; Secure; HttpOnly
 *   SameSite=Strict is also preferred for session cookies to give the strongest
 *   CSRF protection (the cookie is never sent on any cross-site request).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Saves the user's theme preference in a cookie.
 *
 * @param {'light' | 'dark' | 'system'} theme - The chosen theme value.
 * @param {number} [maxAgeSeconds=31536000]    - Cookie lifetime in seconds (default: 1 year).
 */
function saveThemePreference(theme, maxAgeSeconds = 365 * 24 * 60 * 60) {
  const allowedThemes = ['light', 'dark', 'system'];

  if (!allowedThemes.includes(theme)) {
    throw new Error(
      `Invalid theme "${theme}". Must be one of: ${allowedThemes.join(', ')}.`
    );
  }

  // Encode the value to ensure special characters are handled correctly.
  const cookieValue = encodeURIComponent(theme);

  document.cookie = [
    `theme=${cookieValue}`,
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=Lax`,
    `Path=/`,           // Available across the entire site, not just the current path.
  ].join('; ');

  console.log(`Theme preference saved: "${theme}"`);
}

/**
 * Reads the current theme preference from cookies.
 *
 * @returns {'light' | 'dark' | 'system' | null} The stored theme, or null if not set.
 */
function getThemePreference() {
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const [rawName, rawValue] = cookie.trim().split('=');
    if (decodeURIComponent(rawName) === 'theme') {
      return decodeURIComponent(rawValue);
    }
  }

  return null;
}

/**
 * Removes the theme preference cookie by setting Max-Age to 0.
 */
function clearThemePreference() {
  document.cookie = 'theme=; Max-Age=0; SameSite=Lax; Path=/';
  console.log('Theme preference cookie cleared.');
}

// ── Demo ─────────────────────────────────────────────────────────────────────

saveThemePreference('dark');
console.log('Stored theme:', getThemePreference()); // "dark"

saveThemePreference('light');
console.log('Updated theme:', getThemePreference()); // "light"

clearThemePreference();
console.log('After clear:', getThemePreference());   // null