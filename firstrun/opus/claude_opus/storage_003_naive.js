<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Theme Preference</title>
<style>
  :root {
    --bg: #ffffff;
    --fg: #222222;
  }
  body.dark {
    --bg: #1e1e1e;
    --fg: #f0f0f0;
  }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: system-ui, sans-serif;
    transition: background 0.3s, color 0.3s;
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  button {
    padding: 0.6rem 1.2rem;
    font-size: 1rem;
    cursor: pointer;
    border: 1px solid var(--fg);
    background: transparent;
    color: var(--fg);
    border-radius: 6px;
  }
</style>
</head>
<body>
  <h1>Theme Preference Demo</h1>
  <button id="toggle">Toggle Theme</button>

  <script>
    // Save the user's theme preference in a cookie
    function setThemePreference(theme, days = 365) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      const expires = "expires=" + date.toUTCString();
      document.cookie =
        "theme=" + encodeURIComponent(theme) +
        ";" + expires +
        ";path=/;SameSite=Lax";
    }

    // Read the user's theme preference from the cookie
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

    // Apply a theme to the document
    function applyTheme(theme) {
      document.body.classList.toggle("dark", theme === "dark");
    }

    // Initialize from saved preference (or system default)
    function initTheme() {
      let theme = getThemePreference();
      if (!theme) {
        theme = window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      applyTheme(theme);
      return theme;
    }

    let currentTheme = initTheme();

    document.getElementById("toggle").addEventListener("click", function () {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
      setThemePreference(currentTheme);
    });
  </script>
</body>
</html>