<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference with Cookie</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            transition: background-color 0.3s, color 0.3s;
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
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border-radius: 8px;
            background-color: rgba(255, 255, 255, 0.1);
        }
        
        button {
            padding: 10px 20px;
            margin: 10px 5px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s;
        }
        
        .light-btn {
            background-color: #ffeb3b;
            color: #000;
        }
        
        .light-btn:hover {
            background-color: #fdd835;
        }
        
        .dark-btn {
            background-color: #424242;
            color: #fff;
        }
        
        .dark-btn:hover {
            background-color: #616161;
        }
        
        .status {
            margin-top: 20px;
            padding: 10px;
            border-radius: 4px;
            background-color: rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body class="light-theme">
    <div class="container">
        <h1>Theme Preference Manager</h1>
        <p>Click the buttons below to change your theme preference. Your choice will be saved in a cookie.</p>
        
        <div>
            <button class="light-btn" onclick="setTheme('light')">☀️ Light Theme</button>
            <button class="dark-btn" onclick="setTheme('dark')">🌙 Dark Theme</button>
        </div>
        
        <div class="status">
            <p>Current theme: <strong id="currentTheme">Light</strong></p>
            <p id="cookieInfo"></p>
        </div>
    </div>

    <script>
        // Set a cookie with the user's theme preference
        function setThemeCookie(theme, days = 365) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();
            document.cookie = "theme=" + theme + ";" + expires + ";path=/;SameSite=Strict";
        }

        // Get theme preference from cookie
        function getThemeCookie() {
            const nameEQ = "theme=";
            const cookies = document.cookie.split(';');
            
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.indexOf(nameEQ) === 0) {
                    return cookie.substring(nameEQ.length);
                }
            }
            
            return null;
        }

        // Remove theme cookie
        function removeThemeCookie() {
            document.cookie = "theme=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
        }

        // Set the theme and save preference
        function setTheme(theme) {
            const body = document.body;
            
            // Remove all theme classes
            body.classList.remove('light-theme', 'dark-theme');
            
            // Add the new theme class
            if (theme === 'dark') {
                body.classList.add('dark-theme');
                setThemeCookie('dark');
                document.getElementById('currentTheme').textContent = 'Dark';
            } else {
                body.classList.add('light-theme');
                setThemeCookie('light');
                document.getElementById('currentTheme').textContent = 'Light';
            }
            
            updateCookieInfo();
        }

        // Load theme preference from cookie on page load
        function loadThemePreference() {
            const savedTheme = getThemeCookie();
            
            if (savedTheme) {
                setTheme(savedTheme);
            } else {
                // Default to light theme if no preference saved
                setTheme('light');
            }
            
            updateCookieInfo();
        }

        // Display cookie information
        function updateCookieInfo() {
            const theme = getThemeCookie();
            const cookieInfoEl = document.getElementById('cookieInfo');
            
            if (theme) {
                cookieInfoEl.textContent = `Cookie saved: theme=${theme}`;
            } else {
                cookieInfoEl.textContent = 'No theme cookie found';
            }
        }

        // Initialize theme on page load
        window.addEventListener('DOMContentLoaded', loadThemePreference);
    </script>
</body>
</html>