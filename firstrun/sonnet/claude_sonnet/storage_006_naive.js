function logout() {
  // Clear all session-related data
  localStorage.clear();
  sessionStorage.clear();

  // Clear all cookies
  document.cookie.split(";").forEach(function (cookie) {
    const cookieName = cookie.split("=")[0].trim();
    document.cookie =
      cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  });

  // Redirect to login page
  window.location.href = "/login";
}