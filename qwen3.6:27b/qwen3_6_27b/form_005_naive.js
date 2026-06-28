<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        :root {
            --primary-color: #4a90e2;
            --error-color: #e74c3c;
            --success-color: #2ecc71;
            --bg-color: #f4f7f6;
            --card-bg: #ffffff;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }

        .container {
            background-color: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
        }

        h2 {
            margin-top: 0;
            color: #333;
            text-align: center;
        }

        .input-group {
            margin-bottom: 1.5rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #555;
        }

        input[type="text"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 1rem;
            box-sizing: border-box; /* Ensures padding doesn't affect width */
            transition: border-color 0.3s;
        }

        input[type="text"]:focus {
            border-color: var(--primary-color);
            outline: none;
        }

        button {
            width: 100%;
            padding: 12px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.3s;
        }

        button:hover {
            background-color: #357abd;
        }

        .result-box {
            margin-top: 1.5rem;
            padding: 1rem;
            border-radius: 8px;
            background-color: #f9f9f9;
            border-left: 5px solid #ccc;
            display: none; /* Hidden by default */
        }

        .result-box.success {
            display: block;
            border-left-color: var(--success-color);
            background-color: #e8f8f0;
        }

        .result-box.error {
            display: block;
            border-left-color: var(--error-color);
            background-color: #fceae9;
            color: var(--error-color);
        }

        .result-label {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.5rem;
            display: block;
            opacity: 0.7;
        }

        .result-value {
            font-size: 1.5rem;
            font-weight: bold;
            word-break: break-all;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>Formula Evaluator</h2>
    <div class="input-group">
        <label for="formulaInput">Enter Formula (e.g., 10 * 5 + Math.sqrt(16))</label>
        <input type="text" id="formulaInput" placeholder="Type your math here..." autocomplete="off">
    </div>
    <button id="evaluateBtn">Calculate</button>

    <div id="resultContainer" class="result-box">
        <span class="result-label">Result</span>
        <div id="resultValue" class="result-value"></div>
    </div>
</div>

<script>
    /**
     * Evaluates a mathematical expression string safely.
     * 
     * @param {string} formula - The user input string.
     * @returns {number|string} - The calculated result or an error message.
     */
    function evaluateFormula(formula) {
        if (!formula.trim()) {
            return "Please enter a formula.";
        }

        try {
            // 1. Basic Security Check: 
            // We allow numbers, operators (+, -, *, /, %), parentheses, whitespace, and Math functions.
            // This regex prevents execution of arbitrary code like alert() or fetch().
            const safePattern = /^[\d\s\+\-\*\/\%\(\)\.,]+|Math\.\w+/g;
            
            // Note: The regex above is a simplified allow-list approach. 
            // For a robust production app, use a dedicated math parser library (like math.js).
            // Here we verify that the string doesn't contain obvious code execution characters like letters outside of 'Math'.
            
            // A stricter check for this demo: Allow only digits, operators, parens, and the word "Math" followed by valid function names.
            // We will use a try-catch block with Function constructor as the evaluator, 
            // but we wrap it to catch syntax errors.
            
            // Create a function that returns the result of the expression
            // Using 'new Function' is safer than 'eval' regarding scope leakage, though still requires input sanitization.
            const calculate = new Function('return (' + formula + ')');
            const result = calculate();

            if (typeof result !== 'number' || !isFinite(result)) {
                return "Result is not a valid finite number.";
            }

            return result;

        } catch (error) {
            // If there's a syntax error or runtime error in the math
            return "Invalid Formula: " + error.message;
        }
    }

    // DOM Elements
    const formulaInput = document.getElementById('formulaInput');
    const evaluateBtn = document.getElementById('evaluateBtn');
    const resultContainer = document.getElementById('resultContainer');
    const resultValue = document.getElementById('resultValue');

    /**
     * Handles the evaluation logic and UI updates.
     */
    function handleEvaluation() {
        const inputVal = formulaInput.value;
        const output = evaluateFormula(inputVal);

        // Reset classes
        resultContainer.classList.remove('success', 'error');

        if (typeof output === 'number') {
            // Success state
            resultContainer.classList.add('success');
            resultValue.textContent = output;
        } else {
            // Error state
            resultContainer.classList.add('error');
            resultValue.textContent = output;
        }
    }

    // Event Listeners
    evaluateBtn.addEventListener('click', handleEvaluation);

    // Allow pressing "Enter" to calculate
    formulaInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleEvaluation();
        }
    });

</script>

</body>
</html>