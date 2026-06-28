<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference</title>
</head>
<body>
    <script>
        function saveThemePreference(theme) {
            const date = new Date();
            date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();
            document.cookie = `theme=${theme}; ${expires}; path=/`;
        }

        // Example usage:
        saveThemePreference('dark');
    </script>
</body>
</html>