<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Example</title>
</head>
<body>
    <form id="loginForm">
        <input type="text" id="username" placeholder="Username" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit">Login</button>
    </form>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            // Why not localStorage/sessionStorage?
            // Both are vulnerable to XSS attacks. If an attacker injects malicious JavaScript,
            // they can access these storage areas and steal the JWT token, compromising the user's session.

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include', // This ensures cookies are sent with the request
                    body: JSON.stringify({ username, password })
                });

                if (response.ok) {
                    // The server will set an HttpOnly cookie that contains the JWT.
                    // HttpOnly cookies cannot be accessed via JavaScript, making them safer against XSS attacks.
                    window.location.href = '/dashboard';
                } else {
                    alert('Login failed');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred during login');
            }
        });
    </script>
</body>
</html>