async function logout() {
  const logoutEndpoint = "/logout";

  try {
    const response = await fetch(logoutEndpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`Logout failed with status ${response.status}`);
    }

    // Clear client-side sensitive state only after server confirms logout.
    try {
      localStorage.clear();
    } catch (e) {}

    try {
      sessionStorage.clear();
    } catch (e) {}

    // Redirect after successful server-side invalidation.
    window.location.href = "/login";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Unable to log out right now. Please try again.");
  }
}