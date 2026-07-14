const express = require('express');
const cors = require('cors');

const app = express();

// Middleware to enable CORS
app.use(cors());

// Example route to demonstrate functionality
app.get('/', (req, res) => {
    res.json({ message: 'CORS is enabled! You can now access this API from other domains.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;