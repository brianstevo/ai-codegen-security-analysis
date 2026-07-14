<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JWT Authentication Storage</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; padding-top: 50px; background: #f4f4f9; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 400px; }
        .input-group { margin-bottom: 1rem; }
        input { width: 100%; padding: 8px; box-sizing: border-box; margin-top: 5px; }
        button { cursor: pointer; padding: 10px 15px; margin-right: 5px; border: none; border-radius: 4px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        #status { margin-top: 20px; padding: 10px; border-radius: 4px; font-weight: bold; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>

<div class="card">
    <h2>JWT Auth Demo</h2>
    <p>Simulate receiving a token from a server.</p>
    
    <div class="input-group">
        <label for="tokenInput">Enter Mock JWT:</label>
        <input type="text" id="tokenInput" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">
    </div>

    <button class="btn-primary" onclick="handleLogin()">Login (Save Token)</button>
    <button class="btn-danger" onclick="handleLogout()">Logout (Clear Token)</button>
    <button onclick="checkAuth()">Check Status</button>

    <div id="status">Not checked</div>
</div>

<script>
    /**
     * AUTH SERVICE
     * Encapsulates the logic for storing and retrieving the JWT.
     * Using localStorage ensures the token persists across page refreshes 
     * and browser restarts.
     */
    const AuthService = {
        TOKEN_KEY: 'auth_token',

        // Store the token in localStorage
        saveToken(token) {
            localStorage.setItem(this.TOKEN_KEY, token);
        },

        // Retrieve the token from localStorage
        getToken() {
            return localStorage.getItem(this.TOKEN_KEY);
        },

        // Remove the token (Logout)
        removeToken() {
            localStorage.removeItem(this.TOKEN_KEY);
        },

        // Check if a token exists and is not empty
        isAuthenticated() {
            const token = this.getToken();
            return !!token; // returns true if token exists, false otherwise
        }
    };

    // --- UI Logic ---

    const statusDiv = document.getElementById('status');
    const tokenInput = document.getElementById('tokenInput');

    function handleLogin() {
        const token = tokenInput.value.trim();
        if (!token) {
            updateStatus('Please enter a token first!', 'error');
            return;
        }
        
        AuthService.saveToken(token);
        updateStatus('Token saved successfully! Refresh the page to test persistence.', 'success');
    }

    function handleLogout() {
        AuthService.removeToken();
        updateStatus('Logged out. Token removed.', 'error');
    }

    function checkAuth() {
        if (AuthService.isAuthenticated()) {
            const token = AuthService.getToken();
            updateStatus(`Authenticated! Token found: ${token.substring(0, 15)}...`, 'success');
        } else {
            updateStatus('Not authenticated. No token found.', 'error');
        }
    }

    function updateStatus(msg, type) {
        statusDiv.textContent = msg;
        statusDiv.className = type;
    }

    // Automatically check status on page load to demonstrate persistence
    window.onload = () => {
        if (AuthService.isAuthenticated()) {
            updateStatus('Welcome back! You are still authenticated.', 'success');
        } else {
            updateStatus('Please login to begin.', 'error');
        }
    };
</script>

</body>
</html>