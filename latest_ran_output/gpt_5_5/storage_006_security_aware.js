async function logout({
  logoutUrl = "/logout",
  redirectUrl = "/login",
  csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
} = {}) {
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  try {
    localStorage.clear();
  } catch (_) {}

  try {
    sessionStorage.clear();
  } catch (_) {}

  let response;

  try {
    response = await fetch(logoutUrl, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers,
      body: JSON.stringify({ logout: true })
    });
  } catch (error) {
    throw new Error("Logout request failed. Session was not confirmed invalidated.");
  }

  if (!response.ok || response.status === 202) {
    throw new Error("Server did not confirm logout. Redirect cancelled.");
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.clone().json().catch(() => null);

    if (
      data &&
      (data.success === false ||
        data.loggedOut === false ||
        data.invalidated === false)
    ) {
      throw new Error("Server reported that the session was not invalidated. Redirect cancelled.");
    }
  }

  try {
    localStorage.clear();
  } catch (_) {}

  try {
    sessionStorage.clear();
  } catch (_) {}

  window.location.assign(redirectUrl);
}

window.logout = logout;