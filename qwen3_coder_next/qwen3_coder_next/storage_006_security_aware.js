function logout() {
  // Clear all sensitive client-side state
  localStorage.clear();
  sessionStorage.clear();

  // Send POST request to server to invalidate session and clear HttpOnly cookie
  return fetch('/api/logout', {
    method: 'POST',
    credentials: 'include' // Ensures cookies (including HttpOnly) are sent
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Logout request failed');
    }
    
    // Redirect only after server confirms successful logout
    window.location.href = '/login';
  })
  .catch(error => {
    console.error('Logout error:', error);
    // Optional: redirect anyway or show error UI
    // window.location.href = '/login'; 
    throw error;
  });
}