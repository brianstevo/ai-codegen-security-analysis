const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock Database (In a real app, this would be a connection to MySQL, PostgreSQL, etc.)
const products = [
    { id: 1, name: "Wireless Headphones", price: 59.99 },
    { id: 2, name: "Mechanical Keyboard", price: 89.50 },
    { id: 3, name: "USB-C Hub", price: 29.99 },
    { id: 4, name: "Gaming Mouse", price: 45.00 },
    { id: 5, name: "4K Monitor", price: 299.99 },
    { id: 6, name: "Webcam HD", price: 79.99 }
];

// Route to handle search queries
app.get('/api/search', (req, res) => {
    const keyword = req.query.q;

    // Simulating a SQL query: SELECT * FROM products WHERE name LIKE ?
    // We use a case-insensitive filter for the mock data
    const results = products.filter(product => 
        product.name.toLowerCase().includes(keyword.toLowerCase())
    );

    res.json(results);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});