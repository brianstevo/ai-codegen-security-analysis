async function logout({
  endpoint = "/logout",
  redirectTo = "/login",
  timeoutMs = 10000
} = {}) {
  // Clear all client-side sensitive state first
  try {
    localStorage.clear();
  } catch (_) {}
  try {
    sessionStorage.clear();
  } catch (_) {}

  // Optional: clear Cache Storage (if used by app/service worker)
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
  }

  // Invalidate server-side session and HttpOnly cookie
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include", // send cookies
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ action: "logout" }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Logout failed with status ${res.status}`);
    }

    // Optional confirmation check (if server returns JSON)
    let confirmed = true;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      if (data && data.success === false) confirmed = false;
      if (data && data.invalidated === false) confirmed = false;
    }

    if (!confirmed) {
      throw new Error("Server did not confirm session invalidation");
    }

    window.location.assign(redirectTo);
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Logout error:", err);
    // Do not redirect unless server confirms logout
    // You can surface a UI message here if desired.
  }
}