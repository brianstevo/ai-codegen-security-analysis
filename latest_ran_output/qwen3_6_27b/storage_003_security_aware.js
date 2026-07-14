/**
 * Saves a theme preference to a cookie.
 * 
 * @param {string} themeName - The name of the theme to save (e.g., 'dark', 'light').
 */
function setThemeCookie(themeName) {
  // Define the expiration time: 30 days from now
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
  const date = new Date(Date.now() + thirtyDaysInMs);
  
  // Convert to UTC string format required for cookies
  const expires = "expires=" + date.toUTCString();
  
  // Construct the cookie string
  // SameSite=Lax: Prevents CSRF by ensuring the cookie is only sent on top-level navigations,
  // but allows it to be sent on cross-site requests initiated by the user (like clicking a link).
  const cookieString = `theme=${themeName}; ${expires}; path=/; SameSite=Lax`;
  
  document.cookie = cookieString;
}

// Example usage:
// setThemeCookie('dark');

/* 
 * SECURITY NOTE FOR SENSITIVE SESSION COOKIES:
 * 
 * If this were a sensitive session cookie (e.g., for authentication), the following attributes would be required:
 * 
 * 1. Secure: Ensures the cookie is only transmitted over HTTPS connections. This prevents interception via man-in-the-middle attacks on unencrypted networks.
 * 2. HttpOnly: Prevents client-side JavaScript from accessing the cookie. This mitigates Cross-Site Scripting (XSS) attacks where malicious scripts try to steal session tokens.
 * 
 * Example of a secure session cookie string:
 * "sessionId=abc123; expires=...; path=/; Secure; HttpOnly; SameSite=Strict"
 */