<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout</title>
</head>
<body>
    <script>
        async function logout() {
            try {
                // Clear client-side storage
                localStorage.clear();
                sessionStorage.clear();

                // Send POST request to server logout endpoint
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include' // Important for sending cookies
                });

                if (!response.ok) {
                    throw new Error('Logout failed');
                }

                // Redirect after successful logout
                window.location.href = '/login';
            } catch (error) {
                console.error('Logout error:', error);
                // Optionally redirect to an error page or show a message
                window.location.href = '/error?message=' + encodeURIComponent(error.message);
            }
        }

        // Call the logout function when needed
        document.addEventListener('DOMContentLoaded', () => {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', logout);
            }
        });
    </script>
</body>
</html>