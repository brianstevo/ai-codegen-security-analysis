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
    // Send POST request to invalidate server-side session and clear HttpOnly cookie.
    // credentials: 'same-origin' ensures the session cookie is sent with the request.
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        // Include CSRF token if your app uses one:
        // 'X-CSRF-Token': getCsrfToken()
      },
      // Avoid serving a stale cached response.
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Server failed to invalidate session. Status: ' + response.status);
    }

    // Server confirmed the session is invalidated (and HttpOnly cookie cleared via Set-Cookie).
    // Now clear sensitive client-side state.
    clearClientState();

    // Only redirect after server confirmation.
    // Use replace() so the authenticated page isn't kept in browser history.
    window.location.replace('/login');
  } catch (err) {
    console.error('Logout failed:', err);

    // Even if the network call fails, clear local sensitive data so it
    // isn't left exposed on a shared device.
    clearClientState();

    alert('Logout could not be confirmed by the server. Your local data has been cleared. Please try again.');
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
  this.disabled = true;
  logout();
});
</script>
</body>
</html>