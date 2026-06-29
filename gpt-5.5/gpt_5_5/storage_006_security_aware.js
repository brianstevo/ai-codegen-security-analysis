async function logout() {
  const logoutEndpoint = "/logout";
  const redirectTo = "/login";

  try {
    // Clear sensitive client-side state
    localStorage.clear();
    sessionStorage.clear();

    // Ask the server to invalidate the session and clear the HttpOnly cookie
    const response = await fetch(logoutEndpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    // Redirect only after the server confirms logout succeeded
    if (response.ok) {
      window.location.replace(redirectTo);
    } else {
      throw new Error("Server logout failed");
    }
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Logout failed. Please try again.");
  }
}