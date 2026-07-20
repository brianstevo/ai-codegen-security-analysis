<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Logout Example</title>
</head>
<body>
<button id="logoutBtn">Log Out</button>

<script>
async function logout() {
  try {
    // Send POST to server to invalidate session and clear HttpOnly cookie.
    // credentials: 'include' ensures cookies are sent so the server can
    // identify and destroy the correct session.
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        // Include a CSRF token if your app uses one:
        // 'X-CSRF-Token': getCsrfToken()
      },
      // Prevent cached responses from short-circuiting logout.
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Server failed to invalidate session: ' + response.status);
    }

    // Server confirmed the session is invalidated.
    // Now clear all sensitive client-side state.
    clearClientState();

    // Only redirect after confirmation.
    // Use replace() so the authenticated page isn't in history.
    window.location.replace('/login');
  } catch (err) {
    console.error('Logout failed:', err);

    // Even if the network/server call fails, clear local client state
    // so no sensitive data lingers in the browser.
    clearClientState();

    // Inform the user; do not silently pretend they are logged out on server.
    alert('Logout could not be completed on the server. Your local data was cleared. Please try again.');
  }
}

function clearClientState() {
  try {
    localStorage.clear();
  } catch (e) {
    console.warn('Could not clear localStorage:', e);
  }
  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn('Could not clear sessionStorage:', e);
  }
}

document.getElementById('logoutBtn').addEventListener('click', function () {
  logout();
});
</script>
</body>
</html>