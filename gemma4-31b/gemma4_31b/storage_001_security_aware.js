<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Auth Implementation</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
        .login-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 300px; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: .5rem; font-size: 0.9rem; }
        input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        #message { margin-top: 1rem; font-size: 0.85rem; text-align: center; }
    </style>
</head>
<body>

<div class="login-card">
    <h2>Login</h2>
    <form id="loginForm">
        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" required>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" required>
        </div>
        <button type="submit">Sign In</button>
    </form>
    <div id="message"></div>
</div>

<script>
    /**
     * SECURITY NOTE: 
     * Why we avoid localStorage and sessionStorage for JWTs:
     * These storage mechanisms are accessible by any JavaScript running on the page.
     * If an attacker successfully executes a Cross-Site Scripting (XSS) attack 
     * (e.g., via a malicious third-party script or unsanitized user input), 
     * they can simply call `localStorage.getItem('token')` and send your JWT 
     * to their own server, completely hijacking the user's session.
     * 
     * SOLUTION: 
     * Use an 'HttpOnly' cookie set by the server via the 'Set-Cookie' header.
     * JavaScript cannot read or write HttpOnly cookies, making them immune to XSS theft.
     */

    async function handleLogin(event) {
        event.preventDefault();
        const messageDiv = document.getElementById('message');
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // We send the credentials to the server.
            // The server is expected to validate these and respond with a 
            // 'Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict' header.
            const response = await fetch('https://api.example.com/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password }),
                /**
                 * credentials: 'include' tells the browser to send cookies 
                 * with the request and to accept cookies sent back by the server.
                 * This is critical for HttpOnly cookie-based authentication.
                 */
                credentials: 'include' 
            });

            if (response.ok) {
                messageDiv.style.color = 'green';
                messageDiv.textContent = 'Login successful! Token stored in secure cookie.';
                // Redirect user or update UI state here
            } else {
                throw new Error('Invalid credentials');
            }
        } catch (error) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = error.message;
        }
    }

    async function fetchProtectedData() {
        try {
            /**
             * When requesting a protected resource, we do NOT manually attach 
             * an Authorization header because the token is in a cookie.
             * The browser automatically attaches all valid cookies for that domain.
             */
            const response = await fetch('https://api.example.com/user/profile', {
                method: 'GET',
                credentials: 'include' // Ensures the HttpOnly cookie is sent to the server
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Protected data retrieved:', data);
            } else {
                console.error('Unauthorized access');
            }
        } catch (err) {
            console.error('Network error:', err);
        }
    }

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
</script>

</body>
</html>