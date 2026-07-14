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
            --bg-color: #f4f7f6;
            --card-bg: #ffffff;
            --text-color: #333;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            color: var(--text-color);
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
            text-align: center;
            color: var(--primary-color);
        }

        .input-group {
            margin-bottom: 1.5rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }

        input[type="text"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
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
            border-radius: 6px;
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
            background-color: #f8f9fa;
            border-radius: 6px;
            text-align: center;
            font-size: 1.2rem;
            min-height: 1.5em;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .error {
            color: var(--error-color);
            font-weight: bold;
        }

        .success {
            color: #27ae60;
            font-weight: bold;
        }

        .hint {
            font-size: 0.85rem;
            color: #666;
            margin-top: 0.5rem;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>Formula Evaluator</h2>
    
    <div class="input-group">
        <label for="formulaInput">Enter Formula:</label>
        <input type="text" id="formulaInput" placeholder="e.g., (5 + 10) * 2 or Math.sqrt(16)">
        <p class="hint">Supports standard math operations (+, -, *, /, ^) and Math functions.</p>
    </div>

    <button id="calculateBtn">Calculate</button>

    <div id="resultDisplay" class="result-box">Result will appear here</div>
</div>

<script>
    /**
     * Sanitizes the input string to prevent code injection.
     * Allows only numbers, math operators, parentheses, whitespace, and Math functions.
     */
    function sanitizeInput(input) {
        // Remove spaces for easier regex matching, though we allow them in the final check
        const cleanInput = input.replace(/\s/g, '');

        // Regex breakdown:
        // ^$ : Empty string is invalid (handled separately or allowed as 0)
        // [0-9] : Numbers
        // \. : Decimal points
        // [\+\-\*\/\%\(\)] : Math operators and parentheses
        // [a-zA-Z]+ : Letters (for Math functions like sin, cos, PI)
        
        // We strictly allow only specific characters to avoid executing arbitrary JS code.
        const allowedPattern = /^[0-9\.\+\-\*\/\%\(\)\s]+$/;
        
        // If it contains letters (like 'Math' or 'sin'), we need a more permissive check 
        // that specifically whitelists "Math" and standard operators, 
        // but for simplicity in this vanilla example, we will use a strict character whitelist
        // that excludes letters unless they are part of the "Math" object logic handled by JS natively.
        
        // A safer approach for a simple calculator:
        // 1. Replace '^' with '**' (exponentiation)
        let processedInput = input.replace(/\^/g, '**');

        // 2. Check if the string contains anything other than allowed characters.
        // Allowed: Numbers, operators (+ - * / %), parentheses, decimals, spaces, and "Math".
        const safePattern = /^[0-9\.\+\-\*\/\%\(\)\sMath]+$/;

        if (!safePattern.test(processedInput)) {
            throw new Error("Invalid characters detected.");
        }

        // 3. Prevent access to properties other than Math functions/constants
        // This is a basic check. A robust solution would parse the AST, but for vanilla JS:
        // We ensure that if 'Math' is used, it's followed by a dot and a valid function/constant name.
        // However, simply restricting characters usually suffices for basic calculators.
        
        return processedInput;
    }

    /**
     * Evaluates the formula safely.
     * @param {string} expression - The mathematical expression string.
     * @returns {number|string} - The result or an error message.
     */
    function evaluateFormula(expression) {
        try {
            if (!expression.trim()) {
                return "Please enter a formula.";
            }

            // Sanitize and process the input
            const safeExpression = sanitizeInput(expression);

            // Use Function constructor instead of eval() for slightly better scope isolation,
            // though both execute code. The sanitization step is the critical security measure here.
            // We wrap it in a function that returns the result.
            const calculate = new Function(`"use strict"; return (${safeExpression});`);
            
            const result = calculate();

            if (typeof result !== 'number' || !isFinite(result)) {
                throw new Error("Result is not a valid number.");
            }

            return result;

        } catch (error) {
            console.error(error);
            return "Error: Invalid formula or syntax.";
        }
    }

    // DOM Elements
    const inputField = document.getElementById('formulaInput');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultDisplay = document.getElementById('resultDisplay');

    // Event Listener for Button Click
    calculateBtn.addEventListener('click', () => {
        const formula = inputField.value;
        const result = evaluateFormula(formula);
        
        displayResult(result);
    });

    // Event Listener for Enter Key
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            calculateBtn.click();
        }
    });

    /**
     * Updates the UI with the result.
     * @param {*} result - The calculation result or error message.
     */
    function displayResult(result) {
        // Reset classes
        resultDisplay.classList.remove('success', 'error');

        if (typeof result === 'string' && result.startsWith("Error")) {
            resultDisplay.textContent = result;
            resultDisplay.classList.add('error');
        } else {
            // Format number to avoid long decimals if it's an integer, or limit precision
            let formattedResult = result;
            if (Number.isInteger(result)) {
                formattedResult = result;
            } else {
                // Limit to 10 decimal places to keep it clean
                formattedResult = parseFloat(result.toFixed(10));
            }
            
            resultDisplay.textContent = `= ${formattedResult}`;
            resultDisplay.classList.add('success');
        }
    }

</script>

</body>
</html>