<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JWT Persistence Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f4f9;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }

        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 350px;
            text-align: center;
        }

        h1 { margin-bottom: 1.5rem; font-size: 1.5rem; color: #333; }

        .status-box {
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1.5rem;
            font-weight: bold;
        }

        .status-logged-out { background-color: #ffebee; color: #c62828; }
        .status-logged-in { background-color: #e8f5e9; color: #2e7d32; }

        button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.2s;
            width: 100%;
            margin-bottom: 10px;
        }

        .btn-login { background-color: #1976d2; color: white; }
        .btn-login:hover { background-color: #1565c0; }

        .btn-logout { background-color: #ef5350; color: white; }
        .btn-logout:hover { background-color: #e53935; }

        .debug-info {
            margin-top: 20px;
            font-size: 0.8rem;
            color: #666;
            text-align: left;
            word-break: break-all;
            background: #eee;
            padding: 10px;
            border-radius: 4px;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>Auth Persistence Demo</h1>
    
    <div id="statusDisplay" class="status-box status-logged-out">
        Not Authenticated
    </div>

    <button id="loginBtn" class="btn-login">Simulate Login</button>
    <button id="logoutBtn" class="btn-logout" style="display: none;">Logout</button>

    <div class="debug-info">
        <strong>Storage Key:</strong> "auth_token"<br>
        <strong>Current Value:</strong> <span id="tokenValue">null</span>
    </div>
</div>

<script>
    // --- Configuration ---
    const TOKEN_KEY = 'auth_token';

    // --- Core Functions ---

    /**
     * Stores the JWT in localStorage.
     * @param {string} token - The JWT string received from the backend.
     */
    function storeToken(token) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
            console.log('Token stored successfully.');
        } catch (e) {
            console.error('Failed to store token:', e);
        }
    }

    /**
     * Retrieves the JWT from localStorage.
     * @returns {string|null} The token string or null if not found.
     */
    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    /**
     * Removes the JWT from localStorage (Logout).
     */
    function removeToken() {
        localStorage.removeItem(TOKEN_KEY);
        console.log('Token removed.');
    }

    // --- UI Logic & Simulation ---

    const statusDisplay = document.getElementById('statusDisplay');
    const tokenValueSpan = document.getElementById('tokenValue');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    function updateUI() {
        const token = getToken();
        
        if (token) {
            // User is authenticated
            statusDisplay.textContent = "Authenticated";
            statusDisplay.className = "status-box status-logged-in";
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
            
            // Truncate token for display purposes
            const shortToken = token.length > 20 ? token.substring(0, 20) + '...' : token;
            tokenValueSpan.textContent = shortToken;
        } else {
            // User is not authenticated
            statusDisplay.textContent = "Not Authenticated";
            statusDisplay.className = "status-box status-logged-out";
            loginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
            tokenValueSpan.textContent = 'null';
        }
    }

    // Simulate a backend response returning a JWT
    function simulateLogin() {
        // In a real app, this comes from fetch('/api/login').then(...)
        const fakeJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        
        storeToken(fakeJwt);
        updateUI();
    }

    function handleLogout() {
        removeToken();
        updateUI();
    }

    // --- Event Listeners ---

    loginBtn.addEventListener('click', simulateLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Initialize state on page load (demonstrates persistence)
    document.addEventListener('DOMContentLoaded', () => {
        updateUI();
    });

</script>

</body>
</html>