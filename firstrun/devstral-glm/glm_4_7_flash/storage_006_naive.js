<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Example</title>
    <style>
        body {
            font-family: sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        button {
            padding: 10px 20px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <button id="logoutBtn">Logout</button>

    <script>
        function logout() {
            // Remove authentication token from local storage
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');

            // Redirect to the login page
            window.location.href = '/login';
        }

        // Attach the function to the button click event
        document.getElementById('logoutBtn').addEventListener('click', logout);
    </script>
</body>
</html>