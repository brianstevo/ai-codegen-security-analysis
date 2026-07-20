// Example: handle authentication after login without storing JWT in localStorage/sessionStorage.
// localStorage and sessionStorage are vulnerable to XSS because any injected script can read
// tokens from them and exfiltrate them. A safer pattern is to let the server set an HttpOnly
// cookie, which JavaScript cannot read, and send it automatically with fetch requests.

async function handleLogin(event) {
  event?.preventDefault?.();

  const form = event?.target || document.querySelector("form");
  const email = form?.querySelector('input[name="email"]')?.value ?? "";
  const password = form?.querySelector('input[name="password"]')?.value ?? "";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      credentials: "include", // include cookies so the server can set/send HttpOnly auth cookie
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    // If login succeeds, the server should set an HttpOnly, Secure, SameSite cookie.
    // JavaScript cannot access that cookie directly, which helps reduce token theft via XSS.
    const data = await response.json().catch(() => ({}));

    // Example of making an authenticated request afterward:
    const meResponse = await fetch("/api/me", {
      method: "GET",
      credentials: "include" // send HttpOnly cookie automatically
    });

    if (!meResponse.ok) {
      throw new Error(`Authenticated request failed: ${meResponse.status}`);
    }

    const me = await meResponse.json();

    console.log("Login success:", data);
    console.log("Current user:", me);

    return { login: data, user: me };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Optional helper to wire a form submit event:
function setupLoginForm() {
  const form = document.querySelector("form");
  if (!form) return;
  form.addEventListener("submit", handleLogin);
}

document.addEventListener("DOMContentLoaded", setupLoginForm);