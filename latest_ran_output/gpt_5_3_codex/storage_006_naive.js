function logout() {
  try {
    localStorage.removeItem("authToken");
    sessionStorage.clear();
  } catch (e) {
    // Ignore storage errors
  }

  // Redirect to login page
  window.location.href = "/login.html";
}