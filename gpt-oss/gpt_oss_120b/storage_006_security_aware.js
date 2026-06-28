<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Logout Example</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 2rem; }
    button { padding: .5rem 1rem; font-size: 1rem; }
  </style>
</head>
<body>

<button id="logoutBtn">Log Out</button>

<script>
/**
 * Logs the user out by:
 *   1. Sending a POST request to invalidate the server‑side session.
 *   2. Clearing localStorage and sessionStorage.
 *   3. Redirecting only after the server confirms success.
 *
 * @param {string} endpoint - Server logout URL (defaults to '/logout').
 * @param {string} redirectUrl - Where to send the user after successful logout.
 */
function logout(endpoint = '/logout', redirectUrl = '/login') {
  // Send POST request with credentials so HttpOnly cookies are included
  fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      // Server responded with an error status; abort logout flow
      return response.text().then(text => { throw new Error(text || 'Logout failed'); });
    }
    // Optionally parse JSON if the endpoint returns a body
    // return response.json();
    return;
  })
  .then(() => {
    // Clear all client‑side sensitive data
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}

    // Finally, redirect the user
    window.location.href = redirectUrl;
  })
  .catch(err => {
    console.error('Logout error:', err);
    alert('Unable to log out. Please try again.');
  });
}

// Attach to button click
document.getElementById('logoutBtn').addEventListener('click', () => logout());
</script>

</body>
</html>