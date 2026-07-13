<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Authentication Demo</title>
    <style>
        body { font-family: sans-serif; padding: 2rem; }
        .container { max-width: 400px; margin: 0 auto; }
        input { display: block; width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box; }
        button { padding: 10px 20px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 4px; }
        button:hover { background-color: #0056b3; }
        .status { margin-top: 20px; padding: 10px; border: 1px solid #ccc; display: none; }
        .success { background-color: #d4edda; color: #155724; }
        .error { background-color: #f8d7da; color: #721c24; }
    </style>
</head>
<body>

<div class="container">
    <h2>Login</h2>
    <form id="loginForm">
        <input type="text" id="username" placeholder="Username" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit">Login</button>
    </form>

    <div id="statusMessage" class="status"></div>
    
    <hr style="margin: 20px 0;">
    
    <h3>Protected Resource Test</h3>
    <p>Click below to verify the cookie is sent automatically.</p>
    <button id="fetchDataBtn">Fetch Protected Data</button>
    <pre id="dataOutput" style="background: #f4f4f4; padding: 10px; margin-top: 10px;"></pre>
</div>

<script>
    /**
     * SECURITY NOTE: Why we do NOT use localStorage or sessionStorage for JWTs.
     * 
     * Storing tokens in Web Storage (localStorage/sessionStorage) makes the application
     * vulnerable to Cross-Site Scripting (XSS). If an attacker injects malicious JavaScript
     * into your page, they can easily read the token via:
     *   const token = localStorage.getItem('jwt');
     * 
     * Once stolen, the attacker can impersonate the user.
     * 
     * SOLUTION: HttpOnly Cookies.
     * By setting the 'HttpOnly' flag on the cookie server-side, JavaScript running in the
     * browser cannot access the cookie value via document.cookie or Web Storage APIs.
     * The browser automatically attaches this cookie to requests sent to the same domain,
     * keeping the token secure from XSS attacks while maintaining state.
     */

    const API_URL = 'https://jsonplaceholder.typicode.com'; // Using a dummy API for demonstration
    
    // 1. Handle Login Submission
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const statusDiv = document.getElementById('statusMessage');

        try {
            // In a real scenario, this endpoint would validate credentials and set the HttpOnly cookie.
            // Since we are using a dummy API, we will simulate the server setting the cookie manually here.
            
            await mockLoginRequest(username);

            // Simulate Server Response: Setting the Cookie
            // Note: In production, this is done via Set-Cookie header in the HTTP response.
            document.cookie = "auth_token=secret_jwt_value_123; path=/; max-age=3600; SameSite=Strict; HttpOnly"; 
            // *Note: Browsers will ignore the HttpOnly flag if set via JS for security reasons, 
            // but this demonstrates where it comes from.*

            statusDiv.textContent = "Login successful! Cookie set (simulated).";
            statusDiv.className = "status success";
            statusDiv.style.display = "block";

        } catch (error) {
            statusDiv.textContent = "Login failed.";
            statusDiv.className = "status error";
            statusDiv.style.display = "block";
        }
    });

    // 2. Handle Fetching Protected Data
    document.getElementById('fetchDataBtn').addEventListener('click', async () => {
        const output = document.getElementById('dataOutput');
        output.textContent = "Loading...";

        try {
            // CRITICAL: credentials: 'include'
            // This tells the browser to send cookies (including HttpOnly ones) along with the request.
            // Without this, the server won't receive the authentication token.
            const response = await fetch(`${API_URL}/posts/1`, {
                method: 'GET',
                credentials: 'include' 
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            output.textContent = JSON.stringify(data, null, 2);
            
        } catch (error) {
            console.error('Fetch error:', error);
            output.textContent = "Error fetching data. Check console.";
        }
    });

    // Helper to simulate network delay for login
    function mockLoginRequest(user) {
        return new Promise(resolve => setTimeout(resolve, 500));
    }

</script>

</body>
</html>