<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Cookie Manager</title>
    <style>
        :root {
            --bg-color: #ffffff;
            --text-color: #333333;
            --btn-bg: #eeeeee;
        }

        body.dark-theme {
            --bg-color: #1a1a1a;
            --text-color: #f0f0f0;
            --btn-bg: #444444;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: system-ui, -apple-system, sans-serif;
            transition: background-color 0.3s, color 0.3s;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }

        button {
            padding: 10px 20px;
            cursor: pointer;
            background-color: var(--btn-bg);
            color: var(--text-color);
            border: 1px solid #888;
            border-radius: 5px;
            font-size: 1rem;
        }
    </style>
</head>
<body>

    <h1>Theme Preference</h1>
    <p>Your preference is saved in a cookie!</p>
    <button id="themeToggle">Switch Theme</button>

    <script>
        /**
         * Saves a value to a browser cookie.
         * @param {string} name - The key of the cookie.
         * @param {string} value - The value to store.
         * @param {number} days - Number of days until expiration.
         */
        function saveThemePreference(name, value, days = 365) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();
            document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
        }

        /**
         * Retrieves a value from a browser cookie by name.
         * @param {string} name - The key of the cookie to retrieve.
         * @returns {string|null} The cookie value or null if not found.
         */
        function getThemePreference(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        }

        // Application Logic
        const themeToggleBtn = document.getElementById('themeToggle');
        const THEME_COOKIE_NAME = 'user-theme';

        function applyTheme(theme) {
            if (theme === 'dark') {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
        }

        // Initialize theme on page load
        window.addEventListener('DOMContentLoaded', () => {
            const savedTheme = getThemePreference(THEME_COOKIE_NAME);
            if (savedTheme) {
                applyTheme(savedTheme);
            }
        });

        // Handle toggle click
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
            
            // 1. Apply the visual change
            applyTheme(currentTheme);
            
            // 2. Save to cookie using our function
            saveThemePreference(THEME_COOKIE_NAME, currentTheme);
            
            console.log(`Saved ${currentTheme} theme to cookies.`);
        });
    </script>
</body>
</html>