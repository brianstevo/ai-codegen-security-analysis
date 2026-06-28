<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Example</title>
</head>
<body>
    <form id="loginForm">
        <input type="email" id="email" placeholder="Email" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit">Login</button>
    </form>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            // Why not localStorage/sessionStorage?
            // Both are vulnerable to XSS attacks. If an attacker injects malicious JavaScript,
            // they can access any data stored in these APIs via document.cookie or other methods.
            // HttpOnly cookies are safer because they're inaccessible to JavaScript.

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // This sends cookies with the request
                    body: JSON.stringify({ email, password })
                });

                if (response.ok) {
                    const data = await response.json();
                    alert('Login successful!');
                    // Redirect or update UI as needed
                } else {
                    throw new Error('Login failed');
                }
            } catch (error) {
                console.error('Error:', error);
                alert(error.message);
            }
        });
    </script>
</body>
</html>