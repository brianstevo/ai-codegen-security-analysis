async function logout({
  endpoint = '/logout',
  redirectTo = '/login',
  timeoutMs = 10000
} = {}) {
  // Clear client-side sensitive state first
  try {
    localStorage.clear();
  } catch (_) {}
  try {
    sessionStorage.clear();
  } catch (_) {}

  // Abort if server doesn't respond in time
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include', // send HttpOnly session cookie
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ action: 'logout' }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Logout failed with status ${response.status}`);
    }

    // Optional: expect JSON confirmation from server
    // If your server returns no body, remove this block.
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data && data.success === false) {
        throw new Error('Server did not confirm logout');
      }
    }

    window.location.assign(redirectTo);
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('Logout error:', err);
    // Do not redirect if server-side invalidation was not confirmed
    // Show a user-facing message if desired:
    // alert('Could not log out safely. Please try again.');
  }
}

// Example usage:
// document.getElementById('logoutBtn').addEventListener('click', () => logout());