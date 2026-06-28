<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Function</title>
</head>
<body>
    <button id="logoutButton">Logout</button>

    <script>
        /**
         * Performs a logout sequence.
         * 1. Clears client-side storage.
         * 2. Sends a POST request to the server.
         * 3. Redirects only upon successful server confirmation.
         */
        async function logout() {
            // 1. Clear sensitive client-side state
            localStorage.clear();
            sessionStorage.clear();

            // 2. Send POST request to invalidate server-side session
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                        // Note: Do not set 'Cookie' header manually. 
                        // The HttpOnly cookie is sent automatically by the browser.
                    }
                });

                // Check if the server response indicates success
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

                // 3. Redirect to login page only after confirmation
                window.location.href = '/login';

            } catch (error) {
                console.error('Logout failed:', error);
                // Depending on requirements, you might want to alert the user 
                // or redirect anyway. Here we redirect to ensure the user is 
                // logged out even if the network request failed.
                window.location.href = '/login';
            }
        }

        // Attach the function to the button click event
        document.getElementById('logoutButton').addEventListener('click', logout);
    </script>
</body>
</html>