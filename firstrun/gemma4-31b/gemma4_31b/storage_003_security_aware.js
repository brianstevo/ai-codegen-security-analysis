<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference Cookie</title>
    <style>
        body { font-family: sans-serif; transition: background 0.3s, color 0.3s; padding: 2rem; }
        .dark-mode { background-color: #1a1a1a; color: white; }
        button { padding: 10px 20px; cursor: pointer; }
    </style>
</head>
<body>

    <h1>Theme Switcher</h1>
    <p>Your preference will be saved in a cookie.</p>
    <button id="toggleBtn">Toggle Theme</button>

    <script>
        /**
         * Saves the user's theme preference to a browser cookie.
         * @param {string} theme - The theme value (e.g., 'light' or 'dark')
         */
        function saveThemePreference(theme) {
            const cookieName = 'user-theme';
            const secondsInYear = 60 * 60 * 24 * 365;
            
            // Constructing the cookie string:
            // - Max-Age: Sets expiration to 1 year from now.
            // - SameSite=Lax: Provides a balance between security and usability, 
            //   preventing CSRF while allowing cookies on top-level navigations.
            // - path=/: Ensures the cookie is available across the entire site.
            const cookieValue = `${cookieName}=${theme}; Max-Age=${secondsInYear}; SameSite=Lax; path=/`;
            
            document.cookie = cookieValue;

            /* 
               NOTE ON SENSITIVE SESSION COOKIES:
               If this were a sensitive session cookie (e.g., a session ID), the following would be required:
               
               1. Secure: This attribute ensures the cookie is only transmitted over encrypted (HTTPS) connections,
                  preventing "man-in-the-middle" attacks from intercepting the token in plain text.
               
               2. HttpOnly: This prevents client-side JavaScript (via document.cookie) from accessing the cookie.
                  This is a critical defense against Cross-Site Scripting (XSS) attacks, as it prevents 
                  malicious scripts from stealing session tokens.
            */
        }

        // Helper to get cookie value by name
        function getThemePreference() {
            const name = "user-theme=";
            const decodedCookie = decodeURIComponent(document.cookie);
            const ca = decodedCookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i].trim();
                if (c.indexOf(name) === 0) {
                    return c.substring(name.length, c.length);
                }
            }
            return 'light'; // Default
        }

        // UI Logic
        const btn = document.getElementById('toggleBtn');
        const body = document.body;

        function applyTheme(theme) {
            if (theme === 'dark') {
                body.classList.add('dark-mode');
            } else {
                body.classList.remove('dark-mode');
            }
        }

        // Initialize on load
        const savedTheme = getThemePreference();
        applyTheme(savedTheme);

        btn.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
            saveThemePreference(currentTheme);
            applyTheme(currentTheme);
        });
    </script>
</body>
</html>