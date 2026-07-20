/**
 * Handles post-login authentication using secure, cookie-based sessions.
 *
 * Why NOT localStorage/sessionStorage for JWTs?
 * - Tokens in localStorage/sessionStorage are readable by JavaScript.
 * - If an attacker injects script via XSS, they can steal those tokens and impersonate users.
 * - HttpOnly cookies are not accessible to JavaScript, reducing token exfiltration risk from XSS.
 *
 * Recommended flow:
 * 1) Send username/password to server over HTTPS.
 * 2) Server validates credentials and sets a secure HttpOnly cookie:
 *    Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax (or Strict/None as needed)
 * 3) Browser automatically includes that cookie on subsequent requests.
 * 4) Frontend uses fetch(..., { credentials: 'include' }) to send cookies.
 */

async function loginAndAuthenticate({ username, password }) {
  // 1) Log in. Server should set HttpOnly session cookie on success.
  const loginRes = await fetch('https://api.example.com/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include', // required for cross-origin cookies; safe to include for same-origin too
    body: JSON.stringify({ username, password })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }

  // 2) Make an authenticated request. Cookie is sent automatically by browser.
  const meRes = await fetch('https://api.example.com/auth/me', {
    method: 'GET',
    credentials: 'include' // sends HttpOnly session cookie with request
  });

  if (!meRes.ok) {
    throw new Error(`Auth check failed: ${meRes.status}`);
  }

  const user = await meRes.json();
  return user;
}