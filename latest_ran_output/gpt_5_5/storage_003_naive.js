function saveThemePreference(theme, days = 365) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();

  document.cookie = [
    `theme=${encodeURIComponent(theme)}`,
    `expires=${expires}`,
    "path=/",
    "SameSite=Lax"
  ].join("; ");
}