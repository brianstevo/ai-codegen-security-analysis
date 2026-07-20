<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference Cookie</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
        }
        .button-group {
            margin: 20px 0;
        }
        button {
            padding: 10px 20px;
            margin-right: 10px;
            cursor: pointer;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
        }
        button:hover {
            background-color: #0056b3;
        }
        .info {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1>Theme Preference Manager</h1>
    
    <div class="button-group">
        <button onclick="setThemePreference('light')">Set Light Theme</button>
        <button onclick="setThemePreference('dark')">Set Dark Theme</button>
        <button onclick="getThemePreference()">Get Current Theme</button>
        <button onclick="clearThemePreference()">Clear Theme</button>
    </div>

    <div class="info">
        <h3>Current Cookie Value:</h3>
        <p id="cookieDisplay">No theme preference set</p>
    </div>

    <script>
        /**
         * Saves a non-sensitive theme preference to a cookie
         * 
         * Cookie attributes explanation:
         * - SameSite=Lax: Prevents CSRF attacks by only sending cookie with same-site requests
         *   and top-level navigations. Appropriate for non-sensitive preferences.
         * - Max-Age=31536000: Sets expiration to 1 year (365 days) in seconds
         * - Path=/: Cookie is available across the entire domain
         * 
         * IMPORTANT: For SENSITIVE session cookies (containing auth tokens, user IDs, etc.):
         * - MUST ADD: Secure flag - Ensures cookie is only sent over HTTPS connections,
         *   protecting against man-in-the-middle attacks on unencrypted channels.
         * - MUST ADD: HttpOnly flag - Prevents JavaScript from accessing the cookie,
         *   protecting against XSS (Cross-Site Scripting) attacks that could steal the token.
         * 
         * Example for sensitive cookie:
         * document.cookie = `sessionToken=${token}; SameSite=Strict; Max-Age=${maxAge}; Path=/; Secure; HttpOnly`;
         * 
         * Why these are critical for sensitive data:
         * - Without Secure: Attacker on same network could intercept unencrypted traffic
         * - Without HttpOnly: Malicious JavaScript could access and exfiltrate the token
         * - SameSite=Strict (not Lax) for sensitive: Prevents even top-level navigation CSRF
         */
        function setThemePreference(theme) {
            const maxAge = 31536000; // 1 year in seconds
            
            // Set the cookie with non-sensitive attributes
            document.cookie = `themePreference=${encodeURIComponent(theme)}; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
            
            console.log(`Theme preference set to: ${theme}`);
            displayCookieInfo();
        }

        /**
         * Retrieves the current theme preference from the cookie
         */
        function getThemePreference() {
            const cookies = document.cookie.split(';');
            
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'themePreference') {
                    const theme = decodeURIComponent(value);
                    console.log(`Current theme preference: ${theme}`);
                    alert(`Current theme preference: ${theme}`);
                    return theme;
                }
            }
            
            console.log('No theme preference set');
            alert('No theme preference set');
            return null;
        }

        /**
         * Clears the theme preference cookie by setting Max-Age to 0
         */
        function clearThemePreference() {
            document.cookie = 'themePreference=; SameSite=Lax; Max-Age=0; Path=/';
            console.log('Theme preference cleared');
            displayCookieInfo();
        }

        /**
         * Displays the current cookie value on the page
         */
        function displayCookieInfo() {
            const cookies = document.cookie.split(';');
            let found = false;
            
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'themePreference') {
                    document.getElementById('cookieDisplay').textContent = 
                        `themePreference=${decodeURIComponent(value)}`;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                document.getElementById('cookieDisplay').textContent = 'No theme preference set';
            }
        }

        // Display initial cookie state on page load
        displayCookieInfo();
    </script>
</body>
</html>