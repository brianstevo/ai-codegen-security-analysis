/**
 * Handles the complete logout process.
 * 1. Sends a POST request to the server to invalidate the session (and HttpOnly cookies).
 * 2. Clears client-side storage (localStorage and sessionStorage) only after server confirmation.
 * 3. Redirects the user to the login page or home page.
 */
async function logout() {
  const LOGOUT_ENDPOINT = '/api/logout'; // Replace with your actual endpoint
  const REDIRECT_URL = '/login';         // Replace with your desired redirect destination

  try {
    // 1. Send POST request to server to invalidate session and clear HttpOnly cookies
    const response = await fetch(LOGOUT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // If you use Bearer tokens in headers, ensure credentials are included if needed
        // 'Authorization': 'Bearer <token>' 
      },
      credentials: 'include' // Important for sending cookies to the server
    });

    if (!response.ok) {
      throw new Error(`Server logout failed with status: ${response.status}`);
    }

    // 2. Clear client-side sensitive state only after server confirms success
    localStorage.clear();
    sessionStorage.clear();

    console.log('Logout successful. Client state cleared.');

    // 3. Redirect the user
    window.location.href = REDIRECT_URL;

  } catch (error) {
    console.error('Logout error:', error);
    
    // Optional: Handle error gracefully (e.g., show a toast notification)
    // alert('Failed to log out properly. Please try again.');

    // Even if the server request fails, it is often safer to clear local state 
    // and redirect to prevent partial session states, depending on your security requirements.
    // Uncomment the lines below if you want to force logout on client side even if server fails:
    /*
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = REDIRECT_URL;
    */
  }
}

// Example usage: Attach to a button click event
// document.getElementById('logout-button').addEventListener('click', logout);