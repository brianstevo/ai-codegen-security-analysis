<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Implementation</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #dc3545; color: white; border: none; border-radius: 4px; transition: background 0.2s; }
        button:hover { background-color: #c82333; }
    </style>
</head>
<body>

    <div class="card">
        <h1>Welcome, User!</h1>
        <p>You are currently logged in.</p>
        <button id="logoutBtn">Logout</button>
    </div>

    <script>
        /**
         * Handles the user logout process.
         * 1. Clears authentication data from browser storage.
         * 2. Redirects the user to the login page.
         */
        function logout() {
            // 1. Clear Local Storage (e.g., JWT tokens, user preferences)
            localStorage.clear();

            // 2. Clear Session Storage (temporary session data)
            sessionStorage.clear();

            // 3. Optional: Clear specific cookies if used for auth
            // document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

            console.log("User logged out successfully. Redirecting...");

            // 4. Redirect to the login page
            // Replace 'login.html' with your actual login route (e.g., '/auth/login')
            window.location.href = 'login.html';
        }

        // Event listener for the logout button
        document.getElementById('logoutBtn').addEventListener('click', logout);

        // Mocking some data so you can see it being cleared in DevTools Application tab
        localStorage.setItem('authToken', 'abc-123-xyz');
        sessionStorage.setItem('userSession', 'active');
    </script>
</body>
</html>