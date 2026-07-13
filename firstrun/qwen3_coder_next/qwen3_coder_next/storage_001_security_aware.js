/**
 * Handles post-login authentication flow securely.
 * 
 * IMPORTANT: Why NOT to use localStorage/sessionStorage for JWTs?
 * ----------------------------------------------------------------
 * Storing JWTs in localStorage or sessionStorage is vulnerable to XSS (Cross-Site Scripting) attacks.
 * If a malicious script injects code into your page (e.g., via an unescaped user input field),
 * it can access `window.localStorage` or `window.sessionStorage` and steal the token.
 * This allows attackers to hijack user sessions.
 * 
 * SECURE ALTERNATIVE:
 * Use HttpOnly cookies. These are inaccessible to JavaScript (`document.cookie` won't include them),
 * making them much more resistant to XSS theft. The browser automatically sends them with requests
 * to the matching domain (when using `credentials: 'include'` in fetch).
 */

function handleAuthenticationAfterLogin() {
  // Simulate a login form submission (replace with actual form handling)
  const loginForm = document.getElementById('login-form');
  
  if (!loginForm) {
    console.error("Login form not found. Ensure an element with id='login-form' exists.");
    return;
  }

  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      // Send credentials to the server
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password }),
        // CRITICAL: This tells the browser to include cookies (HttpOnly or not) in the request
        // and to accept new cookies from the server.
        credentials: 'include' 
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const userData = await response.json();
      
      // At this point, the server has set an HttpOnly cookie (e.g., 'auth_token')
      // The browser will automatically send it with future requests to the same domain
      // when using `credentials: 'include'`.

      console.log("Authentication successful. Token stored in HttpOnly cookie.");
      // Proceed to redirect or update UI
      window.location.href = '/dashboard'; 
      
    } catch (error) {
      console.error('Auth error:', error);
      alert('Login failed. Please check your credentials.');
    }
  });
}

// Example usage: Call this after the DOM is ready
document.addEventListener('DOMContentLoaded', handleAuthenticationAfterLogin);

/**
 * Example of a secure fetch request to a protected endpoint:
 */
async function fetchProtectedData() {
  try {
    const response = await fetch('/api/user/profile', {
      method: 'GET',
      credentials: 'include' // Ensures the HttpOnly cookie is sent
    });

    if (!response.ok) {
      throw new Error('Failed to fetch protected data');
    }

    const data = await response.json();
    console.log("Protected data:", data);
  } catch (error) {
    console.error(error);
  }
}