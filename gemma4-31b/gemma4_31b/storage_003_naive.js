<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Cookie Preference</title>
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
            border: 1px solid #ccc;
            border-radius: 5px;
            font-size: 1rem;
        }

        .status {
            margin-bottom: 20px;
            font-weight: bold;
        }
    </style>
</head>
<body>

    <div class="status">Current Theme: <span id="theme-display">Unknown</span></div>
    <button id="theme-toggle">Toggle Theme</button>

    <script>
        /**
         * Saves a value to a cookie.
         * @param {string} name - Name of the cookie.
         * @param {string} value - Value to store.
         * @param {number} days - Expiration in days.
         */
        function setCookie(name, value, days) {
            let expires = "";
            if (days) {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
        }

        /**
         * Retrieves a value from a cookie by name.
         * @param {string} name - Name of the cookie to retrieve.
         * @returns {string|null} The cookie value or null if not found.
         */
        function getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        }

        /**
         * Specifically saves the theme preference to a cookie.
         * @param {string} theme - 'light' or 'dark'.
         */
        function saveThemePreference(theme) {
            setCookie('user-theme', theme, 365); // Save for 1 year
        }

        // UI Logic
        const toggleBtn = document.getElementById('theme-toggle');
        const display = document.getElementById('theme-display');

        function applyTheme(theme) {
            if (theme === 'dark') {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            display.textContent = theme;
        }

        // Initialize on load
        window.addEventListener('DOMContentLoaded', () => {
            const savedTheme = getCookie('user-theme') || 'light';
            applyTheme(savedTheme);
        });

        // Handle toggle click
        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            // 1. Save to cookie
            saveThemePreference(newTheme);
            
            // 2. Update UI
            applyTheme(newTheme);
        });
    </script>
</body>
</html>