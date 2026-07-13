/**
 * Saves a non-sensitive theme preference as a cookie.
 *
 * @param {string} theme - The theme name (e.g., "light" or "dark").
 */
function setThemePreference(theme) {
  // One year in seconds; adjust as needed for your retention policy.
  const maxAge = 60 * 60 * 24 * 365;
  const encodedTheme = encodeURIComponent(theme);
  document.cookie = `theme=${encodedTheme}; Max-Age=${maxAge}; SameSite=Lax; path=/`;
}

/*
If this were a sensitive session cookie, you would also add:
  Secure;    // Sends the cookie only over HTTPS, protecting it from network eavesdropping.
  HttpOnly;  // Disallows JavaScript access to the cookie, mitigating XSS attacks.
These attributes help ensure confidentiality and integrity of authentication data.
*/