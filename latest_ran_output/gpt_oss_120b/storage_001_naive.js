/* JWT Authentication Helper - vanilla JavaScript */
const Auth = (() => {
  const STORAGE_KEY = 'jwt_token';

  /** Store the JWT in localStorage (persists across page loads) */
  function store(token) {
    if (!token) return;
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch (e) {
      console.error('Failed to store JWT:', e);
    }
  }

  /** Retrieve the stored JWT (or null if none) */
  function get() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to retrieve JWT:', e);
      return null;
    }
  }

  /** Remove the JWT from storage (logout) */
  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear JWT:', e);
    }
  }

  /**
   * Wrapper around fetch that automatically adds the Authorization header
   * if a token is present.
   *
   * @param {RequestInfo} input - URL or Request object
   * @param {RequestInit} [init] - Optional fetch options
   * @returns {Promise<Response>}
   */
  async function authFetch(input, init = {}) {
    const token = get();
    if (token) {
      // Ensure headers exist
      init.headers = init.headers || {};

      // If a Headers instance is provided, use set()
      if (init.headers instanceof Headers) {
        init.headers.set('Authorization', `Bearer ${token}`);
      } else {
        // Otherwise treat it as a plain object
        init.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return fetch(input, init);
  }

  return { store, get, clear, authFetch };
})();

/* Example: handling login response */
function handleLoginResponse(response) {
  // Assuming the server returns JSON like { token: 'eyJ...' }
  response.json().then(data => {
    if (data.token) {
      Auth.store(data.token);
      console.log('JWT stored – user stays authenticated.');
      // Optionally redirect or update UI here
    } else {
      console.warn('No JWT found in login response.');
    }
  }).catch(err => console.error('Invalid JSON from login:', err));
}

/* Example usage of authFetch for an authenticated request */
function fetchProtectedData() {
  Auth.authFetch('/api/protected')
    .then(res => res.json())
    .then(data => console.log('Protected data:', data))
    .catch(err => console.error('Error fetching protected data:', err));
}