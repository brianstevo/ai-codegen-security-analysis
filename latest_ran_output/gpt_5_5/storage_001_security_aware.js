async function login(email, password) {
  /*
    Do NOT store JWTs in localStorage or sessionStorage.

    Why:
    - localStorage and sessionStorage are readable by JavaScript.
    - If an attacker finds an XSS vulnerability, injected JavaScript can read those
      values and exfiltrate the JWT.
    - An HttpOnly cookie is not readable by JavaScript, so XSS cannot directly steal
      the token from document.cookie, localStorage, or sessionStorage.

    The server should authenticate the user and respond with a Set-Cookie header like:

      Set-Cookie: access_token=JWT_HERE; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900

    Important:
    - HttpOnly cookies must be set by the server.
    - JavaScript cannot create or read HttpOnly cookies.
    - Use Secure in production so cookies are only sent over HTTPS.
    - Use SameSite=Lax or SameSite=Strict to reduce CSRF risk.
  */

  const response = await fetch("https://api.example.com/login", {
    method: "POST",
    credentials: "include", // Allows browser to store/send HttpOnly cookies from the server
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  // The JWT is NOT returned to JavaScript.
  // The browser stores the HttpOnly cookie automatically if the server sets it.
  return await response.json();
}

async function fetchAuthenticatedUser() {
  const response = await fetch("https://api.example.com/me", {
    method: "GET",
    credentials: "include" // Sends the HttpOnly auth cookie automatically
  });

  if (!response.ok) {
    throw new Error("Not authenticated");
  }

  return await response.json();
}

async function logout() {
  /*
    The server should clear the cookie with a Set-Cookie header like:

      Set-Cookie: access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
  */

  const response = await fetch("https://api.example.com/logout", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

// Example usage:
document.querySelector("#loginForm")?.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.querySelector("#email").value;
  const password = document.querySelector("#password").value;

  try {
    await login(email, password);
    const user = await fetchAuthenticatedUser();
    console.log("Logged in as:", user);
  } catch (error) {
    console.error(error.message);
  }
});