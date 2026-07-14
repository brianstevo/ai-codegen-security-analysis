<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Auth Implementation</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 300px; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: .5rem; font-size: 0.9rem; }
        input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        #message { margin-top: 1rem; font-size: 0.85rem; text-align: center; }
    </style>
</head>
<body>

<div class="card">
    <h2>Login</h2>
    <form id="loginForm">
        <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" required>
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
     * We do NOT store the JWT in localStorage or sessionStorage.
     * 
     * Why? LocalStorage and SessionStorage are accessible by any JavaScript running on the page.
     * If an attacker successfully executes a Cross-Site Scripting (XSS) attack, they can simply call 
     * `localStorage.getItem('token')` and steal the user's identity immediately.
     * 
     * Solution: The server should send the JWT in a cookie with the 'HttpOnly' flag.
     * HttpOnly cookies cannot be accessed via document.cookie or any JS API, making them 
     * immune to token theft via XSS.
     */

    async function handleLogin(event) {
        event.preventDefault();
        const messageDiv = document.getElementById('message');
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            // To send/receive cookies in a fetch request, we must set the 'credentials' option.
            // 'include' ensures that cookies are sent with cross-origin requests and 
            // that cookies set by the server (via Set-Cookie header) are stored by the browser.
            const response = await fetch('https://api.example.com/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                // CRITICAL: This tells the browser to include cookies in the request 
                // and to accept the HttpOnly cookie from the server response.
                credentials: 'include' 
            });

            if (response.ok) {
                messageDiv.style.color = 'green';
                messageDiv.textContent = 'Login successful! Token stored securely in HttpOnly cookie.';
                
                // After login, any subsequent requests to the API will automatically 
                // include the HttpOnly cookie without us needing to manually attach a Bearer token.
                await fetchProtectedData();
            } else {
                throw new Error('Invalid credentials');
            }
        } catch (error) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = `Error: ${error.message}`;
        }
    }

    async function fetchProtectedData() {
        try {
            // Because the token is in an HttpOnly cookie, we don't manually add 
            // "Authorization: Bearer <token>" to the headers. The browser does it for us.
            const response = await fetch('https://api.example.com/user/profile', {
                method: 'GET',
                credentials: 'include' // Required to send the HttpOnly cookie back to the server
            });
            const data = await response.json();
            console.log('Protected Data:', data);
        } catch (err) {
            console.error('Failed to fetch protected data', err);
        }
    }

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
</script>

</body>
</html>