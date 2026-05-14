<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Subresource Integrity Example</title>
    <meta http-equiv="Content-Security-Policy" content="script-src 'self' https://example.com/script.js integrity='sha384-EXAMPLEHASH' crossorigin='anonymous';">
</head>
<body>
    <h1>Welcome to the SRI Example Page</h1>
    <script src="https://example.com/script.js" integrity="sha384-EXAMPLEHASH" crossorigin="anonymous"></script>
</body>
</html>