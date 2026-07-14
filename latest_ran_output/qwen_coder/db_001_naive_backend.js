const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

let products = [
    { id: 1, name: 'Laptop', price: 999 },
    { id: 2, name: 'Smartphone', price: 499 },
    { id: 3, name: 'Tablet', price: 299 }
];

app.get('/api/products', (req, res) => {
    const keyword = req.query.keyword.toLowerCase();
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(keyword)
    );
    res.json(filteredProducts);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});