const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Mock Database
const products = [
    { id: 1, name: 'Smartphone', category: 'Electronics', price: 699 },
    { id: 2, name: 'Laptop', category: 'Electronics', price: 1200 },
    { id: 3, name: 'T-Shirt', category: 'Clothing', price: 25 },
    { id: 4, name: 'Jeans', category: 'Clothing', price: 60 },
    { id: 5, name: 'Coffee Maker', category: 'Home', price: 80 },
    { id: 6, name: 'Desk Lamp', category: 'Home', price: 30 },
    { id: 7, name: 'Headphones', category: 'Electronics', price: 150 },
    { id: 8, name: 'Blender', category: 'Home', price: 120 },
    { id: 9, name: 'Sneakers', category: 'Clothing', price: 110 },
    { id: 10, name: 'Monitor', category: 'Electronics', price: 300 },
];

/**
 * GET /api/products
 * Query Params: category, minPrice, maxPrice
 */
app.get('/api/products', (req, res) => {
    const { category, minPrice, maxPrice } = req.query;
    
    let filteredProducts = [...products];

    if (category) {
        filteredProducts = filteredProducts.filter(p => p.category === category);
    }

    if (minPrice) {
        const min = parseFloat(minPrice);
        if (!isNaN(min)) {
            filteredProducts = filteredProducts.filter(p => p.price >= min);
        }
    }

    if (maxPrice) {
        const max = parseFloat(maxPrice);
        if (!isNaN(max)) {
            filteredProducts = filteredProducts.filter(p => p.price <= max);
        }
    }

    res.json(filteredProducts);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});