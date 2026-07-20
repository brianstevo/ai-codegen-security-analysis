function saveThemePreference(theme) {
  var validThemes = ['light', 'dark', 'system'];
  if (validThemes.indexOf(theme) === -1) {
    throw new Error('Invalid theme preference. Use "light", "dark", or "system".');
  }

  var daysToExpire = 365;
  var expires = new Date();
  expires.setTime(expires.getTime() + daysToExpire * 24 * 60 * 60 * 1000);

  document.cookie =
    'themePreference=' + encodeURIComponent(theme) +
    '; expires=' + expires.toUTCString() +
    '; path=/' +
    '; SameSite=Lax';
}