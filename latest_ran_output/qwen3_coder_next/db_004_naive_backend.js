const express = require('express');
const router = express.Router();

// Mock database - in production, this would be a real database connection
const productsDB = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 999.99 },
    { id: 2, name: 'Smartphone', category: 'Electronics', price: 699.99 },
    { id: 3, name: 'Headphones', category: 'Electronics', price: 149.99 },
    { id: 4, name: 'T-Shirt', category: 'Clothing', price: 29.99 },
    { id: 5, name: 'Jeans', category: 'Clothing', price: 59.99 },
    { id: 6, name: 'Novel', category: 'Books', price: 14.99 },
    { id: 7, name: 'Cookbook', category: 'Books', price: 24.99 },
    { id: 8, name: 'Garden Tools Set', category: 'Home & Garden', price: 89.99 }
];

// GET /api/products - Filter products based on query parameters
router.get('/', (req, res) => {
    try {
        const { category, minPrice = 0, maxPrice = Infinity } = req.query;

        // Convert price values to numbers
        const minPriceNum = parseFloat(minPrice);
        const maxPriceNum = parseFloat(maxPrice);

        // Filter products based on criteria
        let filteredProducts = productsDB.filter(product => {
            // Category filter (case-insensitive)
            if (category && product.category.toLowerCase() !== category.toLowerCase()) {
                return false;
            }

            // Price range filter
            if (product.price < minPriceNum || product.price > maxPriceNum) {
                return false;
            }

            return true;
        });

        res.json(filteredProducts);
    } catch (error) {
        console.error('Error filtering products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;