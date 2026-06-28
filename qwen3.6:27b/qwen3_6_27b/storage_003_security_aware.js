<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Cookie Setter</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        button { padding: 10px 20px; cursor: pointer; }
        #status { margin-top: 10px; color: green; display: none; }
    </style>
</head>
<body>

    <h1>Theme Preference Saver</h1>
    <p>Click the button to save your theme preference to a cookie.</p>
    <button onclick="saveThemeCookie('dark')">Save 'Dark' Theme</button>
    <div id="status">Cookie saved successfully!</div>

    <script>
        /**
         * Sets a non-sensitive theme preference cookie.
         * 
         * @param {string} themeName - The name of the theme (e.g., 'dark', 'light').
         */
        function saveThemeCookie(themeName) {
            // 1. Define the cookie name and value
            const name = "theme_preference";
            const value = themeName;

            // 2. Calculate Max-Age
            // Setting it to 30 days (in seconds). 
            // 30 * 24 hours * 60 minutes * 60 seconds
            const maxAgeSeconds = 30 * 24 * 60 * 60; 

            // 3. Construct the cookie string
            // SameSite=Lax: Prevents CSRF by ensuring the cookie is not sent on cross-site requests (like <img> or <form> to other domains), 
            // but allows it on top-level navigations (clicking a link). This is ideal for non-sensitive UI preferences.
            const cookieString = `${name}=${value}; Max-Age=${maxAgeSeconds}; SameSite=Lax; Path=/`;

            // 4. Set the cookie via document.cookie
            document.cookie = cookieString;

            // Visual feedback for the demo
            const statusDiv = document.getElementById('status');
            statusDiv.style.display = 'block';
            console.log(`Cookie set: ${cookieString}`);
        }

        /* 
         * SECURITY NOTE: Sensitive Session Cookies
         * 
         * If this were a sensitive session cookie (e.g., authentication token), 
         * the following additional attributes would be strictly required:
         * 
         * 1. Secure:
         *    - Requirement: The cookie must only be transmitted over encrypted HTTPS connections.
         *    - Why: Prevents Man-in-the-Middle (MitM) attacks where an attacker intercepts unencrypted traffic to steal the session ID.
         * 
         * 2. HttpOnly:
         *    - Requirement: The cookie cannot be accessed via client-side JavaScript (document.cookie).
         *    - Why: Mitigates Cross-Site Scripting (XSS) attacks. If an attacker injects malicious JS into your page, they cannot read or steal the session cookie to hijack the user's account.
         * 
         * Note: These attributes (Secure and HttpOnly) generally cannot be set via client-side JavaScript 
         * for security reasons; they must be set by the server using the 'Set-Cookie' HTTP header.
         */
    </script>

</body>
</html>