```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JWT Authentication Storage</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
        }
        .container {
            border: 1px solid #ccc;
            padding: 20px;
            border-radius: 5px;
        }
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 8px;
            margin: 10px 0;
            box-sizing: border-box;
        }
        button {
            padding: 10px 20px;
            margin: 10px 5px 10px 0;
            cursor: pointer;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
        }
        button:hover {
            background-color: #0056b3;
        }
        .status {
            margin-top: 20px;
            padding: 10px;
            border-radius: 3px;
        }
        .status.authenticated {
            background-color: #d4edda;
            color: #155724;
        }
        .status.unauthenticated {
            background-color: #f8d7da;
            color: #721c24;
        }
        .token-display {
            background-color: #f0f0f0;
            padding: 10px;
            margin: 10px 0;
            border-radius: 3px;
            word-break: break-all;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>JWT Authentication Demo</h1>
        
        <div>
            <label for="username">Username:</label>
            <input type="text" id="username" placeholder="Enter username" value="testuser">
        </div>
        
        <div>
            <label for="password">Password:</label>
            <input type="password" id="password" placeholder="Enter password" value="password123">
        </div>
        
        <button onclick="simulateLogin()">Login</button>
        <button onclick="logout()">Logout</button>
        <button onclick="checkAuthStatus()">Check Auth Status</button>
        <button onclick="refreshPage()">Refresh Page</button>
        
        <div id="status"></div>
        <div id="tokenDisplay"></div>
    </div>

    <script>
        // JWT Storage Management Functions
        const JWT_STORAGE_KEY = 'auth_jwt_token';
        const USER_STORAGE_KEY = 'auth_user';
        const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

        /**
         * Stores the JWT token in localStorage along with user info and expiry time
         * @param {string} token - The JWT token to store
         * @param {object} user - User information object
         * @param {number} expiryMinutes - Token expiry time in minutes (default: 60)
         */
        function storeJWT(token, user, expiryMinutes = 60) {
            if (!token) {
                console.error('Token is required');
                return false;
            }

            try {
                // Store the token
                localStorage.setItem(JWT_STORAGE_KEY, token);
                
                // Store user information
                if (user) {
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
                }
                
                // Store expiry timestamp
                const expiryTime = new Date().getTime() + (expiryMinutes * 60 * 1000);
                localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
                
                console.log('JWT stored successfully');
                return true;
            } catch (error) {
                console.error('Failed to store JWT:', error);
                return false;
            }
        }

        /**
         * Retrieves the stored JWT token from localStorage
         * @returns {string|null} The stored JWT token or null if not found
         */
        function getJWT() {
            try {
                const token = localStorage.getItem(JWT_STORAGE_KEY);
                
                // Check if token exists and is not expired
                if (token && isTokenValid()) {
                    return token;
                }
                
                // If token is expired, clear it
                if (token && !isTokenValid()) {
                    clearJWT();
                    return null;
                }
                
                return null;
            } catch (error) {
                console.error('Failed to retrieve JWT:', error);
                return null;
            }
        }

        /**
         * Checks if the stored token is valid and not expired
         * @returns {boolean} True if token exists and is valid
         */
        function isTokenValid() {
            try {
                const token = localStorage.getItem(JWT_STORAGE_KEY);
                const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
                
                if (!token || !expiryTime) {
                    return false;
                }
                
                const currentTime = new Date().getTime();
                const tokenExpiry = parseInt(expiryTime, 10);
                
                return currentTime < tokenExpiry;
            } catch (error) {
                console.error('Failed to validate token:', error);
                return false;
            }
        }

        /**
         * Gets the stored user information
         * @returns {object|null} The stored user object or null if not found
         */
        function getStoredUser() {
            try {
                const userJson = localStorage.getItem(USER_STORAGE_KEY);
                return userJson ? JSON.parse(userJson) : null;
            } catch (error) {
                console.error('Failed to retrieve user info:', error);
                return null;
            }
        }

        /**
         * Clears the stored JWT and related authentication data
         */
        function clearJWT() {
            try {
                localStorage.removeItem(JWT_STORAGE_KEY);
                localStorage.removeItem(USER_STORAGE_KEY);
                localStorage.removeItem(TOKEN_EXPIRY_KEY);
                console.log('JWT cleared successfully');
            } catch (error) {
                console.error('Failed to clear JWT:', error);
            }
        }

        /**
         * Checks if user is authenticated (has valid token)
         * @returns {boolean} True if user has a valid stored JWT
         */
        function isAuthenticated() {
            return isTokenValid();
        }

        /**
         * Simulates a login process and stores the JWT
         * This is a mock function that simulates receiving a JWT from a server
         */
        function simulateLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                alert('Please enter username and password');
                return;
            }

            // Simulate API call to login endpoint
            console.log('Attempting login for user:', username);
            
            // Mock JWT token (in real scenario, this would come from server)
            // This is a simple base64 encoded mock token
            const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IiIgKyB1c2VybmFtZSArICIiLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
            
            // Create a realistic mock token with the username
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT