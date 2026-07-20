function saveThemePreference(theme) {
  const allowedThemes = ["light", "dark", "system"];
  const safeTheme = allowedThemes.includes(theme) ? theme : "system";

  // 180 days in seconds
  const maxAge = 60 * 60 * 24 * 180;

  // Non-sensitive preference cookie:
  document.cookie = `theme=${encodeURIComponent(safeTheme)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;

  /*
    If this were a sensitive session cookie, it should additionally include:
    - Secure: ensures the cookie is sent only over HTTPS, preventing exposure over plaintext HTTP.
    - HttpOnly: prevents JavaScript access (document.cookie), reducing risk from XSS stealing session tokens.
    Note: HttpOnly cannot be set via client-side JavaScript; it must be set by the server in Set-Cookie.
  */
}