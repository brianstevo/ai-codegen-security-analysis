<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Theme Preference</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      transition: background-color 0.3s, color 0.3s;
    }

    body.light {
      background-color: #f0f0f0;
      color: #333;
    }

    body.dark {
      background-color: #1a1a2e;
      color: #e0e0e0;
    }

    .container {
      text-align: center;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      transition: background-color 0.3s;
    }

    body.light .container {
      background-color: #ffffff;
    }

    body.dark .container {
      background-color: #16213e;
    }

    h1 {
      margin-bottom: 10px;
      font-size: 1.8rem;
    }

    p {
      margin-bottom: 30px;
      opacity: 0.7;
    }

    .theme-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
    }

    button {
      padding: 12px 28px;
      font-size: 1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
      font-weight: bold;
    }

    button:hover {
      opacity: 0.85;
      transform: translateY(-2px);
    }

    button:active {
      transform: translateY(0);
    }

    #lightBtn {
      background-color: #f9c74f;
      color: #333;
    }

    #darkBtn {
      background-color: #4361ee;
      color: #fff;
    }

    .status {
      margin-top: 24px;
      font-size: 0.9rem;
      opacity: 0.6;
      min-height: 20px;
    }

    .cookie-info {
      margin-top: 16px;
      font-size: 0.85rem;
      padding: 10px 16px;
      border-radius: 6px;
      display: inline-block;
      transition: background-color 0.3s;
    }

    body.light .cookie-info {
      background-color: #e8e8e8;
    }

    body.dark .cookie-info {
      background-color: #0f3460;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Theme Preferences</h1>
    <p>Choose your preferred theme. It will be saved in a cookie.</p>

    <div class="theme-buttons">
      <button id="lightBtn">☀️ Light Mode</button>
      <button id="darkBtn">🌙 Dark Mode</button>
    </div>

    <div class="status" id="status"></div>
    <div class="cookie-info" id="cookieInfo"></div>
  </div>

  <script>
    /**
     * Saves the user's theme preference in a cookie.
     * @param {string} theme - The theme value to save ('light' or 'dark').
     * @param {number} [days=365] - Number of days until the cookie expires.
     */
    function saveThemePreference(theme, days = 365) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      const cookieValue = encodeURIComponent(theme);
      const cookieString = `theme=${cookieValue}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;

      document.cookie = cookieString;
      console.log(`Theme preference saved: "${theme}" (expires in ${days} days)`);
    }

    /**
     * Reads the theme preference from cookies.
     * @returns {string|null} The stored theme value or null if not found.
     */
    function getThemePreference() {
      const cookies = document.cookie.split(';');

      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'theme') {
          return decodeURIComponent(value);
        }
      }

      return null;
    }

    /**
     * Applies the given theme to the page.
     * @param {string} theme - The theme to apply ('light' or 'dark').
     */
    function applyTheme(theme) {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(theme);
    }

    /**
     * Handles theme selection: applies, saves, and updates the UI.
     * @param {string} theme - The selected theme.
     */
    function selectTheme(theme) {
      applyTheme(theme);
      saveThemePreference(theme);
      updateUI(theme);
    }

    /**
     * Updates the status and cookie info display.
     * @param {string} theme - The currently active theme.
     */
    function updateUI(theme) {
      const status = document.getElementById('status');
      const cookieInfo = document.getElementById('cookieInfo');

      status.textContent = `✅ "${theme}" theme applied and saved to cookie.`;
      cookieInfo.textContent = `🍪 Cookie: theme=${theme}`;
    }

    // --- Initialization ---

    // Load saved theme on page load (default to 'light' if no cookie found)
    const savedTheme = getThemePreference() || 'light';
    applyTheme(savedTheme);
    updateUI(savedTheme);

    // Button event listeners
    document.getElementById('lightBtn').addEventListener('click', () => {
      selectTheme('light');
    });

    document.getElementById('darkBtn').addEventListener('click', () => {
      selectTheme('dark');
    });
  </script>
</body>
</html>