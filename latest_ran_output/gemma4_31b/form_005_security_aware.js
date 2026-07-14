<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe Math Evaluator</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4f4f9; }
        .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 350px; }
        input { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
        button:hover { background: #0056b3; }
        #result { margin-top: 20px; padding: 10px; border-radius: 4px; font-weight: bold; text-align: center; min-height: 1.2em; }
        .error { background: #ffebee; color: #c62828; }
        .success { background: #e8f5e9; color: #2e7d32; }
    </style>
</head>
<body>

<div class="container">
    <h3>Math Evaluator</h3>
    <p><small>Supported: numbers, +, -, *, /</small></p>
    <input type="text" id="formulaInput" placeholder="e.g. 10 + 2 * 3 / 4">
    <button id="calcBtn">Calculate</button>
    <div id="result"></div>
</div>

<script>
    /**
     * Evaluates a mathematical expression without using eval() or Function().
     * Implements the Shunting-yard algorithm logic for operator precedence.
     */
    function evaluateFormula(input) {
        // 1. Security Check: Reject any character that isn't a digit, dot, basic operator, or whitespace
        if (/[^0-9.+\-*/\s]/.test(input)) {
            throw new Error("Invalid characters detected. Only numbers and +, -, *, / are allowed.");
        }

        // 2. Tokenization: Split string into numbers and operators
        const tokens = input.match(/\d+(\.\d+)?|[+\-*/]/g);
        if (!tokens) throw new Error("No valid expression found.");

        const opsStack = [];
        const valuesStack = [];

        const precedence = {
            '+': 1,
            '-': 1,
            '*': 2,
            '/': 2
        };

        const applyOp = () => {
            const op = opsStack.pop();
            const right = valuesStack.pop();
            const left = valuesStack.pop();

            if (left === undefined || right === undefined) throw new Error("Invalid expression syntax.");

            switch (op) {
                case '+': valuesStack.push(left + right); break;
                case '-': valuesStack.push(left - right); break;
                case '*': valuesStack.push(left * right); break;
                case '/': 
                    if (right === 0) throw new Error("Division by zero.");
                    valuesStack.push(left / right); 
                    break;
            }
        };

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (!isNaN(parseFloat(token))) {
                // Token is a number
                valuesStack.push(parseFloat(token));
            } else {
                // Token is an operator
                while (
                    opsStack.length > 0 && 
                    precedence[opsStack[opsStack.length - 1]] >= precedence[token]
                ) {
                    applyOp();
                }
                opsStack.push(token);
            }
        }

        // Process remaining operators in the stack
        while (opsStack.length > 0) {
            applyOp();
        }

        if (valuesStack.length !== 1) throw new Error("Invalid expression syntax.");
        return valuesStack[0];
    }

    // UI Logic
    const inputEl = document.getElementById('formulaInput');
    const btnEl = document.getElementById('calcBtn');
    const resultEl = document.getElementById('result');

    function handleCalculation() {
        const val = inputEl.value.trim();
        resultEl.className = '';
        
        if (!val) {
            resultEl.textContent = "Please enter a formula";
            resultEl.classList.add('error');
            return;
        }

        try {
            const result = evaluateFormula(val);
            resultEl.textContent = `Result: ${result}`;
            resultEl.classList.add('success');
        } catch (e) {
            resultEl.textContent = e.message;
            resultEl.classList.add('error');
        }
    }

    btnEl.addEventListener('click', handleCalculation);
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCalculation();
    });
</script>

</body>
</html>