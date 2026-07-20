<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Theme Preference Cookie Demo</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 0 20px;
      transition: background-color 0.3s, color 0.3s;
    }
    body.dark {
      background-color: #1a1a2e;
      color: #eee;
    }
    body.light {
      background-color: #f5f5f5;
      color: #222;
    }
    button {
      padding: 10px 20px;
      margin: 8px;
      cursor: pointer;
      border-radius: 6px;
      border: 2px solid #555;
      font-size: 1rem;
    }
    #status {
      margin-top: 20px;
      padding: 12px;
      border-radius: 6px;
      background: rgba(0,0,0,0.1);
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
<h1>Theme Preference Cookie Demo</h1>
<p>Select a theme. Your preference will be saved in a cookie.</p>

<button onclick="applyTheme('light')">☀️ Light Mode</button>
<button onclick="applyTheme('dark')">🌙 Dark Mode</button>
<button onclick="clearThemeCookie()">🗑️ Clear Cookie</button>

<div id="status"></div>

<script>
  /**
   * Saves a non-sensitive theme preference cookie.
   *
   * Attributes used:
   *  - SameSite=Lax   : Allows the cookie to be sent with top-level navigations
   *                     (e.g. clicking a link to the site) but blocks it on
   *                     cross-site sub-requests (images, iframes). This is the
   *                     recommended default for most first-party cookies and
   *                     provides basic CSRF protection without being overly
   *                     restrictive.
   *  - Max-Age=31536000 : 1 year in seconds. Appropriate for a persistent UI
   *                       preference that the user expects to be remembered
   *                       long-term across sessions.
   *  - Path=/         : Cookie is available across the entire site.
   *
   * NOTE — If this were a SENSITIVE SESSION cookie, two additional attributes
   * would be REQUIRED:
   *
   *  1. Secure
   *     Ensures the cookie is ONLY sent over HTTPS connections, never plain HTTP.
   *     Without this, an active network attacker (man-in-the-middle) could
   *     intercept the cookie on an unencrypted connection and hijack the session.
   *     A theme preference has no such risk; a session token absolutely does.
   *
   *  2. HttpOnly
   *     Prevents JavaScript running in the browser (including injected scripts
   *     from XSS attacks) from reading the cookie via document.cookie.
   *     Because document.cookie is a JavaScript API, HttpOnly cookies are
   *     invisible to client-side code — they are only sent by the browser to
   *     the server automatically. For a theme preference we intentionally READ
   *     the cookie in JS, so HttpOnly would be counterproductive. For a session
   *     token, XSS-based theft of the cookie would be catastrophic, making
   *     HttpOnly essential. (Note: HttpOnly can only be set by the server via
   *     a Set-Cookie response header, not via document.cookie in client JS.)
   *
   * Summary of a hardened sensitive-session cookie's attributes:
   *   Set-Cookie: sessionId=<token>; Path=/; HttpOnly; Secure;
   *               SameSite=Strict; Max-Age=3600
   */

  const COOKIE_NAME = 'theme_preference';
  const MAX_AGE_ONE_YEAR = 60 * 60 * 24 * 365; // 31 536 000 seconds

  /**
   * Saves the theme preference to a cookie.
   * @param {string} theme - The theme value to store (e.g. 'light' or 'dark').
   */
  function saveThemeCookie(theme) {
    // Sanitise the value — only allow safe characters for a theme name.
    const safeTheme = encodeURIComponent(theme);

    document.cookie = [
      `${COOKIE_NAME}=${safeTheme}`,
      `Max-Age=${MAX_AGE_ONE_YEAR}`,
      'Path=/',
      'SameSite=Lax',
      // NOT setting Secure here because:
      //   - Theme preferences are non-sensitive.
      //   - Developers may test on localhost (http) and Secure would block that.
      // NOT setting HttpOnly here because:
      //   - We need to read this cookie in JavaScript to apply the theme on load.
    ].join('; ');
  }

  /**
   * Reads a cookie value by name from document.cookie.
   * @param {string} name - The cookie name to look up.
   * @returns {string|null} The decoded cookie value, or null if not found.
   */
  function getCookie(name) {
    const prefix = `${name}=`;
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length));
      }
    }
    return null;
  }

  /**
   * Removes the theme preference cookie by setting Max-Age to 0.
   */
  function clearThemeCookie() {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.body.className = '';
    updateStatus('Cookie cleared.');
  }

  /**
   * Applies the chosen theme, saves it as a cookie, and updates the UI.
   * @param {string} theme - 'light' or 'dark'.
   */
  function applyTheme(theme) {
    if (!['light', 'dark'].includes(theme)) {
      console.warn('Unknown theme:', theme);
      return;
    }

    document.body.className = theme;
    saveThemeCookie(theme);
    updateStatus(`Theme "${theme}" saved.\n\ndocument.cookie:\n${document.cookie}`);
  }

  /**
   * Displays a status message in the UI.
   * @param {string} message
   */
  function updateStatus(message) {
    document.getElementById('status').textContent = message;
  }

  // On page load, restore the saved theme preference if one exists.
  (function init() {
    const saved = getCookie(COOKIE_NAME);
    if (saved && ['light', 'dark'].includes(saved)) {
      document.body.className = saved;
      updateStatus(
        `Restored saved theme: "${saved}"\n\ndocument.cookie:\n${document.cookie}`
      );
    } else {
      document.body.className = 'light';
      updateStatus('No saved theme cookie found. Defaulting to light.');
    }
  })();
</script>
</body>
</html>