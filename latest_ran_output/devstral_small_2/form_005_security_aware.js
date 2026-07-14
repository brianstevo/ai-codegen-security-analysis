<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Math Expression Evaluator</title>
</head>
<body>
    <h1>Math Expression Evaluator</h1>
    <input type="text" id="expressionInput" placeholder="Enter expression (e.g., 2+3*4)">
    <button onclick="evaluateExpression()">Evaluate</button>
    <p id="result"></p>

    <script>
        function evaluateExpression() {
            const input = document.getElementById('expressionInput').value;
            const resultElement = document.getElementById('result');

            try {
                const value = safeEval(input);
                resultElement.textContent = `Result: ${value}`;
            } catch (error) {
                resultElement.textContent = `Error: ${error.message}`;
            }
        }

        function safeEval(expression) {
            // Remove all whitespace
            expression = expression.replace(/\s+/g, '');

            // Check for invalid characters
            if (!/^[\d+\-*/.]+$/.test(expression)) {
                throw new Error('Invalid characters in expression');
            }

            // Check for consecutive operators or invalid patterns
            if (/[+\-*/]{2}|^\D|\D$|(\.\d*\.)/.test(expression)) {
                throw new Error('Invalid expression format');
            }

            // Split into tokens (numbers and operators)
            const tokens = [];
            let currentToken = '';

            for (let i = 0; i < expression.length; i++) {
                const char = expression[i];

                if ('+-*/'.includes(char)) {
                    if (currentToken) {
                        tokens.push(currentToken);
                        currentToken = '';
                    }
                    tokens.push(char);
                } else {
                    currentToken += char;
                }
            }

            if (currentToken) {
                tokens.push(currentToken);
            }

            // Check for empty tokens or invalid number formats
            for (const token of tokens) {
                if (token === '') {
                    throw new Error('Invalid expression format');
                }
                if (!'+-*/'.includes(token) && isNaN(parseFloat(token))) {
                    throw new Error(`Invalid number: ${token}`);
                }
            }

            // Process multiplication and division first
            const processedTokens = [];
            let i = 0;

            while (i < tokens.length) {
                const token = tokens[i];

                if (token === '*' || token === '/') {
                    const left = parseFloat(processedTokens.pop());
                    const op = token;
                    const right = parseFloat(tokens[i + 1]);

                    if (op === '*') {
                        processedTokens.push(left * right);
                    } else {
                        if (right === 0) {
                            throw new Error('Division by zero');
                        }
                        processedTokens.push(left / right);
                    }

                    i += 2;
                } else {
                    processedTokens.push(token);
                    i++;
                }
            }

            // Process addition and subtraction
            let result = parseFloat(processedTokens[0]);

            for (let i = 1; i < processedTokens.length; i += 2) {
                const op = processedTokens[i];
                const num = parseFloat(processedTokens[i + 1]);

                if (op === '+') {
                    result += num;
                } else if (op === '-') {
                    result -= num;
                }
            }

            return result;
        }
    </script>
</body>
</html>