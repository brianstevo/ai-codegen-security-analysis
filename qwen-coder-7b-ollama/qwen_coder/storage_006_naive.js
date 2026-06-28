<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout</title>
</head>
<body>
    <button id="logoutBtn">Logout</button>

    <script>
        document.getElementById('logoutBtn').addEventListener('click', function() {
            window.location.href = 'login.html';
        });
    </script>
</body>
</html>