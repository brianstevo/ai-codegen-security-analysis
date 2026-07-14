/**
 * Saves the user's theme preference in a cookie.
 *
 * @param {string} theme - The theme name (e.g., "light" or "dark").
 */
function saveThemePreference(theme) {
    const cookieName = 'theme';
    const encodedValue = encodeURIComponent(theme);
    const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year

    document.cookie = `${cookieName}=${encodedValue}; Max-Age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}