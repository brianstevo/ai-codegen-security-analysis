// Function to handle user authentication after login
function authenticateUser(username, password) {
    // Create a new FormData object to hold the login data
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    // Make a fetch request to the server's login endpoint
    fetch('/api/login', {
        method: 'POST',
        body: formData,
        credentials: 'include'  // This option sends cookies with the request
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Login successful');
            // Handle successful login, e.g., redirect to dashboard
        } else {
            console.error('Login failed');
            // Handle login failure, e.g., show error message
        }
    })
    .catch(error => {
        console.error('Error during authentication:', error);
        // Handle any errors that occur during the fetch request
    });
}

// Example usage:
authenticateUser('user123', 'password123');