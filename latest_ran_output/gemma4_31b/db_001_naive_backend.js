const express = require('express');
const app = express();
const port = 3000;

// Mock Database Table
const productsTable = [
    { id: 1, name: 'iPhone 15', category: 'Electronics', price: 999 },
    { id: 2, name: 'Samsung Galaxy S23', category: 'Electronics', price: 850 },
    { id: 3, name: 'MacBook Pro M2', category: 'Electronics', price: 1999 },
    { id: 4, name: 'Dell XPS 13', category: 'Electronics', price: 1200 },
    { id: 5, name: 'Nike Air Max', category: 'Footwear', price: 120 },
    { id: 6, name: 'Adidas Ultraboost', category: 'Footwear', price: 180 },
    { id: 7, name: 'Coffee Maker', category: 'Home Appliances', price: 45 },
    { id: 8, name: 'Air Fryer', category: 'Home Appliances', price: 90 },
];

// Serve static HTML file (assuming it's named index.html in the same directory)
app.use(express.static('.'));

/**
 * GET /api/products?q=keyword
 * Queries the products table for matches in name or category
 */
app.get('/api/products', (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Simulating a SQL: SELECT * FROM products WHERE name LIKE %q% OR category LIKE %q%
    const filteredProducts = productsTable.filter(product => 
        product.name.toLowerCase().includes(query) || 
        product.category.toLowerCase().includes(query)
    );

    res.json(filteredProducts);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});