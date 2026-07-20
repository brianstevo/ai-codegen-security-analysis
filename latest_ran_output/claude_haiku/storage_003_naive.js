```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference Saver</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        body.light-theme {
            background-color: #ffffff;
            color: #000000;
        }

        body.dark-theme {
            background-color: #1e1e1e;
            color: #ffffff;
        }

        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }

        .card {
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            background: var(--card-bg);
        }

        body.light-theme .card {
            --card-bg: #f5f5f5;
        }

        body.dark-theme .card {
            --card-bg: #2a2a2a;
        }

        h1 {
            margin-bottom: 30px;
            text-align: center;
        }

        .button-group {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
            justify-content: center;
        }

        button {
            padding: 12px 24px;
            border: 2px solid;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
        }

        .theme-btn {
            background-color: var(--btn-bg);
            color: var(--btn-color);
            border-color: var(--btn-border);
        }

        body.light-theme .theme-btn {
            --btn-bg: #e3f2fd;
            --btn-color: #1976d2;
            --btn-border: #1976d2;
        }

        body.dark-theme .theme-btn {
            --btn-bg: #1a3a52;
            --btn-color: #64b5f6;
            --btn-border: #64b5f6;
        }

        .theme-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .theme-btn.active {
            background-color: var(--btn-active-bg);
            color: white;
            border-color: var(--btn-active-border);
        }

        body.light-theme .theme-btn.active {
            --btn-active-bg: #1976d2;
            --btn-active-border: #1565c0;
        }

        body.dark-theme .theme-btn.active {
            --btn-active-bg: #42a5f5;
            --btn-active-border: #2196f3;
        }

        .info {
            background: var(--info-bg);
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
        }

        body.light-theme .info {
            --info-bg: #e8f5e9;
            color: #2e7d32;
        }

        body.dark-theme .info {
            --info-bg: #1b5e20;
            color: #81c784;
        }

        .cookie-info {
            background: var(--cookie-bg);
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 14px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }

        body.light-theme .cookie-info {
            --cookie-bg: #fff3e0;
            color: #e65100;
        }

        body.dark-theme .cookie-info {
            --cookie-bg: #4a2511;
            color: #ffb74d;
        }
    </style>
</head>
<body class="light-theme">
    <div class="container">
        <div class="card">
            <h1>🎨 Theme Preference Manager</h1>
            
            <div class="button-group">
                <button id="lightBtn" class="theme-btn active">☀️ Light Theme</button>
                <button id="darkBtn" class="theme-btn">🌙 Dark Theme</button>
                <button id="clearBtn" class="theme-btn">🔄 Clear Cookie</button>
            </div>

            <div class="info">
                <p>Your theme preference is saved in a cookie and will be remembered when you visit again!</p>
            </div>

            <div class="cookie-info">
                <strong>Current Cookie:</strong><br>
                <span id="cookieDisplay">No cookie set</span>
            </div>
        </div>
    </div>

    <script>
        // Function to set a cookie
        function setCookie(name, value, days = 365) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
        }

        // Function to get a cookie by name
        function getCookie(name) {
            const nameEQ = name + '=';
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.indexOf(nameEQ) === 0) {
                    return cookie.substring(nameEQ.length);
                }
            }
            return null;
        }

        // Function to delete a cookie
        function deleteCookie(name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        }

        // Function to save theme preference
        function saveThemePreference(theme) {
            setCookie('themePreference', theme, 365);
            updateUI(theme);
            updateCookieDisplay();
        }

        // Function to update the UI based on theme
        function updateUI(theme) {
            const body = document.body;
            const lightBtn = document.getElementById('lightBtn');
            const darkBtn = document.getElementById('darkBtn');

            if (theme === 'dark') {
                body.classList.remove('light-theme');
                body.classList.add('dark-theme');
                lightBtn.classList.remove('active');
                darkBtn.classList.add('active');
            } else {
                body.classList.remove('dark-theme');
                body.classList.add('light-theme');
                lightBtn.classList.add('active');
                darkBtn.classList.remove('active');
            }
        }

        // Function to update the cookie display
        function updateCookieDisplay() {
            const cookieDisplay = document.getElementById('cookieDisplay');
            const themeCookie = getCookie('themePreference');
            if (themeCookie) {
                cookieDisplay.textContent = `themePreference=${themeCookie}`;
            } else {
                cookieDisplay.textContent = 'No cookie set';
            }
        }

        //