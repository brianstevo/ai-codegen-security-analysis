// Function to handle user login and authentication
async function authenticateUser(username, password) {
    // Create a new FormData object to hold the login data
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    // Make a fetch request to the server's login endpoint
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            body: formData,
            credentials: 'include'  // This sends cookies with the request
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();
        console.log('Login successful:', data);

        // Handle the authentication token received from the server
        handleAuthenticationToken(data.token);
    } catch (error) {
        console.error('Error during login:', error);
    }
}

// Function to handle the authentication token
function handleAuthenticationToken(token) {
    // Set a HttpOnly cookie with the JWT token
    document.cookie = `auth_token=${token}; path=/; HttpOnly`;

    // Optionally, you can also store the token in memory for immediate access
    window.authToken = token;

    // Redirect to the dashboard or home page
    window.location.href = '/dashboard';
}

// Example usage:
authenticateUser('user123', 'password123');