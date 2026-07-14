function saveThemePreference(theme) {
  document.cookie = `theme=${theme}; path=/; max-age=31536000`;
}