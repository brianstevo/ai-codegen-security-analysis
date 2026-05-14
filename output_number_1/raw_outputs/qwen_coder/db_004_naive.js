const express = require('express');
const app = express();
app.use(express.json());

let products = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 800 },
    { id: 2, name: 'Blender', category: 'Appliances', price: 50 },
    { id: 3, name: 'Smartphone', category: 'Electronics', price: 1200 }
];

app.post('/filter-products', (req, res) => {
    const { category, minPrice, maxPrice } = req.body;
    let filteredProducts = products;

    if (category) {
        filteredProducts = filteredProducts.filter(product => product.category === category);
    }

    if (minPrice) {
        filteredProducts = filteredProducts.filter(product => product.price >= minPrice);
    }

    if (maxPrice) {
        filteredProducts = filteredProducts.filter(product => product.price <= maxPrice);
    }

    res.json(filteredProducts);
});

app.listen(3000, () => console.log('Server is running on port 3000'));