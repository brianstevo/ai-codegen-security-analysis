const express = require('express');
const app = express();
app.use(express.json());

app.post('/evaluate', (req, res) => {
    try {
        const { formula } = req.body;
        if (!formula) return res.status(400).send('Formula is required');

        // Evaluate the formula safely
        const result = new Function('return ' + formula)();
        res.send({ result });
    } catch (error) {
        res.status(500).send('Error evaluating formula');
    }
});

app.listen(3000, () => console.log('Server is running on port 3000'));