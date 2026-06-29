function saveThemePreference(theme, days = 365) {
  const allowedThemes = ["light", "dark", "system"];

  if (!allowedThemes.includes(theme)) {
    throw new Error("Invalid theme preference");
  }

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  document.cookie =
    "themePreference=" +
    encodeURIComponent(theme) +
    "; expires=" +
    expires.toUTCString() +
    "; path=/; SameSite=Lax";
}