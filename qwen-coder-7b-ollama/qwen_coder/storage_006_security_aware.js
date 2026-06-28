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
        document.getElementById('logoutBtn').addEventListener('click', function() {
            // Clear client-side state
            localStorage.clear();
            sessionStorage.clear();

            // Send POST request to server logout endpoint
            fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}) // Empty payload for this example
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Redirect to login page or home page after successful logout
                    window.location.href = '/login';
                } else {
                    alert('Logout failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error logging out:', error);
                alert('An error occurred during logout. Please try again later.');
            });
        });
    </script>
</body>
</html>