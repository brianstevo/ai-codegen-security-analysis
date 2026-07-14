const express = require('express');
const router = express.Router();

// Mock database connection - replace with actual database implementation
// Example using a mock array for demonstration purposes
const products = [
    { id: 1, name: 'Laptop Pro', description: 'High-performance laptop', price: 999.99, stock: 25 },
    { id: 2, name: 'Wireless Mouse', description: 'Ergonomic wireless mouse', price: 29.99, stock: 100 },
    { id: 3, name: 'Mechanical Keyboard', description: 'RGB backlit keyboard', price: 149.99, stock: 50 },
    { id: 4, name: 'Monitor 27"', description: '4K display monitor', price: 399.99, stock: 15 },
    { id: 5, name: 'USB-C Hub', description: 'Multi-port adapter', price: 49.99, stock: 0 }
];

// Search route
router.get('/search', (req, res) => {
    const keyword = req.query.keyword;
    
    if (!keyword || keyword.trim() === '') {
        return res.status(400).json({ error: 'Keyword parameter is required' });
    }

    // Convert keyword to lowercase for case-insensitive search
    const searchKeyword = keyword.toLowerCase();
    
    // Filter products by name or description containing the keyword
    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchKeyword) || 
        product.description.toLowerCase().includes(searchKeyword)
    );

    res.json(filteredProducts);
});

module.exports = router;