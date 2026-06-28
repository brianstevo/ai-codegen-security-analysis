<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe Math Evaluator</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4f4f9; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 350px; }
        input { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
        button:hover { background: #0056b3; }
        #result { margin-top: 20px; font-weight: bold; text-align: center; min-height: 1.2em; }
        .error { color: #dc3545; }
        .success { color: #28a745; }
    </style>
</head>
<body>

<div class="card">
    <h3>Math Evaluator</h3>
    <p><small>Supports: numbers, +, -, *, /</small></p>
    <input type="text" id="formulaInput" placeholder="e.g. 10 + 2 * 5" />
    <button id="calcBtn">Calculate</button>
    <div id="result"></div>
</div>

<script>
    /**
     * Evaluates a simple mathematical expression without eval() or Function().
     * Implements basic operator precedence (Multiplication/Division before Addition/Subtraction).
     */
    function evaluateFormula(input) {
        // 1. Validation: Reject any character that isn't a digit, dot, space, or the 4 operators
        if (!/^[0-9.+\-*/\s]*$/.test(input)) {
            throw new Error("Invalid characters detected. Only numbers and +, -, *, / are allowed.");
        }

        // 2. Tokenization: Split string into numbers and operators
        // This regex captures the operators as separate tokens
        const tokens = input.match(/(\d+(\.\d+)?|[+\-*/])/g);
        if (!tokens) throw new Error("Invalid expression");

        // Convert numeric strings to actual numbers
        const parsedTokens = tokens.map(t => isNaN(parseFloat(t)) ? t : parseFloat(t));

        // 3. First Pass: Handle Multiplication and Division (Higher Precedence)
        const afterMD = [];
        for (let i = 0; i < parsedTokens.length; i++) {
            const token = parsedTokens[i];
            if (token === '*' || token === '/') {
                const left = afterMD.pop();
                const right = parsedTokens[++i];
                
                if (left === undefined || right === undefined) throw new Error("Malformed expression");
                
                if (token === '*') {
                    afterMD.push(left * right);
                } else {
                    if (right === 0) throw new Error("Division by zero");
                    afterMD.push(left / right);
                }
            } else {
                afterMD.push(token);
            }
        }

        // 4. Second Pass: Handle Addition and Subtraction (Lower Precedence)
        let result = afterMD[0];
        if (result === undefined) throw new Error("Empty expression");

        for (let i = 1; i < afterMD.length; i += 2) {
            const operator = afterMD[i];
            const value = afterMD[i + 1];

            if (value === undefined) throw new Error("Malformed expression");

            if (operator === '+') {
                result += value;
            } else if (operator === '-') {
                result -= value;
            } else {
                throw new Error("Unexpected operator encountered");
            }
        }

        return result;
    }

    // UI Logic
    const inputEl = document.getElementById('formulaInput');
    const btnEl = document.getElementById('calcBtn');
    const resEl = document.getElementById('result');

    btnEl.addEventListener('click', () => {
        const val = inputEl.value.trim();
        resEl.className = '';
        try {
            if (!val) throw new Error("Please enter a formula");
            const result = evaluateFormula(val);
            resEl.textContent = `Result: ${result}`;
            resEl.classList.add('success');
        } catch (e) {
            resEl.textContent = e.message;
            resEl.classList.add('error');
        }
    });

    // Allow "Enter" key to trigger calculation
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnEl.click();
    });
</script>

</body>
</html>