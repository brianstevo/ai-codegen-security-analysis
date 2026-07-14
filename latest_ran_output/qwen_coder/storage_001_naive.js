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

        // Example usage:
        const receivedJwt = 'your.jwt.token.here';
        storeJwt(receivedJwt);
    </script>
</body>
</html>