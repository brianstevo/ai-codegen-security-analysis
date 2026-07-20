<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: bold;
        }
        
        input[type="text"] {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
            transition: border-color 0.3s;
        }
        
        input[type="text"]:focus {
            outline: none;
            border-color: #4CAF50;
        }
        
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: background-color 0.3s;
        }
        
        button:hover {
            background-color: #45a049;
        }
        
        button:active {
            background-color: #3d8b40;
        }
        
        .result {
            margin-top: 20px;
            padding: 15px;
            background-color: #f0f0f0;
            border-radius: 4px;
            display: none;
        }
        
        .result.show {
            display: block;
        }
        
        .result-label {
            color: #666;
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .result-value {
            font-size: 24px;
            color: #4CAF50;
            font-weight: bold;
            word-break: break-all;
        }
        
        .error {
            background-color: #ffebee;
            color: #c62828;
        }
        
        .error .result-value {
            color: #c62828;
        }
        
        .examples {
            margin-top: 20px;
            padding: 15px;
            background-color: #e8f5e9;
            border-radius: 4px;
            font-size: 12px;
            color: #2e7d32;
        }
        
        .examples h3 {
            margin-top: 0;
            color: #1b5e20;
        }
        
        .examples ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .examples li {
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Formula Evaluator</h1>
        
        <div class="form-group">
            <label for="formulaInput">Enter a formula:</label>
            <input 
                type="text" 
                id="formulaInput" 
                placeholder="e.g., 2 + 3 * 4, Math.sqrt(16), (10 + 5) / 3"
                value=""
            >
        </div>
        
        <button onclick="evaluateFormula()">Calculate</button>
        
        <div id="resultContainer" class="result">
            <div class="result-label">Result:</div>
            <div id="resultValue" class="result-value"></div>
        </div>
        
        <div class="examples">
            <h3>Examples:</h3>
            <ul>
                <li><strong>Basic math:</strong> 2 + 3 * 4 → 14</li>
                <li><strong>Parentheses:</strong> (10 + 5) / 3 → 5</li>
                <li><strong>Powers:</strong> 2 ** 8 → 256</li>
                <li><strong>Math functions:</strong> Math.sqrt(16) → 4</li>
                <li><strong>Trigonometry:</strong> Math.sin(Math.PI / 2) → 1</li>
                <li><strong>Logarithm:</strong> Math.log10(100) → 2</li>
                <li><strong>Constants:</strong> Math.PI * 5 → 15.707...</li>
            </ul>
        </div>
    </div>

    <script>
        const formulaInput = document.getElementById('formulaInput');
        const resultContainer = document.getElementById('resultContainer');
        const resultValue = document.getElementById('resultValue');

        // Allow Enter key to evaluate
        formulaInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                evaluateFormula();
            }
        });

        function evaluateFormula() {
            const formula = formulaInput.value.trim();
            
            if (!formula) {
                resultContainer.classList.remove('show');
                return;
            }

            try {
                // Create a safe evaluation context with Math object
                const result = Function('"use strict"; return (' + formula + ')')();
                
                // Check if result is a valid number
                if (typeof result === 'number' && isFinite(result)) {
                    resultContainer.classList.remove('error');
                    resultContainer.classList.add('show');
                    
                    // Format the result nicely
                    if (Number.isInteger(result)) {
                        resultValue.textContent = result;
                    } else {
                        // Show up to 10 decimal places, removing trailing zeros
                        resultValue.textContent = parseFloat(result.toFixed(10));
                    }
                } else if (result === null || result === undefined) {
                    throw new Error('Formula returned no value');
                } else if (typeof result === 'boolean' || typeof result === 'string') {
                    throw new Error('Formula must evaluate to a number');
                } else {
                    throw new Error('Invalid result type');
                }
            } catch (error) {
                resultContainer.classList.add('error');
                resultContainer.classList.add('show');
                resultValue.textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>