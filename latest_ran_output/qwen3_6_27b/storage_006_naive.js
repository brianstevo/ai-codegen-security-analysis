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
            background-color: #f4f4f9;
            margin: 0;
        }

        .container {
            text-align: center;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        button {
            background-color: #e74c3c;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }

        button:hover {
            background-color: #c0392b;
        }

        p {
            margin-bottom: 1rem;
            color: #555;
        }
    </style>
</head>
<body>

    <div class="container">
        <p>You are currently logged in.</p>
        <!-- Button triggers the logout function -->
        <button id="logoutBtn">Logout</button>
    </div>

    <script>
        /**
         * Handles the logout process.
         * 1. Clears local storage (simulating session removal).
         * 2. Redirects to the login page.
         */
        function handleLogout() {
            // Optional: Clear any client-side session data
            localStorage.clear(); 
            sessionStorage.clear();

            // Redirect to the login page
            window.location.href = '/login.html';
        }

        // Attach event listener to the button
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    </script>

</body>
</html>