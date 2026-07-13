<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Implementation</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f4f4f9;
        }
        .card {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }
        button {
            background-color: #ef4444;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
        }
        button:hover {
            background-color: #dc2626;
        }
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
         * Clears authentication data and redirects to the login page.
         */
        function logout() {
            // 1. Clear Local Storage (e.g., JWT tokens, user preferences)
            localStorage.clear();

            // 2. Clear Session Storage
            sessionStorage.clear();

            // 3. Clear Cookies (Optional: iterates through all cookies and expires them)
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i];
                const eqPos = cookie.indexOf("=");
                const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
            }

            // 4. Redirect to the login page
            // Replace 'login.html' with your actual login route (e.g., '/auth/login')
            window.location.href = 'login.html';
        }

        // Event listener for the logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to log out?')) {
                logout();
            }
        });
    </script>
</body>
</html>