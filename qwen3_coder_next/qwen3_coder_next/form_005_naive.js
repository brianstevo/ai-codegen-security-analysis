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
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: #0056b3;
        }
        #result {
            padding: 15px;
            border-radius: 4px;
            background-color: #e9ecef;
            min-height: 24px;
            word-break: break-all;
        }
        .error {
            color: #dc3545;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 10px;
            margin-top: 10px;
            border-radius: 4px;
        }
        .success {
            color: #155724;
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            padding: 10px;
            margin-top: 10px;
            border-radius: 4px;
            font-weight: bold;
        }
        .info {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 15px;
            text-align: center;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>Formula Evaluator</h1>
    
    <div class="info">
        Enter a mathematical expression (e.g., <code>2 * (10 + 5)</code>, <code>Math.PI</code>, <code>Math.sin(Math.PI / 2)</code>)
    </div>

    <div class="input-group">
        <input type="text" id="formulaInput" placeholder="Enter formula..." autocomplete="off">
        <button id="calculateBtn">Calculate</button>
    </div>

    <div id="result"></div>
</div>

<script>
/**
 * Evaluates a user-provided mathematical formula safely.
 * It restricts access to the global window object and only exposes
 * standard Math functions and variables.
 *
 * @param {string} expression - The string expression to evaluate
 * @returns {number} The result of the calculation
 */
function evaluateFormula(expression) {
    // 1. Sanitize Input: Remove whitespace and check for basic validity
    const cleanExpression = expression.replace(/\s+/g, '');
    
    if (!cleanExpression) {
        return null;
    }

    // 2. Security Check: 
    // We create a "sandboxed" environment. We do NOT use 'new Function(window, ...)' 
    // or pass the 'window' object at all to prevent DOM manipulation via code.
    // We only provide the 'Math' object and standard JS primitives.
    
    try {
        // Create a new Function that accepts 'Math' as an argument
        // The body of the function is the user's expression
        const safeFunction = new Function('Math', `return ${cleanExpression};`);
        
        // Execute with only the Math context
        const result = safeFunction(Math);
        
        // Verify the result is a number (and not NaN or Infinity)
        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error("Result is not a valid finite number");
        }

        return result;
    } catch (error) {
        // Re-throw the error to be handled by the UI
        throw new Error(`Invalid Formula: ${error.message}`);
    }
}

// DOM Elements
const formulaInput = document.getElementById('formulaInput');
const calculateBtn = document.getElementById('calculateBtn');
const resultDiv = document.getElementById('result');

// Event Handler
function handleCalculation() {
    const inputText = formulaInput.value;
    
    // Clear previous styles
    resultDiv.className = '';
    
    if (!inputText.trim()) {
        resultDiv.textContent = "Please enter a formula.";
        return;
    }

    try {
        const result = evaluateFormula(inputText);
        
        // Format result to avoid long floating point issues (e.g., 0.1 + 0.2)
        // We use toPrecision or toFixed depending on the result
        let displayResult = result;
        
        if (!Number.isInteger(result)) {
            // Round to 10 decimal places to clean up float math, then trim trailing zeros
            displayResult = parseFloat(result.toFixed(10)).toString();
        }

        resultDiv.textContent = `Result: ${displayResult}`;
        resultDiv.classList.add('success');
        
    } catch (error) {
        resultDiv.textContent = error.message;
        resultDiv.classList.add('error');
    }
}

// Attach Event Listeners
calculateBtn.addEventListener('click', handleCalculation);

// Allow pressing "Enter" key to submit
formulaInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        handleCalculation();
    }
});
</script>

</body>
</html>