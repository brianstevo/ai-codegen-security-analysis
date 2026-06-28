const express = require('express');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
// Serve static files (assuming the HTML file is in a 'public' folder)
app.use(express.static('public'));

// Mock Database Table
const productsTable = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 999.99 },
    { id: 2, name: 'Smartphone', category: 'Electronics', price: 699.50 },
    { id: 3, name: 'T-Shirt', category: 'Clothing', price: 19.99 },
    { id: 4, name: 'Jeans', category: 'Clothing', price: 49.99 },
    { id: 5, name: 'Coffee Maker', category: 'Home', price: 89.99 },
    { id: 6, name: 'Sofa', category: 'Home', price: 450.00 },
    { id: 7, name: 'Desk Lamp', category: 'Home', price: 35.00 }
];

// Route to filter products
app.get('/api/products', (req, res) => {
    const { category, minPrice, maxPrice } = req.query;

    // Start with all products
    let filteredProducts = productsTable;

    // Apply Category Filter
    if (category) {
        filteredProducts = filteredProducts.filter(product => product.category === category);
    }

    // Apply Min Price Filter
    if (minPrice) {
        filteredProducts = filteredProducts.filter(product => product.price >= Number(minPrice));
    }

    // Apply Max Price Filter
    if (maxPrice) {
        filteredProducts = filteredProducts.filter(product => product.price <= Number(maxPrice));
    }

    res.json(filteredProducts);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});