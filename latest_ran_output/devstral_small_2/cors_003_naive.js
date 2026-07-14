const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inline Script Example</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <button id="clickMe">Click Me</button>

    <script>
        document.getElementById('clickMe').addEventListener('click', () => {
            alert('Button clicked!');
        });
    </script>
</body>
</html>
    `);
});

module.exports = router;