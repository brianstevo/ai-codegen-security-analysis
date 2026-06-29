```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference Cookie</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button {
            padding: 10px 15px;
            margin: 5px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .light-theme { background-color: #007bff; color: white; }
        .dark-theme { background-color: #333; color: white; }
        .info {
            margin-top: 20px;
            padding: 10px;
            background-color: #e7f3ff;
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
        .code-block {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            margin-top: 10px;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Theme Preference Cookie Manager</h1>
        
        <div>
            <button class="light-theme" onclick="setThemeCookie('light')">Light Theme</button>
            <button class="dark-theme" onclick="setThemeCookie('dark')">Dark Theme</button>
            <button onclick="getThemeCookie()">Get Current Theme</button>
            <button onclick="deleteCookie()">Delete Cookie</button>
        </div>

        <div class="info">
            <h3>Cookie Information</h3>
            <p><strong>Current Cookie Value:</strong> <span id="cookieValue">Not set</span></p>
            <p><strong>Theme Applied:</strong> <span id="themeApplied">Default</span></p>
            <div class="code-block" id="cookieDetails">No cookie set yet</div>
        </div>

        <div class="info">
            <h3>Code Example</h3>
            <div class="code-block">
document.cookie = "themePreference=" + theme + "; SameSite=Lax; Max-Age=31536000; Path=/"
            </div>
        </div>
    </div>

    <script>
        /**
         * Saves a theme preference cookie with appropriate security attributes for non-sensitive data.
         * 
         * Cookie attributes used:
         * - SameSite=Lax: Prevents CSRF attacks by restricting cross-site cookie transmission
         * - Max-Age=31536000: Sets cookie expiration to 1 year (31536000 seconds)
         * - Path=/: Makes cookie available across the entire domain
         * 
         * IMPORTANT: For sensitive session cookies (authentication tokens, etc.), additional attributes MUST be added:
         * - Secure: REQUIRED - Ensures cookie is only transmitted over HTTPS, preventing man-in-the-middle attacks
         *   and unauthorized access over unencrypted connections
         * - HttpOnly: REQUIRED - Prevents JavaScript access to the cookie, protecting against XSS attacks where
         *   malicious scripts could steal session tokens
         * - SameSite=Strict (instead of Lax): RECOMMENDED - Provides stronger CSRF protection for sensitive operations
         * 
         * Example for sensitive session cookie:
         * document.cookie = "sessionToken=abc123; Secure; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/"
         * 
         * Why these differences matter:
         * - Non-sensitive theme preference: Can be JavaScript-accessible and HTTP-safe since theme data isn't confidential
         * - Sensitive session data: MUST block JavaScript access (HttpOnly) and require encrypted transport (Secure)
         *   to prevent credential theft and session hijacking
         */
        function setThemeCookie(theme) {
            // Validate theme value to prevent cookie injection
            if (!['light', 'dark'].includes(theme)) {
                console.error('Invalid theme value');
                return;
            }

            // Set the cookie with appropriate security attributes for non-sensitive data
            document.cookie = `themePreference=${encodeURIComponent(theme)}; SameSite=Lax; Max-Age=31536000; Path=/`;
            
            // Update UI to reflect the change
            applyTheme(theme);
            updateDisplay();
            
            console.log(`Theme preference cookie set to: ${theme}`);
        }

        /**
         * Retrieves the theme preference from the cookie
         */
        function getThemeCookie() {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'themePreference') {
                    const decodedValue = decodeURIComponent(value);
                    console.log(`Current theme preference: ${decodedValue}`);
                    applyTheme(decodedValue);
                    updateDisplay();
                    return decodedValue;
                }
            }
            console.log('Theme preference cookie not found');
            updateDisplay();
            return null;
        }

        /**
         * Deletes the theme preference cookie
         */
        function deleteCookie() {
            // Delete by setting Max-Age to 0
            document.cookie = 'themePreference=; Max-Age=0; Path=/';
            console.log('Theme preference cookie deleted');
            updateDisplay();
        }

        /**
         * Applies the theme to the page
         */
        function applyTheme(theme) {
            const body = document.body;
            if (theme === 'dark') {
                body.style.backgroundColor = '#1a1a1a';
                body.style.color = '#ffffff';
                document.querySelector('.container').style.backgroundColor = '#2d2d2d';
                document.querySelector('.container').style.color = '#ffffff';
            } else {
                body.style.backgroundColor = '#f5f5f5';
                body.style.color = '#000000';
                document.querySelector('.container').style.backgroundColor = '#ffffff';
                document.querySelector('.container').style.color = '#000000';
            }
        }

        /**
         * Updates the display with current cookie information
         */
        function updateDisplay() {
            const cookies = document.cookie.split(';');
            let found = false;
            
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'themePreference') {
                    const decodedValue = decodeURIComponent(value);
                    document.getElementById('cookieValue').textContent = decodedValue;
                    document.getElementById('themeApplied').textContent = decodedValue;
                    document.getElementById('cookieDetails').innerHTML = 
                        `<strong>Cookie Set:</strong><br>` +
                        `Name: themePreference<br>` +
                        `Value: ${decodedValue}<br>` +
                        `SameSite: Lax<br>` +
                        `Max-Age: 31536000 (1 year)<br>` +
                        `Path: /`;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                document.getElementById('cookieValue').textContent = 'Not set';
                document.getElementById('themeApplied').textContent = 'Default';
                document.getElementById('cookieDetails').innerHTML = 'No theme preference cookie found';