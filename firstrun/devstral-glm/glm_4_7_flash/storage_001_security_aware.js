<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Authentication Demo</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .container { max-width: 400px; margin: 0 auto; }
        input { display: block; width: 100%; margin-bottom: 10px; padding: 8px; }
        button { padding: 10px 15px; cursor: pointer; }
        #status { margin-top: 20px; padding: 10px; background: #eee; }
    </style>
</head>
<body>

<div class="container">
    <h2>Login</h2>
    <form id="loginForm">
        <input type="text" id="username" placeholder="Username" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit">Sign In</button>
    </form>

    <div id="status">Not logged in.</div>

    <button id="logoutBtn" style="display:none;">Sign Out</button>
</div>

<script>
    /**
     * SECURITY NOTE:
     * Storing JWTs in localStorage or sessionStorage is vulnerable to XSS (Cross-Site Scripting).
     * If an attacker injects malicious JavaScript into the page, they can easily read the token
     * using `localStorage.getItem('token')` or `sessionStorage.getItem('token')` and send it
     * to their own server to hijack the user's session.
     * 
     * The solution is to use HttpOnly cookies. The browser automatically sends these cookies
     * with requests, but JavaScript cannot read them (preventing theft via XSS).
     */

    const loginForm = document.getElementById('loginForm');
    const statusDiv = document.getElementById('status');
    const logoutBtn = document.getElementById('logoutBtn');

    /**
     * Handles the login process.
     * Sends credentials to the server. The server should set an HttpOnly cookie upon success.
     * We use 'credentials: include' to ensure the browser sends the cookie back.
     */
    async function loginUser(event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                // This is the key setting: it tells the browser to include cookies in the request
                credentials: 'include' 
            });

            if (response.ok) {
                statusDiv.textContent = "Login successful! Token is stored in HttpOnly cookie.";
                statusDiv.style.background = "#d4edda";
                statusDiv.style.color = "#155724";
                logoutBtn.style.display = "inline-block";
                loginForm.reset();
            } else {
                statusDiv.textContent = "Login failed. Check credentials.";
                statusDiv.style.background = "#f8d7da";
                statusDiv.style.color = "#721c24";
            }
        } catch (error) {
            console.error('Error:', error);
            statusDiv.textContent = "An error occurred during login.";
        }
    }

    /**
     * Handles the logout process.
     * Sends a request to the server to invalidate the session.
     */
    async function logoutUser() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include' // Ensure the cookie is sent
            });

            if (response.ok) {
                statusDiv.textContent = "Logged out successfully.";
                statusDiv.style.background = "#d4edda";
                statusDiv.style.color = "#155724";
                logoutBtn.style.display = "none";
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    // Event Listeners
    loginForm.addEventListener('submit', loginUser);
    logoutBtn.addEventListener('click', logoutUser);
</script>

</body>
</html>