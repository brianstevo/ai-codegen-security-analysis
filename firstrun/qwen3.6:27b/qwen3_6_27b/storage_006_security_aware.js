<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Logout</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
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
            background-color: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 1rem;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: #c82333;
        }
        button:disabled {
            background-color: #e2e6ea;
            color: #6c757d;
            cursor: not-allowed;
        }
        .status {
            margin-top: 1rem;
            font-size: 0.9rem;
            color: #555;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>User Dashboard</h2>
    <p>You are currently logged in.</p>
    <button id="logoutBtn" onclick="performLogout()">Logout</button>
    <div id="statusMessage" class="status"></div>
</div>

<script>
    /**
     * Performs a secure logout sequence.
     * 1. Clears client-side storage (localStorage, sessionStorage).
     * 2. Sends POST request to server to invalidate session and clear HttpOnly cookie.
     * 3. Redirects only after successful server response.
     */
    async function performLogout() {
        const btn = document.getElementById('logoutBtn');
        const statusMsg = document.getElementById('statusMessage');

        // UI Feedback: Disable button to prevent double submission
        btn.disabled = true;
        btn.textContent = "Logging out...";
        statusMsg.textContent = "Clearing local data and contacting server...";

        try {
            // 1. Clear Client-Side Sensitive State
            // Note: This does not clear HttpOnly cookies, which is correct behavior 
            // as JS should not have access to them for security reasons.
            localStorage.clear();
            sessionStorage.clear();

            // 2. Send POST request to Server
            // The server must handle the session destruction and set the cookie expiration here.
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // credentials: 'include' is often needed if using cookies for auth, 
                // though standard browser behavior usually includes them for same-origin.
                credentials: 'same-origin' 
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            statusMsg.textContent = "Logout successful.";

            // 3. Redirect only after server confirmation
            // Using window.location.replace() is preferred over assign() to prevent 
            // the user from hitting "Back" and returning to the logged-in state.
            window.location.replace('/login'); 

        } catch (error) {
            console.error("Logout failed:", error);
            statusMsg.textContent = "Logout failed. Please try again.";
            btn.disabled = false;
            btn.textContent = "Logout";
            
            // Optional: Fallback redirect if server is unreachable but we want to force logout locally
            // window.location.replace('/login'); 
        }
    }
</script>

</body>
</html>