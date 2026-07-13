<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JWT Persistence Demo</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; padding-top: 50px; background: #f4f4f9; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 350px; }
        .status { margin-bottom: 1rem; font-weight: bold; padding: 10px; border-radius: 4px; text-align: center; }
        .authenticated { background: #dcfce7; color: #166534; }
        .unauthenticated { background: #fee2e2; color: #991b1b; }
        input { width: 100%; padding: 8px; margin: 10px 0; box-sizing: border-box; }
        button { width: 100%; padding: 10px; cursor: pointer; margin-top: 5px; }
        .hidden { display: none; }
    </style>
</head>
<body>

<div class="card">
    <div id="statusIndicator" class="status">Checking status...</div>

    <div id="loginSection">
        <h3>Login</h3>
        <p style="font-size: 0.8rem; color: #666;">Enter any string to simulate a JWT</p>
        <input type="text" id="tokenInput" placeholder="eyJhbGciOiJIUzI1...">
        <button id="loginBtn">Save Token & Login</button>
    </div>

    <div id="userSection" class="hidden">
        <h3>Welcome Back!</h3>
        <p style="font-size: 0.8rem; word-break: break-all;" id="tokenDisplay"></p>
        <button id="logoutBtn">Logout</button>
    </div>
</div>

<script>
    /**
     * AuthManager handles the storage and retrieval of the JWT.
     * Using localStorage ensures the token persists across page refreshes 
     * and browser restarts.
     */
    const AuthManager = {
        TOKEN_KEY: 'auth_jwt_token',

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

        // Check if a token exists
        isAuthenticated() {
            const token = this.getToken();
            return !!token; // Returns true if token is not null/undefined
        }
    };

    // --- UI Logic ---

    const statusIndicator = document.getElementById('statusIndicator');
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    const tokenInput = document.getElementById('tokenInput');
    const tokenDisplay = document.getElementById('tokenDisplay');

    function updateUI() {
        if (AuthManager.isAuthenticated()) {
            const token = AuthManager.getToken();
            statusIndicator.textContent = "Authenticated";
            statusIndicator.className = "status authenticated";
            loginSection.classList.add('hidden');
            userSection.classList.remove('hidden');
            tokenDisplay.textContent = `Your stored JWT: ${token}`;
        } else {
            statusIndicator.textContent = "Not Authenticated";
            statusIndicator.className = "status unauthenticated";
            loginSection.classList.remove('hidden');
            userSection.classList.add('hidden');
        }
    }

    document.getElementById('loginBtn').addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
            AuthManager.saveToken(token);
            updateUI();
        } else {
            alert("Please enter a token value");
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        AuthManager.removeToken();
        updateUI();
    });

    // Initialize UI on page load
    window.addEventListener('DOMContentLoaded', updateUI);
</script>

</body>
</html>