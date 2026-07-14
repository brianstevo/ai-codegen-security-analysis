<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Example</title>
</head>
<body>
    <button id="logoutBtn">Logout</button>

    <script>
        document.getElementById('logoutBtn').addEventListener('click', function() {
            // Perform any logout-related tasks here (e.g., clearing tokens)
            localStorage.removeItem('authToken'); // Example: clear auth token

            // Redirect to login page
            window.location.href = '/login';
        });
    </script>
</body>
</html>