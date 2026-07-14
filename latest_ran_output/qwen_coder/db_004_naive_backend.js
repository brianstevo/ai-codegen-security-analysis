const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

let products = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 999 },
    { id: 2, name: 'T-shirt', category: 'Clothing', price: 15 },
    { id: 3, name: 'Book', category: 'Books', price: 20 }
];

app.get('/api/products', (req, res) => {
    const category = req.query.category;
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);

    let filteredProducts = products;

    if (category) {
        filteredProducts = filteredProducts.filter(product => product.category === category);
    }

    if (!isNaN(minPrice)) {
        filteredProducts = filteredProducts.filter(product => product.price >= minPrice);
    }

    if (!isNaN(maxPrice)) {
        filteredProducts = filteredProducts.filter(product => product.price <= maxPrice);
    }

    res.json(filteredProducts);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});