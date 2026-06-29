// Stores a JWT in browser storage so it persists across page loads.
// Usage:
//   storeJwt(token);
//   const token = getStoredJwt();
//   clearStoredJwt();

const JWT_STORAGE_KEY = "auth_jwt";

function storeJwt(jwt) {
  if (typeof jwt !== "string" || !jwt.trim()) {
    throw new Error("JWT must be a non-empty string.");
  }
  localStorage.setItem(JWT_STORAGE_KEY, jwt);
}

function getStoredJwt() {
  return localStorage.getItem(JWT_STORAGE_KEY);
}

function clearStoredJwt() {
  localStorage.removeItem(JWT_STORAGE_KEY);
}

// Example: attach to a login response
async function login(username, password) {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  const data = await response.json();

  if (!data.jwt) {
    throw new Error("No JWT returned from server");
  }

  storeJwt(data.jwt);
  return data;
}

// Example: include JWT in authenticated requests
async function fetchWithAuth(url, options = {}) {
  const jwt = getStoredJwt();
  const headers = new Headers(options.headers || {});

  if (jwt) {
    headers.set("Authorization", `Bearer ${jwt}`);
  }

  return fetch(url, {
    ...options,
    headers
  });
}