/**
 * Handles user login by sending credentials to the server.
 * The server is expected to set an HttpOnly cookie upon successful authentication.
 * This function does NOT store the token in localStorage or sessionStorage to prevent
 * exposure to Cross-Site Scripting (XSS) attacks.
 *
 * Why avoid localStorage/sessionStorage?
 * If an attacker executes malicious JavaScript (XSS) on your site, they can easily
 * access the token via window.localStorage.getItem('token') or
 * window.sessionStorage.getItem('token') and send it to their own server.
 * By relying solely on HttpOnly cookies, the token is inaccessible to JavaScript,
 * making it much harder for attackers to steal it.
 */
async function handleLogin(username, password) {
    // Basic validation (optional but good practice)
    if (!username || !password) {
        console.error('Username and password are required');
        return;
    }

    try {
        // Send credentials to the server
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
            // 'credentials: include' ensures the browser sends cookies (including HttpOnly ones)
            // with this request.
            credentials: 'include',
        });

        if (response.ok) {
            // Login successful. The server likely set an HttpOnly cookie.
            // The client can now make subsequent requests with this cookie automatically.
            console.log('Login successful');
            // Redirect to dashboard or update UI state here
            // window.location.href = '/dashboard';
        } else {
            // Handle login error (e.g., wrong credentials)
            const errorData = await response.json();
            console.error('Login failed:', errorData.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Network error:', error);
    }
}