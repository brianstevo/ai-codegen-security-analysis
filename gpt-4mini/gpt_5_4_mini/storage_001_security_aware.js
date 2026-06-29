// Example: handle post-login authentication in the browser without storing JWTs in localStorage/sessionStorage.
//
// Why not localStorage/sessionStorage?
// - Any JavaScript running on the page can read them.
// - If an XSS vulnerability exists, an attacker can steal the token and impersonate the user.
// - HttpOnly cookies are not readable by JavaScript, which helps protect tokens from XSS theft.
//
// Server-side requirement:
// - The server must set the auth cookie with: HttpOnly; Secure; SameSite=Lax (or Strict where appropriate)
// - Because HttpOnly cookies are inaccessible to JS, the browser will attach them automatically on requests.
//
// Example usage:
//   authenticateAfterLogin('/api/login', { email, password })
//     .then(user => console.log('Logged in as', user))
//     .catch(err => console.error(err));

async function authenticateAfterLogin(loginUrl, credentials) {
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // If the server sets an HttpOnly cookie on successful login,
    // the browser will store it and send it automatically on later requests.
    // include is important when the API is on a different origin and you want cookies sent.
    credentials: 'include',
    body: JSON.stringify(credentials)
  });

  if (!response.ok) {
    let message = 'Login failed';
    try {
      const data = await response.json();
      if (data && data.message) message = data.message;
    } catch (_) {}
    throw new Error(message);
  }

  // Example: server can return non-sensitive user info here.
  // The actual auth token should live in an HttpOnly cookie set by the server.
  const data = await response.json();
  return data;
}

// Example of an authenticated request after login.
// The browser sends the HttpOnly cookie automatically; JS never reads the JWT.
async function fetchCurrentUser(apiUrl) {
  const response = await fetch(apiUrl, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to load current user');
  }

  return response.json();
}

// Optional helper to log out by clearing the server-set cookie.
async function logout(logoutUrl) {
  const response = await fetch(logoutUrl, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }

  return true;
}