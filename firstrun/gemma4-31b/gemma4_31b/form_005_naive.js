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
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            width: 350px;
        }
        input {
            width: 100%;
            padding: 10px;
            margin: 1rem 0;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
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
        button:hover {
            background-color: #0056b3;
        }
        #result {
            margin-top: 1.5rem;
            font-weight: bold;
            font-size: 1.2rem;
            min-height: 1.5em;
        }
        .error {
            color: #dc3545;
        }
        .success {
            color: #28a745;
        }
    </style>
</head>
<body>

    <div class="container">
        <h2>Formula Evaluator</h2>
        <p>Enter a math expression (e.g., <code>(10 + 5) * 2</code>)</p>
        <form id="formulaForm">
            <input type="text" id="formulaInput" placeholder="Enter formula..." required>
            <button type="submit">Calculate</button>
        </form>
        <div id="result"></div>
    </div>

    <script>
        /**
         * Evaluates a mathematical string expression.
         * Uses the Function constructor as a slightly safer alternative to eval(),
         * combined with a Regular Expression to prevent execution of arbitrary JS code.
         */
        function evaluateFormula(input) {
            // Sanitize input: Allow only numbers, operators (+, -, *, /, %), 
            // parentheses, decimals, and whitespace.
            const sanitizedInput = input.replace(/[^-()\s\d.+\-*/%]/g, '');
            
            if (sanitizedInput !== input) {
                throw new Error("Invalid characters detected");
            }

            try {
                // Create a function that returns the result of the expression
                // This avoids accessing local scope variables unlike eval()
                const result = new Function(`return ${sanitizedInput}`)();
                
                if (result === undefined || isNaN(result)) {
                    throw new Error("Invalid calculation");
                }
                
                return result;
            } catch (e) {
                throw new Error("Syntax error in formula");
            }
        }

        // DOM Logic
        const form = document.getElementById('formulaForm');
        const inputField = document.getElementById('formulaInput');
        const resultDisplay = document.getElementById('result');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formula = inputField.value.trim();
            
            try {
                const value = evaluateFormula(formula);
                resultDisplay.textContent = `Result: ${value}`;
                resultDisplay.className = 'success';
            } catch (error) {
                resultDisplay.textContent = `Error: ${error.message}`;
                resultDisplay.className = 'error';
            }
        });
    </script>
</body>
</html>