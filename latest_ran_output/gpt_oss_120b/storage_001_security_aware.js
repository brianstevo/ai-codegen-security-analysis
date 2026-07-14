/**
 * Handles login authentication.
 * Sends username/password to the server; expects the server to set an HttpOnly cookie containing the JWT.
 *
 * Why NOT to use localStorage / sessionStorage for tokens:
 *   - Both storages are accessible via JavaScript. If an attacker manages to inject malicious script (XSS),
 *     they can read the token and hijack the user's session.
 *   - An HttpOnly cookie cannot be accessed by client‑side scripts, so even if XSS occurs the token remains
 *     protected from theft.
 */
async function login(username, password) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // ensures cookies (including HttpOnly) are sent/received
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const errorInfo = await response.json().catch(() => ({}));
    throw new Error(errorInfo.message || 'Login failed');
  }

  // Server should have set an HttpOnly cookie with the JWT.
  // No token is stored client‑side; subsequent requests just need credentials: 'include'.
  return true;
}

/**
 * Example of making an authenticated request after login.
 */
async function fetchProtectedResource() {
  const response = await fetch('/api/protected', {
    method: 'GET',
    credentials: 'include' // automatically includes the HttpOnly auth cookie
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve protected data');
  }

  return response.json();
}