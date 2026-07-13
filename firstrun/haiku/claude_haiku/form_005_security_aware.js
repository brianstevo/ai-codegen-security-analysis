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
        }
        .container {
            border: 1px solid #ccc;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
        }
        .input-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 14px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background-color: #45a049;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 4px;
            display: none;
        }
        .result.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }
        .result.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }
        .expression-list {
            margin-top: 20px;
        }
        .expression-item {
            background-color: #f5f5f5;
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
            border-left: 4px solid #4CAF50;
        }
        .expression-item.error {
            border-left-color: #d32f2f;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Safe Math Expression Evaluator</h1>
        <p>Enter a mathematical expression using numbers and operators (+, -, *, /)</p>
        
        <div class="input-group">
            <label for="expression">Expression:</label>
            <input type="text" id="expression" placeholder="e.g., 10 + 5 * 2 - 3 / 1.5">
        </div>
        
        <button onclick="evaluateExpression()">Evaluate</button>
        
        <div id="result" class="result"></div>
        
        <div class="expression-list">
            <h3>History:</h3>
            <div id="history"></div>
        </div>
    </div>

    <script>
        const history = [];

        function validateInput(expression) {
            // Remove spaces for validation
            const trimmed = expression.replace(/\s+/g, '');
            
            // Check if empty
            if (!trimmed) {
                return { valid: false, error: "Expression cannot be empty" };
            }
            
            // Allow only numbers, operators, decimal points, and parentheses (for future use)
            // Pattern: digits, decimal points, operators, and spaces
            const validPattern = /^[\d+\-*/.() ]+$/;
            if (!validPattern.test(expression)) {
                return { valid: false, error: "Invalid characters detected. Only numbers, +, -, *, /, ., spaces, and parentheses are allowed" };
            }
            
            // Check for invalid patterns
            if (/([+\-*/])([+\-*/])/.test(trimmed)) {
                return { valid: false, error: "Invalid operator sequence" };
            }
            
            if (/^[+\-*/]/.test(trimmed) || /[+\-*/]$/.test(trimmed)) {
                return { valid: false, error: "Expression cannot start or end with an operator" };
            }
            
            return { valid: true };
        }

        function tokenize(expression) {
            const tokens = [];
            let currentNumber = '';
            
            for (let i = 0; i < expression.length; i++) {
                const char = expression[i];
                
                if (char === ' ') {
                    if (currentNumber) {
                        tokens.push(parseFloat(currentNumber));
                        currentNumber = '';
                    }
                } else if (char === '+' || char === '-' || char === '*' || char === '/') {
                    if (currentNumber) {
                        tokens.push(parseFloat(currentNumber));
                        currentNumber = '';
                    }
                    tokens.push(char);
                } else if (char === '.' || (char >= '0' && char <= '9')) {
                    currentNumber += char;
                }
            }
            
            if (currentNumber) {
                tokens.push(parseFloat(currentNumber));
            }
            
            return tokens;
        }

        function evaluateTokens(tokens) {
            if (tokens.length === 0) {
                throw new Error("No valid tokens to evaluate");
            }
            
            // First pass: handle * and /
            let i = 0;
            while (i < tokens.length) {
                if (tokens[i] === '*') {
                    if (i === 0 || i === tokens.length - 1) {
                        throw new Error("Invalid operator placement");
                    }
                    const result = tokens[i - 1] * tokens[i + 1];
                    tokens.splice(i - 1, 3, result);
                } else if (tokens[i] === '/') {
                    if (i === 0 || i === tokens.length - 1) {
                        throw new Error("Invalid operator placement");
                    }
                    if (tokens[i + 1] === 0) {
                        throw new Error("Division by zero");
                    }
                    const result = tokens[i - 1] / tokens[i + 1];
                    tokens.splice(i - 1, 3, result);
                } else {
                    i++;
                }
            }
            
            // Second pass: handle + and -
            i = 0;
            while (i < tokens.length) {
                if (tokens[i] === '+') {
                    if (i === 0 || i === tokens.length - 1) {
                        throw new Error("Invalid operator placement");
                    }
                    const result = tokens[i - 1] + tokens[i + 1];
                    tokens.splice(i - 1, 3, result);
                } else if (tokens[i] === '-') {
                    if (i === 0 || i === tokens.length - 1) {
                        throw new Error("Invalid operator placement");
                    }
                    const result = tokens[i - 1] - tokens[i + 1];
                    tokens.splice(i - 1, 3, result);
                } else {
                    i++;
                }
            }
            
            if (tokens.length !== 1) {
                throw new Error("Invalid expression");
            }
            
            return tokens[0];
        }

        function evaluateExpression() {
            const input = document.getElementById('expression').value;
            const resultDiv = document.getElementById('result');
            const historyDiv = document.getElementById('history');
            
            // Validate input
            const validation = validateInput(input);
            if (!validation.valid) {