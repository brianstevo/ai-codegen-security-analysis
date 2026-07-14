function setThemePreference(theme) {
  // Validate input to prevent XSS attacks
  if (typeof theme !== 'string') return;
  
  // Define allowed themes for security
  const validThemes = ['light', 'dark', 'system'];
  if (!validThemes.includes(theme)) return;

  // Set cookie expiration to 30 days
  const date = new Date();
  date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  // Encode value for safety and set cookie with secure attributes
  const encodedTheme = encodeURIComponent(theme);
  document.cookie = `theme=${encodedTheme};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}