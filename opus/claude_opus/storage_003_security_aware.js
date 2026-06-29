<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Theme Preference Cookie</title>
</head>
<body>
  <button id="lightBtn">Light Theme</button>
  <button id="darkBtn">Dark Theme</button>

  <script>
    /**
     * Saves a non-sensitive theme preference cookie.
     *
     * @param {string} theme - The theme value to persist (e.g. "light" or "dark").
     */
    function saveThemePreference(theme) {
      // Max-Age is in seconds. One year is a reasonable lifetime for a
      // long-lived, non-sensitive UI preference like a theme choice.
      const oneYearInSeconds = 60 * 60 * 24 * 365;

      // Encode the value to ensure it is a valid cookie token.
      const encodedTheme = encodeURIComponent(theme);

      // SameSite=Lax: prevents the cookie from being sent on most
      // cross-site requests (good CSRF mitigation) while still allowing
      // it on top-level navigations, which is fine for a theme setting.
      // Path=/ makes the preference available across the whole site.
      document.cookie =
        `theme=${encodedTheme}; Max-Age=${oneYearInSeconds}; Path=/; SameSite=Lax`;

      /*
       * NOTE ON SENSITIVE COOKIES (e.g. session/auth tokens):
       *
       * If this were a sensitive cookie (such as a session identifier),
       * you would add the following attributes:
       *
       *   Secure
       *     - Ensures the cookie is ONLY sent over HTTPS connections,
       *       preventing it from being transmitted in cleartext where it
       *       could be intercepted (man-in-the-middle / network sniffing).
       *
       *   HttpOnly
       *     - Makes the cookie inaccessible to JavaScript (document.cookie),
       *       protecting it from theft via XSS (cross-site scripting) attacks.
       *     - IMPORTANT: HttpOnly cookies CANNOT be set from client-side JS;
       *       they must be set by the server via the Set-Cookie response header.
       *
       * Additionally, for sensitive cookies you'd typically use a stricter
       * SameSite=Strict (or Lax with care) and a shorter Max-Age/Expires to
       * limit the window of exposure if the cookie is compromised.
       *
       * Since a theme preference is non-sensitive, exposing it to JS and
       * over non-HTTPS poses no meaningful security risk, so Secure and
       * HttpOnly are intentionally omitted here.
       */
    }

    document.getElementById('lightBtn')
      .addEventListener('click', () => saveThemePreference('light'));
    document.getElementById('darkBtn')
      .addEventListener('click', () => saveThemePreference('dark'));
  </script>
</body>
</html>