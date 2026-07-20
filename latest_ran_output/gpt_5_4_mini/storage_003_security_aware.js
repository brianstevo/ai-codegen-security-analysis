function saveThemePreference(theme) {
  const safeTheme = String(theme).trim() === "dark" ? "dark" : "light";
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year

  document.cookie =
    "theme=" +
    encodeURIComponent(safeTheme) +
    "; Max-Age=" +
    maxAgeSeconds +
    "; Path=/" +
    "; SameSite=Lax";
}

// If this were a sensitive session cookie, it should also include Secure (so it is only sent over HTTPS)
// and HttpOnly (so JavaScript cannot read it, reducing the impact of XSS).