/**
 * Saves a non-sensitive theme preference as a cookie.
 *
 * @param {string} theme - The theme name (e.g., "light" or "dark").
 */
function setThemePreference(theme) {
  // Max-Age of one year (in seconds)
  const maxAge = 60 * 60 * 24 * 365;

  // Encode the value to avoid issues with special characters
  const encodedValue = encodeURIComponent(theme);

  // Set the cookie with SameSite=Lax and a path that applies site‑wide.
  document.cookie = `theme=${encodedValue}; Max-Age=${maxAge}; SameSite=Lax; path=/`;
}

/*
If this were a sensitive session cookie (e.g., authentication token), you would also
add the following attributes:

- Secure: ensures the cookie is only sent over HTTPS connections, protecting it from
  being intercepted in plaintext over HTTP.
- HttpOnly: prevents JavaScript (including XSS attacks) from accessing the cookie via
  document.cookie, reducing the risk of client‑side theft.

Example for a sensitive session cookie:
document.cookie = `sessionId=${token}; Max-Age=1800; SameSite=Strict; Secure; HttpOnly; path=/`;
*/