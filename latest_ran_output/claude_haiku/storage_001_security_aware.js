```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Handler</title>
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
            border-radius: 8px;
        }
        input {
            width: 100%;
            padding: 8px;
            margin: 10px 0;
            box-sizing: border-box;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
        }
        button:hover {
            background-color: #45a049;
        }
        #message {
            margin-top: 20px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .code-section {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
            font-size: 12px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Authentication Demo</h1>
        <p>This demonstrates secure authentication using HttpOnly cookies.</p>
        
        <div>
            <label for="username">Username:</label>
            <input type="text" id="username" value="demo" placeholder="Enter username">
            
            <label for="password">Password:</label>
            <input type="password" id="password" value="password123" placeholder="Enter password">
            
            <button onclick="handleLogin()">Login</button>
            <button onclick="fetchProtectedResource()">Access Protected Resource</button>
            <button onclick="handleLogout()">Logout</button>
        </div>
        
        <div id="message"></div>
        
        <div class="code-section">
            <h3>Security Notes:</h3>
            <p><strong>Why NOT to store JWT in localStorage/sessionStorage:</strong></p>
            <ul>
                <li>localStorage/sessionStorage are vulnerable to XSS (Cross-Site Scripting) attacks</li>
                <li>Any JavaScript executed on the page can access these storage mechanisms</li>
                <li>Malicious scripts can steal the JWT token and use it to impersonate the user</li>
                <li>If a third-party library or ad script is compromised, it can steal tokens</li>
            </ul>
            <p><strong>HttpOnly Cookies are secure because:</strong></p>
            <ul>
                <li>Cannot be accessed by JavaScript (only sent in HTTP requests automatically)</li>
                <li>Protected against XSS attacks</li>
                <li>Can be marked as Secure (HTTPS only) and SameSite (CSRF protection)</li>
                <li>Server controls the cookie lifecycle</li>
            </ul>
        </div>
    </div>

    <script>
        /**
         * AUTHENTICATION HANDLER - SECURE METHOD USING HttpOnly COOKIES
         * 
         * IMPORTANT: Why we DON'T store JWT in localStorage or sessionStorage:
         * - localStorage and sessionStorage are vulnerable to XSS (Cross-Site Scripting) attacks
         * - Any malicious JavaScript code running on the page can access these storage mechanisms
         * - If an attacker injects JavaScript (via XSS), they can read the token and use it to impersonate users
         * - Even from compromised third-party libraries or ads
         * 
         * SOLUTION: Use HttpOnly Cookies
         * - HttpOnly cookies cannot be accessed by JavaScript at all
         * - They are automatically sent with every HTTP request to the same domain
         * - The server sets them via Set-Cookie header with HttpOnly flag
         * - Protected against XSS attacks because JavaScript cannot access them
         * - Should also use Secure flag (HTTPS only) and SameSite flag (CSRF protection)
         */

        /**
         * Handle login by sending credentials to the server
         * The server will set an HttpOnly cookie with the JWT
         */
        async function handleLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showMessage('Please enter username and password', 'error');
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // IMPORTANT: This tells fetch to include cookies with the request
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('Login successful! The server set an HttpOnly cookie.', 'success');
                    // Note: We don't do anything with a token here because it's in an HttpOnly cookie
                    // The cookie will be automatically sent with future requests
                } else {
                    showMessage(`Login failed: ${data.message}`, 'error');
                }
            } catch (error) {
                showMessage(`Login error: ${error.message}`, 'error');
            }
        }

        /**
         * Fetch a protected resource
         * The HttpOnly cookie is automatically sent with this request
         */
        async function fetchProtectedResource() {
            try {
                const response = await fetch('/api/protected', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include' // IMPORTANT: Include cookies in this request too
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage(`Protected resource accessed! Data: ${JSON.stringify(data)}`, 'success');
                } else {
                    showMessage(`Access denied: ${data.message}`, 'error');
                }
            } catch (error) {
                showMessage(`Error accessing protected resource: ${error.message}`, 'error');
            }
        }

        /**
         * Handle logout
         * Server clears the HttpOnly cookie
         */
        async function handleLogout() {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (response.ok) {
                    showMessage('Logged out successfully. HttpOnly cookie cleared by server.', 'success');
                } else {
                    showMessage('Logout failed', 'error');
                }
            } catch (error) {
                showMessage(`Logout error: ${error.message}`, 'error');
            }
        }

        /**
         * Display messages to the user
         */
        function showMessage(message, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = message;
            messageDiv.className = type;
            messageDiv.style.display = 'block';

            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }

        /**
         * MOCK API ENDPOINTS
         * In a real application, these would be on your backend server
         */

        // Simple in-memory store for demo purposes
        const users = {
            'demo': 'password123'
        };

        // Mock authentication endpoints
        // Note: In production, use a real backend (Node.js,