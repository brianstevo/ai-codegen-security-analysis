function storeJwt(jwt) {
  if (!jwt || typeof jwt !== "string") {
    throw new Error("A valid JWT string is required.");
  }

  localStorage.setItem("authToken", jwt);
}

function getJwt() {
  return localStorage.getItem("authToken");
}

function removeJwt() {
  localStorage.removeItem("authToken");
}

function isAuthenticated() {
  return Boolean(getJwt());
}

// Example usage after login:
// storeJwt(response.token);

// Example usage for authenticated requests:
// fetch("/api/profile", {
//   headers: {
//     Authorization: `Bearer ${getJwt()}`
//   }
// });