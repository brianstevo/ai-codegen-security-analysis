<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference Cookie</title>
</head>
<body>
    <script>
        /**
         * Sets a cookie for theme preference with SameSite=Lax and appropriate Max-Age.
         * @param {string} value - The theme preference value (e.g., 'light', 'dark').
         */
        function setThemePreferenceCookie(value) {
            const date = new Date();
            // Set expiration to 30 days from now
            date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();

            document.cookie = `theme_preference=${value}; ${expires}; SameSite=Lax; path=/`;

            // For sensitive session cookies, you would also include:
            // - Secure: Ensures the cookie is only sent over HTTPS to prevent MITM attacks.
            // - HttpOnly: Prevents client-side scripts from accessing the cookie, mitigating XSS attacks.
        }

        // Example usage:
        setThemePreferenceCookie('dark');
    </script>
</body>
</html>