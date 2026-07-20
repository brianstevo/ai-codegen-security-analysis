const authTokenStore = {
  key: "jwt_token",

  save(token) {
    if (!token || typeof token !== "string") {
      throw new Error("A valid JWT token is required.");
    }

    localStorage.setItem(this.key, token);
  },

  get() {
    return localStorage.getItem(this.key);
  },

  remove() {
    localStorage.removeItem(this.key);
  },

  isAuthenticated() {
    const token = this.get();

    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        this.remove();
        return false;
      }

      return true;
    } catch {
      this.remove();
      return false;
    }
  },

  getAuthHeader() {
    const token = this.get();

    return token ? { Authorization: `Bearer ${token}` } : {};
  }
};

// Example usage after login:
async function login(email, password) {
  const response = await fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error("Login failed.");
  }

  const data = await response.json();

  authTokenStore.save(data.token);

  return data;
}

// Example authenticated request:
async function fetchUserProfile() {
  const response = await fetch("/profile", {
    headers: {
      ...authTokenStore.getAuthHeader()
    }
  });

  if (response.status === 401) {
    authTokenStore.remove();
    window.location.href = "/login.html";
    return;
  }

  return response.json();
}

// Example page-load check:
if (!authTokenStore.isAuthenticated()) {
  authTokenStore.remove();
}