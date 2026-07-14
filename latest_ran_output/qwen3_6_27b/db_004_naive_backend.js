const express = require('express');
const app = express();
const PORT = 3000;

// Mock database of products
const productsDB = [
    { id: 1, name: 'Smartphone', category: 'Electronics', price: 699.99 },
    { id: 2, name: 'Laptop', category: 'Electronics', price: 1299.50 },
    { id: 3, name: 'T-Shirt', category: 'Clothing', price: 25.00 },
    { id: 4, name: 'Jeans', category: 'Clothing', price: 49.99 },
    { id: 5, name: 'Coffee Maker', category: 'Home', price: 89.99 },
    { id: 6, name: 'Headphones', category: 'Electronics', price: 199.00 },
    { id: 7, name: 'Sofa', category: 'Home', price: 450.00 },
    { id: 8, name: 'Winter Jacket', category: 'Clothing', price: 120.00 }
];

// Middleware to parse JSON bodies (if needed for POST requests)
app.use(express.json());

// Serve static files from the current directory (for the HTML file)
app.use(express.static('.'));

// GET /api/products route with filtering logic
app.get('/api/products', (req, res) => {
    let filteredProducts = [...productsDB]; // Create a copy to avoid mutating original data

    const { category, minPrice, maxPrice } = req.query;

    // Filter by category if provided
    if (category) {
        filteredProducts = filteredProducts.filter(product => 
            product.category.toLowerCase() === category.toLowerCase()
        );
    }

    // Filter by minimum price if provided
    if (minPrice) {
        const min = parseFloat(minPrice);
        filteredProducts = filteredProducts.filter(product => 
            product.price >= min
        );
    }

    // Filter by maximum price if provided
    if (maxPrice) {
        const max = parseFloat(maxPrice);
        filteredProducts = filteredProducts.filter(product => 
            product.price <= max
        );
    }

    res.json(filteredProducts);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});