<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Secure Auth Demo</title>
</head>
<body>
  <button id="login">Login</button>
  <button id="getProfile">Get Profile</button>
  <button id="logout">Logout</button>
  <pre id="output"></pre>

  <script>
    /*
     * WHY NOT localStorage / sessionStorage FOR JWTs:
     *
     * Both localStorage and sessionStorage are accessible to ANY JavaScript
     * running on the page via window.localStorage / window.sessionStorage.
     * If an attacker manages to inject script (XSS) — e.g. through a
     * compromised third-party dependency, a reflected/stored XSS bug, or a
     * malicious browser extension — that script can simply read the token:
     *
     *     const stolen = localStorage.getItem('jwt'); // exfiltrate it
     *
     * The token can then be sent to the attacker's server and used to
     * impersonate the user. There is no browser-level protection.
     *
     * THE FIX: Store the JWT in an HttpOnly cookie set BY THE SERVER.
     *
     * - HttpOnly  -> the cookie is NOT exposed to document.cookie / JS,
     *                so XSS cannot read or steal it.
     * - Secure    -> cookie only sent over HTTPS.
     * - SameSite  -> mitigates CSRF (use 'Strict' or 'Lax', plus a CSRF
     *                token for state-changing requests if 'None' is needed).
     *
     * The browser automatically attaches the cookie to same-origin (or
     * properly CORS-configured cross-origin) requests when we set
     * `credentials: 'include'` on fetch. Our JS never touches the token.
     */

    const output = document.getElementById('output');
    const log = (msg) => { output.textContent += msg + '\n'; };

    /**
     * Performs login. The server validates credentials and responds with a
     * Set-Cookie header like:
     *   Set-Cookie: jwt=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
     * Our JavaScript never sees or stores the token itself.
     */
    async function login(username, password) {
      try {
        const res = await fetch('https://api.example.com/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // credentials: 'include' tells the browser to accept and store
          // cookies from the response (and send them on later requests).
          credentials: 'include',
          body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
          throw new Error(`Login failed: ${res.status}`);
        }

        // No token handling here — the HttpOnly cookie is managed by the browser.
        log('Login successful. Auth cookie set by server (HttpOnly).');
        return true;
      } catch (err) {
        log('Login error: ' + err.message);
        return false;
      }
    }

    /**
     * Makes an authenticated request. We do NOT manually add an
     * Authorization header — the HttpOnly cookie is sent automatically
     * because of credentials: 'include'.
     */
    async function getProfile() {
      try {
        const res = await fetch('https://api.example.com/profile', {
          method: 'GET',
          credentials: 'include' // sends the HttpOnly auth cookie
        });

        if (res.status === 401) {
          log('Not authenticated. Please log in.');
          return null;
        }
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const data = await res.json();
        log('Profile: ' + JSON.stringify(data, null, 2));
        return data;
      } catch (err) {
        log('Profile error: ' + err.message);
        return null;
      }
    }

    /**
     * Logout. The server clears the cookie via a Set-Cookie that expires it.
     * The client cannot delete an HttpOnly cookie directly — only the server can.
     */
    async function logout() {
      try {
        await fetch('https://api.example.com/logout', {
          method: 'POST',
          credentials: 'include'
        });
        log('Logged out. Server cleared the auth cookie.');
      } catch (err) {
        log('Logout error: ' + err.message);
      }
    }

    document.getElementById('login').addEventListener('click', () => {
      login('demo-user', 'demo-pass');
    });
    document.getElementById('getProfile').addEventListener('click', getProfile);
    document.getElementById('logout').addEventListener('click', logout);
  </script>
</body>
</html>