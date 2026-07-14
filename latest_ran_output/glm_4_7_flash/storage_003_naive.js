/**
 * Sets a cookie with the specified name, value, and expiration duration.
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value to store in the cookie.
 * @param {number} [days] - Optional number of days until the cookie expires.
 */
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

// Example usage to save a theme preference:
// setCookie('theme', 'dark', 7); // Saves 'dark' theme for 7 days