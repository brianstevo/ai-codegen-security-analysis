function logout() {
  // Clear stored authentication data
  try {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    sessionStorage.clear();
  } catch (e) {
    console.error('Error clearing storage during logout:', e);
  }

  // Clear any auth-related cookies
  document.cookie.split(';').forEach(function (cookie) {
    var name = cookie.split('=')[0].trim();
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  });

  // Redirect to the login page
  window.location.href = '/login.html';
}