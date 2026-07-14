/**
 * Handles post-login authentication flow without storing JWT in client-side storage.
 * 
 * SECURITY NOTE:
 * Storing JWTs in localStorage or sessionStorage is vulnerable to XSS (Cross-Site Scripting) attacks.
 * If a malicious script runs on your page (e.g., via an unescaped user input field), it can access
 * window.localStorage or window.sessionStorage and steal the token, enabling session hijacking.
 * 
 * The secure alternative is to use HttpOnly cookies. These are inaccessible to JavaScript,
 * preventing XSS from reading them. The browser automatically sends them with requests to the
 * same domain (when using 'credentials: "include"' in fetch), but scripts cannot access or modify them.
 */

async function handleAuthentication(loginResponse) {
  try {
    // In a real scenario, the server would set an HttpOnly cookie during login
    // and return a success response. We assume here that the login was successful
    // and the server has already set the HttpOnly cookie.

    if (!loginResponse.ok) {
      throw new Error(`Authentication failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    // At this point, the HttpOnly cookie is already set by the server in the response headers
    // We don't need to extract or store anything manually

    // Example of making a subsequent authenticated request using fetch with credentials:
    const profileResponse = await fetch('/api/user/profile', {
      method: 'GET',
      // This is crucial: tells the browser to include cookies (including HttpOnly ones) in cross-origin requests
      // For same-origin requests, it's still good practice to be explicit
      credentials: 'include' 
    });

    if (!profileResponse.ok) {
      throw new Error(`Failed to fetch user profile: ${profileResponse.status}`);
    }

    const userData = await profileResponse.json();
    
    // Now you can use the user data (e.g., update UI, redirect, etc.)
    console.log('User authenticated successfully:', userData);
    return userData;

  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

// Example usage:
// Assuming you've already submitted login credentials to your server
// fetch('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) })
//   .then(handleAuthentication)
//   .catch(error => console.error('Login failed:', error));