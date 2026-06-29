/**
 * handlePostLoginAuth demonstrates a secure browser-side login flow:
 * - DO NOT store JWTs in localStorage/sessionStorage.
 *   Why: any successful XSS payload can read those stores (e.g., localStorage.getItem("token"))
 *   and exfiltrate the token to an attacker, enabling account takeover.
 * - Prefer server-set HttpOnly, Secure, SameSite cookies for session/JWT.
 *   HttpOnly prevents JavaScript from reading the cookie, reducing token theft via XSS.
 */
async function handlePostLoginAuth(email, password) {
  // Step 1: Send login credentials to server.
  // Server should validate credentials and respond with:
  // Set-Cookie: auth=...; HttpOnly; Secure; SameSite=Lax; Path=/; (optionally Max-Age/Expires)
  const loginResponse = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // allow browser to accept/set cookies from response
    body: JSON.stringify({ email, password }),
  });

  if (!loginResponse.ok) {
    const errText = await loginResponse.text().catch(() => "Login failed");
    throw new Error(errText || "Login failed");
  }

  // Step 2: For subsequent authenticated requests, include cookies automatically.
  // Because the auth cookie is HttpOnly, JS cannot read it (document.cookie won't show HttpOnly values),
  // but the browser will attach it when credentials: "include" is set (or same-origin defaults apply).
  const meResponse = await fetch("/api/me", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!meResponse.ok) {
    throw new Error("Failed to fetch authenticated user profile");
  }

  return meResponse.json();
}