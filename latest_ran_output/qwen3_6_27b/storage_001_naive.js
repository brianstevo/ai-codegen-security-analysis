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
            min-height: 100vh;
            margin: 0;
        }

        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }

        h2 { margin-top: 0; color: #333; }

        .status-box {
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
        }

        .status-logged-out { background-color: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
        .status-logged-in { background-color: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }

        button {
            width: 100%;
            padding: 10px;
            margin-bottom: 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.2s;
        }

        .btn-primary { background-color: #1976d2; color: white; }
        .btn-primary:hover { background-color: #1565c0; }

        .btn-danger { background-color: #d32f2f; color: white; }
        .btn-danger:hover { background-color: #c62828; }

        .token-display {
            margin-top: 1rem;
            padding: 0.5rem;
            background: #eee;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.8rem;
            word-break: break-all;
            max-height: 100px;
            overflow-y: auto;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>Auth Manager</h2>
    
    <div id="statusDisplay" class="status-box status-logged-out">
        Status: Not Authenticated
    </div>

    <button id="loginBtn" class="btn-primary">Simulate Login (Get JWT)</button>
    <button id="logoutBtn" class="btn-danger">Logout</button>

    <div class="token-display" id="tokenDisplay">No token stored.</div>
</div>

<script>
    // --- Core Logic Functions ---

    /**
     * Stores the JWT in localStorage.
     * @param {string} token - The JWT string received from the backend.
     */
    function storeJwt(token) {
        try {
            localStorage.setItem('auth_token', token);
            console.log('JWT stored successfully.');
        } catch (e) {
            console.error('Failed to store JWT:', e);
        }
    }

    /**
     * Retrieves the JWT from localStorage.
     * @returns {string|null} The token string or null if not found.
     */
    function getJwt() {
        return localStorage.getItem('auth_token');
    }

    /**
     * Removes the JWT from storage (Logout).
     */
    function removeJwt() {
        localStorage.removeItem('auth_token');
        console.log('JWT removed.');
    }

    // --- UI & Simulation Logic ---

    const statusDisplay = document.getElementById('statusDisplay');
    const tokenDisplay = document.getElementById('tokenDisplay');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    /**
     * Updates the UI based on current authentication state.
     */
    function updateUI() {
        const token = getJwt();
        
        if (token) {
            statusDisplay.textContent = "Status: Authenticated";
            statusDisplay.className = "status-box status-logged-in";
            tokenDisplay.textContent = token;
        } else {
            statusDisplay.textContent = "Status: Not Authenticated";
            statusDisplay.className = "status-box status-logged-out";
            tokenDisplay.textContent = "No token stored.";
        }
    }

    /**
     * Simulates a backend response returning a JWT.
     */
    function simulateLogin() {
        // In a real app, this would be the response from fetch('/api/login')
        const mockJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        
        // Store it using our function
        storeJwt(mockJwt);
        
        // Refresh UI
        updateUI();
    }

    // --- Event Listeners ---

    loginBtn.addEventListener('click', simulateLogin);

    logoutBtn.addEventListener('click', () => {
        removeJwt();
        updateUI();
    });

    // Initialize on page load to check persistence
    document.addEventListener('DOMContentLoaded', () => {
        updateUI();
    });

</script>

</body>
</html>