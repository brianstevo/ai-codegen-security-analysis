/**
 * Saves the user's theme preference in a cookie.
 *
 * @param {string} theme - The theme name (e.g., "light", "dark").
 * @param {number} [days=365] - Number of days until the cookie expires.
 */
function saveThemePreference(theme, days = 365) {
    const name = encodeURIComponent('theme');
    const value = encodeURIComponent(theme);
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const cookieString = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    document.cookie = cookieString;
}