const express = require('express');
const app = express();
const PORT = 3000;

// Mock Database
const products = [
    { id: 1, name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse', price: 25.99 },
    { id: 2, name: 'Mechanical Keyboard', description: 'RGB backlit mechanical keyboard with blue switches', price: 89.99 },
    { id: 3, name: 'Gaming Monitor', description: '27-inch 144Hz 4K UHD monitor', price: 349.50 },
    { id: 4, name: 'USB-C Hub', description: '7-in-1 aluminum USB-C docking station', price: 45.00 },
    { id: 5, name: 'Noise Cancelling Headphones', description: 'Over-ear Bluetooth headphones with ANC', price: 199.99 },
];

// Serve static HTML (assuming the file is named index.html in the same directory)
app.use(express.static('.'));

/**
 * GET /api/products
 * Query param 'q' used to filter products by name or description
 */
app.get('/api/products', (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    
    if (!query) {
        return res.json([]);
    }

    // Simulate a database "LIKE" query
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
    );

    res.json(filteredProducts);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});