```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JWT Authentication</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"],
        input[type="password"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-right: 10px;
        }
        button:hover {
            background-color: #0056b3;
        }
        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 4px;
            display: none;
        }
        .status.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }
        .status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }
        .status.info {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            display: block;
        }
        .token-info {
            margin-top: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            display: none;
        }
        .token-info.show {
            display: block;
        }
        .button-group {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>JWT Authentication Demo</h1>
        
        <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" placeholder="Enter username" value="testuser">
        </div>
        
        <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" placeholder="Enter password" value="testpass">
        </div>
        
        <div class="button-group">
            <button onclick="handleLogin()">Login</button>
            <button onclick="handleLogout()">Logout</button>
            <button onclick="checkAuthStatus()">Check Status</button>
            <button onclick="getStoredToken()">Show Stored Token</button>
        </div>
        
        <div id="status" class="status"></div>
        <div id="tokenInfo" class="token-info"></div>
    </div>

    <script>
        // JWT Storage Management Functions
        
        /**
         * Store JWT token in localStorage
         * @param {string} token - The JWT token to store
         */
        function storeJWT(token) {
            if (!token) {
                console.error('No token provided');
                return false;
            }
            try {
                localStorage.setItem('jwt_token', token);
                localStorage.setItem('jwt_timestamp', new Date().getTime().toString());
                return true;
            } catch (error) {
                console.error('Failed to store JWT:', error);
                return false;
            }
        }

        /**
         * Retrieve JWT token from localStorage
         * @returns {string|null} The stored JWT token or null if not found
         */
        function getStoredJWT() {
            try {
                return localStorage.getItem('jwt_token');
            } catch (error) {
                console.error('Failed to retrieve JWT:', error);
                return null;
            }
        }

        /**
         * Check if JWT token exists and is valid
         * @returns {boolean} True if valid token exists
         */
        function isAuthenticated() {
            const token = getStoredJWT();
            return token !== null && token !== '';
        }

        /**
         * Remove JWT token from localStorage (logout)
         */
        function removeJWT() {
            try {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('jwt_timestamp');
                return true;
            } catch (error) {
                console.error('Failed to remove JWT:', error);
                return false;
            }
        }

        /**
         * Decode JWT token (basic decoding without verification)
         * @param {string} token - The JWT token to decode
         * @returns {object|null} Decoded payload or null if invalid
         */
        function decodeJWT(token) {
            try {
                const parts = token.split('.');
                if (parts.length !== 3) {
                    return null;
                }
                
                const payload = parts[1];
                const decoded = JSON.parse(atob(payload));
                return decoded;
            } catch (error) {
                console.error('Failed to decode JWT:', error);
                return null;
            }
        }

        /**
         * Check if JWT token is expired
         * @param {string} token - The JWT token to check
         * @returns {boolean} True if token is expired
         */
        function isTokenExpired(token) {
            const decoded = decodeJWT(token);
            if (!decoded || !decoded.exp) {
                return true;
            }
            
            const currentTime = Math.floor(Date.now() / 1000);
            return decoded.exp < currentTime;
        }

        /**
         * Get authorization header with JWT
         * @returns {string|null} Authorization header value or null if no token
         */
        function getAuthHeader() {
            const token = getStoredJWT();
            return token ? `Bearer ${token}` : null;
        }

        // UI Helper Functions
        function showStatus(message, type = 'info') {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = `status ${type}`;
        }

        // Simulated Login Handler
        async function handleLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showStatus('Please enter username and password', 'error');
                return;
            }

            showStatus('Logging in...', 'info');

            // Simulate API call to get JWT
            // In real application, this would be an actual API call
            setTimeout(() => {
                // Create a fake JWT token for demo purposes
                const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
                const payload = btoa(JSON.stringify({
                    sub: username,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
                    username: username
                }));
                const signature = btoa('fake-signature');
                const token = `${header}.${payload}.${signature}`;

                // Store the JWT
                if (storeJ