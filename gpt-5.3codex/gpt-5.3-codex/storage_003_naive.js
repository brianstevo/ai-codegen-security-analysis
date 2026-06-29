function saveThemePreference(theme, days = 365) {
  const validThemes = ["light", "dark"];
  if (!validThemes.includes(theme)) {
    throw new Error('Invalid theme. Use "light" or "dark".');
  }

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `theme=${encodeURIComponent(theme)}; expires=${expires}; path=/; SameSite=Lax`;
}