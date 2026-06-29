```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Authentication Handler</title>
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
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input {
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
        }
        button:hover {
            background-color: #0056b3;
        }
        .message {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .code-explanation {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
            font-size: 14px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Secure Authentication Demo</h1>
        <p>This demo shows how to handle authentication securely without storing JWT in localStorage or sessionStorage.</p>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required value="user@example.com">
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required value="password123">
            </div>
            <button type="submit">Login</button>
        </form>
        
        <div id="message"></div>
        
        <button id="protectedBtn" style="display:none; margin-top: 15px;">Call Protected Endpoint</button>
        
        <div class="code-explanation">
            <h3>Security Explanation:</h3>
            <p><strong>Why NOT to use localStorage/sessionStorage for JWT:</strong></p>
            <ul>
                <li>XSS (Cross-Site Scripting) attacks can access localStorage via JavaScript: <code>localStorage.getItem('token')</code></li>
                <li>Any malicious script injected into the page can steal the token and impersonate the user</li>
                <li>These storage mechanisms are accessible to all JavaScript code on the page</li>
            </ul>
            <p><strong>The Secure Approach (HttpOnly Cookies):</strong></p>
            <ul>
                <li>Server sets JWT in an HttpOnly cookie during login response</li>
                <li>HttpOnly flag prevents JavaScript from accessing the cookie</li>
                <li>Browser automatically includes the cookie in all requests to the same domain</li>
                <li>Even if XSS occurs, the attacker cannot steal the token via JavaScript</li>
                <li>Use <code>credentials: 'include'</code> in fetch to send cookies with cross-origin requests</li>
            </ul>
        </div>
    </div>

    <script>
        /**
         * SECURITY NOTE: Why NOT to store JWT in localStorage or sessionStorage
         * 
         * localStorage and sessionStorage are vulnerable to XSS (Cross-Site Scripting) attacks.
         * If an attacker can inject malicious JavaScript into your page, they can:
         * 1. Access the stored token: localStorage.getItem('authToken')
         * 2. Send it to their server to impersonate the user
         * 3. Make requests on behalf of the user with full access
         * 
         * THE SOLUTION: Use HttpOnly Cookies
         * - Server sets the JWT in an HttpOnly cookie during login
         * - HttpOnly flag makes the cookie inaccessible to JavaScript
         * - Browser automatically includes cookies in requests (same-origin by default)
         * - Even if XSS occurs, the attacker cannot steal the token via JavaScript
         */

        const loginForm = document.getElementById('loginForm');
        const messageDiv = document.getElementById('message');
        const protectedBtn = document.getElementById('protectedBtn');

        /**
         * Handles the login process
         * The server should respond with Set-Cookie header containing HttpOnly JWT
         */
        async function handleLogin(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                messageDiv.textContent = 'Logging in...';
                messageDiv.className = '';

                // Send login credentials to server
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // Credentials: 'include' ensures cookies are sent and received
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    throw new Error(`Login failed: ${response.statusText}`);
                }

                const data = await response.json();
                
                // NO JWT STORED IN JAVASCRIPT!
                // The server has already set the HttpOnly cookie in the Set-Cookie header
                // The browser will automatically manage and send this cookie with future requests
                
                showMessage('Login successful! Token stored in HttpOnly cookie.', 'success');
                loginForm.style.display = 'none';
                protectedBtn.style.display = 'block';

            } catch (error) {
                showMessage(`Login error: ${error.message}`, 'error');
            }
        }

        /**
         * Makes a request to a protected endpoint
         * The HttpOnly cookie is automatically included by the browser
         */
        async function callProtectedEndpoint() {
            try {
                messageDiv.textContent = 'Calling protected endpoint...';
                messageDiv.className = '';

                // The browser automatically includes the HttpOnly cookie here
                // No manual token passing needed - it's handled transparently
                const response = await fetch('/api/protected', {
                    method: 'GET',
                    // Important: include credentials to send/receive cookies
                    credentials: 'include'
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Unauthorized - please login again');
                    }
                    throw new Error(`Request failed: ${response.statusText}`);
                }

                const data = await response.json();
                showMessage(`Protected endpoint response: ${JSON.stringify(data)}`, 'success');

            } catch (error) {
                showMessage(`Error: ${error.message}`, 'error');
            }
        }

        /**
         * Logout function - clears the HttpOnly cookie
         */
        async function handleLogout() {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                
                // HttpOnly cookie is automatically cleared by server response
                loginForm.style.display = 'block';
                protectedBtn.style