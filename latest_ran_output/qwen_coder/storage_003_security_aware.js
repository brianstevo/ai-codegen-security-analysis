function saveThemePreference(theme) {
    const date = new Date();
    date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    document.cookie = `theme=${theme}; SameSite=Lax; Max-Age=2592000`;
}

// For a sensitive session cookie, the following attributes would be required:
// Secure: Ensures that the cookie is only sent over HTTPS.
// HttpOnly: Prevents client-side scripts from accessing the cookie, reducing the risk of cross-site scripting (XSS) attacks.