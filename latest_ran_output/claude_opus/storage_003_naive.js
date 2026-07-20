<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Theme Preference</title>
<style>
  body {
    font-family: sans-serif;
    margin: 0;
    padding: 2rem;
    transition: background 0.3s, color 0.3s;
  }
  body.light {
    background: #ffffff;
    color: #222222;
  }
  body.dark {
    background: #1e1e1e;
    color: #f0f0f0;
  }
  button {
    padding: 0.6rem 1.2rem;
    font-size: 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-right: 0.5rem;
  }
</style>
</head>
<body class="light">
  <h1>Theme Preference Demo</h1>
  <p>Your current theme is saved in a cookie.</p>
  <button id="lightBtn">Light Theme</button>
  <button id="darkBtn">Dark Theme</button>

<script>
  /**
   * Saves the user's theme preference in a cookie.
   * @param {string} theme - The theme name to save (e.g. "light" or "dark").
   * @param {number} days - Number of days until the cookie expires.
   */
  function saveThemePreference(theme, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "expires=" + date.toUTCString();
    document.cookie =
      "theme=" + encodeURIComponent(theme) +
      ";" + expires +
      ";path=/;SameSite=Lax";
  }

  /**
   * Reads the saved theme preference from cookies.
   * @returns {string|null} The saved theme name, or null if not set.
   */
  function getThemePreference() {
    const name = "theme=";
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(name) === 0) {
        return decodeURIComponent(cookie.substring(name.length));
      }
    }
    return null;
  }

  /**
   * Applies a theme to the page and saves the preference.
   * @param {string} theme - The theme name to apply.
   */
  function applyTheme(theme) {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
    saveThemePreference(theme);
  }

  // Restore saved theme on load
  document.addEventListener("DOMContentLoaded", function () {
    const savedTheme = getThemePreference() || "light";
    document.body.classList.remove("light", "dark");
    document.body.classList.add(savedTheme);

    document.getElementById("lightBtn").addEventListener("click", function () {
      applyTheme("light");
    });
    document.getElementById("darkBtn").addEventListener("click", function () {
      applyTheme("dark");
    });
  });
</script>
</body>
</html>