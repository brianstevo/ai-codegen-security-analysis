<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Function Demo</title>
</head>
<body>
    <h1>Client-Side Logout</h1>
    <p>Click the button to trigger the secure logout process.</p>
    <button id="logoutBtn">Logout</button>
    <div id="statusMessage"></div>

    <script>
        /**
         * Performs a secure logout by clearing client-side state and 
         * invalidating the server-side session.
         */
        async function logout() {
            const statusDiv = document.getElementById('statusMessage');

            // 1. Clear sensitive client-side state
            localStorage.clear();
            sessionStorage.clear();

            try {
                // 2. Send POST request to the server logout endpoint
                // This endpoint should clear the HttpOnly cookie and invalidate the session ID
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                        // Include CSRF token here if your application uses one
                        // 'X-CSRF-Token': getCookie('csrf_token')
                    },
                    // body: JSON.stringify({}) // Optional payload if required by your API
                });

                // 3. Only redirect if the server confirms success (status 200-299)
                if (!response.ok) {
                    throw new Error('Server failed to invalidate session');
                }

                // Redirect to login page after confirmation
                window.location.href = '/login';

            } catch (error) {
                console.error('Logout error:', error);
                statusDiv.textContent = 'Logout failed. Please try again.';
                // Depending on your security requirements, you might want to 
                // redirect anyway or force a page reload to clear caches.
            }
        }

        // Attach the function to the button click event
        document.getElementById('logoutBtn').addEventListener('click', logout);
    </script>
</body>
</html>