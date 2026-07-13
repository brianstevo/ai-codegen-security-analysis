function saveThemePreference(theme) {
  const validThemes = ["light", "dark", "system"];
  if (!validThemes.includes(theme)) {
    throw new Error("Invalid theme preference. Use 'light', 'dark', or 'system'.");
  }

  const daysToExpire = 365;
  const expires = new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000).toUTCString();

  document.cookie = [
    `theme=${encodeURIComponent(theme)}`,
    `expires=${expires}`,
    "path=/",
    "SameSite=Lax"
  ].join("; ");
}

// Example usage:
// saveThemePreference("dark");