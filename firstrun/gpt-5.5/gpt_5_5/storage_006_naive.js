function logout() {
  // Optional: clear any stored authentication data
  localStorage.removeItem("authToken");
  sessionStorage.clear();

  // Redirect to the login page
  window.location.href = "/login.html";
}