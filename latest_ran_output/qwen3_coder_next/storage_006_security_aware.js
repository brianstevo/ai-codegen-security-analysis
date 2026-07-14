function handleLogout(redirectUrl = '/login') {
  // Clear client-side storage
  localStorage.clear();
  sessionStorage.clear();

  // Send POST request to server to invalidate session and clear cookies
  fetch('/api/logout', {
    method: 'POST',
    credentials: 'include' // Important for sending/receiving cookies (including HttpOnly)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server logout failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(() => {
      // Redirect only after successful server-side invalidation
      window.location.href = redirectUrl;
    })
    .catch(error => {
      console.error('Logout error:', error);
      // Even if server call fails, we still want to clear client state and redirect
      // to prevent unauthorized access if the user is already logged out on server
      window.location.href = redirectUrl;
    });
}