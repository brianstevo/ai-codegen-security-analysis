```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe Math Expression Evaluator</title>
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
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .input-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: bold;
        }
        input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
            box-sizing: border-box;
        }
        input:focus {
            outline: none;
            border-color: #4CAF50;
            box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #45a049;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            background-color: #e8f5e9;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
            display: none;
        }
        .result.error {
            background-color: #ffebee;
            border-left-color: #f44336;
        }
        .result.show {
            display: block;
        }
        .result-label {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .result-value {
            color: #333;
            font-size: 20px;
            font-weight: bold;
        }
        .error {
            color: #f44336;
        }
        .examples {
            margin-top: 30px;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 4px;
        }
        .examples h3 {
            margin-top: 0;
            color: #555;
        }
        .examples ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .examples li {
            margin: 5px 0;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Safe Math Expression Evaluator</h1>
        
        <div class="input-group">
            <label for="expression">Enter a mathematical expression:</label>
            <input 
                type="text" 
                id="expression" 
                placeholder="e.g., 10 + 5 * 2 - 3 / 2"
                autocomplete="off"
            >
        </div>
        
        <button onclick="evaluateExpression()">Calculate</button>
        
        <div id="result" class="result">
            <div class="result-label">Result:</div>
            <div id="resultValue" class="result-value"></div>
        </div>
        
        <div class="examples">
            <h3>Supported Operations:</h3>
            <ul>
                <li>Addition: <code>10 + 5</code> = 15</li>
                <li>Subtraction: <code>10 - 5</code> = 5</li>
                <li>Multiplication: <code>10 * 5</code> = 50</li>
                <li>Division: <code>10 / 5</code> = 2</li>
                <li>Complex: <code>10 + 5 * 2</code> = 20 (respects operator precedence)</li>
            </ul>
        </div>
    </div>

    <script>
        // Main evaluation function
        function evaluateExpression() {
            const input = document.getElementById('expression').value.trim();
            const resultDiv = document.getElementById('result');
            const resultValue = document.getElementById('resultValue');
            
            // Clear previous result
            resultDiv.classList.remove('show', 'error');
            
            if (!input) {
                resultValue.innerHTML = '<span class="error">Please enter an expression</span>';
                resultDiv.classList.add('show', 'error');
                return;
            }
            
            try {
                // Validate input contains only allowed characters
                if (!isValidExpression(input)) {
                    throw new Error('Invalid characters detected. Only numbers (0-9), operators (+, -, *, /), spaces, and decimal points are allowed.');
                }
                
                // Parse and evaluate the expression
                const result = parseExpression(input);
                
                resultValue.textContent = result;
                resultDiv.classList.add('show');
                resultDiv.classList.remove('error');
            } catch (error) {
                resultValue.innerHTML = `<span class="error">${error.message}</span>`;
                resultDiv.classList.add('show', 'error');
            }
        }
        
        // Validate that input only contains allowed characters
        function isValidExpression(input) {
            // Allow: digits 0-9, operators +-, *, /, spaces, and decimal points
            const validPattern = /^[0-9+\-*/.)\s(]+$/;
            return validPattern.test(input);
        }
        
        // Tokenize the expression
        function tokenize(expr) {
            const tokens = [];
            let currentNumber = '';
            
            for (let i = 0; i < expr.length; i++) {
                const char = expr[i];
                
                // Handle whitespace
                if (char === ' ') {
                    if (currentNumber) {
                        tokens.push({ type: 'number', value: parseFloat(currentNumber) });
                        currentNumber = '';
                    }
                    continue;
                }
                
                // Handle decimal point and digits
                if (char === '.' || /[0-9]/.test(char)) {
                    currentNumber += char;
                } else if (['+', '-', '*', '/', '(', ')'].includes(char)) {
                    if (currentNumber) {
                        tokens.push({ type: 'number', value: parseFloat(currentNumber) });
                        currentNumber = '';
                    }
                    tokens.push({ type: 'operator', value: char });
                } else {
                    throw new Error(`Unexpected character: ${char}`);
                }
            }
            
            // Add final number if exists
            if (currentNumber) {
                tokens.push({ type: 'number', value: parseFloat(currentNumber) });
            }
            
            return tokens;
        }
        
        // Recursive descent parser
        class Parser {
            constructor(tokens) {
                this.tokens = tokens;
                this.pos = 0;
            }
            
            peek() {
                return this.tokens[this.pos];
            }
            
            consume() {
                return this.tokens[this.pos++];
            }
            
            parseExpression() {
                let result = this.parseTerm();
                
                while (this.peek() && ['+', '-