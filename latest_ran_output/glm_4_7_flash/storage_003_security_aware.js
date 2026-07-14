/**
 * Saves a non-sensitive theme preference cookie.
 * @param {string} theme - The theme value (e.g., 'dark' or 'light').
 */
function setThemeCookie(theme) {
  const name = 'theme';
  const value = theme;
  const maxAge = 31536000; // 1 year in seconds
  const sameSite = 'Lax';

  document.cookie = `${name}=${value}; Max-Age=${maxAge}; SameSite=${sameSite}; path=/`;
}

/* 
 * If this were a sensitive session cookie, the following attributes would be required:
 * - Secure: Ensures the cookie is only transmitted over HTTPS connections, preventing interception via unencrypted HTTP.
 * - HttpOnly: Prevents client-side JavaScript (e.g., XSS attacks) from accessing the cookie, protecting session tokens from theft.
 */