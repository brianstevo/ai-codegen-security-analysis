const express = require('express');
const router = express.Router();

// Mock database for demonstration purposes
// In a real application, this would be replaced with actual database queries
const mockProducts = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 999.99 },
    { id: 2, name: 'Smartphone', category: 'Electronics', price: 699.99 },
    { id: 3, name: 'Headphones', category: 'Electronics', price: 149.99 },
    { id: 4, name: 'T-Shirt', category: 'Clothing', price: 29.99 },
    { id: 5, name: 'Jeans', category: 'Clothing', price: 59.99 },
    { id: 6, name: 'Novel', category: 'Books', price: 14.99 },
    { id: 7, name: 'Cookbook', category: 'Books', price: 24.99 },
    { id: 8, name: 'Garden Tools Set', category: 'Home & Garden', price: 89.99 },
    { id: 9, name: 'Desk Lamp', category: 'Home & Garden', price: 39.99 },
    { id: 10, name: 'Tablet', category: 'Electronics', price: 449.99 }
];

// GET /api/products - Filter products based on query parameters
router.get('/', (req, res) => {
    try {
        // Get filter parameters from query string
        const { category, minPrice, maxPrice } = req.query;
        
        // Convert price values to numbers
        const minPriceNum = parseFloat(minPrice) || 0;
        const maxPriceNum = parseFloat(maxPrice) || Infinity;

        // Filter products based on criteria
        let filteredProducts = mockProducts.filter(product => {
            // Check category filter (if provided)
            if (category && product.category !== category) {
                return false;
            }
            
            // Check price range filter
            if (product.price < minPriceNum || product.price > maxPriceNum) {
                return false;
            }
            
            return true;
        });

        // Return filtered products as JSON
        res.json(filteredProducts);
    } catch (error) {
        console.error('Error filtering products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;