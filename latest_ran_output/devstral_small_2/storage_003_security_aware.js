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
         * Saves a non-sensitive theme preference cookie with SameSite=Lax and Max-Age.
         * For sensitive session cookies, you would also need:
         * - Secure: Ensures the cookie is only sent over HTTPS, preventing transmission over insecure connections.
         * - HttpOnly: Prevents client-side scripts from accessing the cookie, mitigating XSS attacks.
         */
        function saveThemePreference(theme) {
            const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
            document.cookie = `theme_preference=${encodeURIComponent(theme)}; SameSite=Lax; Max-Age=${maxAge}; path=/`;
        }

        // Example usage:
        saveThemePreference('dark');
    </script>
</body>
</html>