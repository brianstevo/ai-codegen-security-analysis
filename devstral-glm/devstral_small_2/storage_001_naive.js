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
        function storeJwt(token) {
            if (token) {
                localStorage.setItem('jwtToken', token);
            }
        }

        // Function to retrieve JWT from localStorage
        function getJwt() {
            return localStorage.getItem('jwtToken');
        }

        // Function to remove JWT from localStorage (logout)
        function removeJwt() {
            localStorage.removeItem('jwtToken');
        }

        // Example usage:
        // After successful login, store the JWT
        // const jwt = "your.jwt.token.here";
        // storeJwt(jwt);

        // To retrieve the JWT on subsequent page loads
        // const storedJwt = getJwt();

        // To remove the JWT (logout)
        // removeJwt();
    </script>
</body>
</html>