<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f4f9;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 500px;
        }
        h1 {
            margin-top: 0;
            color: #333;
            text-align: center;
        }
        .input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        input[type="text"] {
            flex-grow: 1;
            padding: 10px;
            font-size: 16px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: #0056b3;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        #result-area {
            padding: 15px;
            border-radius: 4px;
            font-family: "Courier New", Courier, monospace;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 15px;
            text-align: center;
            font-style: italic;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>Formula Evaluator</h1>
    <p class="info">Enter a mathematical expression (e.g., 10 * 20 + Math.PI)</p>
    
    <div class="input-group">
        <form id="formulaForm" style="width: 100%; display: flex; gap: 10px;">
            <input type="text" id="formulaInput" placeholder="Enter formula..." autocomplete="off" required>
            <button type="submit" id="calculateBtn">Calculate</button>
        </form>
    </div>

    <div id="result-area"></div>
</div>

<script>
    /**
     * Evaluates a user-provided mathematical formula safely-ish.
     * @param {string} expression - The string expression to evaluate
     * @returns {any} - The result of the calculation or an error message
     */
    function evaluateFormula(expression) {
        // 1. Basic Sanitization: Remove characters that are not numbers, operators, parentheses, dots, or allowed Math functions/properties
        // Note: This is a basic filter. In a production environment, a proper parser (like math.js) is recommended.
        const sanitizedExpression = expression.replace(/[^0-9+\-*/().,\sMathPIE]/g, '');

        if (!sanitizedExpression.trim()) {
            return "Error: Input is empty or invalid.";
        }

        try {
            // 2. Create a safe-ish scope
            // We create an object with Math constants and functions but no dangerous globals (like window, document, etc.)
            const mathContext = {
                Math: Math,
                PI: Math.PI,
                E: Math.E
            };

            // 3. Use the Function constructor with specific arguments
            // This prevents access to the global scope (window) that a direct eval() would have.
            // We explicitly pass 'Math', 'PI', and 'E' as variables the code can see.
            const calculate = new Function('Math', 'PI', 'E', `return ${sanitizedExpression};`);
            
            const result = calculate(mathContext.Math, mathContext.PI, mathContext.E);
            
            // Check for NaN or Infinity
            if (isNaN(result) || !isFinite(result)) {
                return "Error: Result is not a valid number (NaN or Infinity).";
            }

            return `Result: ${result}`;

        } catch (error) {
            return `Error: Invalid formula syntax. (${error.message})`;
        }
    }

    // DOM Interaction
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('formulaForm');
        const input = document.getElementById('formulaInput');
        const resultArea = document.getElementById('result-area');
        const btn = document.getElementById('calculateBtn');

        form.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent page reload

            const formula = input.value;
            
            // Disable button during calculation to prevent double submission
            btn.disabled = true;
            resultArea.className = ''; // Reset classes
            resultArea.textContent = 'Calculating...';

            // Use setTimeout to allow the UI to update the "Calculating..." text before the heavy lifting (if any)
            setTimeout(() => {
                const output = evaluateFormula(formula);
                
                resultArea.textContent = output;
                
                if (output.startsWith('Error')) {
                    resultArea.classList.add('error');
                } else {
                    resultArea.classList.add('success');
                }
                
                btn.disabled = false;
                input.focus();
            }, 10);
        });
    });
</script>

</body>
</html>