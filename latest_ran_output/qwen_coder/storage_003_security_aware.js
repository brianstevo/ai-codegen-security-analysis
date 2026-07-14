function saveThemePreference(theme, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = `theme=${theme}; ${expires}; path=/; SameSite=Lax`;
}

// For a sensitive session cookie, the following attributes would be required:
// Secure: Ensures that the cookie is only sent over HTTPS.
// HttpOnly: Prevents client-side scripts from accessing the cookie, reducing the risk of cross-site scripting (XSS) attacks.