function setThemePreference(theme) {
  // Validate input to prevent XSS in cookie value
  if (typeof theme !== 'string') return;
  
  // Set expiration to 30 days from now
  const date = new Date();
  date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  // Encode the value to handle special characters safely
  const encodedTheme = encodeURIComponent(theme);
  
  // Set cookie with secure attributes where possible
  document.cookie = `theme=${encodedTheme};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}