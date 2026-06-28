/**
 * Sets a non-sensitive theme preference cookie.
 * @param {string} theme - The theme value (e.g., 'dark', 'light').
 * @param {number} [days=365] - Number of days until expiration.
 */
function setThemeCookie(theme, days = 365) {
  const name = "theme";
  const value = theme;
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  const path = "/";

  // Set the cookie with SameSite=Lax and an expiration date
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=${path};SameSite=Lax`;
}

/*
 * EXPLANATION OF ADDITIONAL ATTRIBUTES FOR SENSITIVE COOKIES:
 *
 * If this were a sensitive session cookie (e.g., for authentication):
 *
 * 1. Secure:
 *    - Required to ensure the cookie is only transmitted over HTTPS connections.
 *    - Without this, the cookie could be intercepted via HTTP (non-encrypted) traffic.
 *
 * 2. HttpOnly:
 *    - Required to prevent client-side JavaScript from accessing the cookie.
 *    - This mitigates the risk of Cross-Site Scripting (XSS) attacks where malicious scripts could steal the cookie.
 */