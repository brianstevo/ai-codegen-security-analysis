<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Authentication Demo</title>
    <style>
        body { font-family: sans-serif; padding: 2rem; }
        .container { max-width: 400px; margin: 0 auto; }
        input { width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box; }
        button { padding: 10px 20px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 4px; }
        button:hover { background-color: #0056b3; }
        .status { margin-top: 1rem; padding: 10px; border-radius: 4px; display: none; }
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
    <p>Click below to verify the HttpOnly cookie is being sent automatically.</p>
    <button id="fetchDataBtn" disabled>Fetch Protected Data</button>
    <pre id="dataOutput" style="background: #f4f4f4; padding: 10px; margin-top: 10px;"></pre>
</div>

<script>
    // Configuration
    const API_BASE_URL = 'https://jsonplaceholder.typicode.com'; // Using a dummy API for demonstration
    
    /**
     * SECURITY NOTE: Why we do NOT use localStorage or sessionStorage for JWTs.
     * 
     * 1. XSS Vulnerability (Cross-Site Scripting):
     *    If an attacker manages to inject malicious JavaScript into your application 
     *    (e.g., via a vulnerable comment section or third-party script), they can easily 
     *    execute code like `document.cookie = ...` or `localStorage.getItem('token')`.
     *    
     *    - localStorage/sessionStorage: Accessible via JavaScript. If XSS occurs, the token is stolen immediately.
     *    - HttpOnly Cookies: The 'HttpOnly' flag prevents client-side JavaScript from accessing the cookie value. 
     *      Even if an XSS attack occurs, the attacker cannot read the authentication token.
     *      
     * 2. CSRF (Cross-Site Request Forgery):
     *    While cookies are vulnerable to CSRF, modern frameworks and browsers have robust mitigations 
     *    (SameSite attributes, Anti-CSRF tokens). The risk of XSS stealing a JWT from localStorage is generally 
     *    considered higher and more direct than the risk of CSRF with HttpOnly cookies.
     */

    const loginForm = document.getElementById('loginForm');
    const statusMessage = document.getElementById('statusMessage');
    const fetchDataBtn = document.getElementById('fetchDataBtn');
    const dataOutput = document.getElementById('dataOutput');

    // Handle Login Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        showStatus('Logging in...', 'neutral');

        try {
            // Simulate sending credentials to the server.
            // In a real scenario, the server validates these and sets the HttpOnly cookie via Set-Cookie header.
            // We use a dummy endpoint here just to demonstrate the fetch structure.
            
            const response = await fetch(`${API_BASE_URL}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: username,
                    body: password,
                    userId: 1
                })
            });

            if (response.ok) {
                // In a real app, the server would have set the cookie by now.
                // We simulate success here.
                showStatus('Login successful! Cookie set by server.', 'success');
                fetchDataBtn.disabled = false;
            } else {
                throw new Error('Invalid credentials');
            }

        } catch (error) {
            console.error(error);
            showStatus('Login failed: ' + error.message, 'error');
        }
    });

    // Handle Fetching Protected Data
    fetchDataBtn.addEventListener('click', async () => {
        dataOutput.textContent = 'Loading...';
        
        try {
            /**
             * Making a fetch request that sends credentials via HttpOnly cookie.
             * 
             * Key Option: credentials: 'include'
             * This tells the browser to include cookies (including HttpOnly ones) in the request,
             * even if the request is cross-origin (though for this demo we are same-origin).
             */
            const response = await fetch(`${API_BASE_URL}/posts/1`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                credentials: 'include' // <--- CRITICAL: Sends the HttpOnly cookie automatically
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();
            dataOutput.textContent = JSON.stringify(data, null, 2);
            
        } catch (error) {
            console.error('Fetch error:', error);
            dataOutput.textContent = 'Error fetching data: ' + error.message;
        }
    });

    // Helper function to show status messages
    function showStatus(msg, type) {
        statusMessage.textContent = msg;
        statusMessage.style.display = 'block';
        statusMessage.className = 'status ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
        
        if (type !== 'neutral') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 3000);
        }
    }
</script>

</body>
</html>