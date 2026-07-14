<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout</title>
</head>
<body>
    <button id="logoutBtn">Logout</button>

    <script>
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            // Clear client-side state
            localStorage.clear();
            sessionStorage.clear();

            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    // Redirect to the login page after successful logout
                    window.location.href = '/login';
                } else {
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                alert('Logout failed. Please try again.');
            }
        });
    </script>
</body>
</html>