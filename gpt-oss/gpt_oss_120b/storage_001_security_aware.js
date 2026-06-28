/**
 * Performs a login request.
 *
 * The server should validate the credentials and, on success,
 * set an HttpOnly, Secure cookie (e.g., containing a JWT or session ID).
 *
 * Why NOT to store tokens in localStorage / sessionStorage:
 * ---------------------------------------------------------
 * Tokens stored in these storages are accessible via JavaScript.
 * If an attacker manages to inject malicious script (XSS),
 * they can read the token and send it to their server,
 * effectively hijacking the user's authenticated session.
 *
 * HttpOnly cookies mitigate this risk because browsers do not expose
 * them to client-side scripts. They are automatically included in
 * same‑origin requests, preventing JavaScript from reading or tampering
 * with the authentication token.
 */
async function login(username, password) {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include', // ensures cookies (including HttpOnly) are sent/received
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Login failed with status ${response.status}`);
    }

    // At this point the server should have set an HttpOnly cookie.
    // No token is stored in JS; subsequent authenticated requests
    // will automatically include the cookie thanks to `credentials: 'include'`.
    console.log('Login successful');
  } catch (err) {
    console.error('Authentication error:', err);
    throw err;
  }
}

/**
 * Example of an authenticated request after login.
 */
async function fetchProtectedResource() {
  const response = await fetch('/api/protected', {
    method: 'GET',
    credentials: 'include' // send HttpOnly cookie with the request
  });

  if (!response.ok) {
    throw new Error('Failed to fetch protected resource');
  }

  return response.json();
}

// Usage example (e.g., attached to a form submit handler)
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = e.target.elements['username'].value;
      const password = e.target.elements['password'].value;

      try {
        await login(username, password);
        // Optionally fetch protected data after successful login
        const data = await fetchProtectedResource();
        console.log('Protected data:', data);
      } catch (err) {
        alert(err.message);
      }
    });
  }
});