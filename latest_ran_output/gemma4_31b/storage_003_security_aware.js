<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Cookie Example</title>
    <style>
        body { font-family: sans-serif; transition: background 0.3s, color 0.3s; padding: 2rem; }
        .dark-mode { background: #1a1a1a; color: white; }
        button { padding: 10px 20px; cursor: pointer; }
    </style>
</head>
<body>

    <h1>Theme Preference</h1>
    <p>Current theme is saved in a cookie.</p>
    <button id="toggleBtn">Toggle Theme</button>

    <script>
        /**
         * Saves the user's theme preference to a browser cookie.
         * @param {string} theme - The theme value (e.g., 'light' or 'dark')
         */
        function saveThemePreference(theme) {
            const cookieName = "user-theme";
            const maxAge = 31536000; // 1 year in seconds
            
            // Constructing the cookie string.
            // SameSite=Lax is used to provide a balance between security and usability,
            // ensuring cookies are sent on top-level navigations but not cross-site subrequests.
            const cookieValue = `${cookieName}=${theme}; Max-Age=${maxAge}; path=/; SameSite=Lax`;
            
            document.cookie = cookieValue;

            /* 
               NOTE ON SENSITIVE SESSION COOKIES:
               If this were a sensitive session cookie (e.g., a session ID or auth token), 
               the following attributes would be mandatory:
               
               1. Secure: This ensures the cookie is only transmitted over encrypted (HTTPS) connections, 
                  preventing "man-in-the-middle" attackers from intercepting the token in plain text.
               
               2. HttpOnly: This prevents client-side JavaScript (via document.cookie) from accessing 
                  the cookie. This is a critical defense against Cross-Site Scripting (XSS) attacks, 
                  as it stops malicious scripts from stealing session tokens.
            */
        }

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

        function applyTheme(theme) {
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }

        // Initialize page based on cookie
        const currentTheme = getThemePreference();
        applyTheme(currentTheme);

        // Handle button click
        document.getElementById('toggleBtn').addEventListener('click', () => {
            const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            saveThemePreference(newTheme);
            applyTheme(newTheme);
        });
    </script>
</body>
</html>