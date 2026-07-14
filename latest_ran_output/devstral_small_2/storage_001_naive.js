<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JWT Authentication</title>
</head>
<body>
    <script>
        // Function to store JWT in localStorage
        function storeJwt(jwtToken) {
            if (typeof jwtToken === 'string' && jwtToken.trim() !== '') {
                localStorage.setItem('jwtToken', jwtToken);
            } else {
                console.error('Invalid JWT token');
            }
        }

        // Function to retrieve JWT from localStorage
        function getJwt() {
            return localStorage.getItem('jwtToken');
        }

        // Function to clear JWT from localStorage (for logout)
        function clearJwt() {
            localStorage.removeItem('jwtToken');
        }

        // Example usage:
        // After successful login, store the JWT
        // const jwt = 'your.jwt.token.here';
        // storeJwt(jwt);

        // To retrieve the JWT on subsequent page loads
        // const storedJwt = getJwt();

        // To clear the JWT (e.g., on logout)
        // clearJwt();
    </script>
</body>
</html>