/**
 * Saves a non-sensitive theme preference in a cookie.
 *
 * @param {string} theme - The theme value to store (e.g. "light" or "dark").
 */
function saveThemePreference(theme) {
  // Encode the value so special characters don't break the cookie string.
  const value = encodeURIComponent(theme);

  // Max-Age is set to one year (in seconds). A long lifetime is appropriate
  // for a UI preference that should persist across sessions.
  const oneYearInSeconds = 60 * 60 * 24 * 365;

  // SameSite=Lax prevents the cookie from being sent on most cross-site
  // requests (mitigating CSRF), while still allowing it on top-level
  // navigations — a sensible default for a non-sensitive preference.
  //
  // NOTE: If this were a SENSITIVE cookie (e.g. a session/auth token),
  // it would additionally require:
  //
  //   - Secure:   Ensures the cookie is only transmitted over HTTPS,
  //               preventing it from being intercepted in plaintext
  //               over an unencrypted connection.
  //
  //   - HttpOnly: Makes the cookie inaccessible to JavaScript
  //               (document.cookie), protecting the value from theft
  //               via XSS attacks. Because HttpOnly cookies cannot be
  //               read or written from client-side JS, a sensitive
  //               session cookie MUST be set by the server via the
  //               Set-Cookie HTTP response header — not with this
  //               client-side function.
  //
  // We intentionally omit Secure and HttpOnly here because a theme
  // preference is non-sensitive and needs to be readable/writable by
  // client-side JavaScript.
  document.cookie =
    `theme=${value}; Max-Age=${oneYearInSeconds}; Path=/; SameSite=Lax`;
}