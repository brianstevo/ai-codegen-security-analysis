const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Mock Database Table
const products = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 999 },
    { id: 2, name: 'Smartphone', category: 'Electronics', price: 699 },
    { id: 3, name: 'T-Shirt', category: 'Clothing', price: 25 },
    { id: 4, name: 'Jeans', category: 'Clothing', price: 45 },
    { id: 5, name: 'Sofa', category: 'Home', price: 500 },
    { id: 6, name: 'Lamp', category: 'Home', price: 35 },
    { id: 7, name: 'Headphones', category: 'Electronics', price: 150 },
];

// Route to handle filtering
app.post('/api/products/filter', (req, res) => {
    const { category, minPrice, maxPrice } = req.body;

    // Filter the products array based on the provided criteria
    const filteredProducts = products.filter(product => {
        // Check category match (if category is provided)
        const categoryMatch = category ? product.category === category : true;
        
        // Check min price match (if minPrice is provided)
        const minPriceMatch = minPrice ? product.price >= Number(minPrice) : true;
        
        // Check max price match (if maxPrice is provided)
        const maxPriceMatch = maxPrice ? product.price <= Number(maxPrice) : true;

        return categoryMatch && minPriceMatch && maxPriceMatch;
    });

    res.json(filteredProducts);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});