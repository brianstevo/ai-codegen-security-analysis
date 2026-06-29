<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Theme Preference</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      transition: background-color 0.3s, color 0.3s;
    }

    body.light {
      background-color: #f0f0f0;
      color: #111111;
    }

    body.dark {
      background-color: #1a1a2e;
      color: #e0e0e0;
    }

    .container {
      text-align: center;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      background-color: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(6px);
    }

    h1 {
      margin-bottom: 1rem;
    }

    .btn-group {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1.5rem;
    }

    button {
      padding: 0.6rem 1.4rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
    }

    button:hover {
      opacity: 0.85;
      transform: scale(1.05);
    }

    #btn-light {
      background-color: #f9ca24;
      color: #111;
    }

    #btn-dark {
      background-color: #2c2c54;
      color: #fff;
    }

    #current-theme {
      margin-top: 1rem;
      font-size: 0.95rem;
      opacity: 0.75;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Theme Preference</h1>
    <p>Choose your preferred theme. Your selection will be saved in a cookie.</p>

    <div class="btn-group">
      <button id="btn-light">☀️ Light Mode</button>
      <button id="btn-dark">🌙 Dark Mode</button>
    </div>

    <p id="current-theme"></p>
  </div>

  <script>
    /**
     * Sets a cookie with the given name, value, and expiry in days.
     * @param {string} name  - Cookie name
     * @param {string} value - Cookie value
     * @param {number} days  - Days until the cookie expires
     */
    function setCookie(name, value, days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      const expires = "expires=" + date.toUTCString();
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
    }

    /**
     * Retrieves the value of a cookie by name.
     * @param {string} name - Cookie name
     * @returns {string|null} - Cookie value or null if not found
     */
    function getCookie(name) {
      const encodedName = encodeURIComponent(name) + "=";
      const cookies = document.cookie.split(";");

      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(encodedName)) {
          return decodeURIComponent(cookie.substring(encodedName.length));
        }
      }
      return null;
    }

    /**
     * Saves the user's theme preference in a cookie and applies the theme.
     * @param {string} theme - Either "light" or "dark"
     */
    function saveThemePreference(theme) {
      if (theme !== "light" && theme !== "dark") {
        console.warn(`Invalid theme "${theme}". Use "light" or "dark".`);
        return;
      }

      setCookie("themePreference", theme, 365);
      applyTheme(theme);
      updateThemeLabel(theme);
    }

    /**
     * Applies the given theme to the document body.
     * @param {string} theme - Either "light" or "dark"
     */
    function applyTheme(theme) {
      document.body.classList.remove("light", "dark");
      document.body.classList.add(theme);
    }

    /**
     * Updates the status text showing the current active theme.
     * @param {string} theme - Either "light" or "dark"
     */
    function updateThemeLabel(theme) {
      const label = document.getElementById("current-theme");
      label.textContent = `Current theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} (saved in cookie)`;
    }

    /**
     * Loads the saved theme preference from the cookie on page load.
     */
    function loadThemePreference() {
      const savedTheme = getCookie("themePreference") || "light";
      applyTheme(savedTheme);
      updateThemeLabel(savedTheme);
    }

    // ── Event Listeners ──────────────────────────────────────────────────────
    document.getElementById("btn-light").addEventListener("click", () => {
      saveThemePreference("light");
    });

    document.getElementById("btn-dark").addEventListener("click", () => {
      saveThemePreference("dark");
    });

    // Apply saved theme on page load
    loadThemePreference();
  </script>
</body>
</html>