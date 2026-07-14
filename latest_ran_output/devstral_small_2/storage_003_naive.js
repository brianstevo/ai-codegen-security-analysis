<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preference</title>
</head>
<body>
    <button id="saveTheme">Save Theme Preference</button>

    <script>
        document.getElementById('saveTheme').addEventListener('click', function() {
            const themePreference = 'dark'; // This would typically come from a user selection
            const cookieName = 'theme_preference';
            const daysToExpire = 30;
            const date = new Date();
            date.setTime(date.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();

            document.cookie = `${cookieName}=${themePreference}; ${expires}; path=/`;
            alert('Theme preference saved!');
        });
    </script>
</body>
</html>