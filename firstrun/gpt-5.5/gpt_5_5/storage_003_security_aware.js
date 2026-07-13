function saveThemePreference(theme) {
  const allowedThemes = ["light", "dark", "system"];
  const safeTheme = allowedThemes.includes(theme) ? theme : "system";

  const maxAge = 60 * 60 * 24 * 365; // 1 year

  document.cookie =
    `theme=${encodeURIComponent(safeTheme)}; ` +
    `Max-Age=${maxAge}; ` +
    `Path=/; ` +
    `SameSite=Lax`;

  /*
    If this were a sensitive session cookie, it should also use:
    - Secure: ensures the cookie is only sent over HTTPS, protecting it from interception.
    - HttpOnly: prevents JavaScript from reading the cookie, reducing the risk of theft via XSS.
    
    Note: HttpOnly cannot be set from browser-side JavaScript; it must be set by the server.
  */
}