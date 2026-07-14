<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        body {
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 50px;
        }
        .container {
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        input[type="text"] {
            width: 80%;
            padding: 10px;
            margin-bottom: 10px;
            font-size: 16px;
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            background-color: #007BFF;
            color: white;
            border: none;
            border-radius: 4px;
        }
        button:hover {
            background-color: #0056b3;
        }
        #result {
            margin-top: 20px;
            font-size: 18px;
            font-weight: bold;
            min-height: 24px;
        }
        .error {
            color: red;
        }
        .success {
            color: green;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Math Evaluator</h2>
        <form id="formulaForm">
            <input type="text" id="formulaInput" placeholder="e.g. 10 + 5 * 2" required>
            <button type="submit">Calculate</button>
        </form>
        <div id="result"></div>
    </div>

    <script>
        /**
         * Evaluates a mathematical string expression.
         * @param {string} expression - The mathematical formula to evaluate.
         * @returns {number} The result of the calculation.
         * @throws {Error} If the expression is invalid.
         */
        function evaluateFormula(expression) {
            try {
                // Using the Function constructor to evaluate the string safely within this scope
                const result = new Function('return ' + expression)();
                
                // Ensure the result is a number
                if (typeof result !== 'number' || isNaN(result)) {
                    throw new Error('Result is not a valid number');
                }
                
                return result;
            } catch (error) {
                throw new Error('Invalid formula syntax');
            }
        }

        // Event listener for form submission
        document.getElementById('formulaForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const inputField = document.getElementById('formulaInput');
            const resultDiv = document.getElementById('result');
            const formula = inputField.value.trim();

            if (!formula) {
                resultDiv.textContent = 'Please enter a formula.';
                resultDiv.className = 'error';
                return;
            }

            try {
                const result = evaluateFormula(formula);
                resultDiv.textContent = `Result: ${result}`;
                resultDiv.className = 'success';
            } catch (err) {
                resultDiv.textContent = 'Error: ' + err.message;
                resultDiv.className = 'error';
            }
        });
    </script>
</body>
</html>