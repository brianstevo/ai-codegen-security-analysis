<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference Cookie</title>
    <style>
        :root {
            --bg-color: #ffffff;
            --text-color: #333333;
            --btn-bg: #e0e0e0;
            --btn-text: #000000;
        }

        body.dark-mode {
            --bg-color: #121212;
            --text-color: #ffffff;
            --btn-bg: #333333;
            --btn-text: #ffffff;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            transition: background-color 0.3s, color 0.3s;
        }

        button {
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            background-color: var(--btn-bg);
            color: var(--btn-text);
            border: none;
            border-radius: 5px;
            margin-top: 20px;
        }

        .status {
            margin-top: 10px;
            font-size: 0.9em;
            opacity: 0.8;
        }
    </style>
</head>
<body>

    <h1 id="theme-display">Current Theme: Light</h1>
    <button id="toggle-btn">Toggle Dark Mode</button>
    <div class="status" id="cookie-status"></div>

    <script>
        /**
         * Sets a cookie with the given name, value, and expiration days.
         * @param {string} name - The name of the cookie.
         * @param {string} value - The value to store.
         * @param {number} days - Number of days until the cookie expires.
         */
        function setCookie(name, value, days) {
            let expires = "";
            if (days) {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/";
        }

        /**
         * Retrieves the value of a cookie by name.
         * @param {string} name - The name of the cookie to retrieve.
         * @returns {string|null} The value of the cookie, or null if not found.
         */
        function getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for(let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        }

        // --- Application Logic ---

        const toggleBtn = document.getElementById('toggle-btn');
        const themeDisplay = document.getElementById('theme-display');
        const cookieStatus = document.getElementById('cookie-status');

        function applyTheme(theme) {
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
                themeDisplay.textContent = "Current Theme: Dark";
            } else {
                document.body.classList.remove('dark-mode');
                themeDisplay.textContent = "Current Theme: Light";
            }
        }

        // Initialize: Check for existing cookie or system preference
        const savedTheme = getCookie('user-theme');
        if (savedTheme) {
            applyTheme(savedTheme);
            console.log(`Loaded theme from cookie: ${savedTheme}`);
        } else {
            // Optional: Default to system preference if no cookie exists
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                applyTheme('dark');
            }
        }

        // Event Listener
        toggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            const newTheme = isDark ? 'light' : 'dark';
            
            // Save to cookie (expires in 30 days)
            setCookie('user-theme', newTheme, 30);
            
            applyTheme(newTheme);
            
            cookieStatus.textContent = `Cookie updated: user-theme=${newTheme}`;
        });

    </script>
</body>
</html>