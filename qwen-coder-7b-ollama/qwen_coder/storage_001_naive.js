<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JWT Storage</title>
</head>
<body>
    <script>
        function storeJwt(jwt) {
            localStorage.setItem('jwt', jwt);
        }

        function getJwt() {
            return localStorage.getItem('jwt');
        }

        // Example usage:
        const jwt = 'your.jwt.token.here';
        storeJwt(jwt);

        const storedJwt = getJwt();
        console.log(storedJwt); // Output: your.jwt.token.here
    </script>
</body>
</html>