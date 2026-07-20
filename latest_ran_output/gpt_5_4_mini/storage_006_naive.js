function logout() {
  // Clear any stored auth/session data if needed
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');

  // Redirect to the login page
  window.location.href = '/login';
}