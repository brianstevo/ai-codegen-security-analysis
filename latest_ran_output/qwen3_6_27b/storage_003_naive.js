<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Cookie Saver</title>
    <style>
        body {
            font-family: sans-serif;
            padding: 2rem;
            transition: background-color 0.3s, color 0.3s;
        }
        .light-mode {
            background-color: #ffffff;
            color: #333333;
        }
        .dark-mode {
            background-color: #1a1a1a;
            color: #f0f0f0;
        }
        button {
            padding: 10px 20px;
            margin-right: 10px;
            cursor: pointer;
            font-size: 1rem;
            border: 1px solid #ccc;
            background: #eee;
        }
        .status {
            margin-top: 20px;
            padding: 10px;
            border: 1px dashed #999;
            font-family: monospace;
        }
    </style>
</head>
<body class="light-mode">

    <h1>Theme Preference Manager</h1>
    
    <div>
        <button onclick="saveThemePreference('light')">Set Light Theme</button>
        <button onclick="saveThemePreference('dark')">Set Dark Theme</button>
        <button onclick="loadAndApplyTheme()">Load Saved Theme</button>
    </div>

    <div class="status" id="statusDisplay">
        Current Cookie Value: <span id="cookieValue">None</span>
    </div>

    <script>
        /**
         * Saves the user's theme preference to a cookie.
         * @param {string} theme - The theme name (e.g., 'light', 'dark').
         * @param {number} days - Number of days until the cookie expires. Defaults to 365.
         */
        function saveThemePreference(theme, days = 365) {
            if (!theme) return;

            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            
            // Create the cookie string
            // path=/ ensures the cookie is available across the entire site
            const expires = "expires=" + date.toUTCString();
            document.cookie = "theme=" + theme + ";" + expires + ";path=/;SameSite=Lax";

            console.log(`Cookie set: theme=${theme}`);
            updateStatus(theme);
        }

        /**
         * Retrieves the value of a specific cookie.
         * @param {string} name - The name of the cookie to retrieve.
         * @returns {string|null} The value of the cookie, or null if not found.
         */
        function getCookieValue(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            
            for(let i = 0; i < ca.length; i++) {
                let c = ca[i];
                // Trim leading whitespace
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                
                if (c.indexOf(nameEQ) === 0) {
                    return c.substring(nameEQ.length, c.length);
                }
            }
            return null;
        }

        /**
         * Helper function to apply the theme visually and update UI.
         */
        function loadAndApplyTheme() {
            const savedTheme = getCookieValue('theme');
            
            if (savedTheme) {
                document.body.className = `${savedTheme}-mode`;
                updateStatus(savedTheme);
                console.log(`Applied theme: ${savedTheme}`);
            } else {
                // Default to light if no cookie exists
                document.body.className = 'light-mode';
                updateStatus('None (Defaulting to Light)');
            }
        }

        function updateStatus(value) {
            document.getElementById('cookieValue').textContent = value;
        }

        // Initialize on load
        window.onload = loadAndApplyTheme;
    </script>
</body>
</html>