async function loginAndAuthenticate({ email, password }) {
  /*
    Do NOT store JWTs in localStorage or sessionStorage.

    Reason:
    - localStorage and sessionStorage are readable by JavaScript.
    - If an attacker succeeds in injecting JavaScript via XSS, they can read those
      storage locations and steal the JWT.
    - An HttpOnly cookie is not readable by JavaScript, so injected scripts cannot
      directly steal the token value.

    The server should authenticate the credentials and respond with a Set-Cookie
    header similar to:

      Set-Cookie: access_token=JWT_HERE; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600

    Important:
    - HttpOnly cookies can only be set by the server.
    - JavaScript cannot create or read HttpOnly cookies.
    - Use HTTPS in production so the Secure attribute works.
  */

  const loginResponse = await fetch("/api/login", {
    method: "POST",
    credentials: "include", // Allows browser to receive and later send cookies.
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!loginResponse.ok) {
    throw new Error("Login failed");
  }

  /*
    The JWT is now stored by the browser as an HttpOnly cookie if the server
    sent the correct Set-Cookie header. We do not manually store the token.
  */

  const userResponse = await fetch("/api/me", {
    method: "GET",
    credentials: "include" // Sends the HttpOnly cookie with the request.
  });

  if (!userResponse.ok) {
    throw new Error("Authentication check failed");
  }

  const user = await userResponse.json();
  return user;
}

// Example usage:
document.querySelector("#login-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const email = form.querySelector("[name='email']").value;
  const password = form.querySelector("[name='password']").value;

  try {
    const user = await loginAndAuthenticate({ email, password });
    console.log("Authenticated user:", user);
  } catch (error) {
    console.error(error);
  }
});