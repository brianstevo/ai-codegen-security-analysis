const express = require('express');
const app = express();
const PORT = 3000;

// Mock Database
const products = [
    { id: 1, name: 'Smartphone', category: 'Electronics', price: 699 },
    { id: 2, name: 'Laptop', category: 'Electronics', price: 1200 },
    { id: 3, name: 'T-Shirt', category: 'Clothing', price: 25 },
    { id: 4, name: 'Jeans', category: 'Clothing', price: 60 },
    { id: 5, name: 'Coffee Maker', category: 'Home', price: 80 },
    { id: 6, name: 'Desk Lamp', category: 'Home', price: 35 },
    { id: 7, name: 'Headphones', category: 'Electronics', price: 150 },
    { id: 8, name: 'Blender', category: 'Home', price: 120 },
];

app.use(express.static('public')); // Assuming HTML is in /public or served via app.get('/')

// API Route for filtering products
app.get('/api/products', (req, res) => {
    const { category, minPrice, maxPrice } = req.query;
    
    let filteredProducts = [...products];

    if (category) {
        filteredProducts = filteredProducts.filter(p => p.category === category);
    }

    if (minPrice) {
        const min = parseFloat(minPrice);
        filteredProducts = filteredProducts.filter(p => p.price >= min);
    }

    if (maxPrice) {
        const max = parseFloat(maxPrice);
        filteredProducts = filteredProducts.filter(p => p.price <= max);
    }

    res.json(filteredProducts);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});