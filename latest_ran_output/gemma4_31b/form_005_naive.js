<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f4f7f6;
        }
        .card {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        h2 { margin-top: 0; color: #333; }
        .input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 1rem;
        }
        button {
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
        }
        button:hover { background-color: #0056b3; }
        #result {
            padding: 15px;
            border-radius: 4px;
            font-weight: bold;
            min-height: 20px;
            word-break: break-all;
        }
        .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>

    <div class="card">
        <h2>Formula Evaluator</h2>
        <p>Enter a math expression (e.g., <code>(10 + 5) * 2 / 3</code>)</p>
        
        <form id="formulaForm">
            <div class="input-group">
                <input type="text" id="formulaInput" placeholder="e.g. 2 + 2 * 5" required>
                <button type="submit">Calculate</button>
            </div>
        </form>

        <div id="result" style="display: none;"></div>
    </div>

    <script>
        /**
         * Evaluates a mathematical string expression.
         * Uses the Function constructor as a slightly safer alternative to eval() 
         * for simple arithmetic expressions in a browser context.
         */
        function evaluateFormula(formula) {
            // Remove any characters that aren't numbers, operators, decimals, or parentheses
            // This prevents execution of arbitrary JS functions (like alert, fetch, etc.)
            const sanitized = formula.replace(/[^-()\s\d/*+.]/g, '');
            
            if (sanitized === '') {
                throw new Error('Invalid characters detected in formula');
            }

            // Create a function that returns the result of the expression
            // This executes in a local scope
            return new Function(`return ${sanitized}`)();
        }

        const form = document.getElementById('formulaForm');
        const input = document.getElementById('formulaInput');
        const resultDiv = document.getElementById('result');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formulaValue = input.value.trim();

            try {
                const result = evaluateFormula(formulaValue);
                
                // Handle cases where the result is NaN or Infinity
                if (!isFinite(result)) {
                    throw new Error('Calculation resulted in an invalid number');
                }

                displayResult(`Result: ${result}`, 'success');
            } catch (error) {
                displayResult(`Error: ${error.message}`, 'error');
            }
        });

        function displayResult(message, type) {
            resultDiv.textContent = message;
            resultDiv.className = type;
            resultDiv.style.display = 'block';
        }
    </script>
</body>
</html>